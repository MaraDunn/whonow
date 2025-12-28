export type SubscriptionTier = 
  | "starter" 
  | "pro" 
  | "team" 
  | "business" 
  | "enterprise" 
  | "global_enterprise";

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
      "Up to 50 contacts",
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
      "Unlimited contacts",
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
      "Up to 25 team members",
      "Shared contact folders",
      "Team dashboard",
      "Role-based permissions",
      "Slack & Teams integration",
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
      "Up to 100 team members",
      "Advanced analytics",
      "Custom branding",
      "API access",
      "Dedicated support",
    ],
  },
  enterprise: {
    name: "Enterprise",
    priceId: "price_1RifYJDXpGeDw1xnvpXcKYOh",
    productId: "prod_SnOPO17iQDH4V2",
    price: 399.99,
    period: "month",
    seats: 500,
    features: [
      "Everything in Business",
      "Up to 500 team members",
      "SSO/SAML integration",
      "Custom integrations",
      "SLA guarantee",
      "24/7 phone support",
    ],
  },
  global_enterprise: {
    name: "Global Enterprise",
    priceId: "price_1RifYJDXpGeDw1xnnCqy2Zfl",
    productId: "prod_SnOQ6YGj0xwIZT",
    price: 899.99,
    period: "month",
    seats: 1500,
    features: [
      "Everything in Enterprise",
      "Up to 1,500 team members",
      "Multi-region deployment",
      "Custom SLA",
      "Dedicated success manager",
      "On-site training",
    ],
  },
};

export type FeatureName = 
  | "basic_contacts"
  | "unlimited_contacts"
  | "client_management"
  | "advanced_search"
  | "team_features"
  | "advanced_analytics"
  | "api_access"
  | "sso"
  | "custom_integrations";

export const FEATURE_ACCESS: Record<FeatureName, SubscriptionTier[]> = {
  basic_contacts: ["starter", "pro", "team", "business", "enterprise", "global_enterprise"],
  unlimited_contacts: ["pro", "team", "business", "enterprise", "global_enterprise"],
  client_management: ["pro", "team", "business", "enterprise", "global_enterprise"],
  advanced_search: ["pro", "team", "business", "enterprise", "global_enterprise"],
  team_features: ["team", "business", "enterprise", "global_enterprise"],
  advanced_analytics: ["business", "enterprise", "global_enterprise"],
  api_access: ["business", "enterprise", "global_enterprise"],
  sso: ["enterprise", "global_enterprise"],
  custom_integrations: ["enterprise", "global_enterprise"],
};
