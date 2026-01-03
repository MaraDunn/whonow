import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Stripe IDs differ between test and live mode.
// Prefer mapping by PRICE ID (stable per environment and easy to configure via secrets).
const DEFAULT_PRICE_TO_TIER: Record<string, string> = {
  // Backwards-compatible defaults (override via secrets for test mode)
  "price_1RifXqDXpGeDw1xnkNvKgEzI": "pro",
  "price_1RifYIDXpGeDw1xn1rBKxeH7": "team",
  "price_1RifYIDXpGeDw1xni9LJxRLQ": "business",
};

function priceToTier(priceId: string | undefined): string {
  if (!priceId) return "pro";
  const envMap: Record<string, string | undefined> = {
    [Deno.env.get("STRIPE_PRICE_ID_PRO") || ""]: "pro",
    [Deno.env.get("STRIPE_PRICE_ID_TEAM") || ""]: "team",
    [Deno.env.get("STRIPE_PRICE_ID_BUSINESS") || ""]: "business",
  };
  return envMap[priceId] || DEFAULT_PRICE_TO_TIER[priceId] || "pro";
}

const SEAT_LIMITS: Record<string, number> = {
  starter: 1,
  pro: 1,
  team: 25,
  business: 100,
};

// Secure logging - no PII
const logStep = (step: string, details?: Record<string, string | number | boolean | undefined>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
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

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription found");
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

    const subscription = subscriptions.data[0];
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    logStep("Active subscription found", { subscriptionId: subscription.id });

    const priceId = subscription.items.data[0].price.id as string | undefined;
    const tier = priceToTier(priceId);
    const seatsLimit = SEAT_LIMITS[tier] || 1;
    logStep("Determined subscription tier", { tier, seatsLimit });

    // Sync to database
    const { error: upsertError } = await supabaseClient
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        tier: tier,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        status: "active",
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
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
      // Return the Stripe price id for debugging/telemetry
      product_id: priceId,
      seats_limit: seatsLimit,
      seats_used: 0, // Will be fetched from database
      subscription_end: subscriptionEnd
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
