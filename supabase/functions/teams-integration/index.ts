import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();
    console.log(`Teams integration action: ${action}`, params);

    const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
    const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    const MICROSOFT_TENANT_ID = Deno.env.get("MICROSOFT_TENANT_ID") || "common";

    switch (action) {
      case "get-oauth-url": {
        if (!MICROSOFT_CLIENT_ID) {
          return new Response(JSON.stringify({ 
            error: "Teams integration not configured. Please add MICROSOFT_CLIENT_ID secret." 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const redirectUri = `${supabaseUrl}/functions/v1/teams-integration?action=oauth-callback`;
        const scopes = "offline_access User.Read Team.ReadBasic.All Channel.ReadBasic.All Chat.ReadWrite OnlineMeetings.ReadWrite";
        const oauthUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?` +
          `client_id=${MICROSOFT_CLIENT_ID}` +
          `&response_type=code` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(scopes)}` +
          `&state=${user.id}` +
          `&response_mode=query`;

        return new Response(JSON.stringify({ url: oauthUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "oauth-callback": {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state"); // user_id
        const error = url.searchParams.get("error");

        if (error) {
          return new Response(`OAuth error: ${error}`, { status: 400 });
        }

        if (!code || !MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
          return new Response("Missing code or credentials", { status: 400 });
        }

        const redirectUri = `${supabaseUrl}/functions/v1/teams-integration?action=oauth-callback`;

        // Exchange code for tokens
        const tokenResponse = await fetch(
          `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: MICROSOFT_CLIENT_ID,
              client_secret: MICROSOFT_CLIENT_SECRET,
              code,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
          }
        );

        const tokenData = await tokenResponse.json();
        console.log("Microsoft OAuth response received");

        if (tokenData.error) {
          return new Response(`OAuth failed: ${tokenData.error_description}`, { status: 400 });
        }

        // Get user profile
        const profileResponse = await fetch(`${GRAPH_API_BASE}/me`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profileData = await profileResponse.json();

        // Calculate token expiry
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

        // Store the integration
        await supabase.from("integrations").upsert({
          user_id: state,
          provider: "teams",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          is_active: true,
          settings: {
            email: profileData.mail || profileData.userPrincipalName,
            display_name: profileData.displayName,
          },
        }, { onConflict: "user_id,provider" });

        // Redirect back to the app
        return new Response(null, {
          status: 302,
          headers: { Location: "/settings?integration=teams&status=success" },
        });
      }

      case "refresh-token": {
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "teams")
          .single();

        if (!integration?.refresh_token || !MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
          return new Response(JSON.stringify({ error: "Cannot refresh token" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const tokenResponse = await fetch(
          `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: MICROSOFT_CLIENT_ID,
              client_secret: MICROSOFT_CLIENT_SECRET,
              refresh_token: integration.refresh_token,
              grant_type: "refresh_token",
            }),
          }
        );

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
          return new Response(JSON.stringify({ error: tokenData.error_description }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

        await supabase.from("integrations").update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || integration.refresh_token,
          token_expires_at: expiresAt.toISOString(),
        }).eq("id", integration.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-teams": {
        const integration = await getValidIntegration(supabase, user.id, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID);

        if (!integration) {
          return new Response(JSON.stringify({ error: "Teams not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const teamsResponse = await fetch(`${GRAPH_API_BASE}/me/joinedTeams`, {
          headers: { Authorization: `Bearer ${integration.access_token}` },
        });

        const teamsData = await teamsResponse.json();

        if (teamsData.error) {
          return new Response(JSON.stringify({ error: teamsData.error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ teams: teamsData.value }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-channels": {
        const { teamId } = params;

        if (!teamId) {
          return new Response(JSON.stringify({ error: "Team ID required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const integration = await getValidIntegration(supabase, user.id, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID);

        if (!integration) {
          return new Response(JSON.stringify({ error: "Teams not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const channelsResponse = await fetch(`${GRAPH_API_BASE}/teams/${teamId}/channels`, {
          headers: { Authorization: `Bearer ${integration.access_token}` },
        });

        const channelsData = await channelsResponse.json();

        if (channelsData.error) {
          return new Response(JSON.stringify({ error: channelsData.error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ channels: channelsData.value }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "import-members": {
        const integration = await getValidIntegration(supabase, user.id, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID);

        if (!integration) {
          return new Response(JSON.stringify({ error: "Teams not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch user's joined teams
        const teamsResponse = await fetch(`${GRAPH_API_BASE}/me/joinedTeams`, {
          headers: { Authorization: `Bearer ${integration.access_token}` },
        });

        const teamsData = await teamsResponse.json();

        if (teamsData.error) {
          return new Response(JSON.stringify({ error: teamsData.error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get user's company_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        const allMembers: any[] = [];

        // Fetch members from each team
        for (const team of teamsData.value || []) {
          const membersResponse = await fetch(
            `${GRAPH_API_BASE}/teams/${team.id}/members`,
            { headers: { Authorization: `Bearer ${integration.access_token}` } }
          );

          const membersData = await membersResponse.json();

          if (membersData.value) {
            for (const member of membersData.value) {
              // Avoid duplicates
              if (!allMembers.find(m => m.email === member.email)) {
                allMembers.push({
                  name: member.displayName,
                  email: member.email,
                  role: member.roles?.join(", ") || "Member",
                  company: team.displayName,
                  owner_id: user.id,
                  company_id: profile?.company_id,
                  tags: ["teams-import", team.displayName],
                });
              }
            }
          }
        }

        if (allMembers.length === 0) {
          return new Response(JSON.stringify({ success: true, imported: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: inserted, error: insertError } = await supabase
          .from("contacts")
          .insert(allMembers)
          .select();

        if (insertError) {
          console.error("Error inserting contacts:", insertError);
          return new Response(JSON.stringify({ error: insertError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Log the action
        await supabase.from("integration_logs").insert({
          integration_id: integration.id,
          action: "import-members",
          status: "success",
          details: { imported_count: inserted?.length || 0 },
        });

        return new Response(JSON.stringify({
          success: true,
          imported: inserted?.length || 0,
          contacts: inserted,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send-to-channel": {
        const { teamId, channelId, message } = params;

        if (!teamId || !channelId || !message) {
          return new Response(JSON.stringify({ error: "Team ID, channel ID, and message are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const integration = await getValidIntegration(supabase, user.id, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID);

        if (!integration) {
          return new Response(JSON.stringify({ error: "Teams not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const response = await fetch(
          `${GRAPH_API_BASE}/teams/${teamId}/channels/${channelId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${integration.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              body: {
                contentType: "html",
                content: message,
              },
            }),
          }
        );

        const messageData = await response.json();

        if (messageData.error) {
          return new Response(JSON.stringify({ error: messageData.error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("integration_logs").insert({
          integration_id: integration.id,
          action: "send-to-channel",
          status: "success",
          details: { team_id: teamId, channel_id: channelId },
        });

        return new Response(JSON.stringify({ success: true, messageId: messageData.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create-meeting": {
        const { contactId, subject, startTime, endTime, message } = params;

        const integration = await getValidIntegration(supabase, user.id, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID);

        if (!integration) {
          return new Response(JSON.stringify({ error: "Teams not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get contact details if provided
        let attendees: any[] = [];
        if (contactId) {
          const { data: contact } = await supabase
            .from("contacts")
            .select("*")
            .eq("id", contactId)
            .single();

          if (contact?.email) {
            attendees = [{
              emailAddress: {
                address: contact.email,
                name: contact.name,
              },
              type: "required",
            }];
          }
        }

        // Create online meeting
        const meeting = {
          subject: subject || "Teams Meeting",
          startDateTime: startTime,
          endDateTime: endTime,
          participants: attendees.length > 0 ? {
            attendees: attendees.map(a => ({
              upn: a.emailAddress.address,
              role: "attendee",
            })),
          } : undefined,
        };

        const response = await fetch(`${GRAPH_API_BASE}/me/onlineMeetings`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${integration.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(meeting),
        });

        const meetingData = await response.json();

        if (meetingData.error) {
          return new Response(JSON.stringify({ error: meetingData.error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("integration_logs").insert({
          integration_id: integration.id,
          action: "create-meeting",
          status: "success",
          details: { meeting_id: meetingData.id, join_url: meetingData.joinWebUrl },
        });

        return new Response(JSON.stringify({ 
          success: true, 
          meetingId: meetingData.id,
          joinUrl: meetingData.joinWebUrl,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-status": {
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "teams")
          .single();

        return new Response(JSON.stringify({
          connected: !!integration?.is_active,
          settings: integration?.settings,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        await supabase
          .from("integrations")
          .delete()
          .eq("user_id", user.id)
          .eq("provider", "teams");

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    console.error("Teams integration error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper function to get integration with valid token
async function getValidIntegration(
  supabase: any,
  userId: string,
  clientId?: string,
  clientSecret?: string,
  tenantId?: string
) {
  const { data: integration } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "teams")
    .single();

  if (!integration?.access_token) return null;

  // Check if token needs refresh
  const expiresAt = new Date(integration.token_expires_at);
  if (expiresAt <= new Date()) {
    if (!integration.refresh_token || !clientId || !clientSecret) return null;

    // Refresh the token
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId || "common"}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: integration.refresh_token,
          grant_type: "refresh_token",
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) return null;

    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await supabase.from("integrations").update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || integration.refresh_token,
      token_expires_at: newExpiresAt.toISOString(),
    }).eq("id", integration.id);

    integration.access_token = tokenData.access_token;
  }

  return integration;
}
