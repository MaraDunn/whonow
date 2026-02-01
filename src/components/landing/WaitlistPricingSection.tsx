import { Check, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TIER_CONFIGS, SubscriptionTier } from "@/types/subscription";

export const WaitlistPricingSection = () => {
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

            return (
              <Card
                key={tierKey}
                className="relative flex flex-col transition-all duration-300 hover:shadow-card-hover"
              >

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
              </Card>
            );
          })}

          {/* Enterprise (read-only) */}
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
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All prices in USD. Cancel anytime. Need custom pricing?{" "}
          <a href="mailto:sales@whonow.co" className="text-primary hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </section>
  );
};
