import { useDroppable } from "@dnd-kit/core";
import { Folder as FolderIcon } from "lucide-react";
import { Folder } from "@/types/folder";
import { cn } from "@/lib/utils";

interface DroppableFolderProps {
  folder: Folder | null; // null for "No folder" option
  isSelected: boolean;
  contactCount: number;
  onClick: () => void;
  children?: React.ReactNode;
}

export function DroppableFolder({ folder, isSelected, contactCount, onClick, children }: DroppableFolderProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: folder?.id || "no-folder",
    data: { folderId: folder?.id || null },
  });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-accent",
        isOver && !isSelected && "ring-2 ring-primary bg-primary/10 scale-[1.02]"
      )}
    >
      <FolderIcon
        className="h-4 w-4"
        style={{ color: isSelected ? undefined : folder?.color }}
      />
      <span className="flex-1 text-left truncate">{folder?.name || "No folder"}</span>
      <span className="text-xs opacity-70">{contactCount}</span>
      {children}
    </button>
  );
}
