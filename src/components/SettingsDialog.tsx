import { useState, useMemo, useEffect } from "react";
import { X, Plus, RotateCcw, Sun, Moon, Monitor, Palette, Tags, User, Shield, LogOut, Copy, Check, Eye, EyeOff, Lock, Mail, Sparkles, Building2, Search, ChevronRight, CreditCard, Users, Key, Trash2, FileText, Settings, ShieldCheck, ShieldX, ArrowRight, AlertTriangle, Download, Loader2, RefreshCw, Link2 } from "lucide-react";
import { useTheme } from "next-themes";
import { OrganizationIntegrationsPanel } from "@/components/OrganizationIntegrationsPanel";
import { BrandingSettings } from "@/components/BrandingSettings";
import { DuplicateCleanupDialog } from "@/components/DuplicateCleanupDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TIER_CONFIGS } from "@/types/subscription";
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
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { getAuthRedirectOrigin } from "@/utils/launchMode";
import { validatePassword, validatePasswordMatch } from "@/lib/passwordValidation";
import { fetchAllContactsForExport, contactsToCsv, downloadCsvFile } from "@/utils/exportContacts";
import { useGoogleContacts } from "@/hooks/useGoogleContacts";
import { useGoogleCalendarIntegration } from "@/hooks/useGoogleCalendarIntegration";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import { Switch } from "@/components/ui/switch";

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

type SyncProgress = { current: number; total: number; lastContact: string };
type DiagnosticResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  failureReasonSummary: Record<string, number>;
  firstFailureDebug?: {
    contactRef: { id: string; name: string; email: string | null; phone: string | null };
    operation: string;
    url: string;
    requestBody: unknown;
    status: number;
    reason: string | null;
    statusText: string | null;
    message: string;
    rawErrorBody: string;
  };
};

function GoogleSettingsSection() {
  const { user } = useAuth();
  const googleContacts = useGoogleContacts();
  const { status: calendarStatus, isLoading: calendarLoading, connect: connectCalendar, disconnect: disconnectCalendar } = useGoogleCalendarIntegration();
  const { addFollowUpsToCalendar, updateAddFollowUpsToCalendar } = useReminderSettings();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [dryRunResult, setDryRunResult] = useState<{ toCreate: number; toUpdate: number; toSkip: number } | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [copiedDiagnostic, setCopiedDiagnostic] = useState(false);
  const isGoogleConnected = googleContacts.isAuthenticated;
  const isCalendarConnected = calendarStatus?.connected ?? false;

  const handleConnectGoogle = async () => {
    if (!googleContacts.isAuthenticated) {
      await googleContacts.signIn();
    }
  };

  const handleDryRun = async () => {
    if (!user?.id || !googleContacts.isAuthenticated || isSyncing || isDryRunning) return;
    setIsDryRunning(true);
    setDryRunResult(null);
    try {
      const contacts = await fetchAllContactsForExport(supabase, user.id);
      if (contacts.length === 0) {
        toast.info("No contacts to preview");
        return;
      }
      const result = await googleContacts.syncToGoogle(contacts, { dryRun: true });
      if (result.dryRunPlan) {
        setDryRunResult(result.dryRunPlan);
      }
    } catch (err) {
      console.error("Dry run error:", err);
      toast.error("Failed to preview sync.");
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleSyncToGoogle = async () => {
    if (!user?.id || isSyncing) return;
    if (!googleContacts.isAuthenticated) {
      toast.info("Connect your Google account first");
      await googleContacts.signIn();
      return;
    }
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 0, lastContact: "Loading contacts…" });
    setDryRunResult(null);
    try {
      const contacts = await fetchAllContactsForExport(supabase, user.id);
      if (contacts.length === 0) {
        toast.info("No contacts to sync");
        return;
      }
      setSyncProgress({ current: 0, total: contacts.length, lastContact: "" });
      const result = await googleContacts.syncToGoogle(contacts, {
        onProgress: (current, total, lastContact) => {
          setSyncProgress({ current, total, lastContact });
        },
      });
      if (result.failed > 0) {
        setDiagnosticResult(result as DiagnosticResult);
      }
    } catch (err) {
      console.error("Sync to Google error:", err);
      toast.error("Failed to sync contacts to Google. Please try again.");
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleDiagnosticSync = async () => {
    if (!user?.id || !googleContacts.isAuthenticated || isSyncing) return;
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 0, lastContact: "Loading contacts…" });
    setDiagnosticResult(null);
    try {
      const contacts = await fetchAllContactsForExport(supabase, user.id);
      if (contacts.length === 0) {
        toast.info("No contacts to diagnose");
        return;
      }
      const result = await googleContacts.syncToGoogle(contacts, {
        debugFailFast: true,
        onProgress: (current, total, lastContact) => {
          setSyncProgress({ current, total, lastContact });
        },
      });
      setDiagnosticResult(result as DiagnosticResult);
      setShowDiagnostic(true);
    } catch (err) {
      console.error("Diagnostic sync error:", err);
      toast.error("Diagnostic sync failed.");
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleCopyDiagnostic = () => {
    if (!diagnosticResult) return;
    navigator.clipboard.writeText(JSON.stringify(diagnosticResult, null, 2));
    setCopiedDiagnostic(true);
    setTimeout(() => setCopiedDiagnostic(false), 2000);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Connect to Google</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Google Contacts and Google Calendar connect separately. Use Contacts for import/sync and Calendar for follow-up events.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Google Contacts account
          </CardTitle>
          <CardDescription>
            {isGoogleConnected
              ? "Connected for importing contacts and syncing WhoNow contacts to Google Contacts."
              : "Connect Google Contacts to import contacts and sync WhoNow contacts to your Google account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isGoogleConnected ? (
            <Button onClick={handleConnectGoogle} disabled={googleContacts.isLoading}>
              {googleContacts.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Connect Google Contacts
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-green-600 dark:text-green-400">Contacts connected</Badge>
              <Button variant="outline" size="sm" onClick={googleContacts.signOut} disabled={googleContacts.isLoading}>
                Disconnect Google Contacts
              </Button>
            </div>
          )}

          {googleContacts.isConfigured && (
            <>
              <Separator />
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Sync contacts to Google</Label>
                    <p className="text-xs text-muted-foreground">
                      Push your WhoNow contacts to your Google account. Existing contacts (matched by email or phone) are updated; others are created.
                    </p>
                  </div>
                  {isGoogleConnected ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDryRun}
                        disabled={isSyncing || isDryRunning}
                      >
                        {isDryRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Eye className="h-4 w-4 mr-2" />
                        )}
                        Preview
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleSyncToGoogle}
                        disabled={isSyncing || isDryRunning}
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Syncing…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync now
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Connect Google above</span>
                  )}
                </div>

                {syncProgress && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Syncing {syncProgress.current} / {syncProgress.total}…</span>
                      <span className="truncate ml-2 max-w-[200px]">{syncProgress.lastContact}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {dryRunResult && (
                  <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
                    <p className="font-medium">Sync preview:</p>
                    <p>{dryRunResult.toCreate} contacts will be <span className="text-green-600 dark:text-green-400 font-medium">created</span></p>
                    <p>{dryRunResult.toUpdate} contacts will be <span className="text-blue-600 dark:text-blue-400 font-medium">updated</span></p>
                    {dryRunResult.toSkip > 0 && <p>{dryRunResult.toSkip} contacts will be skipped (no name)</p>}
                  </div>
                )}

                {isGoogleConnected && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-7"
                      onClick={handleDiagnosticSync}
                      disabled={isSyncing || isDryRunning}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Diagnose sync issues
                    </Button>
                    {diagnosticResult && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground h-7"
                        onClick={() => setShowDiagnostic(true)}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        View last report
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {showDiagnostic && diagnosticResult && (
                <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Sync Diagnostic Report</Label>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCopyDiagnostic}>
                        {copiedDiagnostic ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedDiagnostic ? "Copied" : "Copy JSON"}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowDiagnostic(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="rounded bg-background p-2 text-center">
                      <div className="font-bold text-green-600 dark:text-green-400">{diagnosticResult.created}</div>
                      <div className="text-muted-foreground">Created</div>
                    </div>
                    <div className="rounded bg-background p-2 text-center">
                      <div className="font-bold text-blue-600 dark:text-blue-400">{diagnosticResult.updated}</div>
                      <div className="text-muted-foreground">Updated</div>
                    </div>
                    <div className="rounded bg-background p-2 text-center">
                      <div className="font-bold text-yellow-600 dark:text-yellow-400">{diagnosticResult.skipped}</div>
                      <div className="text-muted-foreground">Skipped</div>
                    </div>
                    <div className="rounded bg-background p-2 text-center">
                      <div className="font-bold text-red-600 dark:text-red-400">{diagnosticResult.failed}</div>
                      <div className="text-muted-foreground">Failed</div>
                    </div>
                  </div>
                  {Object.keys(diagnosticResult.failureReasonSummary).length > 0 && (
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Failure reasons:</p>
                      {Object.entries(diagnosticResult.failureReasonSummary)
                        .sort(([, a], [, b]) => b - a)
                        .map(([reason, count]) => (
                          <p key={reason} className="text-muted-foreground font-mono">
                            {reason}: {count}
                          </p>
                        ))}
                    </div>
                  )}
                  {diagnosticResult.firstFailureDebug && (
                    <div className="text-xs space-y-1">
                      <p className="font-medium">First failure detail:</p>
                      <div className="rounded bg-background p-2 font-mono text-[11px] max-h-48 overflow-auto whitespace-pre-wrap break-all">
                        <p><span className="text-muted-foreground">Contact:</span> {diagnosticResult.firstFailureDebug.contactRef.name} ({diagnosticResult.firstFailureDebug.contactRef.email || diagnosticResult.firstFailureDebug.contactRef.phone || "no id"})</p>
                        <p><span className="text-muted-foreground">Operation:</span> {diagnosticResult.firstFailureDebug.operation}</p>
                        <p><span className="text-muted-foreground">HTTP:</span> {diagnosticResult.firstFailureDebug.status} {diagnosticResult.firstFailureDebug.statusText}</p>
                        <p><span className="text-muted-foreground">Reason:</span> {diagnosticResult.firstFailureDebug.reason || "none"}</p>
                        <p><span className="text-muted-foreground">Message:</span> {diagnosticResult.firstFailureDebug.message}</p>
                        <p><span className="text-muted-foreground">URL:</span> {diagnosticResult.firstFailureDebug.url}</p>
                        <p><span className="text-muted-foreground">Request body:</span></p>
                        <pre className="ml-2">{JSON.stringify(diagnosticResult.firstFailureDebug.requestBody, null, 2)}</pre>
                        <p><span className="text-muted-foreground">Raw error:</span></p>
                        <pre className="ml-2">{diagnosticResult.firstFailureDebug.rawErrorBody}</pre>
                      </div>
                    </div>
                  )}
                  {diagnosticResult.errors.length > 0 && (
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Error messages ({diagnosticResult.errors.length}):</p>
                      <div className="rounded bg-background p-2 max-h-32 overflow-auto text-[11px] text-muted-foreground">
                        {diagnosticResult.errors.slice(0, 20).map((err, i) => (
                          <p key={i}>{err}</p>
                        ))}
                        {diagnosticResult.errors.length > 20 && (
                          <p className="font-medium">… and {diagnosticResult.errors.length - 20} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Google Calendar integration</Label>
              <Badge variant="secondary" className={isCalendarConnected ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                {isCalendarConnected ? "Calendar connected" : "Calendar not connected"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              This is separate from Google Contacts. Connect it to create calendar events from follow-up dates.
            </p>
            {isCalendarConnected ? (
              <Button variant="outline" size="sm" onClick={disconnectCalendar} disabled={calendarLoading}>
                {calendarLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Disconnect Google Calendar
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={connectCalendar} disabled={calendarLoading}>
                {calendarLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Connect Google Calendar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Features</CardTitle>
          <CardDescription>
            Choose which Google features to enable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label
                htmlFor="add-follow-ups-to-calendar"
                className={`text-sm font-medium ${!isCalendarConnected ? "text-muted-foreground" : ""}`}
              >
                Add follow-ups to my calendar
              </Label>
              <p className="text-xs text-muted-foreground">
                {isCalendarConnected
                  ? "When you set a follow-up date on a contact, create an all-day event in Google Calendar."
                  : "Connect Google Calendar above to enable this. Google Contacts alone is not enough."}
              </p>
            </div>
            <Switch
              id="add-follow-ups-to-calendar"
              checked={addFollowUpsToCalendar}
              onCheckedChange={(checked) => updateAddFollowUpsToCalendar(checked)}
              disabled={!isCalendarConnected}
            />
          </div>

        </CardContent>
      </Card>
    </div>
  );
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
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { 
    profile, 
    company, 
    companyMembers,
    isAdmin, 
    isSuperAdmin: isSuperAdminFromHook,
    createCompany,
    joinCompany,
    removeUserFromCompany,
    grantAdminRole,
    revokeAdminRole,
    refreshInviteCode,
    deleteCompany,
  } = useProfile(user?.id);
  const { tier, subscription, createCheckout, isLoading: subLoading, refreshSubscription, canAccessFeature } = useSubscription();

  // Fallback: if no owner is set and user is admin, treat as super admin (backwards compatibility)
  const isSuperAdmin = isSuperAdminFromHook || (isAdmin && (!company?.ownerId || company?.ownerId === user?.id));
  const tierConfig = TIER_CONFIGS[tier];
  
  // Feature access checks
  const hasIntegrationsAccess = canAccessFeature("integrations");

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
  
  // Organization management state
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [managingAdminUserId, setManagingAdminUserId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  
  // Navigation state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["general", "account", "organization"]));
  const [duplicateCleanupOpen, setDuplicateCleanupOpen] = useState(false);
  const [isExportingContacts, setIsExportingContacts] = useState(false);

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

  const handleCreateOrganization = () => {
    if (!newOrgName.trim()) {
      toast.error("Please enter an organization name");
      return;
    }
    createCompany(newOrgName.trim());
    setNewOrgName("");
    setShowCreateOrgDialog(false);
  };

  const handleChangePassword = async () => {
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      toast.error(passwordCheck.error);
      return;
    }
    const matchCheck = validatePasswordMatch(newPassword, confirmPassword);
    if (!matchCheck.valid) {
      toast.error(matchCheck.error);
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
      const message = error instanceof Error ? error.message : "Failed to update password";
      toast.error(message);
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
      const message = error instanceof Error ? error.message : "Failed to update email";
      toast.error(message);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to sign out of all devices";
      toast.error(message);
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
        redirectTo: `${getAuthRedirectOrigin()}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to send reset email";
      toast.error(message);
    } finally {
      setIsSendingReset(false);
    }
  };

  // Organization management handlers
  const handleManageSubscription = async () => {
    try {
      toast.info("Opening subscription management...");
      await createCheckout(tier);
    } catch (error) {
      toast.error("Failed to open subscription management");
    }
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

  const handleExportContacts = async () => {
    if (!user?.id) return;
    setIsExportingContacts(true);
    try {
      const contacts = await fetchAllContactsForExport(supabase, user.id);
      if (contacts.length === 0) {
        toast.info("No contacts to export");
        return;
      }
      const csv = contactsToCsv(contacts);
      const date = new Date().toISOString().slice(0, 10);
      downloadCsvFile(csv, `whonow-contacts-${date}.csv`);
      toast.success(`Exported ${contacts.length} contact${contacts.length !== 1 ? "s" : ""} to CSV`);
    } catch (err) {
      console.error("Export contacts error:", err);
      toast.error("Failed to export contacts. Please try again.");
    } finally {
      setIsExportingContacts(false);
    }
  };

  const handleJoinCompany = () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }
    setIsJoining(true);
    joinCompany(inviteCode.trim(), {
      onSuccess: () => {
        setInviteCode("");
        setIsJoining(false);
        refreshSubscription();
      },
      onError: (error: any) => {
        setIsJoining(false);
        if (error?.message?.includes("invalid_invite_code")) {
          toast.error("Invalid invite code. Please check and try again.");
        } else if (error?.message?.includes("already_in_company")) {
          toast.error("You are already a member of an organization.");
        }
      },
    });
  };

  // Determine number of tabs based on subscription and admin status
  const hasTeamFeatures = canAccessFeature("team_features");
  const canCreateOrg = canAccessFeature("organization_creation");
  // Show org tab if user can create orgs OR if they don't have a company (so they can join one) OR if they're an admin
  const showOrganizationTab = canCreateOrg || !company || (isAdmin && company && hasTeamFeatures);

  // Navigation structure
  type NavItem = {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    category?: string;
  };

  const navigationItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { id: "general", label: "General", icon: Palette, category: "general" },
      { id: "keywords", label: "Keywords", icon: Tags, category: "general" },
      { id: "account", label: "Account", icon: User, category: "account" },
      { id: "security", label: "Security", icon: Lock, category: "account" },
    ];

    if (showOrganizationTab) {
      items.push({ id: "organization", label: "Organization", icon: Building2, category: "organization" });
    }

    return items;
  }, [showOrganizationTab]);

  const categories = useMemo(() => {
    const cats = [
      {
        id: "general",
        label: "General",
        icon: Palette,
        items: [
          { id: "general", label: "Appearance", icon: Palette },
          { id: "keywords", label: "Keywords", icon: Tags },
          { id: "export", label: "Export & backup", icon: Download },
          { id: "duplicates", label: "Duplicate Cleanup", icon: AlertTriangle },
          { id: "google", label: "Connect to Google", icon: Link2 },
        ],
      },
      {
        id: "account",
        label: "Account",
        icon: User,
        items: [
          { id: "account", label: "Profile", icon: User },
          { id: "security", label: "Security", icon: Lock },
        ],
      },
    ];

    if (showOrganizationTab) {
      // Organization Details is always visible if org tab is shown
      const orgItems: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
        { id: "org-details", label: "Organization Details", icon: Building2 },
      ];
      
      // Only show admin tabs if user is an admin and in an organization
      if (isAdmin && company) {
        orgItems.push(
          { id: "subscription", label: "Subscription", icon: CreditCard },
          { id: "team-members", label: "Team Members", icon: Users },
          { id: "org-integrations", label: "Organization Integrations", icon: Settings },
          { id: "custom-branding", label: "Custom Branding", icon: Palette },
          { id: "admin-controls", label: "Admin Controls", icon: Shield }
        );
        
        // Add additional admin-only sections if they have team features
        if (hasTeamFeatures) {
          orgItems.push(
            { id: "company-keywords", label: "Company Keywords", icon: Tags }
          );
        }
      }
      
      cats.push({
        id: "organization",
        label: "Organization",
        icon: Building2,
        items: orgItems,
      });
    }

    return cats;
  }, [showOrganizationTab, isAdmin, company, hasTeamFeatures]);

  // Safety check: redirect non-admin users away from admin-only categories
  useEffect(() => {
    const adminOnlyCategories = ["subscription", "team-members", "org-integrations", "custom-branding", "admin-controls", "company-keywords"];
    
    if (adminOnlyCategories.includes(selectedCategory)) {
      // If user is not an admin or not in a company, redirect to org-details
      if (!isAdmin || !company) {
        // Check if org-details exists in categories (should always exist if org tab is shown)
        const orgCategory = categories.find(cat => cat.id === "organization");
        if (orgCategory && orgCategory.items.length > 0) {
          setSelectedCategory("org-details");
        } else {
          // If no org tab, redirect to general
          setSelectedCategory("general");
        }
      }
    }
  }, [selectedCategory, isAdmin, company, categories]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    
    const query = searchQuery.toLowerCase();
    return categories
      .map(cat => ({
        ...cat,
        items: cat.items.filter(item => 
          item.label.toLowerCase().includes(query) || 
          cat.label.toLowerCase().includes(query)
        ),
      }))
      .filter(cat => cat.items.length > 0);
  }, [categories, searchQuery]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[95vw] md:w-[95vw] lg:w-[95vw] xl:w-[95vw] max-w-[2400px] h-[95vh] sm:h-[90vh] max-h-[95vh] sm:max-h-[90vh] flex flex-col p-0" aria-describedby="settings-dialog-description">
        <DialogHeader className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b flex-shrink-0">
          <DialogTitle className="font-display text-xl">Settings</DialogTitle>
          <DialogDescription id="settings-dialog-description" className="sr-only">Account, preferences, and data management</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">
          {/* Sidebar with hierarchical navigation */}
          <div className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r bg-muted/30 flex-shrink-0 flex flex-col">
            {/* Search bar */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 h-9 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Navigation list */}
            <div className="flex-1 overflow-y-auto">
              <nav className="p-2 space-y-1">
                {filteredCategories.map((category) => {
                  const isExpanded = expandedCategories.has(category.id);
                  const hasActiveItem = category.items.some(item => item.id === selectedCategory);
                  
                  return (
                    <div key={category.id}>
                      {/* Category header */}
                      <button
                        onClick={() => {
                          if (category.items.length === 1) {
                            setSelectedCategory(category.items[0].id);
                            if (!expandedCategories.has(category.id)) {
                              setExpandedCategories(prev => new Set(prev).add(category.id));
                            }
                          } else {
                            toggleCategory(category.id);
                            // If expanding and no item is selected from this category, select the first one
                            if (!expandedCategories.has(category.id) && !category.items.some(item => item.id === selectedCategory)) {
                              setSelectedCategory(category.items[0].id);
                            }
                          }
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                          hasActiveItem
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {hasActiveItem && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                        )}
                        <category.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1 text-left">{category.label}</span>
                        {category.items.length > 1 && (
                          <ChevronRight
                            className={`h-4 w-4 transition-transform flex-shrink-0 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        )}
                      </button>

                      {/* Sub-items */}
                      {isExpanded && category.items.length > 1 && (
                        <div className="ml-7 mt-1 space-y-0.5">
                          {category.items.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setSelectedCategory(item.id)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors relative ${
                                selectedCategory === item.id
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              }`}
                            >
                              {selectedCategory === item.id && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                              )}
                              <span className="flex-1 text-left">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {/* General - Appearance */}
            {selectedCategory === "general" && (
              <div className="space-y-6 p-4 sm:p-6 md:p-8">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Appearance</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Choose your preferred theme for the app.
                  </p>
                </div>
                <div className="space-y-4">
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
              </div>
            )}

            {/* Keywords Tab - View only for company members */}
            {selectedCategory === "keywords" && (
              <div className="space-y-4 p-4 sm:p-6 md:p-8">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Keywords</h2>
                </div>
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

              <div className="flex flex-wrap items-start gap-2 p-3 bg-muted/50 rounded-lg min-h-[100px]">
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
                        ? "flex-none cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        : "flex-none"
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
              </div>
            )}

            {/* Export & backup */}
            {selectedCategory === "export" && (
              <div className="space-y-6 p-4 sm:p-6 md:p-8">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Export & backup</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Download a CSV of all your contacts to back them up. Keeping a local copy helps prevent data loss if there are ever issues with our systems.
                  </p>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Back up contacts
                    </CardTitle>
                    <CardDescription>
                      Export all your contacts to a CSV file. The file includes name, email, phone, company, role, tags, and other fields you can open in Excel or re-import later.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleExportContacts}
                      disabled={isExportingContacts}
                      variant="default"
                    >
                      {isExportingContacts ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Exporting…
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download contacts as CSV
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

              </div>
            )}

            {/* Account Tab */}
            {selectedCategory === "account" && (
              <div className="space-y-6 p-4 sm:p-6 md:p-8">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Profile</h2>
                </div>
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
                  <>
                    <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                      <p className="text-sm text-muted-foreground">
                        You're using the app as an individual. 
                        {canAccessFeature("organization_creation") 
                          ? " Create an organization to collaborate with your team." 
                          : " Upgrade to Team or Business tier to create an organization."}
                      </p>
                      {showCreateOrgDialog ? (
                        <div className="space-y-3">
                          <Input
                            placeholder="Organization name"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleCreateOrganization();
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="flex-1"
                              onClick={handleCreateOrganization}
                              disabled={!newOrgName.trim()}
                            >
                              <Building2 className="h-4 w-4 mr-2" />
                              Create
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setShowCreateOrgDialog(false);
                                setNewOrgName("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            if (canAccessFeature("organization_creation")) {
                              setShowCreateOrgDialog(true);
                            } else {
                              createCheckout("business");
                            }
                          }}
                        >
                          {canAccessFeature("organization_creation") ? (
                            <>
                              <Building2 className="h-4 w-4 mr-2" />
                              Create an Organization
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Upgrade to Create an Organization
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </>
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
              </div>
            )}

            {/* Duplicate Cleanup Tab */}
            {selectedCategory === "duplicates" && (
              <div className="space-y-6 p-4 sm:p-6 md:p-8">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Duplicate Contact Cleanup</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Find and merge or delete duplicate contacts in your contact book.
                  </p>
                </div>
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        This tool will scan your personal contacts for duplicates based on email or phone number.
                        You can then choose to merge duplicates (combining their data) or delete them.
                      </p>
                    </div>
                    <Button
                      onClick={() => setDuplicateCleanupOpen(true)}
                      className="w-full"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Open Duplicate Cleanup Tool
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Google - Connect to Google, Calendar, and feature toggles */}
            {selectedCategory === "google" && (
              <GoogleSettingsSection />
            )}

            {/* Security Tab */}
            {selectedCategory === "security" && (
              <div className="space-y-6 p-4 sm:p-6 md:p-8">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Security</h2>
                </div>
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
              </div>
            )}

            {/* Organization Subsections */}
            {showOrganizationTab && (
              <>
                {/* Organization Details */}
                {selectedCategory === "org-details" && (
                  <div className="space-y-6 p-4 sm:p-6 md:p-8">
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Organization Details</h2>
                      <p className="text-sm text-muted-foreground mb-6">
                        Manage your organization settings and information
                      </p>
                    </div>
                    {!company ? (
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
                              className="bg-muted"
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
                    ) : !isAdmin ? (
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
                    ) : (
                      <Card>
                        <CardContent className="space-y-4 pt-6">
                          <div className="space-y-2">
                            <Label htmlFor="org-name">Organization Name</Label>
                            <Input
                              id="org-name"
                              value={company.name}
                              disabled
                              className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">
                              <a href="mailto:support@whonow.co" className="text-primary hover:underline">Contact support</a> to change your organization name
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
                    )}
                  </div>
                )}


                {/* Subscription */}
                {selectedCategory === "subscription" && company && isAdmin && (
                  <div className="space-y-6 p-4 sm:p-6 md:p-8">
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Subscription</h2>
                      <p className="text-sm text-muted-foreground mb-6">
                        Manage your subscription and billing
                      </p>
                    </div>
                    <Card>
                      <CardContent className="space-y-4 pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <Label className="text-sm text-muted-foreground mb-2 block">Current Plan</Label>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-xl">{tierConfig.name}</p>
                              <Badge variant={tier === "enterprise" ? "default" : tier === "business" ? "secondary" : "outline"}>
                                {tier}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            {tierConfig.price > 0 ? (
                              <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold">${tierConfig.price}</span>
                                <span className="text-sm text-muted-foreground">/{tierConfig.period}</span>
                              </div>
                            ) : (
                              <p className="text-2xl font-bold">Free</p>
                            )}
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm text-muted-foreground">Team Members</Label>
                            <p className="font-semibold">
                              {companyMembers.length} / {tierConfig.seats}
                            </p>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-primary rounded-full h-full transition-all"
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
                  </div>
                )}

                {/* Team Members */}
                {selectedCategory === "team-members" && company && isAdmin && (
                  <div className="space-y-6 p-4 sm:p-6 md:p-8">
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Team Members</h2>
                      <p className="text-sm text-muted-foreground mb-6">
                        {companyMembers.length} member{companyMembers.length !== 1 ? "s" : ""} in your organization
                      </p>
                    </div>
                    <Card>
                      <CardContent className="pt-6">
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
                                      <Shield className="h-3 w-3 mr-1" />
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
                  </div>
                )}

                {/* Organization Integrations */}
                {selectedCategory === "org-integrations" && company && isAdmin && (
                  <div className="space-y-6 p-4 sm:p-6 md:p-8">
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Organization Integrations</h2>
                    </div>
                    <OrganizationIntegrationsPanel />
                  </div>
                )}

                {/* Custom Branding */}
                {selectedCategory === "custom-branding" && company && isAdmin && (
                  <div className="space-y-6 p-4 sm:p-6 md:p-8">
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Custom Branding</h2>
                    </div>
                    <BrandingSettings />
                  </div>
                )}

                {/* Admin Controls */}
                {selectedCategory === "admin-controls" && company && isAdmin && (
                  <div className="space-y-6 p-4 sm:p-6 md:p-8">
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Admin Controls</h2>
                      <p className="text-sm text-muted-foreground mb-6">
                        Advanced organization management (use with caution)
                      </p>
                    </div>
                    <Card className="border-amber-500/50">
                      <CardContent className="space-y-4 pt-6">
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                          <p className="text-sm text-amber-900 dark:text-amber-100">
                            <strong>Note:</strong> These actions can affect your entire organization.{" "}
                            <a href="mailto:support@whonow.co" className="text-primary hover:underline">Contact support</a> if you need help with organization management.
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
                )}

                {/* Company Keywords - Admin only */}
                {selectedCategory === "company-keywords" && isAdmin && company && hasTeamFeatures && (
                  <div className="space-y-6 p-4 sm:p-6 md:p-8">
                    <div>
                      <h2 className="text-2xl font-semibold mb-2">Company Keywords</h2>
                      <p className="text-sm text-muted-foreground mb-6">
                        Manage preset keywords for everyone in your company.
                      </p>
                    </div>
                    <Card>
                      <CardContent className="space-y-4 pt-6">
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
                        <div className="flex flex-wrap items-start gap-2 p-3 bg-muted/50 rounded-lg min-h-[80px]">
                          {keywords.length === 0 ? (
                            <p className="text-sm text-muted-foreground w-full text-center py-4">
                              No company keywords yet. Add some above!
                            </p>
                          ) : (
                            keywords.map((keyword) => (
                              <Badge
                                key={keyword}
                                variant="secondary"
                                className="flex-none cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
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
                      </CardContent>
                    </Card>
                  </div>
                )}

              </>
            )}
          </div>
        </div>

        {/* Footer with Done button */}
        <div className="flex justify-end px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-t border-border flex-shrink-0">
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
      
      <DuplicateCleanupDialog
        open={duplicateCleanupOpen}
        onOpenChange={setDuplicateCleanupOpen}
      />
    </Dialog>
  );
}
