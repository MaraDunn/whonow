import { useState } from "react";
import { Building2, Users, Key, CreditCard, Shield, Plus, Trash2, Copy, Check, ArrowRight, X, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { TIER_CONFIGS } from "@/types/subscription";
import { OrganizationIntegrationsPanel } from "@/components/OrganizationIntegrationsPanel";
import { BrandingSettings } from "@/components/BrandingSettings";

export function OrganizationManagement() {
  const { user } = useAuth();
  const { 
    company, 
    companyMembers, 
    isAdmin, 
    isSuperAdmin: isSuperAdminFromHook,
    joinCompany, 
    removeUserFromCompany,
    grantAdminRole,
    revokeAdminRole,
    refreshInviteCode,
    deleteCompany,
  } = useProfile(user?.id);
  const { tier, subscription, createCheckout, isLoading: subLoading, refreshSubscription } = useSubscription();
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [managingAdminUserId, setManagingAdminUserId] = useState<string | null>(null);

  // Fallback: if no owner is set and user is admin, treat as super admin (backwards compatibility)
  // Also, if the user created the company (they're the first admin), they're the super admin
  const isSuperAdmin = isSuperAdminFromHook || (isAdmin && (!company?.ownerId || company?.ownerId === user?.id));

  const tierConfig = TIER_CONFIGS[tier];

  const handleCopyInviteCode = () => {
    if (company?.inviteCode) {
      navigator.clipboard.writeText(company.inviteCode);
      setCopiedCode(true);
      toast.success("Invite code copied to clipboard");
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleManageSubscription = async () => {
    try {
      // Open Stripe customer portal
      toast.info("Opening subscription management...");
      await createCheckout(tier); // This should be modified to open portal instead
    } catch (error) {
      toast.error("Failed to open subscription management");
    }
  };

  const handleJoinCompany = () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    setIsJoining(true);
    // joinCompany is the mutate function from useProfile
    // It already has onSuccess/onError handlers that show toasts
    // We add our own callbacks to handle UI state
    joinCompany(inviteCode.trim(), {
      onSuccess: () => {
        setInviteCode("");
        setIsJoining(false);
        // Refresh subscription to get company subscription tier
        refreshSubscription();
      },
      onError: (error: any) => {
        setIsJoining(false);
        // The mutation's built-in onError will show a toast
        // We can add more specific error handling here if needed
        if (error?.message?.includes("invalid_invite_code")) {
          // Override with more specific message
          toast.error("Invalid invite code. Please check and try again.");
        } else if (error?.message?.includes("already_in_company")) {
          // Override with more specific message
          toast.error("You are already a member of an organization.");
        }
      },
    });
  };

  const handleRemoveUser = (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName || "this user"} from the organization?`)) {
      return;
    }

    setRemovingUserId(memberId);
    removeUserFromCompany(memberId, {
      onSuccess: () => {
        setRemovingUserId(null);
      },
      onError: () => {
        setRemovingUserId(null);
      },
    });
  };

  const handleGrantAdmin = (memberId: string, memberName: string) => {
    if (!confirm(`Grant admin permissions to ${memberName || "this user"}?`)) {
      return;
    }

    setManagingAdminUserId(memberId);
    grantAdminRole(memberId, {
      onSuccess: () => {
        setManagingAdminUserId(null);
      },
      onError: () => {
        setManagingAdminUserId(null);
      },
    });
  };

  const handleRevokeAdmin = (memberId: string, memberName: string) => {
    if (!confirm(`Revoke admin permissions from ${memberName || "this user"}?`)) {
      return;
    }

    setManagingAdminUserId(memberId);
    revokeAdminRole(memberId, {
      onSuccess: () => {
        setManagingAdminUserId(null);
      },
      onError: () => {
        setManagingAdminUserId(null);
      },
    });
  };

  const handleRefreshInviteCode = () => {
    if (!confirm("Are you sure you want to refresh the invite code? The old code will no longer work.")) {
      return;
    }
    refreshInviteCode();
  };

  const handleDeleteOrganization = () => {
    if (!confirm("Are you sure you want to delete this organization? This action cannot be undone. All data will be permanently deleted.")) {
      return;
    }
    deleteCompany();
  };

  if (!company) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization
          </CardTitle>
          <CardDescription>
            Join an organization to collaborate with your team, share contacts, and manage members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join-invite-code">Invite Code</Label>
            <Input
              id="join-invite-code"
              placeholder="Enter organization invite code..."
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inviteCode.trim()) {
                  handleJoinCompany();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Ask your organization admin for the invite code to join.
            </p>
          </div>
          <Button 
            onClick={handleJoinCompany}
            disabled={!inviteCode.trim() || isJoining}
            className="w-full"
          >
            {isJoining ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                Joining...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Join Organization
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
          <Separator />
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-900 dark:text-amber-100 mb-2">
              <strong>Want to create your own organization?</strong>
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Organization creation requires a Team or Business tier subscription. 
              Contact your organization admin to upgrade, or upgrade your personal account.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Organization Name</Label>
              <p className="font-medium">{company.name}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Your Role</Label>
              <Badge variant="outline">Member</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Contact your organization admin to manage settings.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Details
          </CardTitle>
          <CardDescription>
            Manage your organization settings and information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={company.name}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Contact support to change your organization name
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Invite Code</Label>
            <div className="flex gap-2">
              <Input
                value={company.inviteCode || "No invite code"}
                readOnly
                className="bg-muted font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyInviteCode}
                disabled={!company.inviteCode}
              >
                {copiedCode ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this code with team members to invite them to your organization
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>
            Manage your subscription and billing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-muted-foreground">Current Plan</Label>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-semibold text-lg">{tierConfig.name}</p>
                <Badge variant={tier === "business" ? "default" : tier === "team" ? "secondary" : "outline"}>
                  {tier}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                ${tierConfig.price}
                {tierConfig.price > 0 && <span className="text-sm text-muted-foreground">/{tierConfig.period}</span>}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Team Members</Label>
              <p className="font-medium">
                {companyMembers.length} / {tierConfig.seats}
              </p>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${Math.min((companyMembers.length / tierConfig.seats) * 100, 100)}%` }}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm font-medium">Plan Features</Label>
            <ul className="space-y-1">
              {tierConfig.features.map((feature, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-600" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {tier !== "business" && (
            <>
              <Separator />
              <Button
                className="w-full"
                onClick={() => createCheckout("business")}
                disabled={subLoading}
              >
                Upgrade to Business
              </Button>
            </>
          )}

          {subscription?.subscribed && (
            <>
              <Separator />
              <Button
                variant="outline"
                className="w-full"
                onClick={handleManageSubscription}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Billing
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            {companyMembers.length} member{companyMembers.length !== 1 ? "s" : ""} in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {companyMembers.map((member) => {
              const memberRoles = (member as any).roles || [];
              const isMemberAdmin = memberRoles.includes("admin");
              const isMemberSuperAdmin = member.id === company?.ownerId;
              const isCurrentUser = member.id === user?.id;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-medium text-primary">
                        {member.fullName?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{member.fullName || "Unnamed"}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.role && (
                      <Badge variant="outline" className="text-xs">
                        {member.role}
                      </Badge>
                    )}
                    {isMemberSuperAdmin ? (
                      <Badge variant="default" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Owner
                      </Badge>
                    ) : isMemberAdmin ? (
                      <Badge variant="secondary" className="text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Member
                      </Badge>
                    )}
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">
                        You
                      </Badge>
                    )}
                    {/* Show admin management buttons only for super admins (or admins if no owner set yet for backwards compatibility) */}
                    {isSuperAdmin && !isMemberSuperAdmin && member.id !== user?.id && (
                      <div className="flex items-center gap-1">
                        {isMemberAdmin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleRevokeAdmin(member.id, member.fullName || member.email || "this user")}
                            disabled={managingAdminUserId === member.id}
                            title="Revoke admin permissions"
                          >
                            {managingAdminUserId === member.id ? (
                              <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                            ) : (
                              <>
                                <ShieldX className="h-3 w-3 mr-1" />
                                Revoke Admin
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleGrantAdmin(member.id, member.fullName || member.email || "this user")}
                            disabled={managingAdminUserId === member.id}
                            title="Grant admin permissions"
                          >
                            {managingAdminUserId === member.id ? (
                              <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                            ) : (
                              <>
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Make Admin
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                    {isAdmin && member.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveUser(member.id, member.fullName || member.email || "this user")}
                        disabled={removingUserId === member.id}
                        title="Remove from organization"
                      >
                        {removingUserId === member.id ? (
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {companyMembers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No team members yet</p>
                <p className="text-sm">Share your invite code to add members</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organization Integrations */}
      <OrganizationIntegrationsPanel />

      {/* Custom Branding */}
      <BrandingSettings />

      {/* Admin Section */}
      <Card className="border-amber-500/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
            <Shield className="h-5 w-5" />
            Admin Controls
          </CardTitle>
          <CardDescription>
            Advanced organization management (use with caution)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <strong>Note:</strong> These actions can affect your entire organization. 
              Contact support if you need help with organization management.
            </p>
          </div>

          {isSuperAdmin ? (
            <>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleRefreshInviteCode}
              >
                <Key className="h-4 w-4 mr-2" />
                Regenerate Invite Code
              </Button>

              <Button 
                variant="outline" 
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" 
                onClick={handleDeleteOrganization}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Organization
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="w-full" disabled>
                <Key className="h-4 w-4 mr-2" />
                Regenerate Invite Code (Owner Only)
              </Button>

              <Button variant="outline" className="w-full text-destructive" disabled>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Organization (Owner Only)
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

