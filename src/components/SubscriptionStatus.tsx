import { useSubscription } from "@/hooks/useSubscription";
import { TIER_CONFIGS } from "@/types/subscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Crown, Settings, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SubscriptionStatusProps {
  variant?: "badge" | "full";
}

export const SubscriptionStatus = ({ variant = "badge" }: SubscriptionStatusProps) => {
  const { tier, subscribed, subscriptionEnd, openCustomerPortal, isLoading, seatsUsed, seatsLimit } = useSubscription();
  
  const config = TIER_CONFIGS[tier];

  if (isLoading) {
    return (
      <Badge variant="outline" className="animate-pulse">
        Loading...
      </Badge>
    );
  }

  if (variant === "badge") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Crown className="w-4 h-4 text-primary" />
            <span className="font-medium">{config.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">Current Plan: {config.name}</p>
            {subscribed && subscriptionEnd && (
              <p className="text-xs text-muted-foreground">
                Renews {new Date(subscriptionEnd).toLocaleDateString()}
              </p>
            )}
            {seatsLimit > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                {seatsUsed}/{seatsLimit} seats used
              </p>
            )}
          </div>
          {subscribed && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openCustomerPortal}>
                <Settings className="mr-2 h-4 w-4" />
                Manage Subscription
                <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          <span className="font-semibold">{config.name} Plan</span>
        </div>
        {subscribed && (
          <Badge variant="outline" className="text-primary border-primary/30">
            Active
          </Badge>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        {config.price === 0 ? (
          <p>You're on the free plan.</p>
        ) : (
          <>
            <p>${config.price}/{config.period}</p>
            {subscriptionEnd && (
              <p className="text-xs mt-1">
                Renews on {new Date(subscriptionEnd).toLocaleDateString()}
              </p>
            )}
          </>
        )}
      </div>

      {seatsLimit > 1 && (
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Team seats</span>
            <span className="font-medium">{seatsUsed} / {seatsLimit}</span>
          </div>
          <div className="mt-1.5 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(seatsUsed / seatsLimit) * 100}%` }}
            />
          </div>
        </div>
      )}

      {subscribed && (
        <Button
          variant="outline"
          size="sm"
          onClick={openCustomerPortal}
          className="w-full"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Manage Billing
        </Button>
      )}
    </div>
  );
};
