import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSlackIntegration } from "@/hooks/useSlackIntegration";
import { useTeamsIntegration } from "@/hooks/useTeamsIntegration";
import { Loader2, Link2, Unlink, Download, Video, Check, ExternalLink } from "lucide-react";

export function IntegrationsPanel() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const slack = useSlackIntegration();
  const teams = useTeamsIntegration();

  useEffect(() => {
    slack.getStatus();
    teams.getStatus();
  }, []);

  // Check URL params for integration callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integration");
    const status = params.get("status");

    if (integration && status === "success") {
      if (integration === "slack") {
        slack.getStatus();
      } else if (integration === "teams") {
        teams.getStatus();
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

        {/* Microsoft Teams Integration */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6264A7]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
                    <path d="M20.625 8.073c.574 0 1.125.111 1.646.334a4.312 4.312 0 0 1 1.354.912c.388.388.695.847.922 1.375.227.528.34 1.087.34 1.677v5.317a.483.483 0 0 1-.146.354.483.483 0 0 1-.354.146h-4.262v-4.04c0-.574-.111-1.112-.334-1.615a4.213 4.213 0 0 0-.912-1.323 4.312 4.312 0 0 0-1.354-.891 4.09 4.09 0 0 0-1.635-.334H13.5V8.073h7.125zM16.5 6.01a1.977 1.977 0 0 0 1.448-.594 1.977 1.977 0 0 0 .594-1.448c0-.574-.198-1.062-.594-1.464A1.955 1.955 0 0 0 16.5 1.92c-.563 0-1.047.198-1.453.594a1.996 1.996 0 0 0-.589 1.454c0 .563.193 1.047.58 1.448.386.401.87.594 1.462.594zM12 4.01c.813 0 1.568.159 2.266.475a5.903 5.903 0 0 1 1.86 1.29 6.156 6.156 0 0 1 1.26 1.885c.307.719.469 1.484.489 2.297v7.73a.483.483 0 0 1-.146.355.483.483 0 0 1-.354.146H6.75a.483.483 0 0 1-.354-.146.483.483 0 0 1-.146-.354v-7.73c.02-.813.182-1.578.49-2.298a6.15 6.15 0 0 1 1.259-1.885 5.902 5.902 0 0 1 1.86-1.29A5.665 5.665 0 0 1 12 4.01zm0-2.094a2.943 2.943 0 0 0-2.156.891 2.942 2.942 0 0 0-.89 2.156c0 .844.296 1.563.89 2.157.594.593 1.312.89 2.156.89a2.942 2.942 0 0 0 2.156-.89 2.942 2.942 0 0 0 .89-2.157c0-.844-.297-1.562-.89-2.156A2.943 2.943 0 0 0 12 1.916zM4.875 8.073c.813 0 1.5.286 2.063.86.562.573.843 1.265.843 2.077v6.677a.483.483 0 0 1-.146.354.483.483 0 0 1-.354.146H.5a.483.483 0 0 1-.354-.146.483.483 0 0 1-.146-.354V11.01c0-.813.28-1.5.843-2.063a2.816 2.816 0 0 1 2.063-.875h1.969zm-.375-2.063a1.977 1.977 0 0 0 1.448-.594 1.977 1.977 0 0 0 .594-1.448c0-.574-.198-1.062-.594-1.464a1.955 1.955 0 0 0-1.448-.584c-.563 0-1.047.198-1.453.594a1.996 1.996 0 0 0-.589 1.454c0 .563.193 1.047.58 1.448.386.401.87.594 1.462.594z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-base">Microsoft Teams</CardTitle>
                  <CardDescription className="text-xs">
                    Import members & schedule meetings
                  </CardDescription>
                </div>
              </div>
              {teams.status?.connected && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  <Check className="h-3 w-3 mr-1" /> Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.status?.connected ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Connected as <strong>{teams.status.settings?.email}</strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => teams.importMembers()}
                    disabled={teams.isLoading}
                  >
                    {teams.isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import Members
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      teams.createMeeting({
                        subject: "Quick Meeting",
                        startTime: new Date().toISOString(),
                        endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                      });
                    }}
                    disabled={teams.isLoading}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    New Meeting
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => teams.disconnect()}
                    disabled={teams.isLoading}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect Microsoft Teams to import team members as contacts and schedule Teams meetings directly.
                </p>
                <Button
                  size="sm"
                  onClick={() => teams.connect()}
                  disabled={teams.isLoading}
                >
                  {teams.isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Connect Teams
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
            <h4 className="font-medium mb-2">Microsoft Teams Setup</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li>Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Azure AD Portal</a> and register a new app</li>
              <li>Add API permissions: <code className="bg-muted px-1 rounded">User.Read</code>, <code className="bg-muted px-1 rounded">Team.ReadBasic.All</code>, <code className="bg-muted px-1 rounded">Channel.ReadBasic.All</code>, <code className="bg-muted px-1 rounded">Chat.ReadWrite</code>, <code className="bg-muted px-1 rounded">OnlineMeetings.ReadWrite</code></li>
              <li>Add a redirect URI (Web): <code className="bg-muted px-1 rounded text-[10px]">https://kzivlasydxnhbqduqpjb.supabase.co/functions/v1/teams-integration?action=oauth-callback</code></li>
              <li>Create a client secret and copy it along with Client ID</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
