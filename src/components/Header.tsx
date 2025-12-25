import { Users, Plus, User, Settings, LogOut, FileUp, Camera, Smartphone, Chrome, ChevronDown, Building2, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Contact } from "@/types/contact";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

interface HeaderProps {
  contactCount: number;
  onOpenAddDialog: (mode?: "quick" | "full") => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenImport: (tab?: string) => void;
  myProfile?: Contact;
}

export function Header({ contactCount, onOpenAddDialog, onOpenProfile, onOpenSettings, onOpenImport, myProfile }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { profile, company } = useProfile(user?.id);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Failed to sign out. Please try again.");
    } else {
      toast.success("Signed out successfully");
    }
  };

  const displayName = profile?.fullName || user?.email || "User";
  const profileInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-hero text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" />
              <span>Add Contact</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-popover">
            <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenAddDialog("quick")}>
              <Sparkles className="mr-2 h-4 w-4" />
              Quick Add
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenAddDialog("full")}>
              <Plus className="mr-2 h-4 w-4" />
              Full Form
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenImport("scan")}>
              <Camera className="mr-2 h-4 w-4" />
              Scan Business Card
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenImport("file")}>
              <FileUp className="mr-2 h-4 w-4" />
              Import from File
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenImport("phone")}>
              <Smartphone className="mr-2 h-4 w-4" />
              Sync from Phone
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenImport("google")}>
              <Chrome className="mr-2 h-4 w-4" />
              Sync from Google
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 transition-colors">
              <Avatar className="h-9 w-9">
                {myProfile?.avatar && <AvatarImage src={myProfile.avatar} alt={myProfile.name} />}
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {profileInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover">
            <div className="px-2 py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {profileInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              {company && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{company.name}</span>
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={onOpenProfile}>
              <User className="mr-2 h-4 w-4" />
              {myProfile ? "Edit My Card" : "Create My Card"}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={onOpenSettings}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
