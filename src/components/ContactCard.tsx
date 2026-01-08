import React from "react";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { Mail, Phone, Building2, Briefcase, MessageSquare, Trash2, RotateCcw, Folder as FolderIcon, User, Users, UserCircle, Clock, Star, ChevronDown } from "lucide-react";
import { ActionType } from "@/hooks/useActionSearch";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { LockedFeatureButton, dialogJustClosed } from "@/components/LockedFeatureButton";

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
  showOwnershipBadge?: boolean;
  onMarkContacted?: () => void;
  onToggleClient?: (isClient: boolean) => void;
  // Mobile/Tablet compact mode props
  compact?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function ContactCard({ 
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
  showOwnershipBadge = false,
  onMarkContacted,
  onToggleClient,
  compact = false,
  isExpanded = false,
  onToggleExpand,
}: ContactCardProps) {
  const { canAccessFeature } = useSubscription();
  const hasClientAccess = canAccessFeature("client_management");
  
  const initials = contact.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const lastContactedText = formatLastContacted(contact.lastContactedAt);

  const handleAction = (type: ActionType) => {
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
  };

  const actionConfig = {
    email: { icon: Mail, label: "Email", color: "bg-primary hover:bg-primary/90" },
    call: { icon: Phone, label: "Call", color: "bg-green-600 hover:bg-green-700" },
    text: { icon: MessageSquare, label: "Text", color: "bg-blue-600 hover:bg-blue-700" },
  };

  const handleCardClick = (e?: React.MouseEvent) => {
    if (isTrashView) return;
    
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
  };

  // Compact mode for mobile/tablet - collapsed state
  if (compact && !isExpanded) {
    return (
      <div
        onClick={(e) => handleCardClick(e)}
        className="group relative p-2 rounded-lg border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer animate-slide-up"
        style={{ animationDelay: `${index * 20}ms` }}
      >
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
              <h3 className="font-display font-medium text-xs text-foreground truncate">
                {contact.name}
              </h3>
              {contact.isClient && (
                <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500 flex-shrink-0" />
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
        className="group relative p-4 rounded-xl border border-primary/30 bg-card shadow-md transition-all duration-300 animate-scale-in"
      >
        {/* Header with collapse */}
        <div className="flex items-center gap-3 mb-3" onClick={(e) => handleCardClick(e)}>
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-lg gradient-hero flex items-center justify-center text-primary-foreground font-display font-semibold text-base">
              {initials}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-display font-semibold text-base text-foreground">
                {contact.name}
              </h3>
              {contact.isClient && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Client
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {contact.role}
            </p>
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
              className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
            >
              <Phone className="h-4 w-4 text-secondary-foreground" />
              <span>{contact.phone}</span>
            </a>
          )}

          <div className="flex items-center gap-2 text-sm text-foreground">
            <Building2 className="h-4 w-4 text-secondary-foreground" />
            <span className="truncate">{contact.company}</span>
          </div>

          {/* Last contacted */}
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground" />
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
                  <span className="truncate text-center">{contact.isClient ? "Client" : "Mark Client"}</span>
                </Button>
              ) : (
                <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 px-2 opacity-70 justify-center"
                  >
                    <Star className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    <span className="truncate text-center">Mark Client</span>
                  </Button>
                </LockedFeatureButton>
              )
            )}
            {onMarkContacted && (
              hasClientAccess ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8 px-2 min-w-0 justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkContacted();
                  }}
                >
                  <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
                  <span className="truncate text-center">Contacted</span>
                </Button>
              ) : (
                <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 px-2 opacity-70 justify-center"
                  >
                    <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    <span className="truncate text-center">Contacted</span>
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
      className="group relative p-6 rounded-2xl border border-border bg-card gradient-card shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-300 cursor-pointer animate-slide-up h-full flex flex-col"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Folder indicator badge - always reserve space for consistent height */}
      <div className="h-7 mb-1">
        {folder && (
          <div 
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-secondary/80 w-fit"
            style={{ 
              borderLeft: `3px solid ${folder.color}`,
            }}
          >
            <FolderIcon className="h-3 w-3 text-secondary-foreground" />
            <span className="text-secondary-foreground truncate max-w-[120px]">{folder.name}</span>
          </div>
        )}
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
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
              {contact.name}
            </h3>
            {contact.isClient && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
                <Star className="h-3 w-3 fill-current" />
                Client
              </span>
            )}
            {contact.tags?.includes("my-profile") && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <User className="h-3 w-3" />
                You
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
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Briefcase className="h-3.5 w-3.5" />
            {contact.role}
          </p>
          {/* Last contacted indicator */}
          <div className="flex items-center gap-1.5 mt-1">
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
            className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors group/phone"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary group-hover/phone:bg-primary/10 transition-colors">
              <Phone className="h-4 w-4 text-secondary-foreground group-hover/phone:text-primary" />
            </div>
            <span className="hover:underline">{contact.phone}</span>
          </a>
        )}

        <div className="flex items-center gap-3 text-sm text-foreground">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
            <Building2 className="h-4 w-4 text-secondary-foreground" />
          </div>
          <span className="truncate">{contact.company}</span>
        </div>
      </div>

      {/* Action buttons row - show for non-trash view */}
      {!isTrashView && (onMarkContacted || onToggleClient) && (
        <div className="mt-3 flex gap-2">
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
                <span className="truncate text-center">{contact.isClient ? "Client" : "Mark as Client"}</span>
              </Button>
            ) : (
              <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs px-2 py-1.5 opacity-70 justify-center"
                >
                  <Star className="h-3 w-3 mr-1.5 flex-shrink-0" />
                  <span className="truncate text-center">Mark as Client</span>
                </Button>
              </LockedFeatureButton>
            )
          )}
          {onMarkContacted && (
            hasClientAccess ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs px-2 py-1.5 min-w-0 justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkContacted();
                }}
              >
                <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
                <span className="truncate text-center">Contacted</span>
              </Button>
            ) : (
              <LockedFeatureButton feature="client_management" minimumTier="pro" className="flex-1 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs px-2 py-1.5 opacity-70 justify-center"
                >
                  <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />
                  <span className="truncate text-center">Contacted</span>
                </Button>
              </LockedFeatureButton>
            )
          )}
        </div>
      )}

      {/* Trash view actions */}
      {isTrashView && (
        <div className="mt-4 pt-4 border-t border-border flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onRestore?.();
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restore
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onPermanentlyDelete?.();
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Forever
          </Button>
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
}
