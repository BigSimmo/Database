// Central definition of the security response headers applied to every route
// (wired into next.config.ts `headers()`). Kept in its own module so the header
// contract can be unit-tested — see tests/security-headers.test.ts.
//
// IMPORTANT — do NOT add `Cross-Origin-Embedder-Policy: require-corp` here.
// Under require-corp the browser blocks every cross-origin subresource that
// lacks a CORP/CORS opt-in. Document page images and the PDF embed are served
// from Supabase Storage signed URLs (*.supabase.co, a different origin), and
// those responses do not send a CORP header — so COEP require-corp makes every
// image preview fail to render ("Image preview failed"). Nothing in the browser
// app relies on cross-origin isolation (no SharedArrayBuffer / crossOriginIsolated
// usage), so COEP is omitted rather than reintroducing that failure mode.

export type SecurityHeader = { key: string; value: string };

export type SecurityHeaderFlags = {
  // Next.js dev server: allows `unsafe-eval` in the script-src for React refresh.
  isDevelopment: boolean;
  // Local http runtime (dev or Playwright against http://localhost): skip
  // HTTPS-only hardening (upgrade-insecure-requests, HSTS) that would break http.
  isLocalHttpRuntime: boolean;
};

export function buildContentSecurityPolicy({ isDevelopment, isLocalHttpRuntime }: SecurityHeaderFlags): string {
  const scriptSrc = `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}; `;
  const upgradeInsecureRequests = isLocalHttpRuntime ? "" : "upgrade-insecure-requests; ";

  return (
    "default-src 'self'; " +
    "base-uri 'self'; " +
    "object-src 'none'; " +
    "frame-ancestors 'none'; " +
    "form-action 'self'; " +
    upgradeInsecureRequests +
    // img-src must allow https: so cross-origin Supabase Storage signed-URL
    // images (document pages) can load. connect-src must include *.supabase.co
    // for the signed-URL/API fetches.
    "img-src 'self' data: blob: https:; " +
    "media-src 'self' https:; " +
    "connect-src 'self' https://*.supabase.co https://api.openai.com; " +
    scriptSrc +
    "style-src 'self' 'unsafe-inline'"
  );
}

export function buildSecurityHeaders(flags: SecurityHeaderFlags): SecurityHeader[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-site" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // No Cross-Origin-Embedder-Policy — see module header note.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Origin-Agent-Cluster", value: "?1" },
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(flags) },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ...(flags.isLocalHttpRuntime
      ? []
      : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
  ];
}
