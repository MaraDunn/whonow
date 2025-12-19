import { Users, Plus } from "lucide-react";

interface HeaderProps {
  contactCount: number;
  onOpenAddDialog: () => void;
}

export function Header({ contactCount, onOpenAddDialog }: HeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8 animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center">
          <Users className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">
            Contacts
          </h1>
          <p className="text-sm text-muted-foreground">
            {contactCount} {contactCount === 1 ? "contact" : "contacts"}
          </p>
        </div>
      </div>

      <button
        onClick={onOpenAddDialog}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-hero text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
      >
        <Plus className="h-4 w-4" />
        <span>Add Contact</span>
      </button>
    </header>
  );
}
