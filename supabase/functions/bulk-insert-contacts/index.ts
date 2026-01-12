import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkLaunchMode, waitlistModeBlockedResponse } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check launch mode - block in waitlist mode
  const { blocked } = checkLaunchMode();
  if (blocked) {
    const origin = req.headers.get("origin");
    return waitlistModeBlockedResponse(origin);
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

    // Helper function to normalize email for comparison
    const normalizeEmail = (email: string | null | undefined): string => {
      if (!email || typeof email !== 'string') return '';
      return email.trim().toLowerCase();
    };

    // Helper function to normalize phone for comparison
    const normalizePhone = (phone: string | null | undefined): string => {
      if (!phone || typeof phone !== 'string') return '';
      return phone.replace(/\D/g, '');
    };

    // Helper function to check if two contacts are duplicates
    const areDuplicates = (c1: any, c2: any): boolean => {
      const email1 = normalizeEmail(c1.email);
      const email2 = normalizeEmail(c2.email);
      const phone1 = normalizePhone(c1.phone);
      const phone2 = normalizePhone(c2.phone);

      // Match by email (both must have emails)
      if (email1 && email2 && email1 === email2) {
        return true;
      }

      // Match by phone (both must have phones)
      if (phone1 && phone2 && phone1 === phone2) {
        return true;
      }

      return false;
    };

    // Helper function to merge two contacts (new data into existing)
    const mergeContactData = (existing: any, newData: any): any => {
      // Merge tags - combine and deduplicate
      const existingTags = existing.tags || [];
      const newTags = newData.tags || [];
      const allTags = [...existingTags, ...newTags];
      const mergedTags = Array.from(new Set(allTags.map((t: string) => t.toLowerCase())));

      // Merge descriptions
      let mergedDescription = existing.description || null;
      if (newData.description) {
        if (mergedDescription && mergedDescription.trim() !== newData.description.trim()) {
          mergedDescription = `${mergedDescription.trim()}\n\n${newData.description.trim()}`;
        } else {
          mergedDescription = newData.description;
        }
      }

      // Merge fields: prefer non-empty from new data, fallback to existing
      return {
        ...existing,
        name: newData.name || existing.name || "",
        email: newData.email || existing.email || null,
        phone: newData.phone || existing.phone || null,
        company: newData.company || existing.company || null,
        role: newData.role || existing.role || null,
        description: mergedDescription,
        tags: mergedTags,
        avatar: newData.avatar || existing.avatar || null,
        folder_id: newData.folder_id || existing.folder_id || null,
        address: newData.address || existing.address || null,
        city: newData.city || existing.city || null,
        state: newData.state || existing.state || null,
        zip_code: newData.zip_code || existing.zip_code || null,
        country: newData.country || existing.country || null,
        latitude: newData.latitude ?? existing.latitude ?? null,
        longitude: newData.longitude ?? existing.longitude ?? null,
        business_name: newData.business_name || existing.business_name || null,
        business_type: newData.business_type || existing.business_type || null,
      };
    };

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

    // Check for existing contacts to find duplicates
    // Fetch all contacts the user has access to (owned, company shared, or globally shared)
    let existingContacts: any[] = [];
    
    // Build query to get contacts user has access to
    // Check: (owner_id = user.id) OR (company_id = companyId) OR (is_shared = true)
    // AND (email IS NOT NULL OR phone IS NOT NULL)
    let query = supabase
      .from("contacts")
      .select("*");

    // Build OR condition for access control
    const accessConditions: string[] = [];
    if (user.id) {
      accessConditions.push(`owner_id.eq.${user.id}`);
    }
    if (companyId) {
      accessConditions.push(`company_id.eq.${companyId}`);
    }
    accessConditions.push(`is_shared.eq.true`);

    if (accessConditions.length > 0) {
      query = query.or(accessConditions.join(','));
    }

    // Also filter to only contacts with email or phone (potential duplicates)
    query = query.or('email.not.is.null,phone.not.is.null');

    const { data: allContacts, error: fetchError } = await query;

    if (fetchError) {
      console.error("[bulk-insert-contacts] Error fetching existing contacts:", fetchError);
    } else {
      existingContacts = allContacts || [];
      
      // Filter to only contacts that match by normalized email or phone
      existingContacts = existingContacts.filter(existing => {
        return contactsToInsert.some(newContact => areDuplicates(newContact, existing));
      });
      
      console.log(`[bulk-insert-contacts] Found ${existingContacts.length} existing duplicate contacts out of ${allContacts?.length || 0} total contacts`);
    }

    // Separate contacts into new and duplicates
    const newContacts: any[] = [];
    const contactsToMerge: Array<{ existing: any; newData: any }> = [];
    let skippedCount = 0;

    for (const newContact of contactsToInsert) {
      const duplicate = existingContacts.find(existing => areDuplicates(newContact, existing));
      
      if (duplicate) {
        // Merge duplicate into existing contact
        contactsToMerge.push({ existing: duplicate, newData: newContact });
        skippedCount++;
      } else {
        // New contact, add to insert list
        newContacts.push(newContact);
      }
    }

    console.log(`[bulk-insert-contacts] Processing: ${newContacts.length} new, ${contactsToMerge.length} to merge, ${skippedCount} duplicates`);

    // Insert new contacts in batches
    const batchSize = 50;
    let insertedCount = 0;
    let mergedCount = 0;
    const errors: string[] = [];

    // Insert new contacts
    for (let i = 0; i < newContacts.length; i += batchSize) {
      const batch = newContacts.slice(i, i + batchSize);
      
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

    // Merge duplicate contacts
    for (const { existing, newData } of contactsToMerge) {
      const merged = mergeContactData(existing, newData);
      
      const { error } = await supabase
        .from("contacts")
        .update(merged)
        .eq("id", existing.id);

      if (error) {
        console.error(`[bulk-insert-contacts] Error merging contact ${existing.id}:`, error);
        errors.push(`Merge ${existing.id}: ${error.message}`);
      } else {
        mergedCount++;
        console.log(`[bulk-insert-contacts] Merged contact ${existing.id}`);
      }
    }

    if (insertedCount === 0 && mergedCount === 0 && errors.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to insert or merge contacts",
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
        merged: mergedCount,
        skipped: skippedCount,
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

