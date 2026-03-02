export type SubscriptionTier =
  | "starter"
  | "pro"
  | "business"
  | "enterprise";

export interface SubscriptionData {
  subscribed: boolean;
  tier: SubscriptionTier;
  productId?: string;
  seatsLimit: number;
  seatsUsed: number;
  subscriptionEnd: string | null;
}

export interface TierConfig {
  name: string;
  priceId: string;
  productId: string;
  price: number;
  pricePerSeat?: number;
  period: string;
  seats: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  starter: {
    name: "Starter",
    priceId: "",
    productId: "",
    price: 0,
    period: "forever",
    seats: 1,
    features: [
      "Clean, organized contact management",
      "Import from CSV, vCard, and Google",
      "Export your data anytime",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    priceId: "price_1T6H9xFJbimPmnyOEpvjJlzG",
    productId: "",
    price: 4.99,
    period: "month",
    seats: 1,
    features: [
      "Relationship Insights Dashboard — health scores, stale alerts & engagement trends",
      "Smart Follow-Up Queue — know exactly who needs a touchpoint",
      "Advanced Natural Language Search — ask anything about your network",
      "Growth & engagement insights — understand relationship momentum",
      "Full import & export control",
      "Priority email support",
    ],
    highlighted: true,
    badge: "Most Popular",
  },
  business: {
    name: "Team",
    priceId: "price_1T6HNFFJbimPmnyOYBYyiChf",
    productId: "",
    price: 9.99,
    pricePerSeat: 2,
    period: "month",
    seats: 1,
    features: [
      "Everything in Pro",
      "Shared contact visibility across your organization",
      "Searchable team directory with live profiles",
      "Slack & Microsoft Teams integrations",
      "$2 per additional seat",
    ],
  },
  enterprise: {
    name: "Enterprise",
    priceId: "price_1T6HKWFJbimPmnyOW4wlqE8z",
    productId: "",
    price: 19.99,
    pricePerSeat: 1,
    period: "month",
    seats: 1,
    features: [
      "Everything in Business",
      "Custom branding — logo, colors, and favicon",
      "Dedicated support",
      "$1 per additional seat",
    ],
  },
};

export type FeatureName = 
  | "basic_contacts"
  | "client_management"
  | "advanced_search"
  | "organization_creation"
  | "team_features"
  | "integrations"
  | "advanced_analytics"
  | "api_access"
  | "custom_branding"
  | "sso"
  | "custom_integrations";

export const FEATURE_ACCESS: Record<FeatureName, SubscriptionTier[]> = {
  basic_contacts: ["starter", "pro", "business", "enterprise"],
  client_management: ["pro", "business", "enterprise"],
  advanced_search: ["pro", "business", "enterprise"],
  organization_creation: ["business", "enterprise"],
  team_features: ["business", "enterprise"],
  integrations: ["business", "enterprise"],
  advanced_analytics: ["enterprise"],
  api_access: ["enterprise"],
  custom_branding: ["enterprise"],
  // No self-serve tiers: direct large orgs to sales instead.
  sso: [],
  custom_integrations: [],
};
