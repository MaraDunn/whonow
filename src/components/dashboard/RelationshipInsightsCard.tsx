import { useState, useMemo } from "react";
import { Users, TrendingUp, AlertCircle, Heart, Expand, Settings2 } from "lucide-react";
import { useRelationshipInsights } from "@/hooks/useRelationshipInsights";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AddedContactsDialog,
  ContactedContactsDialog,
  StaleContactsDialog,
  HealthScoreDialog,
  ExpandedChartDialog,
} from "@/components/dashboard/InsightDialogs";
import type { MonthlyBucket } from "@/hooks/useRelationshipInsights";

type ActiveDialog = "added" | "contacted" | "stale" | "health-score" | "chart" | null;

interface MetricTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

function MetricTile({ label, value, subtext, icon, onClick }: MetricTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-lg border bg-card p-4 min-w-0 text-left transition-all duration-200",
        onClick &&
          "cursor-pointer hover:border-primary/50 hover:bg-accent/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50"
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="shrink-0">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide truncate">
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold leading-none mt-1">{value}</p>
      {subtext && (
        <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
      )}
    </button>
  );
}

interface GrowthChartProps {
  data: MonthlyBucket[];
}

function GrowthChart({ data }: GrowthChartProps) {
  const height = 60;
  const width = 300;
  const padding = { top: 4, bottom: 4, left: 4, right: 4 };

  const points = useMemo(() => {
    if (data.length === 0) return [];
    const maxCount = Math.max(...data.map((d) => d.count), 1);
    const minCount = Math.min(...data.map((d) => d.count), 0);
    const range = maxCount - minCount || 1;
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    return data.map((bucket, i) => ({
      x: padding.left + (i / Math.max(data.length - 1, 1)) * innerW,
      y:
        padding.top +
        innerH -
        ((bucket.count - minCount) / range) * innerH,
      label: bucket.month.slice(5),
      count: bucket.count,
    }));
  }, [data]);

  if (points.length < 2) return null;

  const d = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    )
    .join(" ");

  const areaD =
    d +
    ` L ${points[points.length - 1].x.toFixed(1)} ${(height - padding.bottom).toFixed(1)}` +
    ` L ${points[0].x.toFixed(1)} ${(height - padding.bottom).toFixed(1)} Z`;

  const lastPoint = points[points.length - 1];

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Client Growth (6 months)
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: height }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={areaD}
          fill="url(#growth-fill)"
          className="text-primary"
        />
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="3"
          fill="currentColor"
          className="text-primary"
        />
        {points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={height}
            textAnchor="middle"
            fontSize="8"
            fill="currentColor"
            opacity="0.5"
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

interface RelationshipInsightsCardProps {
  reminderInterval?: number;
}

export function RelationshipInsightsCard({
  reminderInterval = 30,
}: RelationshipInsightsCardProps) {
  const { data: metrics, isLoading } = useRelationshipInsights(reminderInterval);
  const { contactInterval, updateContactInterval } = useReminderSettings();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [localContactInterval, setLocalContactInterval] = useState<string>("");

  const closeDialog = () => setActiveDialog(null);

  const handleContactIntervalBlur = () => {
    const parsed = parseInt(localContactInterval, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== contactInterval) {
      updateContactInterval(parsed);
    }
    setLocalContactInterval("");
  };

  const displayContactInterval = localContactInterval !== "" ? localContactInterval : String(contactInterval);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }

  if (!metrics) return null;

  const healthScore = metrics.avgHealthScore;
  const healthLabel =
    healthScore >= 70 ? "Healthy" : healthScore >= 40 ? "At Risk" : "Cold";
  const healthColor =
    healthScore >= 70 ? "text-green-500" : healthScore >= 40 ? "text-amber-500" : "text-muted-foreground";

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold">Relationship Insights</h3>
          <p className="text-xs text-muted-foreground">
            Overview of your client activity this month
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <Label htmlFor="default-contact-interval" className="text-xs text-muted-foreground whitespace-nowrap">
            Preferred contact interval
          </Label>
          <Input
            id="default-contact-interval"
            type="number"
            min={1}
            max={365}
            value={displayContactInterval}
            onChange={(e) => setLocalContactInterval(e.target.value)}
            onBlur={handleContactIntervalBlur}
            className="h-7 w-20 text-xs text-center"
          />
          <span className="text-xs text-muted-foreground">days</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile
          label="Clients added"
          value={metrics.addedThisMonth}
          subtext="this month"
          icon={<Users className="h-3.5 w-3.5" />}
          onClick={() => setActiveDialog("added")}
        />
        <MetricTile
          label="Clients contacted"
          value={metrics.contactedThisMonth}
          subtext="this month"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          onClick={() => setActiveDialog("contacted")}
        />
        <MetricTile
          label="Stale clients"
          value={metrics.staleCount}
          subtext={`>${reminderInterval}d no contact`}
          icon={<AlertCircle className="h-3.5 w-3.5" />}
          onClick={() => setActiveDialog("stale")}
        />
        <MetricTile
          label="Health Score"
          value={healthScore}
          subtext={healthLabel}
          icon={<Heart className={cn("h-3.5 w-3.5", healthColor)} />}
          onClick={() => setActiveDialog("health-score")}
        />
      </div>

      {/* Expandable chart */}
      <button
        type="button"
        onClick={() => setActiveDialog("chart")}
        className="mt-4 w-full text-left rounded-lg border bg-card/50 p-3 cursor-pointer transition-all duration-200 hover:border-primary/50 hover:bg-accent/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 group/chart relative"
      >
        <div className="absolute top-2 right-2 opacity-0 group-hover/chart:opacity-100 transition-opacity text-muted-foreground">
          <Expand className="h-3.5 w-3.5" />
        </div>
        <GrowthChart data={metrics.monthlyGrowth} />
      </button>

      {/* Dialogs — only mounted when active to avoid unnecessary data fetching */}
      {activeDialog === "added" && (
        <AddedContactsDialog
          open
          onOpenChange={(o) => {
            if (!o) closeDialog();
          }}
        />
      )}
      {activeDialog === "contacted" && (
        <ContactedContactsDialog
          open
          onOpenChange={(o) => {
            if (!o) closeDialog();
          }}
        />
      )}
      {activeDialog === "stale" && (
        <StaleContactsDialog
          open
          onOpenChange={(o) => {
            if (!o) closeDialog();
          }}
          reminderInterval={reminderInterval}
        />
      )}
      {activeDialog === "health-score" && (
        <HealthScoreDialog
          open
          onOpenChange={(o) => {
            if (!o) closeDialog();
          }}
        />
      )}
      {activeDialog === "chart" && (
        <ExpandedChartDialog
          open
          onOpenChange={(o) => {
            if (!o) closeDialog();
          }}
        />
      )}
    </div>
  );
}
