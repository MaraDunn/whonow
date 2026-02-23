/**
 * Client helper for the help-email Edge Function.
 * Sends bug reports and contact support messages with auth.
 * Uses raw fetch so Authorization and apikey are sent reliably (avoids functions.invoke header quirks).
 */

import { supabase } from "@/integrations/supabase/client";
import { getRecentErrorLogs } from "@/utils/errorLogBuffer";

export type HelpEmailType = "bug_report" | "contact_support" | "contact_sales";

export interface HelpEmailPayload {
  type: HelpEmailType;
  body: string;
  userEmail?: string;
  errorLogs?: string;
  attachmentBase64?: string;
  attachmentFilename?: string;
  /** For contact_sales: sender name (required). */
  name?: string;
  /** For contact_sales: sender email (required). */
  email?: string;
}

const MAX_BODY_LENGTH = 10000;
const MAX_ERROR_LOGS_LENGTH = 20000;

function truncate(s: string, max: number): string {
  if (typeof s !== "string") return "";
  return s.slice(0, max);
}

async function getValidSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  return refreshed ?? session;
}

async function callHelpEmail(payload: HelpEmailPayload): Promise<{ success: boolean; error?: string }> {
  const session = await getValidSession();
  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) {
    return { success: false, error: "Missing Supabase configuration" };
  }

  const resp = await fetch(`${supabaseUrl}/functions/v1/help-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 400) {
      console.error("[help-email] 400 Bad Request:", data?.error ?? data);
    }
    const msg =
      typeof data?.error === "string"
        ? data.error
        : typeof data?.message === "string"
          ? data.message
          : resp.status === 503
            ? "Email service is not configured yet. Please try again later or contact support another way."
            : resp.status === 500
              ? "Could not send message. You can email support@whonow.co directly."
              : `Request failed (${resp.status})`;
    return { success: false, error: msg };
  }
  if (data?.error) {
    return { success: false, error: typeof data.error === "string" ? data.error : "Request failed" };
  }
  return { success: true };
}

export async function sendBugReport(params: {
  body: string;
  userEmail?: string;
  attachmentBase64?: string;
  attachmentFilename?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getValidSession();
  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  const body = truncate(params.body.trim(), MAX_BODY_LENGTH);
  if (!body) {
    return { success: false, error: "Description is required" };
  }

  const errorLogs = truncate(getRecentErrorLogs(), MAX_ERROR_LOGS_LENGTH);
  const payload: HelpEmailPayload = {
    type: "bug_report",
    body,
    userEmail: params.userEmail ?? session.user?.email ?? undefined,
    errorLogs: errorLogs !== "(no recent errors)" ? errorLogs : undefined,
    attachmentBase64: params.attachmentBase64,
    attachmentFilename: params.attachmentFilename,
  };

  return callHelpEmail(payload);
}

export async function sendContactSupport(params: {
  body: string;
  userEmail?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getValidSession();
  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  const body = truncate(params.body.trim(), MAX_BODY_LENGTH);
  if (!body) {
    return { success: false, error: "Message is required" };
  }

  const payload: HelpEmailPayload = {
    type: "contact_support",
    body,
    userEmail: params.userEmail ?? session.user?.email ?? undefined,
  };

  return callHelpEmail(payload);
}

export async function sendContactSales(params: {
  name: string;
  email: string;
  body?: string;
}): Promise<{ success: boolean; error?: string; useMailto?: boolean }> {
  const session = await getValidSession();
  const name = truncate(params.name.trim(), 200);
  const email = truncate(params.email.trim(), 254);
  if (!name) {
    return { success: false, error: "Name is required" };
  }
  if (!email) {
    return { success: false, error: "Email is required" };
  }

  if (!session?.access_token) {
    return { success: false, useMailto: true };
  }

  const body = truncate((params.body ?? "").trim(), MAX_BODY_LENGTH);
  const payload: HelpEmailPayload = {
    type: "contact_sales",
    body: body || "(No message provided)",
    name,
    email,
  };

  const result = await callHelpEmail(payload);
  if (!result.success && result.error) {
    const err = result.error.toLowerCase();
    const is400 =
      err.includes("invalid or missing type") ||
      err.includes("request failed (400)") ||
      err.includes("invalid json");
    if (is400) {
      return { success: false, useMailto: true };
    }
  }
  return result;
}
