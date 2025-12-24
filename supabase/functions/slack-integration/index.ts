import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    console.log(`Slack integration action: ${action}`, params);

    const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID");
    const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET");
    const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");

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
        
        const redirectUri = `${supabaseUrl}/functions/v1/slack-integration?action=oauth-callback`;
        const scopes = "users:read,users:read.email,chat:write,channels:read,groups:read";
        const oauthUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${user.id}`;
        
        return new Response(JSON.stringify({ url: oauthUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "oauth-callback": {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state"); // user_id
        
        if (!code || !SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
          return new Response("Missing code or credentials", { status: 400 });
        }

        const redirectUri = `${supabaseUrl}/functions/v1/slack-integration?action=oauth-callback`;
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
        console.log("Slack OAuth response:", tokenData);

        if (!tokenData.ok) {
          return new Response(`OAuth failed: ${tokenData.error}`, { status: 400 });
        }

        // Store the integration
        await supabase.from("integrations").upsert({
          user_id: state,
          provider: "slack",
          access_token: tokenData.access_token,
          is_active: true,
          settings: {
            team_id: tokenData.team?.id,
            team_name: tokenData.team?.name,
            bot_user_id: tokenData.bot_user_id,
          },
        }, { onConflict: "user_id,provider" });

        // Redirect back to the app
        return new Response(null, {
          status: 302,
          headers: { Location: "/settings?integration=slack&status=success" },
        });
      }

      case "import-members": {
        // Get user's Slack integration
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

        // Fetch Slack workspace members
        const membersResponse = await fetch("https://slack.com/api/users.list", {
          headers: { Authorization: `Bearer ${integration.access_token}` },
        });
        const membersData = await membersResponse.json();

        if (!membersData.ok) {
          return new Response(JSON.stringify({ error: membersData.error }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Filter out bots and deleted users
        const validMembers = membersData.members.filter(
          (m: any) => !m.is_bot && !m.deleted && m.id !== "USLACKBOT"
        );

        // Get user's company_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        // Import as contacts
        const contacts = validMembers.map((member: any) => ({
          name: member.real_name || member.name,
          email: member.profile?.email,
          phone: member.profile?.phone,
          role: member.profile?.title,
          avatar: member.profile?.image_192,
          company: integration.settings?.team_name,
          owner_id: user.id,
          company_id: profile?.company_id,
          tags: ["slack-import"],
        }));

        const { data: inserted, error: insertError } = await supabase
          .from("contacts")
          .insert(contacts)
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
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "slack")
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
          .eq("provider", "slack");

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
