import React, { createContext, useContext, useState } from "react";

export interface ContactDragPayload {
  contactId: string;
  isShared: boolean;
  isClient: boolean;
}

type ContactDragContextValue = {
  payload: ContactDragPayload | null;
  setPayload: (payload: ContactDragPayload | null) => void;
};

const ContactDragContext = createContext<ContactDragContextValue | null>(null);

export function ContactDragProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<ContactDragPayload | null>(null);
  return (
    <ContactDragContext.Provider value={{ payload, setPayload }}>
      {children}
    </ContactDragContext.Provider>
  );
}

export function useContactDrag() {
  const ctx = useContext(ContactDragContext);
  return ctx ?? { payload: null, setPayload: () => {} };
}
