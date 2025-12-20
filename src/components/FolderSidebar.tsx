import { useState } from "react";
import { FolderPlus, MoreHorizontal, Pencil, Trash, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FolderFormDialog } from "@/components/FolderFormDialog";
import { DroppableFolder } from "@/components/DroppableFolder";
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
  trashCount?: number;
  showTrash?: boolean;
  onSelectTrash?: () => void;
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
  trashCount = 0,
  showTrash = false,
  onSelectTrash,
}: FolderSidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

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
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-2">
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center" : "justify-between px-2"
        )}>
          {!isCollapsed && (
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Folders
            </h2>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7" 
                  onClick={handleAddFolder}
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Add folder</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* All Contacts */}
              <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        onClick={() => onSelectFolder(null)}
                        isActive={selectedFolderId === null && !showTrash}
                        className="w-full"
                      >
                        <Users className="h-4 w-4" />
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-left">All Contacts</span>
                            <span className="text-xs opacity-70">{totalContacts}</span>
                          </>
                        )}
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right">
                        <p>All Contacts ({totalContacts})</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>

              {/* Folder List */}
              {folders.map((folder) => (
                <SidebarMenuItem key={folder.id} className="group relative">
                  {isCollapsed ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            onClick={() => onSelectFolder(folder.id)}
                            isActive={selectedFolderId === folder.id}
                          >
                            <div
                              className="h-4 w-4 rounded-sm shrink-0"
                              style={{ backgroundColor: folder.color || "#6B7280" }}
                            />
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{folder.name} ({contactCountByFolder[folder.id] || 0})</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <>
                      <DroppableFolder
                        folder={folder}
                        isSelected={selectedFolderId === folder.id}
                        contactCount={contactCountByFolder[folder.id] || 0}
                        onClick={() => onSelectFolder(folder.id)}
                      />

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
                    </>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Trash */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        onClick={onSelectTrash}
                        isActive={showTrash}
                        className="w-full"
                      >
                        <Trash className="h-4 w-4" />
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-left">Trash</span>
                            {trashCount > 0 && (
                              <span className="text-xs opacity-70">{trashCount}</span>
                            )}
                          </>
                        )}
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right">
                        <p>Trash {trashCount > 0 ? `(${trashCount})` : ""}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <FolderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveFolder}
        folder={editingFolder}
      />
    </Sidebar>
  );
}
