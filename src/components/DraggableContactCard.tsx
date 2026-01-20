import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { ContactCard } from "./ContactCard";
import { ActionType } from "@/hooks/useActionSearch";

export interface DraggableContactCardProps {
  contact: Contact;
  index: number;
  action?: ActionType;
  onEdit: () => void;
  onView?: () => void;
  isTrashView?: boolean;
  onDelete?: () => void;
  onRestore?: () => void;
  onPermanentlyDelete?: () => void;
  folder?: Folder;
  folders?: Folder[];
  onUpdateFolder?: (contactId: string, folderId: string | null) => void;
  showOwnershipBadge?: boolean;
  onMarkContacted?: () => void;
  onToggleClient?: (isClient: boolean) => void;
  hasClientAccess?: boolean;
  // Mobile/Tablet compact mode props
  compact?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  // Selection props
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  selectionMode?: boolean;
}

export function DraggableContactCard({ 
  contact, 
  index, 
  action, 
  onEdit,
  onView,
  isTrashView = false,
  onDelete,
  onRestore,
  onPermanentlyDelete,
  folder,
  folders = [],
  onUpdateFolder,
  showOwnershipBadge = false,
  onMarkContacted,
  onToggleClient,
  hasClientAccess = false,
  compact = false,
  isExpanded = false,
  onToggleExpand,
  isSelected = false,
  onSelect,
  selectionMode = false,
}: DraggableContactCardProps) {
  return (
    <ContactCard
      contact={contact}
      index={index}
      action={action}
      onEdit={onEdit}
      onView={onView}
      isTrashView={isTrashView}
      onDelete={onDelete}
      onRestore={onRestore}
      onPermanentlyDelete={onPermanentlyDelete}
      folder={folder}
      folders={folders}
      onUpdateFolder={onUpdateFolder}
      showOwnershipBadge={showOwnershipBadge}
      onMarkContacted={onMarkContacted}
      onToggleClient={onToggleClient}
      hasClientAccess={hasClientAccess}
      compact={compact}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      isSelected={isSelected}
      onSelect={onSelect}
      selectionMode={selectionMode}
    />
  );
}
