import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Contact } from "@/types/contact";
import { toast } from "sonner";

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
};

const mapDbToContact = (db: DbContact): Contact => ({
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
});

const mapContactToDb = (contact: Omit<Contact, "id">) => ({
  name: contact.name,
  email: contact.email || null,
  phone: contact.phone || null,
  company: contact.company || null,
  role: contact.role || null,
  description: contact.description || null,
  tags: contact.tags || [],
  avatar: contact.avatar || null,
  folder_id: contact.folderId || null,
});

export const useContacts = () => {
  const queryClient = useQueryClient();

  // Fetch active contacts (not deleted)
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as DbContact[]).map(mapDbToContact);
    },
  });

  // Fetch trashed contacts
  const { data: trashedContacts = [], isLoading: trashLoading } = useQuery({
    queryKey: ["contacts", "trash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      return (data as DbContact[]).map(mapDbToContact);
    },
  });

  const addContact = useMutation({
    mutationFn: async (contact: Omit<Contact, "id">) => {
      const { data, error } = await supabase
        .from("contacts")
        .insert(mapContactToDb(contact))
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
    mutationFn: async ({ id, ...contact }: Contact) => {
      const { data, error } = await supabase
        .from("contacts")
        .update(mapContactToDb(contact))
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
  };
};
