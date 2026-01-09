import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhoNowLogo } from "@/components/WhoNowLogo";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AccountManagementDialog } from "./AccountManagementDialog";

interface LandingNavProps {
  onSignIn: () => void;
  onGetStarted: () => void;
}

export const LandingNav = ({ onSignIn, onGetStarted }: LandingNavProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { profile } = useProfile(user?.id);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Failed to sign out");
    } else {
      toast.success("Signed out successfully");
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <WhoNowLogo size="sm" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection("features")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("demo")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Demo
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              FAQ
            </button>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Button
                  onClick={() => navigate("/app")}
                  className="gradient-hero text-primary-foreground"
                >
                  Launch App
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={profile?.avatarUrl || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {getInitials(profile?.fullName)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{profile?.fullName || "User"}</p>
                      <p className="text-xs text-muted-foreground">{profile?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setAccountDialogOpen(true)}>
                      <Settings className="mr-2 h-4 w-4" />
                      Account Management
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/app")}>
                      <User className="mr-2 h-4 w-4" />
                      Go to App
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={onSignIn}>
                  Sign In
                </Button>
                <Button onClick={onGetStarted} className="gradient-hero text-primary-foreground">
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-background border-b border-border animate-fade-in">
          <div className="px-4 py-4 space-y-4">
            <button
              onClick={() => scrollToSection("features")}
              className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("demo")}
              className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Demo
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              FAQ
            </button>
            <div className="pt-4 border-t border-border space-y-2">
              {user ? (
                <>
                  <Button
                    onClick={() => navigate("/app")}
                    className="w-full gradient-hero text-primary-foreground"
                  >
                    Launch App
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="w-full"
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignIn();
                    }}
                    className="w-full"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onGetStarted();
                    }}
                    className="w-full gradient-hero text-primary-foreground"
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <AccountManagementDialog 
        open={accountDialogOpen} 
        onOpenChange={setAccountDialogOpen} 
      />
    </nav>
  );
};
