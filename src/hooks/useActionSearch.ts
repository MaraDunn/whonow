import { useMemo } from "react";
import { Contact } from "@/types/contact";

export type ActionType = "email" | "call" | "text" | null;

interface ActionSearchResult {
  contacts: Contact[];
  action: ActionType;
  searchTerm: string;
}

const ACTION_KEYWORDS: Record<string, ActionType> = {
  email: "email",
  mail: "email",
  message: "email",
  call: "call",
  phone: "call",
  ring: "call",
  text: "text",
  sms: "text",
};

export function useActionSearch(contacts: Contact[], query: string): ActionSearchResult {
  return useMemo(() => {
    if (!query.trim()) {
      return { contacts, action: null, searchTerm: "" };
    }

    const words = query.toLowerCase().split(" ").filter(Boolean);
    const firstWord = words[0];
    const action = ACTION_KEYWORDS[firstWord] || null;
    
    // If we have an action keyword, use the rest as search term
    const searchTerm = action ? words.slice(1).join(" ") : query;
    const searchTerms = searchTerm.toLowerCase().split(" ").filter(Boolean);

    if (searchTerms.length === 0 && action) {
      // Just an action word with no search term - show all contacts
      return { contacts, action, searchTerm: "" };
    }

    const filtered = contacts.filter((contact) => {
      const searchableText = [
        contact.name,
        contact.email,
        contact.phone,
        contact.company,
        contact.role,
        contact.description || "",
        ...contact.tags,
      ]
        .join(" ")
        .toLowerCase();

      return searchTerms.every((term) => searchableText.includes(term));
    });

    return { contacts: filtered, action, searchTerm };
  }, [contacts, query]);
}
