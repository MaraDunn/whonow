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
  isTrashView?: boolean;
  onDelete?: () => void;
  onRestore?: () => void;
  onPermanentlyDelete?: () => void;
  folder?: Folder;
  showOwnershipBadge?: boolean;
  onMarkContacted?: () => void;
  onToggleClient?: (isClient: boolean) => void;
  // Mobile/Tablet compact mode props
  compact?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function DraggableContactCard({ 
  contact, 
  index, 
  action, 
  onEdit,
  isTrashView = false,
  onDelete,
  onRestore,
  onPermanentlyDelete,
  folder,
  showOwnershipBadge = false,
  onMarkContacted,
  onToggleClient,
  compact = false,
  isExpanded = false,
  onToggleExpand,
}: DraggableContactCardProps) {
  // Disable dragging in compact mode (mobile/tablet) or trash view
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: contact.id,
    data: { contact },
    disabled: isTrashView || compact,
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
          isTrashView={isTrashView}
          onDelete={onDelete}
          onRestore={onRestore}
          onPermanentlyDelete={onPermanentlyDelete}
          folder={folder}
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

  return (
    <div
      ref={setNodeRef}
      {...(isTrashView || compact ? {} : { ...listeners, ...attributes })}
      className={cn(
        !isTrashView && !compact && "touch-none cursor-grab active:cursor-grabbing",
        "transition-transform duration-200"
      )}
    >
      <ContactCard
        contact={contact}
        index={index}
        action={action}
        onEdit={onEdit}
        isTrashView={isTrashView}
        onDelete={onDelete}
        onRestore={onRestore}
        onPermanentlyDelete={onPermanentlyDelete}
        folder={folder}
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
