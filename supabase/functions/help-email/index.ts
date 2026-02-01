import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
  sanitizeString,
  checkRateLimit,
  rateLimitExceededResponse,
} from "../_shared/security.ts";

const MAX_BODY_LENGTH = 10000;
const MAX_ERROR_LOGS_LENGTH = 20000;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
const RATE_LIMIT_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type PayloadType = "bug_report" | "contact_support";

interface HelpEmailPayload {
  type: PayloadType;
  body: string;
  userEmail?: string;
  errorLogs?: string;
  attachmentBase64?: string;
  attachmentFilename?: string;
}

function jsonResponse(
  data: Record<string, unknown>,
  status: number,
  origin?: string | null
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

async function sendResendEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { content: string; filename: string }[];
}): Promise<{ id?: string; error?: string }> {
  const body: Record<string, unknown> = {
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  };
  if (params.replyTo) body.reply_to = params.replyTo;
  if (params.attachments?.length) body.attachments = params.attachments;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.message ?? data?.error ?? `Resend API ${res.status}`;
    return { error: err };
  }
  return { id: data?.id };
}

function sanitizeForClient(msg: string, maxLen = 200): string {
  return sanitizeString(msg, maxLen);
}

serve(async (req) => {
  let origin: string | null = null;
  try {
    origin = req.headers.get("origin");
    const preflight = handleCorsPreflightRequest(req);
    if (preflight) return preflight;

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, origin);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401, origin);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Invalid or expired token" }, 401, origin);
    }

    const userId = userData.user.id;

    const rateLimit = checkRateLimit(
      `help-email:${userId}`,
      RATE_LIMIT_REQUESTS,
      RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit.resetIn, origin);
    }

    let payload: HelpEmailPayload;
    try {
      payload = (await req.json()) as HelpEmailPayload;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, origin);
    }

    const { type, body: rawBody } = payload;
    if (!type || (type !== "bug_report" && type !== "contact_support")) {
      return jsonResponse({ error: "Invalid or missing type" }, 400, origin);
    }

    const body = sanitizeString(String(rawBody ?? ""), MAX_BODY_LENGTH);
    if (!body) {
      return jsonResponse({ error: "Body is required" }, 400, origin);
    }

    const userEmail = payload.userEmail
      ? sanitizeString(String(payload.userEmail), 254)
      : userData.user.email ?? undefined;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "notifications@whonow.co";

    if (!resendKey) {
      console.error("[help-email] RESEND_API_KEY is not set");
      return jsonResponse(
        { error: "Email service is not configured. Please try again later." },
        503,
        origin
      );
    }

    if (type === "bug_report") {
      const errorLogs = payload.errorLogs
        ? sanitizeString(String(payload.errorLogs), MAX_ERROR_LOGS_LENGTH)
        : "";

      let attachment: { content: string; filename: string } | undefined;
      if (payload.attachmentBase64 && payload.attachmentFilename) {
        const filename = sanitizeString(String(payload.attachmentFilename), 255) || "attachment";
        let decoded: Uint8Array;
        try {
          decoded = Uint8Array.from(atob(payload.attachmentBase64), (c) => c.charCodeAt(0));
        } catch {
          return jsonResponse({ error: "Invalid attachment encoding" }, 400, origin);
        }
        if (decoded.length > MAX_ATTACHMENT_BYTES) {
          return jsonResponse({ error: "Attachment too large" }, 400, origin);
        }
        attachment = { content: payload.attachmentBase64, filename };
      }

      const htmlParts = [
        "<p><strong>Description:</strong></p>",
        `<p>${body.replace(/\n/g, "<br>")}</p>`,
      ];
      if (errorLogs) {
        htmlParts.push("<p><strong>Recent error logs:</strong></p>");
        htmlParts.push(`<pre style="white-space:pre-wrap;font-size:12px;">${errorLogs.replace(/</g, "&lt;")}</pre>`);
      }
      htmlParts.push(`<p><em>Reported by: ${userEmail ?? "unknown"}</em></p>`);

      const result = await sendResendEmail({
        apiKey: resendKey,
        from: fromEmail,
        to: "debug@whonow.co",
        subject: `Bug report from ${userEmail ?? "unknown"}`,
        html: htmlParts.join("\n"),
        replyTo: userEmail,
        attachments: attachment ? [attachment] : undefined,
      });

      if (result.error) {
        console.error("[help-email] Resend bug_report error:", result.error);
        const clientMsg = sanitizeForClient(result.error)
          ? `Failed to send report: ${sanitizeForClient(result.error)}`
          : "Failed to send report";
        return jsonResponse({ error: clientMsg }, 500, origin);
      }
      return jsonResponse({ success: true }, 200, origin);
    }

    // contact_support
    const html = [
      "<p><strong>Message:</strong></p>",
      `<p>${body.replace(/\n/g, "<br>")}</p>`,
      `<p><em>From: ${userEmail ?? "unknown"}</em></p>`,
    ].join("\n");

    const result = await sendResendEmail({
      apiKey: resendKey,
      from: fromEmail,
      to: "support@whonow.co",
      subject: `Support request from ${userEmail ?? "unknown"}`,
      html,
      replyTo: userEmail,
    });

    if (result.error) {
      console.error("[help-email] Resend contact_support error:", result.error);
      const clientMsg = sanitizeForClient(result.error)
        ? `Failed to send message: ${sanitizeForClient(result.error)}`
        : "Failed to send message";
      return jsonResponse({ error: clientMsg }, 500, origin);
    }
    return jsonResponse({ success: true }, 200, origin);
  } catch (err) {
    console.error("[help-email] Unhandled error:", err);
    return jsonResponse(
      { error: "An unexpected error occurred. Please try again later." },
      500,
      origin
    );
  }
});
