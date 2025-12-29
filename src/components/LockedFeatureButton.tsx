import { ReactNode, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSubscription } from "@/hooks/useSubscription";
import { FeatureName, SubscriptionTier, TIER_CONFIGS } from "@/types/subscription";
import { cn } from "@/lib/utils";

interface LockedFeatureButtonProps {
  feature: FeatureName;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  minimumTier?: SubscriptionTier;
}

export function LockedFeatureButton({
  feature,
  children,
  className,
  onClick,
  minimumTier = "pro",
}: LockedFeatureButtonProps) {
  const { canAccessFeature, createCheckout } = useSubscription();
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasAccess = canAccessFeature(feature);

  const tierConfig = TIER_CONFIGS[minimumTier];

  const handleClick = () => {
    if (hasAccess) {
      onClick?.();
    } else {
      setDialogOpen(true);
    }
  };

  return (
    <>
      <div className={cn("relative", className)} onClick={handleClick}>
        {children}
        {!hasAccess && (
          <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Upgrade to {tierConfig.name}
            </DialogTitle>
            <DialogDescription>
              This feature requires a {tierConfig.name} subscription or higher.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-bold">${tierConfig.price}</span>
                <span className="text-muted-foreground">/{tierConfig.period}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {tierConfig.features[0]}
              </p>
            </div>

            <Button
              onClick={() => {
                createCheckout(minimumTier);
                setDialogOpen(false);
              }}
              className="w-full gradient-hero text-primary-foreground"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade to {tierConfig.name}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
