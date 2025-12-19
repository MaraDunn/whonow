import { useMemo } from "react";
import { Contact } from "@/types/contact";

export function useContactSearch(contacts: Contact[], query: string): Contact[] {
  return useMemo(() => {
    if (!query.trim()) {
      return contacts;
    }

    const searchTerms = query.toLowerCase().split(" ").filter(Boolean);

    return contacts.filter((contact) => {
      const searchableText = [
        contact.name,
        contact.email,
        contact.phone,
        contact.company,
        contact.role,
        ...contact.tags,
      ]
        .join(" ")
        .toLowerCase();

      return searchTerms.every((term) => searchableText.includes(term));
    });
  }, [contacts, query]);
}
