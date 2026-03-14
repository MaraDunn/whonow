import { useState, useMemo } from "react";
import { format, startOfMonth, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  CalendarDays, Users, TrendingUp, AlertCircle, Briefcase, Plus, CheckCheck, XCircle, Heart,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  useAddedContacts,
  useContactedContacts,
  useStaleContacts,
  useClientRatioData,
  useContactedRatioData,
  useExpandedChartData,
  useHealthScoreData,
} from "@/hooks/useInsightContacts";
import { useBulkSetFollowUpDate, useSetFollowUpDate } from "@/hooks/useFollowUps";
import { useGoogleCalendarIntegration } from "@/hooks/useGoogleCalendarIntegration";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import { toast } from "sonner";
import type { Contact } from "@/types/contact";

// ─── Shared Components ───────────────────────────────────────────

function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: Date;
  to: Date;
  onChange: (from: Date, to: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>({ from, to });

  const handleSelect = (newRange: DateRange | undefined) => {
    setRange(newRange);
    if (newRange?.from && newRange?.to) {
      onChange(newRange.from, newRange.to);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 font-normal w-fit"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {format(from, "MMM d, yyyy")} – {format(to, "MMM d, yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect as any}
          numberOfMonths={1}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ContactRow({
  contact,
  action,
}: {
  contact: Contact;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent/50 transition-colors">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={contact.avatar} />
        <AvatarFallback className="text-[10px]">
          {getInitials(contact.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{contact.name}</p>
          {contact.isClient && (
            <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-medium">
              Client
            </span>
          )}
        </div>
        {contact.company && (
          <p className="text-xs text-muted-foreground truncate">
            {contact.company}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 pt-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Added Contacts Dialog ───────────────────────────────────────

interface AddedContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddedContactsDialog({
  open,
  onOpenChange,
}: AddedContactsDialogProps) {
  const [from, setFrom] = useState(() => startOfMonth(new Date()));
  const [to, setTo] = useState(() => new Date());
  const queryTo = useMemo(() => endOfDay(to), [to]);
  const { data: contacts, isLoading } = useAddedContacts(from, queryTo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Clients Added
          </DialogTitle>
          <DialogDescription>
            {contacts?.length ?? 0} client
            {(contacts?.length ?? 0) !== 1 ? "s" : ""} added in this period
          </DialogDescription>
        </DialogHeader>

        <DateRangePicker
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
        />

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : !contacts || contacts.length === 0 ? (
            <EmptyState message="No clients added in this period" />
          ) : (
            <div className="space-y-0.5">
              {contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  action={
                    c.createdAt ? (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.createdAt), "MMM d")}
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contacted Contacts Dialog ───────────────────────────────────

interface ContactedContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactedContactsDialog({
  open,
  onOpenChange,
}: ContactedContactsDialogProps) {
  const [from, setFrom] = useState(() => startOfMonth(new Date()));
  const [to, setTo] = useState(() => new Date());
  const queryTo = useMemo(() => endOfDay(to), [to]);
  const { data: contacts, isLoading } = useContactedContacts(from, queryTo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Clients Contacted
          </DialogTitle>
          <DialogDescription>
            {contacts?.length ?? 0} client
            {(contacts?.length ?? 0) !== 1 ? "s" : ""} contacted in this period
          </DialogDescription>
        </DialogHeader>

        <DateRangePicker
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
        />

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : !contacts || contacts.length === 0 ? (
            <EmptyState message="No clients reached in this period" />
          ) : (
            <div className="space-y-0.5">
              {contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  action={
                    c.lastContactedAt ? (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.lastContactedAt), "MMM d")}
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stale Contacts Dialog ───────────────────────────────────────

interface StaleContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminderInterval: number;
}

export function StaleContactsDialog({
  open,
  onOpenChange,
  reminderInterval,
}: StaleContactsDialogProps) {
  const { data: contacts, isLoading } = useStaleContacts(reminderInterval);
  const { status: calendarStatus, createEvent } = useGoogleCalendarIntegration();
  const { addFollowUpsToCalendar } = useReminderSettings();
  const onAfterSet = useMemo(() => {
    if (!calendarStatus?.connected || !addFollowUpsToCalendar) return undefined;
    return (contactId: string, date: string, contactName: string) => {
      createEvent(contactId, date, contactName).then((ok) => {
        if (!ok) toast.error("Follow-up set; could not add to Google Calendar");
      });
    };
  }, [calendarStatus?.connected, addFollowUpsToCalendar, createEvent]);
  const setFollowUp = useSetFollowUpDate({ onAfterSet });
  const bulkSetFollowUp = useBulkSetFollowUpDate({ onAfterSet });

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return format(d, "yyyy-MM-dd");
  }, []);

  const contactsWithoutFollowUp = useMemo(
    () => (contacts ?? []).filter((c) => !c.followUpDate),
    [contacts]
  );

  const handleBulkAdd = () => {
    const ids = contactsWithoutFollowUp.map((c) => c.id);
    if (ids.length === 0) return;
    const contactNames: Record<string, string> = {};
    contactsWithoutFollowUp.forEach((c) => {
      if (c.name) contactNames[c.id] = c.name;
    });
    bulkSetFollowUp.mutate({ ids, date: tomorrow, contactNames: Object.keys(contactNames).length > 0 ? contactNames : undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Stale Clients
          </DialogTitle>
          <DialogDescription>
            {contacts?.length ?? 0} client
            {(contacts?.length ?? 0) !== 1 ? "s" : ""} not reached in over{" "}
            {reminderInterval} days
          </DialogDescription>
        </DialogHeader>

        {contactsWithoutFollowUp.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-fit text-xs gap-1.5"
            onClick={handleBulkAdd}
            disabled={bulkSetFollowUp.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
            Add all ({contactsWithoutFollowUp.length}) to follow-up queue
          </Button>
        )}

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : !contacts || contacts.length === 0 ? (
            <EmptyState message="No stale clients — nice work!" />
          ) : (
            <div className="space-y-0.5">
              {contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  action={
                    c.followUpDate ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        Queued
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          setFollowUp.mutate({ id: c.id, date: tomorrow, contactName: c.name })
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Follow-up
                      </Button>
                    )
                  }
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client Ratio Dialog ─────────────────────────────────────────

interface ClientRatioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RATIO_COLORS = { all: "#6366f1", clients: "#f59e0b" };

export function ClientRatioDialog({
  open,
  onOpenChange,
}: ClientRatioDialogProps) {
  const [from, setFrom] = useState(() => startOfMonth(new Date()));
  const [to, setTo] = useState(() => new Date());
  const queryTo = useMemo(() => endOfDay(to), [to]);
  const { data, isLoading } = useClientRatioData(from, queryTo);

  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Selected Period",
        allContacts: data.totalCount,
        clients: data.clientCount,
      },
    ];
  }, [data]);

  const pct = data ? Math.round(data.ratio * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Client Ratio
          </DialogTitle>
          <DialogDescription>
            Breakdown of contacts vs. clients in this period
          </DialogDescription>
        </DialogHeader>

        <DateRangePicker
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
        />

        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : data ? (
          <div className="space-y-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={60} barGap={16}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <ReTooltip
                    cursor={{ fill: "hsl(var(--accent))" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  <Bar
                    dataKey="allContacts"
                    name="All Contacts"
                    fill={RATIO_COLORS.all}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="clients"
                    name="Clients"
                    fill={RATIO_COLORS.clients}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="text-center space-y-1 pb-2">
              <p className="text-3xl font-bold">{pct}%</p>
              <p className="text-sm text-muted-foreground">
                {data.clientCount} of {data.totalCount} contact
                {data.totalCount !== 1 ? "s" : ""} are clients
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Contacted Ratio Dialog ──────────────────────────────────────

interface ContactedRatioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONTACTED_COLORS = { contacted: "#22c55e", uncontacted: "#f59e0b" };

export function ContactedRatioDialog({
  open,
  onOpenChange,
}: ContactedRatioDialogProps) {
  const { data, isLoading } = useContactedRatioData();

  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Contacted", value: data.contactedClients, fill: CONTACTED_COLORS.contacted },
      { label: "Uncontacted", value: data.uncontactedClients, fill: CONTACTED_COLORS.uncontacted },
    ];
  }, [data]);

  const pct = data ? Math.round(data.ratio * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCheck className="h-4 w-4 text-primary" />
            Contacted vs. Uncontacted
          </DialogTitle>
          <DialogDescription>
            How many of your clients have ever been contacted
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : data ? (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{data.contactedClients} contacted</span>
                <span>{data.uncontactedClients} uncontacted</span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full rounded-l-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: CONTACTED_COLORS.contacted,
                  }}
                />
                <div
                  className="h-full flex-1 rounded-r-full"
                  style={{ backgroundColor: CONTACTED_COLORS.uncontacted }}
                />
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              {chartData.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${item.fill}20` }}
                  >
                    {item.label === "Contacted" ? (
                      <CheckCheck className="h-4 w-4" style={{ color: item.fill }} />
                    ) : (
                      <XCircle className="h-4 w-4" style={{ color: item.fill }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-none">{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center pb-1">
              <p className="text-3xl font-bold">{pct}%</p>
              <p className="text-sm text-muted-foreground">
                of {data.totalClients} client{data.totalClients !== 1 ? "s" : ""} contacted
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Health Score Dialog ──────────────────────────────────────────

const HEALTH_COLORS = {
  Healthy: "#22c55e",
  "At Risk": "#f59e0b",
  Cold: "#6b7280",
};

interface HealthScoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthScoreDialog({ open, onOpenChange }: HealthScoreDialogProps) {
  const { data, isLoading, isError } = useHealthScoreData();

  const scoreColor = !data
    ? HEALTH_COLORS.Cold
    : data.avgScore >= 70
    ? HEALTH_COLORS.Healthy
    : data.avgScore >= 40
    ? HEALTH_COLORS["At Risk"]
    : HEALTH_COLORS.Cold;

  const statusLabel = !data
    ? "Cold"
    : data.avgScore >= 70
    ? "Healthy"
    : data.avgScore >= 40
    ? "At Risk"
    : "Cold";

  const buckets = data
    ? [
        { label: "Healthy", count: data.healthyCount, color: HEALTH_COLORS.Healthy, description: "≥ 70 score" },
        { label: "At Risk", count: data.atRiskCount, color: HEALTH_COLORS["At Risk"], description: "40–69 score" },
        { label: "Cold", count: data.coldCount, color: HEALTH_COLORS.Cold, description: "< 40 score" },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Aggregate Health Score
          </DialogTitle>
          <DialogDescription>
            Average relationship health across all your clients
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Could not load health data. Please try again.
          </p>
        ) : data ? (
          <div className="space-y-5">
            {/* Score ring */}
            <div className="flex flex-col items-center gap-1 py-2">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full border-4"
                style={{ borderColor: scoreColor }}
              >
                <div className="text-center">
                  <p className="text-3xl font-bold leading-none" style={{ color: scoreColor }}>
                    {data.avgScore}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">/ 100</p>
                </div>
              </div>
              <span
                className="mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
              >
                {statusLabel}
              </span>
              <p className="text-xs text-muted-foreground">
                Based on {data.totalClients} client{data.totalClients !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Distribution bars */}
            <div className="space-y-2">
              {buckets.map((b) => {
                const pct = data.totalClients > 0 ? Math.round((b.count / data.totalClients) * 100) : 0;
                return (
                  <div key={b.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium" style={{ color: b.color }}>
                        {b.label}
                      </span>
                      <span className="text-muted-foreground">
                        {b.count} client{b.count !== 1 ? "s" : ""} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: b.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground border-t pt-3">
              Score is based on recency of last contact relative to each client's preferred interval.
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Expanded Chart Dialog ───────────────────────────────────────

const SERIES_CONFIG = [
  { key: "contactsAdded" as const, label: "Contacts Added", color: "#6366f1" },
  { key: "clientsAdded" as const, label: "Clients Added", color: "#f59e0b" },
  { key: "contacted" as const, label: "Contacted", color: "#22c55e" },
  { key: "followUpsSet" as const, label: "Follow-ups Set", color: "#8b5cf6" },
];

interface ExpandedChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExpandedChartDialog({
  open,
  onOpenChange,
}: ExpandedChartDialogProps) {
  const [activeSeries, setActiveSeries] = useState<Set<string>>(
    new Set(["contactsAdded", "clientsAdded"])
  );
  const { data, isLoading } = useExpandedChartData(6);

  const toggleSeries = (key: string) => {
    setActiveSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Growth Analytics</DialogTitle>
          <DialogDescription>
            6-month overview of your network activity
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {SERIES_CONFIG.map((s) => {
            const active = activeSeries.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSeries(s.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                  active
                    ? "border-transparent text-white"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
                style={active ? { backgroundColor: s.color } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : data && data.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={2} barCategoryGap="20%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <ReTooltip
                  cursor={{ fill: "hsl(var(--accent))" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                {SERIES_CONFIG.filter((s) => activeSeries.has(s.key)).map(
                  (s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={s.color}
                      radius={[3, 3, 0, 0]}
                    />
                  )
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="Not enough data to display" />
        )}
      </DialogContent>
    </Dialog>
  );
}
