import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[bulk-insert-contacts] Request received", {
    method: req.method,
    hasAuth: !!req.headers.get("Authorization"),
  });

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role key for database operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Manually verify JWT token from Authorization header
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user profile to determine company_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[bulk-insert-contacts] Profile lookup error:", profileError);
      // Continue with null company_id - not a fatal error
    }

    const companyId = profile?.company_id || null;
    console.log("[bulk-insert-contacts] User profile", {
      userId: user.id,
      companyId,
    });

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("[bulk-insert-contacts] JSON parse error:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { contacts, isShared = false } = body;
    console.log("[bulk-insert-contacts] Parsed request", {
      contactsCount: contacts?.length || 0,
      isShared,
    });

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: "Contacts array is required and must not be empty" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Limit batch size to prevent timeouts
    const MAX_BATCH_SIZE = 100;
    if (contacts.length > MAX_BATCH_SIZE) {
      return new Response(
        JSON.stringify({ error: `Maximum ${MAX_BATCH_SIZE} contacts per request` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Map contacts to database format
    const contactsToInsert = contacts.map((contact: any) => {
      // Use contact-level isShared if provided, otherwise use request-level isShared
      const contactIsShared = contact.isShared !== undefined ? contact.isShared : isShared;
      return {
        name: contact.name || "",
        email: contact.email || null,
        phone: contact.phone || null,
        company: contact.company || null,
        role: contact.role || null,
        description: contact.description || null,
        tags: contact.tags || [],
        avatar: contact.avatar || null,
        folder_id: contact.folderId || null,
        owner_id: contactIsShared ? null : user.id,
        company_id: companyId,
        is_shared: contactIsShared,
        address: contact.address || null,
        city: contact.city || null,
        state: contact.state || null,
        zip_code: contact.zipCode || null,
        country: contact.country || null,
        latitude: contact.latitude || null,
        longitude: contact.longitude || null,
        business_name: contact.businessName || null,
        business_type: contact.businessType || null,
      };
    });

    // Insert contacts in batches
    const batchSize = 50;
    let insertedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < contactsToInsert.length; i += batchSize) {
      const batch = contactsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from("contacts")
        .insert(batch)
        .select();

      if (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        // Continue with next batch instead of failing completely
        continue;
      }

      insertedCount += data?.length || 0;
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${data?.length || 0} contacts`);
    }

    if (insertedCount === 0 && errors.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to insert contacts",
          details: errors 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedCount,
        total: contacts.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[bulk-insert-contacts] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[bulk-insert-contacts] Error stack:", stack);
    return new Response(
      JSON.stringify({ 
        error: message,
        details: process.env.DENO_ENV === "development" ? stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

