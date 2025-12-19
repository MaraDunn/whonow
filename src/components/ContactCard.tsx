import { Contact } from "@/types/contact";
import { Mail, Phone, Building2, Briefcase } from "lucide-react";

interface ContactCardProps {
  contact: Contact;
  index: number;
}

export function ContactCard({ contact, index }: ContactCardProps) {
  const initials = contact.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div
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
    </div>
  );
}
