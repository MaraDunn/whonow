import React from "react";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { Mail, Phone, Building2, Briefcase, MessageSquare, Trash2, RotateCcw, Folder as FolderIcon, User, Users, UserCircle, Clock, Star, ChevronDown, Check } from "lucide-react";
import { ActionType } from "@/hooks/useActionSearch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { LockedFeatureButton, dialogJustClosed } from "@/components/LockedFeatureButton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

// Name block min-heights for consistent card layout (two lines each)
const NAME_BLOCK_MIN_H_DESKTOP = "2.75rem"; // text-lg, two lines
const NAME_BLOCK_MIN_H_COMPACT = "2rem"; // text-xs, two lines

// Helper to format last contacted time
function formatLastContacted(lastContactedAt?: string): string | null {
  if (!lastContactedAt) return null;
  try {
    return formatDistanceToNow(new Date(lastContactedAt), { addSuffix: true });
  } catch {
    return null;
  }
}

interface ContactCardProps {
  contact: Contact;
  index: number;
  action?: ActionType;
  onEdit: () => void;
  onView?: () => void;
  isTrashView?: boolean;
  onDelete?: () => void;
  onRestore?: () => void;
  onPermanentlyDelete?: () => void;
  folder?: Folder;
  folders?: Folder[];
  onUpdateFolder?: (contactId: string, folderId: string | null) => void;
  showOwnershipBadge?: boolean;
  onMarkContacted?: () => void;
  onToggleClient?: (isClient: boolean) => void;
  hasClientAccess?: boolean; // Pass from parent to avoid calling useSubscription in every card
  /** When true, show an "Internal" badge (same-company / team member). Used in All Contacts and Client Directory. */
  isInternal?: boolean;
  /** When true, show a "You" badge (this contact is the current user's profile). */
  isCurrentUser?: boolean;
  // Mobile/Tablet compact mode props
  compact?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  // Selection props
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  selectionMode?: boolean;
}

const ContactCardComponent = function ContactCard({ 
  contact, 
  index, 
  action, 
  onEdit,
  onView,
  isTrashView = false,
  onDelete,
  onRestore,
  onPermanentlyDelete,
  folder,
  folders = [],
  onUpdateFolder,
  showOwnershipBadge = false,
  onMarkContacted,
  onToggleClient,
  hasClientAccess = false,
  isInternal = false,
  isCurrentUser = false,
  compact = false,
  isExpanded = false,
  onToggleExpand,
  isSelected = false,
  onSelect,
  selectionMode = false,
}: ContactCardProps) {
  const [folderPopoverOpen, setFolderPopoverOpen] = React.useState(false);

  // Memoize folder map for quick lookup
  const folderMap = React.useMemo(() => 
    new Map(folders.map(f => [f.id, f])),
    [folders]
  );

  const handleFolderChange = React.useCallback((newFolderId: string | null) => {
    if (onUpdateFolder) {
      onUpdateFolder(contact.id, newFolderId);
      const folderName = newFolderId 
        ? folderMap.get(newFolderId)?.name || "folder"
        : "No folder";
      toast.success(`Moved to ${folderName}`);
      setFolderPopoverOpen(false);
    }
  }, [onUpdateFolder, contact.id, folderMap]);
  
  // Memoize initials calculation
  const initials = React.useMemo(() => 
    contact.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase(),
    [contact.name]
  );

  // Memoize last contacted text
  const lastContactedText = React.useMemo(() => 
    formatLastContacted(contact.lastContactedAt),
    [contact.lastContactedAt]
  );

  const handleAction = React.useCallback((type: ActionType) => {
    if (!type) return;
    
    switch (type) {
      case "email":
        window.location.href = `mailto:${contact.email}`;
        break;
      case "call":
        window.location.href = `tel:${contact.phone}`;
        break;
      case "text":
        window.location.href = `sms:${contact.phone}`;
        break;
    }
  }, [contact.email, contact.phone]);

  const actionConfig = {
    email: { icon: Mail, label: "Email", color: "bg-primary hover:bg-primary/90" },
    call: { icon: Phone, label: "Call", color: "bg-green-600 hover:bg-green-700" },
    text: { icon: MessageSquare, label: "Text", color: "bg-blue-600 hover:bg-blue-700" },
  };

  const handleCardClick = React.useCallback((e?: React.MouseEvent) => {
    if (isTrashView) return;
    
    // In selection mode, clicking anywhere on the card toggles selection (checkbox uses stopPropagation)
    if (selectionMode && onSelect) {
      onSelect(!isSelected);
      return;
    }
    
    // Prevent card click if dialog was just closed
    if (dialogJustClosed) {
      return;
    }
    
    // Check if the click originated from a locked button area
    if (e?.target instanceof HTMLElement) {
      const target = e.target as HTMLElement;
      // Check if click is within a LockedFeatureButton wrapper
      const lockedButtonWrapper = target.closest('[data-locked-feature-button]');
      if (lockedButtonWrapper) {
        return;
      }
    }
    
    if (compact && onToggleExpand) {
      onToggleExpand();
    } else {
      // Use onView if provided, otherwise fall back to onEdit for backwards compatibility
      if (onView) {
        onView();
      } else {
        onEdit();
      }
    }
  }, [isTrashView, selectionMode, onSelect, isSelected, compact, onToggleExpand, onView, onEdit]);

  // Compact mode for mobile/tablet - collapsed state
  if (compact && !isExpanded) {
    return (
      <div
        onClick={(e) => handleCardClick(e)}
        className={cn(
          "group relative p-2 rounded-lg border transition-all duration-200 cursor-pointer animate-slide-up",
          selectionMode 
            ? isSelected 
              ? "border-primary bg-primary/5 shadow-md" 
              : "border-border bg-card shadow-sm"
            : "border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30"
        )}
        style={{ animationDelay: `${index * 20}ms` }}
      >
        {/* Selection checkbox */}
        {selectionMode && onSelect && (
          <div className="absolute top-1.5 right-1.5 z-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(checked === true)}
              className="h-3.5 w-3.5"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-md gradient-hero flex items-center justify-center text-primary-foreground font-display font-medium text-xs">
              {initials}
            </div>
          </div>

          {/* Name and Company */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1" style={{ minHeight: NAME_BLOCK_MIN_H_COMPACT }}>
                <h3 className="font-display font-medium text-xs text-foreground line-clamp-2" title={contact.name}>
                  {contact.name}
                </h3>
              </div>
              {isCurrentUser && (
                <User className="h-2.5 w-2.5 text-primary flex-shrink-0" aria-label="You" />
              )}
              {contact.isClient && (
                <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500 flex-shrink-0" />
              )}
              {isInternal && (
                <Building2 className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" aria-label="Internal" />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              {contact.company}
            </p>
          </div>

          {/* Expand indicator */}
          <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0 transition-transform" />
        </div>
      </div>
    );
  }

  // Compact mode for mobile/tablet - expanded state
  if (compact && isExpanded) {
    return (
      <div
        className={cn(
          "group relative p-4 rounded-xl border transition-all duration-300 animate-scale-in",
          selectionMode 
            ? isSelected 
              ? "border-primary bg-primary/5 shadow-md" 
              : "border-border bg-card shadow-sm"
            : "border-primary/30 bg-card shadow-md"
        )}
      >
        {/* Selection checkbox */}
        {selectionMode && onSelect && (
          <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(checked === true)}
              className="h-4 w-4"
            />
          </div>
        )}
        {/* Header with collapse */}
        <div className="flex items-center gap-3 mb-3" onClick={(e) => handleCardClick(e)}>
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-lg gradient-hero flex items-center justify-center text-primary-foreground font-display font-semibold text-base">
              {initials}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="min-w-0 flex-1" style={{ minHeight: NAME_BLOCK_MIN_H_COMPACT }}>
                <h3 className="font-display font-semibold text-base text-foreground line-clamp-2" title={contact.name}>
                  {contact.name}
                </h3>
              </div>
              {isCurrentUser && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium" title="Your profile">
                  <User className="h-2.5 w-2.5 shrink-0" />
                  You
                </span>
              )}
              {contact.isClient && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Client
                </span>
              )}
              {isInternal && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium" title="Team member">
                  <Building2 className="h-2.5 w-2.5 shrink-0" />
                  Internal
                </span>
              )}
            </div>
            {contact.role && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                <Briefcase className="h-3 w-3 shrink-0" />
                <span className="truncate">{contact.role}</span>
              </p>
            )}
          </div>

          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 rotate-180 transition-transform" />
        </div>

        {/* Contact Details */}
        <div className="space-y-2 border-t border-border pt-3">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-4 w-4 text-secondary-foreground" />
              <span className="truncate">{contact.email}</span>
            </a>
          )}

          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors min-w-0"
            >
              <Phone className="h-4 w-4 text-secondary-foreground shrink-0" />
              <span className="truncate">{contact.phone}</span>
            </a>
          )}

          <div className="flex items-center gap-2 text-sm text-foreground min-w-0">
            <Building2 className="h-4 w-4 text-secondary-foreground shrink-0" />
            <span className="truncate">{contact.company}</span>
          </div>

          {/* Folder - clickable in compact expanded mode */}
          {folders.length > 0 && onUpdateFolder && !isTrashView && (
            <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFolderPopoverOpen(true);
                  }}
                  className="group/folder flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-all duration-200 w-full text-left min-w-0 px-1 py-1.5 rounded-md hover:bg-accent/50"
                >
                  <FolderIcon className="h-4 w-4 text-muted-foreground group-hover/folder:text-primary shrink-0 transition-colors" />
                  {folder ? (
                    <div 
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary/80 hover:bg-secondary border border-border/50 hover:border-primary/30 transition-all duration-200"
                      style={{ 
                        borderLeft: `3px solid ${folder.color}`,
                      }}
                    >
                      <span style={{ color: folder.color }} className="truncate font-medium">{folder.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground group-hover/folder:text-foreground">No folder</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-56 p-1.5" 
                align="start"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-0.5">
                  <button
                    onClick={() => handleFolderChange(null)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150",
                      !folder 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "hover:bg-accent hover:text-accent-foreground text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <FolderIcon className="h-4 w-4" />
                      <span>No folder</span>
                    </span>
                    {!folder && <Check className="h-4 w-4 text-primary" />}
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleFolderChange(f.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150",
                        folder?.id === f.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-accent hover:text-accent-foreground text-foreground"
                    )}
                    >
                      <span className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span 
                          className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-border/50" 
                          style={{ backgroundColor: f.color }}
                        />
                        <span className="truncate">{f.name}</span>
                      </span>
                      {folder?.id === f.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Last contacted */}
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className={lastContactedText ? 'text-muted-foreground' : 'text-orange-600 dark:text-orange-400 font-medium'}>
              {lastContactedText || "Never contacted"}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        {!isTrashView && (
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            {onToggleClient && (
              hasClientAccess ? (
                <Button
                  variant={contact.isClient ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex-1 text-xs h-8 px-2 min-w-0 justify-center",
                    contact.isClient && "bg-amber-500 hover:bg-amber-600 text-white"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleClient(!contact.isClient);
                  }}
                >
                  <Star className={cn("h-3 w-3 mr-1.5 flex-shrink-0", contact.isClient && "fill-current")} />
                  <span className="truncate text-center">Client</span>
                </Button>
              ) : (
                <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 px-2 opacity-70 justify-center"
                  >
                    <Star className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    <span className="truncate text-center">Client</span>
                  </Button>
                </LockedFeatureButton>
              )
            )}
            {onMarkContacted && (
              hasClientAccess ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8 px-3 min-w-0 justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkContacted();
                  }}
                >
                  <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
                  <span className="whitespace-nowrap">Contacted</span>
                </Button>
              ) : (
                <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 px-3 opacity-70 justify-center"
                  >
                    <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    <span className="whitespace-nowrap">Contacted</span>
                  </Button>
                </LockedFeatureButton>
              )
            )}
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs h-8 px-2 min-w-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <span className="truncate">Edit</span>
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Full desktop card
  return (
    <div
      onClick={isTrashView ? undefined : (e) => handleCardClick(e)}
      className={cn(
        "group relative p-4 sm:p-6 rounded-xl sm:rounded-2xl border transition-all duration-300 cursor-pointer animate-slide-up h-full flex flex-col",
        selectionMode 
          ? isSelected 
            ? "border-primary bg-primary/5 shadow-md" 
            : "border-border bg-card"
          : "border-border bg-card gradient-card shadow-card hover:shadow-card-hover hover:border-primary/30"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Selection checkbox */}
      {selectionMode && onSelect && (
        <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(checked === true)}
            className="h-5 w-5"
          />
        </div>
      )}
      {/* Folder indicator badge - always reserve space for consistent height */}
      <div className="h-7 mb-1 -mt-1">
        {folders.length > 0 && onUpdateFolder && !isTrashView ? (
          <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFolderPopoverOpen(true);
                }}
                className={cn(
                  "group/folder flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium w-fit transition-all duration-200",
                  folder
                    ? "bg-gradient-to-r from-secondary/90 to-secondary/70 hover:from-secondary hover:to-secondary border border-border/50 hover:border-primary/30 hover:shadow-sm"
                    : "bg-secondary/50 hover:bg-secondary border border-dashed border-muted-foreground/40 hover:border-primary/40 hover:shadow-sm"
                )}
                style={folder ? { 
                  borderLeft: `3px solid ${folder.color}`,
                } : {}}
              >
                <FolderIcon className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-colors",
                  folder ? "text-secondary-foreground group-hover/folder:text-primary" : "text-muted-foreground group-hover/folder:text-primary"
                )} />
                <span className={cn(
                  "truncate max-w-[120px] transition-colors",
                  folder ? "text-secondary-foreground group-hover/folder:text-foreground" : "text-muted-foreground group-hover/folder:text-foreground"
                )}>
                  {folder ? folder.name : "No folder"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-56 p-1.5" 
              align="start"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-0.5">
                <button
                  onClick={() => handleFolderChange(null)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150",
                    !folder 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "hover:bg-accent hover:text-accent-foreground text-foreground"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <FolderIcon className="h-4 w-4" />
                    <span>No folder</span>
                  </span>
                  {!folder && <Check className="h-4 w-4 text-primary" />}
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleFolderChange(f.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150",
                      folder?.id === f.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-accent hover:text-accent-foreground text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span 
                        className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-border/50" 
                        style={{ backgroundColor: f.color }}
                      />
                      <span className="truncate">{f.name}</span>
                    </span>
                    {folder?.id === f.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : folder ? (
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary/80 w-fit border border-border/50"
            style={{ 
              borderLeft: `3px solid ${folder.color}`,
            }}
          >
            <FolderIcon className="h-3.5 w-3.5 text-secondary-foreground shrink-0" />
            <span className="text-secondary-foreground truncate max-w-[120px]">{folder.name}</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-start gap-4 flex-1">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-xl gradient-hero flex items-center justify-center text-primary-foreground font-display font-semibold text-lg group-hover:scale-105 transition-transform duration-300">
            {initials}
          </div>
          {!isTrashView && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-card" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="min-w-0" style={{ minHeight: NAME_BLOCK_MIN_H_DESKTOP }}>
            <h3 className="font-display font-semibold text-lg text-foreground line-clamp-2 group-hover:text-primary transition-colors" title={contact.name}>
              {contact.name}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            {isCurrentUser && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium" title="Your profile">
                <User className="h-3 w-3 shrink-0" />
                You
              </span>
            )}
            {contact.isClient && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
                <Star className="h-3 w-3 fill-current" />
                Client
              </span>
            )}
            {isInternal && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium" title="Team member">
                <Building2 className="h-3 w-3 shrink-0" />
                Internal
              </span>
            )}
            {showOwnershipBadge && contact.isShared && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                <Users className="h-3 w-3" />
                Shared
              </span>
            )}
            {showOwnershipBadge && !contact.isShared && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                <UserCircle className="h-3 w-3" />
                Personal
              </span>
            )}
          </div>
            {contact.role && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1.5 min-w-0">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{contact.role}</span>
            </p>
          )}
          {/* Last contacted indicator */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className={`text-xs ${lastContactedText ? 'text-muted-foreground' : 'text-orange-600 dark:text-orange-400 font-medium'}`}>
              {lastContactedText || "Never contacted"}
            </span>
          </div>
        </div>

        {/* Delete button for non-trash view */}
        {!isTrashView && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Contact details - hide in trash view for cleaner layout */}
      {!isTrashView && (
        <div className="mt-4 space-y-2.5">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors group/email"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary group-hover/email:bg-primary/10 transition-colors">
                <Mail className="h-4 w-4 text-secondary-foreground group-hover/email:text-primary" />
              </div>
              <span className="truncate hover:underline">{contact.email}</span>
            </a>
          )}

          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors group/phone min-w-0"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary group-hover/phone:bg-primary/10 transition-colors shrink-0">
                <Phone className="h-4 w-4 text-secondary-foreground group-hover/phone:text-primary" />
              </div>
              <span className="truncate hover:underline">{contact.phone}</span>
            </a>
          )}

          {contact.company && (
            <div className="flex items-center gap-3 text-sm text-foreground min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary shrink-0">
                <Building2 className="h-4 w-4 text-secondary-foreground" />
              </div>
              <span className="truncate">{contact.company}</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons row - show for non-trash view */}
      {!isTrashView && (onMarkContacted || onToggleClient) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onToggleClient && (
            hasClientAccess ? (
              <Button
                variant={contact.isClient ? "default" : "outline"}
                size="sm"
                className={cn(
                  "flex-1 text-xs px-2 py-1.5 min-w-0 justify-center",
                  contact.isClient && "bg-amber-500 hover:bg-amber-600 text-white"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleClient(!contact.isClient);
                }}
              >
                <Star className={cn("h-3 w-3 mr-1.5 flex-shrink-0", contact.isClient && "fill-current")} />
                <span className="truncate text-center">Client</span>
              </Button>
            ) : (
              <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs px-2 py-1.5 opacity-70 justify-center"
                >
                  <Star className="h-3 w-3 mr-1.5 flex-shrink-0" />
                  <span className="truncate text-center">Client</span>
                </Button>
              </LockedFeatureButton>
            )
          )}
          {onMarkContacted && (
            hasClientAccess ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs px-3 py-1.5 min-w-0 justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkContacted();
                }}
              >
                <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
                <span className="whitespace-nowrap">Contacted</span>
              </Button>
            ) : (
              <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs px-3 py-1.5 opacity-70 justify-center"
                >
                  <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
                  <span className="whitespace-nowrap">Contacted</span>
                </Button>
              </LockedFeatureButton>
            )
          )}
        </div>
      )}

      {/* Trash view actions */}
      {isTrashView && (
        <div className="mt-4 sm:mt-6 pt-4 border-t border-border flex flex-col sm:flex-row gap-2 sm:gap-2.5">
          {onRestore && (
            <Button
              variant="outline"
              size="default"
              className="flex-1 min-w-0 h-10 px-4 w-full sm:w-auto"
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="whitespace-nowrap">Restore</span>
            </Button>
          )}
          {onPermanentlyDelete && (
            <Button
              variant="destructive"
              size="default"
              className="flex-1 min-w-0 h-10 px-4 w-full sm:w-auto"
              onClick={(e) => {
                e.stopPropagation();
                onPermanentlyDelete();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="whitespace-nowrap">Delete</span>
            </Button>
          )}
        </div>
      )}

      {/* Normal action button */}
      {!isTrashView && action && (
        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(action);
            }}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium transition-colors ${actionConfig[action].color}`}
          >
            {(() => {
              const Icon = actionConfig[action].icon;
              return <Icon className="h-4 w-4" />;
            })()}
            {actionConfig[action].label} {contact.name.split(" ")[0]}
          </button>
        </div>
      )}
    </div>
  );
};

// Memoize ContactCard to prevent unnecessary re-renders when other contacts change
// Only re-render when this specific contact's props change
export const ContactCard = React.memo(ContactCardComponent, (prevProps, nextProps) => {
  // Custom comparison - return true if props are equal (don't re-render)
  // Return false if props differ (should re-render)
  
  // Quick reference check for contact object
  if (prevProps.contact !== nextProps.contact) {
    return false; // Contact changed, need to re-render
  }
  
  // Check other props that should trigger re-render
  if (
    prevProps.index !== nextProps.index ||
    prevProps.action !== nextProps.action ||
    prevProps.isTrashView !== nextProps.isTrashView ||
    prevProps.folder?.id !== nextProps.folder?.id ||
    prevProps.folders !== nextProps.folders ||
    prevProps.showOwnershipBadge !== nextProps.showOwnershipBadge ||
    prevProps.hasClientAccess !== nextProps.hasClientAccess ||
    prevProps.isInternal !== nextProps.isInternal ||
    prevProps.isCurrentUser !== nextProps.isCurrentUser ||
    prevProps.compact !== nextProps.compact ||
    prevProps.isExpanded !== nextProps.isExpanded ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.selectionMode !== nextProps.selectionMode
  ) {
    return false; // Props changed, need to re-render
  }
  
  // Props are equal, skip re-render
  return true;
});
