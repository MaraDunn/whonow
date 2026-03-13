import { useState } from "react";
import { Check, Star, Zap, Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { TIER_CONFIGS, SubscriptionTier } from "@/types/subscription";
import { cn } from "@/lib/utils";
import { ContactSalesDialog } from "@/components/ContactSalesDialog";

interface PricingSectionProps {
  onGetStarted: () => void;
}

const PER_SEAT_TIERS: SubscriptionTier[] = ["business", "enterprise"];

function SeatSelector({
  seats,
  onSeatsChange,
}: {
  seats: number;
  onSeatsChange: (seats: number) => void;
}) {
  const [inputValue, setInputValue] = useState(String(seats));

  const commit = (raw: string) => {
    const parsed = parseInt(raw, 10);
    const clamped = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    setInputValue(String(clamped));
    onSeatsChange(clamped);
  };

  // Keep input in sync when parent changes value via +/- buttons
  const handleDecrement = () => {
    const next = Math.max(1, seats - 1);
    setInputValue(String(next));
    onSeatsChange(next);
  };

  const handleIncrement = () => {
    const next = seats + 1;
    setInputValue(String(next));
    onSeatsChange(next);
  };

  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleDecrement}
          aria-label="Decrease seats"
        >
          <Minus className="w-3 h-3" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleIncrement}
          aria-label="Increase seats"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={1}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          }}
          className="h-7 w-16 text-center text-sm px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          aria-label="Number of seats"
        />
        <span className="text-xs text-muted-foreground">
          {seats === 1 ? "seat" : "seats"}
        </span>
      </div>
    </div>
  );
}

function computePrice(tier: SubscriptionTier, seats: number): number {
  const config = TIER_CONFIGS[tier];
  if (!config.pricePerSeat) return config.price;
  return config.price + Math.max(0, seats - 1) * config.pricePerSeat;
}

export const PricingSection = ({ onGetStarted }: PricingSectionProps) => {
  const { user } = useAuth();
  const { tier: currentTier, createCheckout, isLoading } = useSubscription();
  const [contactSalesOpen, setContactSalesOpen] = useState(false);
  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({
    business: 1,
    enterprise: 1,
  });

  const handleSeatChange = (tier: SubscriptionTier, seats: number) => {
    setSeatCounts((prev) => ({ ...prev, [tier]: seats }));
  };

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (tier === "starter") {
      onGetStarted();
      return;
    }

    if (!user) {
      onGetStarted();
      return;
    }

    const seats = PER_SEAT_TIERS.includes(tier) ? (seatCounts[tier] ?? 1) : 1;
    await createCheckout(tier, seats);
  };

  const tiers: SubscriptionTier[] = ["starter", "pro", "business", "enterprise"];

  const tierDescriptions: Record<SubscriptionTier, string> = {
    starter: "Get organized.",
    pro: "See and strengthen your relationships.",
    business: "Make your team's network searchable.",
    enterprise: "Scale with control and branding.",
  };

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
            Start free and add more as your network grows. All paid plans include a 14-day free trial — you won’t be charged until the trial ends. Cancel anytime during the trial to avoid being charged.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {tiers.map((tierKey) => {
            const config = TIER_CONFIGS[tierKey];
            const isCurrentPlan = user && currentTier === tierKey;
            const isHighlighted = config.highlighted;
            const isPerSeat = PER_SEAT_TIERS.includes(tierKey);
            const seats = seatCounts[tierKey] ?? 1;
            const displayPrice = isPerSeat ? computePrice(tierKey, seats) : config.price;

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
                    {tierDescriptions[tierKey]}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="mb-2">
                    <span className="text-3xl font-bold">
                      {config.price === 0 ? "Free" : `$${displayPrice.toFixed(2)}`}
                    </span>
                    {config.price > 0 && (
                      <span className="text-muted-foreground text-sm">/{config.period}</span>
                    )}
                  </div>

                  {isPerSeat && (
                    <p className="text-xs text-muted-foreground mb-3">
                      ${config.price.toFixed(2)} base + ${config.pricePerSeat}/additional seat
                    </p>
                  )}

                  {isPerSeat && (
                    <div className="mb-4 p-2 bg-accent/50 rounded-md">
                      <SeatSelector
                        seats={seats}
                        onSeatsChange={(s) => handleSeatChange(tierKey, s)}
                      />
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
                    disabled={isLoading || !!isCurrentPlan}
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
                      : user
                      ? `Upgrade to ${config.name}`
                      : `Try ${config.name} Free`}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}

          {/* Contact Sales card for larger organizations */}
          <Card className="relative flex flex-col transition-all duration-300 hover:shadow-card-hover border-dashed">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Custom</CardTitle>
              <CardDescription className="h-8">
                Strengthen client relationships proactively
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="mb-6">
                <span className="text-3xl font-bold">Custom</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Need volume pricing, a tailored feature set, or a dedicated implementation? Let's build something that fits your organization.
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

            <CardFooter className="pt-4">
              <Button
                variant="outline"
                className="w-full"
                disabled={isLoading}
                onClick={() => setContactSalesOpen(true)}
              >
                Contact Sales
              </Button>
            </CardFooter>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All prices in USD + applicable taxes. 14-day free trial for new subscribers. Cancel anytime. Need custom pricing?{" "}
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
