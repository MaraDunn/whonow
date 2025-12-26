import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { DraggableContactCard } from "./DraggableContactCard";
import { Users, Trash2 } from "lucide-react";
import { ActionType } from "@/hooks/useActionSearch";
import { Button } from "@/components/ui/button";

interface ContactGridProps {
  contacts: Contact[];
  searchQuery: string;
  action?: ActionType;
  onEditContact: (contact: Contact) => void;
  isTrashView?: boolean;
  onDeleteContact?: (id: string) => void;
  onRestoreContact?: (id: string) => void;
  onPermanentlyDelete?: (id: string) => void;
  onEmptyTrash?: () => void;
  folders?: Folder[];
  showOwnershipBadge?: boolean;
}

export function ContactGrid({ 
  contacts, 
  searchQuery, 
  action, 
  onEditContact,
  isTrashView = false,
  onDeleteContact,
  onRestoreContact,
  onPermanentlyDelete,
  onEmptyTrash,
  folders = [],
  showOwnershipBadge = false,
}: ContactGridProps) {
  // Create a map for quick folder lookup
  const folderMap = new Map(folders.map(f => [f.id, f]));

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          {isTrashView ? (
            <Trash2 className="h-10 w-10 text-muted-foreground" />
          ) : (
            <Users className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <h3 className="font-display font-semibold text-xl text-foreground mb-2">
          {isTrashView ? "Trash is empty" : "No contacts found"}
        </h3>
        <p className="text-muted-foreground text-center max-w-sm">
          {isTrashView
            ? "Deleted contacts will appear here."
            : searchQuery
            ? `No results for "${searchQuery}". Try a different search term.`
            : "Start adding contacts to see them here."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {isTrashView && contacts.length > 0 && (
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} in trash
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={onEmptyTrash}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Empty Trash
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {contacts.map((contact, index) => (
          <DraggableContactCard
            key={contact.id}
            contact={contact}
            index={index}
            action={action}
            onEdit={() => onEditContact(contact)}
            isTrashView={isTrashView}
            onDelete={onDeleteContact ? () => onDeleteContact(contact.id) : undefined}
            onRestore={onRestoreContact ? () => onRestoreContact(contact.id) : undefined}
            onPermanentlyDelete={onPermanentlyDelete ? () => onPermanentlyDelete(contact.id) : undefined}
            folder={contact.folderId ? folderMap.get(contact.folderId) : undefined}
            showOwnershipBadge={showOwnershipBadge}
          />
        ))}
      </div>
    </div>
  );
}
