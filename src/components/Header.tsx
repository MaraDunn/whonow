import { Plus, User, Settings, LogOut, FileUp, Camera, Chrome, ChevronDown, Building2, Sparkles, MessageSquare, Video, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Contact } from "@/types/contact";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSlackIntegration } from "@/hooks/useSlackIntegration";
import { useTeamsIntegration } from "@/hooks/useTeamsIntegration";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { WhoNowLogo } from "@/components/WhoNowLogo";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps {
  contactCount: number;
  onOpenAddDialog: (mode?: "quick" | "full") => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenImport: (tab?: string) => void;
  onContactsImported?: () => void;
  myProfile?: Contact;
  isAtContactLimit?: boolean;
  contactsRemaining?: number | null;
  contactLimit?: number | null;
}

export function Header({ 
  contactCount, 
  onOpenAddDialog, 
  onOpenProfile, 
  onOpenSettings, 
  onOpenImport, 
  onContactsImported, 
  myProfile,
  isAtContactLimit,
  contactsRemaining,
  contactLimit,
}: HeaderProps) {
  const { user, signOut } = useAuth();
  const { profile, company } = useProfile(user?.id);
  const slack = useSlackIntegration();
  const teams = useTeamsIntegration();
  const { createCheckout } = useSubscription();
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Failed to sign out. Please try again.");
    } else {
      toast.success("Signed out successfully");
    }
  };

  const handleSlackImport = async () => {
    const status = await slack.getStatus();
    if (!status?.connected) {
      toast.error("Slack not connected. Please connect Slack in Settings first.", {
        action: {
          label: "Settings",
          onClick: onOpenSettings,
        },
      });
      return;
    }
    const result = await slack.importMembers();
    if (result?.imported > 0) {
      onContactsImported?.();
    }
  };

  const handleTeamsImport = async () => {
    const status = await teams.getStatus();
    if (!status?.connected) {
      toast.error("Teams not connected. Please connect Microsoft Teams in Settings first.", {
        action: {
          label: "Settings",
          onClick: onOpenSettings,
        },
      });
      return;
    }
    const result = await teams.importMembers();
    if (result?.imported > 0) {
      onContactsImported?.();
    }
  };

  const displayName = profile?.fullName || user?.email || "User";
  const profileInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleUpgrade = () => {
    createCheckout("pro");
  };

  return (
    <header className="flex items-center justify-between mb-4 sm:mb-8 animate-fade-in">
      <div className="flex items-center gap-2 sm:gap-4">
        <WhoNowLogo size={isMobile ? "sm" : "md"} showText={!isMobile} />
        {!isMobile && (
          <div className="border-l border-border pl-4">
            <p className="text-sm text-muted-foreground">
              {contactCount} {contactCount === 1 ? "contact" : "contacts"}
              {contactLimit !== null && contactLimit !== undefined && (
                <span className={contactsRemaining !== null && contactsRemaining <= 10 ? "text-warning" : ""}>
                  {" "}/ {contactLimit}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className={`flex items-center justify-center gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-medium text-sm transition-opacity shadow-lg ${
                isAtContactLimit 
                  ? "bg-muted text-muted-foreground cursor-not-allowed" 
                  : "gradient-hero text-primary-foreground hover:opacity-90 shadow-primary/20"
              }`}
              disabled={isAtContactLimit}
            >
              {isAtContactLimit ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {!isMobile && (
                <>
                  <span>{isAtContactLimit ? "Limit Reached" : "Add Contact"}</span>
                  {!isAtContactLimit && <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          {isAtContactLimit ? (
            <DropdownMenuContent align="end" className="w-64 bg-popover p-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Contact limit reached</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      You've reached the {contactLimit} contact limit on the free plan. Upgrade to Pro for unlimited contacts.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleUpgrade}
                  className="w-full px-4 py-2 rounded-lg gradient-hero text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  Upgrade to Pro
                </button>
              </div>
            </DropdownMenuContent>
          ) : (
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
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => onOpenImport("google")}>
              <Chrome className="mr-2 h-4 w-4" />
              Sync from Google
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="cursor-pointer" 
              onClick={handleSlackImport}
              disabled={slack.isLoading}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {slack.isLoading ? "Importing..." : "Import from Slack"}
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="cursor-pointer" 
              onClick={handleTeamsImport}
              disabled={teams.isLoading}
            >
              <Video className="mr-2 h-4 w-4" />
              {teams.isLoading ? "Importing..." : "Import from Teams"}
            </DropdownMenuItem>
            </DropdownMenuContent>
          )}
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted hover:bg-muted/80 transition-colors">
              <Avatar className="h-7 w-7 sm:h-9 sm:w-9">
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