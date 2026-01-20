import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

const MAX_RECENT_KEYWORDS = 15; // Maximum number of recently used keywords to store

/**
 * Hook to manage recently used keywords
 * Stores keywords in localStorage, scoped by user ID and optionally company ID
 */
export function useRecentlyUsedKeywords() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);

  // Get storage key based on user and company
  const getStorageKey = () => {
    if (!user?.id) return null;
    const companyId = profile?.companyId || "personal";
    return `recent-keywords-${user.id}-${companyId}`;
  };

  // Load recently used keywords on mount
  useEffect(() => {
    const storageKey = getStorageKey();
    if (!storageKey) {
      setRecentKeywords([]);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentKeywords(parsed);
        } else {
          setRecentKeywords([]);
        }
      } else {
        setRecentKeywords([]);
      }
    } catch (error) {
      console.error("Error loading recent keywords:", error);
      setRecentKeywords([]);
    }
  }, [user?.id, profile?.companyId]);

  // Save keywords to localStorage
  const saveKeywords = (keywords: string[]) => {
    const storageKey = getStorageKey();
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(keywords));
      setRecentKeywords(keywords);
    } catch (error) {
      console.error("Error saving recent keywords:", error);
    }
  };

  /**
   * Add keywords to recently used list
   * Moves newly used keywords to the front and limits to MAX_RECENT_KEYWORDS
   */
  const addKeywords = (newKeywords: string[]) => {
    if (!newKeywords || newKeywords.length === 0) return;

    const trimmed = newKeywords
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    if (trimmed.length === 0) return;

    setRecentKeywords((prev) => {
      // Remove duplicates and move new keywords to front
      const updated = [...trimmed];
      
      // Add existing keywords that aren't in the new list
      for (const keyword of prev) {
        if (!trimmed.includes(keyword)) {
          updated.push(keyword);
        }
      }

      // Limit to MAX_RECENT_KEYWORDS
      const limited = updated.slice(0, MAX_RECENT_KEYWORDS);
      
      // Save to localStorage directly (don't call saveKeywords to avoid double state update)
      const storageKey = getStorageKey();
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(limited));
        } catch (error) {
          console.error("Error saving recent keywords:", error);
        }
      }
      
      return limited;
    });
  };

  /**
   * Clear all recently used keywords
   */
  const clearKeywords = () => {
    saveKeywords([]);
  };

  return {
    recentKeywords,
    addKeywords,
    clearKeywords,
  };
}
