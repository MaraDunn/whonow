import { useState, useCallback, useEffect } from "react";
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
  metadata?: { sources?: Array<{ etag?: string; id?: string; type?: string; updateTime?: string }> };
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GooglePerson = {
  resourceName?: string;
  names?: Array<{ displayName?: string }>;
  emailAddresses?: Array<{ value?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  photos?: Array<{ url?: string }>;
  metadata?: { sources?: Array<{ etag?: string; id?: string; type?: string; updateTime?: string }> };
};

type PeopleConnectionsResponse = {
  connections?: GooglePerson[];
  nextPageToken?: string;
};

/** Index entry for duplicate matching. */
type GoogleContactSource = { etag?: string; id?: string; type?: string; updateTime?: string };
type ConnectionIndexEntry = { resourceName: string; contactSource: GoogleContactSource };

function getWritableContactSource(person: GooglePerson): GoogleContactSource | null {
  const sources = person.metadata?.sources ?? [];
  const contactSource = sources.find((s) => (s.type ?? "").toUpperCase() === "CONTACT");
  if (!contactSource) return null;
  const etag = (contactSource.etag ?? "").trim();
  if (!etag) return null;
  return {
    etag,
    id: contactSource.id,
    type: contactSource.type,
    updateTime: contactSource.updateTime,
  };
}

// Prefer VITE_GOOGLE_CLIENT_ID from env; fallback for backwards compatibility.
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "340045414488-au8kh5fhtls67u767io9ka1is77k46ie.apps.googleusercontent.com";
// Read + write so we can import (read) and sync back to Google (write).
const SCOPES = "https://www.googleapis.com/auth/contacts";
const GOOGLE_CONNECTION_PERSIST_KEY = "whonow.googleContacts.connected";

function normalizeEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

/** People API rate limit: retry on 429/503 with exponential backoff. */
async function fetchPeopleApi(url: string, headers: Record<string, string>, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt === maxRetries) return res;
    const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return fetch(url, { headers });
}

function normalizePhone(phone: string): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** Remove undefined from object (one level). Used so we never send undefined to People API. */
function omitUndefined<T extends Record<string, unknown>>(o: T): T {
  const out = { ...o };
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/** Map a WhoNow contact to a Google Person body for createContact / updateContact. */
function contactToGooglePerson(c: Contact, contactSource?: GoogleContactSource): GooglePersonCreate {
  const body: GooglePersonCreate = {};
  const name = (c.name ?? "").trim();
  if (name) body.names = [{ displayName: name }];
  if ((c.email ?? "").trim()) body.emailAddresses = [{ value: (c.email ?? "").trim() }];
  if ((c.phone ?? "").trim()) body.phoneNumbers = [{ value: (c.phone ?? "").trim() }];
  const company = (c.company ?? "").trim();
  const role = (c.role ?? "").trim();
  if (company || role) {
    body.organizations = [omitUndefined({ name: company || undefined, title: role || undefined }) as { name?: string; title?: string }];
  }

  const address = (c.address ?? "").trim();
  const city = (c.city ?? "").trim();
  const state = (c.state ?? "").trim();
  const zipCode = (c.zipCode ?? "").trim();
  const country = (c.country ?? "").trim();
  if (address || city || state || zipCode || country) {
    const formattedValue = [address, city, state, zipCode, country].filter(Boolean).join(", ");
    const addr: Record<string, string> = {};
    if (formattedValue) addr.formattedValue = formattedValue;
    if (city) addr.city = city;
    if (state) addr.region = state;
    if (zipCode) addr.postalCode = zipCode;
    if (country) addr.country = country;
    body.addresses = [addr as GooglePersonCreate["addresses"] extends (infer U)[] ? U : never];
  }

  const description = (c.description ?? "").trim();
  if (description) {
    body.biographies = [{ value: description, contentType: "TEXT_PLAIN" }];
  }

  if (contactSource?.etag?.trim()) {
    body.metadata = {
      sources: [
        omitUndefined({
          etag: contactSource.etag.trim(),
          id: contactSource.id,
          type: contactSource.type,
          updateTime: contactSource.updateTime,
        }) as GoogleContactSource,
      ],
    };
  }
  return body;
}

// resourceName is not a valid personFields value; it is always returned with each Person.
const INDEX_PERSON_FIELDS = "names,emailAddresses,phoneNumbers,metadata";

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

  const apiHeaders = { Authorization: `Bearer ${accessToken}` };
  do {
    const url = pageToken ? `${baseUrl}&pageToken=${encodeURIComponent(pageToken)}` : baseUrl;
    const response = await fetchPeopleApi(url, apiHeaders);
    if (!response.ok) throw new Error("Failed to fetch Google connections");
    const data = (await response.json()) as PeopleConnectionsResponse;
    const connections = data.connections || [];
    for (const p of connections) {
      const resourceName = p.resourceName;
      const contactSource = getWritableContactSource(p);
      if (!resourceName || !contactSource?.etag) continue;
      const entry: ConnectionIndexEntry = { resourceName, contactSource };
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
      const body = contactToGooglePerson(c, existing.contactSource);
      try {
        let res = await fetch(updateUrl, { method: "PATCH", headers, body: JSON.stringify(body) });
        if (!res.ok && res.status === 400) {
          const coreFields = "names,emailAddresses,phoneNumbers,organizations";
          const coreUrl = `https://people.googleapis.com/v1/${existing.resourceName}:updateContact?updatePersonFields=${coreFields}&personFields=${coreFields}`;
          const coreBody: GooglePersonCreate = {
            names: body.names,
            emailAddresses: body.emailAddresses,
            phoneNumbers: body.phoneNumbers,
            organizations: body.organizations,
            metadata: body.metadata,
          };
          res = await fetch(coreUrl, { method: "PATCH", headers, body: JSON.stringify(coreBody) });
        }
        if (res.ok) {
          updated++;
        } else {
          const updateErrText = await res.text();
          // If update fails (often because target isn't writable), fall back to create
          // so sync still gets the contact into Google instead of hard-failing.
          const createBody = contactToGooglePerson(c);
          const createRes = await fetch(createUrl, { method: "POST", headers, body: JSON.stringify(createBody) });
          if (createRes.ok) {
            created++;
          } else {
            failed++;
            const createErrText = await createRes.text();
            errors.push(`${name}: update failed (${updateErrText.slice(0, 60)}), create failed (${createErrText.slice(0, 60)})`);
          }
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

  const setConnectedPreference = useCallback((connected: boolean) => {
    try {
      if (connected) {
        localStorage.setItem(GOOGLE_CONNECTION_PERSIST_KEY, "1");
      } else {
        localStorage.removeItem(GOOGLE_CONNECTION_PERSIST_KEY);
      }
    } catch {
      // Ignore storage failures (private browsing, blocked storage, etc.)
    }
  }, []);

  const shouldRestoreConnection = useCallback(() => {
    try {
      return localStorage.getItem(GOOGLE_CONNECTION_PERSIST_KEY) === "1";
    } catch {
      return false;
    }
  }, []);

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
            setConnectedPreference(true);
            await fetchContacts(response.access_token);
          } else {
            setIsAuthenticated(false);
            setAccessToken(null);
          }
          setIsLoading(false);
        },
      });
      
      client.requestAccessToken();
    } catch (error) {
      toast.error("Failed to sign in with Google");
      console.error(error);
      setIsLoading(false);
    }
  }, [setConnectedPreference]);

  const fetchContacts = async (token: string) => {
    setIsLoading(true);
    try {
      const baseUrl =
        "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations,photos&pageSize=1000";
      const allConnections: GooglePerson[] = [];
      let pageToken: string | undefined;
      const apiHeaders = { Authorization: `Bearer ${token}` };

      do {
        const url = pageToken
          ? `${baseUrl}&pageToken=${encodeURIComponent(pageToken)}`
          : baseUrl;
        const response = await fetchPeopleApi(url, apiHeaders);

        if (!response.ok) {
          throw new Error(response.status === 429 ? "Too many requests; please try again in a minute." : "Failed to fetch contacts");
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
      const msg = error instanceof Error ? error.message : "Failed to fetch Google contacts";
      toast.error(msg);
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
    setConnectedPreference(false);
    setAccessToken(null);
    setIsAuthenticated(false);
    setContacts([]);
  }, [accessToken, setConnectedPreference]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !shouldRestoreConnection()) return;

    let cancelled = false;

    const restoreGoogleConnection = async () => {
      setIsLoading(true);
      try {
        await loadGoogleScript();

        const client = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: async (response: GoogleTokenResponse) => {
            if (cancelled) return;
            if (response.access_token) {
              setAccessToken(response.access_token);
              setIsAuthenticated(true);
              await fetchContacts(response.access_token);
            } else {
              // Keep preference so we can try again next launch/session.
              setAccessToken(null);
              setIsAuthenticated(false);
            }
            setIsLoading(false);
          },
        });

        // Silent re-auth: no prompts. If Google cannot silently issue a token,
        // we keep the user disconnected in this runtime until they click connect.
        client.requestAccessToken({ prompt: "none" });
      } catch {
        if (!cancelled) {
          setIsLoading(false);
          setAccessToken(null);
          setIsAuthenticated(false);
        }
      }
    };

    void restoreGoogleConnection();

    return () => {
      cancelled = true;
    };
  }, [shouldRestoreConnection]);

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
        }) => { requestAccessToken: (options?: { prompt?: string }) => void };
        revoke: (token: string, callback: () => void) => void;
      };
    };
  };
}
