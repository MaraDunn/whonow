import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
  checkRateLimit,
  rateLimitExceededResponse,
} from "../_shared/security.ts";

/** Contact payload shape stored in contact_share_tokens (camelCase for frontend). */
type ContactPayload = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  tags?: string[];
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  lastContactedAt?: string;
  isClient?: boolean;
};

const CSV_HEADERS = [
  "name",
  "email",
  "phone",
  "company",
  "role",
  "tags",
  "description",
  "address",
  "city",
  "state",
  "zipCode",
  "country",
  "lastContactedAt",
  "isClient",
];

function escapeCsvCell(value: string): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function contactToCsvRow(c: ContactPayload): string[] {
  return [
    escapeCsvCell(c.name ?? ""),
    escapeCsvCell(c.email ?? ""),
    escapeCsvCell(c.phone ?? ""),
    escapeCsvCell(c.company ?? ""),
    escapeCsvCell(c.role ?? ""),
    escapeCsvCell(Array.isArray(c.tags) ? c.tags.join(";") : ""),
    escapeCsvCell(c.description ?? ""),
    escapeCsvCell(c.address ?? ""),
    escapeCsvCell(c.city ?? ""),
    escapeCsvCell(c.state ?? ""),
    escapeCsvCell(c.zipCode ?? ""),
    escapeCsvCell(c.country ?? ""),
    escapeCsvCell(c.lastContactedAt ?? ""),
    escapeCsvCell(c.isClient === true ? "true" : "false"),
  ];
}

function toCsv(contact: ContactPayload): string {
  const BOM = "\uFEFF";
  const headerRow = CSV_HEADERS.join(",");
  const dataRow = contactToCsvRow(contact).join(",");
  return BOM + headerRow + "\n" + dataRow;
}

function sanitizeFilename(name: string): string {
  const s = (name ?? "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim() || "contact";
  return s.slice(0, 100);
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const { allowed, resetIn } = checkRateLimit(`contact-share:${clientIP}`, 60, 60000);
  if (!allowed) {
    return rateLimitExceededResponse(resetIn, origin);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const format = url.searchParams.get("format");

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: row, error } = await supabase
    .from("contact_share_tokens")
    .select("contact_payload, expires_at")
    .eq("token", token)
    .single();

  if (error || !row) {
    return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() > expiresAt) {
    return new Response(JSON.stringify({ error: "This link has expired" }), {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = row.contact_payload as ContactPayload;

  if (format === "csv") {
    const csv = toCsv(payload);
    const filename = `${sanitizeFilename(payload.name)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
