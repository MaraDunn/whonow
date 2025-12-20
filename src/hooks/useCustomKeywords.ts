import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

const STORAGE_KEY = "custom-preset-keywords";

const DEFAULT_KEYWORDS = [
  "work",
  "personal",
  "priority",
  "tech",
  "design",
  "creative",
  "finance",
  "legal",
  "healthcare",
  "media",
  "startup",
  "investor",
];

export function useCustomKeywords() {
  const { user } = useAuth();
  const { profile, company, isAdmin } = useProfile(user?.id);
  const queryClient = useQueryClient();
  
  // Local keywords for personal use
  const [localKeywords, setLocalKeywords] = useState<string[]>([]);

  // Fetch company keywords if user is in a company
  const { data: companyKeywords = [] } = useQuery({
    queryKey: ["company-keywords", profile?.companyId],
    queryFn: async () => {
      if (!profile?.companyId) return [];
      const { data, error } = await supabase
        .from("company_keywords")
        .select("keyword")
        .eq("company_id", profile.companyId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data.map((k) => k.keyword);
    },
    enabled: !!profile?.companyId,
  });

  // Load local keywords on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setLocalKeywords(JSON.parse(stored));
      } catch {
        setLocalKeywords(DEFAULT_KEYWORDS);
      }
    } else {
      setLocalKeywords(DEFAULT_KEYWORDS);
    }
  }, []);

  const saveLocalKeywords = (newKeywords: string[]) => {
    setLocalKeywords(newKeywords);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newKeywords));
  };

  // Add company keyword (admin only)
  const addCompanyKeywordMutation = useMutation({
    mutationFn: async (keyword: string) => {
      if (!profile?.companyId) throw new Error("No company");
      const { error } = await supabase
        .from("company_keywords")
        .insert({ company_id: profile.companyId, keyword: keyword.trim().toLowerCase() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-keywords", profile?.companyId] });
    },
    onError: (error) => {
      toast.error("Failed to add keyword: " + error.message);
    },
  });

  // Remove company keyword (admin only)
  const removeCompanyKeywordMutation = useMutation({
    mutationFn: async (keyword: string) => {
      if (!profile?.companyId) throw new Error("No company");
      const { error } = await supabase
        .from("company_keywords")
        .delete()
        .eq("company_id", profile.companyId)
        .eq("keyword", keyword);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-keywords", profile?.companyId] });
    },
    onError: (error) => {
      toast.error("Failed to remove keyword: " + error.message);
    },
  });

  // Determine which keywords to use - company keywords take precedence
  const keywords = company && companyKeywords.length > 0 ? companyKeywords : localKeywords;

  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return;
    
    if (company && isAdmin) {
      // Admin adds to company keywords
      if (!companyKeywords.includes(trimmed)) {
        addCompanyKeywordMutation.mutate(trimmed);
      }
    } else if (!company) {
      // Individual user adds to local keywords
      if (!localKeywords.includes(trimmed)) {
        saveLocalKeywords([...localKeywords, trimmed]);
      }
    }
  };

  const removeKeyword = (keyword: string) => {
    if (company && isAdmin) {
      removeCompanyKeywordMutation.mutate(keyword);
    } else if (!company) {
      saveLocalKeywords(localKeywords.filter((k) => k !== keyword));
    }
  };

  const resetToDefaults = () => {
    if (company && isAdmin) {
      // Clear all company keywords and add defaults
      companyKeywords.forEach((k) => removeCompanyKeywordMutation.mutate(k));
      DEFAULT_KEYWORDS.forEach((k) => addCompanyKeywordMutation.mutate(k));
    } else if (!company) {
      saveLocalKeywords(DEFAULT_KEYWORDS);
    }
  };

  return {
    keywords,
    addKeyword,
    removeKeyword,
    resetToDefaults,
    isCompanyKeywords: !!company && companyKeywords.length > 0,
    canEditKeywords: !company || isAdmin,
  };
}
