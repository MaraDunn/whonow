import { useDroppable } from "@dnd-kit/core";
import { Folder as FolderIcon, FolderInput } from "lucide-react";
import { Folder } from "@/types/folder";
import { cn } from "@/lib/utils";
import { SidebarMenuButton } from "@/components/ui/sidebar";

interface DroppableFolderProps {
  folder: Folder | null; // null for "No folder" option
  isSelected: boolean;
  contactCount: number;
  onClick: () => void;
  children?: React.ReactNode;
  collapsed?: boolean;
}

export function DroppableFolder({ folder, isSelected, contactCount, onClick, children, collapsed = false }: DroppableFolderProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: folder?.id || "no-folder",
    data: { folderId: folder?.id || null },
  });

  const isDragging = !!active;

  if (collapsed) {
    return (
      <div ref={setNodeRef} className="w-full">
        <SidebarMenuButton
          onClick={onClick}
          isActive={isSelected}
          className={cn(
            "w-full relative overflow-hidden",
            // Enhanced drop target styling
            isOver && !isSelected && "ring-2 ring-primary bg-primary/15 scale-[1.02] shadow-md",
            // Subtle pulse animation when dragging to indicate valid targets
            isDragging && !isSelected && !isOver && "ring-1 ring-primary/30 bg-primary/5"
          )}
        >
          {/* Animated background on hover during drag */}
          {isOver && (
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 animate-pulse" />
          )}
          <div
            className={cn(
              "h-4 w-4 rounded-sm shrink-0 relative z-10 transition-transform duration-200",
              isDragging && !isSelected && "scale-110"
            )}
            style={{ backgroundColor: folder?.color || "#6B7280" }}
          />
        </SidebarMenuButton>
      </div>
    );
  }

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-accent",
        // Enhanced drop target styling
        isOver && !isSelected && "ring-2 ring-primary bg-primary/15 scale-[1.02] shadow-md",
        // Subtle pulse animation when dragging to indicate valid targets
        isDragging && !isSelected && !isOver && "ring-1 ring-primary/30 bg-primary/5"
      )}
    >
      {/* Animated background on hover during drag */}
      {isOver && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 animate-pulse" />
      )}
      
      <div className="relative z-10 flex items-center gap-3 w-full pr-6">
        {isOver ? (
          <FolderInput 
            className="h-4 w-4 animate-scale-in shrink-0"
            style={{ color: isSelected ? undefined : folder?.color }}
          />
        ) : (
          <FolderIcon
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              isDragging && !isSelected && "scale-110"
            )}
            style={{ color: isSelected ? undefined : folder?.color }}
          />
        )}
        <span className="flex-1 text-left truncate">{folder?.name || "No folder"}</span>
        <span className={cn(
          "text-xs shrink-0 transition-all duration-200",
          isOver ? "opacity-100 font-medium" : "opacity-70"
        )}>
          {isOver ? `+1` : contactCount}
        </span>
      </div>
      {children}
    </button>
  );
}
