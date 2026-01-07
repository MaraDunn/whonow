import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SubscriptionData, SubscriptionTier, FeatureName, FEATURE_ACCESS } from "@/types/subscription";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";

// Persistent cache key for subscription data
const SUBSCRIPTION_CACHE_KEY = "whonow_subscription_cache";

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

  const normalizeTier = (rawTier: unknown, subscribed: boolean): SubscriptionTier => {
    // If not subscribed, always treat as starter.
    if (!subscribed) return "starter";

    // Only allow self-serve tiers in the app UI.
    if (rawTier === "starter" || rawTier === "pro" || rawTier === "team" || rawTier === "business") {
      return rawTier;
    }

    // Legacy enterprise tiers (or unexpected values) are treated as business.
    return "business";
  };

  const describeFunctionsError = (err: unknown): string => {
    if (err instanceof FunctionsHttpError) {
      const body = err.context?.body;
      if (typeof body === "string") return body;
      if (body && typeof body === "object") {
        const maybeError = (body as { error?: unknown; message?: unknown }).error ?? (body as { message?: unknown }).message;
        if (typeof maybeError === "string") return maybeError;
      }
      return `Edge Function HTTP ${err.context?.status ?? "error"}`;
    }
    return err instanceof Error ? err.message : "Unknown error";
  };

  const checkSubscription = useCallback(async () => {
    if (!session?.access_token || !user) {
      // Don't reset subscription if we're just waiting for auth to load
      // Only reset if we're certain there's no user (after loading completes)
      setIsLoading(false);
      return;
    }

    try {
      // First, try reading directly from database (more reliable)
      const { data: dbData, error: dbError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!dbError && dbData) {
        // We have subscription data from database
        const isSubscribed = dbData.status === "active" && dbData.tier !== "starter";
        const subscriptionData: SubscriptionData = {
          subscribed: isSubscribed,
          tier: normalizeTier(dbData.tier, isSubscribed),
          seatsLimit: dbData.employee_seats_limit ?? 1,
          seatsUsed: dbData.employee_seats_used ?? 0,
          subscriptionEnd: dbData.current_period_end ?? null,
        };
        setSubscription(subscriptionData);
        cacheSubscription(subscriptionData);
        setIsLoading(false);
        return;
      }

      // Fallback: Try Edge Function if database doesn't have subscription
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Error checking subscription:", error);
        // Don't reset subscription on network errors - keep cached data
        // This prevents flickering during navigation
        setIsLoading(false);
        return;
      }

      // Handle case where function returns error in response body
      if (data?.error) {
        console.error("Subscription check returned error:", data.error);
        // Don't reset subscription on API errors - keep cached data
        setIsLoading(false);
        return;
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
    } catch (error) {
      console.error("Failed to check subscription:", error);
      if (error instanceof FunctionsHttpError) {
        console.error("check-subscription details:", error.context);
      }
      // Don't reset subscription on errors - keep cached data to prevent flickering
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token, user]);

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

    checkSubscription();

    // Refresh subscription status every minute
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription, user]);

  // Check on URL change for post-checkout refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      toast.success("Subscription activated successfully!");
      checkSubscription();
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [checkSubscription]);

  const canAccessFeature = useCallback(
    (feature: FeatureName): boolean => {
      const allowedTiers = FEATURE_ACCESS[feature];
      return allowedTiers.includes(subscription.tier);
    },
    [subscription.tier]
  );

  const createCheckout = useCallback(
    async (tier: SubscriptionTier) => {
      if (!session?.access_token) {
        toast.error("Please sign in to subscribe");
        return null;
      }

      try {
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: { tier },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
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
          window.open(data.url, "_blank");
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
    [session?.access_token]
  );

  const openCustomerPortal = useCallback(async () => {
    if (!session?.access_token) {
      toast.error("Please sign in to manage your subscription");
      return null;
    }

      try {
        const { data, error } = await supabase.functions.invoke("customer-portal", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) {
          console.error("Customer portal error:", error);
          if (error instanceof FunctionsHttpError) {
            console.error("customer-portal details:", error.context);
          }
          toast.error(error.message || "Failed to open billing portal");
          return null;
        }

        if (data?.error) {
          console.error("Customer portal returned error:", data.error);
          toast.error(data.error || "Failed to open billing portal");
          return null;
        }

        if (data?.url) {
          window.open(data.url, "_blank");
          return data.url;
        } else {
          toast.error("No portal URL received");
          return null;
        }
      } catch (error) {
        console.error("Error opening customer portal:", error);
        if (error instanceof FunctionsHttpError) {
          console.error("customer-portal details:", error.context);
        }
        const errorMessage = describeFunctionsError(error);
        toast.error(errorMessage);
        return null;
      }
  }, [session?.access_token]);

  return {
    ...subscription,
    isLoading,
    canAccessFeature,
    createCheckout,
    openCustomerPortal,
    refreshSubscription: checkSubscription,
  };
};
