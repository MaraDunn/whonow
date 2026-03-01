import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Contact, ContactOwnershipFilter } from "@/types/contact";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { normalizeEmail, normalizePhone, findDuplicateContacts } from "@/utils/duplicateDetection";
import { devLog } from "@/lib/devLog";
import type { ActivityType } from "@/hooks/useActivityLog";

/** Fire-and-forget activity log insert. Never throws — errors are silently ignored so they don't block UI. */
async function logActivity(
  contactId: string,
  activityType: ActivityType,
  metadata?: Record<string, unknown>
) {
  try {
    await supabase.from("activity_log").insert({
      contact_id: contactId,
      activity_type: activityType,
      metadata: metadata ?? null,
    });
  } catch {
    // Silently ignore — activity logging must never break primary mutations
  }
}

/** First page size: smaller so first paint is fast. */
const CONTACTS_INITIAL_PAGE_SIZE = 24;
/** Page size for "load more" (and used to detect has-next). */
const CONTACTS_PAGE_SIZE = 50;
/** Max trashed contacts loaded at once. For very large trash, consider cursor-based pagination. */
const TRASH_PAGE_SIZE = 1000;
const CONTACTS_STALE_TIME_MS = 120_000;

type DbContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  description: string | null;
  tags: string[] | null;
  avatar: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  owner_id: string | null;
  company_id: string | null;
  is_shared: boolean | null;
  last_contacted_at: string | null;
  is_client: boolean | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  business_name: string | null;
  business_type: string | null;
  follow_up_date: string | null;
  reminder_interval_override: number | null;
  preferred_contact_interval_days: number | null;
  client_weight: number | null;
};

interface ContactWithMeta extends Contact {
  isShared?: boolean;
  ownerId?: string;
  lastContactedAt?: string;
  isClient?: boolean;
  followUpDate?: string;
  reminderIntervalOverride?: number;
  preferredContactIntervalDays?: number;
  clientWeight?: number;
}

const mapDbToContact = (db: DbContact): ContactWithMeta => ({
  id: db.id,
  name: db.name,
  email: db.email || "",
  phone: db.phone || "",
  company: db.company || "",
  role: db.role || "",
  description: db.description || "",
  tags: db.tags || [],
  avatar: db.avatar || undefined,
  folderId: db.folder_id || undefined,
  isShared: db.is_shared || false,
  ownerId: db.owner_id || undefined,
  lastContactedAt: db.last_contacted_at || undefined,
  isClient: db.is_client || false,
  companyId: db.company_id || undefined,
  createdAt: db.created_at || undefined, // Include timestamp for time-based searches
  address: db.address || undefined,
  city: db.city || undefined,
  state: db.state || undefined,
  zipCode: db.zip_code || undefined,
  country: db.country || undefined,
  latitude: db.latitude || undefined,
  longitude: db.longitude || undefined,
  businessName: db.business_name || undefined,
  businessType: db.business_type || undefined,
  followUpDate: db.follow_up_date || undefined,
  reminderIntervalOverride: db.reminder_interval_override ?? undefined,
  preferredContactIntervalDays: db.preferred_contact_interval_days ?? undefined,
  clientWeight: db.client_weight ?? undefined,
});

const mapContactToDb = (
  contact: Omit<Contact, "id">,
  userId?: string,
  companyId?: string,
  isShared?: boolean
) => ({
  name: contact.name,
  email: contact.email || null,
  phone: contact.phone || null,
  company: contact.company || null,
  role: contact.role || null,
  description: contact.description || null,
  tags: contact.tags || [],
  avatar: contact.avatar || null,
  folder_id: contact.folderId || null,
  owner_id: isShared ? null : userId,
  company_id: companyId || null,
  is_shared: isShared || false,
  address: contact.address || null,
  city: contact.city || null,
  state: contact.state || null,
  zip_code: contact.zipCode || null,
  country: contact.country || null,
  latitude: contact.latitude || null,
  longitude: contact.longitude || null,
  business_name: contact.businessName || null,
  business_type: contact.businessType || null,
});

export type UseContactsListOptions = {
  folderId?: string | null;
  showClientDirectory?: boolean;
  ownershipFilter?: ContactOwnershipFilter;
};

export const useContacts = (options?: UseContactsListOptions) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  const folderId = options?.folderId ?? null;
  const showClientDirectory = options?.showClientDirectory ?? false;
  const ownershipFilter = options?.ownershipFilter ?? "all";

  // Incremented when contacts are marked as contacted; used to re-run smart search
  const [contactMarkedVersion, setContactMarkedVersion] = useState(0);

  // Fetch total count of active contacts (not limited by 1000 row default)
  // Exclude "my-profile" contacts to match the contacts array filtering
  // Uses a database function to ensure accurate count regardless of PostgREST limits
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["contacts", "count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Use database function to count contacts server-side
      // This bypasses PostgREST's 1000 row limit and respects RLS policies
      const { data, error } = await supabase.rpc("count_active_contacts", {
        _user_id: user.id,
      });

      if (error) {
        console.error("Error counting contacts:", error);
        throw error;
      }

      return data || 0;
    },
    enabled: !!user,
  });

  // Fetch accurate counts using database functions (not limited by 1000 row default)
  const { data: personalContactsCount = 0 } = useQuery({
    queryKey: ["contacts", "personal-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase.rpc("count_personal_contacts", {
        _user_id: user.id,
      });
      if (error) {
        console.error("Error counting personal contacts:", error);
        return 0; // Fallback to 0 if function doesn't exist yet
      }
      return data || 0;
    },
    enabled: !!user,
  });

  const { data: sharedContactsCount = 0 } = useQuery({
    queryKey: ["contacts", "shared-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase.rpc("count_shared_contacts", {
        _user_id: user.id,
      });
      if (error) {
        console.error("Error counting shared contacts:", error);
        return 0; // Fallback to 0 if function doesn't exist yet
      }
      return data || 0;
    },
    enabled: !!user && !!profile?.companyId,
  });

  const { data: clientCount = 0 } = useQuery({
    queryKey: ["contacts", "client-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase.rpc("count_client_contacts", {
        _user_id: user.id,
      });
      if (error) {
        console.error("Error counting client contacts:", error);
        return 0; // Fallback to 0 if function doesn't exist yet
      }
      return data || 0;
    },
    enabled: !!user,
  });

  // Cursor for list_contacts_slim RPC keyset pagination.
  type ListCursor = { created_at: string; id: string } | null;

  // Fetch active contacts via list_contacts_slim (slim payload = faster load more).
  const {
    data: listData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isError: isListError,
    refetch: refetchList,
  } = useInfiniteQuery({
    queryKey: ["contacts", "list", user?.id, folderId, showClientDirectory, ownershipFilter],
    queryFn: async ({ pageParam }: { pageParam: ListCursor }) => {
      if (!user?.id) return [];
      const limit = pageParam === null ? CONTACTS_INITIAL_PAGE_SIZE : CONTACTS_PAGE_SIZE;
      const { data, error } = await supabase.rpc("list_contacts_slim", {
        _user_id: user.id,
        _cursor_created_at: pageParam?.created_at ?? null,
        _cursor_id: pageParam?.id ?? null,
        _limit: limit,
        _folder_id: folderId ?? null,
        _client_only: showClientDirectory ?? false,
        _ownership_filter: ownershipFilter,
      });
      if (error) throw error;
      const out: ContactWithMeta[] = [];
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const contact = mapDbToContact({ ...row } as DbContact);
        if (!contact.tags?.includes("my-profile")) out.push(contact);
      }
      return out;
    },
    initialPageParam: null as ListCursor,
    getNextPageParam: (lastPage, allPages): ListCursor => {
      const isFirstPage = allPages.length === 1;
      const pageSize = isFirstPage ? CONTACTS_INITIAL_PAGE_SIZE : CONTACTS_PAGE_SIZE;
      if (lastPage.length < pageSize) return undefined;
      const last = lastPage[lastPage.length - 1];
      const created_at = last.createdAt;
      if (!created_at || !last.id) return undefined;
      return { created_at, id: last.id };
    },
    enabled: !!user,
    staleTime: CONTACTS_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });

  const flatPages = (listData?.pages ?? []).flat() as ContactWithMeta[];
  const lastKnownGoodRef = useRef<ContactWithMeta[]>([]);
  if (flatPages.length > 0) lastKnownGoodRef.current = flatPages;
  // Never show fewer contacts than we've already loaded (avoids grid clearing on fetch error or race).
  const contacts: ContactWithMeta[] = useMemo(() => {
    if (flatPages.length > 0) return flatPages;
    if (lastKnownGoodRef.current.length > 0) return lastKnownGoodRef.current;
    return flatPages;
  }, [flatPages]);

  const loadMoreContacts = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  // Fetch full contact by id (for detail view when list only has slim rows).
  const getContactById = useCallback(
    async (id: string): Promise<ContactWithMeta | null> => {
      const { data, error } = await supabase.from("contacts").select("*").eq("id", id).single();
      if (error || !data) return null;
      return mapDbToContact(data as DbContact);
    },
    []
  );

  // Prefetch the next page as soon as we have data and there is more to load,
  // so "Load more" feels instant (data is often already in cache).
  useEffect(() => {
    const pageCount = listData?.pages?.length ?? 0;
    if (pageCount >= 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [listData?.pages?.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (isListError) {
      toast.error("Failed to load contacts. Try refreshing.");
    }
  }, [isListError]);

  // Fetch count of trashed contacts (accurate count, not limited by 1000)
  const { data: trashCount = 0 } = useQuery({
    queryKey: ["contacts", "trash-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      const { data, error } = await supabase.rpc("count_trashed_contacts", {
        _user_id: user.id,
      });

      if (error) {
        console.error("Error counting trashed contacts:", error);
        throw error;
      }

      return data || 0;
    },
    enabled: !!user,
  });

  // Fetch trashed contacts (for display; count from trashCount is accurate)
  const { data: trashedContacts = [], isLoading: trashLoading } = useQuery({
    queryKey: ["contacts", "trash", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(TRASH_PAGE_SIZE);

      if (error) throw error;
      return (data as DbContact[]).map(mapDbToContact);
    },
    enabled: !!user,
  });

  const addContact = useMutation({
    mutationFn: async (contact: Omit<Contact, "id"> & { isShared?: boolean }) => {
      const { isShared, ...contactData } = contact;
      
      // Business info is already set in the form (user verified it)
      // Just use what's provided
      const { data, error } = await supabase
        .from("contacts")
        .insert(mapContactToDb(contactData, user?.id, profile?.companyId, isShared))
        .select()
        .single();

      if (error) throw error;
      
      const savedContact = mapDbToContact(data as DbContact);
      
      return savedContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Merge contact - updates existing contact with new data
  const mergeContact = useMutation({
    mutationFn: async ({ 
      primaryContact, 
      newContactData 
    }: { 
      primaryContact: Contact; 
      newContactData: Omit<Contact, "id"> 
    }) => {
      const { mergeContacts } = await import("@/utils/contactMerge");
      const merged = mergeContacts(primaryContact, newContactData);
      
      // Update the primary contact with merged data
      const updateData: Record<string, unknown> = {
        name: merged.name,
        email: merged.email || null,
        phone: merged.phone || null,
        company: merged.company || null,
        role: merged.role || null,
        description: merged.description || null,
        tags: merged.tags || [],
        avatar: merged.avatar || null,
        folder_id: merged.folderId || null,
        address: merged.address || null,
        city: merged.city || null,
        state: merged.state || null,
        zip_code: merged.zipCode || null,
        country: merged.country || null,
        latitude: merged.latitude || null,
        longitude: merged.longitude || null,
        business_name: merged.businessName || null,
        business_type: merged.businessType || null,
      };

      const { data, error } = await supabase
        .from("contacts")
        .update(updateData)
        .eq("id", merged.id)
        .select()
        .single();

      if (error) throw error;
      
      return mapDbToContact(data as DbContact);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });
      toast.success("Contact merged successfully");
    },
    onError: (error) => {
      toast.error("Failed to merge contact: " + error.message);
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, isShared, ...contact }: Contact & { isShared?: boolean }) => {
      // Business info is already set in the form (user verified it)
      // Just use what's provided
      const updateData: Record<string, unknown> = {
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        company: contact.company || null,
        role: contact.role || null,
        description: contact.description || null,
        tags: contact.tags || [],
        avatar: contact.avatar || null,
        folder_id: contact.folderId || null,
        address: contact.address || null,
        city: contact.city || null,
        state: contact.state || null,
        zip_code: contact.zipCode || null,
        country: contact.country || null,
        latitude: contact.latitude || null,
        longitude: contact.longitude || null,
        business_name: contact.businessName || null,
        business_type: contact.businessType || null,
        // preferred_contact_interval_days and client_weight are written via RPC
        // below to avoid PostgREST schema cache issues with newly added columns.
      };
      
      // Only update sharing status if provided
      if (isShared !== undefined) {
        updateData.is_shared = isShared;
        updateData.owner_id = isShared ? null : user?.id;
      }

      const { data, error } = await supabase
        .from("contacts")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Write the two new health columns via RPC which bypasses schema cache
      if (contact.isClient) {
        const { error: rpcError } = await supabase.rpc("update_client_health_fields", {
          _contact_id: id,
          _preferred_contact_interval_days: contact.preferredContactIntervalDays ?? 30,
          _client_weight: contact.clientWeight ?? 1.0,
        });
        if (rpcError) throw rpcError;
      }
      
      return mapDbToContact(data as DbContact);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });
    },
    onError: (error) => {
      toast.error("Failed to update contact: " + error.message);
    },
  });

  // Soft delete - move to trash
  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contacts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact moved to trash");
    },
    onError: (error) => {
      toast.error("Failed to delete contact: " + error.message);
    },
  });

  // Bulk delete - move multiple contacts to trash
  const bulkDeleteContacts = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids || ids.length === 0) {
        throw new Error("No contacts selected");
      }

      // Filter out any invalid IDs
      const validIds = ids.filter(id => id && typeof id === 'string' && id.length > 0);
      if (validIds.length === 0) {
        throw new Error("No valid contact IDs provided");
      }

      devLog("[bulkDeleteContacts] Attempting to delete", validIds.length, "contacts");

      // Delete in batches to avoid potential issues with large arrays or RLS limits
      const batchSize = 50;
      let successCount = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < validIds.length; i += batchSize) {
        const batch = validIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("contacts")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", batch)
          .select("id"); // Select to get count of updated rows
        
        if (error) {
          console.error(`[bulkDeleteContacts] Batch ${Math.floor(i / batchSize) + 1} error:`, error);
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          successCount += data?.length || 0;
          devLog(`[bulkDeleteContacts] Batch ${Math.floor(i / batchSize) + 1}: ${data?.length || 0} contacts deleted`);
        }
      }

      if (successCount === 0 && errors.length > 0) {
        throw new Error(`Failed to delete contacts: ${errors.join("; ")}`);
      }

      if (errors.length > 0) {
        // Some succeeded, some failed
        console.warn(`[bulkDeleteContacts] Partial success: ${successCount} deleted, ${errors.length} batches failed`);
      }

      return { deleted: successCount, total: validIds.length };
    },
    onSuccess: (result, ids) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (result.deleted === result.total) {
        toast.success(`${result.deleted} contact${result.deleted !== 1 ? "s" : ""} moved to trash`);
      } else {
        toast.warning(`${result.deleted} of ${result.total} contact${result.total !== 1 ? "s" : ""} moved to trash`);
      }
    },
    onError: (error) => {
      console.error("[bulkDeleteContacts] Error:", error);
      toast.error("Failed to delete contacts: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  // Bulk move to folder - move multiple contacts to a folder
  const bulkMoveToFolder = useMutation({
    mutationFn: async ({ ids, folderId, folderName }: { ids: string[]; folderId: string | null; folderName?: string }) => {
      if (!ids || ids.length === 0) {
        throw new Error("No contacts selected");
      }

      // Filter out any invalid IDs
      const validIds = ids.filter(id => id && typeof id === 'string' && id.length > 0);
      if (validIds.length === 0) {
        throw new Error("No valid contact IDs provided");
      }

      devLog("[bulkMoveToFolder] Attempting to move", validIds.length, "contacts to folder:", folderId);

      // Update in batches to avoid potential issues with large arrays or RLS limits
      const batchSize = 50;
      let successCount = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < validIds.length; i += batchSize) {
        const batch = validIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("contacts")
          .update({ folder_id: folderId })
          .in("id", batch)
          .select("id"); // Select to get count of updated rows
        
        if (error) {
          console.error(`[bulkMoveToFolder] Batch ${Math.floor(i / batchSize) + 1} error:`, error);
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          successCount += data?.length || 0;
          devLog(`[bulkMoveToFolder] Batch ${Math.floor(i / batchSize) + 1}: ${data?.length || 0} contacts moved`);
        }
      }

      if (successCount === 0 && errors.length > 0) {
        throw new Error(`Failed to move contacts: ${errors.join("; ")}`);
      }

      if (errors.length > 0) {
        // Some succeeded, some failed
        console.warn(`[bulkMoveToFolder] Partial success: ${successCount} moved, ${errors.length} batches failed`);
      }

      return { moved: successCount, total: validIds.length, folderId, folderName: folderName || (folderId ? "folder" : "No folder") };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });
      if (result.moved === result.total) {
        toast.success(`${result.moved} contact${result.moved !== 1 ? "s" : ""} moved to ${result.folderName}`);
      } else {
        toast.warning(`${result.moved} of ${result.total} contact${result.total !== 1 ? "s" : ""} moved to ${result.folderName}`);
      }
    },
    onError: (error) => {
      console.error("[bulkMoveToFolder] Error:", error);
      toast.error("Failed to move contacts: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  // Restore from trash
  const restoreContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contacts")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact restored");
    },
    onError: (error) => {
      toast.error("Failed to restore contact: " + error.message);
    },
  });

  // Bulk restore from trash - restore multiple contacts
  const bulkRestoreContacts = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids || ids.length === 0) {
        throw new Error("No contacts selected");
      }

      // Filter out any invalid IDs
      const validIds = ids.filter(id => id && typeof id === 'string' && id.length > 0);
      if (validIds.length === 0) {
        throw new Error("No valid contact IDs provided");
      }

      devLog("[bulkRestoreContacts] Attempting to restore", validIds.length, "contacts");

      // Restore in batches to avoid potential issues with large arrays or RLS limits
      const batchSize = 50;
      let successCount = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < validIds.length; i += batchSize) {
        const batch = validIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("contacts")
          .update({ deleted_at: null })
          .in("id", batch)
          .select("id"); // Select to get count of updated rows
        
        if (error) {
          console.error(`[bulkRestoreContacts] Batch ${Math.floor(i / batchSize) + 1} error:`, error);
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          successCount += data?.length || 0;
          devLog(`[bulkRestoreContacts] Batch ${Math.floor(i / batchSize) + 1}: ${data?.length || 0} contacts restored`);
        }
      }

      if (successCount === 0 && errors.length > 0) {
        throw new Error(`Failed to restore contacts: ${errors.join("; ")}`);
      }

      if (errors.length > 0) {
        // Some succeeded, some failed
        console.warn(`[bulkRestoreContacts] Partial success: ${successCount} restored, ${errors.length} batches failed`);
      }

      return { restored: successCount, total: validIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (result.restored === result.total) {
        toast.success(`${result.restored} contact${result.restored !== 1 ? "s" : ""} restored`);
      } else {
        toast.warning(`${result.restored} of ${result.total} contact${result.total !== 1 ? "s" : ""} restored`);
      }
    },
    onError: (error) => {
      console.error("[bulkRestoreContacts] Error:", error);
      toast.error("Failed to restore contacts: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  // Permanently delete
  const permanentlyDeleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact permanently deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete contact: " + error.message);
    },
  });

  // Empty trash - delete all trashed contacts
  const emptyTrash = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .not("deleted_at", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Trash emptied");
    },
    onError: (error) => {
      toast.error("Failed to empty trash: " + error.message);
    },
  });

  // Update last contacted timestamp
  const updateLastContacted = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contacts")
        .update({ last_contacted_at: new Date().toISOString(), follow_up_date: null })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["contacts"] });
      await queryClient.cancelQueries({ queryKey: ["team-directory-contacts"] });

      const previousContacts = queryClient.getQueriesData({ queryKey: ["contacts"] });
      const previousTeamContacts = queryClient.getQueriesData({ queryKey: ["team-directory-contacts"] });

      const now = new Date().toISOString();

      const updateContact = (c: Contact) =>
        c?.id === id ? { ...c, lastContactedAt: now, followUpDate: null } : c;

      const applyUpdate = (old: unknown) => {
        if (!old) return old;
        // Infinite query shape: { pages: ContactWithMeta[][], pageParams: unknown[] }
        if (typeof old === "object" && "pages" in (old as object) && Array.isArray((old as { pages: unknown[] }).pages)) {
          const paged = old as { pages: Contact[][]; pageParams: unknown[] };
          return {
            ...paged,
            pages: paged.pages.map((page) =>
              Array.isArray(page) ? page.map(updateContact) : page
            ),
          };
        }
        // Flat array shape
        if (Array.isArray(old)) {
          return old.map(updateContact);
        }
        return old;
      };

      queryClient.setQueriesData({ queryKey: ["contacts"] }, applyUpdate);
      queryClient.setQueriesData({ queryKey: ["team-directory-contacts"] }, applyUpdate);

      return { previousContacts, previousTeamContacts };
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });
      setContactMarkedVersion((v) => v + 1);
      logActivity(id, "contacted", { date: new Date().toISOString() });
    },
    onError: (error, _id, context) => {
      if (context?.previousContacts) {
        context.previousContacts.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousTeamContacts) {
        context.previousTeamContacts.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error("Failed to update contact: " + error.message);
    },
  });

  // Bulk update last contacted timestamp - mark multiple contacts as contacted
  const bulkUpdateLastContacted = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids || ids.length === 0) {
        throw new Error("No contacts selected");
      }

      // Filter out any invalid IDs
      const validIds = ids.filter(id => id && typeof id === 'string' && id.length > 0);
      if (validIds.length === 0) {
        throw new Error("No valid contact IDs provided");
      }

      devLog("[bulkUpdateLastContacted] Attempting to mark", validIds.length, "contacts as contacted");

      const timestamp = new Date().toISOString();

      // Update in batches to avoid potential issues with large arrays or RLS limits
      const batchSize = 50;
      let successCount = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < validIds.length; i += batchSize) {
        const batch = validIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("contacts")
          .update({ last_contacted_at: timestamp })
          .in("id", batch)
          .select("id"); // Select to get count of updated rows
        
        if (error) {
          console.error(`[bulkUpdateLastContacted] Batch ${Math.floor(i / batchSize) + 1} error:`, error);
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          successCount += data?.length || 0;
          devLog(`[bulkUpdateLastContacted] Batch ${Math.floor(i / batchSize) + 1}: ${data?.length || 0} contacts updated`);
        }
      }

      if (successCount === 0 && errors.length > 0) {
        throw new Error(`Failed to update contacts: ${errors.join("; ")}`);
      }

      if (errors.length > 0) {
        // Some succeeded, some failed
        console.warn(`[bulkUpdateLastContacted] Partial success: ${successCount} updated, ${errors.length} batches failed`);
      }

      return { updated: successCount, total: validIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });
      setContactMarkedVersion((v) => v + 1);
      if (result.updated === result.total) {
        toast.success(`${result.updated} contact${result.updated !== 1 ? "s" : ""} marked as contacted`);
      } else {
        toast.warning(`${result.updated} of ${result.total} contact${result.total !== 1 ? "s" : ""} marked as contacted`);
      }
    },
    onError: (error) => {
      console.error("[bulkUpdateLastContacted] Error:", error);
      toast.error("Failed to update contacts: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  // Toggle client status
  const toggleClientStatus = useMutation({
    mutationFn: async ({ id, isClient }: { id: string; isClient: boolean }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ is_client: isClient })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, isClient }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["contacts"] });

      // Snapshot the previous value
      const previousContacts = queryClient.getQueriesData({ queryKey: ["contacts"] });

      // Optimistically update the contact in all contact queries
      queryClient.setQueriesData<{ pages?: Array<{ data?: Contact[] }> } | Contact[]>(
        { queryKey: ["contacts"] },
        (old) => {
          if (!old) return old;
          
          // Handle infinite query structure (pages array)
          if (old && typeof old === 'object' && 'pages' in old && Array.isArray(old.pages)) {
            return {
              ...old,
              pages: old.pages.map((page) => {
                if (!page || !page.data || !Array.isArray(page.data)) {
                  return page;
                }
                return {
                  ...page,
                  data: page.data.map((contact) =>
                    contact?.id === id ? { ...contact, isClient } : contact
                  ),
                };
              }),
            };
          }
          
          // Handle array structure (direct contacts array)
          if (Array.isArray(old)) {
            return old.map((contact) =>
              contact?.id === id ? { ...contact, isClient } : contact
            );
          }
          
          return old;
        }
      );

      return { previousContacts };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(variables.isClient ? "Marked as client" : "Removed from clients");
      logActivity(variables.id, "client_toggled", { is_client: variables.isClient });
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousContacts && Array.isArray(context.previousContacts)) {
        context.previousContacts.forEach(([queryKey, data]) => {
          if (queryKey && data !== undefined) {
            queryClient.setQueryData(queryKey, data);
          }
        });
      }
      toast.error("Failed to update contact: " + error.message);
    },
  });

  // Bulk toggle client status - mark multiple contacts as clients
  const bulkToggleClientStatus = useMutation({
    mutationFn: async ({ ids, isClient }: { ids: string[]; isClient: boolean }) => {
      if (!ids || ids.length === 0) {
        throw new Error("No contacts selected");
      }

      // Filter out any invalid IDs
      const validIds = ids.filter(id => id && typeof id === 'string' && id.length > 0);
      if (validIds.length === 0) {
        throw new Error("No valid contact IDs provided");
      }

      devLog("[bulkToggleClientStatus] Attempting to mark", validIds.length, "contacts as", isClient ? "clients" : "non-clients");

      // Update in batches to avoid potential issues with large arrays or RLS limits
      const batchSize = 50;
      let successCount = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < validIds.length; i += batchSize) {
        const batch = validIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("contacts")
          .update({ is_client: isClient })
          .in("id", batch)
          .select("id"); // Select to get count of updated rows
        
        if (error) {
          console.error(`[bulkToggleClientStatus] Batch ${Math.floor(i / batchSize) + 1} error:`, error);
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          successCount += data?.length || 0;
          devLog(`[bulkToggleClientStatus] Batch ${Math.floor(i / batchSize) + 1}: ${data?.length || 0} contacts updated`);
        }
      }

      if (successCount === 0 && errors.length > 0) {
        throw new Error(`Failed to update contacts: ${errors.join("; ")}`);
      }

      if (errors.length > 0) {
        // Some succeeded, some failed
        console.warn(`[bulkToggleClientStatus] Partial success: ${successCount} updated, ${errors.length} batches failed`);
      }

      return { updated: successCount, total: validIds.length, isClient };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (result.updated === result.total) {
        toast.success(`${result.updated} contact${result.updated !== 1 ? "s" : ""} ${result.isClient ? "marked as client" : "removed from clients"}`);
      } else {
        toast.warning(`${result.updated} of ${result.total} contact${result.total !== 1 ? "s" : ""} ${result.isClient ? "marked as client" : "removed from clients"}`);
      }
    },
    onError: (error) => {
      console.error("[bulkToggleClientStatus] Error:", error);
      toast.error("Failed to update contacts: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  // Bulk share with organization - make multiple contacts visible to all company members
  const bulkShareContacts = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids || ids.length === 0) {
        throw new Error("No contacts selected");
      }

      const validIds = ids.filter(id => id && typeof id === 'string' && id.length > 0);
      if (validIds.length === 0) {
        throw new Error("No valid contact IDs provided");
      }

      devLog("[bulkShareContacts] Attempting to share", validIds.length, "contacts with organization");

      const batchSize = 50;
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < validIds.length; i += batchSize) {
        const batch = validIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("contacts")
          .update({ is_shared: true, owner_id: null })
          .in("id", batch)
          .select("id");

        if (error) {
          console.error(`[bulkShareContacts] Batch ${Math.floor(i / batchSize) + 1} error:`, error);
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          successCount += data?.length || 0;
          devLog(`[bulkShareContacts] Batch ${Math.floor(i / batchSize) + 1}: ${data?.length || 0} contacts shared`);
        }
      }

      if (successCount === 0 && errors.length > 0) {
        throw new Error(`Failed to share contacts: ${errors.join("; ")}`);
      }

      if (errors.length > 0) {
        console.warn(`[bulkShareContacts] Partial success: ${successCount} shared, ${errors.length} batches failed`);
      }

      return { shared: successCount, total: validIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });
      if (result.shared === result.total) {
        toast.success(`${result.shared} contact${result.shared !== 1 ? "s" : ""} shared with organization`);
      } else {
        toast.warning(`${result.shared} of ${result.total} contact${result.total !== 1 ? "s" : ""} shared with organization`);
      }
    },
    onError: (error) => {
      console.error("[bulkShareContacts] Error:", error);
      toast.error("Failed to share contacts: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  /**
   * Finds duplicate contacts for a given contact
   * Only checks within user's personal contacts (owner_id = user.id)
   * Excludes deleted contacts
   */
  const findDuplicatesForContact = async (contact: Omit<Contact, "id">): Promise<Contact[]> => {
    if (!user?.id) return [];

    // Get normalized email and phone for querying
    const normalizedEmail = normalizeEmail(contact.email);
    const normalizedPhone = normalizePhone(contact.phone);

    // Build query to find potential duplicates
    // We need to check both email and phone matches
    let query = supabase
      .from("contacts")
      .select("*")
      .eq("owner_id", user.id) // Only personal contacts
      .is("deleted_at", null); // Exclude deleted

    // If we have an email, check for email matches
    // If we have a phone, check for phone matches
    // We'll need to do this in memory since Supabase doesn't support normalized matching
    const { data, error } = await query;

    if (error) {
      console.error("Error finding duplicates:", error);
      return [];
    }

    // Filter in memory using normalized comparison
    const potentialDuplicates = (data as DbContact[])
      .map(mapDbToContact)
      .filter((existing) => {
        const existingEmail = normalizeEmail(existing.email);
        const existingPhone = normalizePhone(existing.phone);

        // Email match (both must have emails)
        if (normalizedEmail && existingEmail && normalizedEmail === existingEmail) {
          return true;
        }

        // Phone match (both must have phones)
        if (normalizedPhone && existingPhone && normalizedPhone === existingPhone) {
          return true;
        }

        return false;
      });

    return potentialDuplicates;
  };

  return {
    contacts,
    totalCount,
    trashedContacts,
    trashCount,
    personalContactsCount,
    sharedContactsCount,
    clientCount,
    isLoading,
    trashLoading,
    hasMoreContacts: hasNextPage ?? false,
    loadMoreContacts,
    isLoadingMoreContacts: isFetchingNextPage,
    refetchContacts: refetchList,
    getContactById,
    addContact: addContact.mutate,
    updateContact: updateContact.mutate,
    deleteContact: deleteContact.mutate,
    bulkDeleteContacts: bulkDeleteContacts.mutate,
    bulkMoveToFolder: bulkMoveToFolder.mutate,
    restoreContact: restoreContact.mutate,
    bulkRestoreContacts: bulkRestoreContacts.mutate,
    permanentlyDeleteContact: permanentlyDeleteContact.mutate,
    emptyTrash: emptyTrash.mutate,
    updateLastContacted: updateLastContacted.mutate,
    bulkUpdateLastContacted: bulkUpdateLastContacted.mutate,
    toggleClientStatus: toggleClientStatus.mutate,
    bulkToggleClientStatus: bulkToggleClientStatus.mutate,
    bulkShareContacts: bulkShareContacts.mutate,
    findDuplicatesForContact,
    mergeContact: mergeContact.mutate,
    isMerging: mergeContact.isPending,
    contactMarkedVersion,
  };
};
