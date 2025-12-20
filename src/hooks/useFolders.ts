import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Folder } from "@/types/folder";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

type DbFolder = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  company_id: string | null;
};

const mapDbToFolder = (db: DbFolder): Folder => ({
  id: db.id,
  name: db.name,
  color: db.color || "#6366f1",
  createdAt: db.created_at,
});

const mapFolderToDb = (
  folder: Omit<Folder, "id" | "createdAt">,
  userId?: string,
  companyId?: string
) => ({
  name: folder.name,
  color: folder.color || "#6366f1",
  owner_id: userId || null,
  company_id: companyId || null,
});

export const useFolders = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data as DbFolder[]).map(mapDbToFolder);
    },
    enabled: !!user,
  });

  const addFolder = useMutation({
    mutationFn: async (folder: Omit<Folder, "id" | "createdAt">) => {
      const { data, error } = await supabase
        .from("folders")
        .insert(mapFolderToDb(folder, user?.id, profile?.companyId))
        .select()
        .single();

      if (error) throw error;
      return mapDbToFolder(data as DbFolder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder created");
    },
    onError: (error) => {
      toast.error("Failed to create folder: " + error.message);
    },
  });

  const updateFolder = useMutation({
    mutationFn: async ({ id, ...folder }: Folder) => {
      const { data, error } = await supabase
        .from("folders")
        .update({
          name: folder.name,
          color: folder.color || "#6366f1",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapDbToFolder(data as DbFolder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder updated");
    },
    onError: (error) => {
      toast.error("Failed to update folder: " + error.message);
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Folder deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete folder: " + error.message);
    },
  });

  return {
    folders,
    isLoading,
    addFolder: addFolder.mutate,
    updateFolder: updateFolder.mutate,
    deleteFolder: deleteFolder.mutate,
  };
};
