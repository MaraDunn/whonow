import { useState } from "react";
import { Folder, FolderPlus, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderFormDialog } from "@/components/FolderFormDialog";
import { Folder as FolderType } from "@/types/folder";
import { cn } from "@/lib/utils";

interface FolderSidebarProps {
  folders: FolderType[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onAddFolder: (folder: Omit<FolderType, "id" | "createdAt">) => void;
  onUpdateFolder: (folder: FolderType) => void;
  onDeleteFolder: (id: string) => void;
  contactCountByFolder: Record<string, number>;
  totalContacts: number;
}

export function FolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onAddFolder,
  onUpdateFolder,
  onDeleteFolder,
  contactCountByFolder,
  totalContacts,
}: FolderSidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);

  const handleSaveFolder = (folderData: Omit<FolderType, "id" | "createdAt">) => {
    if (editingFolder) {
      onUpdateFolder({ ...editingFolder, ...folderData });
    } else {
      onAddFolder(folderData);
    }
    setEditingFolder(null);
  };

  const handleEditFolder = (folder: FolderType) => {
    setEditingFolder(folder);
    setDialogOpen(true);
  };

  const handleAddFolder = () => {
    setEditingFolder(null);
    setDialogOpen(true);
  };

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Folders</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAddFolder}>
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <nav className="space-y-1">
        {/* All Contacts */}
        <button
          onClick={() => onSelectFolder(null)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            selectedFolderId === null
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-accent"
          )}
        >
          <Users className="h-4 w-4" />
          <span className="flex-1 text-left">All Contacts</span>
          <span className="text-xs opacity-70">{totalContacts}</span>
        </button>

        {/* Folder List */}
        {folders.map((folder) => (
          <div key={folder.id} className="group relative">
            <button
              onClick={() => onSelectFolder(folder.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                selectedFolderId === folder.id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <Folder className="h-4 w-4" style={{ color: selectedFolderId === folder.id ? undefined : folder.color }} />
              <span className="flex-1 text-left truncate">{folder.name}</span>
              <span className="text-xs opacity-70">{contactCountByFolder[folder.id] || 0}</span>
            </button>

            {/* Folder Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEditFolder(folder)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDeleteFolder(folder.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </nav>

      <FolderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveFolder}
        folder={editingFolder}
      />
    </aside>
  );
}
