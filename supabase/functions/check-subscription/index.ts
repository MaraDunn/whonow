import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/security.ts";
import { priceToTier, SEAT_LIMITS, isPerSeatTier } from "../_shared/stripeConfig.ts";

// Secure logging - no PII
const logStep = (step: string, details?: Record<string, string | number | boolean | undefined>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  // Not blocked by waitlist mode so users with access can refresh subscription after checkout
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error("Authentication failed");
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    // Log only user ID, not email (PII)
    logStep("User authenticated", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning starter tier");
      return new Response(JSON.stringify({ 
        subscribed: false, 
        tier: "starter",
        seats_limit: 1,
        seats_used: 0,
        subscription_end: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Include trialing so new subscriptions (14-day trial) are recognized immediately after checkout
    let subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    if (subscriptions.data.length === 0) {
      subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
    }

    if (subscriptions.data.length === 0) {
      logStep("No active or trialing subscription found");
      return new Response(JSON.stringify({ 
        subscribed: false, 
        tier: "starter",
        seats_limit: 1,
        seats_used: 0,
        subscription_end: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let subscription = subscriptions.data[0];
    if (!subscription.current_period_end || !subscription.current_period_start) {
      logStep("Subscription missing date fields, fetching full object from Stripe", { subscriptionId: subscription.id });
      const retrieved = await stripe.subscriptions.retrieve(subscription.id);
      if (retrieved.current_period_end && retrieved.current_period_start) {
        subscription = retrieved;
      } else {
        // Dates still missing — proceed with null dates so the tier still gets synced
        logStep("Subscription dates unavailable after retrieve; proceeding with null dates", { subscriptionId: subscription.id });
      }
    }

    const subscriptionEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    const subscriptionStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null;
    logStep("Active subscription found", { subscriptionId: subscription.id });

    const priceId = subscription.items.data[0]?.price?.id as string | undefined;
    const tier = priceToTier(priceId);
    // For per-seat tiers, read quantity from the Stripe subscription item.
    // For flat tiers, fall back to the hardcoded SEAT_LIMITS.
    const stripeQuantity = subscription.items.data[0]?.quantity ?? 1;
    const seatsLimit = isPerSeatTier(tier)
      ? Math.max(1, stripeQuantity)
      : (SEAT_LIMITS[tier] ?? 1);
    logStep("Determined subscription tier", { 
      tier, 
      seatsLimit, 
      priceId: priceId || 'undefined',
      subscriptionStatus: subscription.status 
    });

    // Sync to database
    const { error: upsertError } = await supabaseClient
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        tier: tier,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        status: "active",
        current_period_start: subscriptionStart,
        current_period_end: subscriptionEnd,
        employee_seats_limit: seatsLimit,
        employee_seats_used: 0, // Will be calculated separately
      }, { onConflict: "user_id" });

    if (upsertError) {
      logStep("Error syncing subscription to database", { error: upsertError.message });
    } else {
      logStep("Subscription synced to database");
    }

    return new Response(JSON.stringify({
      subscribed: true,
      tier: tier,
      product_id: priceId,
      seats_limit: seatsLimit,
      seats_used: 0,
      subscription_end: subscriptionEnd ?? null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: "Subscription check failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
