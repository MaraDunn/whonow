import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Users, FolderOutput } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarMenuButton } from "@/components/ui/sidebar";

interface DroppableAllContactsProps {
  isSelected: boolean;
  totalContacts: number;
  onClick: () => void;
  showTrash: boolean;
  collapsed?: boolean;
  tooltip?: string;
}

export const DroppableAllContacts = React.forwardRef<HTMLButtonElement, DroppableAllContactsProps>(
  ({
    isSelected,
    totalContacts,
    onClick,
    showTrash,
    collapsed = false,
    tooltip,
  }, ref) => {
    const { setNodeRef, isOver, active } = useDroppable({
      id: "all-contacts",
      data: { folderId: null, isAllContacts: true },
    });

    const isDragging = !!active;
    const isActive = isSelected && !showTrash;

    if (collapsed) {
      return (
        <SidebarMenuButton
          ref={(node) => {
            setNodeRef(node);
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          onClick={onClick}
          isActive={isActive}
          tooltip={tooltip}
          className={cn(
            "w-full relative overflow-hidden",
            // Enhanced drop target styling
            isOver && !isActive && "ring-2 ring-primary bg-primary/15 scale-[1.02] shadow-md",
            // Subtle indication when dragging
            isDragging && !isActive && !isOver && "ring-1 ring-primary/30 bg-primary/5"
          )}
        >
          {/* Animated background on hover during drag */}
          {isOver && (
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 animate-pulse" />
          )}
          {isOver ? (
            <FolderOutput className="h-4 w-4 animate-scale-in shrink-0 relative z-10" />
          ) : (
            <Users
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200 relative z-10",
                isDragging && !isActive && "scale-110"
              )}
            />
          )}
        </SidebarMenuButton>
      );
    }

    return (
      <button
        ref={(node) => {
          setNodeRef(node);
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-accent",
          // Enhanced drop target styling
          isOver && !isActive && "ring-2 ring-primary bg-primary/15 scale-[1.02] shadow-md",
          // Subtle indication when dragging
          isDragging && !isActive && !isOver && "ring-1 ring-primary/30 bg-primary/5"
        )}
      >
        {/* Animated background on hover during drag */}
        {isOver && (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 animate-pulse" />
        )}

        <div className="relative z-10 flex items-center gap-3 w-full">
          {isOver ? (
            <FolderOutput className="h-4 w-4 animate-scale-in shrink-0" />
          ) : (
            <Users
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                isDragging && !isActive && "scale-110"
              )}
            />
          )}
          <span className="flex-1 text-left truncate">All Contacts</span>
          <span
            className={cn(
              "text-xs shrink-0 transition-all duration-200",
              isOver ? "opacity-100 font-medium" : "opacity-70"
            )}
          >
            {isOver ? "Remove folder" : totalContacts}
          </span>
        </div>
      </button>
    );
  }
);

DroppableAllContacts.displayName = "DroppableAllContacts";
