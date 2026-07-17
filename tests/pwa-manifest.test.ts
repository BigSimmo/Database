import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../src/app/manifest";
import { APP_THEME_COLORS, DEFAULT_THEME } from "../src/lib/theme";

describe("PWA manifest and public bootstrap resources", () => {
  const appManifest = manifest();

  it("defines a stable, scoped, standalone application identity", () => {
    expect(appManifest).toMatchObject({
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      lang: "en-AU",
      dir: "ltr",
      background_color: APP_THEME_COLORS[DEFAULT_THEME],
      theme_color: APP_THEME_COLORS[DEFAULT_THEME],
      prefer_related_applications: false,
    });
    expect(appManifest.name).toBeTruthy();
    expect(appManifest.short_name).toBeTruthy();
    expect(appManifest.description).toBeTruthy();
  });

  it("provides install icons at required sizes with separate maskable artwork", () => {
    const icons = appManifest.icons ?? [];

    for (const size of ["192x192", "512x512"]) {
      expect(icons).toEqual(expect.arrayContaining([expect.objectContaining({ sizes: size, purpose: "any" })]));
      expect(icons).toEqual(expect.arrayContaining([expect.objectContaining({ sizes: size, purpose: "maskable" })]));
    }

    for (const icon of icons) {
      expect(icon.src).toMatch(/^\//);
      expect(icon.src).not.toMatch(/[?#]/);
    }
  });

  it("keeps shortcuts inside app scope and free of clinical or credential payloads", () => {
    expect(appManifest.shortcuts?.length).toBeGreaterThan(0);

    for (const shortcut of appManifest.shortcuts ?? []) {
      const url = new URL(shortcut.url, "https://clinical-kb.invalid");
      expect(url.origin).toBe("https://clinical-kb.invalid");
      expect(url.pathname.startsWith("/")).toBe(true);
      expect(url.username).toBe("");
      expect(url.password).toBe("");
      for (const forbiddenKey of ["q", "query", "answer", "document", "token", "key", "runId"]) {
        expect(url.searchParams.has(forbiddenKey)).toBe(false);
      }
    }
  });

  it("does not advertise unsupported sensitive-capability handlers", () => {
    expect(appManifest).not.toHaveProperty("share_target");
    expect(appManifest).not.toHaveProperty("file_handlers");
    expect(appManifest).not.toHaveProperty("protocol_handlers");
  });

  it("ships a script-free, generic offline document with an explicit privacy boundary", () => {
    const offlineHtml = readFileSync(join(process.cwd(), "public", "offline.html"), "utf8");

    expect(offlineHtml).not.toMatch(/<script\b/i);
    expect(offlineHtml).toMatch(/private clinical documents/i);
    expect(offlineHtml).toMatch(/does not store or\s+replay/i);
    expect(offlineHtml).toMatch(/queries, answers, documents, uploads, signed URLs, or API responses/i);
  });

  it("sets explicit no-cache and scope headers for the service-worker entry point", () => {
    const nextConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

    expect(nextConfig).toContain('source: "/sw.js"');
    expect(nextConfig).toContain('value: "no-cache, no-store, must-revalidate"');
    expect(nextConfig).toContain('{ key: "Service-Worker-Allowed", value: "/" }');
    expect(nextConfig).toContain('source: "/offline.html"');
    expect(nextConfig).toContain('{ key: "X-Robots-Tag", value: "noindex, nofollow" }');
  });
});
