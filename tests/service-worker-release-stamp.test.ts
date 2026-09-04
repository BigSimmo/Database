import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { releaseSuffix, stampServiceWorkerSource } from "../scripts/stamp-service-worker.mjs";

const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/**
 * A browser decides a service worker has changed by byte-comparing the script. `CACHE_VERSION`
 * was a hand-edited literal, so between releases `sw.js` was byte-identical: no `updatefound`,
 * no waiting worker, and therefore none of the events `pwa-lifecycle.tsx` builds its "update
 * available" prompt from. An installed home-screen app could sit on the version it first loaded
 * indefinitely and never be told otherwise.
 */
describe("service worker release stamp", () => {
  it("changes the cache version when a release SHA is present", () => {
    const first = stampServiceWorkerSource(serviceWorker, "a5c56cee5de2f014338b61e47c69aa8eb33a30cb");
    const second = stampServiceWorkerSource(serviceWorker, "cc1379790fae317a454832202c4b70d01d8f803b");

    expect(first.stamped).toBe(true);
    expect(second.stamped).toBe(true);
    expect(first.source).not.toBe(serviceWorker);
    // The whole point: two releases must not produce byte-identical workers.
    expect(first.source).not.toBe(second.source);
  });

  it("leaves the committed file untouched without a release SHA", () => {
    // Keeps `npm run build` on a developer machine from dirtying the tree or committing a
    // machine-specific version string.
    for (const value of [undefined, "", "   ", "not-a-sha"]) {
      const result = stampServiceWorkerSource(serviceWorker, value);
      expect(result.stamped).toBe(false);
      expect(result.source).toBe(serviceWorker);
    }
    expect(releaseSuffix("deadbeef")).toBe("deadbeef");
    expect(releaseSuffix("xyz")).toBeNull();
  });

  it("is idempotent, so a rebuilt layer cannot grow the version without bound", () => {
    const once = stampServiceWorkerSource(serviceWorker, "a5c56cee5de2f014338b61e47c69aa8eb33a30cb");
    const twice = stampServiceWorkerSource(once.source, "a5c56cee5de2f014338b61e47c69aa8eb33a30cb");
    expect(twice.source).toBe(once.source);
    expect(twice.version).toBe(once.version);
  });

  it("runs in the production build, before Next copies public/", () => {
    // Stamping after `next build` would miss the standalone output entirely.
    const build = packageJson.scripts["build:internal"];
    expect(build).toContain("stamp-service-worker.mjs");
    expect(build.indexOf("stamp-service-worker.mjs")).toBeLessThan(build.indexOf("next/dist/bin/next build"));
  });
});
