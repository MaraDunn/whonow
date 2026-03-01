import React, { useState as useStateReact } from "react";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { Mail, Phone, Building2, Briefcase, MessageSquare, Trash2, Share2, RotateCcw, Folder as FolderIcon, User, Users, UserCircle, Clock, Star, ChevronDown, Check, FileDown, Video, CalendarClock } from "lucide-react";
import { ActionType } from "@/hooks/useActionSearch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { LockedFeatureButton, dialogJustClosed } from "@/components/LockedFeatureButton";
import { useSetFollowUpDate } from "@/hooks/useFollowUps";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { RelationshipHealthBadge } from "@/components/RelationshipHealthBadge";
import { computeHealthScore } from "@/utils/relationshipHealth";

// Name block: text-xl name + optional shared/personal badge beneath
const NAME_BLOCK_H_DESKTOP = "3.5rem";
const NAME_BLOCK_H_COMPACT = "2.25rem";
// Card height: single source of truth; grid row and card use this so cards never overlap
const CARD_H_DESKTOP = "24rem";

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
  onExportContact?: (contact: Contact) => void;
  onShareToSlack?: (contact: Contact) => void;
  onShareToTeams?: (contact: Contact) => void;
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

function CardFollowUpButton({ contactId, followUpDate }: { contactId: string; followUpDate?: string }) {
  const [open, setOpen] = useStateReact(false);
  const setFollowUpDate = useSetFollowUpDate();
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = followUpDate && followUpDate < today;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 text-xs h-8 px-2 min-w-0 rounded-full border font-medium transition-colors",
            followUpDate
              ? isOverdue
                ? "border-destructive/50 text-destructive bg-destructive/5 hover:bg-destructive/10"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              : "border-border text-muted-foreground/50 hover:text-muted-foreground hover:border-border"
          )}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {followUpDate ? format(parseISO(followUpDate), "MMM d") : "Follow-up"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end" onClick={(e) => e.stopPropagation()}>
        <Calendar
          mode="single"
          selected={followUpDate ? parseISO(followUpDate) : undefined}
          onSelect={(date) => {
            setFollowUpDate.mutate({ id: contactId, date: date ? format(date, "yyyy-MM-dd") : null });
            setOpen(false);
          }}
          initialFocus
        />
        {followUpDate && (
          <div className="p-2 border-t">
            <button
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setFollowUpDate.mutate({ id: contactId, date: null });
                setOpen(false);
              }}
            >
              Clear follow-up
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const ContactCardComponent = function ContactCard({ 
  contact, 
  index, 
  action, 
  onEdit,
  onView,
  isTrashView = false,
  onDelete,
  onExportContact,
  onShareToSlack,
  onShareToTeams,
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

  // Use pre-computed health score from parent when available (e.g. ClientDashboard passes
  // scores that include the frequency component). Fall back to recency-only computation.
  const healthResult = React.useMemo(() => {
    if (!contact.isClient) return null;
    if (contact.relationshipHealthScore !== undefined && contact.relationshipHealthStatus !== undefined) {
      return { score: contact.relationshipHealthScore, status: contact.relationshipHealthStatus };
    }
    return computeHealthScore(contact, 0);
  }, [contact]);

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
    // In compact/mobile trash view, allow expand/collapse so restore actions are accessible
    if (isTrashView) {
      if (compact && onToggleExpand) {
        onToggleExpand();
      }
      return;
    }
    
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
    // Format role and company for secondary line
    const roleCompanyText = contact.role && contact.company 
      ? `${contact.role} · ${contact.company}`
      : contact.role || contact.company || "No role";

    return (
      <div
        onClick={(e) => handleCardClick(e)}
        className={cn(
          "group relative px-2 py-1.5 rounded-xl border-2 transition-colors cursor-pointer animate-slide-up outline-none",
          selectionMode 
            ? isSelected 
              ? "border-primary bg-primary/5" 
              : "border-border bg-card"
            : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
        )}
        style={{ animationDelay: `${index * 20}ms` }}
      >
        {/* Selection checkbox */}
        {selectionMode && onSelect && (
          <div className="absolute top-1 right-1 z-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(checked === true)}
              className="h-3 w-3"
            />
          </div>
        )}
        
        {/* Row 1: Avatar + Name + Actions */}
        <div className="flex items-center gap-2 min-h-[20px]">
          {/* Avatar - minimal size */}
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded overflow-hidden gradient-hero flex items-center justify-center text-primary-foreground font-display font-semibold text-xs">
              {initials}
            </div>
          </div>

          {/* Name - truncated */}
          <h3 className="flex-1 min-w-0 font-display font-medium text-xs text-foreground truncate leading-tight" title={contact.name}>
            {contact.name}
          </h3>

          {/* Quick Action Buttons - icon only, minimal */}
          {!isTrashView && (onMarkContacted || onToggleClient) && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {onMarkContacted && (
                hasClientAccess ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkContacted();
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Mark as contacted"
                  >
                    <Clock className="h-3 w-3" />
                  </button>
                ) : (
                  <LockedFeatureButton feature="client_management" minimumTier="pro">
                    <button
                      className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/40"
                      title="Mark as contacted (Pro)"
                    >
                      <Clock className="h-3 w-3" />
                    </button>
                  </LockedFeatureButton>
                )
              )}
              {onToggleClient && (
                hasClientAccess ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleClient(!contact.isClient);
                    }}
                    className={cn(
                      "w-5 h-5 flex items-center justify-center rounded hover:bg-accent transition-colors",
                      contact.isClient ? "text-amber-600" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={contact.isClient ? "Unmark client" : "Mark as client"}
                  >
                    <Star className={cn("h-3 w-3", contact.isClient && "fill-current")} />
                  </button>
                ) : (
                  <LockedFeatureButton feature="client_management" minimumTier="pro">
                    <button
                      className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/40"
                      title="Mark as client (Pro)"
                    >
                      <Star className="h-3 w-3" />
                    </button>
                  </LockedFeatureButton>
                )
              )}
            </div>
          )}

          {/* Expand indicator */}
          <ChevronDown className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
        </div>

        {/* Row 2: Role · Company (always same height) */}
        <div className="ml-10 min-h-[14px] flex items-center">
          <p className={cn(
            "text-[10px] truncate leading-tight",
            !contact.role && !contact.company ? "text-muted-foreground/40 italic" : "text-muted-foreground"
          )}>
            {roleCompanyText}
          </p>
        </div>

        {/* Row 3: Contact info + Tags (single line, no wrap) */}
        <div className="ml-10 mt-0.5 flex items-center gap-1.5 text-[10px] min-h-[16px]">
          {/* Contact info - extremely compact */}
          <div className="flex items-center gap-1 min-w-0 flex-shrink">
            {contact.phone ? (
              <a
                href={`tel:${contact.phone}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkContacted?.();
                }}
                className="flex items-center gap-0.5 text-muted-foreground hover:text-primary transition-colors truncate max-w-[80px]"
                title={contact.phone}
              >
                <Phone className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{contact.phone}</span>
              </a>
            ) : (
              <span className="flex items-center gap-0.5 text-muted-foreground/30 italic text-[9px]">
                <Phone className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="whitespace-nowrap">No phone</span>
              </span>
            )}
            
            <span className="text-muted-foreground/30 text-[8px]">•</span>
            
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkContacted?.();
                }}
                className="flex items-center gap-0.5 text-muted-foreground hover:text-primary transition-colors truncate max-w-[100px]"
                title={contact.email}
              >
                <Mail className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{contact.email}</span>
              </a>
            ) : (
              <span className="flex items-center gap-0.5 text-muted-foreground/30 italic text-[9px]">
                <Mail className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="whitespace-nowrap">No email</span>
              </span>
            )}
          </div>

          {/* Status Tags - icon only, minimal padding */}
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
            {isInternal && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-muted/50 text-muted-foreground" title="Internal">
                <Building2 className="h-2.5 w-2.5" />
              </span>
            )}
            {contact.isClient && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-500/10 text-amber-600" title="Client">
                <Star className="h-2.5 w-2.5 fill-current" />
              </span>
            )}
            {healthResult && (
              <RelationshipHealthBadge score={healthResult.score} status={healthResult.status} variant="icon" />
            )}
            {showOwnershipBadge && (
              contact.isShared ? (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-accent/50 text-accent-foreground" title="Shared">
                  <Users className="h-2.5 w-2.5" />
                </span>
              ) : (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-secondary/50 text-secondary-foreground" title="Personal">
                  <UserCircle className="h-2.5 w-2.5" />
                </span>
              )
            )}
            {!lastContactedText && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-orange-500/10 text-orange-600" title="Never contacted">
                <Clock className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Compact mode for mobile/tablet - expanded state
  if (compact && isExpanded) {
    return (
      <div
        className={cn(
          "group relative p-4 rounded-xl border-2 transition-all duration-300 animate-scale-in outline-none",
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
            <div className="w-12 h-12 rounded-lg overflow-hidden gradient-hero flex items-center justify-center text-primary-foreground font-display font-semibold text-base">
              {initials}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="min-w-0 flex-1 overflow-hidden" style={{ height: NAME_BLOCK_H_COMPACT }}>
                <h3 className="font-display font-semibold text-base text-foreground line-clamp-2 break-words" title={contact.name}>
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
              onClick={(e) => {
                e.stopPropagation();
                onMarkContacted?.();
              }}
              className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-4 w-4 text-secondary-foreground" />
              <span className="truncate">{contact.email}</span>
            </a>
          )}

          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              onClick={(e) => {
                e.stopPropagation();
                onMarkContacted?.();
              }}
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

        {/* Trash view actions */}
        {isTrashView && (
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            {onRestore && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 px-3 min-w-0 justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1.5 flex-shrink-0" />
                <span className="whitespace-nowrap">Restore</span>
              </Button>
            )}
            {onPermanentlyDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 text-xs h-8 px-3 min-w-0 justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  onPermanentlyDelete();
                }}
              >
                <Trash2 className="h-3 w-3 mr-1.5 flex-shrink-0" />
                <span className="whitespace-nowrap">Delete forever</span>
              </Button>
            )}
          </div>
        )}

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
                  className="flex-1 text-xs h-8 px-3 min-w-0 justify-center overflow-hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkContacted();
                  }}
                >
                  <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
                  <span className="truncate">Contacted</span>
                </Button>
              ) : (
                <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 px-3 opacity-70 justify-center overflow-hidden"
                  >
                    <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    <span className="truncate">Contacted</span>
                  </Button>
                </LockedFeatureButton>
              )
            )}
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent side="top">Edit</TooltipContent>
            </Tooltip>
            {(onShareToSlack || onShareToTeams || onExportContact) && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">Share</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {onShareToSlack && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShareToSlack(contact); }}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Share to Slack
                    </DropdownMenuItem>
                  )}
                  {onShareToTeams && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShareToTeams(contact); }}>
                      <Video className="h-4 w-4 mr-2" />
                      Share to Teams
                    </DropdownMenuItem>
                  )}
                  {onExportContact && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExportContact(contact); }}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Export to CSV
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Delete</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full desktop card — strictly fits grid cell (CARD_H_DESKTOP); no overlap with other cards or internal overlap
  return (
    <div
      data-onboarding-contact-card={index === 0 ? "" : undefined}
      onClick={isTrashView ? undefined : (e) => handleCardClick(e)}
      className={cn(
        "group relative p-5 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 cursor-pointer flex flex-col overflow-hidden box-border outline-none",
        selectionMode 
          ? isSelected 
            ? "border-primary bg-primary/5 shadow-md" 
            : "border-border bg-card"
          : "border-border bg-card gradient-card shadow-card hover:shadow-card-hover hover:border-primary/30"
      )}
      style={{ animationDelay: `${index * 50}ms`, height: CARD_H_DESKTOP }}
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
      {/* ── Header row: avatar + name + action icons ── */}
      <div className="flex items-start gap-3 shrink-0">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden gradient-hero flex items-center justify-center text-primary-foreground font-display font-semibold text-base group-hover:scale-105 transition-transform duration-300">
            {initials}
          </div>
          {!isTrashView && (
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-card" />
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center" style={{ height: NAME_BLOCK_H_DESKTOP }}>
          <h3 className="font-display font-semibold text-xl text-foreground truncate group-hover:text-primary transition-colors leading-tight w-full" title={contact.name}>
            {contact.name}
          </h3>
          {showOwnershipBadge && (
            <div className="mt-0.5">
              {contact.isShared ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/50 text-accent-foreground text-xs font-medium" title="Shared contact">
                  <Users className="h-3 w-3 shrink-0" />
                  Shared
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary/50 text-secondary-foreground text-xs font-medium" title="Personal contact">
                  <UserCircle className="h-3 w-3 shrink-0" />
                  Personal
                </span>
              )}
            </div>
          )}
        </div>

        {/* Share and Delete buttons */}
        {!isTrashView && (onShareToSlack || onShareToTeams || onExportContact || onDelete) && (
          <div className="flex items-center gap-0 flex-shrink-0">
            {(onShareToSlack || onShareToTeams || onExportContact) && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">Share</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {onShareToSlack && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShareToSlack(contact); }}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Share to Slack
                    </DropdownMenuItem>
                  )}
                  {onShareToTeams && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShareToTeams(contact); }}>
                      <Video className="h-4 w-4 mr-2" />
                      Share to Teams
                    </DropdownMenuItem>
                  )}
                  {onExportContact && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExportContact(contact); }}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Export to CSV
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Delete</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {/* ── 2-column metadata grid: Company | Role, Last contacted | Health/Shared ── */}
      {!isTrashView && (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 shrink-0">
          {/* Col 1: Company */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {contact.company ? (
              <span className="text-xs text-foreground truncate">{contact.company}</span>
            ) : (
              <span className="text-xs text-muted-foreground/40 italic">No company</span>
            )}
          </div>

          {/* Col 2: Role */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {contact.role ? (
              <span className="text-xs text-foreground truncate">{contact.role}</span>
            ) : (
              <span className="text-xs text-muted-foreground/40 italic">No role</span>
            )}
          </div>

          {/* Col 1: Last contacted */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {lastContactedText ? (
              <span className="text-xs text-muted-foreground truncate">{lastContactedText}</span>
            ) : (
              <span className="text-xs text-muted-foreground/40 italic">Never contacted</span>
            )}
          </div>

          {/* Col 2: Health badge (clients only) */}
          <div className="flex items-center min-w-0">
            {healthResult && (
              <RelationshipHealthBadge score={healthResult.score} status={healthResult.status} />
            )}
          </div>
        </div>
      )}

      {/* ── Phone & Email: full-width single-column rows ── */}
      {!isTrashView && (
        <div className="mt-3 space-y-2 flex-1 min-h-0">
          <div className="flex items-center gap-2 min-w-0">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
            {contact.phone ? (
              <a
                href={`tel:${contact.phone}`}
                onClick={(e) => { e.stopPropagation(); onMarkContacted?.(); }}
                className="text-sm text-foreground hover:text-primary transition-colors truncate"
              >
                {contact.phone}
              </a>
            ) : (
              <span className="text-sm text-muted-foreground/40 italic">No phone</span>
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                onClick={(e) => { e.stopPropagation(); onMarkContacted?.(); }}
                className="text-sm text-foreground hover:text-primary transition-colors truncate"
              >
                {contact.email}
              </a>
            ) : (
              <span className="text-sm text-muted-foreground/40 italic">No email</span>
            )}
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      {!isTrashView && (onMarkContacted || onToggleClient) && (
        <div className="mt-4 flex gap-1.5 shrink-0">
          {onToggleClient && (
            hasClientAccess ? (
              <Button
                variant={contact.isClient ? "default" : "outline"}
                size="sm"
                className={cn(
                  "flex-1 text-xs h-8 px-2 min-w-0 justify-center rounded-full font-medium",
                  contact.isClient
                    ? "bg-amber-500 hover:bg-amber-600 text-white border-0"
                    : "border-border text-foreground"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleClient(!contact.isClient);
                }}
              >
                <Star className={cn("h-3.5 w-3.5 mr-1.5 flex-shrink-0", contact.isClient && "fill-current")} />
                <span className="truncate">Client</span>
              </Button>
            ) : (
              <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8 px-2 opacity-70 justify-center rounded-full border-border text-foreground"
                >
                  <Star className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                  <span className="truncate">Client</span>
                </Button>
              </LockedFeatureButton>
            )
          )}
          {onMarkContacted && (
            hasClientAccess ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 px-2 min-w-0 justify-center rounded-full border-border text-muted-foreground font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkContacted();
                }}
              >
                <Clock className="h-3.5 w-3.5 mr-1.5 flex-shrink-0 text-muted-foreground" />
                <span className="truncate">Contacted</span>
              </Button>
            ) : (
              <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8 px-2 opacity-70 justify-center rounded-full border-border text-muted-foreground"
                >
                  <Clock className="h-3.5 w-3.5 mr-1.5 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate">Contacted</span>
                </Button>
              </LockedFeatureButton>
            )
          )}
          {hasClientAccess && (
            <CardFollowUpButton contactId={contact.id} followUpDate={contact.followUpDate} />
          )}
        </div>
      )}


      {/* Trash view actions */}
      {isTrashView && (
        <div className="mt-4 sm:mt-6 pt-4 border-t border-border flex flex-col sm:flex-row gap-2 sm:gap-2.5 shrink-0">
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
        <div className="mt-4 pt-4 border-t border-border shrink-0">
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
