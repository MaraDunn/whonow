/**
 * Signed OAuth state to prevent state tampering (e.g. binding token to wrong userId).
 * When OAUTH_STATE_SECRET is set, state is signed with HMAC-SHA256; on callback we verify
 * and only then trust userId. When unset, legacy unsigned state is used (backward compat).
 */

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array | null {
  try {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function signPayload(secret: string, payloadJson: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadJson));
  return base64urlEncode(new Uint8Array(sig));
}

async function verifySignature(secret: string, payloadJson: string, signatureB64: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["verify"]
  );
  const sigBytes = base64urlDecode(signatureB64);
  if (!sigBytes) return false;
  return crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payloadJson));
}

export type OAuthStatePayload = {
  userId: string;
  origin?: string;
  scope?: string;
};

/**
 * Create state string for OAuth redirect. If OAUTH_STATE_SECRET is set, returns signed state
 * (payloadBase64url.signatureBase64url). Otherwise returns legacy encodeURIComponent(JSON.stringify(payload)).
 */
export async function createOAuthState(
  secret: string | undefined,
  payload: OAuthStatePayload
): Promise<string> {
  const payloadJson = JSON.stringify(payload);
  if (!secret || secret.length < 16) {
    return encodeURIComponent(payloadJson);
  }
  const signature = await signPayload(secret, payloadJson);
  const payloadB64 = base64urlEncode(new TextEncoder().encode(payloadJson));
  return `${payloadB64}.${signature}`;
}

/**
 * Parse and verify state from OAuth callback. If secret is set and state looks signed (contains "."),
 * verifies signature and returns payload or null. Otherwise parses legacy format (JSON or raw userId).
 */
export async function parseOAuthState(
  secret: string | undefined,
  state: string | null
): Promise<OAuthStatePayload | null> {
  if (!state || !state.trim()) return null;

  const trimmed = state.trim();

  // Signed format: base64url.base64url
  if (secret && secret.length >= 16 && trimmed.includes(".")) {
    const dot = trimmed.indexOf(".");
    const payloadB64 = trimmed.slice(0, dot);
    const signatureB64 = trimmed.slice(dot + 1);
    const payloadBytes = base64urlDecode(payloadB64);
    if (!payloadBytes) return null;
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const valid = await verifySignature(secret, payloadJson, signatureB64);
    if (!valid) return null;
    try {
      const parsed = JSON.parse(payloadJson) as OAuthStatePayload;
      if (typeof parsed.userId !== "string" || !parsed.userId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  // Legacy: JSON string (possibly URI-encoded)
  try {
    const decoded = decodeURIComponent(trimmed);
    const parsed = JSON.parse(decoded) as OAuthStatePayload;
    if (typeof parsed.userId !== "string" || !parsed.userId) return null;
    return parsed;
  } catch {
    // Legacy: state was raw user ID
    if (trimmed.length > 0 && trimmed.length < 512) {
      return { userId: trimmed };
    }
    return null;
  }
}
