import { formatDistanceToNow } from "date-fns";
import {
  Briefcase,
  Phone,
  CalendarCheck,
  MessageSquare,
  Users,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActivityLog } from "@/hooks/useActivityLog";
import type { ActivityType } from "@/hooks/useActivityLog";

interface ContactActivityTimelineProps {
  contactId: string | null | undefined;
}

const ACTIVITY_CONFIG: Record<
  ActivityType,
  { label: (metadata: Record<string, unknown> | null) => string; icon: React.ReactNode; variant: "default" | "secondary" | "outline" }
> = {
  client_toggled: {
    label: (meta) =>
      meta?.is_client ? "Marked as client" : "Removed from clients",
    icon: <Briefcase className="h-3.5 w-3.5" />,
    variant: "default",
  },
  contacted: {
    label: () => "Marked as contacted",
    icon: <Phone className="h-3.5 w-3.5" />,
    variant: "secondary",
  },
  follow_up_set: {
    label: (meta) => {
      const date = meta?.date as string | undefined;
      const snoozed = meta?.snoozed as boolean | undefined;
      if (snoozed && date) return `Follow-up snoozed to ${date}`;
      if (date) return `Follow-up set for ${date}`;
      return "Follow-up cleared";
    },
    icon: <CalendarCheck className="h-3.5 w-3.5" />,
    variant: "outline",
  },
  note_added: {
    label: (meta) => {
      const preview = meta?.note_preview as string | undefined;
      return preview ? `Note: "${preview}"` : "Note added";
    },
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    variant: "outline",
  },
  internal_toggled: {
    label: (meta) =>
      meta?.is_internal ? "Marked as internal contact" : "Removed from internal",
    icon: <Users className="h-3.5 w-3.5" />,
    variant: "secondary",
  },
};

function formatRelativeTime(isoDate: string): string {
  try {
    return formatDistanceToNow(new Date(isoDate), { addSuffix: true });
  } catch {
    return isoDate;
  }
}

export function ContactActivityTimeline({ contactId }: ContactActivityTimelineProps) {
  const { entries, isLoading } = useActivityLog(contactId);

  if (!contactId) return null;

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Activity is recorded when you update this contact
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="p-4 space-y-0">
        {entries.map((entry, index) => {
          const config = ACTIVITY_CONFIG[entry.activityType] ?? {
            label: () => entry.activityType,
            icon: <Activity className="h-3.5 w-3.5" />,
            variant: "outline" as const,
          };

          return (
            <div key={entry.id} className="relative">
              {/* Vertical connector line */}
              {index < entries.length - 1 && (
                <div
                  className="absolute left-[11px] top-8 w-px bg-border"
                  style={{ height: "calc(100% - 8px)" }}
                />
              )}
              <div className="flex gap-3 pb-5">
                {/* Icon circle */}
                <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground mt-0.5">
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm leading-snug">{config.label(entry.metadata)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatRelativeTime(entry.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
