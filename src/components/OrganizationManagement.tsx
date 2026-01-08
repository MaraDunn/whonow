import { useState } from "react";
import { Building2, Users, Key, CreditCard, Shield, Plus, Trash2, Copy, Check } from "lucide-react";
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

export function OrganizationManagement() {
  const { user } = useAuth();
  const { company, companyMembers, isAdmin } = useProfile(user?.id);
  const { tier, subscription, createCheckout, isLoading: subLoading } = useSubscription();
  const [copiedCode, setCopiedCode] = useState(false);

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

  if (!company) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization
          </CardTitle>
          <CardDescription>
            You don't have an organization yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Create an organization to collaborate with your team, share contacts, and manage members.
          </p>
          <Button className="w-full" disabled>
            <Plus className="h-4 w-4 mr-2" />
            Create Organization (Requires Team/Business Tier)
          </Button>
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
            {companyMembers.map((member) => (
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
                  <Badge variant={member.id === user?.id ? "default" : "secondary"}>
                    {member.id === user?.id ? "You" : "Member"}
                  </Badge>
                </div>
              </div>
            ))}

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

          <Button variant="outline" className="w-full" disabled>
            <Key className="h-4 w-4 mr-2" />
            Regenerate Invite Code (Coming Soon)
          </Button>

          <Button variant="outline" className="w-full text-destructive" disabled>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Organization (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

