/**
 * Shared Stripe configuration for Edge Functions.
 * Production should set STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_BUSINESS, STRIPE_PRICE_ID_ENTERPRISE
 * (and Stripe keys) via Supabase Edge Function secrets; do not rely on defaults.
 *
 * Per-seat tiers (business, enterprise): seat count comes from the Stripe subscription
 * quantity, NOT from a hardcoded limit. SEAT_LIMITS returns null for these tiers.
 */

export const DEFAULT_PRICE_TO_TIER: Record<string, string> = {
  // Legacy prices (kept so grandfathered customers' webhooks still map correctly)
  "price_1RifXqDXpGeDw1xnkNvKgEzI": "pro",        // old Pro price
  "price_1RifYIDXpGeDw1xn1rBKxeH7": "business",   // old "team" → now business
  "price_1RifYIDXpGeDw1xni9LJxRLQ": "enterprise",  // old "business" → now enterprise
  // New prices
  "price_1T6H9xFJbimPmnyOEpvjJlzG": "pro",
  "price_1T6HNFFJbimPmnyOYBYyiChf": "business",
  "price_1T6HKWFJbimPmnyOW4wlqE8z": "enterprise",
};

/**
 * Returns null for per-seat tiers — seat count must be read from Stripe subscription quantity.
 */
export const SEAT_LIMITS: Record<string, number | null> = {
  starter: 1,
  pro: 1,
  business: null,
  enterprise: null,
  // Legacy names mapped for safety
  team: null,
};

/** Map Stripe price ID to tier; reads env first, then DEFAULT_PRICE_TO_TIER. */
export function priceToTier(priceId: string | undefined): string {
  if (!priceId) return "pro";
  const envMap: Record<string, string | undefined> = {
    [Deno.env.get("STRIPE_PRICE_ID_PRO") || ""]: "pro",
    [Deno.env.get("STRIPE_PRICE_ID_BUSINESS") || ""]: "business",
    [Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE") || ""]: "enterprise",
  };
  return envMap[priceId] || DEFAULT_PRICE_TO_TIER[priceId] || "pro";
}

const DEFAULT_TIER_PRICES: Record<string, string> = {
  pro: "price_1T6H9xFJbimPmnyOEpvjJlzG",
  business: "price_1T6HNFFJbimPmnyOYBYyiChf",
  enterprise: "price_1T6HKWFJbimPmnyOW4wlqE8z",
};

/** Map tier to Stripe price ID for checkout; reads env first. */
export function getTierPriceId(tier: string): string | undefined {
  const envMap: Record<string, string | undefined> = {
    pro: Deno.env.get("STRIPE_PRICE_ID_PRO") || undefined,
    business: Deno.env.get("STRIPE_PRICE_ID_BUSINESS") || undefined,
    enterprise: Deno.env.get("STRIPE_PRICE_ID_ENTERPRISE") || undefined,
  };
  return envMap[tier] || DEFAULT_TIER_PRICES[tier];
}

/** Returns true for tiers where seat count is driven by Stripe subscription quantity. */
export function isPerSeatTier(tier: string): boolean {
  return tier === "business" || tier === "enterprise";
}
