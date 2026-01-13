import { useDraggable } from "@dnd-kit/core";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { ContactCard } from "./ContactCard";
import { ActionType } from "@/hooks/useActionSearch";
import { cn } from "@/lib/utils";

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
  // Mobile/Tablet compact mode props
  compact?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  // Selection props
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  selectionMode?: boolean;
  // Drag control
  disableDrag?: boolean;
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
  compact = false,
  isExpanded = false,
  onToggleExpand,
  isSelected = false,
  onSelect,
  selectionMode = false,
  disableDrag = false,
}: DraggableContactCardProps) {
  // Disable dragging in compact mode (mobile/tablet), trash view, or when sidebar is not visible
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: contact.id,
    data: { contact },
    disabled: isTrashView || compact || disableDrag,
  });

  // Hide the original element completely when dragging - the DragOverlay shows the preview
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="opacity-0 pointer-events-none"
      >
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
          compact={compact}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          isSelected={isSelected}
          onSelect={onSelect}
          selectionMode={selectionMode}
        />
      </div>
    );
  }

  const isDragDisabled = isTrashView || compact || disableDrag;
  
  return (
    <div
      ref={setNodeRef}
      {...(isDragDisabled ? {} : { ...listeners, ...attributes })}
      className={cn(
        !isDragDisabled && "touch-none cursor-grab active:cursor-grabbing",
        "transition-transform duration-200"
      )}
    >
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
        compact={compact}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );
}
