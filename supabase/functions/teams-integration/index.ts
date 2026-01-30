import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkLaunchMode, waitlistModeBlockedResponse } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

type GraphError = { code?: string; message?: string };
type TeamsListResponse = { value?: Array<{ id?: string; displayName?: string }>; error?: GraphError };
type TeamMembersResponse = { value?: Array<{ displayName?: string; email?: string; roles?: string[] }>; error?: GraphError };

type TeamsContactRow = {
  name: string;
  email: string;
  role: string;
  company: string;
  owner_id: string;
  company_id: string | null;
  is_shared?: boolean;
  tags: string[];
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check launch mode - block in waitlist mode
  const { blocked } = checkLaunchMode();
  if (blocked) {
    const origin = req.headers.get("origin");
    return waitlistModeBlockedResponse(origin);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
    const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    // Teams access requires a work/school account; default to organizations (not "common") to avoid personal accounts.
    const MICROSOFT_TENANT_ID = Deno.env.get("MICROSOFT_TENANT_ID") || "organizations";

    // Check if this is an OAuth callback (GET request with code parameter)
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (req.method === "GET" && (code || oauthError)) {
      // Handle OAuth callback
      console.log("Teams OAuth callback received");
      console.log("Teams OAuth state received:", state);
      
      if (oauthError) {
        return new Response(`OAuth error: ${oauthError}`, { status: 400 });
      }

      if (!code || !MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
        return new Response("Missing code or credentials", { status: 400 });
      }

      // Parse the state to get user ID, origin, and scope
      let userId = "";
      let appOrigin = "";
      let integrationScope = "user";

      const rawState = state ?? "";
      const parseState = (value: string) => {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      };

      const parsedState =
        parseState(rawState) ||
        (() => {
          try {
            return parseState(decodeURIComponent(rawState));
          } catch {
            return null;
          }
        })();

      if (parsedState && typeof parsedState === "object") {
        const stateObj = parsedState as { userId?: unknown; origin?: unknown; scope?: unknown };
        userId = String(stateObj.userId || "");
        appOrigin = String(stateObj.origin || "");
        integrationScope = String(stateObj.scope || "user");
      } else {
        // Fallback for old format where state was just the user ID
        userId = rawState;
      }

      if (!userId) {
        return new Response("Missing user id in state", { status: 400 });
      }

      const redirectUri = `${supabaseUrl}/functions/v1/teams-integration`;

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
        const errorRedirect = appOrigin
          ? `${appOrigin}/?integration=teams&status=error&message=${encodeURIComponent(tokenData.error_description)}`
          : null;

        if (errorRedirect) {
          console.log("Teams OAuth redirecting to (error):", errorRedirect);
          return new Response(null, {
            status: 302,
            headers: { Location: errorRedirect },
          });
        }

        return new Response(`OAuth failed: ${tokenData.error_description}`, { status: 400 });
      }

      // Get user profile
      const profileResponse = await fetch(`${GRAPH_API_BASE}/me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profileData = await profileResponse.json();

      // Get user's company_id for org-level integrations
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();

      // Calculate token expiry
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      // Store the integration with appropriate scope
      const integrationData: any = {
        user_id: userId,
        provider: "teams",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        is_active: true,
        scope: integrationScope,
        settings: {
          email: profileData.mail || profileData.userPrincipalName,
          display_name: profileData.displayName,
        },
      };

      // Add company_id for organization-level integrations
      if (integrationScope === 'organization' && userProfile?.company_id) {
        integrationData.company_id = userProfile.company_id;
      }

      await supabase.from("integrations").upsert(integrationData);

      // Redirect back to the app using absolute URL
      const successRedirect = appOrigin
        ? `${appOrigin}/?integration=teams&status=success`
        : "/?integration=teams&status=success";

      console.log("Teams OAuth redirecting to (success):", successRedirect);

      return new Response(null, {
        status: 302,
        headers: { Location: successRedirect },
      });
    }

    // For non-OAuth requests, require authentication
    // Parse body first to get JWT (since Supabase strips Authorization header when verify_jwt=false)
    const body = await req.json();
    const { action, scope = 'user', jwt, ...params } = body;
    
    console.log("[teams-integration] Action:", action, "Scope:", scope, "JWT present:", !!jwt);
    
    if (!jwt) {
      console.log("[teams-integration] No JWT in request body");
      return new Response(JSON.stringify({ error: "No JWT token provided" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = jwt;
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[teams-integration] User verified:", user.id);

    // Get user's company for org-level integrations
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

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

        // For org-level, check if user is admin
        if (scope === 'organization') {
          const { data: isAdminData } = await supabase.rpc('has_role', {
            user_id: user.id,
            role_to_check: 'admin'
          });
          
          if (!isAdminData) {
            return new Response(JSON.stringify({ 
              error: "Only organization admins can setup organization integrations" 
            }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // For user-level, require Pro tier or higher
        if (scope === 'user') {
          const { data: userTier } = await supabase.rpc('get_user_subscription_tier', { _user_id: user.id });
          let effectiveTier = (userTier ?? 'starter') as string;
          if (effectiveTier === 'starter' && profile?.company_id) {
            const { data: companySub } = await supabase
              .from('subscriptions')
              .select('tier')
              .eq('company_id', profile.company_id)
              .eq('status', 'active')
              .limit(1)
              .maybeSingle();
            if (companySub?.tier) effectiveTier = companySub.tier as string;
          }
          const allowedTiers = ['pro', 'team', 'business'];
          if (!allowedTiers.includes(effectiveTier)) {
            return new Response(JSON.stringify({
              error: "Microsoft Teams integration requires a Pro subscription or higher.",
            }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        const redirectUri = `${supabaseUrl}/functions/v1/teams-integration`;
        // NOTE: Reading Teams + members typically requires admin-consented Graph permissions in the Azure app.
        const scopes = [
          "offline_access",
          "User.Read",
          "User.ReadBasic.All",
          "Group.Read.All",
          "Team.ReadBasic.All",
          "TeamMember.Read.All",
          "Channel.ReadBasic.All",
          "Chat.ReadWrite",
          "OnlineMeetings.ReadWrite",
        ].join(" ");
        
        // Encode user ID, origin, and scope in the state parameter
        const origin = typeof params.origin === "string" && params.origin
          ? params.origin
          : (req.headers.get("origin") || "");

        const stateData = JSON.stringify({ userId: user.id, origin, scope });
        const encodedState = encodeURIComponent(stateData);
        
        const oauthUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?` +
          `client_id=${MICROSOFT_CLIENT_ID}` +
          `&response_type=code` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(scopes)}` +
          `&state=${encodedState}` +
          `&response_mode=query` +
          `&prompt=consent`;

        return new Response(JSON.stringify({ url: oauthUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        console.log("Starting import-members for user:", user.id, "scope:", scope);
        
        // Try org-level integration first if scope is organization
        let integration = null;
        
        if (scope === 'organization' && profile?.company_id) {
          integration = await getValidIntegration(
            supabase,
            user.id,
            MICROSOFT_CLIENT_ID,
            MICROSOFT_CLIENT_SECRET,
            MICROSOFT_TENANT_ID,
            'organization',
            profile.company_id
          );
        }
        
        if (!integration) {
          integration = await getValidIntegration(
            supabase,
            user.id,
            MICROSOFT_CLIENT_ID,
            MICROSOFT_CLIENT_SECRET,
            MICROSOFT_TENANT_ID
          );
        }

        if (!integration) {
          console.log("No valid Teams integration found");
          return new Response(JSON.stringify({ error: "Teams not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch user's joined teams
        const teamsResponse = await fetch(`${GRAPH_API_BASE}/me/joinedTeams`, {
          headers: {
            Authorization: `Bearer ${integration.access_token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("Teams API response status:", teamsResponse.status);
        const teamsData = (await teamsResponse.json()) as TeamsListResponse;
        console.log("Teams API response:", JSON.stringify(teamsData).substring(0, 200));

        // Graph returns 401/403 when the account/app lacks required permissions (often needs admin consent).
        // IMPORTANT: return 200 with an { error } payload so the web client can show a friendly toast
        // instead of throwing a FunctionsHttpError.
        if (teamsResponse.status === 401 || teamsResponse.status === 403) {
          const graphError = teamsData?.error;
          return new Response(
            JSON.stringify({
              error:
                graphError?.message ||
                "Microsoft Teams access denied. If you connected a personal Microsoft account, it won’t work for Teams import—please reconnect with a work/school account (your org admin may need to grant consent).",
              graph_status: teamsResponse.status,
              graph_code: graphError?.code,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        if (teamsData.error) {
          console.error("Teams API error:", teamsData.error);
          return new Response(
            JSON.stringify({ error: teamsData.error.message || "Failed to fetch teams" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const allMembers: TeamsContactRow[] = [];
        const teamsList = teamsData.value || [];
        console.log("Found", teamsList.length, "teams");

        // Fetch members from each team
        for (const team of teamsList) {
          console.log("Fetching members for team:", team.displayName);
          const membersResponse = await fetch(
            `${GRAPH_API_BASE}/teams/${team.id}/members`,
            { 
              headers: { 
                "Authorization": `Bearer ${integration.access_token}`,
                "Content-Type": "application/json",
              } 
            }
          );

          const membersData = (await membersResponse.json()) as TeamMembersResponse;
          console.log("Team members response status:", membersResponse.status);

          if (membersData.value) {
            for (const member of membersData.value) {
              // Avoid duplicates
              if (member.email && !allMembers.find(m => m.email === member.email)) {
                allMembers.push({
                  name: member.displayName || "Unknown",
                  email: member.email,
                  role: member.roles?.join(", ") || "Member",
                  company: team.displayName || "Microsoft Teams",
                  owner_id: user.id,
                  company_id: integration.scope === 'organization' ? integration.company_id : profile?.company_id,
                  is_shared: integration.scope === 'organization', // Share org-level imports
                  tags: ["teams-import", team.displayName || "Microsoft Teams"],
                });
              }
            }
          }
        }

        console.log("Total members to import:", allMembers.length);

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

      case "share-contact": {
        const { contactId, teamId, channelId } = params;

        if (!contactId || !teamId || !channelId) {
          return new Response(JSON.stringify({ error: "Contact ID, team ID, and channel ID are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Resolve integration: org-first then user-level (mirror get-status)
        let integration = null;
        if (profile?.company_id) {
          integration = await getValidIntegration(
            supabase,
            user.id,
            MICROSOFT_CLIENT_ID,
            MICROSOFT_CLIENT_SECRET,
            MICROSOFT_TENANT_ID,
            "organization",
            profile.company_id
          );
        }
        if (!integration) {
          integration = await getValidIntegration(
            supabase,
            user.id,
            MICROSOFT_CLIENT_ID,
            MICROSOFT_CLIENT_SECRET,
            MICROSOFT_TENANT_ID
          );
        }

        if (!integration) {
          return new Response(JSON.stringify({ error: "Teams not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: contact } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", contactId)
          .single();

        if (!contact) {
          return new Response(JSON.stringify({ error: "Contact not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const appUrl = (Deno.env.get("APP_URL") || "http://localhost:8080").replace(/\/$/, "");

        const contactPayload = {
          name: contact.name ?? "",
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          company: contact.company ?? "",
          role: contact.role ?? "",
          tags: contact.tags ?? [],
          description: contact.description ?? "",
          address: contact.address ?? "",
          city: contact.city ?? "",
          state: contact.state ?? "",
          zipCode: contact.zip_code ?? "",
          country: contact.country ?? "",
          lastContactedAt: contact.last_contacted_at ?? "",
          isClient: contact.is_client === true,
        };

        const tokenBytes = new Uint8Array(16);
        crypto.getRandomValues(tokenBytes);
        const shareToken = btoa(String.fromCharCode(...tokenBytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { error: insertTokenError } = await supabase.from("contact_share_tokens").insert({
          token: shareToken,
          contact_payload: contactPayload,
          expires_at: expiresAt,
        });

        if (insertTokenError) {
          console.error("Failed to create share token:", insertTokenError);
          return new Response(JSON.stringify({ error: "Failed to create share link" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const addToWhoNowUrl = `${appUrl}/import-contact?token=${shareToken}`;
        const downloadCsvUrl = `${appUrl}/export-shared-contact?token=${shareToken}`;

        const escapeHtml = (s: string) =>
          String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
        const name = escapeHtml(contact.name ?? "");
        const email = escapeHtml(contact.email || "N/A");
        const phone = escapeHtml(contact.phone || "N/A");
        const role = escapeHtml(contact.role || "N/A");
        const company = escapeHtml(contact.company || "N/A");
        const htmlContent = `
<p><strong>${name}</strong></p>
<p>Email: ${email}<br/>Phone: ${phone}<br/>Role: ${role}<br/>Company: ${company}</p>
<p><a href="${addToWhoNowUrl}">Add to WhoNow</a> · <a href="${downloadCsvUrl}">Download CSV</a></p>
`.trim();

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
                content: htmlContent,
              },
            }),
          }
        );

        const messageData = await response.json();

        if (messageData.error) {
          let userMessage = messageData.error.message || messageData.error.code || "Failed to post to channel";
          if (messageData.error.code === "NotFound" || messageData.error.message?.includes("not found")) {
            userMessage = "Channel not found. It may have been deleted or the app may not have access.";
          } else if (messageData.error.code === "Forbidden" || messageData.error.message?.toLowerCase().includes("access")) {
            userMessage = "The app doesn't have access to that channel. Add the app to the channel in Teams, then try again.";
          }
          return new Response(JSON.stringify({ error: userMessage }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("integration_logs").insert({
          integration_id: integration.id,
          action: "share-contact",
          status: "success",
          details: { team_id: teamId, channel_id: channelId },
        });

        return new Response(JSON.stringify({ success: true }), {
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
        let attendees: Array<{ emailAddress: { address: string; name: string }; type: "required" }> = [];
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
        // Check for org-level integration first, then user-level
        let integration = null;
        
        if (scope === 'organization' && profile?.company_id) {
          const { data: orgIntegration } = await supabase
            .from("integrations")
            .select("*")
            .eq("company_id", profile.company_id)
            .eq("provider", "teams")
            .eq("scope", "organization")
            .eq("is_active", true)
            .maybeSingle();
          
          integration = orgIntegration;
        }
        
        if (!integration) {
          const { data: userIntegration } = await supabase
            .from("integrations")
            .select("*")
            .eq("user_id", user.id)
            .eq("provider", "teams")
            .maybeSingle();
          
          integration = userIntegration;
        }

        return new Response(JSON.stringify({
          connected: !!integration?.is_active,
          scope: integration?.scope || 'user',
          settings: integration?.settings,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        // Delete based on scope
        if (scope === 'organization' && profile?.company_id) {
          // Verify user is admin before allowing org-level disconnect
          const { data: isAdminData } = await supabase.rpc('has_role', {
            user_id: user.id,
            role_to_check: 'admin'
          });
          
          if (!isAdminData) {
            return new Response(JSON.stringify({ 
              error: "Only organization admins can disconnect organization integrations" 
            }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          
          await supabase
            .from("integrations")
            .delete()
            .eq("company_id", profile.company_id)
            .eq("provider", "teams")
            .eq("scope", "organization");
        } else {
          await supabase
            .from("integrations")
            .delete()
            .eq("user_id", user.id)
            .eq("provider", "teams")
            .eq("scope", "user");
        }

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
  supabase: ReturnType<typeof createClient>,
  userId: string,
  clientId?: string,
  clientSecret?: string,
  tenantId?: string,
  scope: 'user' | 'organization' = 'user',
  companyId?: string
) {
  let query = supabase
    .from("integrations")
    .select("*")
    .eq("provider", "teams");
  
  if (scope === 'organization' && companyId) {
    query = query.eq("company_id", companyId).eq("scope", "organization");
  } else {
    query = query.eq("user_id", userId).eq("scope", "user");
  }

  const { data: integration } = await query.maybeSingle();

  if (!integration?.access_token) return null;

  // Check if token needs refresh
  const expiresAt = new Date(integration.token_expires_at);
  if (expiresAt <= new Date()) {
    if (!integration.refresh_token || !clientId || !clientSecret) return null;

    // Refresh the token
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId || "organizations"}/oauth2/v2.0/token`,
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
