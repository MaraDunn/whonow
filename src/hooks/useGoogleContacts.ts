import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Contact } from "@/types/contact";

interface GoogleContact {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  avatar?: string;
}

/** Person body for People API createContact / updateContact (subset we send). */
type GooglePersonCreate = {
  names?: Array<{ displayName?: string }>;
  emailAddresses?: Array<{ value?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  addresses?: Array<{
    formattedValue?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }>;
  biographies?: Array<{ value: string; contentType: "TEXT_PLAIN" }>;
  metadata?: { sources?: Array<{ etag?: string }> };
};

type GoogleTokenResponse = {
  access_token?: string;
};

type GooglePerson = {
  resourceName?: string;
  names?: Array<{ displayName?: string }>;
  emailAddresses?: Array<{ value?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  photos?: Array<{ url?: string }>;
  metadata?: { sources?: Array<{ etag?: string }> };
};

type PeopleConnectionsResponse = {
  connections?: GooglePerson[];
  nextPageToken?: string;
};

/** Index entry for duplicate matching. */
type ConnectionIndexEntry = { resourceName: string; etag: string };

// Prefer VITE_GOOGLE_CLIENT_ID from env; fallback for backwards compatibility.
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "340045414488-au8kh5fhtls67u767io9ka1is77k46ie.apps.googleusercontent.com";
// Read + write so we can import (read) and sync back to Google (write).
const SCOPES = "https://www.googleapis.com/auth/contacts";

function normalizeEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** Map a WhoNow contact to a Google Person body for createContact / updateContact. */
function contactToGooglePerson(c: Contact, etag?: string): GooglePersonCreate {
  const body: GooglePersonCreate = {};
  const name = (c.name ?? "").trim();
  if (name) body.names = [{ displayName: name }];
  if ((c.email ?? "").trim()) body.emailAddresses = [{ value: (c.email ?? "").trim() }];
  if ((c.phone ?? "").trim()) body.phoneNumbers = [{ value: (c.phone ?? "").trim() }];
  const company = (c.company ?? "").trim();
  const role = (c.role ?? "").trim();
  if (company || role) body.organizations = [{ name: company || undefined, title: role || undefined }];

  const address = (c.address ?? "").trim();
  const city = (c.city ?? "").trim();
  const state = (c.state ?? "").trim();
  const zipCode = (c.zipCode ?? "").trim();
  const country = (c.country ?? "").trim();
  if (address || city || state || zipCode || country) {
    const formattedValue = [address, city, state, zipCode, country].filter(Boolean).join(", ");
    body.addresses = [
      {
        formattedValue: formattedValue || undefined,
        city: city || undefined,
        region: state || undefined,
        postalCode: zipCode || undefined,
        country: country || undefined,
      },
    ];
  }

  const description = (c.description ?? "").trim();
  if (description) {
    body.biographies = [{ value: description, contentType: "TEXT_PLAIN" }];
  }

  if (etag) {
    body.metadata = { sources: [{ etag }] };
  }
  return body;
}

const INDEX_PERSON_FIELDS = "names,emailAddresses,phoneNumbers,metadata,resourceName";

/**
 * Fetch all connections and build index by normalized email and (for no-email contacts) phone.
 * Used to decide create vs update and to get resourceName + etag for updates.
 */
async function fetchGoogleConnectionsIndex(
  accessToken: string
): Promise<{ byEmail: Map<string, ConnectionIndexEntry>; byPhone: Map<string, ConnectionIndexEntry> }> {
  const byEmail = new Map<string, ConnectionIndexEntry>();
  const byPhone = new Map<string, ConnectionIndexEntry>();
  const baseUrl = `https://people.googleapis.com/v1/people/me/connections?personFields=${INDEX_PERSON_FIELDS}&pageSize=1000`;
  let pageToken: string | undefined;

  do {
    const url = pageToken ? `${baseUrl}&pageToken=${encodeURIComponent(pageToken)}` : baseUrl;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error("Failed to fetch Google connections");
    const data = (await response.json()) as PeopleConnectionsResponse;
    const connections = data.connections || [];
    for (const p of connections) {
      const resourceName = p.resourceName;
      const etag = p.metadata?.sources?.[0]?.etag ?? "";
      if (!resourceName || !etag) continue;
      const entry: ConnectionIndexEntry = { resourceName, etag };
      const email = p.emailAddresses?.[0]?.value;
      if (email) {
        const key = normalizeEmail(email);
        if (!byEmail.has(key)) byEmail.set(key, entry);
      }
      const phone = p.phoneNumbers?.[0]?.value;
      if (phone && !email) {
        const key = normalizePhone(phone);
        if (key && !byPhone.has(key)) byPhone.set(key, entry);
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { byEmail, byPhone };
}

const SYNC_PERSON_FIELDS = "names,emailAddresses,phoneNumbers,organizations,addresses,biographies";

/**
 * Sync WhoNow contacts to Google: update existing (matched by email or phone) or create new.
 * Runs sequentially. Skips contacts without a name. Returns created, updated, failed, errors.
 */
export async function syncContactsToGoogle(
  contacts: Contact[],
  accessToken: string
): Promise<{ created: number; updated: number; failed: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  let index: { byEmail: Map<string, ConnectionIndexEntry>; byPhone: Map<string, ConnectionIndexEntry> };
  try {
    index = await fetchGoogleConnectionsIndex(accessToken);
  } catch (e) {
    return {
      created: 0,
      updated: 0,
      failed: contacts.length,
      errors: [e instanceof Error ? e.message : "Failed to fetch Google contacts"],
    };
  }

  const createUrl = `https://people.googleapis.com/v1/people:createContact?personFields=${SYNC_PERSON_FIELDS}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  for (const c of contacts) {
    const name = (c.name ?? "").trim();
    if (!name) {
      failed++;
      errors.push(`Skipped "${c.email || c.phone || "no email/phone"}" (no name)`);
      continue;
    }

    const emailKey = normalizeEmail(c.email ?? "");
    const phoneKey = normalizePhone(c.phone ?? "");
    const existing = emailKey ? index.byEmail.get(emailKey) : phoneKey ? index.byPhone.get(phoneKey) : undefined;

    if (existing) {
      const updatePersonFields = SYNC_PERSON_FIELDS;
      const updateUrl = `https://people.googleapis.com/v1/${existing.resourceName}:updateContact?updatePersonFields=${updatePersonFields}&personFields=${SYNC_PERSON_FIELDS}`;
      const body = contactToGooglePerson(c, existing.etag);
      try {
        const res = await fetch(updateUrl, { method: "PATCH", headers, body: JSON.stringify(body) });
        if (res.ok) {
          updated++;
        } else {
          failed++;
          const errText = await res.text();
          errors.push(`${name}: ${errText.slice(0, 80)}`);
        }
      } catch (e) {
        failed++;
        errors.push(`${name}: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    } else {
      const body = contactToGooglePerson(c);
      try {
        const res = await fetch(createUrl, { method: "POST", headers, body: JSON.stringify(body) });
        if (res.ok) {
          created++;
        } else {
          failed++;
          const errText = await res.text();
          errors.push(`${name}: ${errText.slice(0, 80)}`);
        }
      } catch (e) {
        failed++;
        errors.push(`${name}: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    }
  }

  return { created, updated, failed, errors };
}

export const useGoogleContacts = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [contacts, setContacts] = useState<GoogleContact[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const isConfigured = Boolean(GOOGLE_CLIENT_ID);

  const signIn = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error("Google OAuth is not configured. Please add VITE_GOOGLE_CLIENT_ID to your environment.");
      return;
    }

    setIsLoading(true);
    try {
      // Load the Google Identity Services library
      await loadGoogleScript();
      
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (response: GoogleTokenResponse) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            setIsAuthenticated(true);
            await fetchContacts(response.access_token);
          }
        },
      });
      
      client.requestAccessToken();
    } catch (error) {
      toast.error("Failed to sign in with Google");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchContacts = async (token: string) => {
    setIsLoading(true);
    try {
      const baseUrl =
        "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations,photos&pageSize=1000";
      const allConnections: GooglePerson[] = [];
      let pageToken: string | undefined;

      do {
        const url = pageToken
          ? `${baseUrl}&pageToken=${encodeURIComponent(pageToken)}`
          : baseUrl;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch contacts");
        }

        const data = (await response.json()) as PeopleConnectionsResponse;
        const connections = data.connections || [];
        allConnections.push(...connections);
        pageToken = data.nextPageToken;
      } while (pageToken);

      const mapped: GoogleContact[] = allConnections
        .filter((c) => Boolean(c.names?.[0]?.displayName))
        .map((c) => ({
          name: c.names?.[0]?.displayName || "",
          email: c.emailAddresses?.[0]?.value || "",
          phone: c.phoneNumbers?.[0]?.value || "",
          company: c.organizations?.[0]?.name || "",
          role: c.organizations?.[0]?.title || "",
          avatar: c.photos?.[0]?.url,
        }));

      setContacts(mapped);
      return mapped;
    } catch (error) {
      toast.error("Failed to fetch Google contacts");
      console.error(error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = useCallback(() => {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    setAccessToken(null);
    setIsAuthenticated(false);
    setContacts([]);
  }, [accessToken]);

  const clearContacts = useCallback(() => {
    setContacts([]);
  }, []);

  const syncToGoogle = useCallback(
    async (
      contactsToSync: Contact[]
    ): Promise<{ created: number; updated: number; failed: number; errors: string[] }> => {
      if (!accessToken) {
        toast.error("Connect your Google account first");
        return { created: 0, updated: 0, failed: contactsToSync.length, errors: ["Not authenticated"] };
      }
      setIsSyncing(true);
      try {
        const result = await syncContactsToGoogle(contactsToSync, accessToken);
        const parts: string[] = [];
        if (result.created > 0) parts.push(`${result.created} created`);
        if (result.updated > 0) parts.push(`${result.updated} updated`);
        if (parts.length > 0) {
          toast.success(`Synced to Google: ${parts.join(", ")}`);
        }
        if (result.failed > 0 && result.errors.length > 0) {
          toast.error(`${result.failed} failed. ${result.errors.slice(0, 2).join("; ")}`);
        }
        return result;
      } catch (e) {
        toast.error("Failed to sync to Google");
        console.error(e);
        return {
          created: 0,
          updated: 0,
          failed: contactsToSync.length,
          errors: [e instanceof Error ? e.message : "Unknown error"],
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [accessToken]
  );

  return {
    isConfigured,
    isLoading,
    isSyncing,
    isAuthenticated,
    contacts,
    signIn,
    signOut,
    clearContacts,
    syncToGoogle,
  };
};

// Helper to load Google Identity Services script
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== "undefined" && google.accounts) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });
}

// Type declarations for Google Identity Services
declare global {
  const google: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: GoogleTokenResponse) => void;
        }) => { requestAccessToken: () => void };
        revoke: (token: string, callback: () => void) => void;
      };
    };
  };
}
