import { useState, useCallback } from "react";
import { toast } from "sonner";

interface PhoneContact {
  name: string;
  email: string;
  phone: string;
}

export const usePhoneContacts = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [contacts, setContacts] = useState<PhoneContact[]>([]);

  const isSupported = typeof window !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

  const pickContacts = useCallback(async () => {
    if (!isSupported) {
      toast.error("Contact Picker is not supported on this device");
      return [];
    }

    setIsLoading(true);
    try {
      const props = ["name", "email", "tel"];
      const opts = { multiple: true };
      
      // @ts-ignore - Contact Picker API types not in standard TypeScript
      const selectedContacts = await navigator.contacts.select(props, opts);
      
      const mapped: PhoneContact[] = selectedContacts.map((c: any) => ({
        name: c.name?.[0] || "",
        email: c.email?.[0] || "",
        phone: c.tel?.[0] || "",
      }));

      setContacts(mapped);
      return mapped;
    } catch (error: any) {
      if (error.name !== "InvalidStateError" && error.name !== "AbortError") {
        toast.error("Failed to access contacts");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const clearContacts = useCallback(() => {
    setContacts([]);
  }, []);

  return {
    isSupported,
    isLoading,
    contacts,
    pickContacts,
    clearContacts,
  };
};
