import { useState, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ContactGrid } from "@/components/ContactGrid";
import { OrgRelationshipInsightsCard } from "@/components/dashboard/OrgRelationshipInsightsCard";
import { FollowUpQueueCard } from "@/components/dashboard/FollowUpQueueCard";
import { RelationshipRemindersCard } from "@/components/dashboard/RelationshipRemindersCard";
import { MassOutreachAssistant } from "@/components/dashboard/MassOutreachAssistant";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import type { Contact } from "@/types/contact";
import type { Folder } from "@/types/folder";
import type { ActionType } from "@/hooks/useActionSearch";
import { computeHealthScore } from "@/utils/relationshipHealth";
import type { HealthStatus } from "@/utils/relationshipHealth";

export type OrgDashboardTab = "overview" | "directory" | "outreach";

type OrgSortOption =
  | "oldest-contacted"
  | "newest-contacted"
  | "oldest-added"
  | "newest-added"
  | "health-desc"
  | "health-asc";

type HealthFilter = "all" | HealthStatus;

interface OrganizationDashboardProps {
  // Contacts for the Directory tab (search-filtered)
  contacts: Contact[];
  // All loaded shared contacts (for follow-up queue, reminders, and outreach)
  allSharedContacts: Contact[];
  searchQuery: string;
  action?: ActionType;
  orgSortOption: OrgSortOption;
  onOrgSortChange: (value: OrgSortOption) => void;
  activeTab: OrgDashboardTab;
  onTabChange: (tab: OrgDashboardTab) => void;
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
}

export function OrganizationDashboard({
  contacts,
  allSharedContacts,
  searchQuery,
  action,
  orgSortOption,
  onOrgSortChange,
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
}: OrganizationDashboardProps) {
  const { reminderInterval } = useReminderSettings();
  const [outreachPreSelected, setOutreachPreSelected] = useState<Set<string>>(new Set());
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");

  const handleMoveToOutreach = useCallback((contactIds: string[]) => {
    setOutreachPreSelected(new Set(contactIds));
    onTabChange("outreach");
  }, [onTabChange]);

  const now = useMemo(() => new Date(), []);
  const directoryContacts = useMemo(() => {
    let list = contacts.map((c) => {
      const { score, status } = computeHealthScore(c, 0, now);
      return { ...c, relationshipHealthScore: score, relationshipHealthStatus: status };
    });

    if (healthFilter !== "all") {
      list = list.filter((c) => c.relationshipHealthStatus === healthFilter);
    }

    if (orgSortOption === "health-desc") {
      list = [...list].sort(
        (a, b) => (b.relationshipHealthScore ?? 0) - (a.relationshipHealthScore ?? 0)
      );
    } else if (orgSortOption === "health-asc") {
      list = [...list].sort(
        (a, b) => (a.relationshipHealthScore ?? 0) - (b.relationshipHealthScore ?? 0)
      );
    }

    return list;
  }, [contacts, healthFilter, orgSortOption, now]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-display font-semibold">Shared Directory</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          {allSharedContacts.length} shared contact{allSharedContacts.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as OrgDashboardTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="rounded-lg border bg-card p-5">
            <OrgRelationshipInsightsCard reminderInterval={reminderInterval} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border bg-card p-5">
              <FollowUpQueueCard
                contacts={allSharedContacts}
                onMoveToOutreach={handleMoveToOutreach}
                onViewContact={onViewContact}
              />
            </div>
            <div className="rounded-lg border bg-card p-5">
              <RelationshipRemindersCard contacts={allSharedContacts} />
            </div>
          </div>
        </TabsContent>

        {/* ── Directory ────────────────────────────────────────── */}
        <TabsContent value="directory" className="mt-0">
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-muted-foreground text-sm sm:text-base">
                {directoryContacts.length} shared contact{directoryContacts.length !== 1 ? "s" : ""}
                {healthFilter !== "all" && (
                  <span className="ml-1.5 text-xs font-medium text-foreground">
                    · {healthFilter}
                  </span>
                )}
              </p>
              <Select
                value={orgSortOption}
                onValueChange={(v) => onOrgSortChange(v as OrgSortOption)}
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
          />
        </TabsContent>

        {/* ── Outreach ─────────────────────────────────────────── */}
        <TabsContent value="outreach" className="mt-0">
          <div className="rounded-lg border bg-card p-5">
            <MassOutreachAssistant contacts={allSharedContacts} preSelectedIds={outreachPreSelected} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
