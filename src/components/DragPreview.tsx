import { Contact } from "@/types/contact";
import { GripVertical, Briefcase } from "lucide-react";

interface DragPreviewProps {
  contact: Contact;
}

export function DragPreview({ contact }: DragPreviewProps) {
  const initials = contact.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/50 bg-card/95 backdrop-blur-sm shadow-2xl cursor-grabbing min-w-[200px] max-w-[280px]">
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="w-10 h-10 rounded-lg gradient-hero flex items-center justify-center text-primary-foreground font-display font-semibold text-sm flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-semibold text-sm text-foreground truncate">
          {contact.name}
        </h3>
        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
          <Briefcase className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{contact.role}</span>
        </p>
      </div>
    </div>
  );
}
