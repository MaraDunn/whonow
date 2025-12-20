import { useState, useMemo } from "react";
import { SearchBar } from "@/components/SearchBar";
import { ContactGrid } from "@/components/ContactGrid";
import { Header } from "@/components/Header";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { FolderSidebar } from "@/components/FolderSidebar";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import { useContacts } from "@/hooks/useContacts";
import { useFolders } from "@/hooks/useFolders";
import { useCustomKeywords } from "@/hooks/useCustomKeywords";
import { Contact } from "@/types/contact";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isProfileMode, setIsProfileMode] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  const { contacts, isLoading: contactsLoading, addContact, updateContact } = useContacts();
  const { folders, addFolder, updateFolder, deleteFolder } = useFolders();
  const { keywords, addKeyword, removeKeyword, resetToDefaults } = useCustomKeywords();

  // Filter contacts by folder first
  const folderFilteredContacts = useMemo(() => {
    if (selectedFolderId === null) return contacts;
    return contacts.filter(c => c.folderId === selectedFolderId);
  }, [contacts, selectedFolderId]);

  const { contacts: filteredContacts, action, searchTerm, isLoading: searchLoading, aiIntent } = useSmartSearch(folderFilteredContacts, searchQuery);

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

  return (
    <div className="min-h-screen bg-background flex">
      {/* Folder Sidebar */}
      <FolderSidebar
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        onAddFolder={addFolder}
        onUpdateFolder={updateFolder}
        onDeleteFolder={deleteFolder}
        contactCountByFolder={contactCountByFolder}
        totalContacts={contacts.length}
      />

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <Header 
            contactCount={filteredContacts.length} 
            onOpenAddDialog={handleOpenAddDialog}
            onOpenProfile={handleOpenProfile}
            onOpenSettings={() => setSettingsOpen(true)}
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
            action={action}
            onEditContact={handleEditContact}
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
        </div>
      </div>
    </div>
  );
};

export default Index;
