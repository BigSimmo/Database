import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Guards the two production-mode wiring invariants for Therapy Compass. Both were
// real breakages caught in review when the mockup was promoted to a live mode.

const loaderSrc = readFileSync(
  new URL("../src/components/therapy-compass/data/use-therapy-data.ts", import.meta.url),
  "utf8",
);
const shellSrc = readFileSync(
  new URL("../src/components/clinical-dashboard/global-search-shell.tsx", import.meta.url),
  "utf8",
);
const dataDir = new URL("../public/therapy-compass-data/", import.meta.url);

describe("Therapy Compass production-mode wiring", () => {
  it("loads its dataset from a non-/mockups path (proxy.ts 404s every /mockups path in production)", () => {
    const base = loaderSrc.match(/const BASE = "([^"]+)"/)?.[1];
    expect(base).toBeTruthy();
    expect(base).not.toMatch(/^\/mockups/);
  });

  it("ships the dataset at the non-mockups public path the loader points to", () => {
    for (const file of ["therapies.json", "pathways.json", "reference.json"]) {
      expect(existsSync(new URL(file, dataDir))).toBe(true);
    }
  });

  it("excludes therapy-compass from the shell dashboard-search so run-enabled links keep the tool", () => {
    // Both shouldRenderDashboardSearch blocks (standalone + non-standalone client) must exclude the mode,
    // otherwise /therapy-compass?q=…&run=1 renders ClinicalDashboard over TherapyCompassPage.
    const occurrences = shellSrc.match(/resolvedSearchMode !== "therapy-compass"/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("honors run-enabled deep links by seeding the in-tool search instead of landing on Home", () => {
    const routeSrc = readFileSync(new URL("../src/app/therapy-compass/page.tsx", import.meta.url), "utf8");
    const bindingsSrc = readFileSync(
      new URL("../src/components/therapy-compass/bindings.tsx", import.meta.url),
      "utf8",
    );
    // The route reads q/run and threads autoRunSearch into the provider...
    expect(routeSrc).toMatch(/searchParams/);
    expect(routeSrc).toMatch(/autoRunSearch/);
    // ...and the provider opens on Search (not Home) with the query seeded.
    expect(bindingsSrc).toMatch(/seededQuery \? "search" : "home"/);
  });
});
