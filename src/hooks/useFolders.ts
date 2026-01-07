import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Folder, DirectoryType } from "@/types/folder";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useMemo } from "react";

type DbFolder = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  company_id: string | null;
  directory_type: string;
  is_organization_folder: boolean | null;
};

const mapDbToFolder = (db: DbFolder): Folder => ({
  id: db.id,
  name: db.name,
  color: db.color || "#6366f1",
  createdAt: db.created_at,
  directoryType: (db.directory_type as DirectoryType) || "contacts",
  isOrganizationFolder: db.is_organization_folder || false,
  ownerId: db.owner_id,
  companyId: db.company_id,
});

const mapFolderToDb = (
  folder: Omit<Folder, "id" | "createdAt">,
  userId?: string,
  companyId?: string
) => ({
  name: folder.name,
  color: folder.color || "#6366f1",
  owner_id: folder.isOrganizationFolder ? null : (userId || null),
  company_id: companyId || null,
  directory_type: folder.directoryType || "contacts",
  is_organization_folder: folder.isOrganizationFolder || false,
});

export const useFolders = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  const { data: allFolders = [], isLoading } = useQuery({
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

  // Filter folders by directory type and organization status
  const folders = useMemo(
    () => allFolders.filter((f) => f.directoryType === "contacts" && !f.isOrganizationFolder),
    [allFolders]
  );

  const organizationFolders = useMemo(
    () => allFolders.filter((f) => f.directoryType === "contacts" && f.isOrganizationFolder),
    [allFolders]
  );

  const clientFolders = useMemo(
    () => allFolders.filter((f) => f.directoryType === "clients" && !f.isOrganizationFolder),
    [allFolders]
  );

  const organizationClientFolders = useMemo(
    () => allFolders.filter((f) => f.directoryType === "clients" && f.isOrganizationFolder),
    [allFolders]
  );

  const teamFolders = useMemo(
    () => allFolders.filter((f) => f.directoryType === "team" && !f.isOrganizationFolder),
    [allFolders]
  );

  const organizationTeamFolders = useMemo(
    () => allFolders.filter((f) => f.directoryType === "team" && f.isOrganizationFolder),
    [allFolders]
  );

  // Check if a folder name already exists in a specific directory
  const isFolderNameDuplicate = (
    name: string,
    directoryType: DirectoryType,
    excludeId?: string
  ): boolean => {
    const normalizedName = name.trim().toLowerCase();
    return allFolders.some(
      (f) =>
        f.directoryType === directoryType &&
        f.name.trim().toLowerCase() === normalizedName &&
        f.id !== excludeId
    );
  };

  const addFolder = useMutation({
    mutationFn: async (folder: Omit<Folder, "id" | "createdAt">) => {
      // Check for duplicate name
      if (isFolderNameDuplicate(folder.name, folder.directoryType)) {
        throw new Error(`A folder named "${folder.name}" already exists in this directory`);
      }

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
      toast.error(error.message);
    },
  });

  const updateFolder = useMutation({
    mutationFn: async ({ id, ...folder }: Folder) => {
      // Check for duplicate name (excluding current folder)
      if (isFolderNameDuplicate(folder.name, folder.directoryType, id)) {
        throw new Error(`A folder named "${folder.name}" already exists in this directory`);
      }

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
      toast.error(error.message);
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
    organizationFolders,
    clientFolders,
    organizationClientFolders,
    teamFolders,
    organizationTeamFolders,
    allFolders,
    isLoading,
    addFolder: addFolder.mutate,
    updateFolder: updateFolder.mutate,
    deleteFolder: deleteFolder.mutate,
    isFolderNameDuplicate,
  };
};
