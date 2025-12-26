import { useState } from "react";
import { FolderPlus, MoreHorizontal, Pencil, Trash, Trash2, Users, Building2, ChevronLeft, ChevronRight, UserCircle, Briefcase } from "lucide-react";
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
import { DroppableAllContacts } from "@/components/DroppableAllContacts";
import { Folder as FolderType } from "@/types/folder";
import { Profile } from "@/types/profile";
import { ContactOwnershipFilter } from "@/types/contact";
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
  companyMembers?: Profile[];
  showDirectory?: boolean;
  onSelectDirectory?: () => void;
  // New props for ownership filtering
  hasCompany?: boolean;
  ownershipFilter?: ContactOwnershipFilter;
  onOwnershipFilterChange?: (filter: ContactOwnershipFilter) => void;
  personalContactsCount?: number;
  sharedContactsCount?: number;
  // Client Directory props
  showClientDirectory?: boolean;
  onSelectClientDirectory?: () => void;
  clientDirectoryCount?: number;
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
  companyMembers = [],
  showDirectory = false,
  onSelectDirectory,
  hasCompany = false,
  ownershipFilter = "all",
  onOwnershipFilterChange,
  personalContactsCount = 0,
  sharedContactsCount = 0,
  showClientDirectory = false,
  onSelectClientDirectory,
  clientDirectoryCount = 0,
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

  const { toggleSidebar } = useSidebar();

  return (
    <div className="relative">
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
                {/* All Contacts - droppable to remove from folders */}
                <SidebarMenuItem>
                  {isCollapsed ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            onClick={() => {
                              onSelectFolder(null);
                              onOwnershipFilterChange?.("all");
                            }}
                            isActive={selectedFolderId === null && !showTrash && !showDirectory && ownershipFilter === "all"}
                            className="w-full"
                          >
                            <Users className="h-4 w-4" />
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>All Contacts ({totalContacts})</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <DroppableAllContacts
                      isSelected={selectedFolderId === null && ownershipFilter === "all"}
                      totalContacts={totalContacts}
                      onClick={() => {
                        onSelectFolder(null);
                        onOwnershipFilterChange?.("all");
                      }}
                      showTrash={showTrash}
                    />
                  )}
                </SidebarMenuItem>

                {/* Personal/Shared filter - only show for company users */}
                {hasCompany && !isCollapsed && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => {
                          onSelectFolder(null);
                          onOwnershipFilterChange?.("personal");
                        }}
                        isActive={ownershipFilter === "personal" && !showTrash && !showDirectory}
                        className="w-full pl-6"
                      >
                        <UserCircle className="h-4 w-4" />
                        <span className="flex-1 text-left">Personal</span>
                        <span className="text-xs opacity-70">{personalContactsCount}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => {
                          onSelectFolder(null);
                          onOwnershipFilterChange?.("shared");
                        }}
                        isActive={ownershipFilter === "shared" && !showTrash && !showDirectory}
                        className="w-full pl-6"
                      >
                        <Building2 className="h-4 w-4" />
                        <span className="flex-1 text-left">Shared</span>
                        <span className="text-xs opacity-70">{sharedContactsCount}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}

                {/* Collapsed mode: Personal/Shared icons */}
                {hasCompany && isCollapsed && (
                  <>
                    <SidebarMenuItem>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              onClick={() => {
                                onSelectFolder(null);
                                onOwnershipFilterChange?.("personal");
                              }}
                              isActive={ownershipFilter === "personal" && !showTrash && !showDirectory}
                              className="w-full"
                            >
                              <UserCircle className="h-4 w-4" />
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>Personal ({personalContactsCount})</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              onClick={() => {
                                onSelectFolder(null);
                                onOwnershipFilterChange?.("shared");
                              }}
                              isActive={ownershipFilter === "shared" && !showTrash && !showDirectory}
                              className="w-full"
                            >
                              <Building2 className="h-4 w-4" />
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>Shared ({sharedContactsCount})</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                  </>
                )}

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

          {/* Client Directory - always show for all users */}
          {onSelectClientDirectory && (
            <>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              onClick={onSelectClientDirectory}
                              isActive={showClientDirectory}
                              className="w-full"
                            >
                              <Briefcase className="h-4 w-4" />
                              {!isCollapsed && (
                                <>
                                  <span className="flex-1 text-left">Client Directory</span>
                                  <span className="text-xs opacity-70">{clientDirectoryCount}</span>
                                </>
                              )}
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right">
                              <p>Client Directory ({clientDirectoryCount})</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
            </>
          )}

          {/* Team Directory - only show if company members exist */}
          {companyMembers.length > 0 && onSelectDirectory && (
            <>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              onClick={onSelectDirectory}
                              isActive={showDirectory}
                              className="w-full"
                            >
                              <Building2 className="h-4 w-4" />
                              {!isCollapsed && (
                                <>
                                  <span className="flex-1 text-left">Team Directory</span>
                                  <span className="text-xs opacity-70">{companyMembers.length}</span>
                                </>
                              )}
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right">
                              <p>Team Directory ({companyMembers.length})</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
            </>
          )}

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

      {/* Collapse Toggle Arrow - positioned outside sidebar to avoid clipping */}
      <button
        onClick={toggleSidebar}
        className={cn(
          "fixed top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-accent transition-all duration-200",
          isCollapsed ? "left-[calc(var(--sidebar-width-icon)-0.75rem)]" : "left-[calc(var(--sidebar-width)-0.75rem)]"
        )}
        style={{
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
        } as React.CSSProperties}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
