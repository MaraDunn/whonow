import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Contact } from "@/types/contact";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

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
});

export const useContacts = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

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
      return (data as DbContact[]).map(mapDbToContact);
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
      const { data, error } = await supabase
        .from("contacts")
        .insert(mapContactToDb(contactData, user?.id, profile?.companyId, isShared))
        .select()
        .single();

      if (error) throw error;
      return mapDbToContact(data as DbContact);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact added successfully");
    },
    onError: (error) => {
      toast.error("Failed to add contact: " + error.message);
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, isShared, ...contact }: Contact & { isShared?: boolean }) => {
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
      toast.success("Contact updated successfully");
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

  return {
    contacts,
    trashedContacts,
    isLoading,
    trashLoading,
    addContact: addContact.mutate,
    updateContact: updateContact.mutate,
    deleteContact: deleteContact.mutate,
    restoreContact: restoreContact.mutate,
    permanentlyDeleteContact: permanentlyDeleteContact.mutate,
    emptyTrash: emptyTrash.mutate,
    updateLastContacted: updateLastContacted.mutate,
    toggleClientStatus: toggleClientStatus.mutate,
  };
};
