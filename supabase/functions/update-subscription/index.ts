import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/security.ts";
import { getTierPriceId, isPerSeatTier, priceToTier, SEAT_LIMITS } from "../_shared/stripeConfig.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UPDATE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = { ...getCorsHeaders(origin), "Access-Control-Expose-Headers": "sb-request-id" };
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    let body: { tier?: unknown; seats?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new Error("Invalid request body");
    }

    const { tier, seats } = body;
    const newPriceId = tier ? getTierPriceId(String(tier)) : undefined;
    if (!tier || !newPriceId) throw new Error("Invalid tier");

    const quantity = isPerSeatTier(String(tier))
      ? Math.max(1, Math.floor(Number(seats) || 1))
      : 1;
    logStep("Target tier", { tier, newPriceId, quantity });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find the customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found. Please subscribe first.");
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Find their active or trialing subscription
    let subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    if (subscriptions.data.length === 0) {
      // Also check for subscriptions currently in a free trial
      subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
    }
    if (subscriptions.data.length === 0) {
      throw new Error("No active subscription found. Please subscribe first.");
    }
    const subscription = subscriptions.data[0];
    const subscriptionItemId = subscription.items.data[0]?.id;
    if (!subscriptionItemId) throw new Error("Could not find subscription item");
    logStep("Found active subscription", { subscriptionId: subscription.id, subscriptionItemId });

    // Update the subscription: swap price and quantity in place.
    // proration_behavior: 'always_invoice' immediately charges/credits the difference.
    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
          quantity,
        },
      ],
      proration_behavior: "always_invoice",
      metadata: {
        tier: String(tier),
        seats: String(quantity),
      },
    });
    logStep("Subscription updated in Stripe", { subscriptionId: updated.id, status: updated.status });

    // Sync the change to the DB immediately (webhook will also fire, but this ensures consistency)
    const newTier = priceToTier(newPriceId);
    const seatsLimit = isPerSeatTier(newTier) ? quantity : (SEAT_LIMITS[newTier] ?? 1);
    const periodStart = updated.current_period_start
      ? new Date(updated.current_period_start * 1000).toISOString()
      : null;
    const periodEnd = updated.current_period_end
      ? new Date(updated.current_period_end * 1000).toISOString()
      : null;

    const { error: upsertError } = await supabaseClient
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        tier: newTier,
        stripe_customer_id: customerId,
        stripe_subscription_id: updated.id,
        status: "active",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        employee_seats_limit: seatsLimit,
      }, { onConflict: "user_id" });

    if (upsertError) {
      logStep("DB upsert error (non-fatal, webhook will retry)", { error: upsertError.message });
    } else {
      logStep("Subscription synced to DB", { newTier, seatsLimit });
    }

    return new Response(
      JSON.stringify({ success: true, tier: newTier, seats_limit: seatsLimit }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in update-subscription", { message: errorMessage });
    const safeMessage = errorMessage.includes("STRIPE_SECRET_KEY")
      ? "Subscription is not configured. Please add Stripe keys in Supabase project settings."
      : errorMessage;
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
