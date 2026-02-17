import { Trash2, X, Folder as FolderIcon, Clock, Star, RotateCcw, Users, Share2, MessageSquare, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShareToSlackDialog } from "@/components/ShareToSlackDialog";
import { ShareToTeamsDialog } from "@/components/ShareToTeamsDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LockedFeatureButton } from "@/components/LockedFeatureButton";
import { cn } from "@/lib/utils";
import { Folder } from "@/types/folder";
import { useState } from "react";

interface SelectionToolbarProps {
  selectedCount: number;
  allSelected: boolean;
  onSelectAll: (selected: boolean) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkMoveToFolder?: (ids: string[], folderId: string | null) => void;
  onBulkMarkContacted?: (ids: string[]) => void;
  onBulkToggleClient?: (ids: string[], isClient: boolean) => void;
  onBulkShare?: (ids: string[]) => void;
  onBulkRestore?: (ids: string[]) => void;
  hasClientAccess?: boolean;
  hasCompany?: boolean;
  folders?: Folder[];
  selectedContactIds: Set<string>;
  onToggleSelectionMode: () => void;
  isTrashView?: boolean;
}

export function SelectionToolbar({
  selectedCount,
  allSelected,
  onSelectAll,
  onBulkDelete,
  onBulkMoveToFolder,
  onBulkMarkContacted,
  onBulkToggleClient,
  onBulkShare,
  onBulkRestore,
  hasClientAccess = false,
  hasCompany = false,
  folders = [],
  selectedContactIds,
  onToggleSelectionMode,
  isTrashView = false,
}: SelectionToolbarProps) {
  const [folderPopoverOpen, setFolderPopoverOpen] = useState(false);
  const [slackShareDialogOpen, setSlackShareDialogOpen] = useState(false);
  const [teamsShareDialogOpen, setTeamsShareDialogOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-2 sm:gap-2 min-w-0 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectAll(!allSelected)}
                className="shrink-0 h-8 px-2 gap-1.5"
              >
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onSelectAll(checked === true)}
                  className="h-4 w-4 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm font-medium whitespace-nowrap">
                  {selectedCount > 0 
                    ? `${selectedCount} selected`
                    : "Select all"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{allSelected ? "Deselect all" : "Select all"}</p>
            </TooltipContent>
          </Tooltip>
          {/* Trash view: only show restore button */}
          {isTrashView && onBulkRestore && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const ids = Array.from(selectedContactIds);
                    onBulkRestore(ids);
                  }}
                  disabled={selectedCount === 0}
                  className="shrink-0 h-8 px-2"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Restore selected</p>
              </TooltipContent>
            </Tooltip>
          )}
          {/* Normal view: show delete and other actions */}
          {!isTrashView && onBulkDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const ids = Array.from(selectedContactIds);
                    onBulkDelete(ids);
                  }}
                  disabled={selectedCount === 0}
                  className="shrink-0 h-8 px-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete selected</p>
              </TooltipContent>
            </Tooltip>
          )}
          {!isTrashView && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedCount === 0}
                      className="shrink-0 h-8 px-2"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Share selected to Slack or Teams</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => setSlackShareDialogOpen(true)}
                  disabled={selectedCount === 0}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Share to Slack
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTeamsShareDialogOpen(true)}
                  disabled={selectedCount === 0}
                >
                  <Video className="h-4 w-4 mr-2" />
                  Share to Teams
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!isTrashView && hasCompany && onBulkShare && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ids = Array.from(selectedContactIds);
                    onBulkShare(ids);
                  }}
                  disabled={selectedCount === 0}
                  className="shrink-0 h-8 px-2"
                >
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Share with organization</p>
              </TooltipContent>
            </Tooltip>
          )}
          {!isTrashView && folders.length > 0 && onBulkMoveToFolder && (
            <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedCount === 0}
                      className="shrink-0 h-8 px-2"
                    >
                      <FolderIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Move to folder</p>
                </TooltipContent>
              </Tooltip>
              <PopoverContent 
                className="w-56 p-1.5" 
                align="start"
              >
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      const ids = Array.from(selectedContactIds);
                      onBulkMoveToFolder(ids, null);
                      setFolderPopoverOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150",
                      "hover:bg-accent hover:text-accent-foreground text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <FolderIcon className="h-4 w-4" />
                      <span>No folder</span>
                    </span>
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => {
                        const ids = Array.from(selectedContactIds);
                        onBulkMoveToFolder(ids, folder.id);
                        setFolderPopoverOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150",
                        "hover:bg-accent hover:text-accent-foreground text-foreground"
                      )}
                    >
                      <span className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span 
                          className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-border/50" 
                          style={{ backgroundColor: folder.color }}
                        />
                        <span className="truncate">{folder.name}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {!isTrashView && onBulkMarkContacted && (
            hasClientAccess ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const ids = Array.from(selectedContactIds);
                      onBulkMarkContacted(ids);
                    }}
                    disabled={selectedCount === 0}
                    className="shrink-0 h-8 px-2"
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mark as contacted</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <LockedFeatureButton feature="client_management" minimumTier="pro" className="shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedCount === 0}
                      className="shrink-0 h-8 px-2 opacity-70"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mark as contacted</p>
                  </TooltipContent>
                </Tooltip>
              </LockedFeatureButton>
            )
          )}
          {!isTrashView && onBulkToggleClient && (
            hasClientAccess ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const ids = Array.from(selectedContactIds);
                      onBulkToggleClient(ids, true);
                    }}
                    disabled={selectedCount === 0}
                    className="shrink-0 h-8 px-2"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mark as client</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <LockedFeatureButton feature="client_management" minimumTier="pro" className="shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedCount === 0}
                      className="shrink-0 h-8 px-2 opacity-70"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mark as client</p>
                  </TooltipContent>
                </Tooltip>
              </LockedFeatureButton>
            )
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSelectionMode}
            className="shrink-0 h-8 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ShareToSlackDialog
        open={slackShareDialogOpen}
        onOpenChange={setSlackShareDialogOpen}
        contactIds={Array.from(selectedContactIds)}
      />
      <ShareToTeamsDialog
        open={teamsShareDialogOpen}
        onOpenChange={setTeamsShareDialogOpen}
        contactIds={Array.from(selectedContactIds)}
      />
    </TooltipProvider>
  );
}
