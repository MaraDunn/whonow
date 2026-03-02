import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeRedirectOrigin } from "../_shared/appUrl.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/security.ts";
import { getTierPriceId, isPerSeatTier } from "../_shared/stripeConfig.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = { ...getCorsHeaders(origin), "Access-Control-Expose-Headers": "sb-request-id" };
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  // Not blocked by waitlist mode so users with access can start checkout
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
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    // Log only user ID, not email (PII)
    logStep("User authenticated", { userId: user.id });

    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error("Invalid request body");
    }
    
    const { tier, seats } = body;
    const priceId = tier ? getTierPriceId(String(tier)) : undefined;
    if (!tier || !priceId) {
      throw new Error("Invalid tier");
    }

    // For per-seat tiers, quantity is the number of seats (min 1). For flat tiers, always 1.
    const quantity = isPerSeatTier(String(tier))
      ? Math.max(1, Math.floor(Number(seats) || 1))
      : 1;
    logStep("Tier selected", { tier, priceId, quantity });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    let hasUsedTrial = false;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });

      // Check if this customer has ever had a subscription (trial or paid) to avoid giving
      // a second free trial to returning customers.
      const allSubs = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
        status: "all",
      });
      hasUsedTrial = allSubs.data.length > 0;
      logStep("Trial eligibility check", { hasUsedTrial, subCount: allSubs.data.length });
    }

    // Redirect to canonical app (whonow.co) so Stripe always sends users to the deployed app
    const redirectOrigin = getStripeRedirectOrigin(req);
    logStep("Redirect origin", { redirectOrigin });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      mode: "subscription",
      // Grant a 14-day free trial to first-time subscribers only
      ...(!hasUsedTrial && { subscription_data: { trial_period_days: 14 } }),
      success_url: `${redirectOrigin}/app?subscription=success`,
      cancel_url: `${redirectOrigin}/?subscription=cancelled`,
      metadata: {
        user_id: user.id,
        tier: tier,
        seats: String(quantity),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: "Checkout failed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
