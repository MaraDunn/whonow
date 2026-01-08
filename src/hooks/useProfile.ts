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
  has_completed_company_setup: boolean | null;
  created_at: string;
  updated_at: string;
};

type DbCompany = {
  id: string;
  name: string;
  invite_code: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
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
  hasCompletedCompanySetup: db.has_completed_company_setup ?? false,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapDbToCompany = (db: DbCompany): Company => ({
  id: db.id,
  name: db.name,
  inviteCode: db.invite_code || undefined,
  logoUrl: db.logo_url || undefined,
  faviconUrl: db.favicon_url || undefined,
  primaryColor: db.primary_color || undefined,
  secondaryColor: db.secondary_color || undefined,
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
  // For admins, show all members. For regular members, show all members in the company
  // (not just those visible in directory) so they can see the full team
  const { data: companyMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ["company-members", profile?.companyId, isAdmin],
    queryFn: async () => {
      if (!profile?.companyId) return [];
      
      // Show all company members - don't filter by visibility
      // This ensures all members can see the team directory
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("company_id", profile.companyId);

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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      // Clear subscription cache so it refreshes with company subscription
      try {
        localStorage.removeItem("whonow_subscription_cache");
        localStorage.removeItem("whonow_subscription_cache_time");
      } catch (error) {
        console.error("Failed to clear subscription cache:", error);
      }
      // Wait a moment for profile/company queries to complete, then refresh subscription
      setTimeout(() => {
        // Trigger subscription refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent("refresh-subscription"));
      }, 500);
      toast.success("Joined company");
    },
    onError: (error) => {
      toast.error("Failed to join company: " + error.message);
    },
  });

  // Skip company setup (continue as individual)
  const skipCompanySetup = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No user ID");

      const { error } = await supabase
        .from("profiles")
        .update({ has_completed_company_setup: true })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("You can join a company anytime from settings");
    },
    onError: (error) => {
      toast.error("Failed to continue: " + error.message);
    },
  });

  // Remove user from company (admin only)
  const removeUserFromCompany = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!userId) throw new Error("No user ID");

      const { data, error } = await supabase.rpc("remove_user_from_company", {
        p_user_id: targetUserId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
      toast.success("User removed from organization");
    },
    onError: (error) => {
      const errorMessage = error.message || "Failed to remove user";
      if (errorMessage.includes("cannot_remove_self")) {
        toast.error("You cannot remove yourself from the organization");
      } else if (errorMessage.includes("insufficient_privilege")) {
        toast.error("Only admins can remove users from the organization");
      } else if (errorMessage.includes("user_not_in_company")) {
        toast.error("User is not in your organization");
      } else {
        toast.error("Failed to remove user: " + errorMessage);
      }
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
    skipCompanySetup: skipCompanySetup.mutate,
    removeUserFromCompany: removeUserFromCompany.mutate,
    needsCompanySetup: !!profile && !profile.companyId && !profile.hasCompletedCompanySetup,
  };
};
