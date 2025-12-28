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
        return;
      }

      setSubscription({
        subscribed: data.subscribed,
        tier: data.tier as SubscriptionTier,
        productId: data.product_id,
        seatsLimit: data.seats_limit,
        seatsUsed: data.seats_used,
        subscriptionEnd: data.subscription_end,
      });
    } catch (error) {
      console.error("Failed to check subscription:", error);
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

        if (error) throw error;

        if (data?.url) {
          window.open(data.url, "_blank");
          return data.url;
        }
      } catch (error) {
        console.error("Error creating checkout:", error);
        toast.error("Failed to start checkout process");
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

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        return data.url;
      }
    } catch (error) {
      console.error("Error opening customer portal:", error);
      toast.error("Failed to open billing portal");
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
