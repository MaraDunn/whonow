import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
  sanitizeString,
  isValidEmail,
  isValidPhone,
} from "../_shared/security.ts";

// Max lengths for contact fields (sanitization and validation)
const MAX_LEN = {
  name: 500,
  email: 254,
  phone: 50,
  company: 500,
  role: 500,
  description: 5000,
  address: 500,
  city: 200,
  state: 200,
  zip_code: 50,
  country: 200,
  business_name: 500,
  business_type: 200,
  avatar: 2000,
  tag: 100,
  tags_count: 50,
} as const;

/** Sanitize and validate a single contact for insert; invalid email/phone become null. */
function sanitizeContactForInsert(contact: Record<string, unknown>, isShared: boolean, userId: string, companyId: string | null): Record<string, unknown> {
  const rawEmail = contact.email != null ? String(contact.email).trim() : "";
  const rawPhone = contact.phone != null ? String(contact.phone).trim() : "";
  const email = rawEmail && isValidEmail(sanitizeString(rawEmail, MAX_LEN.email)) ? sanitizeString(rawEmail, MAX_LEN.email) : null;
  const phone = rawPhone && isValidPhone(sanitizeString(rawPhone, MAX_LEN.phone)) ? sanitizeString(rawPhone, MAX_LEN.phone) : null;

  const tagsRaw = Array.isArray(contact.tags) ? contact.tags : [];
  const tags = tagsRaw
    .slice(0, MAX_LEN.tags_count)
    .map((t) => (typeof t === "string" ? sanitizeString(t, MAX_LEN.tag) : ""))
    .filter(Boolean);

  return {
    name: sanitizeString((contact.name as string) ?? "", MAX_LEN.name) || "",
    email,
    phone,
    company: sanitizeString((contact.company as string) ?? "", MAX_LEN.company) || null,
    role: sanitizeString((contact.role as string) ?? "", MAX_LEN.role) || null,
    description: sanitizeString((contact.description as string) ?? "", MAX_LEN.description) || null,
    tags,
    avatar: sanitizeString((contact.avatar as string) ?? "", MAX_LEN.avatar) || null,
    folder_id: contact.folderId ?? null,
    owner_id: isShared ? null : userId,
    company_id: companyId,
    is_shared: isShared,
    address: sanitizeString((contact.address as string) ?? "", MAX_LEN.address) || null,
    city: sanitizeString((contact.city as string) ?? "", MAX_LEN.city) || null,
    state: sanitizeString((contact.state as string) ?? "", MAX_LEN.state) || null,
    zip_code: sanitizeString((contact.zipCode as string) ?? "", MAX_LEN.zip_code) || null,
    country: sanitizeString((contact.country as string) ?? "", MAX_LEN.country) || null,
    latitude: typeof contact.latitude === "number" && Number.isFinite(contact.latitude) ? contact.latitude : null,
    longitude: typeof contact.longitude === "number" && Number.isFinite(contact.longitude) ? contact.longitude : null,
    business_name: sanitizeString((contact.businessName as string) ?? "", MAX_LEN.business_name) || null,
    business_type: sanitizeString((contact.businessType as string) ?? "", MAX_LEN.business_type) || null,
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  console.log("[bulk-insert-contacts] Request received", {
    method: req.method,
    hasAuth: !!req.headers.get("Authorization"),
  });

  try {
    // Parse request body first (JWT may be in body when gateway has verify_jwt=false)
    let body: { jwt?: string; contacts?: unknown[]; isShared?: boolean };
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

    const authHeader = req.headers.get("Authorization");
    const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : null;
    const tokenFromBody = typeof body.jwt === "string" ? body.jwt.trim() : null;
    const token = tokenFromHeader || tokenFromBody;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing authorization (send Authorization: Bearer <token> or body.jwt)" }),
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

    // Map and sanitize contacts to database format (validation + XSS prevention)
    const contactsToInsert = contacts.map((contact: Record<string, unknown>) => {
      const contactIsShared = contact.isShared !== undefined ? Boolean(contact.isShared) : isShared;
      return sanitizeContactForInsert(contact, contactIsShared, user.id, companyId);
    });

    // Check for existing contacts to find duplicates
    // Optimized: Only fetch contacts that might be duplicates (have email or phone)
    // Use pagination to handle large contact lists
    let existingContacts: any[] = [];
    
    // Extract all emails and phones from contacts to insert (normalized)
    const emailsToCheck = contactsToInsert
      .map(c => normalizeEmail(c.email))
      .filter(e => e.length > 0);
    const phonesToCheck = contactsToInsert
      .map(c => normalizePhone(c.phone))
      .filter(p => p.length > 0);

    // Only check for duplicates if we have emails or phones to check.
    // Scope: user's own contacts or same company only (no global is_shared to avoid large fetches).
    if (emailsToCheck.length > 0 || phonesToCheck.length > 0) {
      const accessConditions: string[] = [];
      if (user.id) {
        accessConditions.push(`owner_id.eq.${user.id}`);
      }
      if (companyId) {
        accessConditions.push(`company_id.eq.${companyId}`);
      }
      if (accessConditions.length === 0) {
        accessConditions.push(`owner_id.eq.${user.id}`);
      }

      // Fetch in pages to avoid hitting 1000 row limit
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;
      const allContacts: any[] = [];

      while (hasMore) {
        let query = supabase
          .from("contacts")
          .select("id, email, phone, tags, description, name, company, role, avatar, folder_id, address, city, state, zip_code, country, latitude, longitude, business_name, business_type")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (accessConditions.length > 0) {
          query = query.or(accessConditions.join(','));
        }

        const { data: pageContacts, error: fetchError } = await query;

        if (fetchError) {
          console.error(`[bulk-insert-contacts] Error fetching existing contacts (page ${page}):`, fetchError);
          console.warn("[bulk-insert-contacts] Stopping duplicate check due to error, using contacts found so far");
          break;
        }

        if (!pageContacts || pageContacts.length === 0) {
          hasMore = false;
        } else {
          const withEmailOrPhone = pageContacts.filter((c: { email?: string | null; phone?: string | null }) => c.email != null || c.phone != null);
          allContacts.push(...withEmailOrPhone);
          // If we got fewer than pageSize, we've reached the end
          hasMore = pageContacts.length === pageSize;
          page++;
          
          // Safety limit: don't check more than 5000 contacts to avoid timeout
          if (allContacts.length >= 5000) {
            console.warn(`[bulk-insert-contacts] Reached safety limit of 5000 contacts for duplicate check`);
            break;
          }
        }
      }
      
      // Filter to only contacts that match by normalized email or phone
      existingContacts = allContacts.filter(existing => {
        return contactsToInsert.some(newContact => areDuplicates(newContact, existing));
      });
      
      console.log(`[bulk-insert-contacts] Found ${existingContacts.length} existing duplicate contacts out of ${allContacts.length} total contacts checked`);
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
      console.error("[bulk-insert-contacts] All operations failed:", errors);
      return new Response(
        JSON.stringify({ error: "Failed to insert or merge contacts. Please try again or contact support." }),
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
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[bulk-insert-contacts] Unexpected error:", error);
    if (stack) console.error("[bulk-insert-contacts] Error stack:", stack);
    return new Response(
      JSON.stringify({ error: "An error occurred while processing your request" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

