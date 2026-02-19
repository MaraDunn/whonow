export type SubscriptionTier =
  | "starter"
  | "pro"
  | "team"
  | "business";

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
      "Basic contact management",
      "Contact import/export",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    priceId: "price_1RifXqDXpGeDw1xnkNvKgEzI",
    productId: "prod_SnOPR3XQ7NILtZ",
    price: 6.99,
    period: "month",
    seats: 1,
    features: [
      "Everything in Starter",
      "Client management",
      "Advanced search & filters",
      "Contact import/export",
      "Priority email support",
    ],
    highlighted: true,
    badge: "Most Popular",
  },
  team: {
    name: "Team",
    priceId: "price_1RifYIDXpGeDw1xn1rBKxeH7",
    productId: "prod_SnOPIZxzHqO5j9",
    price: 49.99,
    period: "month",
    seats: 25,
    features: [
      "Everything in Pro",
      "Create organization",
      "Up to 25 team members",
      "Shared contact folders",
      "Role-based permissions",
      "Slack & Teams (org-level)",
    ],
  },
  business: {
    name: "Business",
    priceId: "price_1RifYIDXpGeDw1xni9LJxRLQ",
    productId: "prod_SnOPIZGzLgqiUM",
    price: 119.99,
    period: "month",
    seats: 100,
    features: [
      "Everything in Team",
      "Create organization",
      "Up to 100 team members",
      "Custom branding",
      "API access",
      "Dedicated support",
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
  basic_contacts: ["starter", "pro", "team", "business"],
  client_management: ["pro", "team", "business"],
  advanced_search: ["pro", "team", "business"],
  organization_creation: ["team", "business"],
  team_features: ["team", "business"],
  integrations: ["team", "business"],
  advanced_analytics: ["business"],
  api_access: ["business"],
  custom_branding: ["business"],
  // No self-serve enterprise tiers: direct large orgs to sales instead.
  sso: [],
  custom_integrations: [],
};
