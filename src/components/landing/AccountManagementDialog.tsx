import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Sparkles,
  Camera,
  Loader2,
  Zap,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Navigation,
  MapPin
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { generateAutoKeywords } from "@/utils/autoKeywords";
import { TIER_CONFIGS, SubscriptionTier } from "@/types/subscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Folder } from "@/types/folder";

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

function ProfileCollapsibleSection({ title, open, onOpenChange, children }: { title: string; open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-3 sm:py-1.5 text-base sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors touch-manipulation">
        <span>{title}</span>
        {open ? <ChevronUp className="h-5 w-5 sm:h-4 sm:w-4" /> : <ChevronDown className="h-5 w-5 sm:h-4 sm:w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2 sm:pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export const AccountManagementDialog = ({ open, onOpenChange }: AccountManagementDialogProps) => {
  const queryClient = useQueryClient();
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

  // Personal Info state (aligned with contact form: name, phone, email, company, role, description, keywords, address)
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadAvatar, uploading } = useAvatarUpload();

  // Fetch my-profile contact when dialog is open (so Edit Profile can sync with it)
  const { data: myProfileContact } = useQuery({
    queryKey: ["my-profile-contact", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("owner_id", user.id)
        .contains("tags", ["my-profile"])
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        name: (row.name as string) || "",
        email: (row.email as string) || "",
        phone: (row.phone as string) || "",
        company: (row.company as string) || "",
        role: (row.role as string) || "",
        description: (row.description as string) || "",
        tags: (row.tags as string[]) || [],
        avatar: (row.avatar as string) || undefined,
        folderId: (row.folder_id as string) || undefined,
        address: (row.address as string) || "",
        city: (row.city as string) || "",
        state: (row.state as string) || "",
        zipCode: (row.zip_code as string) || "",
        country: (row.country as string) || "",
      };
    },
    enabled: !!user && open,
  });

  // Fetch folders for Edit Profile (same as contact form)
  const { data: allFoldersRaw = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("folders").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; color: string | null; directory_type: string; is_organization_folder: boolean | null }>;
    },
    enabled: !!user && open,
  });
  const folders: Folder[] = useMemo(
    () =>
      allFoldersRaw
        .filter((f) => f.directory_type === "contacts" && !f.is_organization_folder)
        .map((f) => ({ id: f.id, name: f.name, color: f.color || "#6366f1", createdAt: "", directoryType: "contacts" as const, isOrganizationFolder: false })),
    [allFoldersRaw]
  );

  const { autoKeywords: autoTags } = useMemo(
    () => generateAutoKeywords(role, company, description, tags),
    [role, company, description, tags]
  );

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

  // Sync profile and my-profile contact into form state (my-profile overrides when present)
  useEffect(() => {
    if (!open) return;
    if (myProfileContact) {
      setFullName(myProfileContact.name || "");
      setPhone(myProfileContact.phone || "");
      setEmail(myProfileContact.email || user?.email || "");
      setCompany(myProfileContact.company || "");
      setRole(myProfileContact.role || "");
      setDescription(myProfileContact.description || "");
      setTags(myProfileContact.tags.filter((t) => t !== "my-profile"));
      setAvatar(myProfileContact.avatar);
      setFolderId(myProfileContact.folderId);
      setAddress(myProfileContact.address || "");
      setCity(myProfileContact.city || "");
      setState(myProfileContact.state || "");
      setZipCode(myProfileContact.zipCode || "");
      setCountry(myProfileContact.country || "");
    } else if (profile || user?.email) {
      setFullName(profile?.fullName || "");
      setPhone(profile?.phone || "");
      setEmail(user?.email || "");
      setCompany("");
      setRole(profile?.role || "");
      setDescription(profile?.description || "");
      setTags([]);
      setAvatar(profile?.avatarUrl);
      setFolderId(undefined);
      setAddress("");
      setCity("");
      setState("");
      setZipCode("");
      setCountry("");
    }
  }, [open, profile, user?.email, myProfileContact]);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    const value = tagInput.trim().replace(/,$/, "");
    if (value && !tags.includes(value)) setTags([...tags, value]);
    setTagInput("");
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));
  const removeAutoTag = (t: string) => setTags(tags.filter((x) => x !== t));
  const togglePresetTag = (preset: string) => {
    if (tags.includes(preset)) setTags(tags.filter((x) => x !== preset));
    else setTags([...tags, preset]);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadAvatar(file);
    if (url) setAvatar(url);
  };

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
    if (!fullName.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsSavingProfile(true);
    try {
      updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        role: role.trim() || undefined,
        description: description.trim() || undefined,
        avatarUrl: avatar,
      });

      const allKeywords = [...tags, ...autoTags].filter(Boolean);
      const contactTags = [...new Set([...allKeywords, "my-profile"])];
      const payload = {
        name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        role: role.trim() || null,
        description: description.trim() || null,
        tags: contactTags,
        avatar: avatar || null,
        folder_id: folderId || null,
        owner_id: user?.id ?? null,
        company_id: profile?.companyId || null,
        is_shared: false,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip_code: zipCode.trim() || null,
        country: country.trim() || null,
      };

      if (myProfileContact?.id) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", myProfileContact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["my-profile-contact", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
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
            <div className="space-y-5 sm:space-y-4 p-4 sm:p-6">
              {/* Same layout as contact edit form – "you" language throughout */}

              {/* Avatar */}
              <div className="flex flex-col items-center sm:items-start gap-4">
                <div className="relative cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                  <Avatar className="h-20 w-20 sm:h-16 sm:w-16 border-2 border-border">
                    <AvatarImage src={avatar} alt={fullName || "Avatar"} />
                    <AvatarFallback className="text-base sm:text-sm bg-muted">
                      {fullName ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? <Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin text-muted-foreground" /> : <Camera className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />}
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploading} />
              </div>

              {/* Name */}
              <div className="space-y-2 sm:space-y-1.5">
                <Label htmlFor="profile-name" className="text-sm sm:text-xs font-medium">Name *</Label>
                <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required className="h-11 sm:h-9 text-base sm:text-sm" />
              </div>

              {/* Phone and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                <div className="space-y-2 sm:space-y-1.5">
                  <Label htmlFor="profile-phone" className="text-sm sm:text-xs font-medium">Phone Number</Label>
                  <Input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="h-11 sm:h-9 text-base sm:text-sm" />
                </div>
                <div className="space-y-2 sm:space-y-1.5">
                  <Label htmlFor="profile-email" className="text-sm sm:text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Input id="profile-email" type="email" value={email} readOnly className="h-11 sm:h-9 text-base sm:text-sm bg-muted/50" />
                    <p className="text-xs text-muted-foreground mt-1">To change your email, go to the Security tab</p>
                  </div>
                </div>
              </div>

              {/* Folder, Company, Role */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
                {folders.length > 0 && (
                  <div className="space-y-2 sm:space-y-1.5">
                    <Label htmlFor="profile-folder" className="text-sm sm:text-xs font-medium">Folder</Label>
                    <Select value={folderId || "none"} onValueChange={(val) => setFolderId(val === "none" ? undefined : val)}>
                      <SelectTrigger id="profile-folder" className="h-11 sm:h-9 text-base sm:text-sm">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No folder</SelectItem>
                        {folders.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: f.color }} />
                              {f.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2 sm:space-y-1.5">
                  <Label htmlFor="profile-company" className="text-sm sm:text-xs font-medium">Company</Label>
                  <Input id="profile-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Where you work" className="h-11 sm:h-9 text-base sm:text-sm" />
                </div>
                <div className="space-y-2 sm:space-y-1.5">
                  <Label htmlFor="profile-role" className="text-sm sm:text-xs font-medium">Role</Label>
                  <Input id="profile-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Your role or title" className="h-11 sm:h-9 text-base sm:text-sm" />
                </div>
              </div>

              {/* Description – "you" language */}
              <div className="space-y-2 sm:space-y-1.5">
                <Label htmlFor="profile-description" className="text-sm sm:text-xs font-medium">Description</Label>
                <Textarea
                  id="profile-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What do you handle? (e.g. I handle all marketing campaigns)"
                  rows={3}
                  className="resize-none text-base sm:text-sm min-h-[4rem] sm:min-h-[2.5rem]"
                />
              </div>

              {/* Keywords – same styling as contact form */}
              <div className="space-y-3 sm:space-y-2 p-4 sm:p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Label htmlFor="profile-tags" className="text-base sm:text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Zap className="h-5 w-5 sm:h-4 sm:w-4 text-primary" />
                  Keywords
                  <span className="text-xs sm:text-[10px] font-normal text-muted-foreground ml-1">(Easiest way to enrich your profile)</span>
                </Label>
                <Textarea
                  id="profile-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Type keywords separated by commas or press Enter..."
                  rows={3}
                  className="resize-none text-base sm:text-sm min-h-[4rem] sm:min-h-[2.5rem] bg-background"
                />
                {(tags.length > 0 || autoTags.length > 0) && (
                  <div className="flex flex-wrap gap-2 sm:gap-1.5 pt-2">
                    {autoTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="cursor-pointer border-dashed hover:bg-destructive/10 text-sm sm:text-xs py-1.5 sm:py-0.5 px-2.5 sm:px-2" onClick={() => removeAutoTag(tag)}>
                        {tag}
                        <X className="h-4 w-4 sm:h-3 sm:w-3 ml-1.5 sm:ml-1" />
                      </Badge>
                    ))}
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-sm sm:text-xs py-1.5 sm:py-0.5 px-2.5 sm:px-2" onClick={() => removeTag(tag)}>
                        {tag}
                        <X className="h-4 w-4 sm:h-3 sm:w-3 ml-1.5 sm:ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Address – collapsible */}
              <ProfileCollapsibleSection title="Address" open={addressOpen} onOpenChange={setAddressOpen}>
                <div className="space-y-4 sm:space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-address" className="text-sm font-medium">Street Address</Label>
                    <Input id="profile-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" className="h-11 sm:h-9 text-base sm:text-sm" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="profile-city" className="text-sm font-medium">City</Label>
                      <Input id="profile-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Francisco" className="h-11 sm:h-9 text-base sm:text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-state" className="text-sm font-medium">State</Label>
                      <Input id="profile-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="CA" className="h-11 sm:h-9 text-base sm:text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="profile-zipCode" className="text-sm font-medium">ZIP Code</Label>
                      <Input id="profile-zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="94102" className="h-11 sm:h-9 text-base sm:text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-country" className="text-sm font-medium">Country</Label>
                      <Input id="profile-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="USA" className="h-11 sm:h-9 text-base sm:text-sm" />
                    </div>
                  </div>
                </div>
              </ProfileCollapsibleSection>

              <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full h-11 sm:h-9 text-base sm:text-sm">
                <Save className="w-4 h-4 mr-2" />
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </Button>
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
