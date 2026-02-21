import { useState, useEffect, useRef } from "react";
import { FolderPlus, MoreHorizontal, Pencil, Trash, Trash2, Users, Building2, ChevronLeft, ChevronRight, ChevronDown, UserCircle, Briefcase, Menu, Lock } from "lucide-react";
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
import { Folder as FolderType, DirectoryType } from "@/types/folder";
import { Contact } from "@/types/contact";
import { ContactOwnershipFilter } from "@/types/contact";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { LockedFeatureButton } from "@/components/LockedFeatureButton";
import { WhoNowLogo } from "@/components/WhoNowLogo";
import { useBranding } from "@/hooks/useBranding";

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
  companyMembers?: Contact[];
  showDirectory?: boolean;
  onSelectDirectory?: () => void;
  // Ownership filtering
  hasCompany?: boolean;
  ownershipFilter?: ContactOwnershipFilter;
  onOwnershipFilterChange?: (filter: ContactOwnershipFilter) => void;
  personalContactsCount?: number;
  sharedContactsCount?: number;
  // Client Directory props
  showClientDirectory?: boolean;
  onSelectClientDirectory?: () => void;
  clientDirectoryCount?: number;
  clientFolders?: FolderType[];
  selectedClientFolderId?: string | null;
  onSelectClientFolder?: (folderId: string | null) => void;
  // Team Directory props
  teamFolders?: FolderType[];
  selectedTeamFolderId?: string | null;
  onSelectTeamFolder?: (folderId: string | null) => void;
  // Organization folders props
  organizationFolders?: FolderType[];
  organizationClientFolders?: FolderType[];
  organizationTeamFolders?: FolderType[];
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
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
  clientFolders = [],
  selectedClientFolderId,
  onSelectClientFolder,
  teamFolders = [],
  selectedTeamFolderId,
  onSelectTeamFolder,
  organizationFolders = [],
  organizationClientFolders = [],
  organizationTeamFolders = [],
  isAdmin = false,
  isSuperAdmin = false,
}: FolderSidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [activeDirectoryType, setActiveDirectoryType] = useState<DirectoryType>("contacts");
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { canAccessFeature } = useSubscription();
  const branding = useBranding();
  
  // Helper functions for localStorage
  const loadDirectoryState = (key: string, defaultValue: boolean): boolean => {
    if (typeof window === "undefined") return defaultValue;
    const saved = localStorage.getItem(`directory:${key}`);
    return saved !== null ? saved === "true" : defaultValue;
  };

  const saveDirectoryState = (key: string, value: boolean) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`directory:${key}`, value.toString());
  };

  // State for collapsed/expanded directories - load from localStorage
  const [isContactDirectoryExpanded, setIsContactDirectoryExpanded] = useState(() => 
    loadDirectoryState("contact", true)
  );
  const [isClientDirectoryExpanded, setIsClientDirectoryExpanded] = useState(() => 
    loadDirectoryState("client", true)
  );
  const [isTeamDirectoryExpanded, setIsTeamDirectoryExpanded] = useState(() => 
    loadDirectoryState("team", true)
  );

  // Wrapper functions that save to localStorage when user manually toggles
  const toggleContactDirectory = () => {
    const newValue = !isContactDirectoryExpanded;
    setIsContactDirectoryExpanded(newValue);
    if (!isCollapsed) {
      saveDirectoryState("contact", newValue);
    }
  };

  const toggleClientDirectory = () => {
    const newValue = !isClientDirectoryExpanded;
    setIsClientDirectoryExpanded(newValue);
    if (!isCollapsed) {
      saveDirectoryState("client", newValue);
    }
  };

  const toggleTeamDirectory = () => {
    const newValue = !isTeamDirectoryExpanded;
    setIsTeamDirectoryExpanded(newValue);
    if (!isCollapsed) {
      saveDirectoryState("team", newValue);
    }
  };

  // When sidebar is collapsed, collapse all directories
  // When sidebar is expanded, restore saved states
  useEffect(() => {
    if (isCollapsed) {
      // Sidebar collapsed - collapse all directories (don't save to localStorage)
      setIsContactDirectoryExpanded(false);
      setIsClientDirectoryExpanded(false);
      setIsTeamDirectoryExpanded(false);
    } else {
      // Sidebar expanded - restore saved states from localStorage
      const savedContact = loadDirectoryState("contact", true);
      const savedClient = loadDirectoryState("client", true);
      const savedTeam = loadDirectoryState("team", true);
      setIsContactDirectoryExpanded(savedContact);
      setIsClientDirectoryExpanded(savedClient);
      setIsTeamDirectoryExpanded(savedTeam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed]);

  // Helper functions to check if directory was expanded
  // When collapsed, check localStorage (state before collapse)
  // When expanded, check state variable (current state)
  const wasContactDirectoryExpanded = isCollapsed 
    ? loadDirectoryState("contact", true)
    : isContactDirectoryExpanded;
  const wasClientDirectoryExpanded = isCollapsed
    ? loadDirectoryState("client", true)
    : isClientDirectoryExpanded;
  const wasTeamDirectoryExpanded = isCollapsed
    ? loadDirectoryState("team", true)
    : isTeamDirectoryExpanded;
  
  const hasClientAccess = canAccessFeature("client_management");
  const hasTeamAccess = canAccessFeature("team_features");

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
    setActiveDirectoryType(folder.directoryType);
    setDialogOpen(true);
  };

  const handleAddFolder = (directoryType: DirectoryType = "contacts") => {
    setEditingFolder(null);
    setActiveDirectoryType(directoryType);
    setDialogOpen(true);
  };

  // Get existing folder names for the active directory type for validation
  const getExistingNamesForDirectory = (type: DirectoryType): string[] => {
    switch (type) {
      case "clients":
        return [...clientFolders, ...organizationClientFolders].map((f) => f.name);
      case "team":
        return [...teamFolders, ...organizationTeamFolders].map((f) => f.name);
      default:
        return [...folders, ...organizationFolders].map((f) => f.name);
    }
  };

  // Check if user can edit/delete a folder
  const canManageFolder = (folder: FolderType): boolean => {
    // Organization folders can only be managed by admins
    if (folder.isOrganizationFolder) {
      return isAdmin;
    }
    // Personal folders can be managed by the owner
    return true;
  };

  return (
    <div className="relative">
      <Sidebar collapsible="icon" className="border-r border-border">
        <SidebarHeader className="p-2">
          <div className={cn(
            "flex items-center gap-2",
            isCollapsed ? "justify-center" : "justify-start px-2"
          )}>
            {/* Hamburger Menu Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={toggleSidebar}
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Company Logo */}
            {!isCollapsed && (
              <WhoNowLogo size="sm" showText={true} className="min-w-0 flex-1 overflow-hidden" />
            )}
          </div>
        </SidebarHeader>

        <TooltipProvider>
          <SidebarContent>
          {/* Contact Directory Section */}
          <SidebarGroup>
            {!isCollapsed && (
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-1.5 flex-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -ml-1"
                        onClick={toggleContactDirectory}
                      >
                        {isContactDirectoryExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <SidebarGroupLabel className="p-0 cursor-pointer" onClick={toggleContactDirectory}>
                        Contact Directory
                      </SidebarGroupLabel>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        onClick={() => handleAddFolder("contacts")}
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Add folder</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {/* All Contacts - droppable to remove from folders */}
                <SidebarMenuItem>
                  <DroppableAllContacts
                    isSelected={isCollapsed 
                      ? selectedFolderId === null && !showTrash && !showDirectory && !showClientDirectory && ownershipFilter === "all"
                      : selectedFolderId === null && ownershipFilter === "all" && !showClientDirectory && !showDirectory}
                    totalContacts={totalContacts}
                    onClick={() => {
                      onSelectFolder(null);
                      onOwnershipFilterChange?.("all");
                    }}
                    showTrash={showTrash}
                    collapsed={isCollapsed}
                    tooltip={isCollapsed ? `All Contacts (${totalContacts})` : undefined}
                  />
                </SidebarMenuItem>

                {/* Personal/Shared filter - only show for company users */}
                {hasCompany && !isCollapsed && isContactDirectoryExpanded && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => {
                          onSelectFolder(null);
                          onOwnershipFilterChange?.("personal");
                        }}
                        isActive={ownershipFilter === "personal" && !showTrash && !showDirectory && !showClientDirectory}
                        className="w-full pl-6 min-w-0"
                      >
                        <UserCircle className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left min-w-0 truncate">Personal</span>
                        <span className="text-xs opacity-70 shrink-0">{personalContactsCount}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => {
                          onSelectFolder(null);
                          onOwnershipFilterChange?.("shared");
                        }}
                        isActive={ownershipFilter === "shared" && !showTrash && !showDirectory && !showClientDirectory}
                        className="w-full pl-6 min-w-0"
                      >
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left min-w-0 truncate">Shared</span>
                        <span className="text-xs opacity-70 shrink-0">{sharedContactsCount}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}

                {/* Collapsed mode: Personal/Shared icons */}
                {hasCompany && isCollapsed && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => {
                          onSelectFolder(null);
                          onOwnershipFilterChange?.("personal");
                        }}
                        isActive={ownershipFilter === "personal" && !showTrash && !showDirectory && !showClientDirectory}
                        tooltip={`Personal (${personalContactsCount})`}
                        className="w-full"
                      >
                        <UserCircle className="h-4 w-4" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => {
                          onSelectFolder(null);
                          onOwnershipFilterChange?.("shared");
                        }}
                        isActive={ownershipFilter === "shared" && !showTrash && !showDirectory && !showClientDirectory}
                        tooltip={`Shared (${sharedContactsCount})`}
                        className="w-full"
                      >
                        <Building2 className="h-4 w-4" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}

                {/* Personal Contact Folders */}
                {wasContactDirectoryExpanded && folders.map((folder) => (
                  <SidebarMenuItem key={folder.id} className="group relative">
                    <DroppableFolder
                      folder={folder}
                      isSelected={selectedFolderId === folder.id}
                      contactCount={contactCountByFolder[folder.id] || 0}
                      onClick={() => onSelectFolder(folder.id)}
                      collapsed={isCollapsed}
                      tooltip={isCollapsed ? folder.name : undefined}
                    />
                    {!isCollapsed && canManageFolder(folder) && (
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
                    )}
                  </SidebarMenuItem>
                ))}

                {/* Organization Contact Folders */}
                {hasCompany && organizationFolders.length > 0 && wasContactDirectoryExpanded && (
                  <>
                    {!isCollapsed && (
                      <div className="px-2 py-1.5 mt-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Building2 className="h-3 w-3" />
                          Organization
                        </p>
                      </div>
                    )}
                    {organizationFolders.map((folder) => (
                      <SidebarMenuItem key={folder.id} className="group relative">
                        <DroppableFolder
                          folder={folder}
                          isSelected={selectedFolderId === folder.id}
                          contactCount={contactCountByFolder[folder.id] || 0}
                          onClick={() => onSelectFolder(folder.id)}
                          collapsed={isCollapsed}
                          tooltip={isCollapsed ? `${folder.name} (Organization)` : undefined}
                        />
                        {!isCollapsed && canManageFolder(folder) && (
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
                        )}
                      </SidebarMenuItem>
                    ))}
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Client Directory - show for all users but lock for Starter */}
          {onSelectClientDirectory && (
            <>
              <SidebarGroup>
                {!isCollapsed && (
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -ml-1"
                        onClick={toggleClientDirectory}
                      >
                        {isClientDirectoryExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <SidebarGroupLabel className="p-0 cursor-pointer" onClick={toggleClientDirectory}>
                        Client Directory
                      </SidebarGroupLabel>
                    </div>
                    {hasClientAccess && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6" 
                              onClick={() => handleAddFolder("clients")}
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>Add client folder</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      {hasClientAccess ? (
                        <SidebarMenuButton
                          onClick={() => {
                            onSelectClientDirectory();
                            onSelectClientFolder?.(null);
                          }}
                          isActive={showClientDirectory && selectedClientFolderId === null}
                          tooltip={isCollapsed ? `Client Directory (${clientDirectoryCount})` : undefined}
                          className="w-full min-w-0"
                          data-onboarding-client-directory
                        >
                          <Briefcase className="h-4 w-4 shrink-0" />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-left min-w-0 truncate">All Clients</span>
                              <span className="text-xs opacity-70 shrink-0">{clientDirectoryCount}</span>
                            </>
                          )}
                        </SidebarMenuButton>
                      ) : (
                        <LockedFeatureButton feature="client_management" minimumTier="pro" hideLockIcon={isCollapsed}>
                          <SidebarMenuButton 
                            tooltip={isCollapsed ? {
                              children: (
                                <div className="flex items-center gap-1.5">
                                  <span>Client Directory</span>
                                  <Lock className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )
                            } : undefined}
                            className="w-full opacity-70 min-w-0"
                            data-onboarding-client-directory
                          >
                            <Briefcase className="h-4 w-4 shrink-0" />
                            {!isCollapsed && (
                              <span className="flex-1 text-left min-w-0 truncate">Client Directory</span>
                            )}
                          </SidebarMenuButton>
                        </LockedFeatureButton>
                      )}
                    </SidebarMenuItem>

                    {/* Personal Client Folders */}
                    {hasClientAccess && wasClientDirectoryExpanded && clientFolders.map((folder) => (
                      <SidebarMenuItem key={folder.id} className="group relative">
                        <SidebarMenuButton
                          onClick={() => {
                            onSelectClientDirectory();
                            onSelectClientFolder?.(folder.id);
                          }}
                          isActive={showClientDirectory && selectedClientFolderId === folder.id}
                          tooltip={isCollapsed ? folder.name : undefined}
                          className={isCollapsed ? "w-full" : "w-full pl-6"}
                        >
                          <div
                            className={isCollapsed ? "h-4 w-4 rounded-sm shrink-0" : "h-3 w-3 rounded-sm shrink-0"}
                            style={{ backgroundColor: folder.color || "#6B7280" }}
                          />
                          {!isCollapsed && (
                            <span className="flex-1 text-left truncate">{folder.name}</span>
                          )}
                        </SidebarMenuButton>
                        {!isCollapsed && canManageFolder(folder) && (
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
                        )}
                      </SidebarMenuItem>
                    ))}

                    {/* Organization Client Folders */}
                    {hasClientAccess && hasCompany && organizationClientFolders.length > 0 && wasClientDirectoryExpanded && (
                      <>
                        {!isCollapsed && (
                          <div className="px-2 py-1.5 mt-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Building2 className="h-3 w-3" />
                              Organization
                            </p>
                          </div>
                        )}
                        {organizationClientFolders.map((folder) => (
                          <SidebarMenuItem key={folder.id} className="group relative">
                            <SidebarMenuButton
                              onClick={() => {
                                onSelectClientDirectory();
                                onSelectClientFolder?.(folder.id);
                              }}
                              isActive={showClientDirectory && selectedClientFolderId === folder.id}
                              tooltip={isCollapsed ? `${folder.name} (Organization)` : undefined}
                              className={isCollapsed ? "w-full" : "w-full pl-6"}
                            >
                              <div
                                className={isCollapsed ? "h-4 w-4 rounded-sm shrink-0" : "h-3 w-3 rounded-sm shrink-0"}
                                style={{ backgroundColor: folder.color || "#6B7280" }}
                              />
                              {!isCollapsed && (
                                <span className="flex-1 text-left truncate">{folder.name}</span>
                              )}
                            </SidebarMenuButton>
                            {!isCollapsed && canManageFolder(folder) && (
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
                            )}
                          </SidebarMenuItem>
                        ))}
                      </>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
            </>
          )}

          {/* Team Directory - only show if company members exist AND user has team access */}
          {hasTeamAccess && companyMembers.length > 0 && onSelectDirectory && (
            <>
              <SidebarGroup>
                {!isCollapsed && (
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -ml-1"
                        onClick={toggleTeamDirectory}
                      >
                        {isTeamDirectoryExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <SidebarGroupLabel className="p-0 cursor-pointer" onClick={toggleTeamDirectory}>
                        Team Directory
                      </SidebarGroupLabel>
                    </div>
                    {(isAdmin || isSuperAdmin) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6" 
                              onClick={() => handleAddFolder("team")}
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>Add team folder</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={() => {
                            onSelectDirectory();
                            onSelectTeamFolder?.(null);
                          }}
                          isActive={showDirectory && selectedTeamFolderId === null}
                          tooltip={isCollapsed ? `Team Directory (${companyMembers.length})` : undefined}
                          className="w-full min-w-0"
                        >
                          <Building2 className="h-4 w-4 shrink-0" />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-left min-w-0 truncate">All Team Members</span>
                              <span className="text-xs opacity-70 shrink-0">{companyMembers.length}</span>
                            </>
                          )}
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Personal Team Folders */}
                    {wasTeamDirectoryExpanded && teamFolders.map((folder) => (
                      <SidebarMenuItem key={folder.id} className="group relative">
                        <SidebarMenuButton
                          onClick={() => {
                            onSelectDirectory();
                            onSelectTeamFolder?.(folder.id);
                          }}
                          isActive={showDirectory && selectedTeamFolderId === folder.id}
                          tooltip={isCollapsed ? folder.name : undefined}
                          className={isCollapsed ? "w-full" : "w-full pl-6"}
                        >
                          <div
                            className={isCollapsed ? "h-4 w-4 rounded-sm shrink-0" : "h-3 w-3 rounded-sm shrink-0"}
                            style={{ backgroundColor: folder.color || "#6B7280" }}
                          />
                          {!isCollapsed && (
                            <span className="flex-1 text-left truncate">{folder.name}</span>
                          )}
                        </SidebarMenuButton>
                        {!isCollapsed && canManageFolder(folder) && (
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
                        )}
                      </SidebarMenuItem>
                    ))}

                    {/* Organization Team Folders */}
                    {hasCompany && organizationTeamFolders.length > 0 && wasTeamDirectoryExpanded && (
                      <>
                        {!isCollapsed && (
                          <div className="px-2 py-1.5 mt-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Building2 className="h-3 w-3" />
                              Organization
                            </p>
                          </div>
                        )}
                        {organizationTeamFolders.map((folder) => (
                          <SidebarMenuItem key={folder.id} className="group relative">
                            <SidebarMenuButton
                              onClick={() => {
                                onSelectDirectory();
                                onSelectTeamFolder?.(folder.id);
                              }}
                              isActive={showDirectory && selectedTeamFolderId === folder.id}
                              tooltip={isCollapsed ? `${folder.name} (Organization)` : undefined}
                              className={isCollapsed ? "w-full" : "w-full pl-6"}
                            >
                              <div
                                className={isCollapsed ? "h-4 w-4 rounded-sm shrink-0" : "h-3 w-3 rounded-sm shrink-0"}
                                style={{ backgroundColor: folder.color || "#6B7280" }}
                              />
                              {!isCollapsed && (
                                <span className="flex-1 text-left truncate">{folder.name}</span>
                              )}
                            </SidebarMenuButton>
                            {!isCollapsed && canManageFolder(folder) && (
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
                            )}
                          </SidebarMenuItem>
                        ))}
                      </>
                    )}
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
                  <SidebarMenuButton
                    onClick={onSelectTrash}
                    isActive={showTrash}
                    tooltip={isCollapsed ? `Trash${trashCount > 0 ? ` (${trashCount})` : ""}` : undefined}
                    className="w-full min-w-0"
                  >
                    <Trash className="h-4 w-4 shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left min-w-0 truncate">Trash</span>
                        {trashCount > 0 && (
                          <span className="text-xs opacity-70 shrink-0">{trashCount}</span>
                        )}
                      </>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        </TooltipProvider>

        <FolderFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={handleSaveFolder}
          folder={editingFolder}
          directoryType={activeDirectoryType}
          existingNames={getExistingNamesForDirectory(activeDirectoryType)}
          isAdmin={isAdmin}
          hasCompany={hasCompany}
        />
      </Sidebar>

    </div>
  );
}
