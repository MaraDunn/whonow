import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        return new Response(null, {
          status: 302,
          headers: { Location: `${appUrl}/?integration=slack&status=error&message=${encodeURIComponent(tokenData.error)}` },
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
        
        // Get user's Slack integration (check org-level first, then user-level)
        let integration = null;
        
        if (scope === 'organization' && profile?.company_id) {
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
        
        if (!integration) {
          const { data: userIntegration, error: integrationError } = await supabase
            .from("integrations")
            .select("*")
            .eq("user_id", user.id)
            .eq("provider", "slack")
            .maybeSingle();

          if (integrationError) {
            console.error("Error fetching integration:", integrationError);
          }
          
          integration = userIntegration;
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

        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "slack")
          .single();

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

        // Format contact as Slack message
        const blocks = [
          {
            type: "header",
            text: { type: "plain_text", text: `📇 ${contact.name}` },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Email:*\n${contact.email || "N/A"}` },
              { type: "mrkdwn", text: `*Phone:*\n${contact.phone || "N/A"}` },
              { type: "mrkdwn", text: `*Role:*\n${contact.role || "N/A"}` },
              { type: "mrkdwn", text: `*Company:*\n${contact.company || "N/A"}` },
            ],
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
          return new Response(JSON.stringify({ error: messageData.error }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-channels": {
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "slack")
          .single();

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
        // Check for org-level integration first, then user-level
        let integration = null;
        
        if (scope === 'organization' && profile?.company_id) {
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
        
        if (!integration) {
          const { data: userIntegration } = await supabase
            .from("integrations")
            .select("*")
            .eq("user_id", user.id)
            .eq("provider", "slack")
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
