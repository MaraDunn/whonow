import { useState, useMemo, useCallback } from "react";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { DraggableContactCard } from "./DraggableContactCard";
import { Users, Trash2 } from "lucide-react";
import { ActionType } from "@/hooks/useActionSearch";
import { Button } from "@/components/ui/button";
import { useResponsiveView } from "@/hooks/use-mobile";

interface ContactGridProps {
  contacts: Contact[];
  searchQuery: string;
  action?: ActionType;
  onEditContact: (contact: Contact) => void;
  onViewContact?: (contact: Contact) => void;
  isTrashView?: boolean;
  trashCount?: number; // Accurate count of trashed contacts (not limited by 1000)
  onDeleteContact?: (id: string) => void;
  onRestoreContact?: (id: string) => void;
  onPermanentlyDelete?: (id: string) => void;
  onEmptyTrash?: () => void;
  folders?: Folder[];
  onUpdateFolder?: (contactId: string, folderId: string | null) => void;
  showOwnershipBadge?: boolean;
  onMarkContacted?: (id: string) => void;
  onToggleClient?: (id: string, isClient: boolean) => void;
  // Selection props
  selectedContactIds?: Set<string>;
  onSelectContact?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkMoveToFolder?: (ids: string[], folderId: string | null) => void;
  onBulkToggleClient?: (ids: string[], isClient: boolean) => void;
  onBulkMarkContacted?: (ids: string[]) => void;
  hasClientAccess?: boolean;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
}

export function ContactGrid({ 
  contacts, 
  searchQuery, 
  action, 
  onEditContact,
  onViewContact,
  isTrashView = false,
  trashCount,
  onDeleteContact,
  onRestoreContact,
  onPermanentlyDelete,
  onEmptyTrash,
  folders = [],
  onUpdateFolder,
  showOwnershipBadge = false,
  onMarkContacted,
  onToggleClient,
  selectedContactIds = new Set(),
  onSelectContact,
  onSelectAll,
  onBulkDelete,
  onBulkMoveToFolder,
  onBulkToggleClient,
  onBulkMarkContacted,
  hasClientAccess = false,
  selectionMode = false,
  onToggleSelectionMode,
}: ContactGridProps) {
  const responsiveView = useResponsiveView();
  const isCompactMode = responsiveView === 'mobile' || responsiveView === 'tablet';
  
  // Track which contact is expanded in compact mode
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  // Memoize folder map for quick lookup - only recreate when folders change
  const folderMap = useMemo(() => 
    new Map(folders.map(f => [f.id, f])),
    [folders]
  );

  const handleToggleExpand = useCallback((contactId: string) => {
    setExpandedContactId(prev => prev === contactId ? null : contactId);
  }, []);

  // Memoize grid classes - only recalculate when compact mode changes
  // MUST be before early return to follow Rules of Hooks
  const gridClasses = useMemo(() => 
    isCompactMode
      ? "grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6",
    [isCompactMode]
  );

  // Memoize selection checks - only recalculate when contacts or selection changes
  // MUST be before early return to follow Rules of Hooks
  const allSelected = useMemo(() => 
    contacts.length > 0 && contacts.every(c => selectedContactIds.has(c.id)),
    [contacts, selectedContactIds]
  );

  // Early return AFTER all hooks
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
      {isTrashView && (contacts.length > 0 || (trashCount && trashCount > 0)) && (
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {trashCount !== undefined ? trashCount : contacts.length} contact{(trashCount !== undefined ? trashCount : contacts.length) !== 1 ? "s" : ""} in trash
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={onEmptyTrash}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Empty Trash
          </Button>
        </div>
      )}
      <div className={gridClasses}>
        {contacts.map((contact, index) => (
          <DraggableContactCard
            key={contact.id}
            contact={contact}
            index={index}
            action={action}
            onEdit={() => onEditContact(contact)}
            onView={onViewContact ? () => onViewContact(contact) : undefined}
            isTrashView={isTrashView}
            onDelete={onDeleteContact ? () => onDeleteContact(contact.id) : undefined}
            onRestore={onRestoreContact ? () => onRestoreContact(contact.id) : undefined}
            onPermanentlyDelete={onPermanentlyDelete ? () => onPermanentlyDelete(contact.id) : undefined}
            folder={contact.folderId ? folderMap.get(contact.folderId) : undefined}
            folders={folders}
            onUpdateFolder={onUpdateFolder}
            showOwnershipBadge={showOwnershipBadge}
            onMarkContacted={onMarkContacted ? () => onMarkContacted(contact.id) : undefined}
            onToggleClient={onToggleClient ? (isClient) => onToggleClient(contact.id, isClient) : undefined}
            hasClientAccess={hasClientAccess}
            compact={isCompactMode}
            isExpanded={expandedContactId === contact.id}
            onToggleExpand={() => handleToggleExpand(contact.id)}
            isSelected={selectedContactIds.has(contact.id)}
            onSelect={onSelectContact ? (selected) => onSelectContact(contact.id, selected) : undefined}
            selectionMode={selectionMode}
          />
        ))}
      </div>
    </div>
  );
}
