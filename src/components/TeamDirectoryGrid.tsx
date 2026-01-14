import { useState } from "react";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { DraggableContactCard } from "./DraggableContactCard";
import { Briefcase } from "lucide-react";
import { ActionType } from "@/hooks/useActionSearch";
import { useResponsiveView } from "@/hooks/use-mobile";

interface TeamDirectoryGridProps {
  members: Contact[];
  searchQuery?: string;
  action?: ActionType;
  onEditContact?: (contact: Contact) => void;
  onViewContact?: (contact: Contact) => void;
  onDeleteContact?: (id: string) => void;
  folders?: Folder[];
  onUpdateFolder?: (contactId: string, folderId: string | null) => void;
  showOwnershipBadge?: boolean;
  onMarkContacted?: (id: string) => void;
  // Selection props
  selectedContactIds?: Set<string>;
  onSelectContact?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkMoveToFolder?: (ids: string[], folderId: string | null) => void;
  onBulkMarkContacted?: (ids: string[]) => void;
  onBulkToggleClient?: (ids: string[], isClient: boolean) => void;
  hasClientAccess?: boolean;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
}

export function TeamDirectoryGrid({ 
  members,
  searchQuery = "",
  action,
  onEditContact,
  onViewContact,
  onDeleteContact,
  folders = [],
  onUpdateFolder,
  showOwnershipBadge = false,
  onMarkContacted,
  selectedContactIds = new Set(),
  onSelectContact,
  onSelectAll,
  onBulkDelete,
  onBulkMoveToFolder,
  onBulkMarkContacted,
  onBulkToggleClient,
  hasClientAccess = false,
  selectionMode = false,
  onToggleSelectionMode,
}: TeamDirectoryGridProps) {
  const responsiveView = useResponsiveView();
  const isCompactMode = responsiveView === 'mobile' || responsiveView === 'tablet';
  
  // Track which contact is expanded in compact mode
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  // Create a map for quick folder lookup
  const folderMap = new Map(folders.map(f => [f.id, f]));

  const handleToggleExpand = (contactId: string) => {
    setExpandedContactId(prev => prev === contactId ? null : contactId);
  };

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <Briefcase className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="font-display font-semibold text-xl text-foreground mb-2">No team members yet</h3>
        <p className="text-muted-foreground text-center max-w-sm">
          {searchQuery
            ? `No results for "${searchQuery}". Try a different search term.`
            : "Invite others to join your company using the invite code in settings."}
        </p>
      </div>
    );
  }

  // Responsive grid classes - only apply compact layout on mobile/tablet
  const gridClasses = isCompactMode
    ? "grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6";

  const allSelected = members.length > 0 && members.every(m => selectedContactIds.has(m.id));
  const selectedCount = selectedContactIds.size;

  return (
    <div className={gridClasses}>
      {members.map((member, index) => (
        <DraggableContactCard
          key={member.id}
          contact={member}
          index={index}
          action={action}
          onEdit={onEditContact ? () => onEditContact(member) : () => {}}
          onView={onViewContact ? () => onViewContact(member) : undefined}
          isTrashView={false}
          onDelete={onDeleteContact ? () => onDeleteContact(member.id) : undefined}
          folder={member.folderId ? folderMap.get(member.folderId) : undefined}
          folders={folders}
          onUpdateFolder={onUpdateFolder}
          showOwnershipBadge={showOwnershipBadge}
          onMarkContacted={onMarkContacted ? () => onMarkContacted(member.id) : undefined}
          onToggleClient={undefined}
          compact={isCompactMode}
          isExpanded={expandedContactId === member.id}
          onToggleExpand={() => handleToggleExpand(member.id)}
          isSelected={selectedContactIds.has(member.id)}
          onSelect={onSelectContact ? (selected) => onSelectContact(member.id, selected) : undefined}
          selectionMode={selectionMode}
        />
      ))}
    </div>
  );
}