import { useState } from "react";
import { Check, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TIER_CONFIGS, SubscriptionTier } from "@/types/subscription";
import { ContactSalesDialog } from "@/components/ContactSalesDialog";

export const WaitlistPricingSection = () => {
  const tiers: SubscriptionTier[] = ["starter", "pro", "business", "enterprise"];
  const [contactSalesOpen, setContactSalesOpen] = useState(false);

  return (
    <section id="pricing" className="py-24 sm:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            <Star className="w-3 h-3 mr-1" />
            Pricing
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Built for individuals. Scales with your team.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and add more as your network grows. All paid plans include a 14-day free trial — no credit card charged until the trial ends.
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
                    {tierKey === "starter" && "Get organized."}
                    {tierKey === "pro" && "See and strengthen your relationships."}
                    {tierKey === "business" && "Make your team's network searchable."}
                    {tierKey === "enterprise" && "Scale with control and branding."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="mb-2">
                    <span className="text-3xl font-bold">
                      {config.price === 0 ? "Free" : `$${config.price}`}
                    </span>
                    {config.price > 0 && (
                      <span className="text-muted-foreground text-sm">/{config.period}</span>
                    )}
                  </div>

                  {config.pricePerSeat && (
                    <p className="text-xs text-muted-foreground mb-4">
                      ${config.price.toFixed(2)} base + ${config.pricePerSeat}/additional seat
                    </p>
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
                  "Everything in Enterprise",
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
          <button
            type="button"
            onClick={() => setContactSalesOpen(true)}
            className="text-primary hover:underline"
          >
            Contact us
          </button>
        </p>
      </div>
      <ContactSalesDialog open={contactSalesOpen} onOpenChange={setContactSalesOpen} />
    </section>
  );
};
