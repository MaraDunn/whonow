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
}: DraggableContactCardProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: contact.id,
    data: { contact },
    disabled: isTrashView, // Disable dragging for trashed items
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
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...(isTrashView ? {} : { ...listeners, ...attributes })}
      className={cn(
        !isTrashView && "touch-none cursor-grab active:cursor-grabbing",
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
      />
    </div>
  );
}
