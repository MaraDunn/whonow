import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, isValidEmail, checkRateLimit, rateLimitExceededResponse } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeadersWithOrigin = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, ...corsHeadersWithOrigin } });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, ...corsHeadersWithOrigin, "Content-Type": "application/json" },
      }
    );
  }

  // Rate limit: 10 signups per minute per IP (by IP or x-forwarded-for / x-real-ip)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const { allowed, resetIn } = checkRateLimit(`waitlist:${ip}`, 10, 60_000);
  if (!allowed) {
    return rateLimitExceededResponse(resetIn, origin);
  }

  try {
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, ...corsHeadersWithOrigin, "Content-Type": "application/json" },
        }
      );
    }

    const { email } = body;

    // Validate email
    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, ...corsHeadersWithOrigin, "Content-Type": "application/json" },
        }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!isValidEmail(trimmedEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, ...corsHeadersWithOrigin, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, ...corsHeadersWithOrigin, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Insert email into waitlist table
    const { error: insertError } = await supabase
      .from("waitlist")
      .insert({ email: trimmedEmail });

    if (insertError) {
      // Handle duplicate email gracefully (unique constraint violation)
      if (insertError.code === "23505" || insertError.message.includes("unique")) {
        return new Response(
          JSON.stringify({ success: true, message: "Email already registered" }),
          {
            status: 200,
            headers: { ...corsHeaders, ...corsHeadersWithOrigin, "Content-Type": "application/json" },
          }
        );
      }

      console.error("Error inserting email:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to register email" }),
        {
          status: 500,
          headers: { ...corsHeaders, ...corsHeadersWithOrigin, "Content-Type": "application/json" },
        }
      );
    }

    // Success response
    return new Response(
      JSON.stringify({ success: true, message: "Email registered successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, ...corsHeadersWithOrigin, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error in waitlist function:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, ...corsHeadersWithOrigin, "Content-Type": "application/json" },
      }
    );
  }
});
