import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSlackIntegration } from "@/hooks/useSlackIntegration";
import { useOutlookIntegration } from "@/hooks/useOutlookIntegration";
import { Loader2, Link2, Unlink, Download, Upload, Calendar, MessageSquare, Check, ExternalLink } from "lucide-react";

export function IntegrationsPanel() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const slack = useSlackIntegration();
  const outlook = useOutlookIntegration();

  useEffect(() => {
    slack.getStatus();
    outlook.getStatus();
  }, []);

  // Check URL params for integration callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integration");
    const status = params.get("status");

    if (integration && status === "success") {
      if (integration === "slack") {
        slack.getStatus();
      } else if (integration === "outlook") {
        outlook.getStatus();
      }
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect your favorite tools to import contacts, share updates, and schedule meetings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Slack Integration */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4A154B]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-base">Slack</CardTitle>
                  <CardDescription className="text-xs">
                    Import contacts & share updates
                  </CardDescription>
                </div>
              </div>
              {slack.status?.connected && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  <Check className="h-3 w-3 mr-1" /> Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {slack.status?.connected ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Connected to <strong>{slack.status.settings?.team_name}</strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => slack.importMembers()}
                    disabled={slack.isLoading}
                  >
                    {slack.isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import Members
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => slack.disconnect()}
                    disabled={slack.isLoading}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect Slack to import workspace members as contacts and share contact cards to channels.
                </p>
                <Button
                  size="sm"
                  onClick={() => slack.connect()}
                  disabled={slack.isLoading}
                >
                  {slack.isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Connect Slack
                </Button>
              </>
            )}

            <Separator className="my-3" />

            {/* Webhook notification setup */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Webhook URL (for notifications)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://hooks.slack.com/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 px-3"
                  disabled={!webhookUrl}
                  onClick={() => {
                    localStorage.setItem("slack_webhook_url", webhookUrl);
                  }}
                >
                  Save
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Get notifications when contacts are added or updated.{" "}
                <a
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  Learn more <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Outlook Integration */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0078D4]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
                    <path d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.156-.354.234-.586.234h-8.29v-6.182l1.58 1.18a.39.39 0 0 0 .475.002l6.823-5.076c.074-.05.153-.067.236-.05zm0-1.584c-.003-.28-.224-.47-.523-.31l-8.59 6.394-1.9-1.42V4.324h-2.5v6.142l-1.9 1.42L0 5.494c-.3-.16-.52.03-.523.31 0 0 .003 11.587.003 11.889 0 .232.08.426.24.58.16.153.35.23.58.23l2.5.001V11.67l8.55 6.385a.45.45 0 0 0 .3.12.45.45 0 0 0 .3-.12l3.05-2.28v2.72l2.5.001V11.67l6.5 4.835v-10.7z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-base">Outlook</CardTitle>
                  <CardDescription className="text-xs">
                    Sync contacts & schedule meetings
                  </CardDescription>
                </div>
              </div>
              {outlook.status?.connected && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  <Check className="h-3 w-3 mr-1" /> Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {outlook.status?.connected ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Connected as <strong>{outlook.status.settings?.email}</strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => outlook.importContacts()}
                    disabled={outlook.isLoading}
                  >
                    {outlook.isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => outlook.syncContacts()}
                    disabled={outlook.isLoading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Sync to Outlook
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => outlook.disconnect()}
                    disabled={outlook.isLoading}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect Outlook to sync contacts, import from your address book, and schedule meetings directly.
                </p>
                <Button
                  size="sm"
                  onClick={() => outlook.connect()}
                  disabled={outlook.isLoading}
                >
                  {outlook.isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Connect Outlook
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Setup Instructions */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-4">
          <div>
            <h4 className="font-medium mb-2">Slack Setup</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">api.slack.com/apps</a> and create a new app</li>
              <li>Under "OAuth & Permissions", add these scopes: <code className="bg-muted px-1 rounded">users:read</code>, <code className="bg-muted px-1 rounded">users:read.email</code>, <code className="bg-muted px-1 rounded">chat:write</code>, <code className="bg-muted px-1 rounded">channels:read</code></li>
              <li>Add a redirect URL: <code className="bg-muted px-1 rounded text-[10px]">{window.location.origin}/functions/v1/slack-integration?action=oauth-callback</code></li>
              <li>Copy Client ID and Client Secret to your secrets</li>
            </ol>
          </div>
          
          <Separator />

          <div>
            <h4 className="font-medium mb-2">Outlook Setup</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li>Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Azure AD Portal</a> and register a new app</li>
              <li>Add API permissions: <code className="bg-muted px-1 rounded">User.Read</code>, <code className="bg-muted px-1 rounded">Contacts.ReadWrite</code>, <code className="bg-muted px-1 rounded">Calendars.ReadWrite</code></li>
              <li>Add a redirect URI (Web): <code className="bg-muted px-1 rounded text-[10px]">{window.location.origin}/functions/v1/outlook-integration?action=oauth-callback</code></li>
              <li>Create a client secret and copy it along with Client ID</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
