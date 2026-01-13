import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  DragOverEvent,
} from "@dnd-kit/core";
import type { Modifier } from "@dnd-kit/core";

import { useSearchParams } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { ContactGrid } from "@/components/ContactGrid";
import { Header } from "@/components/Header";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { ContactDetailsDialog } from "@/components/ContactDetailsDialog";
import { ProfileEditorDialog } from "@/components/ProfileEditorDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { FolderSidebar } from "@/components/FolderSidebar";
import { DragPreview } from "@/components/DragPreview";
import { TeamDirectoryGrid } from "@/components/TeamDirectoryGrid";
import { ImportContactsDialog } from "@/components/ImportContactsDialog";
import { CompanySetupDialog } from "@/components/CompanySetupDialog";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import { useContacts } from "@/hooks/useContacts";
import { useFolders } from "@/hooks/useFolders";
import { useCustomKeywords } from "@/hooks/useCustomKeywords";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTeamDirectoryContacts } from "@/hooks/useTeamDirectoryContacts";
import { Contact, ContactOwnershipFilter } from "@/types/contact";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ClientSortOption = "oldest-contacted" | "newest-contacted" | "oldest-added" | "newest-added";

// Center the drag preview on the cursor with a small vertical offset for better visibility
// This ensures the preview follows the mouse accurately regardless of where the user initially clicked
const centerOnCursor: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => {
  if (!activatorEvent || !activeNodeRect || !overlayNodeRect) return transform;

  // Get the initial click position in window coordinates
  let initialClientX = 0;
  let initialClientY = 0;
  
  if ("touches" in activatorEvent) {
    const te = activatorEvent as TouchEvent;
    const t = te.touches?.[0] ?? te.changedTouches?.[0];
    if (t) {
      initialClientX = t.clientX;
      initialClientY = t.clientY;
    }
  } else if ("clientX" in activatorEvent && "clientY" in activatorEvent) {
    const e = activatorEvent as MouseEvent;
    initialClientX = e.clientX;
    initialClientY = e.clientY;
  }

  // Calculate where the cursor was relative to the original card when dragging started
  const initialX = initialClientX - activeNodeRect.left;
  const initialY = initialClientY - activeNodeRect.top;

  // The default transform maintains the grab point at initialX from the left edge.
  // We want to center the preview, so we need to shift it.
  //
  // Current behavior: overlay left edge = activeNodeRect.left + transform.x
  //                   cursor position relative to overlay = initialX
  //
  // Desired behavior: overlay center = cursor position
  //                   So: overlay left edge = cursor position - overlayNodeRect.width / 2
  //
  // The transform.x currently positions the overlay so:
  //   activeNodeRect.left + transform.x + initialX = cursor position (at drag start)
  //
  // We want:
  //   activeNodeRect.left + transform.x + centerOffsetX + overlayNodeRect.width / 2 = cursor position
  //
  // So: transform.x + centerOffsetX + overlayNodeRect.width / 2 = transform.x + initialX
  //     centerOffsetX = initialX - overlayNodeRect.width / 2
  
  const centerOffsetX = initialX - (overlayNodeRect.width / 2);
  
  // Small vertical offset above cursor for better visibility
  const topOffsetY = 15 - initialY;

  return {
    ...transform,
    x: transform.x + centerOffsetX,
    y: transform.y + topOffsetY,
  };
};

const Index = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { needsCompanySetup, createCompany, joinCompany, skipCompanySetup, company, isAdmin, isSuperAdmin } = useProfile(user?.id);
  const { teamContacts, isLoading: teamContactsLoading, refetch: refetchTeamContacts } = useTeamDirectoryContacts();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"quick" | "full">("full");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importDefaultTab, setImportDefaultTab] = useState<string | undefined>(undefined);
  const [showTrash, setShowTrash] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [showClientDirectory, setShowClientDirectory] = useState(false);
  const [ownershipFilter, setOwnershipFilter] = useState<ContactOwnershipFilter>("all");
  const [clientSortOption, setClientSortOption] = useState<ClientSortOption>("oldest-contacted");
  const [selectedClientFolderId, setSelectedClientFolderId] = useState<string | null>(null);
  const [selectedTeamFolderId, setSelectedTeamFolderId] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Refetch team contacts when directory becomes visible or team folder is selected
  useEffect(() => {
    if (showDirectory || selectedTeamFolderId !== null) {
      refetchTeamContacts();
    }
  }, [showDirectory, selectedTeamFolderId, refetchTeamContacts]);
  const { 
    contacts, 
    trashedContacts,
    isLoading: contactsLoading, 
    addContact, 
    updateContact,
    deleteContact,
    restoreContact,
    permanentlyDeleteContact,
    emptyTrash,
    updateLastContacted,
    toggleClientStatus,
    totalCount,
    bulkDeleteContacts,
  } = useContacts();
  const { 
    folders, 
    organizationFolders, 
    clientFolders, 
    organizationClientFolders, 
    teamFolders, 
    organizationTeamFolders, 
    addFolder, 
    updateFolder, 
    deleteFolder 
  } = useFolders();
  const { keywords, addKeyword, removeKeyword, resetToDefaults, isCompanyKeywords, canEditKeywords } = useCustomKeywords();

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

  // Filter contacts by folder and ownership
  const folderFilteredContacts = useMemo(() => {
    if (showTrash) return trashedContacts;
    
    let filtered = contacts;
    
    // Apply ownership filter for company users
    if (company && ownershipFilter !== "all") {
      filtered = filtered.filter(c => 
        ownershipFilter === "shared" ? c.isShared : !c.isShared
      );
    }
    
    // Apply folder filter
    if (selectedFolderId !== null) {
      filtered = filtered.filter(c => c.folderId === selectedFolderId);
    }
    
    return filtered;
  }, [contacts, trashedContacts, selectedFolderId, showTrash, ownershipFilter, company]);

  // Calculate personal/shared counts
  const personalContactsCount = useMemo(() => 
    contacts.filter(c => !c.isShared).length, [contacts]);
  const sharedContactsCount = useMemo(() => 
    contacts.filter(c => c.isShared).length, [contacts]);

  // Client directory: only clients, sorted based on selected sort option
  const clientDirectoryContacts = useMemo(() => {
    const clientsOnly = contacts.filter(c => c.isClient);
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
  }, [contacts, clientSortOption]);

  // Count of clients for sidebar
  const clientCount = useMemo(() => contacts.filter(c => c.isClient).length, [contacts]);

  // Filtered team contacts: filter by selectedTeamFolderId when a team folder is selected
  const filteredTeamContacts = useMemo(() => {
    if (selectedTeamFolderId !== null) {
      return teamContacts.filter(c => c.folderId === selectedTeamFolderId);
    }
    return teamContacts;
  }, [teamContacts, selectedTeamFolderId]);

  const { contacts: filteredContacts, action, searchTerm, isLoading: searchLoading, aiIntent, interpretation } = useSmartSearch(
    showDirectory ? filteredTeamContacts : (showClientDirectory ? clientDirectoryContacts : folderFilteredContacts), 
    searchQuery
  );

  const handleSelectTrash = () => {
    setShowTrash(true);
    setShowDirectory(false);
    setShowClientDirectory(false);
    setSelectedFolderId(null);
  };

  const handleSelectFolder = (folderId: string | null) => {
    setShowTrash(false);
    setShowDirectory(false);
    setShowClientDirectory(false);
    setSelectedFolderId(folderId);
  };

  const handleSelectDirectory = () => {
    setShowDirectory(true);
    setShowTrash(false);
    setShowClientDirectory(false);
    setSelectedFolderId(null);
    setSelectedTeamFolderId(null);
    // Refetch team contacts to ensure we have the latest data
    refetchTeamContacts();
  };

  const handleSelectClientDirectory = () => {
    setShowClientDirectory(true);
    setShowDirectory(false);
    setShowTrash(false);
    setSelectedFolderId(null);
  };

  // Selection handlers (defined after filteredContacts)
  const handleSelectContact = (id: string, selected: boolean) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      // Use filteredContacts which contains the currently visible contacts
      setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
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

  const handleToggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    if (selectionMode) {
      setSelectedContactIds(new Set());
    }
  };

  // Calculate contact count per folder
  const contactCountByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    contacts.forEach(c => {
      if (c.folderId) {
        counts[c.folderId] = (counts[c.folderId] || 0) + 1;
      }
    });
    return counts;
  }, [contacts]);


  // Track which folder is being hovered during drag
  const [overId, setOverId] = useState<string | null>(null);

  // Configure drag sensors with activation constraints
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // Require 8px movement before starting drag
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200, // 200ms hold before drag starts on touch
      tolerance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);

  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  const handleDragStart = (event: DragStartEvent) => {
    const contact = event.active.data.current?.contact as Contact | undefined;
    if (contact) {
      setActiveContact(contact);
      // Add haptic feedback for touch devices
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id;
    setOverId(overId ? String(overId) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveContact(null);
    setOverId(null);

    const { active, over } = event;
    if (!over) return;

    const contact = active.data.current?.contact as Contact | undefined;
    const targetFolderId = over.data.current?.folderId as string | null | undefined;
    const isAllContacts = over.data.current?.isAllContacts as boolean | undefined;

    if (!contact) return;

    // Determine the new folderId: if dropped on All Contacts, remove from folder (null)
    const newFolderId = isAllContacts ? null : targetFolderId;

    // If dropped on the same folder, do nothing
    if (contact.folderId === newFolderId) return;
    if (!contact.folderId && newFolderId === null) return;

    // Update the contact's folder
    updateContact({
      ...contact,
      folderId: newFolderId || undefined,
    });

    const folderName = newFolderId
      ? folders.find((f) => f.id === newFolderId)?.name
      : "All Contacts";
    
    const message = newFolderId
      ? `Moved "${contact.name}" to ${folderName}`
      : `Removed "${contact.name}" from folder`;
    toast.success(message);

    // Success haptic
    if (navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }
  };

  const handleDragCancel = () => {
    setActiveContact(null);
    setOverId(null);
  };

  const handleSaveContact = (contactData: Omit<Contact, "id">) => {
    if (editingContact) {
      updateContact({ ...contactData, id: editingContact.id });
    } else {
      addContact(contactData);
    }
    setEditingContact(null);
  };

  const handleOpenAddDialog = (mode: "quick" | "full" = "full") => {
    setEditingContact(null);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const handleOpenProfile = () => {
    setProfileEditorOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleViewContact = (contact: Contact) => {
    setViewingContact(contact);
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

        // Process batches sequentially to avoid overwhelming the browser
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} contacts)`);
          
          try {
            // Use direct fetch to get better error details
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              throw new Error("Not authenticated");
            }

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
            
            const resp = await fetch(`${supabaseUrl}/functions/v1/bulk-insert-contacts`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ 
                contacts: batch,
                isShared: false,
              }),
            });

            const data = await resp.json().catch(() => ({}));
            
            if (!resp.ok) {
              const errorMsg = data.error || data.message || `HTTP ${resp.status}`;
              console.error(`Batch ${i + 1} error (${resp.status}):`, errorMsg, data);
              allErrors.push(`Batch ${i + 1}: ${errorMsg}`);
              continue;
            }

            if (!data.success) {
              console.error(`Batch ${i + 1} failed:`, data.error);
              allErrors.push(`Batch ${i + 1}: ${data.error || "Unknown error"}`);
              if (data.errors) {
                allErrors.push(...data.errors);
              }
              continue;
            }

            totalInserted += data.inserted || 0;
            totalMerged += data.merged || 0;
            totalSkipped += data.skipped || 0;
            console.log(`Batch ${i + 1} completed: ${data.inserted || 0} inserted, ${data.merged || 0} merged, ${data.skipped || 0} skipped`);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            console.error(`Batch ${i + 1} exception:`, err);
            allErrors.push(`Batch ${i + 1}: ${errorMsg}`);
            continue;
          }
        }

        // Invalidate queries to refresh the contact list
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });

        if (totalInserted === 0) {
          throw new Error(`Failed to import any contacts. ${allErrors.length > 0 ? `Errors: ${allErrors.join("; ")}` : ""}`);
        }

        const errorMsg = allErrors.length > 0 
          ? ` (${allErrors.length} batch error${allErrors.length > 1 ? "s" : ""} occurred)` 
          : "";
        
        // Build success message with details
        let successMsg = `Imported ${totalInserted} of ${normalizedContacts.length} contacts`;
        const duplicateCount = totalMerged + totalSkipped;
        if (duplicateCount > 0) {
          const parts: string[] = [];
          if (totalMerged > 0) {
            parts.push(`${totalMerged} merged`);
          }
          if (totalSkipped > 0) {
            parts.push(`${totalSkipped} skipped`);
          }
          successMsg += ` (${parts.join(', ')} duplicate${duplicateCount !== 1 ? 's' : ''})`;
        }
        successMsg += errorMsg;
        
        toast.success(successMsg);
      } catch (error) {
        console.error("Bulk import error:", error);
        const message = error instanceof Error ? error.message : "Failed to import contacts";
        console.error("Error details:", error);
        toast.error(message);
        // Fall back to individual inserts if bulk insert fails
        console.log("Falling back to individual inserts...");
        contacts.forEach((contact) => addContact(contact));
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
    <SidebarProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="min-h-screen bg-background flex w-full overflow-x-hidden">
          {/* Folder Sidebar */}
          <FolderSidebar
            folders={folders}
            organizationFolders={organizationFolders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={handleSelectFolder}
            onAddFolder={addFolder}
            onUpdateFolder={updateFolder}
            onDeleteFolder={deleteFolder}
            contactCountByFolder={contactCountByFolder}
            totalContacts={totalCount}
            trashCount={trashedContacts.length}
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
            showClientDirectory={showClientDirectory}
            onSelectClientDirectory={handleSelectClientDirectory}
            clientDirectoryCount={clientCount}
            clientFolders={clientFolders}
            organizationClientFolders={organizationClientFolders}
            selectedClientFolderId={selectedClientFolderId}
            onSelectClientFolder={setSelectedClientFolderId}
            teamFolders={teamFolders}
            organizationTeamFolders={organizationTeamFolders}
            selectedTeamFolderId={selectedTeamFolderId}
            onSelectTeamFolder={setSelectedTeamFolderId}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
          />

          {/* Main Content */}
          <div className="flex-1 min-w-0 overflow-x-hidden">
            <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-12">
              <Header 
                contactCount={totalCount} 
                onOpenAddDialog={handleOpenAddDialog}
                onOpenProfile={handleOpenProfile}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenImport={(tab) => {
                  setImportDefaultTab(tab);
                  setImportDialogOpen(true);
                }}
                onContactsImported={handleContactsImported}
              />
              
              <div className="mb-4 sm:mb-6 md:mb-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Try 'Who handles marketing?' or 'email sarah'..."
                    isLoading={searchLoading}
                  />
                </div>
                {!showTrash && !showDirectory && !showClientDirectory && (
                  <Button
                    variant={selectionMode ? "default" : "outline"}
                    size="sm"
                    onClick={handleToggleSelectionMode}
                    className="shrink-0 w-full sm:w-auto"
                  >
                    {selectionMode ? "Cancel" : "Select"}
                  </Button>
                )}
              </div>

              {searchQuery && interpretation && (
                <div className="mb-4 px-3 sm:px-4 py-2 bg-muted/50 rounded-lg text-sm text-muted-foreground animate-fade-in">
                  {interpretation}
                </div>
              )}

              {searchQuery && (
                <div className="mb-6 animate-fade-in">
                  <p className="text-sm text-muted-foreground">
                    {searchLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Understanding your question...
                      </span>
                    ) : aiIntent ? (
                      <>
                        <span className="font-medium text-primary">{aiIntent}</span>
                        {action && <> • Ready to <span className="font-medium">{action}</span></>}
                        <> • {filteredContacts.length} result{filteredContacts.length !== 1 ? "s" : ""}</>
                      </>
                    ) : action ? (
                      <>
                        Ready to <span className="font-medium text-primary">{action}</span>
                        {searchTerm && (
                          <> • {filteredContacts.length} result{filteredContacts.length !== 1 ? "s" : ""} for "<span className="font-medium text-foreground">{searchTerm}</span>"</>
                        )}
                      </>
                    ) : (
                      <>
                        Showing {filteredContacts.length} result{filteredContacts.length !== 1 ? "s" : ""} for{" "}
                        <span className="font-medium text-foreground">"{searchQuery}"</span>
                      </>
                    )}
                  </p>
                </div>
              )}

              {showDirectory ? (
                <>
                  <div className="mb-6">
                    <h2 className="text-xl sm:text-2xl font-display font-semibold">Team Directory</h2>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base break-words">
                      {company?.name} • {searchQuery ? filteredContacts.length : filteredTeamContacts.length} member{(searchQuery ? filteredContacts.length : filteredTeamContacts.length) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <TeamDirectoryGrid members={searchQuery ? filteredContacts : filteredTeamContacts} />
                </>
              ) : showClientDirectory ? (
                <>
                  <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl sm:text-2xl font-display font-semibold">Client Directory</h2>
                      <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                        {filteredContacts.length} client{filteredContacts.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Select value={clientSortOption} onValueChange={(v) => setClientSortOption(v as ClientSortOption)}>
                      <SelectTrigger className="w-full sm:w-[220px] shrink-0">
                        <SelectValue placeholder="Sort by..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oldest-contacted">Longest since contacted</SelectItem>
                        <SelectItem value="newest-contacted">Most recently contacted</SelectItem>
                        <SelectItem value="oldest-added">Longest since added</SelectItem>
                        <SelectItem value="newest-added">Most recently added</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <ContactGrid
                    contacts={filteredContacts}
                    searchQuery={searchQuery}
                    action={action}
                    onEditContact={handleEditContact}
                    onViewContact={handleViewContact}
                    isTrashView={false}
                    onDeleteContact={deleteContact}
                    onRestoreContact={restoreContact}
                    onPermanentlyDelete={permanentlyDeleteContact}
                    onEmptyTrash={emptyTrash}
                    folders={folders}
                    showOwnershipBadge={!!company}
                    onMarkContacted={updateLastContacted}
                    onToggleClient={(id, isClient) => toggleClientStatus({ id, isClient })}
                    selectedContactIds={selectedContactIds}
                    onSelectContact={handleSelectContact}
                    onSelectAll={handleSelectAll}
                    onBulkDelete={handleBulkDelete}
                    selectionMode={selectionMode}
                    onToggleSelectionMode={handleToggleSelectionMode}
                  />
                </>
              ) : (
                <ContactGrid
                  contacts={filteredContacts}
                  searchQuery={searchQuery}
                  action={showTrash ? undefined : action}
                  onEditContact={handleEditContact}
                  onViewContact={handleViewContact}
                  isTrashView={showTrash}
                  onDeleteContact={deleteContact}
                  onRestoreContact={restoreContact}
                  onPermanentlyDelete={permanentlyDeleteContact}
                  onEmptyTrash={emptyTrash}
                  folders={folders}
                  showOwnershipBadge={!!company}
                  onMarkContacted={updateLastContacted}
                  onToggleClient={(id, isClient) => toggleClientStatus({ id, isClient })}
                  selectedContactIds={selectedContactIds}
                  onSelectContact={handleSelectContact}
                  onSelectAll={handleSelectAll}
                  onBulkDelete={handleBulkDelete}
                  selectionMode={selectionMode && !showTrash}
                  onToggleSelectionMode={handleToggleSelectionMode}
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
                folders={folders}
                defaultFolderId={selectedFolderId}
                initialMode={dialogMode}
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
                folder={viewingContact?.folderId ? folders.find(f => f.id === viewingContact.folderId) : undefined}
                folders={folders}
                presetKeywords={keywords}
                showOwnershipBadge={!!company}
                hasCompany={!!company}
                onEdit={handleEditFromDetails}
                onSave={handleSaveContactFromDetails}
                onDelete={handleDeleteFromDetails}
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
                onBulkImport={handleImportContacts}
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
            </div>
          </div>
        </div>

        {/* Drag Overlay - compact preview anchored to cursor for better folder visibility */}
        <DragOverlay
          dropAnimation={{
            duration: 250,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}
          modifiers={[centerOnCursor]}
        >
          {activeContact ? <DragPreview contact={activeContact} /> : null}
        </DragOverlay>
      </DndContext>
    </SidebarProvider>
  );
};

export default Index;
