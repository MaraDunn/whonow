import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SubscriptionData, SubscriptionTier, FeatureName, FEATURE_ACCESS } from "@/types/subscription";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { openExternalUrl } from "@/utils/openExternalUrl";

// Persistent cache key for subscription data
const SUBSCRIPTION_CACHE_KEY = "whonow_subscription_cache";

// Request deduplication: if a request is in flight, share the promise
let pendingRequest: Promise<SubscriptionData> | null = null;

// Load cached subscription from localStorage
const loadCachedSubscription = (): SubscriptionData => {
  try {
    const cached = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as SubscriptionData;
      // Only use cache if it's less than 5 minutes old
      const cacheTime = localStorage.getItem(`${SUBSCRIPTION_CACHE_KEY}_time`);
      if (cacheTime && Date.now() - parseInt(cacheTime) < 5 * 60 * 1000) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Failed to load cached subscription:", error);
  }
  // Default to starter if no valid cache
  return {
    subscribed: false,
    tier: "starter",
    seatsLimit: 1,
    seatsUsed: 0,
    subscriptionEnd: null,
  };
};

// Save subscription to localStorage
const cacheSubscription = (data: SubscriptionData) => {
  try {
    localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(`${SUBSCRIPTION_CACHE_KEY}_time`, Date.now().toString());
  } catch (error) {
    console.error("Failed to cache subscription:", error);
  }
};

export const useSubscription = () => {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData>(loadCachedSubscription);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateOrganizationAfterUpgrade, setShowCreateOrganizationAfterUpgrade] = useState(false);

  const normalizeTier = (rawTier: unknown, subscribed: boolean): SubscriptionTier => {
    // If not subscribed, always treat as starter.
    if (!subscribed) return "starter";

    // Current self-serve tiers.
    if (rawTier === "starter" || rawTier === "pro" || rawTier === "business" || rawTier === "enterprise") {
      return rawTier;
    }

    // Legacy "team" tier maps to new "business".
    if (rawTier === "team") return "business";

    // Legacy "enterprise" / "global_enterprise" DB values map to new "enterprise".
    if (rawTier === "global_enterprise") return "enterprise";

    // Any other unexpected value falls back to enterprise (highest self-serve tier).
    return "enterprise";
  };

  const describeFunctionsError = (err: unknown): string => {
    if (err instanceof FunctionsHttpError) {
      const body = err.context?.body;
      if (typeof body === "string") {
        try {
          const parsed = JSON.parse(body) as { error?: string; message?: string };
          if (typeof parsed?.error === "string") return parsed.error;
          if (typeof parsed?.message === "string") return parsed.message;
        } catch {
          return body;
        }
        return body;
      }
      if (body && typeof body === "object") {
        const maybeError = (body as { error?: unknown; message?: unknown }).error ?? (body as { message?: unknown }).message;
        if (typeof maybeError === "string") return maybeError;
      }
      return `Edge Function HTTP ${err.context?.status ?? "error"}`;
    }
    return err instanceof Error ? err.message : "Unknown error";
  };

  const getCustomerPortalErrorMessage = async (err: unknown): Promise<string> => {
    const fallback = describeFunctionsError(err) || "Failed to open billing portal";
    if (!(err instanceof FunctionsHttpError) || !err.context) return fallback;
    const res = err.context as Response;
    try {
      const r = typeof (res as Response).clone === "function" ? (res as Response).clone() : res;
      const text = await (typeof (r as Response).text === "function" ? (r as Response).text() : Promise.resolve(""));
      const body = text && String(text).trim().startsWith("{") ? (JSON.parse(String(text)) as { error?: string }) : null;
      if (body?.error && typeof body.error === "string") return body.error;
      if (typeof (res as Response).status === "number" && (res as Response).status >= 500) {
        return "Billing portal is unavailable. Check that STRIPE_SECRET_KEY is set in Supabase and Stripe Customer Portal is enabled.";
      }
    } catch {
      if (typeof (res as Response).status === "number" && (res as Response).status >= 500) {
        return "Billing portal is unavailable. Check that STRIPE_SECRET_KEY is set in Supabase and Stripe Customer Portal is enabled.";
      }
    }
    return fallback;
  };

  // Get a valid access token, always refreshing so we don't send an expired JWT (avoids 401 from gateway)
  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
    if (error || !refreshed?.access_token) return null;
    return refreshed.access_token;
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!session?.access_token || !user) {
      // Don't reset subscription if we're just waiting for auth to load
      // Only reset if we're certain there's no user (after loading completes)
      setIsLoading(false);
      return;
    }

    // If a request is already in flight, wait for it instead of making a new one
    if (pendingRequest) {
      try {
        const result = await pendingRequest;
        setSubscription(result);
        setIsLoading(false);
        return;
      } catch {
        // If the pending request failed, continue to make a new one
        pendingRequest = null;
      }
    }

    // Create a new request and store it
    pendingRequest = (async (): Promise<SubscriptionData> => {
      try {
        // First, get the effective subscription tier (includes company subscriptions via employee access)
        const { data: effectiveTier, error: tierError } = await supabase
          .rpc("get_user_subscription_tier", { _user_id: user.id });

        if (tierError) {
          console.error("Error getting effective subscription tier:", tierError);
        }

        // Try to get subscription data - check both user's own subscription and company subscription
        const { data: userSubscription, error: userSubError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        // Also check for company subscription (if user is in a company)
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();

        let companySubscription = null;
        if (profile?.company_id) {
          // Look for company subscription - it could be tied to company_id
          // Note: company subscriptions might have user_id set to the admin who created it
          // So we need to check both: subscriptions with company_id, or subscriptions where
          // the user_id belongs to someone in the same company
          const { data: companySub, error: companySubError } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("company_id", profile.company_id)
            .eq("status", "active")
            .maybeSingle();
          
          if (companySubError) {
            console.error("Error fetching company subscription:", companySubError);
          }
          
          companySubscription = companySub;
          
          // If no subscription found with company_id, try finding subscription of any company member
          // (With the updated RLS policy, we should be able to see these)
          if (!companySubscription) {
            // Get all company member IDs
            const { data: companyProfiles } = await supabase
              .from("profiles")
              .select("id")
              .eq("company_id", profile.company_id);
            
            if (companyProfiles && companyProfiles.length > 0) {
              const memberIds = companyProfiles.map(p => p.id);
              // Find any active subscription for company members (prioritize non-starter tiers)
              const { data: memberSubs } = await supabase
                .from("subscriptions")
                .select("*")
                .in("user_id", memberIds)
                .eq("status", "active")
                .order("tier", { ascending: false }); // Order by tier (enterprise > business > pro > starter)
              
              if (memberSubs && memberSubs.length > 0) {
                // Find the highest tier subscription (prefer enterprise > business > pro)
                const bestSub = memberSubs.find(s => s.tier !== "starter") || memberSubs[0];
                if (bestSub && bestSub.tier !== "starter") {
                  companySubscription = bestSub;
                }
              }
            }
          }
        }

        // Priority: effective tier (includes employee access keys) > company subscription > user subscription > starter
        // If user is in a company and company has a subscription, use that tier
        // This allows company members to inherit company subscription benefits
        let tier = effectiveTier || companySubscription?.tier || userSubscription?.tier || "starter";
        let subscriptionToUse = companySubscription || userSubscription;

        // If user is in a company and company has a subscription, use company subscription
        // This ensures company members get access to company features even without employee access keys
        if (companySubscription && companySubscription.status === "active") {
          tier = companySubscription.tier;
          subscriptionToUse = companySubscription;
        } else if (effectiveTier && effectiveTier !== "starter") {
          // Use effective tier if available (from employee access keys)
          tier = effectiveTier;
        }

        // If we have a subscription (personal or company), use it
        if (subscriptionToUse) {
          // Use the tier we determined (which prioritizes company subscription)
          const finalTier = tier;
          const isSubscribed = subscriptionToUse.status === "active" && finalTier !== "starter";
          const subscriptionData: SubscriptionData = {
            subscribed: isSubscribed,
            tier: normalizeTier(finalTier, isSubscribed),
            seatsLimit: subscriptionToUse.employee_seats_limit ?? 1,
            seatsUsed: subscriptionToUse.employee_seats_used ?? 0,
            subscriptionEnd: subscriptionToUse.current_period_end ?? null,
          };
          setSubscription(subscriptionData);
          cacheSubscription(subscriptionData);
          setIsLoading(false);
          return subscriptionData;
        }

        // If we have an effective tier from the function but no subscription record,
        // create subscription data from the tier (e.g., from employee access key)
        if (effectiveTier && effectiveTier !== "starter") {
          const isSubscribed = true;
          const subscriptionData: SubscriptionData = {
            subscribed: isSubscribed,
            tier: normalizeTier(effectiveTier, isSubscribed),
            seatsLimit: 1,
            seatsUsed: 0,
            subscriptionEnd: null,
          };
          setSubscription(subscriptionData);
          cacheSubscription(subscriptionData);
          setIsLoading(false);
          return subscriptionData;
        }

        // If user is in a company with a subscription but no subscriptionToUse was set,
        // use the company subscription tier directly (for members who joined via invite code)
        // This is critical for users who join via invite code to get company features
        if (companySubscription && companySubscription.status === "active" && !subscriptionToUse) {
          const companyTier = companySubscription.tier;
          if (companyTier && companyTier !== "starter") {
            const isSubscribed = true;
            const subscriptionData: SubscriptionData = {
              subscribed: isSubscribed,
              tier: normalizeTier(companyTier, isSubscribed),
              seatsLimit: companySubscription.employee_seats_limit ?? 1,
              seatsUsed: companySubscription.employee_seats_used ?? 0,
              subscriptionEnd: companySubscription.current_period_end ?? null,
            };
            setSubscription(subscriptionData);
            cacheSubscription(subscriptionData);
            setIsLoading(false);
            return subscriptionData;
          }
        }

        // Fallback: Try Edge Function if database doesn't have subscription (syncs from Stripe to DB)
        let token = await getValidAccessToken();
        if (!token && session?.access_token) {
          token = session.access_token;
        }
        if (!token) {
          const starterData: SubscriptionData = {
            subscribed: false,
            tier: "starter",
            seatsLimit: 1,
            seatsUsed: 0,
            subscriptionEnd: null,
          };
          setSubscription(starterData);
          setIsLoading(false);
          return starterData;
        }
        const { data, error } = await supabase.functions.invoke("check-subscription", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (error) {
          console.error("Error checking subscription:", error);
          // Don't reset subscription on network errors - keep cached data
          // This prevents flickering during navigation
          setIsLoading(false);
          throw error; // Re-throw so pending request is cleared
        }

        // Handle case where function returns error in response body
        if (data?.error) {
          // Temporary state: Stripe subscription not ready yet (e.g. missing period dates)
          if (data.error === "Subscription is being processed, please try again in a moment") {
            const processingData: SubscriptionData = {
              subscribed: false,
              tier: "starter",
              seatsLimit: 1,
              seatsUsed: 0,
              subscriptionEnd: null,
            };
            setSubscription(processingData);
            setIsLoading(false);
            return processingData;
          }
          console.error("Subscription check returned error:", data.error);
          setIsLoading(false);
          throw new Error(data.error);
        }

        const subscriptionData: SubscriptionData = {
          subscribed: data?.subscribed ?? false,
          tier: normalizeTier(data?.tier, data?.subscribed ?? false),
          productId: data?.product_id,
          seatsLimit: data?.seats_limit ?? 1,
          seatsUsed: data?.seats_used ?? 0,
          subscriptionEnd: data?.subscription_end ?? null,
        };
        setSubscription(subscriptionData);
        cacheSubscription(subscriptionData);
        setIsLoading(false);
        return subscriptionData;
      } catch (error) {
        console.error("Failed to check subscription:", error);
        setIsLoading(false);
        throw error; // Re-throw to clear pending request
      } finally {
        // Clear pending request after completion (success or failure)
        pendingRequest = null;
      }
    })();

    // Wait for the request (loading state is managed inside the promise)
    try {
      await pendingRequest;
    } catch (error) {
      // Error already logged in the promise, just keep cached data
      if (error instanceof FunctionsHttpError) {
        console.error("check-subscription details:", error.context);
      }
      // Don't reset subscription on errors - keep cached data to prevent flickering
      // Loading state already set to false in the promise
    }
  }, [session?.access_token, user, getValidAccessToken]);

  useEffect(() => {
    // If user is logged out, clear cache and reset to starter
    if (!user) {
      const starterData: SubscriptionData = {
        subscribed: false,
        tier: "starter",
        seatsLimit: 1,
        seatsUsed: 0,
        subscriptionEnd: null,
      };
      setSubscription(starterData);
      try {
        localStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
        localStorage.removeItem(`${SUBSCRIPTION_CACHE_KEY}_time`);
      } catch (error) {
        console.error("Failed to clear subscription cache:", error);
      }
      setIsLoading(false);
      return;
    }

    // On login: clear cache and run a fresh subscription check so relogging always shows current tier
    try {
      localStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
      localStorage.removeItem(`${SUBSCRIPTION_CACHE_KEY}_time`);
    } catch (error) {
      console.error("Failed to clear subscription cache on login:", error);
    }
    checkSubscription();

    // Listen for manual refresh events (e.g., after joining a company)
    const handleRefresh = () => {
      checkSubscription();
    };
    window.addEventListener("refresh-subscription", handleRefresh);

    // Refresh subscription status every minute
    const interval = setInterval(checkSubscription, 60000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh-subscription", handleRefresh);
    };
  }, [checkSubscription, user]);

  // Check on URL change for post-checkout refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      toast.success("Subscription activated successfully!");
      setShowCreateOrganizationAfterUpgrade(true);
      checkSubscription();
      // Webhook can be delayed; retry reading from DB so tier updates even when
      // check-subscription is blocked (e.g. waitlist mode)
      const retryMs = [2500, 5000];
      retryMs.forEach((ms) => {
        setTimeout(() => {
          checkSubscription();
        }, ms);
      });
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [checkSubscription]);

  const dismissCreateOrgPrompt = useCallback(() => {
    setShowCreateOrganizationAfterUpgrade(false);
  }, []);

  const canAccessFeature = useCallback(
    (feature: FeatureName): boolean => {
      const allowedTiers = FEATURE_ACCESS[feature];
      return allowedTiers.includes(subscription.tier);
    },
    [subscription.tier]
  );

  const createCheckout = useCallback(
    async (tier: SubscriptionTier, seats?: number) => {
      if (!session?.access_token) {
        toast.error("Please sign in to subscribe");
        return null;
      }

      try {
        const token = await getValidAccessToken();
        if (!token) {
          toast.error("Session expired. Please sign in again.");
          return null;
        }
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: { tier, seats: seats ?? 1 },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (error) {
          console.error("Checkout error:", error);
          if (error instanceof FunctionsHttpError) {
            console.error("create-checkout details:", error.context);
            try {
              const text = await error.context.clone().text();
              console.error("create-checkout response body:", text);
              // Try to surface JSON error messages if present
              try {
                const parsed = JSON.parse(text) as { error?: string; hint?: string };
                if (parsed?.error) {
                  toast.error(parsed.hint ? `${parsed.error} — ${parsed.hint}` : parsed.error);
                  return null;
                }
              } catch {
                // Not JSON, fall back to raw text
              }
              if (text) {
                toast.error(text);
                return null;
              }
            } catch (e) {
              console.error("Failed to read create-checkout error body:", e);
            }
          }
          toast.error(error.message || "Failed to start checkout process");
          return null;
        }

        if (data?.error) {
          console.error("Checkout returned error:", data.error);
          toast.error(data.error || "Failed to start checkout process");
          return null;
        }

        if (data?.url) {
          await openExternalUrl(data.url);
          return data.url;
        } else {
          toast.error("No checkout URL received");
          return null;
        }
      } catch (error) {
        console.error("Error creating checkout:", error);
        if (error instanceof FunctionsHttpError) {
          console.error("create-checkout details:", error.context);
        }
        const errorMessage = describeFunctionsError(error);
        toast.error(errorMessage);
        return null;
      }
    },
    [session?.access_token, getValidAccessToken]
  );

  const openCustomerPortal = useCallback(async () => {
    if (!session?.access_token) {
      toast.error("Please sign in to manage your subscription");
      return null;
    }

    try {
      const token = await getValidAccessToken();
      if (!token) {
        toast.error("Session expired. Please sign in again.");
        return null;
      }
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) {
        console.error("Customer portal error:", error);
        const message = await getCustomerPortalErrorMessage(error);
        toast.error(message);
        return null;
      }

      if (data?.error) {
        console.error("Customer portal returned error:", data.error);
        toast.error(data.error || "Failed to open billing portal");
        return null;
      }

      if (data?.url) {
        await openExternalUrl(data.url);
        return data.url;
      }
      toast.error("No portal URL received");
      return null;
    } catch (err) {
      console.error("Error opening customer portal:", err);
      const message = await getCustomerPortalErrorMessage(err);
      toast.error(message);
      return null;
    }
  }, [session?.access_token, getValidAccessToken]);

  return {
    ...subscription,
    isLoading,
    canAccessFeature,
    createCheckout,
    openCustomerPortal,
    refreshSubscription: checkSubscription,
    showCreateOrganizationAfterUpgrade,
    dismissCreateOrgPrompt,
  };
};
