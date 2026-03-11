import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { ContactGrid } from "@/components/ContactGrid";
import { Header } from "@/components/Header";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { ContactDetailsDialog } from "@/components/ContactDetailsDialog";
import { ClientDashboard } from "@/components/ClientDashboard";
import type { ClientDashboardTab } from "@/components/ClientDashboard";
import { OrganizationDashboard } from "@/components/OrganizationDashboard";
import type { OrgDashboardTab } from "@/components/OrganizationDashboard";
import { ProfileEditorDialog } from "@/components/ProfileEditorDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ContactSupportDialog } from "@/components/ContactSupportDialog";
import { FolderSidebar } from "@/components/FolderSidebar";
import { TeamDirectoryGrid } from "@/components/TeamDirectoryGrid";
import { ImportContactsDialog } from "@/components/ImportContactsDialog";
import { CompanySetupDialog } from "@/components/CompanySetupDialog";
import { CreateOrganizationAfterUpgradeDialog } from "@/components/CreateOrganizationAfterUpgradeDialog";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { onboardingSteps } from "@/config/onboardingSteps";
import { SelectionToolbar } from "@/components/SelectionToolbar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import { useContacts } from "@/hooks/useContacts";
import { useFolders } from "@/hooks/useFolders";
import { useCustomKeywords } from "@/hooks/useCustomKeywords";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useTeamDirectoryContacts } from "@/hooks/useTeamDirectoryContacts";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { AppUpdateDialog } from "@/components/AppUpdateDialog";
import { Contact, ContactOwnershipFilter } from "@/types/contact";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SearchQueryFilters } from "@/types/searchQuery";
import { applySearchFiltersToContacts } from "@/utils/applySearchFilters";
import { ContactDragProvider } from "@/contexts/ContactDragContext";
import { HealthClockProvider } from "@/contexts/HealthClockContext";

type ClientSortOption = "oldest-contacted" | "newest-contacted" | "oldest-added" | "newest-added";
type OrgSortOption = "oldest-contacted" | "newest-contacted" | "oldest-added" | "newest-added" | "health-desc" | "health-asc";

function pluralizeCount(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
}

function pluralizeJobTitle(jobTitleRaw: string) {
  const jt = jobTitleRaw.trim();
  if (!jt) return "people";
  const lower = jt.toLowerCase();
  if (lower.endsWith("s")) return jt;
  if (lower.endsWith("y") && !/[aeiou]y$/i.test(lower)) return `${jt.slice(0, -1)}ies`;
  return `${jt}s`;
}

function buildFriendlySearchSummary(args: {
  count: number;
  action: string | null | undefined;
  filters: SearchQueryFilters | null | undefined;
  roleLabel: string | null | undefined;
  isTruncated: boolean;
}) {
  const { count, action, filters, roleLabel, isTruncated } = args;
  const actionPrefix = action ? `Ready to ${action}. ` : "";

  if (count === 0) return `${actionPrefix}I couldn’t find anyone for that in your contacts.`;

  const verb = count === 1 ? "Here’s" : "Here are";
  const countStr = isTruncated && count > 1 ? `top ${count}` : `${count}`;

  if (filters?.job_title) {
    const base = (roleLabel || filters.job_title).trim();
    const jobLabel = count === 1 ? base : pluralizeJobTitle(base);
    return `${actionPrefix}${verb} ${countStr} ${jobLabel} in your contacts.`;
  }
  if (filters?.relationship_type) {
    const rel =
      filters.relationship_type === "client"
        ? pluralizeCount("client", count)
        : filters.relationship_type === "vendor"
          ? pluralizeCount("vendor", count)
          : filters.relationship_type === "met"
            ? `person${count === 1 ? "" : "s"} you met`
            : `person${count === 1 ? "" : "s"} you worked with`;
    return `${actionPrefix}${verb} ${countStr} ${rel} in your contacts.`;
  }
  if (filters?.company) {
    return `${actionPrefix}${verb} ${countStr} person${count === 1 ? "" : "s"} from ${filters.company} in your contacts.`;
  }
  if (filters?.name) {
    return `${actionPrefix}${verb} ${countStr} ${pluralizeCount("contact", count)} named ${filters.name}.`;
  }
  if (filters?.location) {
    return `${actionPrefix}${verb} ${countStr} person${count === 1 ? "" : "s"} in ${filters.location} in your contacts.`;
  }
  if (filters?.tags?.length) {
    const tagLabel = filters.tags.length === 1 ? `"${filters.tags[0]}"` : `"${filters.tags.join('", "')}"`;
    return `${actionPrefix}${verb} ${countStr} ${pluralizeCount("contact", count)} tagged ${tagLabel}.`;
  }

  return `${actionPrefix}${verb} ${countStr} ${pluralizeCount("contact", count)} in your contacts.`;
}

const IndexContent = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile, needsCompanySetup, needsOnboarding, completeOnboarding, createCompany, joinCompany, skipCompanySetup, company, isAdmin, isSuperAdmin, isCreatingCompany } = useProfile(user?.id);
  const { canAccessFeature, showCreateOrganizationAfterUpgrade, dismissCreateOrgPrompt } = useSubscription();
  const hasClientAccess = canAccessFeature("client_management");
  const hasSmartFoldersAccess = canAccessFeature("smart_folders");
  const { teamContacts, isLoading: teamContactsLoading, refetch: refetchTeamContacts } = useTeamDirectoryContacts();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importDefaultTab, setImportDefaultTab] = useState<string | undefined>(undefined);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [clientView, setClientView] = useState<ClientDashboardTab | null>(null);
  const [orgView, setOrgView] = useState<OrgDashboardTab | null>(null);
  const [ownershipFilter, setOwnershipFilter] = useState<ContactOwnershipFilter>("all");
  const [clientSortOption, setClientSortOption] = useState<ClientSortOption>("oldest-contacted");
  const [orgSortOption, setOrgSortOption] = useState<OrgSortOption>("oldest-contacted");
  const [selectedClientFolderId, setSelectedClientFolderId] = useState<string | null>(null);
  const [selectedTeamFolderId, setSelectedTeamFolderId] = useState<string | null>(null);
  const [selectedOrgFolderId, setSelectedOrgFolderId] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const {
    canCheckUpdates,
    update: appUpdate,
    isDownloading: isUpdateDownloading,
    downloadProgress: updateProgress,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
  } = useAppUpdate();

  // Desktop-only: check for updates shortly after mount.
  useEffect(() => {
    if (!canCheckUpdates) return;
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 1500);
    return () => clearTimeout(timer);
  }, [canCheckUpdates, checkForUpdates]);

  // Refetch team contacts when directory becomes visible or team folder is selected
  useEffect(() => {
    if (showDirectory || selectedTeamFolderId !== null) {
      refetchTeamContacts();
    }
  }, [showDirectory, selectedTeamFolderId, refetchTeamContacts]);
  const { 
    contacts, 
    contactMarkedVersion,
    trashedContacts,
    trashCount,
    personalContactsCount: accuratePersonalCount,
    sharedContactsCount: accurateSharedCount,
    clientCount: accurateClientCount,
    isLoading: contactsLoading, 
    addContact, 
    updateContact,
    deleteContact,
    restoreContact,
    bulkRestoreContacts,
    permanentlyDeleteContact,
    emptyTrash,
    updateLastContacted,
    bulkUpdateLastContacted,
    toggleClientStatus,
    bulkToggleClientStatus,
    bulkShareContacts,
    totalCount,
    bulkDeleteContacts,
    bulkMoveToFolder,
    hasMoreContacts,
    loadMoreContacts,
    isLoadingMoreContacts,
    getContactById,
    updateContactInListCache,
    interactionCounts,
  } = useContacts();
  const { 
    folders, 
    organizationFolders, 
    clientFolders, 
    organizationClientFolders, 
    teamFolders, 
    organizationTeamFolders, 
    orgFolders,
    organizationOrgFolders,
    allFolders,
    addFolder, 
    updateFolder, 
    deleteFolder 
  } = useFolders();
  const { keywords, addKeyword, removeKeyword, resetToDefaults, isCompanyKeywords, canEditKeywords } = useCustomKeywords();

  // Clear smart folder selection when user doesn't have Pro+ (e.g. after downgrade)
  useEffect(() => {
    if (hasSmartFoldersAccess) return;
    const clearIfSmart = (folderId: string | null, setter: (id: string | null) => void) => {
      if (!folderId) return;
      const folder = allFolders.find((f) => f.id === folderId);
      if (folder?.isSmartFolder) setter(null);
    };
    clearIfSmart(selectedFolderId, setSelectedFolderId);
    clearIfSmart(selectedClientFolderId, setSelectedClientFolderId);
    clearIfSmart(selectedTeamFolderId, setSelectedTeamFolderId);
    clearIfSmart(selectedOrgFolderId, setSelectedOrgFolderId);
  }, [hasSmartFoldersAccess, selectedFolderId, selectedClientFolderId, selectedTeamFolderId, selectedOrgFolderId, allFolders]);

  // Handle OAuth callback redirects (e.g., from Slack)
  useEffect(() => {
    const integration = searchParams.get("integration");
    const status = searchParams.get("status");
    const message = searchParams.get("message");

    if (integration && status) {
      if (status === "success") {
        toast.success(`${integration.charAt(0).toUpperCase() + integration.slice(1)} connected successfully!`);
        setSettingsOpen(true);
      } else if (status === "error") {
        toast.error(`Failed to connect ${integration}: ${message || "Unknown error"}`);
      }
      
      // Clear the URL params
      searchParams.delete("integration");
      searchParams.delete("status");
      searchParams.delete("message");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Launch onboarding tutorial for new users after company setup completes
  useEffect(() => {
    if (profile && needsOnboarding && !needsCompanySetup && !showOnboarding) {
      const timer = setTimeout(() => setShowOnboarding(true), 500);
      return () => clearTimeout(timer);
    }
  }, [profile, needsOnboarding, needsCompanySetup, showOnboarding]);

  // Show create-organization prompt when user upgrades to a tier that allows it
  // (Only when they've already completed company setup as individual—otherwise CompanySetupDialog handles it)
  const showCreateOrgAfterUpgrade =
    showCreateOrganizationAfterUpgrade &&
    canAccessFeature("organization_creation") &&
    !company &&
    !needsCompanySetup;

  // Clear the upgrade prompt when user creates an organization (company becomes set)
  useEffect(() => {
    if (company && showCreateOrganizationAfterUpgrade) {
      dismissCreateOrgPrompt();
    }
  }, [company, showCreateOrganizationAfterUpgrade, dismissCreateOrgPrompt]);

  // Selected folder (for smart folder filter) — contact, client, or team depending on current view
  const selectedFolder = useMemo(
    () => (selectedFolderId ? allFolders.find((f) => f.id === selectedFolderId) : null),
    [selectedFolderId, allFolders]
  );
  const selectedClientFolder = useMemo(
    () => (selectedClientFolderId ? allFolders.find((f) => f.id === selectedClientFolderId) : null),
    [selectedClientFolderId, allFolders]
  );
  const selectedTeamFolder = useMemo(
    () => (selectedTeamFolderId ? allFolders.find((f) => f.id === selectedTeamFolderId) : null),
    [selectedTeamFolderId, allFolders]
  );
  const selectedOrgFolder = useMemo(
    () => (selectedOrgFolderId ? allFolders.find((f) => f.id === selectedOrgFolderId) : null),
    [selectedOrgFolderId, allFolders]
  );

  const isViewingSmartFolder =
    selectedFolder &&
    (selectedFolder.isSmartFolder ||
      (selectedFolder.filterCriteria &&
        typeof selectedFolder.filterCriteria === "object" &&
        Object.keys(selectedFolder.filterCriteria).length > 0));

  // Smart folder as bookmarked search: use saved query from the folder in the current view (contact, client, team, or org).
  const savedQuery = useMemo(() => {
    const folder =
      clientView !== null
        ? selectedClientFolder
        : showDirectory
          ? selectedTeamFolder
          : orgView !== null
            ? selectedOrgFolder
            : selectedFolder;
    return folder?.savedSearchQuery?.trim() || null;
  }, [clientView, showDirectory, orgView, selectedFolder, selectedClientFolder, selectedTeamFolder, selectedOrgFolder]);
  const isSmartFolderWithQuery = useMemo(() => {
    if (!savedQuery) return false;
    if (clientView !== null) return selectedClientFolderId !== null;
    if (showDirectory) return selectedTeamFolderId !== null;
    if (orgView !== null) return selectedOrgFolderId !== null;
    return selectedFolderId !== null;
  }, [savedQuery, clientView, showDirectory, orgView, selectedFolderId, selectedClientFolderId, selectedTeamFolderId, selectedOrgFolderId]);


  // Filter contacts by folder and ownership (used when NOT using bookmarked search)
  const folderFilteredContacts = useMemo(() => {
    if (showTrash) return trashedContacts;

    let filtered = contacts;

    // Apply ownership filter for company users
    if (company && ownershipFilter !== "all") {
      filtered = filtered.filter((c) =>
        ownershipFilter === "shared" ? c.isShared : !c.isShared
      );
    }

    // Apply folder filter: regular folder by folderId, smart folder by saved search criteria
    // Treat as smart folder if isSmartFolder flag is set OR filterCriteria is present (fallback for older rows)
    if (selectedFolderId !== null && selectedFolder) {
      const hasFilterCriteria =
        selectedFolder.filterCriteria &&
        typeof selectedFolder.filterCriteria === "object" &&
        Object.keys(selectedFolder.filterCriteria).length > 0;
      const isSmartFolder = selectedFolder.isSmartFolder || hasFilterCriteria;

      if (isSmartFolder && hasFilterCriteria) {
        const matchesFilter = applySearchFiltersToContacts(filtered, selectedFolder.filterCriteria);
        // Smart folders show only search matches; do not merge assigned contacts
        filtered = matchesFilter;
      } else {
        filtered = filtered.filter((c) => c.folderId === selectedFolderId);
      }
    }

    return filtered;
  }, [contacts, trashedContacts, selectedFolderId, selectedFolder, showTrash, ownershipFilter, company]);

  // Use accurate counts from database functions (fallback to array length if not available)
  // Only compute fallback if needed (when accurate count is 0 or unavailable)
  const fallbackPersonalCount = useMemo(() => {
    if (accuratePersonalCount > 0) return 0; // Don't compute if we have accurate count
    return contacts.filter(c => !c.isShared).length;
  }, [contacts, accuratePersonalCount]);
  
  const fallbackSharedCount = useMemo(() => {
    if (accurateSharedCount > 0) return 0; // Don't compute if we have accurate count
    return contacts.filter(c => c.isShared).length;
  }, [contacts, accurateSharedCount]);
  
  const personalContactsCount = accuratePersonalCount > 0 ? accuratePersonalCount : fallbackPersonalCount;
  const sharedContactsCount = accurateSharedCount > 0 ? accurateSharedCount : fallbackSharedCount;

  // Client directory: only clients (optionally scoped to a client folder). Smart folders don't filter by folderId — search does.
  const clientDirectoryContacts = useMemo(() => {
    const isClientSmartFolder = selectedClientFolder?.isSmartFolder || !!selectedClientFolder?.savedSearchQuery?.trim();
    const folderFilter =
      selectedClientFolderId === null
        ? true
        : isClientSmartFolder
          ? true
          : (c: Contact) => c.folderId === selectedClientFolderId;
    const clientsOnly = contacts.filter(
      (c) => c.isClient && (folderFilter === true || folderFilter(c))
    );
    return [...clientsOnly].sort((a, b) => {
      switch (clientSortOption) {
        case "oldest-contacted":
          // Never contacted first, then oldest contacted
          if (!a.lastContactedAt && !b.lastContactedAt) return 0;
          if (!a.lastContactedAt) return -1;
          if (!b.lastContactedAt) return 1;
          return new Date(a.lastContactedAt).getTime() - new Date(b.lastContactedAt).getTime();
        case "newest-contacted":
          // Most recently contacted first, never contacted last
          if (!a.lastContactedAt && !b.lastContactedAt) return 0;
          if (!a.lastContactedAt) return 1;
          if (!b.lastContactedAt) return -1;
          return new Date(b.lastContactedAt).getTime() - new Date(a.lastContactedAt).getTime();
        case "oldest-added":
          // Oldest added first (we don't have createdAt on Contact type, so use id order as proxy)
          return a.id.localeCompare(b.id);
        case "newest-added":
          // Most recently added first
          return b.id.localeCompare(a.id);
        default:
          return 0;
      }
    });
  }, [contacts, clientSortOption, selectedClientFolderId, selectedClientFolder]);

  // Org dashboard (shared contacts): only shared contacts, optionally scoped to selected org folder. Smart folders don't filter by folderId.
  const orgDirectoryContacts = useMemo(() => {
    const isOrgSmartFolder = selectedOrgFolder?.isSmartFolder || !!selectedOrgFolder?.savedSearchQuery?.trim();
    const folderFilter =
      selectedOrgFolderId === null
        ? true
        : isOrgSmartFolder
          ? true
          : (c: Contact) => c.folderId === selectedOrgFolderId;
    const sharedOnly = contacts.filter(
      (c) => c.isShared === true && (folderFilter === true || folderFilter(c))
    );
    return [...sharedOnly].sort((a, b) => {
      switch (orgSortOption) {
        case "oldest-contacted":
          if (!a.lastContactedAt && !b.lastContactedAt) return 0;
          if (!a.lastContactedAt) return -1;
          if (!b.lastContactedAt) return 1;
          return new Date(a.lastContactedAt).getTime() - new Date(b.lastContactedAt).getTime();
        case "newest-contacted":
          if (!a.lastContactedAt && !b.lastContactedAt) return 0;
          if (!a.lastContactedAt) return 1;
          if (!b.lastContactedAt) return -1;
          return new Date(b.lastContactedAt).getTime() - new Date(a.lastContactedAt).getTime();
        case "oldest-added":
          return a.id.localeCompare(b.id);
        case "newest-added":
          return b.id.localeCompare(a.id);
        default:
          return 0;
      }
    });
  }, [contacts, orgSortOption, selectedOrgFolderId, selectedOrgFolder]);

  // Count of clients for sidebar - use accurate count from database function
  // Only compute fallback if needed
  const fallbackClientCount = useMemo(() => {
    if (accurateClientCount > 0) return 0; // Don't compute if we have accurate count
    return contacts.filter(c => c.isClient).length;
  }, [contacts, accurateClientCount]);
  const clientCount = accurateClientCount > 0 ? accurateClientCount : fallbackClientCount;

  // Filtered team contacts: filter by selectedTeamFolderId when a team folder is selected. Smart folders don't filter by folderId.
  const filteredTeamContacts = useMemo(() => {
    if (selectedTeamFolderId === null) return teamContacts;
    const isTeamSmartFolder = selectedTeamFolder?.isSmartFolder || !!selectedTeamFolder?.savedSearchQuery?.trim();
    if (isTeamSmartFolder) return teamContacts;
    return teamContacts.filter((c) => c.folderId === selectedTeamFolderId);
  }, [teamContacts, selectedTeamFolderId, selectedTeamFolder]);

  // Base list for search: folder/client/org/team list (smart folders with saved query use the server search directly).
  const baseListForSearch =
    showDirectory
      ? filteredTeamContacts
      : clientView !== null
        ? clientDirectoryContacts
        : orgView !== null
          ? orgDirectoryContacts
          : folderFilteredContacts;

  // Smart folders reuse the exact same RPC code path as the search bar.
  // When a smart folder is active, the saved query runs automatically.
  // If the user types in the search bar, combine both queries so results stay within the smart folder scope.
  const effectiveSearchQuery = isSmartFolderWithQuery
    ? (searchQuery ? `${savedQuery} ${searchQuery}` : savedQuery!)
    : searchQuery;

  const {
    contacts: filteredContacts,
    action,
    isLoading: searchLoading,
    understoodFilters,
    understoodRoleLabel,
    isTruncated,
  } = useSmartSearch(baseListForSearch, effectiveSearchQuery, {
    contactMarkedVersion,
    scopeToContacts: clientView !== null || orgView !== null,
    maxResults: isSmartFolderWithQuery ? 500 : undefined,
    clientOnly: clientView !== null,
    sharedOnly: showDirectory || orgView !== null,
  });

  const handleSelectTrash = () => {
    setShowTrash(true);
    setShowDirectory(false);
    setClientView(null);
    setOrgView(null);
    setSelectedFolderId(null);
    setSelectedOrgFolderId(null);
  };

  const handleSelectFolder = (folderId: string | null) => {
    setShowTrash(false);
    setShowDirectory(false);
    setClientView(null);
    setOrgView(null);
    setSelectedFolderId(folderId);
    setSelectedOrgFolderId(null);
  };

  const handleSelectDirectory = () => {
    setShowDirectory(true);
    setShowTrash(false);
    setClientView(null);
    setOrgView(null);
    setSelectedFolderId(null);
    setSelectedTeamFolderId(null);
    setSelectedOrgFolderId(null);
    // Refetch team contacts to ensure we have the latest data
    refetchTeamContacts();
  };

  const handleSelectClientDirectory = () => {
    setClientView("directory");
    setOrgView(null);
    setShowDirectory(false);
    setShowTrash(false);
    setSelectedFolderId(null);
    setSelectedOrgFolderId(null);
  };

  const handleSelectOrgDirectory = () => {
    setOrgView("directory");
    setClientView(null);
    setShowDirectory(false);
    setShowTrash(false);
    setSelectedFolderId(null);
    setSelectedOrgFolderId(null);
  };

  // Selection handlers (defined after filteredContacts)
  // Memoize selection handler to avoid creating new function on every render
  const handleSelectContact = useCallback((id: string, selected: boolean) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = async (selected: boolean) => {
    if (selected) {
      // Only run when we have a confirmed user so we never select orphan/other users' contacts
      if (!user?.id) {
        setSelectedContactIds(new Set());
        return;
      }
      // Explicit visibility filter: same as RLS and list_contacts_slim — only own or shared company contacts
      const hasCompany = profile?.companyId != null;
      const visibilityFilter = hasCompany
        ? `owner_id.eq.${user.id},and(company_id.eq.${profile!.companyId},is_shared.eq.true)`
        : null;

      try {
        const allIds: string[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;

        // Handle trash view differently
        if (showTrash) {
          // For trash, fetch only trashed contacts visible to this user
          while (hasMore) {
            let query = supabase
              .from("contacts")
              .select("id")
              .not("deleted_at", "is", null);
            if (visibilityFilter) query = query.or(visibilityFilter);
            else query = query.eq("owner_id", user.id);
            query = query
              .order("deleted_at", { ascending: false })
              .range(page * pageSize, (page + 1) * pageSize - 1);

            const { data, error } = await query;

            if (error) {
              console.error("Error fetching trashed contact IDs:", error);
              setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
              return;
            }

            if (!data || data.length === 0) {
              hasMore = false;
            } else {
              allIds.push(...data.map((c: { id: string }) => c.id));
              hasMore = data.length === pageSize;
              page++;
            }
          }
        } else {
          // For active contacts, match the same filters as folderFilteredContacts
          while (hasMore) {
            let query = supabase
              .from("contacts")
              .select("id, folder_id, is_shared, tags")
              .is("deleted_at", null);
            if (visibilityFilter) query = query.or(visibilityFilter);
            else query = query.eq("owner_id", user.id);
            query = query.range(page * pageSize, (page + 1) * pageSize - 1);

            // Apply folder filter if active
            if (selectedFolderId !== null) {
              query = query.eq("folder_id", selectedFolderId);
            }

            const { data, error } = await query;

            if (error) {
              console.error("Error fetching contact IDs:", error);
              setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
              return;
            }

            if (!data || data.length === 0) {
              hasMore = false;
            } else {
              // Filter out my-profile contacts and apply ownership filter
              const filtered = data
                .filter((c: { tags?: string[] }) => !c.tags?.includes("my-profile"))
                .filter((c: { is_shared?: boolean }) => {
                  if (company && ownershipFilter !== "all") {
                    return ownershipFilter === "shared" ? c.is_shared : !c.is_shared;
                  }
                  return true;
                })
                .map((c: { id: string }) => c.id);

              allIds.push(...filtered);
              hasMore = data.length === pageSize;
              page++;
            }
          }
        }

        setSelectedContactIds(new Set(allIds));
      } catch (err) {
        console.error("Error in handleSelectAll:", err);
        // Fallback to using filteredContacts (may be limited to 1000)
        setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
      }
    } else {
      setSelectedContactIds(new Set());
    }
  };

  const handleBulkDelete = (ids: string[]) => {
    if (!ids || ids.length === 0) {
      toast.error("No contacts selected");
      return;
    }
    console.log("[handleBulkDelete] Deleting contacts:", ids.length, "contacts");
    bulkDeleteContacts(ids, {
      onSuccess: () => {
        setSelectedContactIds(new Set());
        setSelectionMode(false);
      },
      onError: (error) => {
        console.error("[handleBulkDelete] Error:", error);
        // Don't clear selection on error so user can retry
      }
    });
  };

  const handleBulkMoveToFolder = (ids: string[], folderId: string | null) => {
    if (!ids || ids.length === 0) {
      toast.error("No contacts selected");
      return;
    }
    const folderName = folderId 
      ? (allFolders.find(f => f.id === folderId)?.name || "folder")
      : "No folder";
    console.log("[handleBulkMoveToFolder] Moving contacts:", ids.length, "contacts to folder:", folderId);
    bulkMoveToFolder({ ids, folderId, folderName }, {
      onSuccess: () => {
        setSelectedContactIds(new Set());
        setSelectionMode(false);
      },
      onError: (error) => {
        console.error("[handleBulkMoveToFolder] Error:", error);
        // Don't clear selection on error so user can retry
      }
    });
  };

  const handleBulkToggleClient = (ids: string[], isClient: boolean) => {
    if (!ids || ids.length === 0) {
      toast.error("No contacts selected");
      return;
    }
    console.log("[handleBulkToggleClient] Marking contacts as client:", ids.length, "contacts, isClient:", isClient);
    bulkToggleClientStatus({ ids, isClient }, {
      onSuccess: () => {
        setSelectedContactIds(new Set());
        setSelectionMode(false);
      },
      onError: (error) => {
        console.error("[handleBulkToggleClient] Error:", error);
        // Don't clear selection on error so user can retry
      }
    });
  };

  const handleBulkMarkContacted = (ids: string[]) => {
    if (!ids || ids.length === 0) {
      toast.error("No contacts selected");
      return;
    }
    console.log("[handleBulkMarkContacted] Marking contacts as contacted:", ids.length, "contacts");
    bulkUpdateLastContacted(ids, {
      onSuccess: () => {
        setSelectedContactIds(new Set());
        setSelectionMode(false);
      },
      onError: (error) => {
        console.error("[handleBulkMarkContacted] Error:", error);
        // Don't clear selection on error so user can retry
      }
    });
  };

  const handleBulkRestore = (ids: string[]) => {
    if (!ids || ids.length === 0) {
      toast.error("No contacts selected");
      return;
    }
    console.log("[handleBulkRestore] Restoring contacts:", ids.length, "contacts");
    bulkRestoreContacts(ids, {
      onSuccess: () => {
        setSelectedContactIds(new Set());
        setSelectionMode(false);
      },
      onError: (error) => {
        console.error("[handleBulkRestore] Error:", error);
        // Don't clear selection on error so user can retry
      }
    });
  };

  const handleBulkShare = (ids: string[]) => {
    if (!ids || ids.length === 0) {
      toast.error("No contacts selected");
      return;
    }
    bulkShareContacts(ids, {
      onSuccess: () => {
        setSelectedContactIds(new Set());
        setSelectionMode(false);
      },
      onError: (error) => {
        console.error("[handleBulkShare] Error:", error);
      }
    });
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    if (selectionMode) {
      setSelectedContactIds(new Set());
    }
  };

  // Keyboard shortcut: ⌘⇧S / Ctrl+Shift+S to toggle selection mode (when not typing in an input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "s") {
        const el = document.activeElement;
        const isEditable = el && (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          (el as HTMLElement).isContentEditable
        );
        if (!isEditable) {
          e.preventDefault();
          handleToggleSelectionMode();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleSelectionMode]);

  // Base list with only ownership filter (for smart folder counts)
  const ownershipFilteredContacts = useMemo(() => {
    if (!company || ownershipFilter === "all") return contacts;
    return contacts.filter((c) =>
      ownershipFilter === "shared" ? c.isShared : !c.isShared
    );
  }, [contacts, company, ownershipFilter]);

  // Calculate contact count per folder - regular from folderId; smart folders show count from active search results
  const contactCountByFolder = useMemo(() => {
    const folderDirectoryType = new Map(allFolders.map((f) => [f.id, f.directoryType]));
    const smartFolderIds = new Set(
      allFolders
        .filter(
          (f) =>
            f.directoryType === "contacts" &&
            (f.isSmartFolder ||
              !!f.savedSearchQuery?.trim() ||
              (f.filterCriteria && typeof f.filterCriteria === "object" && Object.keys(f.filterCriteria).length > 0))
        )
        .map((f) => f.id)
    );
    const counts: Record<string, number> = {};
    for (const c of contacts) {
      if (!c.folderId || smartFolderIds.has(c.folderId)) continue;
      const dirType = folderDirectoryType.get(c.folderId);
      if (dirType === "clients" && !c.isClient) continue;
      counts[c.folderId] = (counts[c.folderId] || 0) + 1;
    }
    // Team folders count from teamContacts (separate data source)
    for (const tc of teamContacts) {
      if (tc.folderId && folderDirectoryType.get(tc.folderId) === "team") {
        counts[tc.folderId] = (counts[tc.folderId] || 0) + 1;
      }
    }
    for (const folder of allFolders) {
      const hasSavedQuery = !!folder.savedSearchQuery?.trim();
      const hasFilterCriteria =
        folder.filterCriteria &&
        typeof folder.filterCriteria === "object" &&
        Object.keys(folder.filterCriteria).length > 0;
      const isSmart = folder.isSmartFolder || hasFilterCriteria || hasSavedQuery;
      if (folder.directoryType === "contacts") {
        if (isSmart && hasSavedQuery) {
          counts[folder.id] = folder.id === selectedFolderId ? filteredContacts.length : 0;
        } else if (isSmart && hasFilterCriteria && !hasSavedQuery) {
          const matchesFilter = applySearchFiltersToContacts(
            ownershipFilteredContacts,
            folder.filterCriteria
          );
          counts[folder.id] = matchesFilter.length;
        }
      } else if (folder.directoryType === "clients" && isSmart && hasSavedQuery) {
        counts[folder.id] = clientView !== null && selectedClientFolderId === folder.id ? filteredContacts.length : 0;
      } else if (folder.directoryType === "team" && isSmart && hasSavedQuery) {
        counts[folder.id] = showDirectory && selectedTeamFolderId === folder.id ? filteredContacts.length : 0;
      } else if (folder.directoryType === "org" && isSmart && hasSavedQuery) {
        counts[folder.id] = orgView !== null && selectedOrgFolderId === folder.id ? filteredContacts.length : 0;
      }
    }
    return counts;
  }, [contacts, teamContacts, allFolders, ownershipFilteredContacts, selectedFolderId, selectedClientFolderId, selectedTeamFolderId, selectedOrgFolderId, clientView, showDirectory, orgView, filteredContacts.length]);

  // Contact folders that accept moving contacts (exclude smart folders)
  const contactFoldersForMove = useMemo(
    () => [...folders, ...organizationFolders].filter((f) => !f.isSmartFolder),
    [folders, organizationFolders]
  );
  const orgFoldersForMove = useMemo(
    () => [...orgFolders, ...organizationOrgFolders].filter((f) => !f.isSmartFolder),
    [orgFolders, organizationOrgFolders]
  );

  // Memoize update folder handlers to avoid creating new functions on every render
  // Create a contact lookup map for O(1) access instead of O(n) find()
  const contactMap = useMemo(() => 
    new Map(contacts.map(c => [c.id, c])),
    [contacts]
  );

  const handleUpdateFolder = useCallback((contactId: string, folderId: string | null) => {
    const contact = contactMap.get(contactId);
    if (contact) {
      updateContact({ ...contact, folderId: folderId || undefined });
    }
  }, [contactMap, updateContact]);

  // For team directory - need to check both filteredContacts and filteredTeamContacts; fall back to contactMap for sidebar drops
  const handleUpdateTeamFolder = useCallback((contactId: string, folderId: string | null) => {
    const contact =
      (searchQuery ? filteredContacts : filteredTeamContacts).find((c) => c.id === contactId) ??
      contactMap.get(contactId);
    if (contact) {
      updateContact({ ...contact, folderId: folderId || undefined });
    }
  }, [searchQuery, filteredContacts, filteredTeamContacts, contactMap, updateContact]);

  // Single handler for sidebar drag-and-drop: route to contact or team updater based on target folder
  const handleMoveContactToFolder = useCallback((contactId: string, folderId: string | null) => {
    if (!folderId) {
      handleUpdateFolder(contactId, null);
      return;
    }
    const isTeamFolder = [...teamFolders, ...organizationTeamFolders].some((f) => f.id === folderId);
    if (isTeamFolder) {
      handleUpdateTeamFolder(contactId, folderId);
    } else {
      handleUpdateFolder(contactId, folderId);
    }
  }, [handleUpdateFolder, handleUpdateTeamFolder, teamFolders, organizationTeamFolders]);

  const handleSaveContact = (contactData: Omit<Contact, "id">) => {
    if (editingContact) {
      updateContact({ ...contactData, id: editingContact.id });
    } else {
      addContact(contactData);
    }
    setEditingContact(null);
  };

  const handleOpenAddDialog = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const handleOpenProfile = () => {
    setProfileEditorOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleViewContact = async (contact: Contact) => {
    // Fetch full contact from DB so we always have address and other fields (lists like smart search may omit them)
    const full = await getContactById(contact.id);
    if (full) {
      updateContactInListCache(full); // keep grid in sync so card health matches detail view
    }
    const contactToView: Contact | null = full ?? contact;
    setViewingContact(contactToView);
    setDetailsDialogOpen(true);
  };

  const handleDeleteFromDetails = () => {
    if (viewingContact) {
      deleteContact(viewingContact.id);
      setDetailsDialogOpen(false);
      setViewingContact(null);
      toast.success(`Deleted ${viewingContact.name}`);
    }
  };

  const handleEditFromDetails = () => {
    // Edit mode is now handled within ContactDetailsDialog
    // No action needed here - the dialog manages its own edit state
  };

  const handleSaveContactFromDetails = (updatedContact: Contact) => {
    updateContact(updatedContact);
    setViewingContact(updatedContact); // Keep in sync so toggle and badges update immediately
    toast.success(`Updated ${updatedContact.name}`);
  };

  const handleImportContacts = async (contacts: Omit<Contact, "id">[]) => {
    if (contacts.length === 0) {
      return;
    }

    // Use bulk insert Edge Function for multiple contacts
    if (contacts.length > 1) {
      try {
        // Normalize contact data - convert empty strings to null for optional fields
        const normalizedContacts = contacts.map((c) => ({
          ...c,
          email: c.email?.trim() || null,
          phone: c.phone?.trim() || null,
          company: c.company?.trim() || null,
          role: c.role?.trim() || null,
        }));

        // Chunk contacts into batches to avoid ERR_INSUFFICIENT_RESOURCES
        const BATCH_SIZE = 50; // Smaller batches to prevent memory issues
        const batches: typeof normalizedContacts[] = [];
        for (let i = 0; i < normalizedContacts.length; i += BATCH_SIZE) {
          batches.push(normalizedContacts.slice(i, i + BATCH_SIZE));
        }

        console.log(`Importing ${normalizedContacts.length} contacts in ${batches.length} batches`);

        let totalInserted = 0;
        let totalMerged = 0;
        let totalSkipped = 0;
        const allErrors: string[] = [];

        // Refresh session once so we have a valid token for all batches (avoids gateway 401 with verify_jwt)
        await supabase.auth.refreshSession();

        // Process batches sequentially to avoid overwhelming the browser
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} contacts)`);
          
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
              throw new Error("Not authenticated");
            }
            const token = typeof session.access_token === "string" ? session.access_token : null;
            if (!token) {
              throw new Error("Invalid session token");
            }

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
            
            const resp = await fetch(`${supabaseUrl}/functions/v1/bulk-insert-contacts`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ 
                jwt: token,
                contacts: batch,
                isShared: false,
              }),
            });

            const data = await resp.json().catch(() => ({}));
            
            if (!resp.ok) {
              const errorMsg = data.error || data.message || `HTTP ${resp.status}`;
              console.error(`Batch ${i + 1} error (${resp.status}):`, errorMsg, data);
              allErrors.push(`Batch ${i + 1}: ${errorMsg}`);
              // Add delay before continuing to avoid rate limits
              if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              continue;
            }

            if (!data.success) {
              console.error(`Batch ${i + 1} failed:`, data.error);
              allErrors.push(`Batch ${i + 1}: ${data.error || "Unknown error"}`);
              if (data.errors) {
                allErrors.push(...data.errors);
              }
              // Add delay before continuing
              if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              continue;
            }

            totalInserted += data.inserted || 0;
            totalMerged += data.merged || 0;
            totalSkipped += data.skipped || 0;
            console.log(`Batch ${i + 1} completed: ${data.inserted || 0} inserted, ${data.merged || 0} merged, ${data.skipped || 0} skipped`);
            
            // Add a small delay between batches to avoid rate limiting and give the database time to process
            // Longer delay after every 5 batches to prevent timeouts
            if (i < batches.length - 1) {
              const delay = (i + 1) % 5 === 0 ? 2000 : 500; // 2 second delay every 5 batches, 500ms otherwise
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            console.error(`Batch ${i + 1} exception:`, err);
            allErrors.push(`Batch ${i + 1}: ${errorMsg}`);
            // Add delay before continuing
            if (i < batches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            continue;
          }
        }

        // Invalidate queries to refresh the contact list
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });

        const totalProcessed = totalInserted + totalMerged + totalSkipped;
        if (totalProcessed === 0) {
          throw new Error(`Failed to import any contacts. ${allErrors.length > 0 ? `Errors: ${allErrors.join("; ")}` : ""}`);
        }

        const errorMsg = allErrors.length > 0 
          ? ` (${allErrors.length} batch error${allErrors.length > 1 ? "s" : ""} occurred)` 
          : "";
        
        // Build success message: new inserts and/or merged/skipped (duplicates)
        const duplicateCount = totalMerged + totalSkipped;
        let successMsg: string;
        if (totalInserted > 0 && duplicateCount > 0) {
          successMsg = `Imported ${totalInserted} new, ${duplicateCount} merged with existing`;
        } else if (totalInserted > 0) {
          successMsg = `Imported ${totalInserted} contact${totalInserted !== 1 ? "s" : ""}`;
        } else {
          successMsg = `${normalizedContacts.length} contact${normalizedContacts.length !== 1 ? "s" : ""} synced (merged with existing)`;
        }
        successMsg += errorMsg;
        
        toast.success(successMsg);
      } catch (error) {
        console.error("Bulk import error:", error);
        const message = error instanceof Error ? error.message : "Failed to import contacts";
        console.error("Error details:", error);
        toast.error(message);
        // Skip fallback on auth or "no contacts" errors (avoid 198 parallel requests and ERR_INSUFFICIENT_RESOURCES)
        const skipFallback = typeof message === "string" && (
          message.includes("401") ||
          message.includes("Invalid JWT") ||
          message.includes("Unauthorized") ||
          message.includes("Not authenticated") ||
          message.includes("Failed to import any contacts")
        );
        if (!skipFallback && normalizedContacts.length > 0) {
          console.log("Falling back to individual inserts...");
          normalizedContacts.forEach((contact) => addContact(contact));
        }
      }
    } else {
      // Single contact - use regular add
      addContact(contacts[0]);
      toast.success("Contact imported");
    }
  };

  const handleContactsImported = useCallback(() => {
    // Invalidate the contacts query to refresh the list
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  }, [queryClient]);

  return (
        <ContactDragProvider>
        <HealthClockProvider>
        <div className="h-screen bg-background flex w-full overflow-hidden">
          {/* Folder Sidebar */}
          <FolderSidebar
            folders={folders}
            organizationFolders={organizationFolders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={handleSelectFolder}
            onAddFolder={addFolder}
            onUpdateFolder={updateFolder}
            onDeleteFolder={deleteFolder}
            onMoveContactToFolder={handleMoveContactToFolder}
            contactCountByFolder={contactCountByFolder}
            totalContacts={totalCount}
            trashCount={trashCount}
            showTrash={showTrash}
            onSelectTrash={handleSelectTrash}
            companyMembers={teamContacts}
            showDirectory={showDirectory}
            onSelectDirectory={company ? handleSelectDirectory : undefined}
            hasCompany={!!company}
            ownershipFilter={ownershipFilter}
            onOwnershipFilterChange={setOwnershipFilter}
            personalContactsCount={personalContactsCount}
            sharedContactsCount={sharedContactsCount}
            showClientDirectory={clientView !== null}
            onSelectClientDirectory={handleSelectClientDirectory}
            clientDirectoryCount={clientCount}
            clientFolders={clientFolders}
            organizationClientFolders={organizationClientFolders}
            selectedClientFolderId={selectedClientFolderId}
            onSelectClientFolder={setSelectedClientFolderId}
            showOrgDirectory={orgView !== null}
            onSelectOrgDirectory={company ? handleSelectOrgDirectory : undefined}
            orgDirectoryCount={sharedContactsCount}
            orgFolders={orgFolders}
            organizationOrgFolders={organizationOrgFolders}
            selectedOrgFolderId={selectedOrgFolderId}
            onSelectOrgFolder={setSelectedOrgFolderId}
            teamFolders={teamFolders}
            organizationTeamFolders={organizationTeamFolders}
            selectedTeamFolderId={selectedTeamFolderId}
            onSelectTeamFolder={setSelectedTeamFolderId}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
          />

          {/* Main Content */}
          <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto h-screen">
            <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-12">
              <Header 
                contactCount={totalCount} 
                onOpenAddDialog={handleOpenAddDialog}
                onOpenProfile={handleOpenProfile}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenHelp={() => setSupportDialogOpen(true)}
                onOpenImport={(tab) => {
                  setImportDefaultTab(tab);
                  setImportDialogOpen(true);
                }}
                onContactsImported={handleContactsImported}
              />
              
              <div className="mb-4 sm:mb-6 md:mb-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleSelectionMode}
                  className="shrink-0 w-full sm:w-auto sm:min-w-[160px]"
                >
                  <span>{selectionMode ? "Cancel" : "Select"}</span>
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs opacity-80 font-normal">
                    <span>⌘</span>
                    <span>⇧</span>
                    <span>S</span>
                  </span>
                </Button>
                <div className="flex-1 min-w-0">
                  <SearchBar
                    value={searchQuery}
                    onChange={(next) => {
                      setSearchQuery(next);
                      if (next.trim()) {
                        if (clientView === "overview" || clientView === "outreach") {
                          setClientView("directory");
                        }
                        if (orgView === "overview" || orgView === "outreach") {
                          setOrgView("directory");
                        }
                      }
                    }}
                    onEnter={() => {
                      if (clientView === "overview" || clientView === "outreach") {
                        setClientView("directory");
                      }
                      if (orgView === "overview" || orgView === "outreach") {
                        setOrgView("directory");
                      }
                    }}
                    placeholder="Try 'Who handles marketing?' or 'email sarah'..."
                    isLoading={searchLoading}
                  />
                </div>
              </div>

              {searchQuery && (
                <div className="mb-6 animate-fade-in">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">"{searchQuery.trim()}"</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {searchLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Understanding your question...
                        </span>
                      ) : (
                        buildFriendlySearchSummary({
                          count: filteredContacts.length,
                          action,
                          filters: understoodFilters,
                          roleLabel: understoodRoleLabel,
                          isTruncated,
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Selection toolbar - appears below search bar in all directories and trash */}
              {selectionMode && (() => {
                const currentContacts = showTrash
                  ? trashedContacts
                  : showDirectory 
                    ? (searchQuery ? filteredContacts : filteredTeamContacts)
                    : filteredContacts;
                const allSelected = currentContacts.length > 0 && currentContacts.every(c => selectedContactIds.has(c.id));
                
                return (
                  <SelectionToolbar
                    selectedCount={selectedContactIds.size}
                    allSelected={allSelected}
                    onSelectAll={handleSelectAll}
                    onBulkDelete={!showTrash ? handleBulkDelete : undefined}
                    onBulkMoveToFolder={!showTrash ? handleBulkMoveToFolder : undefined}
                    onBulkMarkContacted={!showTrash ? handleBulkMarkContacted : undefined}
                    onBulkToggleClient={!showTrash ? handleBulkToggleClient : undefined}
                    onBulkShare={!showTrash ? handleBulkShare : undefined}
                    onBulkRestore={showTrash ? handleBulkRestore : undefined}
                    hasClientAccess={hasClientAccess}
                    hasCompany={!!company}
                    folders={showDirectory ? teamFolders : clientView !== null ? [...clientFolders, ...organizationClientFolders] : contactFoldersForMove}
                    selectedContactIds={selectedContactIds}
                    onToggleSelectionMode={handleToggleSelectionMode}
                    isTrashView={showTrash}
                  />
                );
              })()}

              {appUpdate && (
                <AppUpdateDialog
                  update={appUpdate}
                  isDownloading={isUpdateDownloading}
                  downloadProgress={updateProgress}
                  onDownload={downloadAndInstall}
                  onDismiss={dismissUpdate}
                />
              )}

              {showDirectory ? (
                <>
                  <div className="mb-6">
                    <h2 className="text-xl sm:text-2xl font-display font-semibold">Internal Directory</h2>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base break-words">
                      {company?.name} • {searchQuery ? filteredContacts.length : filteredTeamContacts.length} member{(searchQuery ? filteredContacts.length : filteredTeamContacts.length) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <TeamDirectoryGrid 
                    members={searchQuery ? filteredContacts : filteredTeamContacts}
                    searchQuery={searchQuery}
                    action={action}
                    onEditContact={handleEditContact}
                    onViewContact={handleViewContact}
                    onDeleteContact={deleteContact}
                    folders={teamFolders}
                    onUpdateFolder={handleUpdateTeamFolder}
                    showOwnershipBadge={!!company}
                    onMarkContacted={updateLastContacted}
                    selectedContactIds={selectedContactIds}
                    onSelectContact={handleSelectContact}
                    onSelectAll={handleSelectAll}
                    onBulkDelete={handleBulkDelete}
                    onBulkMoveToFolder={handleBulkMoveToFolder}
                    onBulkMarkContacted={handleBulkMarkContacted}
                    onBulkToggleClient={handleBulkToggleClient}
                    hasClientAccess={hasClientAccess}
                    selectionMode={selectionMode}
                    onToggleSelectionMode={handleToggleSelectionMode}
                    interactionCounts={interactionCounts}
                  />
                </>
              ) : clientView !== null ? (
                <ClientDashboard
                  contacts={filteredContacts}
                  allClientContacts={clientDirectoryContacts}
                  searchQuery={searchQuery}
                  action={action}
                  clientSortOption={clientSortOption}
                  onClientSortChange={(v) => setClientSortOption(v as ClientSortOption)}
                  activeTab={clientView}
                  onTabChange={setClientView}
                  onEditContact={handleEditContact}
                  onViewContact={handleViewContact}
                  onDeleteContact={deleteContact}
                  onRestoreContact={restoreContact}
                  onPermanentlyDelete={permanentlyDeleteContact}
                  onEmptyTrash={emptyTrash}
                  folders={[...clientFolders, ...organizationClientFolders]}
                  onUpdateFolder={handleUpdateFolder}
                  showOwnershipBadge={!!company}
                  onMarkContacted={updateLastContacted}
                  onToggleClient={(id, isClient) => toggleClientStatus({ id, isClient })}
                  selectedContactIds={selectedContactIds}
                  onSelectContact={handleSelectContact}
                  onSelectAll={handleSelectAll}
                  onBulkDelete={handleBulkDelete}
                  onBulkMoveToFolder={handleBulkMoveToFolder}
                  onBulkToggleClient={handleBulkToggleClient}
                  onBulkMarkContacted={handleBulkMarkContacted}
                  hasClientAccess={hasClientAccess}
                  selectionMode={selectionMode}
                  onToggleSelectionMode={handleToggleSelectionMode}
                  interactionCounts={interactionCounts}
                />
              ) : orgView !== null ? (
                <OrganizationDashboard
                  contacts={filteredContacts}
                  allSharedContacts={orgDirectoryContacts}
                  searchQuery={searchQuery}
                  action={action}
                  orgSortOption={orgSortOption}
                  onOrgSortChange={(v) => setOrgSortOption(v as OrgSortOption)}
                  activeTab={orgView}
                  onTabChange={setOrgView}
                  onEditContact={handleEditContact}
                  onViewContact={handleViewContact}
                  onDeleteContact={deleteContact}
                  onRestoreContact={restoreContact}
                  onPermanentlyDelete={permanentlyDeleteContact}
                  onEmptyTrash={emptyTrash}
                  folders={orgFoldersForMove}
                  onUpdateFolder={handleUpdateFolder}
                  showOwnershipBadge={!!company}
                  onMarkContacted={updateLastContacted}
                  onToggleClient={(id, isClient) => toggleClientStatus({ id, isClient })}
                  selectedContactIds={selectedContactIds}
                  onSelectContact={handleSelectContact}
                  onSelectAll={handleSelectAll}
                  onBulkDelete={handleBulkDelete}
                  onBulkMoveToFolder={handleBulkMoveToFolder}
                  onBulkToggleClient={handleBulkToggleClient}
                  onBulkMarkContacted={handleBulkMarkContacted}
                  hasClientAccess={hasClientAccess}
                  selectionMode={selectionMode}
                  onToggleSelectionMode={handleToggleSelectionMode}
                  interactionCounts={interactionCounts}
                />
              ) : (
                <ContactGrid
                  contacts={filteredContacts}
                  searchQuery={searchQuery}
                  action={showTrash ? undefined : action}
                  onEditContact={handleEditContact}
                  onViewContact={handleViewContact}
                  isTrashView={showTrash}
                  trashCount={showTrash ? trashCount : undefined}
                  onDeleteContact={deleteContact}
                  onRestoreContact={restoreContact}
                  onPermanentlyDelete={permanentlyDeleteContact}
                  onEmptyTrash={emptyTrash}
                  onUpdateFolder={handleUpdateFolder}
                  showOwnershipBadge={!!company}
                  onMarkContacted={updateLastContacted}
                  onToggleClient={(id, isClient) => toggleClientStatus({ id, isClient })}
                  selectedContactIds={selectedContactIds}
                  onSelectContact={handleSelectContact}
                  onSelectAll={handleSelectAll}
                  onBulkDelete={handleBulkDelete}
                  onBulkMoveToFolder={handleBulkMoveToFolder}
                  onBulkToggleClient={handleBulkToggleClient}
                  onBulkMarkContacted={handleBulkMarkContacted}
                  hasClientAccess={hasClientAccess}
                  selectionMode={selectionMode}
                  onToggleSelectionMode={handleToggleSelectionMode}
                  showSampleContact={needsOnboarding && !needsCompanySetup}
                  hasMore={hasMoreContacts}
                  onLoadMore={loadMoreContacts}
                  isLoadingMore={isLoadingMoreContacts}
                  folders={contactFoldersForMove}
                  interactionCounts={interactionCounts}
                />
              )}

              <ContactFormDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open);
                  // Clear editingContact when dialog closes
                  // handleSaveContact already clears it on save, so this handles cancel/close
                  if (!open && editingContact) {
                    setEditingContact(null);
                  }
                }}
                onSave={handleSaveContact}
                contact={editingContact}
                presetKeywords={keywords}
                folders={contactFoldersForMove}
                defaultFolderId={selectedFolderId}
                hasCompany={!!company}
              />

              <ProfileEditorDialog
                open={profileEditorOpen}
                onOpenChange={setProfileEditorOpen}
              />

              <ContactDetailsDialog
                open={detailsDialogOpen}
                onOpenChange={(open) => {
                  setDetailsDialogOpen(open);
                  if (!open) {
                    setViewingContact(null);
                  }
                }}
                contact={viewingContact}
                folder={viewingContact?.folderId ? contactFoldersForMove.find(f => f.id === viewingContact.folderId) : undefined}
                folders={contactFoldersForMove}
                presetKeywords={keywords}
                showOwnershipBadge={!!company}
                hasCompany={!!company}
                onEdit={handleEditFromDetails}
                onSave={handleSaveContactFromDetails}
                onDelete={handleDeleteFromDetails}
                interactionCounts={interactionCounts}
              />

              <SettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                keywords={keywords}
                onAddKeyword={addKeyword}
                onRemoveKeyword={removeKeyword}
                onResetKeywords={resetToDefaults}
                isCompanyKeywords={isCompanyKeywords}
                canEditKeywords={canEditKeywords}
              />

              <ContactSupportDialog
                open={supportDialogOpen}
                onOpenChange={setSupportDialogOpen}
              />

              <ImportContactsDialog
                open={importDialogOpen}
                onOpenChange={(open) => {
                  setImportDialogOpen(open);
                  if (!open) setImportDefaultTab(undefined);
                }}
                onImport={handleImportContacts}
                defaultTab={importDefaultTab}
                folders={folders}
                presetKeywords={keywords}
                defaultFolderId={selectedFolderId}
              />

              <CompanySetupDialog
                open={needsCompanySetup}
                onCreateCompany={createCompany}
                onJoinCompany={joinCompany}
                onSkipCompanySetup={skipCompanySetup}
              />

              <CreateOrganizationAfterUpgradeDialog
                open={showCreateOrgAfterUpgrade}
                onCreateCompany={createCompany}
                onDismiss={dismissCreateOrgPrompt}
                isCreating={isCreatingCompany}
              />

              {showOnboarding && (
                <OnboardingTutorial
                  steps={onboardingSteps}
                  onComplete={() => {
                    completeOnboarding();
                    setShowOnboarding(false);
                  }}
                  onSkip={() => {
                    completeOnboarding();
                    setShowOnboarding(false);
                  }}
                />
              )}
            </div>
          </div>
        </div>
        </HealthClockProvider>
        </ContactDragProvider>
  );
};

const Index = () => {
  return (
    <SidebarProvider>
      <IndexContent />
    </SidebarProvider>
  );
};

export default Index;
