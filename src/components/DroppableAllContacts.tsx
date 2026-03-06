import React, { useCallback, useState } from "react";
import { Users } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { CONTACT_DRAG_TYPE } from "@/components/ContactCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useContactDrag } from "@/contexts/ContactDragContext";

interface DroppableAllContactsProps {
  isSelected: boolean;
  totalContacts: number;
  onClick: () => void;
  showTrash: boolean;
  collapsed?: boolean;
  tooltip?: string;
  /** Called when a contact is dropped here (removes from folder). */
  onDropContact?: (contactId: string, folderId: string | null) => void;
}

export const DroppableAllContacts = React.forwardRef<HTMLButtonElement, DroppableAllContactsProps>(
  ({
    isSelected,
    totalContacts,
    onClick,
    showTrash,
    collapsed = false,
    tooltip,
    onDropContact,
  }, ref) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const { payload } = useContactDrag();
    const isActive = isSelected && !showTrash;
    const showAsHighlighted = payload !== null && onDropContact;
    // Drop target (pointer over): bold ring + solid tint so it's obvious where you're about to drop.
    const dragStateClass = showAsHighlighted && isDragOver
      ? "!bg-primary/20 ring-4 ring-ring ring-offset-2 ring-offset-background border-2 border-primary shadow-md"
      : showAsHighlighted
        ? "ring-2 ring-ring ring-offset-2 ring-offset-background bg-primary/5"
        : isDragOver
          ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
          : "";

    const handleDragOver = useCallback(
      (e: React.DragEvent) => {
        if (!onDropContact) return;
        if (!e.dataTransfer.types.includes(CONTACT_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      },
      [onDropContact]
    );

    const handleDragEnter = useCallback(
      (e: React.DragEvent) => {
        if (!onDropContact) return;
        if (!e.dataTransfer.types.includes(CONTACT_DRAG_TYPE)) return;
        e.preventDefault();
        setIsDragOver(true);
      },
      [onDropContact]
    );

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setIsDragOver(false);
      }
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        setIsDragOver(false);
        if (!onDropContact) return;
        const raw = e.dataTransfer.getData(CONTACT_DRAG_TYPE);
        if (!raw) return;
        e.preventDefault();
        try {
          const payload = JSON.parse(raw) as { contactId: string };
          onDropContact(payload.contactId, null);
          toast.success("Removed from folder");
        } catch {
          toast.error("Invalid drag data.");
        }
      },
      [onDropContact]
    );

    const dropProps = onDropContact
      ? { onDragOver: handleDragOver, onDragEnter: handleDragEnter, onDragLeave: handleDragLeave, onDrop: handleDrop }
      : {};

    if (collapsed) {
      return (
        <SidebarMenuButton
          ref={ref}
          onClick={onClick}
          isActive={isActive}
          tooltip={tooltip}
          className={cn("w-full min-w-0 pl-6", dragStateClass)}
          data-onboarding-all-contacts
          {...dropProps}
        >
          <Users className="h-4 w-4 shrink-0" />
        </SidebarMenuButton>
      );
    }

    return (
      <SidebarMenuButton
        ref={ref}
        onClick={onClick}
        isActive={isActive}
        className={cn("w-full min-w-0 pl-6", dragStateClass)}
        data-onboarding-all-contacts
        {...dropProps}
      >
        <Users className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left min-w-0 truncate">All Contacts</span>
        <span className="text-xs opacity-70 shrink-0">
          {totalContacts}
        </span>
      </SidebarMenuButton>
    );
  }
);

DroppableAllContacts.displayName = "DroppableAllContacts";
