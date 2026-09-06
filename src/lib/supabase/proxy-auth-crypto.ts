import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * How long a signed proxy claims header stays acceptable.
 *
 * The proxy signs the header and the route handler verifies it inside the same request, in the
 * same deployment, so a minute is generous. The point of the bound is that a header captured from
 * a log, a crash dump, or a request that escaped the proxy's unconditional strip cannot be
 * replayed as a bearer credential for the rest of the key's life.
 */
export const PROXY_AUTH_CLAIMS_MAX_AGE_SECONDS = 60;

/** Tolerance for a header stamped slightly ahead of the verifier's clock. */
const PROXY_AUTH_CLAIMS_FUTURE_SKEW_SECONDS = 5;

/**
 * Fixed HKDF label. Changing it rotates every signing key derived from the same service-role key,
 * which invalidates in-flight headers (they live for at most a minute) but nothing durable.
 */
const PROXY_AUTH_HKDF_INFO = "psychsift:proxy-auth-claims:v1";

/**
 * The service-role key is the database's master credential. Signing with it directly means one
 * secret does two unrelated jobs, so a signing oracle anywhere would be an oracle on the database
 * key. HKDF gives this one purpose its own key, and the derivation is one-way.
 *
 * Returns null when no server-only secret is configured, so signing and verification both fail
 * closed rather than falling back to a weaker or client-visible secret. There is deliberately no
 * second env name here: an undeclared fallback secret is a name no schema, `.env.example`, or
 * env-parity check can vouch for.
 */
function getProxyAuthSigningKey(): Buffer | null {
  const trimmed = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!trimmed) return null;
  return Buffer.from(hkdfSync("sha256", Buffer.from(trimmed, "utf8"), Buffer.alloc(0), PROXY_AUTH_HKDF_INFO, 32));
}

/** The exact bytes covered by the signature: claims and issued-at together, so neither can move. */
function signedMessage(payloadBase64: string, issuedAtSeconds: number) {
  return `${payloadBase64}.${issuedAtSeconds}`;
}

/**
 * Signs a base64-encoded user payload with HMAC-SHA256 under a derived key.
 * Format: `<base64Payload>.<issuedAtSeconds>.<base64urlSignature>`
 * Returns null when no server-only signing secret is configured (fail closed).
 */
export function signProxyAuthPayload(payloadBase64: string): string | null {
  const key = getProxyAuthSigningKey();
  if (!key) return null;
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", key).update(signedMessage(payloadBase64, issuedAtSeconds)).digest("base64url");
  return `${payloadBase64}.${issuedAtSeconds}.${signature}`;
}

/**
 * Verifies the signature and freshness of the proxy auth header value.
 * Returns the verified base64 payload if valid, or null if unsigned, tampered, malformed, or stale.
 */
export function verifyProxyAuthHeader(headerValue: string): string | null {
  const key = getProxyAuthSigningKey();
  if (!key) return null;

  // Exactly three parts: the two-part envelope that predates the issued-at carried no freshness
  // bound at all, so it is rejected rather than accepted for compatibility.
  const parts = headerValue.split(".");
  if (parts.length !== 3) return null;
  const [payloadBase64, issuedAtRaw, signature] = parts;
  if (!payloadBase64 || !issuedAtRaw || !signature) return null;

  if (!/^\d+$/.test(issuedAtRaw)) return null;
  const issuedAtSeconds = Number(issuedAtRaw);
  if (!Number.isSafeInteger(issuedAtSeconds)) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = nowSeconds - issuedAtSeconds;
  if (ageSeconds > PROXY_AUTH_CLAIMS_MAX_AGE_SECONDS) return null;
  if (ageSeconds < -PROXY_AUTH_CLAIMS_FUTURE_SKEW_SECONDS) return null;

  const expectedSignature = createHmac("sha256", key)
    .update(signedMessage(payloadBase64, issuedAtSeconds))
    .digest("base64url");

  try {
    // Constant-time: never let comparison timing reveal how much of a forged signature was right.
    const provided = Buffer.from(signature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return payloadBase64;
    }
  } catch {
    return null;
  }
  return null;
}
