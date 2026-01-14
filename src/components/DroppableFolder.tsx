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

    return (
      <button
        ref={ref}
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          isSelected
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-accent"
        }`}
      >
        <div className="flex items-center gap-3 w-full pr-6 min-w-0">
          <FolderIcon
            className="h-4 w-4 shrink-0"
            style={{ color: isSelected ? undefined : folder?.color }}
          />
          <span className="flex-1 text-left truncate min-w-0">{folder?.name || "No folder"}</span>
          <span className="text-xs opacity-70 shrink-0">
            {contactCount}
          </span>
        </div>
        {children}
      </button>
    );
  }
);

DroppableFolder.displayName = "DroppableFolder";
