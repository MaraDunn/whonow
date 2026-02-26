import React from "react";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/utils/relationshipHealth";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RelationshipHealthBadgeProps {
  score: number;
  status: HealthStatus;
  /** "badge" renders score + label pill (default). "icon" renders a compact dot only. */
  variant?: "badge" | "icon";
  className?: string;
}

const STATUS_STYLES: Record<HealthStatus, string> = {
  Healthy: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  "At Risk": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  Cold: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const DOT_STYLES: Record<HealthStatus, string> = {
  Healthy: "bg-green-500",
  "At Risk": "bg-yellow-500",
  Cold: "bg-red-500",
};

export const RelationshipHealthBadge = React.memo(function RelationshipHealthBadge({
  score,
  status,
  variant = "badge",
  className,
}: RelationshipHealthBadgeProps) {
  if (variant === "icon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center justify-center w-4 h-4 rounded",
              DOT_STYLES[status],
              className
            )}
            aria-label={`Relationship health: ${status} (${score})`}
          >
            <span className="sr-only">{status}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {status} · {score}/100
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs font-medium tabular-nums select-none whitespace-nowrap",
            STATUS_STYLES[status],
            className
          )}
          aria-label={`Relationship health: ${status} (${score})`}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_STYLES[status])}
            aria-hidden="true"
          />
          {score}
          <span className="hidden sm:inline">{status}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Relationship Health: {status} ({score}/100)
      </TooltipContent>
    </Tooltip>
  );
});
