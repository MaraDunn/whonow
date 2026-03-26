import { useState, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ContactGrid } from "@/components/ContactGrid";
import { RelationshipInsightsCard } from "@/components/dashboard/RelationshipInsightsCard";
import { FollowUpQueueCard } from "@/components/dashboard/FollowUpQueueCard";
import { RelationshipRemindersCard } from "@/components/dashboard/RelationshipRemindersCard";
import { MassOutreachAssistant } from "@/components/dashboard/MassOutreachAssistant";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import type { Contact } from "@/types/contact";
import type { Folder } from "@/types/folder";
import type { ActionType } from "@/hooks/useActionSearch";
import { useHealthClock } from "@/contexts/HealthClockContext";
import { computeHealthScore } from "@/utils/relationshipHealth";
import type { HealthStatus } from "@/utils/relationshipHealth";

export type ClientDashboardTab = "overview" | "directory" | "outreach";

type ClientSortOption =
  | "oldest-contacted"
  | "newest-contacted"
  | "oldest-added"
  | "newest-added"
  | "health-desc"
  | "health-asc";

type HealthFilter = "all" | HealthStatus;

interface ClientDashboardProps {
  // Contacts for the Client Directory tab
  contacts: Contact[];
  // All loaded contacts (for follow-up queue and reminders — full client list)
  allClientContacts: Contact[];
  searchQuery: string;
  action?: ActionType;
  clientSortOption: ClientSortOption;
  onClientSortChange: (value: ClientSortOption) => void;
  activeTab: ClientDashboardTab;
  onTabChange: (tab: ClientDashboardTab) => void;
  // ContactGrid pass-through props
  onEditContact: (contact: Contact) => void;
  onViewContact?: (contact: Contact) => void;
  onDeleteContact?: (id: string) => void;
  onRestoreContact?: (id: string) => void;
  onPermanentlyDelete?: (id: string) => void;
  onEmptyTrash?: () => void;
  folders?: Folder[];
  onUpdateFolder?: (contactId: string, folderId: string | null) => void;
  showOwnershipBadge?: boolean;
  onMarkContacted?: (id: string) => void;
  onToggleClient?: (id: string, isClient: boolean) => void;
  selectedContactIds?: Set<string>;
  onSelectContact?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkMoveToFolder?: (ids: string[], folderId: string | null) => void;
  onBulkToggleClient?: (ids: string[], isClient: boolean) => void;
  onBulkMarkContacted?: (ids: string[]) => void;
  hasClientAccess?: boolean;
  selectionMode?: boolean;
  onToggleSelectionMode?: (mode: boolean) => void;
  interactionCounts?: Record<string, number>;
}

export function ClientDashboard({
  contacts,
  allClientContacts,
  searchQuery,
  action,
  clientSortOption,
  onClientSortChange,
  activeTab,
  onTabChange,
  onEditContact,
  onViewContact,
  onDeleteContact,
  onRestoreContact,
  onPermanentlyDelete,
  onEmptyTrash,
  folders,
  onUpdateFolder,
  showOwnershipBadge,
  onMarkContacted,
  onToggleClient,
  selectedContactIds,
  onSelectContact,
  onSelectAll,
  onBulkDelete,
  onBulkMoveToFolder,
  onBulkToggleClient,
  onBulkMarkContacted,
  hasClientAccess,
  selectionMode,
  onToggleSelectionMode,
  interactionCounts,
}: ClientDashboardProps) {
  const { reminderInterval, contactInterval } = useReminderSettings();
  const [outreachPreSelected, setOutreachPreSelected] = useState<Set<string>>(new Set());
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");

  const handleMoveToOutreach = useCallback((contactIds: string[]) => {
    setOutreachPreSelected(new Set(contactIds));
    onTabChange("outreach");
  }, [onTabChange]);

  const healthClock = useHealthClock(); // ticks every minute so directory health stays current
  // Compute health scores for the directory (use current time so scores stay live)
  const directoryContacts = useMemo(() => {
    const now = new Date();
    let list = contacts.map((c) => {
      if (!c.isClient) return c;
      const count = interactionCounts?.[c.id] ?? 0;
      const { score, status } = computeHealthScore(c, count, now, {
        defaultIntervalDays: contactInterval,
      });
      return { ...c, relationshipHealthScore: score, relationshipHealthStatus: status };
    });

    // Apply health filter (only within client subset)
    if (healthFilter !== "all") {
      list = list.filter((c) => c.isClient && c.relationshipHealthStatus === healthFilter);
    }

    // Apply health-based sort options
    if (clientSortOption === "health-desc") {
      list = [...list].sort(
        (a, b) => (b.relationshipHealthScore ?? 0) - (a.relationshipHealthScore ?? 0)
      );
    } else if (clientSortOption === "health-asc") {
      list = [...list].sort(
        (a, b) => (a.relationshipHealthScore ?? 0) - (b.relationshipHealthScore ?? 0)
      );
    }

    return list;
  }, [contacts, healthFilter, clientSortOption, healthClock, interactionCounts, contactInterval]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-display font-semibold">Client Dashboard</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          {allClientContacts.length} client{allClientContacts.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as ClientDashboardTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="rounded-lg border bg-card p-5">
            <RelationshipInsightsCard reminderInterval={reminderInterval} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border bg-card p-5">
              <FollowUpQueueCard
                contacts={allClientContacts}
                onMoveToOutreach={handleMoveToOutreach}
                onViewContact={onViewContact}
              />
            </div>
            <div className="rounded-lg border bg-card p-5">
              <RelationshipRemindersCard contacts={allClientContacts} />
            </div>
          </div>
        </TabsContent>

        {/* ── Directory ────────────────────────────────────────── */}
        <TabsContent value="directory" className="mt-0">
          <div className="mb-4 flex flex-col gap-3">
            {/* Top row: count + sort */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-muted-foreground text-sm sm:text-base">
                {directoryContacts.length} client{directoryContacts.length !== 1 ? "s" : ""}
                {healthFilter !== "all" && (
                  <span className="ml-1.5 text-xs font-medium text-foreground">
                    · {healthFilter}
                  </span>
                )}
              </p>
              <Select
                value={clientSortOption}
                onValueChange={(v) => onClientSortChange(v as ClientSortOption)}
              >
                <SelectTrigger className="w-full sm:w-[240px] shrink-0">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oldest-contacted">Longest since contacted</SelectItem>
                  <SelectItem value="newest-contacted">Most recently contacted</SelectItem>
                  <SelectItem value="oldest-added">Longest since added</SelectItem>
                  <SelectItem value="newest-added">Most recently added</SelectItem>
                  <SelectItem value="health-desc">Health: Best first</SelectItem>
                  <SelectItem value="health-asc">Health: Needs attention first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Health filter toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Filter:</span>
              <ToggleGroup
                type="single"
                value={healthFilter}
                onValueChange={(v) => setHealthFilter((v || "all") as HealthFilter)}
                className="gap-1"
              >
                <ToggleGroupItem value="all" className="h-7 px-2.5 text-xs rounded-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  All
                </ToggleGroupItem>
                <ToggleGroupItem value="Healthy" className="h-7 px-2.5 text-xs rounded-full data-[state=on]:bg-green-600 data-[state=on]:text-white">
                  Healthy
                </ToggleGroupItem>
                <ToggleGroupItem value="At Risk" className="h-7 px-2.5 text-xs rounded-full data-[state=on]:bg-yellow-500 data-[state=on]:text-white">
                  At Risk
                </ToggleGroupItem>
                <ToggleGroupItem value="Cold" className="h-7 px-2.5 text-xs rounded-full data-[state=on]:bg-red-600 data-[state=on]:text-white">
                  Cold
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <ContactGrid
            contacts={directoryContacts}
            searchQuery={searchQuery}
            action={action}
            onEditContact={onEditContact}
            onViewContact={onViewContact}
            isTrashView={false}
            onDeleteContact={onDeleteContact}
            onRestoreContact={onRestoreContact}
            onPermanentlyDelete={onPermanentlyDelete}
            onEmptyTrash={onEmptyTrash}
            folders={folders}
            onUpdateFolder={onUpdateFolder}
            showOwnershipBadge={showOwnershipBadge}
            onMarkContacted={onMarkContacted}
            onToggleClient={onToggleClient}
            selectedContactIds={selectedContactIds}
            onSelectContact={onSelectContact}
            onSelectAll={onSelectAll}
            onBulkDelete={onBulkDelete}
            onBulkMoveToFolder={onBulkMoveToFolder}
            onBulkToggleClient={onBulkToggleClient}
            onBulkMarkContacted={onBulkMarkContacted}
            hasClientAccess={hasClientAccess}
            selectionMode={selectionMode}
            onToggleSelectionMode={onToggleSelectionMode}
            interactionCounts={interactionCounts}
          />
        </TabsContent>

        {/* ── Outreach ─────────────────────────────────────────── */}
        <TabsContent value="outreach" className="mt-0">
          <div className="rounded-lg border bg-card p-5">
            <MassOutreachAssistant contacts={allClientContacts} preSelectedIds={outreachPreSelected} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
