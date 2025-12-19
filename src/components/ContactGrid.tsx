import { Contact } from "@/types/contact";
import { ContactCard } from "./ContactCard";
import { Users } from "lucide-react";
import { ActionType } from "@/hooks/useActionSearch";

interface ContactGridProps {
  contacts: Contact[];
  searchQuery: string;
  action?: ActionType;
  onEditContact: (contact: Contact) => void;
}

export function ContactGrid({ contacts, searchQuery, action, onEditContact }: ContactGridProps) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <Users className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="font-display font-semibold text-xl text-foreground mb-2">
          No contacts found
        </h3>
        <p className="text-muted-foreground text-center max-w-sm">
          {searchQuery
            ? `No results for "${searchQuery}". Try a different search term.`
            : "Start adding contacts to see them here."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {contacts.map((contact, index) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          index={index}
          action={action}
          onEdit={() => onEditContact(contact)}
        />
      ))}
    </div>
  );
}
