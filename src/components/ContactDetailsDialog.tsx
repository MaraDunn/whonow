import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { Mail, Phone, Building2, Briefcase, Clock, Star, User, Users, UserCircle, Folder as FolderIcon, X, Edit, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// Helper to format last contacted time
function formatLastContacted(lastContactedAt?: string): string | null {
  if (!lastContactedAt) return null;
  try {
    return formatDistanceToNow(new Date(lastContactedAt), { addSuffix: true });
  } catch {
    return null;
  }
}

interface ContactDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  folder?: Folder;
  showOwnershipBadge?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ContactDetailsDialog({
  open,
  onOpenChange,
  contact,
  folder,
  showOwnershipBadge = false,
  onEdit,
  onDelete,
}: ContactDetailsDialogProps) {
  if (!contact) return null;

  const initials = contact.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const lastContactedText = formatLastContacted(contact.lastContactedAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 [&>button]:hidden">
        {/* Header with Edit and Delete buttons */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-semibold text-xl text-foreground">
              Contact Details
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onEdit}
              className="h-9 w-9"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onDelete}
              className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Avatar and Name Section */}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage src={contact.avatar} alt={contact.name} />
              <AvatarFallback className="text-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-display font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-display font-semibold text-2xl text-foreground">
                  {contact.name}
                </h3>
                {contact.isClient && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-sm font-medium">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    Client
                  </span>
                )}
                {contact.tags?.includes("my-profile") && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    <User className="h-3.5 w-3.5" />
                    You
                  </span>
                )}
                {showOwnershipBadge && contact.isShared && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-sm font-medium">
                    <Users className="h-3.5 w-3.5" />
                    Shared
                  </span>
                )}
                {showOwnershipBadge && !contact.isShared && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                    <UserCircle className="h-3.5 w-3.5" />
                    Personal
                  </span>
                )}
              </div>
              
              {contact.role && (
                <p className="text-base text-muted-foreground flex items-center gap-2 mt-1">
                  <Briefcase className="h-4 w-4" />
                  {contact.role}
                </p>
              )}

              {/* Last contacted */}
              <div className="flex items-center gap-2 mt-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className={cn(
                  "text-sm",
                  lastContactedText ? 'text-muted-foreground' : 'text-orange-500 font-medium'
                )}>
                  {lastContactedText || "Never contacted"}
                </span>
              </div>
            </div>
          </div>

          {/* Folder indicator */}
          {folder && (
            <div className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <div 
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium bg-secondary/80 w-fit"
                style={{ 
                  borderLeft: `3px solid ${folder.color}`,
                }}
              >
                <span style={{ color: folder.color }}>{folder.name}</span>
              </div>
            </div>
          )}

          {/* Contact Information */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-foreground uppercase tracking-wide">
              Contact Information
            </h4>
            
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-3 text-base text-secondary-foreground hover:text-primary transition-colors group/email"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary group-hover/email:bg-primary/10 transition-colors">
                  <Mail className="h-5 w-5 text-muted-foreground group-hover/email:text-primary" />
                </div>
                <span className="hover:underline">{contact.email}</span>
              </a>
            )}

            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-3 text-base text-secondary-foreground hover:text-primary transition-colors group/phone"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary group-hover/phone:bg-primary/10 transition-colors">
                  <Phone className="h-5 w-5 text-muted-foreground group-hover/phone:text-primary" />
                </div>
                <span className="hover:underline">{contact.phone}</span>
              </a>
            )}

            {contact.company && (
              <div className="flex items-center gap-3 text-base text-secondary-foreground">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <span>{contact.company}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {contact.description && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-foreground uppercase tracking-wide">
                Description
              </h4>
              <p className="text-base text-muted-foreground">
                {contact.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-foreground uppercase tracking-wide">
                Keywords
              </h4>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

