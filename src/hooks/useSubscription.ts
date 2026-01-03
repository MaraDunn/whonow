import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SubscriptionData, SubscriptionTier, FeatureName, FEATURE_ACCESS } from "@/types/subscription";
import { toast } from "sonner";

export const useSubscription = () => {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData>({
    subscribed: false,
    tier: "starter",
    seatsLimit: 1,
    seatsUsed: 0,
    subscriptionEnd: null,
  });
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

  const checkSubscription = useCallback(async () => {
    if (!session?.access_token) {
      setSubscription({
        subscribed: false,
        tier: "starter",
        seatsLimit: 1,
        seatsUsed: 0,
        subscriptionEnd: null,
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Error checking subscription:", error);
        // Fail gracefully - default to starter tier
        setSubscription({
          subscribed: false,
          tier: "starter",
          seatsLimit: 1,
          seatsUsed: 0,
          subscriptionEnd: null,
        });
        setIsLoading(false);
        return;
      }

      // Handle case where function returns error in response body
      if (data?.error) {
        console.error("Subscription check returned error:", data.error);
        setSubscription({
          subscribed: false,
          tier: "starter",
          seatsLimit: 1,
          seatsUsed: 0,
          subscriptionEnd: null,
        });
        setIsLoading(false);
        return;
      }

      setSubscription({
        subscribed: data?.subscribed ?? false,
        tier: normalizeTier(data?.tier, data?.subscribed ?? false),
        productId: data?.product_id,
        seatsLimit: data?.seats_limit ?? 1,
        seatsUsed: data?.seats_used ?? 0,
        subscriptionEnd: data?.subscription_end ?? null,
      });
    } catch (error) {
      console.error("Failed to check subscription:", error);
      // Fail gracefully - default to starter tier
      setSubscription({
        subscribed: false,
        tier: "starter",
        seatsLimit: 1,
        seatsUsed: 0,
        subscriptionEnd: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    checkSubscription();

    // Refresh subscription status every minute
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

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
        const errorMessage = error instanceof Error ? error.message : "Failed to start checkout process";
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
        const errorMessage = error instanceof Error ? error.message : "Failed to open billing portal";
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
