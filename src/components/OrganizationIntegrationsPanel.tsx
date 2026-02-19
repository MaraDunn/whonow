import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useOrganizationIntegrations } from "@/hooks/useOrganizationIntegrations";
import { Loader2, Link2, Unlink, Download, Check, Video, Shield, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TEAMS_COMING_SOON } from "@/config/features";

export function OrganizationIntegrationsPanel() {
  const {
    isLoading,
    slackStatus,
    teamsStatus,
    isAdmin,
    hasCompany,
    getAllStatus,
    connectSlack,
    connectTeams,
    disconnectSlack,
    disconnectTeams,
    importSlackMembers,
    importTeamsMembers,
  } = useOrganizationIntegrations();

  useEffect(() => {
    getAllStatus();
  }, [getAllStatus]);

  // Check URL params for integration callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integration");
    const status = params.get("status");

    if (integration && status === "success") {
      if (integration === "slack" || integration === "teams") {
        getAllStatus();
      }
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [getAllStatus]);

  if (!hasCompany) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Organization Integrations
          </CardTitle>
          <CardDescription>
            Connect Slack and Microsoft Teams for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Create or join an organization to connect Slack or Teams. Go to the Organization tab above to create a company or join one with an invite code.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Organization Integrations
          </CardTitle>
          <CardDescription>
            Connect Slack and Microsoft Teams for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Only organization admins can manage integrations. Contact your admin to connect Slack or Teams.
            </AlertDescription>
          </Alert>

          <div className="mt-4 space-y-3">
            {slackStatus?.connected && (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4A154B]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Slack</p>
                  <p className="text-xs text-muted-foreground">Connected to {slackStatus.settings?.team_name}</p>
                </div>
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  <Check className="h-3 w-3 mr-1" /> Active
                </Badge>
              </div>
            )}

            {!TEAMS_COMING_SOON && teamsStatus?.connected && (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6264A7]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor">
                    <path d="M20.625 8.073c.574 0 1.125.111 1.646.334a4.312 4.312 0 0 1 1.354.912c.388.388.695.847.922 1.375.227.528.34 1.087.34 1.677v5.317a.483.483 0 0 1-.146.354.483.483 0 0 1-.354.146h-4.262v-4.04c0-.574-.111-1.112-.334-1.615a4.213 4.213 0 0 0-.912-1.323 4.312 4.312 0 0 0-1.354-.891 4.09 4.09 0 0 0-1.635-.334H13.5V8.073h7.125z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Microsoft Teams</p>
                  <p className="text-xs text-muted-foreground">Connected as {teamsStatus.settings?.email}</p>
                </div>
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  <Check className="h-3 w-3 mr-1" /> Active
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Organization Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect integrations once for your entire organization. All members can use these connections.
        </p>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          As an admin, you can connect Slack and Teams for your entire organization. 
          Contacts imported will be shared with all organization members.
        </AlertDescription>
      </Alert>

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
              {slackStatus?.connected && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  <Check className="h-3 w-3 mr-1" /> Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {slackStatus?.connected ? (
              <>
                <div className="text-sm text-muted-foreground">
                  Connected to <strong>{slackStatus.settings?.team_name}</strong>
                  {slackStatus.scope === 'organization' && (
                    <Badge variant="outline" className="ml-2">Organization-wide</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => importSlackMembers()}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import Members
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => disconnectSlack()}
                    disabled={isLoading}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your organization's Slack workspace to import all workspace members as shared contacts.
                </p>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    connectSlack();
                  }}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Connect Organization Slack
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Microsoft Teams Integration */}
        <Card className={TEAMS_COMING_SOON ? "opacity-90" : undefined}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6264A7]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
                    <path d="M20.625 8.073c.574 0 1.125.111 1.646.334a4.312 4.312 0 0 1 1.354.912c.388.388.695.847.922 1.375.227.528.34 1.087.34 1.677v5.317a.483.483 0 0 1-.146.354.483.483 0 0 1-.354.146h-4.262v-4.04c0-.574-.111-1.112-.334-1.615a4.213 4.213 0 0 0-.912-1.323 4.312 4.312 0 0 0-1.354-.891 4.09 4.09 0 0 0-1.635-.334H13.5V8.073h7.125zM16.5 6.01a1.977 1.977 0 0 0 1.448-.594 1.977 1.977 0 0 0 .594-1.448c0-.574-.198-1.062-.594-1.464A1.955 1.955 0 0 0 16.5 1.92c-.563 0-1.047.198-1.453.594a1.996 1.996 0 0 0-.589 1.454c0 .563.193 1.047.58 1.448.386.401.87.594 1.462.594zM12 4.01c.813 0 1.568.159 2.266.475a5.903 5.903 0 0 1 1.86 1.29 6.156 6.156 0 0 1 1.26 1.885c.307.719.469 1.484.489 2.297v7.73a.483.483 0 0 1-.146.355.483.483 0 0 1-.354.146H6.75a.483.483 0 0 1-.354-.146.483.483 0 0 1-.146-.354v-7.73c.02-.813.182-1.578.49-2.298a6.15 6.15 0 0 1 1.259-1.885 5.902 5.902 0 0 1 1.86-1.29A5.665 5.665 0 0 1 12 4.01z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-base">Microsoft Teams</CardTitle>
                  <CardDescription className="text-xs">
                    Import members & schedule meetings
                  </CardDescription>
                </div>
              </div>
              {TEAMS_COMING_SOON ? (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  Coming soon
                </Badge>
              ) : teamsStatus?.connected ? (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  <Check className="h-3 w-3 mr-1" /> Connected
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {TEAMS_COMING_SOON ? (
              <p className="text-sm text-muted-foreground">
                Microsoft Teams integration is coming soon. You’ll be able to connect your organization’s Teams and import team members as shared contacts.
              </p>
            ) : teamsStatus?.connected ? (
              <>
                <div className="text-sm text-muted-foreground">
                  Connected as <strong>{teamsStatus.settings?.email}</strong>
                  {teamsStatus.scope === 'organization' && (
                    <Badge variant="outline" className="ml-2">Organization-wide</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => importTeamsMembers()}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import Members
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => disconnectTeams()}
                    disabled={isLoading}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your organization's Microsoft Teams to import all team members as shared contacts.
                </p>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    connectTeams();
                  }}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Connect Organization Teams
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

