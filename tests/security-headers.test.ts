import { afterEach, describe, expect, it, vi } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders, resolveRuntimeFlags } from "../src/lib/security-headers";

// Regression guard for the "all images fail to render" incident. Document page
// images and the PDF embed load cross-origin from Supabase Storage signed URLs
// (*.supabase.co). Two header mistakes silently break every image in the browser
// while all server-side tests still pass:
//   1. Cross-Origin-Embedder-Policy: require-corp — blocks cross-origin
//      subresources that lack a CORP/CORS opt-in (Supabase does not send one).
//   2. A CSP that stops allowing the *.supabase.co image origin.
// These assertions fail loudly if either is reintroduced.

const flagVariants = [
  { name: "production", isDevelopment: false, isLocalHttpRuntime: false },
  { name: "local dev", isDevelopment: true, isLocalHttpRuntime: true },
  { name: "playwright local http", isDevelopment: false, isLocalHttpRuntime: true },
] as const;

const NONCE = "dGVzdC1ub25jZQ==";

describe("security headers", () => {
  for (const flags of flagVariants) {
    describe(flags.name, () => {
      const headers = buildSecurityHeaders(flags);
      const byKey = new Map(headers.map((header) => [header.key, header.value]));
      const csp = buildContentSecurityPolicy({ ...flags, nonce: NONCE });

      it("never sets Cross-Origin-Embedder-Policy (would block cross-origin Supabase images)", () => {
        expect(byKey.has("Cross-Origin-Embedder-Policy")).toBe(false);
        expect(headers.some((header) => /require-corp/i.test(header.value))).toBe(false);
      });

      it("scopes img-src to the Supabase Storage origin (no bare https: wildcard)", () => {
        const imgSrc = csp.split(";").find((directive) => directive.trim().startsWith("img-src"));
        expect(imgSrc).toBeDefined();
        const sources = imgSrc!.trim().split(/\s+/);
        // Supabase signed-URL images still load, but a broad `https:` wildcard is not allowed.
        expect(sources).toContain("https://*.supabase.co");
        expect(sources).not.toContain("https:");
      });

      it("allows the Supabase origin in connect-src for signed-URL/API fetches", () => {
        const connectSrc = csp.split(";").find((directive) => directive.trim().startsWith("connect-src"));
        expect(connectSrc).toBeDefined();
        expect(connectSrc).toContain("https://*.supabase.co");
      });

      it("keeps the baseline hardening headers", () => {
        expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
        expect(byKey.get("X-Frame-Options")).toBe("DENY");
        expect(byKey.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
      });
    });
  }

  it("only emits unsafe-eval in development and HSTS/upgrade-insecure-requests off local http", () => {
    const prod = buildContentSecurityPolicy({ isDevelopment: false, isLocalHttpRuntime: false, nonce: NONCE });
    const dev = buildContentSecurityPolicy({ isDevelopment: true, isLocalHttpRuntime: true, nonce: NONCE });

    expect(dev).toContain("'unsafe-eval'");
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).toContain("upgrade-insecure-requests");
    expect(dev).not.toContain("upgrade-insecure-requests");

    const prodHeaders = buildSecurityHeaders({ isDevelopment: false, isLocalHttpRuntime: false });
    const localHeaders = buildSecurityHeaders({ isDevelopment: true, isLocalHttpRuntime: true });
    expect(prodHeaders.some((header) => header.key === "Strict-Transport-Security")).toBe(true);
    expect(localHeaders.some((header) => header.key === "Strict-Transport-Security")).toBe(false);
  });

  // Nonce migration (L19): in production script-src is nonce + strict-dynamic and
  // never 'unsafe-inline'. A missed inline script fails silently at runtime, so
  // this guards the policy shape that makes the nonce the only way scripts run.
  it("gates production script-src on the nonce with strict-dynamic and no unsafe-inline", () => {
    const csp = buildContentSecurityPolicy({ isDevelopment: false, isLocalHttpRuntime: false, nonce: NONCE });
    const scriptSrc = csp.split(";").find((directive) => directive.trim().startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  // Development keeps the pre-migration script-src: 'unsafe-inline' + 'unsafe-eval'
  // and NO 'strict-dynamic'. The Turbopack dev server injects HMR/runtime and
  // route-chunk <script src> tags that carry no nonce; 'strict-dynamic' would
  // disable the 'self' allow-list and block them all. See buildContentSecurityPolicy.
  it("keeps the permissive, nonce-free script-src in development", () => {
    const csp = buildContentSecurityPolicy({ isDevelopment: true, isLocalHttpRuntime: true, nonce: NONCE });
    const scriptSrc = csp.split(";").find((directive) => directive.trim().startsWith("script-src"));
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'nonce-");
  });

  // style-src still relies on 'unsafe-inline' (Next font + inline styles are not
  // nonce-tagged); the migration only hardened script-src.
  it("keeps style-src 'unsafe-inline'", () => {
    const csp = buildContentSecurityPolicy({ isDevelopment: false, isLocalHttpRuntime: false, nonce: NONCE });
    const styleSrc = csp.split(";").find((directive) => directive.trim().startsWith("style-src"));
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  // CSP is emitted per-request from proxy.ts (it carries a nonce), so the static
  // header set must not also emit it — two CSP headers would be enforced as their
  // intersection and break the app.
  it("does not emit Content-Security-Policy in the static header set", () => {
    for (const flags of flagVariants) {
      const headers = buildSecurityHeaders(flags);
      expect(headers.some((header) => header.key === "Content-Security-Policy")).toBe(false);
    }
  });

  // Single source of truth shared by next.config.ts and proxy.ts. The
  // isLocalHttpRuntime flag gates HTTPS-only hardening (HSTS,
  // upgrade-insecure-requests), so its derivation is security-relevant.
  describe("resolveRuntimeFlags", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("treats development as local http", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
      expect(resolveRuntimeFlags()).toEqual({ isDevelopment: true, isLocalHttpRuntime: true });
    });

    it("keeps production HTTPS-hardened unless Playwright targets local http", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
      expect(resolveRuntimeFlags()).toEqual({ isDevelopment: false, isLocalHttpRuntime: false });

      vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://localhost:4788");
      expect(resolveRuntimeFlags()).toEqual({ isDevelopment: false, isLocalHttpRuntime: true });

      vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://staging.example.com");
      expect(resolveRuntimeFlags()).toEqual({ isDevelopment: false, isLocalHttpRuntime: false });
    });
  });
});
