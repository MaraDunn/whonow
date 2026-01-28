import { useState, useEffect } from "react";
import { 
  User, 
  CreditCard, 
  Shield, 
  Crown, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Mail, 
  Phone, 
  Save,
  Smartphone,
  Monitor,
  Clock,
  AlertTriangle,
  CheckCircle,
  Bell,
  BellOff,
  Sparkles
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { TIER_CONFIGS, SubscriptionTier } from "@/types/subscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AccountManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AuditLogEntry {
  id: string;
  action: string;
  created_at: string;
  user_agent: string | null;
  ip_address: string | null;
  details: Record<string, unknown> | null;
}

export const AccountManagementDialog = ({ open, onOpenChange }: AccountManagementDialogProps) => {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile(user?.id);
  const { 
    tier, 
    subscribed, 
    subscriptionEnd, 
    seatsUsed, 
    seatsLimit,
    openCustomerPortal, 
    createCheckout,
    isLoading: subscriptionLoading 
  } = useSubscription();

  // Personal Info state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Security state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  
  // Login history
  const [loginHistory, setLoginHistory] = useState<AuditLogEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Side-nav section (matches app Settings layout)
  const [selectedSection, setSelectedSection] = useState<"subscription" | "personal" | "security">("subscription");

  const navItems = [
    { id: "subscription" as const, label: "Subscription", icon: CreditCard },
    { id: "personal" as const, label: "Personal Info", icon: User },
    { id: "security" as const, label: "Security", icon: Shield },
  ];

  // Sync profile data when it changes
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  // Fetch login history when security tab is accessed
  const fetchLoginHistory = async () => {
    if (!user?.id) return;
    
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("user_id", user.id)
        .in("action", ["login", "signup", "password_change", "email_change"])
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setLoginHistory((data || []) as AuditLogEntry[]);
    } catch (error) {
      console.error("Failed to fetch login history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
      });
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    // Check password strength
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      toast.error("Password must include uppercase, lowercase, number, and special character");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update password";
      toast.error(errorMessage);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update email";
      toast.error(errorMessage);
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleUpgrade = (targetTier: SubscriptionTier) => {
    createCheckout(targetTier);
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="h-4 w-4" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getDeviceName = (userAgent: string | null) => {
    if (!userAgent) return "Unknown Device";
    const ua = userAgent.toLowerCase();
    if (ua.includes("iphone")) return "iPhone";
    if (ua.includes("ipad")) return "iPad";
    if (ua.includes("android")) return "Android Device";
    if (ua.includes("mac")) return "Mac";
    if (ua.includes("windows")) return "Windows PC";
    if (ua.includes("linux")) return "Linux PC";
    return "Browser";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const config = TIER_CONFIGS[tier];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-w-3xl h-[85vh] sm:h-[80vh] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b flex-shrink-0">
          <DialogTitle className="font-display text-xl">Account Management</DialogTitle>
          <DialogDescription className="sr-only">
            Manage your subscription, profile, and security settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">
          {/* Sidebar - matches app Settings layout */}
          <div className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r bg-muted/30 flex-shrink-0 flex flex-col">
            <nav className="p-2 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedSection(item.id);
                    if (item.id === "security") fetchLoginHistory();
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                    selectedSection === item.id
                      ? "bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {selectedSection === item.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                  )}
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {selectedSection === "subscription" && (
            <div className="space-y-6 p-4 sm:p-6">
              {/* Current Plan */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Current Plan</Label>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-lg">{config.name}</span>
                    </div>
                    {subscribed && (
                      <Badge variant="outline" className="text-primary border-primary/30">
                        Active
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    {config.price === 0 ? (
                      <p>Free forever</p>
                    ) : (
                      <>
                        <p className="font-medium text-foreground">${config.price}/{config.period}</p>
                        {subscriptionEnd && (
                          <p>Next billing date: {new Date(subscriptionEnd).toLocaleDateString()}</p>
                        )}
                      </>
                    )}
                  </div>

                  {seatsLimit > 1 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Team seats used</span>
                        <span className="font-medium">{seatsUsed} / {seatsLimit}</span>
                      </div>
                      <div className="mt-1.5 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(seatsUsed / seatsLimit) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Manage Subscription */}
              {subscribed ? (
                <div className="space-y-4">
                  <Label className="text-base font-medium">Manage Subscription</Label>
                  <p className="text-sm text-muted-foreground">
                    Update your payment method, change your plan, or cancel your subscription.
                  </p>
                  <Button 
                    onClick={openCustomerPortal} 
                    variant="outline" 
                    className="w-full"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Open Billing Portal
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Opens Stripe's secure billing portal where you can update payment methods, 
                    view invoices, and manage your subscription.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label className="text-base font-medium">Upgrade Your Plan</Label>
                  <p className="text-sm text-muted-foreground">
                    Unlock more features and remove limits by upgrading.
                  </p>
                  <div className="grid gap-3">
                    <Button 
                      onClick={() => handleUpgrade("pro")}
                      className="w-full gradient-hero text-primary-foreground"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Upgrade to Pro - $6.99/mo
                    </Button>
                    <Button 
                      onClick={() => handleUpgrade("team")}
                      variant="outline"
                      className="w-full"
                    >
                      Upgrade to Team - $49.99/mo
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Plan Features */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Your Features</Label>
                <ul className="space-y-2">
                  {config.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            )}

            {selectedSection === "personal" && (
            <div className="space-y-6 p-4 sm:p-6">
              {/* Email (read-only, editable in security) */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Email Address</Label>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">{user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    To change your email, go to the Security tab
                  </p>
                </div>
              </div>

              <Separator />

              {/* Editable Fields */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Profile Information</Label>
                
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSavingProfile ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
            )}

            {selectedSection === "security" && (
            <div className="space-y-6 p-4 sm:p-6">
              {/* Change Password */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Change Password</Label>
                <p className="text-sm text-muted-foreground">
                  Use a strong password with at least 8 characters, including uppercase, lowercase, numbers, and special characters.
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
                </div>
              </div>

              <Separator />

              {/* Notification Settings */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Notification Settings</Label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Email Notifications</p>
                        <p className="text-xs text-muted-foreground">Product updates and tips</p>
                      </div>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Security Alerts</p>
                        <p className="text-xs text-muted-foreground">Login from new devices</p>
                      </div>
                    </div>
                    <Switch
                      checked={securityAlerts}
                      onCheckedChange={setSecurityAlerts}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Login History / Devices */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Recent Activity</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={fetchLoginHistory}
                    disabled={isLoadingHistory}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Review recent logins and security events on your account.
                </p>
                
                <div className="space-y-2">
                  {isLoadingHistory ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Loading activity...
                    </div>
                  ) : loginHistory.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm bg-muted/50 rounded-lg">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No recent activity recorded</p>
                      <p className="text-xs mt-1">Login events will appear here</p>
                    </div>
                  ) : (
                    loginHistory.map((entry) => (
                      <div 
                        key={entry.id} 
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="p-2 bg-background rounded-lg">
                          {getDeviceIcon(entry.user_agent)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {entry.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {getDeviceName(entry.user_agent)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(entry.created_at)}
                            {entry.ip_address && ` • ${entry.ip_address}`}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        <div className="flex justify-end px-4 sm:px-6 py-4 border-t border-border shrink-0">
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
