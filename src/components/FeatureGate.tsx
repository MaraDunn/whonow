import { ReactNode, useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { FeatureName, TIER_CONFIGS } from "@/types/subscription";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactSalesDialog } from "@/components/ContactSalesDialog";

interface FeatureGateProps {
  feature: FeatureName;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

export const FeatureGate = ({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: FeatureGateProps) => {
  const { canAccessFeature, createCheckout, isLoading } = useSubscription();

  const getMinimumTier = () => {
    if (feature === "team_features") return "team";
    if (feature === "advanced_analytics" || feature === "api_access" || feature === "custom_branding") return "business";
    return "pro";
  };

  const minimumTier = getMinimumTier();
  const tierConfig = TIER_CONFIGS[minimumTier];
  const isContactSalesFeature = feature === "sso" || feature === "custom_integrations";

  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  // Don't render the locked overlay while subscription data is still loading —
  // this prevents a Rules of Hooks violation caused by changing hook call count
  // when the tier resolves from the default "starter" to the user's actual tier.
  if (isLoading) {
    return null;
  }

  if (canAccessFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const handleContactSalesClick = () => {
    setUpgradeDialogOpen(false);
    setSalesDialogOpen(true);
  };

  return (
    <>
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogTrigger asChild>
          <div className="relative cursor-pointer group">
            <div className="opacity-50 pointer-events-none blur-[1px]">{children}</div>
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
              <div className="flex flex-col items-center gap-2 text-center p-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-medium">Upgrade to unlock</span>
              </div>
            </div>
          </div>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {isContactSalesFeature ? "Contact Sales" : `Upgrade to ${tierConfig.name}`}
            </DialogTitle>
            <DialogDescription>
              {isContactSalesFeature
                ? "This feature is available for larger organizations. Contact our sales team to learn more."
                : `This feature requires a ${tierConfig.name} subscription or higher.`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isContactSalesFeature ? (
              <Button
                className="w-full gradient-hero text-primary-foreground"
                onClick={handleContactSalesClick}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Contact Sales
              </Button>
            ) : (
            <>
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
                onClick={() => createCheckout(minimumTier)}
                className="w-full gradient-hero text-primary-foreground"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to {tierConfig.name}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <ContactSalesDialog open={salesDialogOpen} onOpenChange={setSalesDialogOpen} />
    </>
  );
};
