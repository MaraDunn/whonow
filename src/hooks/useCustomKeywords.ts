import { useState, useEffect } from "react";

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
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setKeywords(JSON.parse(stored));
      } catch {
        setKeywords(DEFAULT_KEYWORDS);
      }
    } else {
      setKeywords(DEFAULT_KEYWORDS);
    }
  }, []);

  const saveKeywords = (newKeywords: string[]) => {
    setKeywords(newKeywords);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newKeywords));
  };

  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      saveKeywords([...keywords, trimmed]);
    }
  };

  const removeKeyword = (keyword: string) => {
    saveKeywords(keywords.filter((k) => k !== keyword));
  };

  const resetToDefaults = () => {
    saveKeywords(DEFAULT_KEYWORDS);
  };

  return {
    keywords,
    addKeyword,
    removeKeyword,
    resetToDefaults,
  };
}
