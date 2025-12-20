import { useState, useMemo } from "react";
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
  DragOverEvent
} from "@dnd-kit/core";
import { SearchBar } from "@/components/SearchBar";
import { ContactGrid } from "@/components/ContactGrid";
import { Header } from "@/components/Header";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { FolderSidebar } from "@/components/FolderSidebar";
import { ContactCard } from "@/components/ContactCard";
import { ImportContactsDialog } from "@/components/ImportContactsDialog";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import { useContacts } from "@/hooks/useContacts";
import { useFolders } from "@/hooks/useFolders";
import { useCustomKeywords } from "@/hooks/useCustomKeywords";
import { Contact } from "@/types/contact";
import { toast } from "sonner";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isProfileMode, setIsProfileMode] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  
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
  const { keywords, addKeyword, removeKeyword, resetToDefaults } = useCustomKeywords();

  // Filter contacts by folder first (only for non-trash view)
  const folderFilteredContacts = useMemo(() => {
    if (showTrash) return trashedContacts;
    if (selectedFolderId === null) return contacts;
    return contacts.filter(c => c.folderId === selectedFolderId);
  }, [contacts, trashedContacts, selectedFolderId, showTrash]);

  const { contacts: filteredContacts, action, searchTerm, isLoading: searchLoading, aiIntent } = useSmartSearch(folderFilteredContacts, searchQuery);

  const handleSelectTrash = () => {
    setShowTrash(true);
    setSelectedFolderId(null);
  };

  const handleSelectFolder = (folderId: string | null) => {
    setShowTrash(false);
    setSelectedFolderId(folderId);
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

    if (!contact) return;
    
    // If dropped on the same folder, do nothing
    if (contact.folderId === targetFolderId) return;
    if (!contact.folderId && targetFolderId === null) return;

    // Update the contact's folder
    updateContact({
      ...contact,
      folderId: targetFolderId || undefined,
    });

    const folderName = targetFolderId 
      ? folders.find(f => f.id === targetFolderId)?.name 
      : "No folder";
    toast.success(`Moved "${contact.name}" to ${folderName}`);
    
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

  const handleOpenAddDialog = () => {
    setEditingContact(null);
    setIsProfileMode(false);
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="min-h-screen bg-background flex">
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
        />

        {/* Main Content */}
        <div className="flex-1">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <Header 
              contactCount={filteredContacts.length} 
              onOpenAddDialog={handleOpenAddDialog}
              onOpenProfile={handleOpenProfile}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenImport={() => setImportDialogOpen(true)}
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
            />

            <SettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              keywords={keywords}
              onAddKeyword={addKeyword}
              onRemoveKeyword={removeKeyword}
              onResetKeywords={resetToDefaults}
            />

            <ImportContactsDialog
              open={importDialogOpen}
              onOpenChange={setImportDialogOpen}
              onImport={handleImportContacts}
            />
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={{
        duration: 250,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeContact ? (
          <div className="rotate-2 scale-105 shadow-2xl cursor-grabbing">
            <ContactCard
              contact={activeContact}
              index={0}
              onEdit={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default Index;
