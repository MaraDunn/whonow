import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, Check, Chrome, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";

export interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right";
  /** When true, show "Sync from Google" and "Import from File" buttons; on choose, onComplete(importTab) is called. */
  importChoice?: boolean;
}

interface OnboardingTutorialProps {
  steps: OnboardingStep[];
  onComplete: (importTab?: "google" | "file") => void;
  onSkip: () => void;
}

const DIRECTORIES_STEP_ID = "directories";

// Z-index order: backdrop < elevated sidebar < spotlight < tooltip (so sidebar is visible but highlight and popup stay on top)
const Z_BACKDROP = 9999;
const Z_SIDEBAR_ELEVATED = 10001;
const Z_SPOTLIGHT = 10002;
const Z_TOOLTIP = 10003;

export function OnboardingTutorial({ steps, onComplete, onSkip }: OnboardingTutorialProps) {
  const isMobile = useIsMobile();
  const { setOpenMobile, openMobile } = useSidebar();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  const isDirectoriesStep = currentStep?.id === DIRECTORIES_STEP_ID;

  // Portal container so spotlight and tooltip render above the Sheet (same level as body)
  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-onboarding-portal", "");
    el.style.cssText = "position:fixed;inset:0;z-index:10002;pointer-events:none";
    document.body.appendChild(el);
    setPortalEl(el);
    return () => {
      document.body.removeChild(el);
      setPortalEl(null);
    };
  }, []);

  // On mobile, open the sidebar when we're on the directories step (do not close here; close in handleNext)
  useEffect(() => {
    if (!isMobile) return;
    if (isDirectoriesStep) setOpenMobile(true);
  }, [isMobile, isDirectoriesStep, setOpenMobile]);

  // Update target element position
  useEffect(() => {
    if (!currentStep.targetSelector) {
      setTargetRect(null);
      setIsVisible(true);
      return;
    }

    const updatePosition = () => {
      const element = document.querySelector(currentStep.targetSelector!);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
        setIsVisible(true);
      } else {
        setTargetRect(null);
        setIsVisible(true);
      }
    };

    // Initial update
    updatePosition();

    // Scroll target into view when step changes so the user can see the highlighted element
    const targetElement = document.querySelector(currentStep.targetSelector!);
    if (targetElement && typeof (targetElement as HTMLElement).scrollIntoView === "function") {
      (targetElement as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    // Elevate target element above the backdrop so it stays visible (backdrop is z-9999)
    let elevatedEl: HTMLElement | null = null;
    let originalZIndex = "";
    let originalPosition = "";
    let elevatedSidebar: HTMLElement | null = null;
    let sidebarOriginalZIndex = "";

    if (targetElement && targetElement instanceof HTMLElement) {
      elevatedEl = targetElement;
      originalZIndex = targetElement.style.zIndex;
      originalPosition = targetElement.style.position;
      targetElement.style.zIndex = String(Z_SIDEBAR_ELEVATED);
      targetElement.style.position = "relative";

      // If target is inside the sidebar, elevate the sidebar (or Sheet portal) so it isn't covered by the backdrop.
      const sidebarRoot = targetElement.closest("[data-sidebar=\"sidebar\"]") as HTMLElement | null;
      if (sidebarRoot) {
        const isMobileSidebar = sidebarRoot.getAttribute("data-mobile") === "true";
        if (isMobileSidebar) {
          // Mobile: elevate the Sheet portal (direct child of body) so the whole Sheet is above the backdrop.
          // Defer so the Sheet has painted and the portal is in the DOM.
          let portalRoot: HTMLElement | null = sidebarRoot;
          while (portalRoot.parentElement && portalRoot.parentElement !== document.body) {
            portalRoot = portalRoot.parentElement as HTMLElement;
          }
          if (portalRoot) {
            elevatedSidebar = portalRoot;
            sidebarOriginalZIndex = portalRoot.style.zIndex;
            portalRoot.style.zIndex = String(Z_SIDEBAR_ELEVATED);
          }
        } else {
          // Desktop: elevate the fixed sidebar column (parent of [data-sidebar="sidebar"]).
          const sidebarWrapper = sidebarRoot.parentElement;
          if (sidebarWrapper && sidebarWrapper instanceof HTMLElement) {
            elevatedSidebar = sidebarWrapper;
            sidebarOriginalZIndex = sidebarWrapper.style.zIndex;
            sidebarWrapper.style.zIndex = String(Z_SIDEBAR_ELEVATED);
          }
        }
      }
    }

    // Update on scroll, resize, or DOM changes
    const observer = new MutationObserver(updatePosition);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      if (elevatedEl) {
        elevatedEl.style.zIndex = originalZIndex;
        elevatedEl.style.position = originalPosition;
      }
      if (elevatedSidebar) {
        elevatedSidebar.style.zIndex = sidebarOriginalZIndex;
      }
    };
  }, [currentStep.targetSelector, openMobile]);

  const handleNext = () => {
    const leavingDirectories = currentStep?.id === DIRECTORIES_STEP_ID;
    if (isLastStep) {
      setIsVisible(false);
      setTimeout(() => onComplete(), 200);
    } else {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentStepIndex((prev) => prev + 1);
        if (leavingDirectories && isMobile) setOpenMobile(false);
      }, 200);
    }
  };

  const handleImportChoice = (tab: "google" | "file") => {
    setIsVisible(false);
    setTimeout(() => onComplete(tab), 200);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onSkip, 200);
  };

  if (!currentStep) return null;

  // On mobile, pin tooltip to bottom safe area so it never moves off screen
  const getTooltipStyle = (): React.CSSProperties => {
    if (isMobile) {
      return {
        position: "fixed",
        bottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
        left: "16px",
        right: "16px",
        width: "auto",
        maxWidth: "min(400px, calc(100vw - 32px))",
        marginLeft: "auto",
        marginRight: "auto",
        zIndex: Z_TOOLTIP,
      };
    }

    if (!targetRect) {
      // Center on screen if no target
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: Z_TOOLTIP,
      };
    }

    const position = currentStep.position || "bottom";
    const spacing = 16;
    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = targetRect.top - spacing;
        left = targetRect.left + targetRect.width / 2;
        break;
      case "bottom":
        top = targetRect.bottom + spacing;
        left = targetRect.left + targetRect.width / 2;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - spacing;
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.right + spacing;
        break;
    }

    return {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      transform:
        position === "top" || position === "bottom"
          ? "translate(-50%, 0)"
          : position === "left"
          ? "translate(-100%, -50%)"
          : "translate(0, -50%)",
      zIndex: Z_TOOLTIP,
    };
  };

  const spotlightAndTooltip = (
    <>
      {/* Spotlight - above elevated sidebar so the highlight is visible */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-200"
          style={{
            zIndex: Z_SPOTLIGHT,
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 4px hsl(var(--ring) / 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)",
            borderRadius: "8px",
          }}
        />
      )}

      {/* Tooltip - pointer-events auto so Next/Skip are clickable */}
      <div
        ref={tooltipRef}
        style={{ ...getTooltipStyle(), pointerEvents: "auto" }}
        className={cn(
          "transition-all duration-200",
          isMobile && "flex flex-col items-center",
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        <div className={cn("bg-card border border-border shadow-lg rounded-lg p-4 max-w-sm w-[320px]", isMobile && "w-full max-w-[calc(100vw-32px)]")}>
          {/* Progress bar */}
          <div className="mb-3">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <button
                onClick={handleSkip}
                className="hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3">
            <h3 className="font-semibold text-base text-foreground">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentStep.content}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-4">
            {currentStep.importChoice ? (
              <div className="flex flex-col gap-2">
                <Button onClick={() => handleImportChoice("file")} size="sm" className="w-full gap-2">
                  <FileUp className="h-4 w-4" />
                  Import from File
                </Button>
                <Button onClick={() => handleImportChoice("google")} size="sm" className="w-full gap-2">
                  <Chrome className="h-4 w-4" />
                  Sync from Google
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-muted-foreground hover:text-foreground mt-2"
                >
                  Skip
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Skip
                </Button>
                <Button onClick={handleNext} size="sm" className="ml-auto gap-2">
                  {isLastStep ? (
                    <>
                      <Check className="h-4 w-4" />
                      Done
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Backdrop overlay - no blur and lighter on directories step so the sidebar target stays readable */}
      <div
        className={cn(
          "fixed inset-0 transition-opacity duration-200",
          isDirectoriesStep && isMobile ? "bg-background/50" : "bg-background/80 backdrop-blur-sm",
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ zIndex: Z_BACKDROP }}
        onClick={handleSkip}
      />

      {/* Spotlight + tooltip: in a portal when ready (above Sheet), otherwise in place */}
      {portalEl ? createPortal(spotlightAndTooltip, portalEl) : spotlightAndTooltip}
    </>
  );
}
