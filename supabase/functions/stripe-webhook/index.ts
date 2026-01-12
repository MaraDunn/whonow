import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { checkLaunchMode } from "../_shared/security.ts";

// No CORS headers needed - webhooks come from Stripe servers, not browsers

// Stripe IDs differ between test and live mode.
// Prefer mapping by PRICE ID (easy to configure via secrets).
const DEFAULT_PRICE_TO_TIER: Record<string, string> = {
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

const logStep = (step: string, details?: Record<string, unknown>) => {
  // Only log non-sensitive data
  const safeDetails = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${safeDetails}`);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Check launch mode - block in waitlist mode
  const { blocked } = checkLaunchMode();
  if (blocked) {
    return new Response("Service unavailable", { status: 403 });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY not configured");
      return new Response("Server configuration error", { status: 500 });
    }
    
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Server configuration error", { status: 500 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      logStep("ERROR: No stripe-signature header");
      return new Response("No signature provided", { status: 400 });
    }

    // Verify webhook signature - CRITICAL SECURITY CHECK
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logStep("ERROR: Webhook signature verification failed", { error: message });
      return new Response(`Webhook signature verification failed: ${message}`, { status: 400 });
    }

    logStep("Webhook received", { type: event.type, eventId: event.id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Handle subscription events
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get customer email to find user
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) {
          logStep("Customer deleted, skipping");
          break;
        }
        
        const customerEmail = customer.email;
        if (!customerEmail) {
          logStep("No customer email found", { customerId });
          break;
        }

        // Find user by email
        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) {
          logStep("Error listing users", { error: userError.message });
          break;
        }

        const user = users.users.find(u => u.email === customerEmail);
        if (!user) {
          logStep("No user found for email");
          break;
        }

        // Determine tier from price (works across test/live)
        const priceId = subscription.items.data[0]?.price?.id as string | undefined;
        const tier = priceToTier(priceId);
        const seatsLimit = SEAT_LIMITS[tier] || 1;
        const status = subscription.status === "active" ? "active" : subscription.status;

        // Validate subscription has date fields
        if (!subscription.current_period_end || !subscription.current_period_start) {
          logStep("Subscription missing date fields, skipping sync", { 
            subscriptionId: subscription.id,
            hasPeriodEnd: !!subscription.current_period_end,
            hasPeriodStart: !!subscription.current_period_start 
          });
          break;
        }

        // Upsert subscription
        const { error: upsertError } = await supabase
          .from("subscriptions")
          .upsert({
            user_id: user.id,
            tier: tier,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            status: status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            employee_seats_limit: seatsLimit,
          }, { onConflict: "user_id" });

        if (upsertError) {
          logStep("Error upserting subscription", { error: upsertError.message });
        } else {
          logStep("Subscription synced", { tier, status, userId: user.id });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        // Update subscription status to cancelled
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({ 
            status: "cancelled",
            tier: "starter",
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (updateError) {
          logStep("Error cancelling subscription", { error: updateError.message });
        } else {
          logStep("Subscription cancelled");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId);

          if (updateError) {
            logStep("Error updating subscription to past_due", { error: updateError.message });
          } else {
            logStep("Subscription marked as past_due");
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR processing webhook", { error: errorMessage });
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
