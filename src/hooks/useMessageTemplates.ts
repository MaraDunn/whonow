import { useState, useCallback } from "react";

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "whonow_message_templates";

function load(): MessageTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MessageTemplate[]) : [];
  } catch {
    return [];
  }
}

function save(templates: MessageTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Silently ignore storage errors
  }
}

export function useMessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>(load);

  const addTemplate = useCallback(
    (name: string, body: string): MessageTemplate => {
      const now = new Date().toISOString();
      const newTemplate: MessageTemplate = {
        id: crypto.randomUUID(),
        name: name.trim(),
        body,
        createdAt: now,
        updatedAt: now,
      };
      setTemplates((prev) => {
        const next = [...prev, newTemplate];
        save(next);
        return next;
      });
      return newTemplate;
    },
    []
  );

  const updateTemplate = useCallback(
    (id: string, changes: Partial<Pick<MessageTemplate, "name" | "body">>) => {
      setTemplates((prev) => {
        const next = prev.map((t) =>
          t.id === id
            ? { ...t, ...changes, updatedAt: new Date().toISOString() }
            : t
        );
        save(next);
        return next;
      });
    },
    []
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      save(next);
      return next;
    });
  }, []);

  return { templates, addTemplate, updateTemplate, deleteTemplate };
}
