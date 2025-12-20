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
  folder
}: DraggableContactCardProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: contact.id,
    data: { contact },
    disabled: isTrashView, // Disable dragging for trashed items
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isTrashView ? {} : { ...listeners, ...attributes })}
      className={cn(
        !isTrashView && "touch-none cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30 scale-95 transition-all duration-200",
        !isDragging && "transition-transform duration-200"
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
      />
    </div>
  );
}
