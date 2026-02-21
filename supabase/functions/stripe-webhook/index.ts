import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { priceToTier, SEAT_LIMITS } from "../_shared/stripeConfig.ts";

// No CORS headers needed - webhooks come from Stripe servers, not browsers
// Stripe webhook is never blocked by waitlist mode so subscription updates apply for users with access.

const logStep = (step: string, details?: Record<string, unknown>) => {
  // Only log non-sensitive data
  const safeDetails = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${safeDetails}`);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
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
      return new Response("Webhook verification failed", { status: 400 });
    }

    logStep("Webhook received", { type: event.type, eventId: event.id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Helper: upsert subscription row (shared by checkout.session.completed and subscription events)
    const upsertSubscription = async (params: {
      userId: string;
      subscription: Stripe.Subscription;
      stripe: Stripe;
    }) => {
      let { subscription } = params;
      const { userId, stripe } = params;
      // Event payload sometimes omits period dates; fetch full subscription when needed
      if (!subscription.current_period_end || !subscription.current_period_start) {
        logStep("Subscription missing date fields, fetching from Stripe", { subscriptionId: subscription.id });
        const retrieved = await stripe.subscriptions.retrieve(subscription.id);
        if (retrieved.current_period_end && retrieved.current_period_start) {
          subscription = retrieved;
        } else {
          logStep("Subscription still missing date fields after retrieve; syncing tier with null period", {
            subscriptionId: subscription.id,
          });
        }
      }
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price?.id as string | undefined;
      const tier = priceToTier(priceId);
      const seatsLimit = SEAT_LIMITS[tier] || 1;
      // Treat trialing as active so get_user_subscription_tier returns the tier (it filters on status = 'active')
      const status = (subscription.status === "active" || subscription.status === "trialing") ? "active" : subscription.status;
      const periodStart = subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null;
      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
      const { error: upsertError } = await supabase
        .from("subscriptions")
        .upsert({
          user_id: userId,
          tier: tier,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: status,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          employee_seats_limit: seatsLimit,
        }, { onConflict: "user_id" });
      if (upsertError) {
        logStep("Error upserting subscription", { error: upsertError.message });
      } else {
        logStep("Subscription synced", { tier, status, userId });
      }
    };

    // Handle subscription events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) {
          logStep("Checkout session not subscription or no subscription id", { mode: session.mode });
          break;
        }
        const userId = session.metadata?.user_id;
        if (!userId) {
          logStep("No user_id in checkout session metadata, skipping");
          break;
        }
        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription({ userId, subscription, stripe });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Prefer user_id from existing row (by stripe_customer_id or stripe_subscription_id)
        const { data: existing } = await supabase
          .from("subscriptions")
          .select("user_id")
          .or(`stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${subscription.id}`)
          .limit(1)
          .maybeSingle();
        let userId: string | null = existing?.user_id ?? null;

        if (!userId) {
          // Find user by customer email (listUsers is paginated; only first page was used before)
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
          let page = 1;
          const perPage = 100;
          while (true) {
            const { data: listData, error: userError } = await supabase.auth.admin.listUsers({
              page,
              perPage,
            });
            if (userError) {
              logStep("Error listing users", { error: userError.message });
              break;
            }
            const user = listData.users.find((u) => u.email === customerEmail);
            if (user) {
              userId = user.id;
              break;
            }
            if (!listData.users.length || listData.users.length < perPage) break;
            page += 1;
            if (page > 100) {
              logStep("Gave up finding user by email after 100 pages");
              break;
            }
          }
        }

        if (!userId) {
          logStep("No user found for subscription", { subscriptionId: subscription.id });
          break;
        }

        await upsertSubscription({ userId, subscription, stripe });
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
