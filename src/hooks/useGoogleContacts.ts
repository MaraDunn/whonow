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
  names?: Array<{ displayName?: string }>;
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
  metadata?: { sources?: Array<{ etag?: string }> };
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
export const GOOGLE_REDIRECT_PENDING_KEY = "whonow.googleContacts.redirectPending";
export const GOOGLE_PENDING_TOKEN_KEY = "whonow.googleContacts.pendingToken";
const GOOGLE_CONTACTS_STATE = "google_contacts";
const GOOGLE_SYNC_DEBUG =
  import.meta.env.DEV || String(import.meta.env.VITE_GOOGLE_SYNC_DEBUG ?? "").toLowerCase() === "true";
const WRITE_THROTTLE_MS = 180;

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
  maxWriteAttemptsPerContact?: number;
};

type GoogleSyncResult = {
  created: number;
  updated: number;
  failed: number;
  errors: string[];
  failureReasonSummary: Record<string, number>;
  firstFailureDebug?: GoogleSyncFailureDebug;
};

const GOOGLE_SYNC_FAIL_FAST =
  String(import.meta.env.VITE_GOOGLE_SYNC_FAIL_FAST ?? "").toLowerCase() === "true";
const GOOGLE_SYNC_MAX_WRITE_ATTEMPTS_PER_CONTACT = 3;
const WRITE_THROTTLE_MAX_MS = 5000;

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
  return classification === "not_found";
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
    body.metadata = {
      sources: [
        omitUndefined({
          etag: contactSource.etag.trim(),
        }),
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
    names: body.names,
    emailAddresses: body.emailAddresses,
    phoneNumbers: body.phoneNumbers,
    organizations: body.organizations,
    metadata: body.metadata,
  };
}

/**
 * Sync WhoNow contacts to Google: update existing (matched by email or phone) or create new.
 * Runs sequentially. Skips contacts without a name. Returns created, updated, failed, errors.
 */
export async function syncContactsToGoogle(
  contacts: Contact[],
  accessToken: string,
  options?: GoogleSyncOptions
): Promise<GoogleSyncResult> {
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];
  const failureReasonSummary = new Map<string, number>();
  let firstFailureDebug: GoogleSyncFailureDebug | undefined;
  const debugFailFast = options?.debugFailFast ?? shouldDebugFailFast();
  const maxWriteAttemptsPerContact = Math.max(
    1,
    options?.maxWriteAttemptsPerContact ?? GOOGLE_SYNC_MAX_WRITE_ATTEMPTS_PER_CONTACT
  );
  let writeThrottleMs = WRITE_THROTTLE_MS;

  const bumpFailureReason = (key: string) => {
    failureReasonSummary.set(key, (failureReasonSummary.get(key) ?? 0) + 1);
  };

  const updateWriteThrottle = (status: number) => {
    if (status === 429) {
      writeThrottleMs = Math.min(WRITE_THROTTLE_MAX_MS, Math.round(writeThrottleMs * 1.6 + 200));
      return;
    }
    if (status >= 200 && status < 300) {
      writeThrottleMs = Math.max(WRITE_THROTTLE_MS, Math.round(writeThrottleMs * 0.9));
      return;
    }
    writeThrottleMs = Math.min(WRITE_THROTTLE_MAX_MS, Math.round(writeThrottleMs * 1.1));
  };

  let index: { byEmail: Map<string, ConnectionIndexEntry>; byPhone: Map<string, ConnectionIndexEntry> };
  try {
    index = await fetchGoogleConnectionsIndex(accessToken);
  } catch (e) {
    return {
      created: 0,
      updated: 0,
      failed: contacts.length,
      errors: [e instanceof Error ? e.message : "Failed to fetch Google contacts"],
      failureReasonSummary: {},
    };
  }

  const createUrl = `https://people.googleapis.com/v1/people:createContact?personFields=${SYNC_PERSON_FIELDS}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  logGoogleSyncDebug("sync-start", { contactCount: contacts.length });

  for (const c of contacts) {
    const contactRef = {
      id: c.id,
      name: (c.name ?? "").trim() || "(no-name)",
      email: (c.email ?? "").trim() || null,
      phone: (c.phone ?? "").trim() || null,
    };
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
      let sourceForUpdate = existing.contactSource;
      let body = contactToGooglePerson(c, sourceForUpdate);
      let updatePersonFields = getUpdatePersonFields(body);
      if (!updatePersonFields) {
        failed++;
        errors.push(`${name}: nothing to update`);
        bumpFailureReason("skip:nothing_to_update");
        continue;
      }
      const buildUpdateUrl = (fields: string, returnFields: string) =>
        `https://people.googleapis.com/v1/${existing.resourceName}:updateContact?updatePersonFields=${fields}&personFields=${returnFields}`;
      let updateUrl = buildUpdateUrl(updatePersonFields, SYNC_PERSON_FIELDS);
      let writeAttempts = 0;

      const runWrite = async (
        url: string,
        requestBody: GooglePersonCreate,
        operation: string
      ): Promise<Response | null> => {
        if (writeAttempts >= maxWriteAttemptsPerContact) return null;
        writeAttempts++;
        await sleep(writeThrottleMs);
        const response = await fetchPeopleApi(
          url,
          { method: "PATCH", headers, body: JSON.stringify(requestBody) },
          {
            operation,
            contactRef: `${contactRef.name}:${contactRef.email ?? contactRef.phone ?? c.id}`,
            maxRetries: 5,
          }
        );
        updateWriteThrottle(response.status);
        return response;
      };

      try {
        logGoogleSyncDebug("update-attempt", {
          contactRef,
          resourceName: existing.resourceName,
          updatePersonFields,
          hasMetadataSource: !!sourceForUpdate?.etag,
          hasAddresses: !!body.addresses?.length,
          hasBiographies: !!body.biographies?.length,
          writeAttempts,
          writeThrottleMs,
        });
        let res = await runWrite(updateUrl, body, "update-contact");
        if (!res) {
          failed++;
          bumpFailureReason("update:attempt_cap_reached");
          errors.push(`${name}: stopped after ${maxWriteAttemptsPerContact} write attempts`);
          if (debugFailFast) break;
          continue;
        }

        if (!res.ok && res.status === 400) {
          const initialBodyText = await res.clone().text();
          const initialClassified = classifyGoogleError(res.status, initialBodyText);
          bumpFailureReason(initialClassified.reasonKey);

          if (initialClassified.classification === "etag_conflict") {
            const refreshedSource = await fetchLatestContactSource(accessToken, existing.resourceName);
            if (refreshedSource?.etag?.trim()) {
              sourceForUpdate = refreshedSource;
              body = contactToGooglePerson(c, sourceForUpdate);
              updatePersonFields = getUpdatePersonFields(body);
              updateUrl = buildUpdateUrl(updatePersonFields, SYNC_PERSON_FIELDS);
              logGoogleSyncDebug("update-etag-refresh-retry", {
                contactRef,
                resourceName: existing.resourceName,
                updatePersonFields,
                writeAttempts,
              });
              const retryRes = await runWrite(updateUrl, body, "update-contact-after-etag-refresh");
              if (retryRes) {
                res = retryRes;
              }
            }
          }
        }

        if (!res.ok && res.status === 400) {
          const currentBodyText = await res.clone().text();
          const currentClassified = classifyGoogleError(res.status, currentBodyText);
          bumpFailureReason(currentClassified.reasonKey);

          if (currentClassified.classification === "invalid_payload") {
            logGoogleSyncDebug("update-invalid-payload-stop", {
              contactRef,
              reason: currentClassified.reason,
              statusText: currentClassified.statusText,
            });
          } else {
          const fallbackBody = stripOptionalGoogleFields(body);
          const fallbackFields = getUpdatePersonFields(fallbackBody);
          if (fallbackFields) {
              const fallbackUrl = buildUpdateUrl(fallbackFields, fallbackFields);
            logGoogleSyncDebug("update-fallback-attempt", {
              contactRef,
              fallbackFields,
              strippedAddresses: !!body.addresses?.length,
              strippedBiographies: !!body.biographies?.length,
                writeAttempts,
            });
              const fallbackRes = await runWrite(fallbackUrl, fallbackBody, "update-contact-fallback");
              if (fallbackRes) {
                res = fallbackRes;
              }
            }
          }
        }

        if (res.ok) {
          updated++;
        } else {
          const updateErrText = await res.text();
          const updateErr = formatGoogleApiError(res.status, updateErrText);
          const updateClassified = classifyGoogleError(res.status, updateErrText);
          bumpFailureReason(updateClassified.reasonKey);

          const failureDebug: GoogleSyncFailureDebug = {
            contactRef,
            operation: "update-contact",
            url: parseUrlForDebug(updateUrl),
            requestBody: body,
            status: res.status,
            reason: updateClassified.reason,
            statusText: updateClassified.statusText,
            message: updateClassified.message,
            rawErrorBody: updateErrText,
          };
          if (!firstFailureDebug) {
            firstFailureDebug = failureDebug;
          }

          logGoogleSyncDebug("update-failed", {
            contactRef,
            status: res.status,
            error: updateErr,
            updatePersonFields,
            reason: updateClassified.reason,
            statusText: updateClassified.statusText,
            writeAttempts,
            maxWriteAttemptsPerContact,
            failureDebug,
          });

          if (shouldAttemptCreateAfterUpdateFailure(updateClassified.classification)) {
            const createBody = contactToGooglePerson(c);
            await sleep(writeThrottleMs);
            const createRes = await fetchPeopleApi(
              createUrl,
              { method: "POST", headers, body: JSON.stringify(createBody) },
              {
                operation: "create-after-update-failed",
                contactRef: `${contactRef.name}:${contactRef.email ?? contactRef.phone ?? c.id}`,
                maxRetries: 5,
              }
            );
            updateWriteThrottle(createRes.status);
            if (createRes.ok) {
              created++;
            } else {
              failed++;
              const createErrText = await createRes.text();
              const createErr = formatGoogleApiError(createRes.status, createErrText);
              const createClassified = classifyGoogleError(createRes.status, createErrText);
              bumpFailureReason(createClassified.reasonKey);
              errors.push(`${name}: update failed (${updateErr}), create failed (${createErr})`);
              logGoogleSyncDebug("create-after-update-failed", {
                contactRef,
                updateError: updateErr,
                createError: createErr,
                reason: createClassified.reason,
                statusText: createClassified.statusText,
              });
            }
          } else {
            failed++;
            errors.push(`${name}: ${updateErr}`);
          }

          if (debugFailFast) {
            logGoogleSyncDebug("debug-fail-fast-stop", {
              contactRef,
              reason: updateClassified.reason,
              statusText: updateClassified.statusText,
              status: res.status,
            });
            break;
          }
        }
      } catch (e) {
        failed++;
        bumpFailureReason("update:exception");
        errors.push(`${name}: ${e instanceof Error ? e.message : "Unknown error"}`);
        if (debugFailFast) break;
      }
    } else {
      const body = contactToGooglePerson(c);
      try {
        let writeAttempts = 0;
        const runCreate = async (
          requestBody: GooglePersonCreate,
          operation: string
        ): Promise<Response | null> => {
          if (writeAttempts >= maxWriteAttemptsPerContact) return null;
          writeAttempts++;
          await sleep(writeThrottleMs);
          const response = await fetchPeopleApi(
            createUrl,
            { method: "POST", headers, body: JSON.stringify(requestBody) },
            {
              operation,
              contactRef: `${contactRef.name}:${contactRef.email ?? contactRef.phone ?? c.id}`,
              maxRetries: 5,
            }
          );
          updateWriteThrottle(response.status);
          return response;
        };

        logGoogleSyncDebug("create-attempt", {
          contactRef,
          hasAddresses: !!body.addresses?.length,
          hasBiographies: !!body.biographies?.length,
          writeAttempts,
          writeThrottleMs,
        });
        let res = await runCreate(body, "create-contact");
        if (!res) {
          failed++;
          bumpFailureReason("create:attempt_cap_reached");
          errors.push(`${name}: stopped after ${maxWriteAttemptsPerContact} write attempts`);
          if (debugFailFast) break;
          continue;
        }
        if (!res.ok && res.status === 400) {
          const firstErrText = await res.clone().text();
          const firstClassified = classifyGoogleError(res.status, firstErrText);
          bumpFailureReason(firstClassified.reasonKey);
          const fallbackBody = stripOptionalGoogleFields(body);
          logGoogleSyncDebug("create-fallback-attempt", {
            contactRef,
            strippedAddresses: !!body.addresses?.length,
            strippedBiographies: !!body.biographies?.length,
            writeAttempts,
          });
          const fallbackRes = await runCreate(fallbackBody, "create-contact-fallback");
          if (fallbackRes) {
            res = fallbackRes;
          }
        }
        if (res.ok) {
          created++;
        } else {
          failed++;
          const errText = await res.text();
          const createErr = formatGoogleApiError(res.status, errText);
          const classified = classifyGoogleError(res.status, errText);
          bumpFailureReason(classified.reasonKey);
          const failureDebug: GoogleSyncFailureDebug = {
            contactRef,
            operation: "create-contact",
            url: parseUrlForDebug(createUrl),
            requestBody: body,
            status: res.status,
            reason: classified.reason,
            statusText: classified.statusText,
            message: classified.message,
            rawErrorBody: errText,
          };
          if (!firstFailureDebug) {
            firstFailureDebug = failureDebug;
          }
          errors.push(`${name}: ${createErr}`);
          logGoogleSyncDebug("create-failed", {
            contactRef,
            status: res.status,
            error: createErr,
            reason: classified.reason,
            statusText: classified.statusText,
            writeAttempts,
            maxWriteAttemptsPerContact,
            failureDebug,
          });
          if (debugFailFast) {
            logGoogleSyncDebug("debug-fail-fast-stop", {
              contactRef,
              reason: classified.reason,
              statusText: classified.statusText,
              status: res.status,
            });
            break;
          }
        }
      } catch (e) {
        failed++;
        bumpFailureReason("create:exception");
        errors.push(`${name}: ${e instanceof Error ? e.message : "Unknown error"}`);
        if (debugFailFast) break;
      }
    }
  }

  const summarizedReasons = Object.fromEntries(failureReasonSummary.entries());
  logGoogleSyncDebug("sync-finished", {
    created,
    updated,
    failed,
    errorCount: errors.length,
    debugFailFast,
    maxWriteAttemptsPerContact,
    finalWriteThrottleMs: writeThrottleMs,
    failureReasonSummary: summarizedReasons,
    firstFailureDebug,
  });
  return { created, updated, failed, errors, failureReasonSummary: summarizedReasons, firstFailureDebug };
}

export const useGoogleContacts = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
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
    setConnectedPreference(false);
    setAccessToken(null);
    setIsAuthenticated(false);
    setContacts([]);
  }, [accessToken, setConnectedPreference]);

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
      setConnectedPreference(true);
      fetchContacts(token);
    } catch {
      // ignore
    }
  }, [setConnectedPreference]);

  useEffect(() => {
    if (!enabled) return;
    consumePendingToken();
    const onFocus = () => consumePendingToken();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [consumePendingToken, enabled]);

  useEffect(() => {
    if (!enabled) return;
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
  }, [shouldRestoreConnection, enabled]);

  const clearContacts = useCallback(() => {
    setContacts([]);
  }, []);

  const syncToGoogle = useCallback(
    async (
      contactsToSync: Contact[]
    ): Promise<GoogleSyncResult> => {
      if (!accessToken) {
        toast.error("Connect your Google account first");
        return {
          created: 0,
          updated: 0,
          failed: contactsToSync.length,
          errors: ["Not authenticated"],
          failureReasonSummary: {},
        };
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
          const topReason = Object.entries(result.failureReasonSummary).sort((a, b) => b[1] - a[1])[0];
          const reasonSuffix = topReason ? ` Top reason: ${topReason[0]} (${topReason[1]}).` : "";
          toast.error(`${result.failed} failed. ${result.errors.slice(0, 2).join("; ")}${reasonSuffix}`);
        }
        logGoogleSyncDebug("sync-toast-summary", {
          created: result.created,
          updated: result.updated,
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
        }) => { requestAccessToken: (options?: { prompt?: string }) => void };
        revoke: (token: string, callback: () => void) => void;
      };
    };
  };
}
