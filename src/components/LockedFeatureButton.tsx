import React, { ReactNode, useState } from "react";
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

// Global flag to track if a dialog was just closed
export let dialogJustClosed = false;

interface LockedFeatureContainerProps {
  feature: FeatureName;
  children: ReactNode;
  className?: string;
  minimumTier?: SubscriptionTier;
}

/** Container with a lock icon that nests locked features; click opens upgrade dialog. */
export function LockedFeatureContainer({
  feature,
  children,
  className,
  minimumTier = "pro",
}: LockedFeatureContainerProps) {
  const { canAccessFeature, createCheckout } = useSubscription();
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasAccess = canAccessFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  const tierConfig = TIER_CONFIGS[minimumTier];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      dialogJustClosed = true;
      setTimeout(() => {
        dialogJustClosed = false;
      }, 200);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1.5 shrink-0 rounded-md border border-border bg-muted/30 pl-1.5 pr-1 py-0.5",
          "cursor-pointer hover:bg-muted/50 transition-colors",
          className
        )}
        onClick={handleClick}
        data-locked-feature-container
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
      >
        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
        {children}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
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
                dialogJustClosed = true;
                setDialogOpen(false);
                setTimeout(() => {
                  dialogJustClosed = false;
                }, 200);
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

interface LockedFeatureButtonProps {
  feature: FeatureName;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  minimumTier?: SubscriptionTier;
  hideLockIcon?: boolean;
  /** "overlay" = lock on top of button (default). "left" = lock beside button for icon-only buttons. */
  lockPosition?: "overlay" | "left";
}

export function LockedFeatureButton({
  feature,
  children,
  className,
  onClick,
  minimumTier = "pro",
  hideLockIcon = false,
  lockPosition = "overlay",
}: LockedFeatureButtonProps) {
  const { canAccessFeature, createCheckout } = useSubscription();
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasAccess = canAccessFeature(feature);

  const tierConfig = TIER_CONFIGS[minimumTier];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasAccess) {
      onClick?.();
    } else {
      setDialogOpen(true);
    }
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Set flag to prevent card click immediately after dialog closes
      dialogJustClosed = true;
      setTimeout(() => {
        dialogJustClosed = false;
      }, 200);
    }
  };

  const showLock = !hasAccess && !hideLockIcon;
  const isLeftPosition = lockPosition === "left";

  return (
    <>
      <div
        className={cn(
          isLeftPosition ? "flex items-center gap-1.5" : "relative",
          className
        )}
        onClick={handleClick}
        data-locked-feature-button
      >
        {showLock && isLeftPosition && (
          <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
        )}
        {children}
        {showLock && !isLeftPosition && (
          <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" aria-hidden />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
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
                dialogJustClosed = true;
                setDialogOpen(false);
                setTimeout(() => {
                  dialogJustClosed = false;
                }, 200);
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
