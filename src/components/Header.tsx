import { Plus, User, Settings, LogOut, FileUp, Camera, Chrome, ChevronDown, Building2, MessageSquare, Video } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useSlackIntegration } from "@/hooks/useSlackIntegration";
import { useTeamsIntegration } from "@/hooks/useTeamsIntegration";
import { toast } from "sonner";
import { WhoNowLogo } from "@/components/WhoNowLogo";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface HeaderProps {
  contactCount: number;
  onOpenAddDialog: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenImport: (tab?: string) => void;
  onContactsImported?: () => void;
}

export function Header({ 
  contactCount, 
  onOpenAddDialog, 
  onOpenProfile, 
  onOpenSettings, 
  onOpenImport, 
  onContactsImported, 
}: HeaderProps) {
  const { user, signOut } = useAuth();
  const { profile, company } = useProfile(user?.id);
  const { canAccessFeature } = useSubscription();
  const hasIntegrationsAccess = canAccessFeature("integrations");
  const slack = useSlackIntegration();
  const teams = useTeamsIntegration();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Failed to sign out. Please try again.");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
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

  return (
    <header className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8 animate-fade-in gap-2 sm:gap-4">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <SidebarTrigger className="md:hidden shrink-0" />
        <WhoNowLogo size={isMobile ? "sm" : "md"} showText={!isMobile} />
        {!isMobile && (
          <div className="border-l border-border pl-2 sm:pl-4 min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {contactCount} {contactCount === 1 ? "contact" : "contacts"}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              data-onboarding-add-button
              className="flex items-center justify-center gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-medium text-sm transition-opacity shadow-lg gradient-hero text-primary-foreground hover:opacity-90 shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              {!isMobile && (
                <>
                  <span>Add Contact</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 sm:w-56 bg-popover max-w-[calc(100vw-2rem)]">
              <DropdownMenuItem className="cursor-pointer" onClick={onOpenAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
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
            {hasIntegrationsAccess && (
              <>
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
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted hover:bg-muted/80 transition-colors">
              <Avatar className="h-7 w-7 sm:h-9 sm:w-9">
                {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {profileInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 sm:w-64 bg-popover max-w-[calc(100vw-2rem)]">
            <div className="px-2 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 shrink-0">
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
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{company.name}</span>
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={onOpenProfile}>
              <User className="mr-2 h-4 w-4" />
              Edit Profile
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