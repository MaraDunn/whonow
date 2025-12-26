import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { Mail, Phone, Building2, Briefcase, MessageSquare, Trash2, RotateCcw, Folder as FolderIcon, User, Users, UserCircle, Clock } from "lucide-react";
import { ActionType } from "@/hooks/useActionSearch";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

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
  isTrashView?: boolean;
  onDelete?: () => void;
  onRestore?: () => void;
  onPermanentlyDelete?: () => void;
  folder?: Folder;
  showOwnershipBadge?: boolean;
  onMarkContacted?: () => void;
}

export function ContactCard({ 
  contact, 
  index, 
  action, 
  onEdit,
  isTrashView = false,
  onDelete,
  onRestore,
  onPermanentlyDelete,
  folder,
  showOwnershipBadge = false,
  onMarkContacted,
}: ContactCardProps) {
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

  return (
    <div
      onClick={isTrashView ? undefined : onEdit}
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
            <FolderIcon className="h-3 w-3" style={{ color: folder.color }} />
            <span className="text-muted-foreground truncate max-w-[120px]">{folder.name}</span>
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
            <span className={`text-xs ${lastContactedText ? 'text-muted-foreground' : 'text-orange-500 font-medium'}`}>
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
            className="flex items-center gap-3 text-sm text-secondary-foreground hover:text-primary transition-colors group/email"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary group-hover/email:bg-primary/10 transition-colors">
              <Mail className="h-4 w-4 text-muted-foreground group-hover/email:text-primary" />
            </div>
            <span className="truncate hover:underline">{contact.email}</span>
          </a>
        )}

        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-3 text-sm text-secondary-foreground hover:text-primary transition-colors group/phone"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary group-hover/phone:bg-primary/10 transition-colors">
              <Phone className="h-4 w-4 text-muted-foreground group-hover/phone:text-primary" />
            </div>
            <span className="hover:underline">{contact.phone}</span>
          </a>
        )}

        <div className="flex items-center gap-3 text-sm text-secondary-foreground">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="truncate">{contact.company}</span>
        </div>
      </div>

      {contact.description && (
        <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
          {contact.description}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {contact.tags.map((tag) => (
          <span
            key={tag}
            className="px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Mark as contacted button - show for non-trash view */}
      {!isTrashView && onMarkContacted && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onMarkContacted();
          }}
        >
          <Clock className="h-3 w-3 mr-1.5" />
          Mark as contacted
        </Button>
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
