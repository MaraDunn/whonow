import { useDraggable } from "@dnd-kit/core";
import { Contact } from "@/types/contact";
import { ContactCard } from "./ContactCard";
import { ActionType } from "@/hooks/useActionSearch";
import { cn } from "@/lib/utils";

interface DraggableContactCardProps {
  contact: Contact;
  index: number;
  action?: ActionType;
  onEdit: () => void;
}

export function DraggableContactCard({ contact, index, action, onEdit }: DraggableContactCardProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: contact.id,
    data: { contact },
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
      {...listeners}
      {...attributes}
      className={cn(
        "touch-none",
        isDragging && "opacity-50"
      )}
    >
      <ContactCard
        contact={contact}
        index={index}
        action={action}
        onEdit={onEdit}
      />
    </div>
  );
}
