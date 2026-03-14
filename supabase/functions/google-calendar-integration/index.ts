import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
  secureLog,
  sanitizeString,
} from "../_shared/security.ts";
import { createOAuthState, parseOAuthState } from "../_shared/oauthState.ts";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
};

type GoogleCalendarEventInsert = {
  summary?: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
};

serve(async (req) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  secureLog("GCAL", "Request", { method: req.method, path: url.pathname });

  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const appUrl = Deno.env.get("APP_URL") || "http://localhost:8080";

  // OAuth callback: GET with code and state
  const isOAuthCallback = req.method === "GET" && url.searchParams.has("code");
  if (isOAuthCallback) {
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      console.error("Google Calendar OAuth error:", errorParam);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}/?integration=google_calendar&status=error&message=${encodeURIComponent(errorParam)}`,
        },
      });
    }

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!code || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !stateParam) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}/?integration=google_calendar&status=error&message=missing_params`,
        },
      });
    }

    const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
    if (!stateSecret || stateSecret.length < 16) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}/?integration=google_calendar&status=error&message=oauth_misconfigured`,
        },
      });
    }
    const rawState = decodeURIComponent(stateParam);
    const payload = await parseOAuthState(stateSecret, rawState);
    if (!payload?.userId) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}/?integration=google_calendar&status=error&message=invalid_state`,
        },
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-integration`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Google token exchange failed:", errText);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}/?integration=google_calendar&status=error&message=token_exchange_failed`,
        },
      });
    }
    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    const { error: upsertError } = await supabase.from("integrations").upsert(
      {
        user_id: payload.userId,
        provider: "google_calendar",
        scope: "user",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        token_expires_at: expiresAt,
        is_active: true,
        settings: {},
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      console.error("Error storing Google Calendar integration:", upsertError);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}/?integration=google_calendar&status=error&message=storage_error`,
        },
      });
    }
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/?integration=google_calendar&status=success` },
    });
  }

  // POST: authenticated actions
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { action?: string; jwt?: string; contactId?: string; followUpDate?: string; contactName?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { action, jwt: bodyJwt, ...params } = body;
  const authHeader = req.headers.get("Authorization");
  const jwt = bodyJwt ?? (authHeader?.replace(/^Bearer\s+/i, "").trim() || null);
  if (!jwt) {
    return new Response(
      JSON.stringify({ error: "No JWT token provided. Send in request body as 'jwt' or in Authorization header." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", detail: authError?.message ?? "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const json = (data: unknown) =>
    new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  const err = (message: string, status = 400) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  switch (action) {
    case "connect": {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return err("Google Calendar integration is not configured.");
      }
      const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
      if (!stateSecret || stateSecret.length < 16) {
        return err("OAuth state secret is not configured.", 500);
      }
      const stateValue = await createOAuthState(stateSecret, { userId: user.id });
      const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-integration`;
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(CALENDAR_SCOPE)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${encodeURIComponent(stateValue)}`;
      return json({ url: authUrl });
    }

    case "get-status": {
      const { data: row } = await supabase
        .from("integrations")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider", "google_calendar")
        .eq("scope", "user")
        .eq("is_active", true)
        .maybeSingle();
      return json({ connected: !!row });
    }

    case "disconnect": {
      const { error: delError } = await supabase
        .from("integrations")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("provider", "google_calendar");
      if (delError) {
        return err(delError.message, 500);
      }
      return json({ success: true });
    }

    case "create-event": {
      const contactId = params.contactId as string | undefined;
      const followUpDate = params.followUpDate as string | undefined;
      const contactName = params.contactName as string | undefined;
      if (!contactId || !followUpDate || !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)) {
        return err("contactId and followUpDate (YYYY-MM-DD) are required.");
      }
      const name = contactName ? sanitizeString(contactName, 200) : "Contact";

      const { data: integration, error: intError } = await supabase
        .from("integrations")
        .select("id, access_token, refresh_token, token_expires_at")
        .eq("user_id", user.id)
        .eq("provider", "google_calendar")
        .eq("scope", "user")
        .eq("is_active", true)
        .maybeSingle();
      if (intError || !integration?.access_token) {
        return err("Google Calendar is not connected.", 400);
      }

      let accessToken = integration.access_token as string;
      let expiresAt = integration.token_expires_at as string | null;
      const refreshToken = integration.refresh_token as string | null;
      const now = new Date();
      const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
      if (refreshToken && (!expiresAtDate || expiresAtDate.getTime() - now.getTime() < 60_000)) {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
          return err("Google Calendar integration is not configured.", 500);
        }
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });
        if (!refreshRes.ok) {
          const errText = await refreshRes.text();
          console.error("Google token refresh failed:", errText);
          return err("Failed to refresh calendar access.", 500);
        }
        const refreshData = (await refreshRes.json()) as GoogleTokenResponse;
        accessToken = refreshData.access_token;
        const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
        await supabase
          .from("integrations")
          .update({ access_token: accessToken, token_expires_at: newExpiresAt })
          .eq("id", integration.id);
      }

      // All-day event: end.date is exclusive in Google Calendar, so use next day
      const nextDay = new Date(followUpDate + "T00:00:00Z");
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const endDate = nextDay.toISOString().slice(0, 10);
      const eventBody: GoogleCalendarEventInsert = {
        summary: `Follow up: ${name}`,
        start: { date: followUpDate },
        end: { date: endDate },
      };
      const eventRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        }
      );
      if (!eventRes.ok) {
        const errText = await eventRes.text();
        console.error("Calendar API error:", eventRes.status, errText);
        return err("Failed to create calendar event.", 500);
      }
      const eventData = (await eventRes.json()) as { id?: string };
      return json({ success: true, eventId: eventData.id });
    }

    default:
      return err("Unknown action.");
  }
});
