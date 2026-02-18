import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function checkLaunchMode(): { blocked: boolean; mode: string } {
  const mode = Deno.env.get("APP_LAUNCH_MODE") || "live";
  return { blocked: mode === "waitlist", mode };
}

function waitlistModeBlockedResponse(_origin?: string | null): Response {
  return new Response(
    JSON.stringify({
      error: "Slack is unavailable while the app is in waitlist mode. Set APP_LAUNCH_MODE to 'live' in Supabase Edge Function secrets to enable integrations.",
    }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/** True when the request is from a test/dev origin (localhost or INTEGRATION_TEST_ORIGINS). */
function isTestOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  const allowed = Deno.env.get("INTEGRATION_TEST_ORIGINS");
  if (!allowed) return false;
  return allowed.split(",").some((o) => origin === o.trim());
}

type SlackUserProfile = {
  email?: string;
  phone?: string;
  title?: string;
  image_192?: string;
};

type SlackMember = {
  id?: string;
  is_bot?: boolean;
  deleted?: boolean;
  name?: string;
  real_name?: string;
  profile?: SlackUserProfile;
};

type SlackUsersListResponse = {
  ok: boolean;
  error?: string;
  members?: SlackMember[];
};

serve(async (req) => {
  const url = new URL(req.url);
  const authHeader = req.headers.get("Authorization");
  console.log(`[slack-integration] ${req.method} ${url.pathname}${url.search} | Auth: ${authHeader ? "present" : "missing"}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check launch mode - block in waitlist mode unless: skip flag is set, or test origin, or OAuth callback
  const skipWaitlistForIntegrations = Deno.env.get("INTEGRATION_SKIP_WAITLIST") === "true";
  const { blocked } = checkLaunchMode();
  if (!skipWaitlistForIntegrations && blocked) {
    const origin = req.headers.get("origin");
    const isOAuthCallback = req.method === "GET" && new URL(req.url).searchParams.has("code");
    if (!isTestOrigin(origin) && !isOAuthCallback) return waitlistModeBlockedResponse(origin);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get app URL from environment or use a default
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:8080";

    // Check if this is an OAuth callback (GET request with code parameter)
    const url = new URL(req.url);
    const isOAuthCallback = req.method === "GET" && url.searchParams.has("code");
    
    if (isOAuthCallback) {
      // Handle OAuth callback separately - no auth required
      const code = url.searchParams.get("code");
      const stateParam = url.searchParams.get("state");
      const errorParam = url.searchParams.get("error");
      
      if (errorParam) {
        console.error("Slack OAuth error:", errorParam);
        return new Response(null, {
          status: 302,
          headers: { Location: `${appUrl}/?integration=slack&status=error&message=${encodeURIComponent(errorParam)}` },
        });
      }

      const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID");
      const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET");
      
      if (!code || !SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET || !stateParam) {
        console.error("Missing OAuth params:", { hasCode: !!code, hasClientId: !!SLACK_CLIENT_ID, hasSecret: !!SLACK_CLIENT_SECRET, hasState: !!stateParam });
        return new Response(null, {
          status: 302,
          headers: { Location: `${appUrl}/?integration=slack&status=error&message=missing_params` },
        });
      }

      // Parse state to extract userId and scope
      let userId = stateParam;
      let integrationScope = 'user';
      
      try {
        const parsedState = JSON.parse(decodeURIComponent(stateParam));
        userId = parsedState.userId;
        integrationScope = parsedState.scope || 'user';
      } catch {
        // Legacy format: state is just the user ID
        console.log("Using legacy state format (user ID only)");
      }

      const redirectUri = `${supabaseUrl}/functions/v1/slack-integration`;
      console.log("Exchanging code for token with redirect URI:", redirectUri, "scope:", integrationScope);
      
      const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: SLACK_CLIENT_ID,
          client_secret: SLACK_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();
      console.log("Slack OAuth token response:", JSON.stringify(tokenData));

      if (!tokenData.ok) {
        console.error("Slack OAuth failed:", tokenData.error);
        // Map known Slack errors to user-friendly messages
        let userMessage = tokenData.error as string;
        if (tokenData.error === "invalid_team_for_non_distributed_app") {
          userMessage = "Slack app must be publicly distributed. In your Slack app settings, go to Manage Distribution and enable Public Distribution. If you have multiple workspaces open, try connecting in an incognito window or after signing out of other workspaces.";
        }
        return new Response(null, {
          status: 302,
          headers: { Location: `${appUrl}/?integration=slack&status=error&message=${encodeURIComponent(userMessage)}` },
        });
      }

      // Get user's company_id for org-level integrations
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();

      // Store the integration with appropriate scope
      const integrationData: any = {
        user_id: userId,
        provider: "slack",
        access_token: tokenData.access_token,
        is_active: true,
        scope: integrationScope,
        settings: {
          team_id: tokenData.team?.id,
          team_name: tokenData.team?.name,
          bot_user_id: tokenData.bot_user_id,
        },
      };

      // Add company_id for organization-level integrations
      if (integrationScope === 'organization' && profile?.company_id) {
        integrationData.company_id = profile.company_id;
      }

      const { error: upsertError } = await supabase.from("integrations").upsert(integrationData);

      if (upsertError) {
        console.error("Error storing integration:", upsertError);
        return new Response(null, {
          status: 302,
          headers: { Location: `${appUrl}/?integration=slack&status=error&message=storage_error` },
        });
      }

      console.log("Slack integration stored successfully, redirecting to:", `${appUrl}/?integration=slack&status=success`);
      
      // Redirect back to the app
      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/?integration=slack&status=success` },
      });
    }

    // For all other requests, require authentication
    // Parse body to get JWT (since Supabase strips Authorization header when verify_jwt=false)
    console.log("[slack-integration] Parsing request body...");
    let body;
    try {
      const bodyText = await req.text();
      console.log("[slack-integration] Raw body (first 200 chars):", bodyText.substring(0, 200));
      body = JSON.parse(bodyText);
      console.log("[slack-integration] Parsed body keys:", Object.keys(body));
    } catch (e) {
      console.error("[slack-integration] Failed to parse request body:", e);
      return new Response(JSON.stringify({ error: "Invalid request body", details: String(e) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const { action, scope = 'user', jwt, ...params } = body;
    
    console.log("[slack-integration] Action:", action, "Scope:", scope, "JWT present:", !!jwt, "JWT length:", jwt?.length || 0);
    
    if (!jwt) {
      console.error("[slack-integration] No JWT in request body. Full body:", JSON.stringify(body));
      return new Response(JSON.stringify({ error: "No JWT token provided in request body" }), {
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

    console.log("[slack-integration] User verified:", user.id);

    const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID");
    const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET");
    const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
    
    console.log("[slack-integration] Secrets check - CLIENT_ID:", !!SLACK_CLIENT_ID, "CLIENT_SECRET:", !!SLACK_CLIENT_SECRET);

    // Get user's company for org-level integrations
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    switch (action) {
      case "get-oauth-url": {
        if (!SLACK_CLIENT_ID) {
          return new Response(JSON.stringify({ 
            error: "Slack integration not configured. Please add SLACK_CLIENT_ID secret." 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Slack is only available as an organization integration
        if (scope !== 'organization') {
          return new Response(JSON.stringify({
            error: "Slack is only available as an organization integration. Have your org admin connect Slack in Settings → Organization → Organization Integrations.",
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: isAdminData } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        if (!isAdminData) {
          return new Response(JSON.stringify({
            error: "Only organization admins can setup organization integrations",
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Redirect URI should NOT include query params - Slack will add code & state
        const redirectUri = `${supabaseUrl}/functions/v1/slack-integration`;
        const scopes = "users:read,users:read.email,chat:write,channels:read,groups:read";
        
        // Encode scope in state along with user ID
        const stateData = JSON.stringify({ userId: user.id, scope });
        const encodedState = encodeURIComponent(stateData);
        
        const oauthUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodedState}`;
        
        console.log("Generated OAuth URL with redirect:", redirectUri, "scope:", scope);
        
        return new Response(JSON.stringify({ url: oauthUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "import-members": {
        console.log("Starting import-members for user:", user.id, "scope:", scope);
        
        // Only organization-level integration is supported
        let integration = null;
        if (profile?.company_id) {
          const { data: orgIntegration } = await supabase
            .from("integrations")
            .select("*")
            .eq("company_id", profile.company_id)
            .eq("provider", "slack")
            .eq("scope", "organization")
            .eq("is_active", true)
            .maybeSingle();
          integration = orgIntegration;
        }

        if (!integration?.access_token) {
          console.error("No Slack integration found for user:", user.id);
          return new Response(JSON.stringify({ error: "Slack not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("Found Slack integration:", integration.id, "Team:", integration.settings?.team_name, "Scope:", integration.scope);

        // Fetch Slack workspace members
        const membersResponse = await fetch("https://slack.com/api/users.list", {
          headers: { Authorization: `Bearer ${integration.access_token}` },
        });
        const membersData = (await membersResponse.json()) as SlackUsersListResponse;

        console.log("Slack users.list response ok:", membersData.ok, "Member count:", membersData.members?.length);

        if (!membersData.ok) {
          console.error("Slack API error:", membersData.error);
          return new Response(JSON.stringify({ error: membersData.error }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Filter out bots and deleted users
        const validMembers = (membersData.members ?? []).filter(
          (m) => !m.is_bot && !m.deleted && m.id !== "USLACKBOT"
        );

        console.log("Valid members after filtering:", validMembers.length);

        // Build contacts to import
        // For org-level imports, set company_id so contacts are shared
        const contactsToImport = validMembers.map((member) => ({
          name: member.real_name || member.name || "",
          email: member.profile?.email || null,
          phone: member.profile?.phone || null,
          role: member.profile?.title || null,
          avatar: member.profile?.image_192 || null,
          company: integration.settings?.team_name,
          owner_id: user.id,
          company_id: integration.scope === 'organization' ? integration.company_id : profile?.company_id,
          is_shared: integration.scope === 'organization', // Share org-level imports
          tags: ["slack-import"],
        }));

        // Check for existing contacts by email to avoid duplicates
        const emailsToCheck = contactsToImport
          .filter((c) => Boolean(c.email))
          .map((c) => c.email as string);

        let existingEmailSet = new Set<string>();
        
        if (emailsToCheck.length > 0) {
          const { data: existingContacts } = await supabase
            .from("contacts")
            .select("email")
            .eq("owner_id", user.id)
            .in("email", emailsToCheck);
          
          const emails = (existingContacts ?? [])
            .map((c) => (c as { email: string | null }).email)
            .filter((e): e is string => Boolean(e));
          existingEmailSet = new Set(emails);
          console.log("Found existing contacts:", existingEmailSet.size);
        }

        // Filter out duplicates
        const newContacts = contactsToImport.filter(
          (c) => !c.email || !existingEmailSet.has(c.email)
        );
        const skippedCount = contactsToImport.length - newContacts.length;

        console.log("New contacts to insert:", newContacts.length, "Skipped duplicates:", skippedCount);

        if (newContacts.length === 0) {
          return new Response(JSON.stringify({ 
            success: true, 
            imported: 0,
            skipped: skippedCount,
            message: "All contacts already exist",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: inserted, error: insertError } = await supabase
          .from("contacts")
          .insert(newContacts)
          .select();

        if (insertError) {
          console.error("Error inserting contacts:", insertError);
          return new Response(JSON.stringify({ error: insertError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("Successfully inserted contacts:", inserted?.length);

        // Log the action
        await supabase.from("integration_logs").insert({
          integration_id: integration.id,
          action: "import-members",
          status: "success",
          details: { 
            imported_count: inserted?.length || 0,
            skipped_count: skippedCount,
          },
        });

        return new Response(JSON.stringify({ 
          success: true, 
          imported: inserted?.length || 0,
          skipped: skippedCount,
          contacts: inserted,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "share-contact": {
        const { contactId, channelId } = params;

        // Only organization-level integration is supported
        let integration = null;
        if (profile?.company_id) {
          const { data: orgIntegration } = await supabase
            .from("integrations")
            .select("*")
            .eq("company_id", profile.company_id)
            .eq("provider", "slack")
            .eq("scope", "organization")
            .eq("is_active", true)
            .maybeSingle();
          integration = orgIntegration;
        }

        if (!integration?.access_token) {
          return new Response(JSON.stringify({ error: "Slack not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get the contact
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

        // Build portable contact payload (camelCase) for Add to WhoNow / Download CSV
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

        // Short-lived token for share link (7 days)
        const tokenBytes = new Uint8Array(16);
        crypto.getRandomValues(tokenBytes);
        const shareToken = btoa(String.fromCharCode(...tokenBytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { error: insertError } = await supabase.from("contact_share_tokens").insert({
          token: shareToken,
          contact_payload: contactPayload,
          expires_at: expiresAt,
        });

        if (insertError) {
          console.error("Failed to create share token:", insertError);
          return new Response(JSON.stringify({ error: "Failed to create share link" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const addToWhoNowUrl = `${appUrl}/import-contact?token=${shareToken}`;
        const downloadCsvUrl = `${appUrl}/export-shared-contact?token=${shareToken}`;

        // Logo must be a public HTTPS URL reachable by Slack's servers. Prefer SLACK_LOGO_URL if set (e.g. https://www.whonow.co/logo-icon.png).
        const logoUrl =
          Deno.env.get("SLACK_LOGO_URL") ||
          (appUrl.startsWith("http://localhost") ? null : `${appUrl}/logo-icon.png`);
        const sectionWithOptionalLogo = {
          type: "section",
          text: { type: "mrkdwn", text: `*${contact.name}*` },
          ...(logoUrl && logoUrl.startsWith("http")
            ? { accessory: { type: "image" as const, image_url: logoUrl, alt_text: "WhoNow" } }
            : {}),
        };

        const blocks = [
          sectionWithOptionalLogo,
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Email:*\n${contact.email || "N/A"}` },
              { type: "mrkdwn", text: `*Phone:*\n${contact.phone || "N/A"}` },
              { type: "mrkdwn", text: `*Role:*\n${contact.role || "N/A"}` },
              { type: "mrkdwn", text: `*Company:*\n${contact.company || "N/A"}` },
            ],
          },
          // Use markdown links instead of buttons so the message works without enabling
          // Interactivity in the Slack app (which causes "app is not configured for this feature")
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `<${addToWhoNowUrl}|Add to WhoNow> · <${downloadCsvUrl}|Download CSV>`,
            },
          },
        ];

        const messageResponse = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${integration.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ channel: channelId, blocks }),
        });

        const messageData = await messageResponse.json();

        if (!messageData.ok) {
          let userMessage = messageData.error as string;
          if (messageData.error === "not_in_channel") {
            userMessage = "The app isn't in that channel yet. In Slack, invite the app to the channel first (e.g. type /invite then select the app, or add the app to the channel), then try sharing again.";
          } else if (messageData.error === "channel_not_found") {
            userMessage = "Channel not found. It may have been deleted or the app may not have access.";
          }
          return new Response(JSON.stringify({ error: userMessage }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-channels": {
        // Only organization-level integration is supported
        let integration = null;
        if (profile?.company_id) {
          const { data: orgIntegration } = await supabase
            .from("integrations")
            .select("*")
            .eq("company_id", profile.company_id)
            .eq("provider", "slack")
            .eq("scope", "organization")
            .eq("is_active", true)
            .maybeSingle();
          integration = orgIntegration;
        }

        if (!integration?.access_token) {
          return new Response(JSON.stringify({ error: "Slack not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const channelsResponse = await fetch(
          "https://slack.com/api/conversations.list?types=public_channel,private_channel",
          { headers: { Authorization: `Bearer ${integration.access_token}` } }
        );
        const channelsData = await channelsResponse.json();

        if (!channelsData.ok) {
          return new Response(JSON.stringify({ error: channelsData.error }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ channels: channelsData.channels }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send-notification": {
        const { webhookUrl, message, contactData } = params;

        if (!webhookUrl) {
          return new Response(JSON.stringify({ error: "No webhook URL provided" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const payload = {
          text: message,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: message },
            },
            ...(contactData ? [{
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Name:* ${contactData.name}` },
                { type: "mrkdwn", text: `*Email:* ${contactData.email || "N/A"}` },
              ],
            }] : []),
          ],
        };

        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Failed to send notification" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-status": {
        // Only organization-level integration is supported
        let integration = null;
        if (profile?.company_id) {
          const { data: orgIntegration } = await supabase
            .from("integrations")
            .select("*")
            .eq("company_id", profile.company_id)
            .eq("provider", "slack")
            .eq("scope", "organization")
            .eq("is_active", true)
            .maybeSingle();
          integration = orgIntegration;
        }

        return new Response(JSON.stringify({ 
          connected: !!integration?.is_active,
          scope: integration?.scope || 'organization',
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
            _user_id: user.id,
            _role: 'admin'
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
            .eq("provider", "slack")
            .eq("scope", "organization");
        } else {
          await supabase
            .from("integrations")
            .delete()
            .eq("user_id", user.id)
            .eq("provider", "slack")
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
    console.error("Slack integration error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
