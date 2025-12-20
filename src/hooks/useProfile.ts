import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Profile, Company, AppRole } from "@/types/profile";
import { toast } from "sonner";

type DbProfile = {
  id: string;
  company_id: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  avatar_url: string | null;
  description: string | null;
  is_visible_in_directory: boolean | null;
  created_at: string;
  updated_at: string;
};

type DbCompany = {
  id: string;
  name: string;
  invite_code: string | null;
  created_at: string;
  updated_at: string;
};

const mapDbToProfile = (db: DbProfile): Profile => ({
  id: db.id,
  companyId: db.company_id || undefined,
  email: db.email || undefined,
  fullName: db.full_name || undefined,
  phone: db.phone || undefined,
  role: db.role || undefined,
  avatarUrl: db.avatar_url || undefined,
  description: db.description || undefined,
  isVisibleInDirectory: db.is_visible_in_directory ?? true,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapDbToCompany = (db: DbCompany): Company => ({
  id: db.id,
  name: db.name,
  inviteCode: db.invite_code || undefined,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

export const useProfile = (userId?: string) => {
  const queryClient = useQueryClient();

  // Fetch current user's profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapDbToProfile(data as DbProfile) : null;
    },
    enabled: !!userId,
  });

  // Fetch user's company
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["company", profile?.companyId],
    queryFn: async () => {
      if (!profile?.companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.companyId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapDbToCompany(data as DbCompany) : null;
    },
    enabled: !!profile?.companyId,
  });

  // Fetch user's roles
  const { data: roles = [] } = useQuery({
    queryKey: ["user-roles", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;
      return (data || []).map((r) => r.role as AppRole);
    },
    enabled: !!userId,
  });

  const isAdmin = roles.includes("admin");

  // Fetch company members (employee directory)
  const { data: companyMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ["company-members", profile?.companyId],
    queryFn: async () => {
      if (!profile?.companyId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("company_id", profile.companyId)
        .eq("is_visible_in_directory", true);

      if (error) throw error;
      return (data as DbProfile[]).map(mapDbToProfile);
    },
    enabled: !!profile?.companyId,
  });

  // Update profile
  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!userId) throw new Error("No user ID");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: updates.fullName,
          phone: updates.phone,
          role: updates.role,
          avatar_url: updates.avatarUrl,
          description: updates.description,
          is_visible_in_directory: updates.isVisibleInDirectory,
        })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      toast.success("Profile updated");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
    },
  });

  // Create company and set user as admin
  const createCompany = useMutation({
    mutationFn: async (companyName: string) => {
      if (!userId) throw new Error("No user ID");

      const { data, error } = await supabase.rpc("create_company", {
        p_name: companyName,
      });

      if (error) throw error;

      // Fetch newly created company
      const { data: newCompany, error: fetchError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", data)
        .single();

      if (fetchError) throw fetchError;

      return mapDbToCompany(newCompany as DbCompany);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
      toast.success("Company created");
    },
    onError: (error) => {
      toast.error("Failed to create company: " + error.message);
    },
  });

  // Join company by invite code
  const joinCompany = useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!userId) throw new Error("No user ID");

      const { data, error } = await supabase.rpc("join_company", {
        p_invite_code: inviteCode,
      });

      if (error) throw error;

      // Fetch newly joined company
      const { data: joinedCompany, error: fetchError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", data)
        .single();

      if (fetchError) throw fetchError;

      return mapDbToCompany(joinedCompany as DbCompany);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
      toast.success("Joined company");
    },
    onError: (error) => {
      toast.error("Failed to join company: " + error.message);
    },
  });

  return {
    profile,
    company,
    roles,
    isAdmin,
    companyMembers,
    isLoading: profileLoading || companyLoading || membersLoading,
    updateProfile: updateProfile.mutate,
    createCompany: createCompany.mutate,
    joinCompany: joinCompany.mutate,
    needsCompanySetup: !!profile && !profile.companyId,
  };
};
