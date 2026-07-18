import { createHash } from "node:crypto";
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
      expect(icons).toEqual(expect.arrayContaining([expect.objectContaining({ sizes: size, purpose: "monochrome" })]));
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

  it("declares conservative launch and display fallbacks", () => {
    // Focus the existing app window on launch instead of spawning duplicates,
    // and degrade standalone to minimal-ui — never fullscreen — so browser
    // chrome and zoom stay reachable.
    expect(appManifest.launch_handler).toEqual({ client_mode: ["navigate-existing", "auto"] });
    expect(appManifest.display_override).toEqual(["standalone", "minimal-ui"]);
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

  it("binds the precached offline document to the service-worker cache version", () => {
    // The offline document is precached at install time only, so an edit that
    // ships without a CACHE_VERSION bump strands installed clients on the old
    // copy indefinitely (docs/pwa.md rules 1 and 5). Update BOTH fields of
    // this pairing together: bump CACHE_VERSION in public/sw.js to a brand-new
    // value (never reuse a previous one, even for rollbacks) and record the
    // new offline.html hash here.
    const expectedPairing = {
      cacheVersion: "2026-07-15-v1",
      offlineHtmlSha256: "52d290906336bf7d6d71797e3ede038e0ac84c826dc1c09f04f3f27d29117f8a",
    };

    const workerSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
    const cacheVersion = workerSource.match(/const CACHE_VERSION = "([^"]+)";/)?.[1];
    const offlineHtml = readFileSync(join(process.cwd(), "public", "offline.html"), "utf8");
    const offlineHtmlSha256 = createHash("sha256").update(offlineHtml).digest("hex");

    expect(cacheVersion).toBeTruthy();
    expect({ cacheVersion, offlineHtmlSha256 }).toEqual(expectedPairing);
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
