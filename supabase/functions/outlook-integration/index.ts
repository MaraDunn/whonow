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
    console.log(`Outlook integration action: ${action}`, params);

    const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
    const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    const MICROSOFT_TENANT_ID = Deno.env.get("MICROSOFT_TENANT_ID") || "common";

    switch (action) {
      case "get-oauth-url": {
        if (!MICROSOFT_CLIENT_ID) {
          return new Response(JSON.stringify({ 
            error: "Outlook integration not configured. Please add MICROSOFT_CLIENT_ID secret." 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const redirectUri = `${supabaseUrl}/functions/v1/outlook-integration?action=oauth-callback`;
        const scopes = "offline_access User.Read Contacts.ReadWrite Calendars.ReadWrite";
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

        const redirectUri = `${supabaseUrl}/functions/v1/outlook-integration?action=oauth-callback`;

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
          provider: "outlook",
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
          headers: { Location: "/settings?integration=outlook&status=success" },
        });
      }

      case "refresh-token": {
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "outlook")
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

      case "import-contacts": {
        const integration = await getValidIntegration(supabase, user.id, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID);

        if (!integration) {
          return new Response(JSON.stringify({ error: "Outlook not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch Outlook contacts
        const contactsResponse = await fetch(
          `${GRAPH_API_BASE}/me/contacts?$top=100&$select=displayName,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle`,
          { headers: { Authorization: `Bearer ${integration.access_token}` } }
        );

        const contactsData = await contactsResponse.json();

        if (contactsData.error) {
          return new Response(JSON.stringify({ error: contactsData.error.message }), {
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

        // Map to contacts
        const contacts = contactsData.value.map((contact: any) => ({
          name: contact.displayName,
          email: contact.emailAddresses?.[0]?.address,
          phone: contact.mobilePhone || contact.businessPhones?.[0],
          company: contact.companyName,
          role: contact.jobTitle,
          owner_id: user.id,
          company_id: profile?.company_id,
          tags: ["outlook-import"],
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
          action: "import-contacts",
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

      case "sync-contacts": {
        const integration = await getValidIntegration(supabase, user.id, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID);

        if (!integration) {
          return new Response(JSON.stringify({ error: "Outlook not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get local contacts to sync
        const { data: localContacts } = await supabase
          .from("contacts")
          .select("*")
          .eq("owner_id", user.id)
          .is("deleted_at", null);

        let synced = 0;

        for (const contact of localContacts || []) {
          // Create contact in Outlook
          const outlookContact = {
            displayName: contact.name,
            emailAddresses: contact.email ? [{ address: contact.email }] : [],
            businessPhones: contact.phone ? [contact.phone] : [],
            companyName: contact.company,
            jobTitle: contact.role,
          };

          const response = await fetch(`${GRAPH_API_BASE}/me/contacts`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${integration.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(outlookContact),
          });

          if (response.ok) {
            synced++;
          }
        }

        await supabase.from("integration_logs").insert({
          integration_id: integration.id,
          action: "sync-contacts",
          status: "success",
          details: { synced_count: synced },
        });

        return new Response(JSON.stringify({ success: true, synced }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "schedule-meeting": {
        const { contactId, subject, startTime, endTime, message } = params;

        const integration = await getValidIntegration(supabase, user.id, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID);

        if (!integration) {
          return new Response(JSON.stringify({ error: "Outlook not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get contact details
        const { data: contact } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", contactId)
          .single();

        if (!contact?.email) {
          return new Response(JSON.stringify({ error: "Contact has no email" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create calendar event
        const event = {
          subject,
          body: {
            contentType: "text",
            content: message || `Meeting with ${contact.name}`,
          },
          start: {
            dateTime: startTime,
            timeZone: "UTC",
          },
          end: {
            dateTime: endTime,
            timeZone: "UTC",
          },
          attendees: [
            {
              emailAddress: {
                address: contact.email,
                name: contact.name,
              },
              type: "required",
            },
          ],
        };

        const response = await fetch(`${GRAPH_API_BASE}/me/events`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${integration.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });

        const eventData = await response.json();

        if (eventData.error) {
          return new Response(JSON.stringify({ error: eventData.error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          eventId: eventData.id,
          webLink: eventData.webLink,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-status": {
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "outlook")
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
          .eq("provider", "outlook");

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
    console.error("Outlook integration error:", error);
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
    .eq("provider", "outlook")
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
