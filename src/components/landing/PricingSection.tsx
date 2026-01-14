import { Check, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { TIER_CONFIGS, SubscriptionTier } from "@/types/subscription";
import { cn } from "@/lib/utils";

interface PricingSectionProps {
  onGetStarted: () => void;
}

export const PricingSection = ({ onGetStarted }: PricingSectionProps) => {
  const { user } = useAuth();
  const { tier: currentTier, createCheckout, isLoading } = useSubscription();

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (tier === "starter") {
      onGetStarted();
      return;
    }

    if (!user) {
      onGetStarted();
      return;
    }

    await createCheckout(tier);
  };

  const tiers: SubscriptionTier[] = ["starter", "pro", "team", "business"];

  return (
    <section id="pricing" className="py-24 sm:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            <Star className="w-3 h-3 mr-1" />
            Pricing
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Choose the plan that's right for you
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and scale as you grow. All plans include a 14-day money-back guarantee.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {tiers.map((tierKey) => {
            const config = TIER_CONFIGS[tierKey];
            const isCurrentPlan = user && currentTier === tierKey;
            const isHighlighted = config.highlighted;

            return (
              <Card
                key={tierKey}
                className={cn(
                  "relative flex flex-col transition-all duration-300 hover:shadow-card-hover",
                  isHighlighted && "border-primary shadow-lg scale-[1.02] lg:scale-105",
                  isCurrentPlan && "ring-2 ring-primary"
                )}
              >
                {config.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gradient-hero text-primary-foreground px-3 py-1">
                      <Zap className="w-3 h-3 mr-1" />
                      {config.badge}
                    </Badge>
                  </div>
                )}
                
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                      Your Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{config.name}</CardTitle>
                  <CardDescription className="h-8">
                    {tierKey === "starter" && "Get started for free"}
                    {tierKey === "pro" && "For individuals"}
                    {tierKey === "team" && "For small teams"}
                    {tierKey === "business" && "For growing companies"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="mb-6">
                    <span className="text-3xl font-bold">
                      {config.price === 0 ? "Free" : `$${config.price}`}
                    </span>
                    {config.price > 0 && (
                      <span className="text-muted-foreground text-sm">/{config.period}</span>
                    )}
                  </div>

                  {config.seats > 1 && (
                    <div className="mb-4 p-2 bg-accent/50 rounded-md text-center">
                      <span className="text-sm font-medium text-accent-foreground">
                        Up to {config.seats.toLocaleString()} seats
                      </span>
                    </div>
                  )}

                  <ul className="space-y-2">
                    {config.features.slice(0, 4).map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button
                    onClick={() => handleSelectPlan(tierKey)}
                    disabled={isLoading || isCurrentPlan}
                    className={cn(
                      "w-full",
                      isHighlighted && "gradient-hero text-primary-foreground"
                    )}
                    variant={isHighlighted ? "default" : "outline"}
                  >
                    {isCurrentPlan
                      ? "Current Plan"
                      : tierKey === "starter"
                      ? "Start Free"
                      : `Upgrade to ${config.name}`}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}

          {/* Contact Sales (replaces Enterprise + Global Enterprise self-serve tiers) */}
          <Card className="relative flex flex-col transition-all duration-300 hover:shadow-card-hover border-dashed">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Enterprise</CardTitle>
              <CardDescription className="h-8">
                For larger organizations
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="mb-6">
                <span className="text-3xl font-bold">Custom</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Need more seats, custom features, or better pricing? Let's work together to create a solution that fits your organization.
              </p>

              <ul className="space-y-2">
                {[
                  "Everything in Business",
                  "Custom seat limits",
                  "Tailored feature set",
                  "Volume pricing available",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter className="pt-4">
              <Button
                asChild
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                <a href="mailto:sales@whonow.com?subject=WhoNow%20Enterprise%20Inquiry">
                  Contact Sales
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All prices in USD. Cancel anytime. Need custom pricing?{" "}
          <a href="mailto:sales@whonow.com" className="text-primary hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </section>
  );
};
