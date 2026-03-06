import React, { useCallback, useMemo, useState } from "react";
import { Folder as FolderIcon, Filter } from "lucide-react";
import { Folder } from "@/types/folder";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { CONTACT_DRAG_TYPE } from "@/components/ContactCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useContactDrag } from "@/contexts/ContactDragContext";

interface DroppableFolderProps {
  folder: Folder | null; // null for "No folder" option
  isSelected: boolean;
  contactCount: number;
  onClick: () => void;
  children?: React.ReactNode;
  collapsed?: boolean;
  tooltip?: string;
  /** When true, show filter icon (saved search / smart folder). */
  isSmartFolder?: boolean;
  /** Called when a contact is dropped here. When set, folder becomes a drop target. */
  onDropContact?: (contactId: string, folderId: string | null) => void;
}

function canAcceptDrop(
  payload: { isShared: boolean; isClient: boolean },
  folder: Folder | null,
  isSmartFolder: boolean
): boolean {
  if (isSmartFolder || folder?.isSmartFolder === true) return false;
  if (folder?.isOrganizationFolder && !payload.isShared) return false;
  if (folder?.directoryType === "clients" && !payload.isClient) return false;
  return true;
}

export const DroppableFolder = React.forwardRef<HTMLButtonElement, DroppableFolderProps>(
  ({ folder, isSelected, contactCount, onClick, children, collapsed = false, tooltip, isSmartFolder = false, onDropContact }, ref) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const { payload } = useContactDrag();
    const Icon = isSmartFolder ? Filter : FolderIcon;

    const isDraggingContact = payload !== null;
    const canAccept = useMemo(
      () => (payload && onDropContact ? canAcceptDrop(payload, folder, isSmartFolder) : false),
      [payload, onDropContact, folder, isSmartFolder]
    );
    const showAsGrayed = isDraggingContact && onDropContact && !canAccept;
    const showAsHighlighted = isDraggingContact && canAccept;

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
          const payload = JSON.parse(raw) as { contactId: string; isShared: boolean; isClient: boolean };
          const { contactId, isShared, isClient } = payload;

          // No contacts can be dragged to smart folders
          if (isSmartFolder || (folder?.isSmartFolder === true)) {
            toast.error("Contacts cannot be moved into smart folders.");
            return;
          }
          // Contacts that are not shared cannot be dragged to company (organization) folders
          if (folder?.isOrganizationFolder && !isShared) {
            toast.error("Only shared contacts can be moved to organization folders.");
            return;
          }
          // Contacts that are not clients cannot be dragged to client folders
          if (folder?.directoryType === "clients" && !isClient) {
            toast.error("Only contacts marked as clients can be moved to client folders.");
            return;
          }

          const targetFolderId = folder?.id ?? null;
          onDropContact(contactId, targetFolderId);
          const folderName = folder?.name ?? "No folder";
          toast.success(`Moved to ${folderName}`);
        } catch {
          toast.error("Invalid drag data.");
        }
      },
      [onDropContact, folder?.id, folder?.name, folder?.isOrganizationFolder, folder?.directoryType, folder?.isSmartFolder, isSmartFolder]
    );

    const dropProps = onDropContact
      ? { onDragOver: handleDragOver, onDragEnter: handleDragEnter, onDragLeave: handleDragLeave, onDrop: handleDrop }
      : {};

    // Drop target (pointer over this folder): bold ring + solid tint so it's obvious where you're about to drop.
    // Use ! to override sidebar button hover styles when dragging.
    const dragStateClass = showAsGrayed
      ? "opacity-50 pointer-events-none"
      : showAsHighlighted && isDragOver
        ? "!bg-primary/20 ring-4 ring-ring ring-offset-2 ring-offset-background border-2 border-primary shadow-md"
        : showAsHighlighted
          ? "ring-2 ring-ring ring-offset-2 ring-offset-background bg-primary/5"
          : isDragOver
            ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
            : "";

    if (collapsed) {
      return (
        <SidebarMenuButton
          ref={ref}
          onClick={onClick}
          isActive={isSelected}
          tooltip={tooltip || folder?.name}
          className={cn("w-full", dragStateClass)}
          {...dropProps}
        >
          <div
            className="h-4 w-4 rounded-sm shrink-0 flex items-center justify-center"
            style={{ backgroundColor: folder?.color || "#6B7280" }}
          >
            {isSmartFolder ? <Filter className="h-2.5 w-2.5 text-white" /> : null}
          </div>
        </SidebarMenuButton>
      );
    }

    return (
      <SidebarMenuButton
        ref={ref}
        onClick={onClick}
        isActive={isSelected}
        tooltip={tooltip}
        className={cn("w-full min-w-0 gap-3 pl-3 pr-8 py-2", dragStateClass)}
        {...dropProps}
      >
        <Icon
          className="h-4 w-4 shrink-0"
          style={{ color: isSelected ? undefined : folder?.color }}
        />
        <span className="flex-1 text-left truncate min-w-0">{folder?.name || "No folder"}</span>
        <span className="text-xs opacity-70 shrink-0">
          {contactCount}
        </span>
        {children}
      </SidebarMenuButton>
    );
  }
);

DroppableFolder.displayName = "DroppableFolder";
