import { createHmac, timingSafeEqual } from "node:crypto";

function getProxyAuthSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.INTERNAL_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "internal-proxy-auth-signing-key"
  );
}

/**
 * Digitally signs a base64-encoded user payload with HMAC-SHA256.
 * Format: `<base64Payload>.<base64urlSignature>`
 */
export function signProxyAuthPayload(payloadBase64: string): string {
  const secret = getProxyAuthSecret();
  const signature = createHmac("sha256", secret).update(payloadBase64).digest("base64url");
  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies the HMAC-SHA256 signature on the proxy auth header value.
 * Returns the verified base64 payload if valid, or null if tampered/invalid.
 */
export function verifyProxyAuthHeader(headerValue: string): string | null {
  const dotIndex = headerValue.lastIndexOf(".");
  if (dotIndex <= 0) return null;

  const payloadBase64 = headerValue.slice(0, dotIndex);
  const signature = headerValue.slice(dotIndex + 1);
  if (!payloadBase64 || !signature) return null;

  const secret = getProxyAuthSecret();
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
