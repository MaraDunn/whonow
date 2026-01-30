import { useState, useEffect, useRef } from "react";
import { X, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface OnboardingTutorialProps {
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingTutorial({ steps, onComplete, onSkip }: OnboardingTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

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
        setIsVisible(false);
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
    if (targetElement && targetElement instanceof HTMLElement) {
      elevatedEl = targetElement;
      originalZIndex = targetElement.style.zIndex;
      originalPosition = targetElement.style.position;
      targetElement.style.zIndex = "10001";
      targetElement.style.position = "relative";
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
    };
  }, [currentStep.targetSelector]);

  const handleNext = () => {
    if (isLastStep) {
      setIsVisible(false);
      setTimeout(onComplete, 200);
    } else {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentStepIndex((prev) => prev + 1);
      }, 200);
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onSkip, 200);
  };

  if (!currentStep) return null;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      // Center on screen if no target
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10000,
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
      zIndex: 10000,
    };
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-200",
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ zIndex: 9999 }}
        onClick={handleSkip}
      />

      {/* Spotlight on target element */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-200"
          style={{
            zIndex: 9999,
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)",
            borderRadius: "8px",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={getTooltipStyle()}
        className={cn(
          "transition-all duration-200",
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        <div className="bg-card border border-border shadow-lg rounded-lg p-4 max-w-sm w-[320px]">
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
          <div className="flex items-center gap-2 mt-4">
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
        </div>
      </div>
    </>
  );
}
