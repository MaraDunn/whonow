import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Contact } from "@/types/contact";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { normalizeEmail, normalizePhone, findDuplicateContacts } from "@/utils/duplicateDetection";

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
};

interface ContactWithMeta extends Contact {
  isShared?: boolean;
  ownerId?: string;
  lastContactedAt?: string;
  isClient?: boolean;
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

export const useContacts = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  // Fetch total count of active contacts (not limited by 1000 row default)
  // Exclude "my-profile" contacts to match the contacts array filtering
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["contacts", "count", user?.id],
    queryFn: async () => {
      // Fetch data and filter in JavaScript to avoid PostgREST syntax issues
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .is("deleted_at", null);

      if (error) throw error;
      // Filter out contacts with "my-profile" tag and count
      return (data as DbContact[])
        .filter((contact) => !contact.tags?.includes("my-profile"))
        .length;
    },
    enabled: !!user,
  });

  // Fetch active contacts (not deleted)
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Filter out contacts with "my-profile" tag (profile contact cards)
      return (data as DbContact[])
        .map(mapDbToContact)
        .filter((contact) => !contact.tags?.includes("my-profile"));
    },
    enabled: !!user,
  });

  // Fetch trashed contacts
  const { data: trashedContacts = [], isLoading: trashLoading } = useQuery({
    queryKey: ["contacts", "trash", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

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

      console.log("[bulkDeleteContacts] Attempting to delete", validIds.length, "contacts");

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
          console.log(`[bulkDeleteContacts] Batch ${Math.floor(i / batchSize) + 1}: ${data?.length || 0} contacts deleted`);
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
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });
    },
    onError: (error) => {
      toast.error("Failed to update contact: " + error.message);
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(variables.isClient ? "Marked as client" : "Removed from clients");
    },
    onError: (error) => {
      toast.error("Failed to update contact: " + error.message);
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
    isLoading,
    trashLoading,
    addContact: addContact.mutate,
    updateContact: updateContact.mutate,
    deleteContact: deleteContact.mutate,
    bulkDeleteContacts: bulkDeleteContacts.mutate,
    restoreContact: restoreContact.mutate,
    permanentlyDeleteContact: permanentlyDeleteContact.mutate,
    emptyTrash: emptyTrash.mutate,
    updateLastContacted: updateLastContacted.mutate,
    toggleClientStatus: toggleClientStatus.mutate,
    findDuplicatesForContact,
    mergeContact: mergeContact.mutate,
    isMerging: mergeContact.isPending,
  };
};
