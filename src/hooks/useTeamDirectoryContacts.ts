import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Contact } from "@/types/contact";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";

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
  isShared: db.is_shared || false,
  ownerId: db.owner_id || undefined,
  lastContactedAt: db.last_contacted_at || undefined,
  isClient: db.is_client || false,
  createdAt: db.created_at || undefined,
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

export const useTeamDirectoryContacts = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  // Fetch contact cards with "my-profile" tag for all company members
  const { data: teamContacts = [], isLoading, refetch } = useQuery({
    queryKey: ["team-directory-contacts", profile?.companyId],
    queryFn: async () => {
      if (!profile?.companyId) return [];

      // First, get company name
      const { data: companyData } = await supabase
        .from("companies")
        .select("name")
        .eq("id", profile.companyId)
        .single();

      // Get all company members with their profile data
      const { data: companyMembers, error: membersError } = await supabase
        .from("profiles")
        .select("*")
        .eq("company_id", profile.companyId);

      if (membersError) throw membersError;
      if (!companyMembers || companyMembers.length === 0) return [];

      const memberIds = companyMembers.map((m) => m.id);

      // Fetch contact cards with "my-profile" tag for these users
      // Query by owner_id in memberIds and "my-profile" tag to get all profile contact cards
      // We'll ensure they're shared and have company_id set below
      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .in("owner_id", memberIds)
        .contains("tags", ["my-profile"])
        .is("deleted_at", null);

      if (contactsError) throw contactsError;

      // Update existing contacts to ensure they're shared and have company_id
      if (contacts && contacts.length > 0) {
        const contactsToUpdate = (contacts as DbContact[]).filter(
          (contact) =>
            !contact.is_shared ||
            contact.company_id !== profile.companyId
        );

        if (contactsToUpdate.length > 0) {
          const contactIds = contactsToUpdate.map((c) => c.id);
          const { error: updateError } = await supabase
            .from("contacts")
            .update({
              is_shared: true,
              company_id: profile.companyId,
            })
            .in("id", contactIds);

          if (updateError) {
            console.error("Error updating contact cards:", updateError);
          } else {
            // Update the contacts in memory
            contactsToUpdate.forEach((contact) => {
              contact.is_shared = true;
              contact.company_id = profile.companyId;
            });
          }
        }
      }

      // Create a map of user ID to contact card
      const contactMap = new Map<string, Contact>();
      if (contacts) {
        (contacts as DbContact[]).forEach((contact) => {
          if (contact.owner_id) {
            contactMap.set(contact.owner_id, mapDbToContact(contact));
          }
        });
      }

      // For members without contact cards, create them automatically
      const membersWithoutContacts = companyMembers.filter(
        (member) => !contactMap.has(member.id)
      );

      // Create contact cards for members who don't have them
      if (membersWithoutContacts.length > 0) {
        const contactsToCreate = membersWithoutContacts.map((member) => ({
          name: member.full_name || member.email || "No name",
          email: member.email || null,
          phone: member.phone || null,
          company: companyData?.name || null,
          role: member.role || null,
          description: member.description || null,
          avatar: member.avatar_url || null,
          tags: ["my-profile"],
          owner_id: member.id,
          company_id: profile.companyId,
          is_shared: true,
        }));

        // Insert contact cards in batch
        const { data: newContacts, error: createError } = await supabase
          .from("contacts")
          .insert(contactsToCreate)
          .select();

        if (createError) {
          console.error("Error creating contact cards:", createError);
        } else if (newContacts) {
          // Add newly created contacts to the map
          (newContacts as DbContact[]).forEach((contact) => {
            if (contact.owner_id) {
              contactMap.set(contact.owner_id, mapDbToContact(contact));
            }
          });
        }
      }

      // Build result array with contact cards (or fallback to profile data if creation failed)
      const result: Contact[] = companyMembers.map((member) => {
        const existingContact = contactMap.get(member.id);
        if (existingContact) {
          return existingContact;
        }

        // Fallback: create Contact from profile data (shouldn't happen if creation worked)
        return {
          id: member.id, // Use profile ID as contact ID for fallback
          name: member.full_name || member.email || "No name",
          email: member.email || "",
          phone: member.phone || "",
          company: companyData?.name || "",
          role: member.role || "",
          description: member.description || "",
          tags: ["my-profile"],
          avatar: member.avatar_url || undefined,
          ownerId: member.id,
          isShared: true,
        };
      });

      // Sort by name
      return result.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!profile?.companyId,
  });

  // Set up real-time subscription for contact updates
  useEffect(() => {
    if (!profile?.companyId) return;

    // Get company member IDs for filtering
    const getMemberIds = async () => {
      const { data: companyMembers } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", profile.companyId);

      return companyMembers?.map((m) => m.id) || [];
    };

    let memberIds: string[] = [];
    getMemberIds().then((ids) => {
      memberIds = ids;
    });

    const channel = supabase
      .channel(`team-directory-contacts-${profile.companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contacts",
        },
        async (payload) => {
          // Check if the contact belongs to a company member and has my-profile tag
          const contact = payload.new as DbContact | null;
          if (!contact) return;

          // Check if contact has my-profile tag
          if (!contact.tags || !Array.isArray(contact.tags) || !contact.tags.includes("my-profile")) {
            return;
          }

          // If we have member IDs, check if this contact belongs to one
          if (memberIds.length > 0 && contact.owner_id) {
            if (!memberIds.includes(contact.owner_id)) return;
          } else {
            // If we don't have member IDs yet, refresh them
            const ids = await getMemberIds();
            memberIds = ids;
            if (!contact.owner_id || !ids.includes(contact.owner_id)) return;
          }

          // Invalidate the query to refresh the team directory
          queryClient.invalidateQueries({
            queryKey: ["team-directory-contacts", profile.companyId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.companyId, queryClient]);

  return {
    teamContacts,
    isLoading,
    refetch,
  };
};

