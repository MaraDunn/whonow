import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { Contact } from "@/types/contact";
import { isDesktopOrNativeApp, getAuthRedirectOrigin } from "@/utils/launchMode";

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
  etag?: string;
  names?: Array<{ givenName?: string; familyName?: string; unstructuredName?: string }>;
  emailAddresses?: Array<{ value?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  addresses?: Array<{
    streetAddress?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }>;
  biographies?: Array<{ value: string }>;
  metadata?: { sources?: Array<{ etag?: string; type?: string; id?: string }> };
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GooglePerson = {
  resourceName?: string;
  etag?: string;
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
type GoogleContactSource = { etag?: string; id?: string; type?: string; updateTime?: string; personEtag?: string };
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
    personEtag: (person.etag ?? "").trim() || undefined,
  };
}

// Prefer VITE_GOOGLE_CLIENT_ID from env; fallback for backwards compatibility.
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "340045414488-au8kh5fhtls67u767io9ka1is77k46ie.apps.googleusercontent.com";
// Read + write so we can import (read) and sync back to Google (write).
const SCOPES = "https://www.googleapis.com/auth/contacts";
export const GOOGLE_REDIRECT_PENDING_KEY = "whonow.googleContacts.redirectPending";
export const GOOGLE_PENDING_TOKEN_KEY = "whonow.googleContacts.pendingToken";
const GOOGLE_CONTACTS_STATE = "google_contacts";
const GOOGLE_SYNC_DEBUG =
  import.meta.env.DEV || String(import.meta.env.VITE_GOOGLE_SYNC_DEBUG ?? "").toLowerCase() === "true";

type GoogleApiErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: unknown[];
    errors?: Array<{ message?: string; domain?: string; reason?: string }>;
  };
};

type GoogleErrorClassification =
  | "retryable"
  | "rate_limited"
  | "etag_conflict"
  | "invalid_payload"
  | "not_found"
  | "other";

type GoogleSyncFailureDebug = {
  contactRef: { id: string; name: string; email: string | null; phone: string | null };
  operation: string;
  url: string;
  requestBody: GooglePersonCreate | null;
  status: number;
  reason: string | null;
  statusText: string | null;
  message: string;
  rawErrorBody: string;
};

type GoogleSyncOptions = {
  debugFailFast?: boolean;
  dryRun?: boolean;
  onProgress?: (current: number, total: number, lastContactName: string) => void;
};

type GoogleSyncResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  failureReasonSummary: Record<string, number>;
  firstFailureDebug?: GoogleSyncFailureDebug;
  dryRunPlan?: { toCreate: number; toUpdate: number; toSkip: number };
};

const GOOGLE_SYNC_FAIL_FAST =
  String(import.meta.env.VITE_GOOGLE_SYNC_FAIL_FAST ?? "").toLowerCase() === "true";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateText(value: string, maxLen = 300): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}...`;
}

function parseRetryAfterMs(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) return null;
  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds * 1000);
  }
  const asDateMs = Date.parse(retryAfterHeader);
  if (!Number.isNaN(asDateMs)) {
    const delta = asDateMs - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function parseGoogleApiErrorBody(bodyText: string): {
  message: string;
  reason: string | null;
  statusText: string | null;
} {
  try {
    const parsed = JSON.parse(bodyText) as GoogleApiErrorBody;
    const message = parsed.error?.message || bodyText || "Unknown Google API error";
    const reason = parsed.error?.errors?.[0]?.reason ?? null;
    const statusText = parsed.error?.status ?? null;
    return { message, reason, statusText };
  } catch {
    return {
      message: bodyText || "Unknown Google API error",
      reason: null,
      statusText: null,
    };
  }
}

function classifyGoogleError(status: number, bodyText: string): {
  classification: GoogleErrorClassification;
  reason: string | null;
  statusText: string | null;
  message: string;
  reasonKey: string;
} {
  const parsed = parseGoogleApiErrorBody(bodyText);
  const reason = parsed.reason?.toLowerCase() ?? null;
  const statusText = parsed.statusText?.toLowerCase() ?? null;
  const message = parsed.message;

  if (status === 429) {
    return {
      classification: "rate_limited",
      reason: parsed.reason,
      statusText: parsed.statusText,
      message,
      reasonKey: "429:rate_limited",
    };
  }
  if (status === 404 || reason === "notfound") {
    return {
      classification: "not_found",
      reason: parsed.reason,
      statusText: parsed.statusText,
      message,
      reasonKey: "404:not_found",
    };
  }
  if (status === 400 && (reason === "failedprecondition" || statusText === "failed_precondition")) {
    return {
      classification: "etag_conflict",
      reason: parsed.reason,
      statusText: parsed.statusText,
      message,
      reasonKey: `400:${reason || statusText || "failed_precondition"}`,
    };
  }
  if (
    status === 400 &&
    (reason === "invalidargument" ||
      reason === "badrequest" ||
      statusText === "invalid_argument" ||
      statusText === "bad_request")
  ) {
    return {
      classification: "invalid_payload",
      reason: parsed.reason,
      statusText: parsed.statusText,
      message,
      reasonKey: `400:${reason || statusText || "invalid_argument"}`,
    };
  }
  if (status === 500 || status === 502 || status === 503) {
    return {
      classification: "retryable",
      reason: parsed.reason,
      statusText: parsed.statusText,
      message,
      reasonKey: `${status}:${reason || statusText || "retryable"}`,
    };
  }
  return {
    classification: "other",
    reason: parsed.reason,
    statusText: parsed.statusText,
    message,
    reasonKey: `${status}:${reason || statusText || "other"}`,
  };
}

function shouldAttemptCreateAfterUpdateFailure(classification: GoogleErrorClassification): boolean {
  return classification === "not_found" || classification === "invalid_payload" || classification === "other";
}

function formatGoogleApiError(status: number, bodyText: string): string {
  const parsed = parseGoogleApiErrorBody(bodyText);
  const base = parsed.message;
  const reason = parsed.reason;
  const statusText = parsed.statusText;
  const pieces = [`HTTP ${status}`];
  if (statusText) pieces.push(statusText);
  if (reason) pieces.push(`reason=${reason}`);
  return `${pieces.join(" ")} - ${truncateText(base, 240)}`;
}

function logGoogleSyncDebug(event: string, payload: Record<string, unknown>) {
  if (!GOOGLE_SYNC_DEBUG) return;
  console.info(`[GoogleSync] ${event}`, payload);
}

function normalizeEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

/** People API wrapper with retry/backoff and detailed debug logs. */
async function fetchPeopleApi(
  url: string,
  init: RequestInit,
  context: { operation: string; maxRetries?: number; contactRef?: string }
): Promise<Response> {
  const maxRetries = context.maxRetries ?? 4;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startedAt = Date.now();
    const res = await fetch(url, init);
    const elapsedMs = Date.now() - startedAt;
    if (res.ok) return res;

    const retryable = res.status === 429 || res.status === 503 || res.status === 500 || res.status === 502;
    const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"));

    logGoogleSyncDebug("request-failed", {
      operation: context.operation,
      contactRef: context.contactRef,
      status: res.status,
      attempt,
      maxRetries,
      retryable,
      retryAfterMs,
      elapsedMs,
      url,
    });

    if (!retryable || attempt === maxRetries) {
      return res;
    }

    const exponentialMs = Math.min(1000 * Math.pow(2, attempt), 12000);
    const jitterMs = Math.floor(Math.random() * 250);
    const waitMs = Math.max(retryAfterMs ?? 0, exponentialMs + jitterMs);
    await sleep(waitMs);
  }
  return fetch(url, init);
}

function normalizePhone(phone: string): string {
  return (phone ?? "").replace(/\D/g, "");
}

function shouldDebugFailFast(): boolean {
  if (GOOGLE_SYNC_FAIL_FAST) return true;
  try {
    return localStorage.getItem("whonow.googleSync.failFast") === "1";
  } catch {
    return false;
  }
}

function parseUrlForDebug(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/** Remove undefined from object (one level). Used so we never send undefined to People API. */
function omitUndefined<T extends Record<string, unknown>>(o: T): T {
  const out = { ...o };
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/** Split "First Last" into given/family. Falls back to unstructuredName for single-word names. */
function splitName(fullName: string): { givenName?: string; familyName?: string; unstructuredName?: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return {};
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) {
    return { unstructuredName: trimmed };
  }
  return {
    givenName: trimmed.slice(0, spaceIdx),
    familyName: trimmed.slice(spaceIdx + 1),
  };
}

/** Map a WhoNow contact to a Google Person body for createContact / updateContact. */
function contactToGooglePerson(c: Contact, contactSource?: GoogleContactSource): GooglePersonCreate {
  const body: GooglePersonCreate = {};
  const name = (c.name ?? "").trim();
  if (name) {
    const parts = splitName(name);
    body.names = [omitUndefined(parts) as { givenName?: string; familyName?: string; unstructuredName?: string }];
  }
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
    const addr: Record<string, string> = {};
    if (address) addr.streetAddress = address;
    if (city) addr.city = city;
    if (state) addr.region = state;
    if (zipCode) addr.postalCode = zipCode;
    if (country) addr.country = country;
    body.addresses = [addr as GooglePersonCreate["addresses"] extends (infer U)[] ? U : never];
  }

  const description = (c.description ?? "").trim();
  if (description) {
    body.biographies = [{ value: description }];
  }

  if (contactSource?.etag?.trim()) {
    body.etag = contactSource.personEtag || undefined;
    body.metadata = {
      sources: [
        omitUndefined({
          etag: contactSource.etag.trim(),
          type: contactSource.type || "CONTACT",
          id: contactSource.id || undefined,
        }) as { etag?: string; type?: string; id?: string },
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
    const response = await fetchPeopleApi(
      url,
      { headers: apiHeaders },
      { operation: "connections-index-read", maxRetries: 4 }
    );
    if (!response.ok) throw new Error("Failed to fetch Google connections");
    const data = (await response.json()) as PeopleConnectionsResponse;
    const connections = data.connections || [];
    for (const p of connections) {
      const resourceName = p.resourceName;
      const contactSource = getWritableContactSource(p);
      if (!resourceName || !contactSource?.etag) continue;
      const entry: ConnectionIndexEntry = { resourceName, contactSource };
      const emails = p.emailAddresses ?? [];
      let hasEmail = false;
      for (const em of emails) {
        const key = normalizeEmail(em.value ?? "");
        if (key && !byEmail.has(key)) {
          byEmail.set(key, entry);
          hasEmail = true;
        }
      }
      if (!hasEmail) {
        const phones = p.phoneNumbers ?? [];
        for (const ph of phones) {
          const key = normalizePhone(ph.value ?? "");
          if (key && !byPhone.has(key)) byPhone.set(key, entry);
        }
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { byEmail, byPhone };
}

async function fetchLatestContactSource(accessToken: string, resourceName: string): Promise<GoogleContactSource | null> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const url = `https://people.googleapis.com/v1/${resourceName}?personFields=metadata`;
  const response = await fetchPeopleApi(
    url,
    { headers },
    { operation: "contact-source-refresh", contactRef: resourceName, maxRetries: 2 }
  );
  if (!response.ok) return null;
  const person = (await response.json()) as GooglePerson;
  return getWritableContactSource(person);
}

const SYNC_PERSON_FIELDS = "names,emailAddresses,phoneNumbers,organizations,addresses,biographies";
const BATCH_UPDATE_MASK = "names,emailAddresses,phoneNumbers,organizations,addresses,biographies";
const BATCH_SIZE = 200;

function getUpdatePersonFields(body: GooglePersonCreate): string {
  const writableFields: Array<keyof GooglePersonCreate> = [
    "names",
    "emailAddresses",
    "phoneNumbers",
    "organizations",
    "addresses",
    "biographies",
  ];
  return writableFields.filter((field) => Array.isArray(body[field]) && body[field]!.length > 0).join(",");
}

function stripOptionalGoogleFields(body: GooglePersonCreate): GooglePersonCreate {
  return {
    etag: body.etag,
    names: body.names,
    emailAddresses: body.emailAddresses,
    phoneNumbers: body.phoneNumbers,
    organizations: body.organizations,
    metadata: body.metadata,
  };
}

/** Split an array into chunks of `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

type BatchCreateRequest = {
  contacts: Array<{ contactPerson: GooglePersonCreate }>;
  readMask: string;
};

type BatchUpdateRequest = {
  contacts: Record<string, GooglePersonCreate>;
  updateMask: string;
  readMask: string;
};

type PersonResponse = { person?: GooglePerson; httpStatusCode?: number; status?: { code?: number; message?: string } };
type BatchCreateResponse = { createdPeople?: PersonResponse[] };
type BatchUpdateResponse = { updateResult?: Record<string, PersonResponse> };

/**
 * Sync WhoNow contacts to Google using batch APIs (up to 200 per request).
 * Falls back to individual requests on batch failure.
 */
export async function syncContactsToGoogle(
  contacts: Contact[],
  accessToken: string,
  options?: GoogleSyncOptions
): Promise<GoogleSyncResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];
  const failureReasonSummary = new Map<string, number>();
  let firstFailureDebug: GoogleSyncFailureDebug | undefined;
  const debugFailFast = options?.debugFailFast ?? shouldDebugFailFast();
  const dryRun = options?.dryRun ?? false;
  const onProgress = options?.onProgress;

  const bumpFailureReason = (key: string) => {
    failureReasonSummary.set(key, (failureReasonSummary.get(key) ?? 0) + 1);
  };

  let index: { byEmail: Map<string, ConnectionIndexEntry>; byPhone: Map<string, ConnectionIndexEntry> };
  try {
    index = await fetchGoogleConnectionsIndex(accessToken);
  } catch (e) {
    return {
      created: 0, updated: 0, skipped: 0,
      failed: contacts.length,
      errors: [e instanceof Error ? e.message : "Failed to fetch Google contacts"],
      failureReasonSummary: {},
    };
  }

  // Categorize contacts into creates, updates, and skips
  type CreateEntry = { contact: Contact; body: GooglePersonCreate; name: string };
  type UpdateEntry = { contact: Contact; body: GooglePersonCreate; name: string; resourceName: string };
  const toCreate: CreateEntry[] = [];
  const toUpdate: UpdateEntry[] = [];
  let processedCount = 0;

  for (const c of contacts) {
    const name = (c.name ?? "").trim();
    if (!name) {
      skipped++;
      processedCount++;
      onProgress?.(processedCount, contacts.length, "(skipped)");
      continue;
    }
    const emailKey = normalizeEmail(c.email ?? "");
    const phoneKey = normalizePhone(c.phone ?? "");
    const existing = emailKey ? index.byEmail.get(emailKey) : phoneKey ? index.byPhone.get(phoneKey) : undefined;

    if (existing) {
      const body = contactToGooglePerson(c, existing.contactSource);
      if (!getUpdatePersonFields(body)) {
        skipped++;
        processedCount++;
        onProgress?.(processedCount, contacts.length, name);
        continue;
      }
      toUpdate.push({ contact: c, body, name, resourceName: existing.resourceName });
    } else {
      const body = contactToGooglePerson(c);
      toCreate.push({ contact: c, body, name });
    }
  }

  if (dryRun) {
    return {
      created: 0, updated: 0, skipped, failed: 0,
      errors: [], failureReasonSummary: {},
      dryRunPlan: { toCreate: toCreate.length, toUpdate: toUpdate.length, toSkip: skipped },
    };
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  logGoogleSyncDebug("sync-start", {
    contactCount: contacts.length,
    toCreate: toCreate.length,
    toUpdate: toUpdate.length,
    skipped,
    batches: Math.ceil(toCreate.length / BATCH_SIZE) + Math.ceil(toUpdate.length / BATCH_SIZE),
  });

  // --- Batch creates ---
  const createChunks = chunk(toCreate, BATCH_SIZE);
  for (const batch of createChunks) {
    const batchReq: BatchCreateRequest = {
      contacts: batch.map((entry) => ({ contactPerson: entry.body })),
      readMask: SYNC_PERSON_FIELDS,
    };
    try {
      const res = await fetchPeopleApi(
        "https://people.googleapis.com/v1/people:batchCreateContacts",
        { method: "POST", headers, body: JSON.stringify(batchReq) },
        { operation: "batch-create", maxRetries: 3 }
      );
      if (res.ok) {
        const data = (await res.json()) as BatchCreateResponse;
        const createdPeople = data.createdPeople ?? [];
        for (let i = 0; i < batch.length; i++) {
          const personRes = createdPeople[i];
          if (personRes?.httpStatusCode && personRes.httpStatusCode >= 400) {
            failed++;
            const msg = personRes.status?.message ?? `HTTP ${personRes.httpStatusCode}`;
            errors.push(`${batch[i].name}: batch create failed (${msg})`);
            bumpFailureReason(`batch-create:${personRes.httpStatusCode}`);
          } else {
            created++;
          }
          processedCount++;
          onProgress?.(processedCount, contacts.length, batch[i].name);
        }
      } else {
        logGoogleSyncDebug("batch-create-failed-fallback", { status: res.status, batchSize: batch.length });
        const errBody = await res.text();
        // Fall back to individual creates for this batch
        for (const entry of batch) {
          try {
            const individualRes = await fetchPeopleApi(
              `https://people.googleapis.com/v1/people:createContact?personFields=${SYNC_PERSON_FIELDS}`,
              { method: "POST", headers, body: JSON.stringify(entry.body) },
              { operation: "individual-create-fallback", contactRef: entry.name, maxRetries: 3 }
            );
            if (individualRes.ok) {
              created++;
            } else {
              failed++;
              const individualErr = await individualRes.text();
              const errMsg = formatGoogleApiError(individualRes.status, individualErr);
              errors.push(`${entry.name}: ${errMsg}`);
              bumpFailureReason(`create:${individualRes.status}`);
              if (!firstFailureDebug) {
                firstFailureDebug = {
                  contactRef: { id: entry.contact.id, name: entry.name, email: entry.contact.email ?? null, phone: entry.contact.phone ?? null },
                  operation: "individual-create-fallback",
                  url: "people:createContact",
                  requestBody: entry.body,
                  status: individualRes.status,
                  ...parseGoogleApiErrorBody(individualErr),
                  rawErrorBody: individualErr,
                };
              }
              if (debugFailFast) break;
            }
          } catch (e) {
            failed++;
            bumpFailureReason("create:exception");
            errors.push(`${entry.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
            if (debugFailFast) break;
          }
          processedCount++;
          onProgress?.(processedCount, contacts.length, entry.name);
        }
        if (debugFailFast && failed > 0) break;
      }
    } catch (e) {
      for (const entry of batch) {
        failed++;
        processedCount++;
        onProgress?.(processedCount, contacts.length, entry.name);
      }
      bumpFailureReason("batch-create:exception");
      errors.push(`Batch create failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      if (debugFailFast) break;
    }
    if (debugFailFast && failed > 0) break;
  }

  // --- Batch updates ---
  if (!(debugFailFast && failed > 0)) {
    const updateChunks = chunk(toUpdate, BATCH_SIZE);
    for (const batch of updateChunks) {
      const contactsMap: Record<string, GooglePersonCreate> = {};
      for (const entry of batch) {
        contactsMap[entry.resourceName] = entry.body;
      }
      const batchReq: BatchUpdateRequest = {
        contacts: contactsMap,
        updateMask: BATCH_UPDATE_MASK,
        readMask: SYNC_PERSON_FIELDS,
      };
      try {
        const res = await fetchPeopleApi(
          "https://people.googleapis.com/v1/people:batchUpdateContacts",
          { method: "POST", headers, body: JSON.stringify(batchReq) },
          { operation: "batch-update", maxRetries: 3 }
        );
        if (res.ok) {
          const data = (await res.json()) as BatchUpdateResponse;
          const results = data.updateResult ?? {};
          for (const entry of batch) {
            const personRes = results[entry.resourceName];
            if (personRes?.httpStatusCode && personRes.httpStatusCode >= 400) {
              failed++;
              const msg = personRes.status?.message ?? `HTTP ${personRes.httpStatusCode}`;
              errors.push(`${entry.name}: batch update failed (${msg})`);
              bumpFailureReason(`batch-update:${personRes.httpStatusCode}`);
            } else {
              updated++;
            }
            processedCount++;
            onProgress?.(processedCount, contacts.length, entry.name);
          }
        } else {
          logGoogleSyncDebug("batch-update-failed-fallback", { status: res.status, batchSize: batch.length });
          // Fall back to individual updates for this batch
          for (const entry of batch) {
            try {
              const updatePersonFields = getUpdatePersonFields(entry.body);
              const updateUrl = `https://people.googleapis.com/v1/${entry.resourceName}:updateContact?updatePersonFields=${updatePersonFields}&personFields=${SYNC_PERSON_FIELDS}`;
              const individualRes = await fetchPeopleApi(
                updateUrl,
                { method: "PATCH", headers, body: JSON.stringify(entry.body) },
                { operation: "individual-update-fallback", contactRef: entry.name, maxRetries: 3 }
              );
              if (individualRes.ok) {
                updated++;
              } else {
                // Try stripping optional fields
                const fallbackBody = stripOptionalGoogleFields(entry.body);
                const fallbackFields = getUpdatePersonFields(fallbackBody);
                if (fallbackFields) {
                  const fallbackUrl = `https://people.googleapis.com/v1/${entry.resourceName}:updateContact?updatePersonFields=${fallbackFields}&personFields=${fallbackFields}`;
                  const fallbackRes = await fetchPeopleApi(
                    fallbackUrl,
                    { method: "PATCH", headers, body: JSON.stringify(fallbackBody) },
                    { operation: "individual-update-fallback-stripped", contactRef: entry.name, maxRetries: 2 }
                  );
                  if (fallbackRes.ok) {
                    updated++;
                  } else {
                    failed++;
                    const errText = await fallbackRes.text();
                    errors.push(`${entry.name}: ${formatGoogleApiError(fallbackRes.status, errText)}`);
                    bumpFailureReason(`update:${fallbackRes.status}`);
                    if (!firstFailureDebug) {
                      firstFailureDebug = {
                        contactRef: { id: entry.contact.id, name: entry.name, email: entry.contact.email ?? null, phone: entry.contact.phone ?? null },
                        operation: "individual-update-fallback",
                        url: parseUrlForDebug(fallbackUrl),
                        requestBody: fallbackBody,
                        status: fallbackRes.status,
                        ...parseGoogleApiErrorBody(errText),
                        rawErrorBody: errText,
                      };
                    }
                    if (debugFailFast) break;
                  }
                } else {
                  failed++;
                  const errText = await individualRes.text();
                  errors.push(`${entry.name}: ${formatGoogleApiError(individualRes.status, errText)}`);
                  bumpFailureReason(`update:${individualRes.status}`);
                  if (debugFailFast) break;
                }
              }
            } catch (e) {
              failed++;
              bumpFailureReason("update:exception");
              errors.push(`${entry.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
              if (debugFailFast) break;
            }
            processedCount++;
            onProgress?.(processedCount, contacts.length, entry.name);
          }
          if (debugFailFast && failed > 0) break;
        }
      } catch (e) {
        for (const entry of batch) {
          failed++;
          processedCount++;
          onProgress?.(processedCount, contacts.length, entry.name);
        }
        bumpFailureReason("batch-update:exception");
        errors.push(`Batch update failed: ${e instanceof Error ? e.message : "Unknown error"}`);
        if (debugFailFast) break;
      }
      if (debugFailFast && failed > 0) break;
    }
  }

  const summarizedReasons = Object.fromEntries(failureReasonSummary.entries());
  logGoogleSyncDebug("sync-finished", {
    created, updated, skipped, failed,
    errorCount: errors.length,
    debugFailFast,
    failureReasonSummary: summarizedReasons,
    firstFailureDebug,
  });
  return { created, updated, skipped, failed, errors, failureReasonSummary: summarizedReasons, firstFailureDebug };
}

export const useGoogleContacts = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
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

    // In desktop/Tauri (or other environments where popups are blocked), use redirect flow
    // so the user signs in in the same window instead of a popup.
    if (isDesktopOrNativeApp()) {
      try {
        const origin = getAuthRedirectOrigin();
        if (!origin) {
          toast.error("Cannot determine app URL for Google sign-in.");
          return;
        }
        const redirectUri = `${origin.replace(/\/+$/, "")}/auth`;
        const authUrl =
          "https://accounts.google.com/o/oauth2/v2/auth?" +
          `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=token` +
          `&scope=${encodeURIComponent(SCOPES)}` +
          `&state=${encodeURIComponent(GOOGLE_CONTACTS_STATE)}` +
          "&include_granted_scopes=true";
        try {
          sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, "1");
        } catch {
          // ignore
        }
        window.location.href = authUrl;
        return;
      } catch (e) {
        toast.error("Failed to start Google sign-in");
        console.error(e);
        return;
      }
    }

    setIsLoading(true);
    try {
      await loadGoogleScript();

      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (response: GoogleTokenResponse) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            setIsAuthenticated(true);
            await fetchContacts(response.access_token);
          } else {
            setIsAuthenticated(false);
            setAccessToken(null);
          }
          setIsLoading(false);
        },
        error_callback: (err) => {
          console.warn("[GoogleContacts] Sign-in error:", err);
          setIsLoading(false);
        },
      });

      client.requestAccessToken();
    } catch (error) {
      toast.error("Failed to sign in with Google");
      console.error(error);
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
      const apiHeaders = { Authorization: `Bearer ${token}` };

      do {
        const url = pageToken
          ? `${baseUrl}&pageToken=${encodeURIComponent(pageToken)}`
          : baseUrl;
        const response = await fetchPeopleApi(
          url,
          { headers: apiHeaders },
          { operation: "connections-read", maxRetries: 4 }
        );

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
    setAccessToken(null);
    setIsAuthenticated(false);
    setContacts([]);
  }, [accessToken]);

  // Consume token after redirect flow (desktop): check on mount and when window regains focus
  const consumePendingToken = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(GOOGLE_PENDING_TOKEN_KEY);
      if (!raw) return;
      sessionStorage.removeItem(GOOGLE_PENDING_TOKEN_KEY);
      const token = raw.trim();
      if (!token) return;
      setAccessToken(token);
      setIsAuthenticated(true);
      fetchContacts(token);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    consumePendingToken();
    const onFocus = () => consumePendingToken();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [consumePendingToken, enabled]);


  const clearContacts = useCallback(() => {
    setContacts([]);
  }, []);

  const syncToGoogle = useCallback(
    async (
      contactsToSync: Contact[],
      syncOptions?: GoogleSyncOptions
    ): Promise<GoogleSyncResult> => {
      if (!accessToken) {
        toast.error("Connect your Google account first");
        return {
          created: 0,
          updated: 0,
          skipped: 0,
          failed: contactsToSync.length,
          errors: ["Not authenticated"],
          failureReasonSummary: {},
        };
      }
      setIsSyncing(true);
      try {
        const result = await syncContactsToGoogle(contactsToSync, accessToken, syncOptions);
        if (result.dryRunPlan) return result;
        const parts: string[] = [];
        if (result.created > 0) parts.push(`${result.created} created`);
        if (result.updated > 0) parts.push(`${result.updated} updated`);
        if (parts.length > 0) {
          toast.success(`Synced to Google: ${parts.join(", ")}`);
        }
        if (result.failed > 0 && result.errors.length > 0) {
          const topReason = Object.entries(result.failureReasonSummary).sort((a, b) => b[1] - a[1])[0];
          const reasonSuffix = topReason ? ` Top reason: ${topReason[0]} (${topReason[1]}).` : "";
          toast.error(`${result.failed} failed. ${result.errors.slice(0, 2).join("; ")}${reasonSuffix}`);
        }
        logGoogleSyncDebug("sync-toast-summary", {
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
          failureReasonSummary: result.failureReasonSummary,
          firstFailureDebug: result.firstFailureDebug,
        });
        return result;
      } catch (e) {
        toast.error("Failed to sync to Google");
        console.error(e);
        return {
          created: 0,
          updated: 0,
          skipped: 0,
          failed: contactsToSync.length,
          errors: [e instanceof Error ? e.message : "Unknown error"],
          failureReasonSummary: {},
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
          error_callback?: (error: { type: string; message?: string }) => void;
        }) => { requestAccessToken: (options?: { prompt?: string }) => void };
        revoke: (token: string, callback: () => void) => void;
      };
    };
  };
}
