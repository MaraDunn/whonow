import { useState } from "react";
import { X, Plus, RotateCcw, Sun, Moon, Monitor, Palette, Tags, User, Shield, LogOut, Copy, Check, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useTheme } from "next-themes";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { AdminPdfImport } from "@/components/AdminPdfImport";
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
import { supabase } from "@/integrations/supabase/client";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywords: string[];
  onAddKeyword: (keyword: string) => void;
  onRemoveKeyword: (keyword: string) => void;
  onResetKeywords: () => void;
  isCompanyKeywords?: boolean;
  canEditKeywords?: boolean;
  onBulkImport?: (contacts: Array<{
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    role?: string;
    tags?: string[];
  }>) => void;
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
  onBulkImport,
}: SettingsDialogProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { profile, company, isAdmin } = useProfile(user?.id);

  // Security tab state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

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

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success("Confirmation email sent to your new address");
      setNewEmail("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update email");
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleSignOutAllDevices = async () => {
    setIsSigningOutAll(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      toast.success("Signed out of all devices");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to sign out of all devices");
    } finally {
      setIsSigningOutAll(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) {
      toast.error("No email found for your account");
      return;
    }

    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setIsSendingReset(false);
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
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
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

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6 mt-0">
              {/* Change Password */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Change Password</Label>
                <p className="text-sm text-muted-foreground">
                  Update your password to keep your account secure.
                </p>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleChangePassword} 
                    disabled={isChangingPassword || !newPassword || !confirmPassword}
                    className="w-full"
                  >
                    {isChangingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>

                <div className="pt-2">
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm text-muted-foreground"
                    onClick={handleSendPasswordReset}
                    disabled={isSendingReset}
                  >
                    {isSendingReset ? "Sending..." : "Forgot password? Send reset email"}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Change Email */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Change Email</Label>
                <p className="text-sm text-muted-foreground">
                  Current email: <span className="font-medium">{user?.email}</span>
                </p>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-email" className="text-sm">New Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-email"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter new email"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleChangeEmail} 
                    disabled={isChangingEmail || !newEmail}
                    variant="outline"
                    className="w-full"
                  >
                    {isChangingEmail ? "Sending confirmation..." : "Update Email"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    A confirmation link will be sent to your new email address.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Session Management */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Session Management</Label>
                <p className="text-sm text-muted-foreground">
                  Sign out of all devices if you suspect unauthorized access.
                </p>
                
                <Button
                  variant="outline"
                  onClick={handleSignOutAllDevices}
                  disabled={isSigningOutAll}
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {isSigningOutAll ? "Signing out..." : "Sign Out All Devices"}
                </Button>
              </div>
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

                <Separator />

                {/* Bulk Contact Import */}
                {onBulkImport && (
                  <AdminPdfImport onImport={onBulkImport} />
                )}

                <Separator />

                {/* Integrations */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Integrations</Label>
                  <p className="text-sm text-muted-foreground">
                    Connect your company to Slack and Microsoft Teams.
                  </p>
                  <IntegrationsPanel />
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
