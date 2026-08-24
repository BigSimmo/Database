import { createHmac, timingSafeEqual } from "node:crypto";

function getProxyAuthSecret(): string | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.INTERNAL_SERVICE_KEY;
  const trimmed = secret?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Digitally signs a base64-encoded user payload with HMAC-SHA256.
 * Format: `<base64Payload>.<base64urlSignature>`
 * Returns null when no server-only signing secret is configured (fail closed).
 */
export function signProxyAuthPayload(payloadBase64: string): string | null {
  const secret = getProxyAuthSecret();
  if (!secret) return null;
  const signature = createHmac("sha256", secret).update(payloadBase64).digest("base64url");
  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies the HMAC-SHA256 signature on the proxy auth header value.
 * Returns the verified base64 payload if valid, or null if tampered/invalid.
 */
export function verifyProxyAuthHeader(headerValue: string): string | null {
  const secret = getProxyAuthSecret();
  if (!secret) return null;

  const dotIndex = headerValue.lastIndexOf(".");
  if (dotIndex <= 0) return null;

  const payloadBase64 = headerValue.slice(0, dotIndex);
  const signature = headerValue.slice(dotIndex + 1);
  if (!payloadBase64 || !signature) return null;

  const expectedSignature = createHmac("sha256", secret).update(payloadBase64).digest("base64url");

  try {
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expectedSignature, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return payloadBase64;
    }
  } catch {
    return null;
  }
  return null;
}
