import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map tier names to Stripe price IDs
// Enterprise tiers are not self-serve: direct customers to sales from the landing page.
const TIER_PRICES: Record<string, string> = {
  pro: "price_1RifXqDXpGeDw1xnkNvKgEzI",
  team: "price_1RifYIDXpGeDw1xn1rBKxeH7",
  business: "price_1RifYIDXpGeDw1xni9LJxRLQ",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
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
    
    const { tier } = body;
    if (!tier || !TIER_PRICES[tier]) {
      throw new Error(`Invalid tier: ${tier}. Valid tiers are: ${Object.keys(TIER_PRICES).join(", ")}`);
    }
    logStep("Tier selected", { tier, priceId: TIER_PRICES[tier] });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Get origin from request or use environment variable, fallback to localhost:8080
    const origin = Deno.env.get("APP_URL") || 
                   req.headers.get("origin") || 
                   "http://localhost:8080";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: TIER_PRICES[tier],
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/app?subscription=success`,
      cancel_url: `${origin}/?subscription=cancelled`,
      metadata: {
        user_id: user.id,
        tier: tier,
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
    
    // Return detailed error for debugging (in production, use generic message)
    const isDevelopment = Deno.env.get("ENVIRONMENT") === "development";
    return new Response(
      JSON.stringify({ 
        error: isDevelopment ? errorMessage : "Failed to create checkout session",
        details: isDevelopment ? { message: errorMessage } : undefined
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
