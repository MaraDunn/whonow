import React from "react";
import { Folder as FolderIcon } from "lucide-react";
import { Folder } from "@/types/folder";
import { SidebarMenuButton } from "@/components/ui/sidebar";

interface DroppableFolderProps {
  folder: Folder | null; // null for "No folder" option
  isSelected: boolean;
  contactCount: number;
  onClick: () => void;
  children?: React.ReactNode;
  collapsed?: boolean;
  tooltip?: string;
}

export const DroppableFolder = React.forwardRef<HTMLButtonElement, DroppableFolderProps>(
  ({ folder, isSelected, contactCount, onClick, children, collapsed = false, tooltip }, ref) => {
    if (collapsed) {
      return (
        <SidebarMenuButton
          ref={ref}
          onClick={onClick}
          isActive={isSelected}
          tooltip={tooltip || folder?.name}
          className="w-full"
        >
          <div
            className="h-4 w-4 rounded-sm shrink-0"
            style={{ backgroundColor: folder?.color || "#6B7280" }}
          />
        </SidebarMenuButton>
      );
    }

    // Use SidebarMenuButton (same as All Contacts and client/team folders) for single-click behavior
    return (
      <SidebarMenuButton
        ref={ref}
        onClick={onClick}
        isActive={isSelected}
        tooltip={tooltip}
        className="w-full min-w-0 gap-3 px-3 py-2"
      >
        <FolderIcon
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
