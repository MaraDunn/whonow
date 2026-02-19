/**
 * Shared Stripe configuration for Edge Functions.
 * Production should set STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_TEAM, STRIPE_PRICE_ID_BUSINESS
 * (and Stripe keys) via Supabase Edge Function secrets; do not rely on defaults.
 */

export const DEFAULT_PRICE_TO_TIER: Record<string, string> = {
  "price_1RifXqDXpGeDw1xnkNvKgEzI": "pro",
  "price_1RifYIDXpGeDw1xn1rBKxeH7": "team",
  "price_1RifYIDXpGeDw1xni9LJxRLQ": "business",
};

export const SEAT_LIMITS: Record<string, number> = {
  starter: 1,
  pro: 1,
  team: 25,
  business: 100,
};

/** Map Stripe price ID to tier; reads env first, then DEFAULT_PRICE_TO_TIER. */
export function priceToTier(priceId: string | undefined): string {
  if (!priceId) return "pro";
  const envMap: Record<string, string | undefined> = {
    [Deno.env.get("STRIPE_PRICE_ID_PRO") || ""]: "pro",
    [Deno.env.get("STRIPE_PRICE_ID_TEAM") || ""]: "team",
    [Deno.env.get("STRIPE_PRICE_ID_BUSINESS") || ""]: "business",
  };
  return envMap[priceId] || DEFAULT_PRICE_TO_TIER[priceId] || "pro";
}

const DEFAULT_TIER_PRICES: Record<string, string> = {
  pro: "price_1RifXqDXpGeDw1xnkNvKgEzI",
  team: "price_1RifYIDXpGeDw1xn1rBKxeH7",
  business: "price_1RifYIDXpGeDw1xni9LJxRLQ",
};

/** Map tier to Stripe price ID for checkout; reads env first. */
export function getTierPriceId(tier: string): string | undefined {
  const envMap: Record<string, string | undefined> = {
    pro: Deno.env.get("STRIPE_PRICE_ID_PRO") || undefined,
    team: Deno.env.get("STRIPE_PRICE_ID_TEAM") || undefined,
    business: Deno.env.get("STRIPE_PRICE_ID_BUSINESS") || undefined,
  };
  return envMap[tier] || DEFAULT_TIER_PRICES[tier];
}
