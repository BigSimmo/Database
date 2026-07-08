import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "../src/lib/security-headers";

// Regression guard for the "all images fail to render" incident. Document page
// images and the PDF embed load cross-origin from Supabase Storage signed URLs
// (*.supabase.co). Two header mistakes silently break every image in the browser
// while all server-side tests still pass:
//   1. Cross-Origin-Embedder-Policy: require-corp — blocks cross-origin
//      subresources that lack a CORP/CORS opt-in (Supabase does not send one).
//   2. A CSP that stops allowing https: images or the *.supabase.co origin.
// These assertions fail loudly if either is reintroduced.

const flagVariants = [
  { name: "production", isDevelopment: false, isLocalHttpRuntime: false },
  { name: "local dev", isDevelopment: true, isLocalHttpRuntime: true },
  { name: "playwright local http", isDevelopment: false, isLocalHttpRuntime: true },
] as const;

describe("security headers", () => {
  for (const flags of flagVariants) {
    describe(flags.name, () => {
      const headers = buildSecurityHeaders(flags);
      const byKey = new Map(headers.map((header) => [header.key, header.value]));
      const csp = buildContentSecurityPolicy(flags);

      it("never sets Cross-Origin-Embedder-Policy (would block cross-origin Supabase images)", () => {
        expect(byKey.has("Cross-Origin-Embedder-Policy")).toBe(false);
        expect(headers.some((header) => /require-corp/i.test(header.value))).toBe(false);
      });

      it("allows https: images so Supabase Storage signed-URL images can load", () => {
        const imgSrc = csp.split(";").find((directive) => directive.trim().startsWith("img-src"));
        expect(imgSrc).toBeDefined();
        expect(imgSrc).toContain("https:");
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
    const prod = buildContentSecurityPolicy({ isDevelopment: false, isLocalHttpRuntime: false });
    const dev = buildContentSecurityPolicy({ isDevelopment: true, isLocalHttpRuntime: true });

    expect(dev).toContain("'unsafe-eval'");
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).toContain("upgrade-insecure-requests");
    expect(dev).not.toContain("upgrade-insecure-requests");

    const prodHeaders = buildSecurityHeaders({ isDevelopment: false, isLocalHttpRuntime: false });
    const localHeaders = buildSecurityHeaders({ isDevelopment: true, isLocalHttpRuntime: true });
    expect(prodHeaders.some((header) => header.key === "Strict-Transport-Security")).toBe(true);
    expect(localHeaders.some((header) => header.key === "Strict-Transport-Security")).toBe(false);
  });
});
