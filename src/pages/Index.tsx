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
import { SettingsDialog } from "@/components/SettingsDialog";
import { FolderSidebar } from "@/components/FolderSidebar";
import { DragPreview } from "@/components/DragPreview";
import { TeamDirectoryGrid } from "@/components/TeamDirectoryGrid";
import { ImportContactsDialog } from "@/components/ImportContactsDialog";
import { CompanySetupDialog } from "@/components/CompanySetupDialog";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import { useContacts } from "@/hooks/useContacts";
import { useFolders } from "@/hooks/useFolders";
import { useCustomKeywords } from "@/hooks/useCustomKeywords";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Contact } from "@/types/contact";
import { toast } from "sonner";

function getClientPoint(event: Event): { x: number; y: number } | null {
  // Touch
  if ("touches" in (event as any)) {
    const te = event as TouchEvent;
    const t = te.touches?.[0] ?? te.changedTouches?.[0];
    if (t) return { x: t.clientX, y: t.clientY };
  }

  // Mouse / Pointer
  if ("clientX" in (event as any) && "clientY" in (event as any)) {
    const e = event as MouseEvent;
    return { x: e.clientX, y: e.clientY };
  }

  return null;
}

// Keep the drag preview anchored to the cursor regardless of where the user grabs the card.
// We want the cursor to be "holding" the top-center of the preview.
const SNAP_TO_CURSOR_Y_OFFSET = 10;
const snapTopCenterToCursor: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => {
  if (!activatorEvent || !activeNodeRect || !overlayNodeRect) return transform;

  const point = getClientPoint(activatorEvent);
  if (!point) return transform;

  const pointerOffsetX = point.x - activeNodeRect.left;
  const pointerOffsetY = point.y - activeNodeRect.top;

  // Desired cursor contact point on the overlay: top-center (slightly below the cursor)
  const desiredOffsetX = overlayNodeRect.width / 2;
  const desiredOffsetY = SNAP_TO_CURSOR_Y_OFFSET;

  // dnd-kit keeps the original grab point; we override by shifting the overlay so the
  // cursor always maps to the desired point.
  return {
    ...transform,
    x: transform.x + (desiredOffsetX - pointerOffsetX),
    y: transform.y + (desiredOffsetY - pointerOffsetY),
  };
};

const Index = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { needsCompanySetup, createCompany, joinCompany, skipCompanySetup, companyMembers, company } = useProfile(user?.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"quick" | "full">("full");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isProfileMode, setIsProfileMode] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importDefaultTab, setImportDefaultTab] = useState<string | undefined>(undefined);
  const [showTrash, setShowTrash] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  
  const { 
    contacts, 
    trashedContacts,
    isLoading: contactsLoading, 
    addContact, 
    updateContact,
    deleteContact,
    restoreContact,
    permanentlyDeleteContact,
    emptyTrash
  } = useContacts();
  const { folders, addFolder, updateFolder, deleteFolder } = useFolders();
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

  // Filter contacts by folder first (only for non-trash view)
  const folderFilteredContacts = useMemo(() => {
    if (showTrash) return trashedContacts;
    if (selectedFolderId === null) return contacts;
    return contacts.filter(c => c.folderId === selectedFolderId);
  }, [contacts, trashedContacts, selectedFolderId, showTrash]);

  const { contacts: filteredContacts, action, searchTerm, isLoading: searchLoading, aiIntent } = useSmartSearch(folderFilteredContacts, searchQuery);

  const handleSelectTrash = () => {
    setShowTrash(true);
    setShowDirectory(false);
    setSelectedFolderId(null);
  };

  const handleSelectFolder = (folderId: string | null) => {
    setShowTrash(false);
    setShowDirectory(false);
    setSelectedFolderId(folderId);
  };

  const handleSelectDirectory = () => {
    setShowDirectory(true);
    setShowTrash(false);
    setSelectedFolderId(null);
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

  // Find the user's own contact card (marked with isProfile flag or stored separately)
  const myProfile = contacts.find(c => c.tags?.includes("my-profile"));

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
      // If saving profile, add the my-profile tag
      if (isProfileMode) {
        addContact({ ...contactData, tags: [...(contactData.tags || []), "my-profile"] });
      } else {
        addContact(contactData);
      }
    }
    setEditingContact(null);
    setIsProfileMode(false);
  };

  const handleOpenAddDialog = (mode: "quick" | "full" = "full") => {
    setEditingContact(null);
    setIsProfileMode(false);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const handleOpenProfile = () => {
    if (myProfile) {
      setEditingContact(myProfile);
    } else {
      setEditingContact(null);
    }
    setIsProfileMode(true);
    setDialogOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setIsProfileMode(false);
    setDialogOpen(true);
  };

  const handleImportContacts = (contacts: Omit<Contact, "id">[]) => {
    contacts.forEach((contact) => addContact(contact));
    toast.success(`Imported ${contacts.length} contacts`);
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
        <div className="min-h-screen bg-background flex w-full">
          {/* Folder Sidebar */}
          <FolderSidebar
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={handleSelectFolder}
            onAddFolder={addFolder}
            onUpdateFolder={updateFolder}
            onDeleteFolder={deleteFolder}
            contactCountByFolder={contactCountByFolder}
            totalContacts={contacts.length}
            trashCount={trashedContacts.length}
            showTrash={showTrash}
            onSelectTrash={handleSelectTrash}
            companyMembers={companyMembers}
            showDirectory={showDirectory}
            onSelectDirectory={company ? handleSelectDirectory : undefined}
          />

          {/* Main Content */}
          <div className="flex-1">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
              <Header 
                contactCount={filteredContacts.length} 
                onOpenAddDialog={handleOpenAddDialog}
                onOpenProfile={handleOpenProfile}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenImport={(tab) => {
                  setImportDefaultTab(tab);
                  setImportDialogOpen(true);
                }}
                onContactsImported={handleContactsImported}
                myProfile={myProfile}
              />
              
              <div className="mb-10">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Try 'Who handles marketing?' or 'email sarah'..."
                  isLoading={searchLoading}
                />
              </div>

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
                    <h2 className="text-2xl font-display font-semibold">Team Directory</h2>
                    <p className="text-muted-foreground mt-1">
                      {company?.name} • {companyMembers.length} member{companyMembers.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <TeamDirectoryGrid members={companyMembers} />
                </>
              ) : (
                <ContactGrid
                  contacts={filteredContacts}
                  searchQuery={searchQuery}
                  action={showTrash ? undefined : action}
                  onEditContact={handleEditContact}
                  isTrashView={showTrash}
                  onDeleteContact={deleteContact}
                  onRestoreContact={restoreContact}
                  onPermanentlyDelete={permanentlyDeleteContact}
                  onEmptyTrash={emptyTrash}
                  folders={folders}
                />
              )}

              <ContactFormDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) setIsProfileMode(false);
                }}
                onSave={handleSaveContact}
                contact={editingContact}
                isProfileMode={isProfileMode}
                presetKeywords={keywords}
                folders={folders}
                defaultFolderId={selectedFolderId}
                initialMode={dialogMode}
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
          modifiers={[snapTopCenterToCursor]}
        >
          {activeContact ? <DragPreview contact={activeContact} /> : null}
        </DragOverlay>
      </DndContext>
    </SidebarProvider>
  );
};

export default Index;
