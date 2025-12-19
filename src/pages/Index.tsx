import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { ContactGrid } from "@/components/ContactGrid";
import { Header } from "@/components/Header";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { sampleContacts } from "@/data/contacts";
import { useActionSearch } from "@/hooks/useActionSearch";
import { Contact } from "@/types/contact";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>(sampleContacts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const { contacts: filteredContacts, action, searchTerm } = useActionSearch(contacts, searchQuery);

  const handleSaveContact = (contactData: Omit<Contact, "id">) => {
    if (editingContact) {
      setContacts((prev) =>
        prev.map((c) => (c.id === editingContact.id ? { ...contactData, id: editingContact.id } : c))
      );
    } else {
      const contact: Contact = {
        ...contactData,
        id: crypto.randomUUID(),
      };
      setContacts((prev) => [contact, ...prev]);
    }
    setEditingContact(null);
  };

  const handleOpenAddDialog = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Header contactCount={filteredContacts.length} onOpenAddDialog={handleOpenAddDialog} />
        
        <div className="mb-10">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Try 'email sarah' or 'call marketing'..."
          />
        </div>

        {searchQuery && (
          <div className="mb-6 animate-fade-in">
            <p className="text-sm text-muted-foreground">
              {action ? (
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
          onOpenChange={setDialogOpen}
          onSave={handleSaveContact}
          contact={editingContact}
        />
      </div>
    </div>
  );
};

export default Index;
