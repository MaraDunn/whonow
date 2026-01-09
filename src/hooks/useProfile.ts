import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Profile, Company, AppRole, CompanyMember } from "@/types/profile";
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
  owner_id: string | null;
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
  ownerId: db.owner_id || undefined,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

// Cache key for company_id to enable parallel fetching
const COMPANY_ID_CACHE_KEY = "whonow_company_id_cache";

// Get cached company_id for faster parallel fetching
const getCachedCompanyId = (userId?: string): string | null => {
  if (!userId) return null;
  try {
    const cached = localStorage.getItem(`${COMPANY_ID_CACHE_KEY}_${userId}`);
    if (cached) {
      // Cache is valid for 1 hour
      const cacheTime = localStorage.getItem(`${COMPANY_ID_CACHE_KEY}_${userId}_time`);
      if (cacheTime && Date.now() - parseInt(cacheTime) < 60 * 60 * 1000) {
        return cached;
      }
    }
  } catch (error) {
    console.error("Failed to load cached company_id:", error);
  }
  return null;
};

// Cache company_id for faster parallel fetching
const cacheCompanyId = (userId?: string, companyId?: string | null) => {
  if (!userId) return;
  try {
    if (companyId) {
      localStorage.setItem(`${COMPANY_ID_CACHE_KEY}_${userId}`, companyId);
      localStorage.setItem(`${COMPANY_ID_CACHE_KEY}_${userId}_time`, Date.now().toString());
    } else {
      localStorage.removeItem(`${COMPANY_ID_CACHE_KEY}_${userId}`);
      localStorage.removeItem(`${COMPANY_ID_CACHE_KEY}_${userId}_time`);
    }
  } catch (error) {
    console.error("Failed to cache company_id:", error);
  }
};

export const useProfile = (userId?: string) => {
  const queryClient = useQueryClient();
  
  // Get cached company_id for parallel fetching
  const cachedCompanyId = getCachedCompanyId(userId);

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
      const mapped = data ? mapDbToProfile(data as DbProfile) : null;
      
      // Cache company_id for faster parallel fetching on next load
      if (mapped?.companyId) {
        cacheCompanyId(userId, mapped.companyId);
      } else {
        cacheCompanyId(userId, null);
      }
      
      return mapped;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Fetch user's company - can start immediately if we have cached company_id
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["company", profile?.companyId || cachedCompanyId],
    queryFn: async () => {
      const companyId = profile?.companyId || cachedCompanyId;
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapDbToCompany(data as DbCompany) : null;
    },
    enabled: !!(userId && (profile?.companyId || cachedCompanyId)),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
  
  // Update cache if company_id changed
  useEffect(() => {
    if (profile?.companyId) {
      const currentCache = getCachedCompanyId(userId);
      if (currentCache !== profile.companyId) {
        cacheCompanyId(userId, profile.companyId);
      }
    }
  }, [profile?.companyId, userId]);

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

  // Check if current user is super admin (owner) of their company
  const { data: isSuperAdmin = false } = useQuery({
    queryKey: ["is-super-admin", userId, company?.id],
    queryFn: async () => {
      if (!userId || !company?.id) return false;
      // Use is_current_user_super_admin which includes backwards compatibility for null owner_id
      const { data, error } = await supabase.rpc("is_current_user_super_admin");
      if (error) {
        console.error("Error checking super admin status:", error);
        return false;
      }
      return data || false;
    },
    enabled: !!userId && !!company?.id,
  });

  // Fetch company members (employee directory) with their roles
  // For admins, show all members. For regular members, show all members in the company
  // (not just those visible in directory) so they can see the full team
  const { data: companyMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ["company-members", profile?.companyId, isAdmin],
    queryFn: async () => {
      if (!profile?.companyId) return [];
      
      // Show all company members - don't filter by visibility
      // This ensures all members can see the team directory
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("company_id", profile.companyId);

      if (profilesError) throw profilesError;

      // Get roles for all members
      const memberIds = (profilesData as DbProfile[]).map(p => p.id);
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", memberIds);

      if (rolesError) throw rolesError;

      // Create a map of user_id to roles
      const rolesMap = new Map<string, AppRole[]>();
      (rolesData || []).forEach((r: { user_id: string; role: AppRole }) => {
        if (!rolesMap.has(r.user_id)) {
          rolesMap.set(r.user_id, []);
        }
        rolesMap.get(r.user_id)!.push(r.role);
      });

      // Map profiles and include their roles
      return (profilesData as DbProfile[]).map(profile => {
        const mapped = mapDbToProfile(profile);
        return {
          ...mapped,
          roles: rolesMap.get(mapped.id) || [],
        };
      });
    },
    enabled: !!profile?.companyId,
  });

  // Update profile
  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!userId) throw new Error("No user ID");
      
      // Fetch current profile to merge updates
      const { data: currentProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (fetchError) throw fetchError;

      // Fetch company if needed
      let companyName = "";
      if (currentProfile.company_id) {
        const { data: companyData } = await supabase
          .from("companies")
          .select("name")
          .eq("id", currentProfile.company_id)
          .single();
        companyName = companyData?.name || "";
      }
      
      // Update profile
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

      // Sync to contact card with "my-profile" tag
      // First, check if contact card exists
      const { data: existingContact, error: contactCheckError } = await supabase
        .from("contacts")
        .select("id")
        .eq("owner_id", userId)
        .contains("tags", ["my-profile"])
        .is("deleted_at", null)
        .maybeSingle();

      if (contactCheckError && contactCheckError.code !== "PGRST116") {
        // PGRST116 is "not found" which is fine
        throw contactCheckError;
      }

      const contactData = {
        name: updates.fullName || currentProfile.full_name || "",
        email: currentProfile.email || "",
        phone: updates.phone || currentProfile.phone || "",
        company: companyName,
        role: updates.role || currentProfile.role || "",
        description: updates.description || currentProfile.description || "",
        avatar: updates.avatarUrl || currentProfile.avatar_url || undefined,
        tags: ["my-profile"],
      };

      if (existingContact) {
        // Update existing contact card
        // Set is_shared = true so other company members can see it
        const { error: updateError } = await supabase
          .from("contacts")
          .update({
            name: contactData.name,
            email: contactData.email,
            phone: contactData.phone || null,
            company: contactData.company || null,
            role: contactData.role || null,
            description: contactData.description || null,
            avatar: contactData.avatar || null,
            tags: contactData.tags,
            company_id: currentProfile.company_id || null, // Ensure company_id is set
            is_shared: true, // Share with company so team directory can see it
          })
          .eq("id", existingContact.id);

        if (updateError) throw updateError;
      } else {
        // Create new contact card if it doesn't exist
        // Set is_shared = true so other company members can see it
        const { error: insertError } = await supabase
          .from("contacts")
          .insert({
            name: contactData.name,
            email: contactData.email || null,
            phone: contactData.phone || null,
            company: contactData.company || null,
            role: contactData.role || null,
            description: contactData.description || null,
            avatar: contactData.avatar || null,
            tags: contactData.tags,
            owner_id: userId,
            company_id: currentProfile.company_id || null,
            is_shared: true, // Share with company so team directory can see it
          });

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
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

  // Grant admin role to a user (super admin only)
  const grantAdminRole = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!userId) throw new Error("No user ID");

      const { data, error } = await supabase.rpc("grant_admin_role", {
        p_user_id: targetUserId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      queryClient.invalidateQueries({ queryKey: ["is-super-admin", userId] });
      toast.success("Admin permissions granted");
    },
    onError: (error) => {
      const errorMessage = error.message || "Failed to grant admin role";
      if (errorMessage.includes("insufficient_privilege")) {
        toast.error("Only the organization owner can grant admin permissions");
      } else if (errorMessage.includes("cannot_grant_admin_to_self")) {
        toast.error("You are already the organization owner");
      } else if (errorMessage.includes("user_not_in_company")) {
        toast.error("User is not in your organization");
      } else {
        toast.error("Failed to grant admin role: " + errorMessage);
      }
    },
  });

  // Revoke admin role from a user (super admin only)
  const revokeAdminRole = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!userId) throw new Error("No user ID");

      const { data, error } = await supabase.rpc("revoke_admin_role", {
        p_user_id: targetUserId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      queryClient.invalidateQueries({ queryKey: ["is-super-admin", userId] });
      toast.success("Admin permissions revoked");
    },
    onError: (error) => {
      const errorMessage = error.message || "Failed to revoke admin role";
      if (errorMessage.includes("insufficient_privilege")) {
        toast.error("Only the organization owner can revoke admin permissions");
      } else if (errorMessage.includes("cannot_revoke_admin_from_self")) {
        toast.error("You cannot revoke admin from yourself");
      } else if (errorMessage.includes("user_not_in_company")) {
        toast.error("User is not in your organization");
      } else {
        toast.error("Failed to revoke admin role: " + errorMessage);
      }
    },
  });

  // Refresh invite code (super admin only)
  const refreshInviteCode = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No user ID");

      const { data, error } = await supabase.rpc("refresh_company_invite_code");

      if (error) throw error;
      return data;
    },
    onSuccess: (newInviteCode) => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success(`New invite code: ${newInviteCode}`);
    },
    onError: (error) => {
      const errorMessage = error.message || "Failed to refresh invite code";
      if (errorMessage.includes("insufficient_privilege")) {
        toast.error("Only the organization owner can refresh the invite code");
      } else {
        toast.error("Failed to refresh invite code: " + errorMessage);
      }
    },
  });

  // Delete organization (super admin only)
  const deleteCompany = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No user ID");

      const { data, error } = await supabase.rpc("delete_company");

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
      toast.success("Organization deleted");
    },
    onError: (error) => {
      const errorMessage = error.message || "Failed to delete organization";
      if (errorMessage.includes("insufficient_privilege")) {
        toast.error("Only the organization owner can delete the organization");
      } else {
        toast.error("Failed to delete organization: " + errorMessage);
      }
    },
  });

  return {
    profile,
    company,
    roles,
    isAdmin,
    isSuperAdmin,
    companyMembers,
    isLoading: profileLoading || companyLoading || membersLoading,
    updateProfile: updateProfile.mutate,
    createCompany: createCompany.mutate,
    joinCompany: joinCompany.mutate,
    skipCompanySetup: skipCompanySetup.mutate,
    removeUserFromCompany: removeUserFromCompany.mutate,
    grantAdminRole: grantAdminRole.mutate,
    revokeAdminRole: revokeAdminRole.mutate,
    refreshInviteCode: refreshInviteCode.mutate,
    deleteCompany: deleteCompany.mutate,
    needsCompanySetup: !!profile && !profile.companyId && !profile.hasCompletedCompanySetup,
  };
};
