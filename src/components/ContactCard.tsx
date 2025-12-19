import { Contact } from "@/types/contact";
import { Mail, Phone, Building2, Briefcase, MessageSquare } from "lucide-react";
import { ActionType } from "@/hooks/useActionSearch";

interface ContactCardProps {
  contact: Contact;
  index: number;
  action?: ActionType;
  onEdit: () => void;
}

export function ContactCard({ contact, index, action, onEdit }: ContactCardProps) {
  const initials = contact.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

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
      onClick={onEdit}
      className="group relative p-6 rounded-2xl border border-border bg-card gradient-card shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-300 cursor-pointer animate-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-xl gradient-hero flex items-center justify-center text-primary-foreground font-display font-semibold text-lg group-hover:scale-105 transition-transform duration-300">
            {initials}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-card" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
            {contact.name}
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Briefcase className="h-3.5 w-3.5" />
            {contact.role}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="flex items-center gap-3 text-sm text-secondary-foreground">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="truncate">{contact.email}</span>
        </div>

        <div className="flex items-center gap-3 text-sm text-secondary-foreground">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
            <Phone className="h-4 w-4 text-muted-foreground" />
          </div>
          <span>{contact.phone}</span>
        </div>

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

      {action && (
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
