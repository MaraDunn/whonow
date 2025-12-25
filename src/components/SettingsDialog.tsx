import { useState } from "react";
import { X, Plus, RotateCcw, Sun, Moon, Monitor, Palette, Tags, User, Shield, LogOut, Copy, Check, Link2 } from "lucide-react";
import { useTheme } from "next-themes";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywords: string[];
  onAddKeyword: (keyword: string) => void;
  onRemoveKeyword: (keyword: string) => void;
  onResetKeywords: () => void;
  isCompanyKeywords?: boolean;
  canEditKeywords?: boolean;
}

export function SettingsDialog({
  open,
  onOpenChange,
  keywords,
  onAddKeyword,
  onRemoveKeyword,
  onResetKeywords,
  isCompanyKeywords = false,
  canEditKeywords = true,
}: SettingsDialogProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { profile, company, isAdmin } = useProfile(user?.id);

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      onAddKeyword(newKeyword);
      setNewKeyword("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    onOpenChange(false);
    if (error) {
      toast.error("Failed to sign out. Please try again.");
    } else {
      toast.success("Signed out successfully");
    }
  };

  const handleCopyInviteCode = () => {
    if (company?.inviteCode) {
      navigator.clipboard.writeText(company.inviteCode);
      setCopiedCode(true);
      toast.success("Invite code copied!");
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Determine number of tabs based on admin status
  const showAdminTab = isAdmin && company;
  const tabCount = showAdminTab ? 5 : 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className={`grid w-full grid-cols-${tabCount}`} style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="keywords" className="flex items-center gap-2">
              <Tags className="h-4 w-4" />
              <span className="hidden sm:inline">Keywords</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            {showAdminTab && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {/* General Tab */}
            <TabsContent value="general" className="space-y-6 mt-0">
              <div className="space-y-4">
                <Label className="text-base font-medium">Appearance</Label>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred theme for the app.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                    className="flex-1"
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className="flex-1"
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                    className="flex-1"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    System
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Keywords Tab - View only for company members */}
            <TabsContent value="keywords" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium">Preset Keywords</Label>
                  {isCompanyKeywords && (
                    <Badge variant="outline" className="text-xs">Company</Badge>
                  )}
                </div>
                {!isCompanyKeywords && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResetKeywords}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">
                {isCompanyKeywords 
                  ? "These keywords are managed by your company admin."
                  : "These keywords will appear as quick-select options when creating or editing contacts."
                }
              </p>

              {!isCompanyKeywords && (
                <div className="flex gap-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a new keyword..."
                    className="flex-1"
                  />
                  <Button onClick={handleAddKeyword} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg min-h-[100px]">
                {keywords.length === 0 ? (
                  <p className="text-sm text-muted-foreground w-full text-center py-4">
                    No keywords yet. {!isCompanyKeywords ? "Add some above!" : "Ask your admin to add some."}
                  </p>
                ) : (
                  keywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className={!isCompanyKeywords 
                        ? "cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        : ""
                      }
                      onClick={!isCompanyKeywords ? () => onRemoveKeyword(keyword) : undefined}
                    >
                      {keyword}
                      {!isCompanyKeywords && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))
                )}
              </div>
              
              {!isCompanyKeywords && (
                <p className="text-xs text-muted-foreground">
                  Click on a keyword to remove it.
                </p>
              )}
            </TabsContent>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-6 mt-0">
              {/* User Info */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Profile</Label>
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-sm font-medium">{profile?.fullName || "No name set"}</p>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
              </div>

              <Separator />

              {/* Company Info */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Organization</Label>
                {company ? (
                  <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{company.name}</p>
                      <Badge variant="secondary">{isAdmin ? "Admin" : "Member"}</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      You're using the app as an individual. Company features are available when you join or create an organization.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Sign Out */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent value="integrations" className="mt-0">
              <IntegrationsPanel />
            </TabsContent>
            {/* Admin Tab - Only visible to admins */}
            {showAdminTab && (
              <TabsContent value="admin" className="space-y-6 mt-0">
                {/* Invite Code */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Invite Members</Label>
                  <p className="text-sm text-muted-foreground">
                    Share this code with people you want to invite to your company.
                  </p>
                  {company?.inviteCode && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-lg font-mono">
                        {company.inviteCode}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyInviteCode}
                      >
                        {copiedCode ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Company Keywords Management */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Company Keywords</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onResetKeywords}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Manage preset keywords for everyone in your company.
                  </p>

                  <div className="flex gap-2">
                    <Input
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Add a new keyword..."
                      className="flex-1"
                    />
                    <Button onClick={handleAddKeyword} size="icon" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg min-h-[80px]">
                    {keywords.length === 0 ? (
                      <p className="text-sm text-muted-foreground w-full text-center py-4">
                        No company keywords yet. Add some above!
                      </p>
                    ) : (
                      keywords.map((keyword) => (
                        <Badge
                          key={keyword}
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          onClick={() => onRemoveKeyword(keyword)}
                        >
                          {keyword}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Click on a keyword to remove it.
                  </p>
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>

        <div className="flex justify-end pt-4 border-t border-border mt-4">
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
