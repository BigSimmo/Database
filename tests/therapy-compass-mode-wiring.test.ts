import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { shouldRenderDashboardSearch } from "@/lib/search-route-ownership";

// Guards the two production-mode wiring invariants for Therapy Compass. Both were
// real breakages caught in review when the mockup was promoted to a live mode.

const loaderSrc = readFileSync(
  new URL("../src/components/therapy-compass/data/use-therapy-data.ts", import.meta.url),
  "utf8",
);
const dataDir = new URL("../public/therapy-compass-data/", import.meta.url);
const therapyMetadataFiles = [
  "../src/app/(search-app)/therapy-compass/page.tsx",
  "../src/app/(search-app)/therapy-compass/search/page.tsx",
  "../src/app/(search-app)/therapy-compass/recommend/page.tsx",
  "../src/app/(search-app)/therapy-compass/compare/page.tsx",
  "../src/app/(search-app)/therapy-compass/pathways/page.tsx",
  "../src/app/(search-app)/therapy-compass/review/page.tsx",
  "../src/app/(search-app)/therapy-compass/[slug]/page.tsx",
  "../src/app/(search-app)/therapy-compass/[slug]/brief/page.tsx",
  "../src/app/(search-app)/therapy-compass/[slug]/sheet/page.tsx",
];

describe("Therapy Compass production-mode wiring", () => {
  it("uses Therapy mode for user-facing mode copy and page metadata", () => {
    const appModesSrc = readFileSync(new URL("../src/lib/app-modes.ts", import.meta.url), "utf8");
    const homeSrc = readFileSync(
      new URL("../src/components/therapy-compass/screens/home-screen.tsx", import.meta.url),
      "utf8",
    );
    const workspaceSrc = readFileSync(
      new URL("../src/components/therapy-compass/workspace.tsx", import.meta.url),
      "utf8",
    );
    const sidebarSrc = readFileSync(
      new URL("../src/components/clinical-dashboard/ClinicalSidebar.tsx", import.meta.url),
      "utf8",
    );

    expect(appModesSrc).toContain('label: "Therapy mode"');
    expect(appModesSrc).toContain('submitAriaLabel: "Open Therapy mode"');
    expect(homeSrc).toContain('title="Therapy mode"');
    expect(workspaceSrc).toContain("Therapy mode could not load");
    expect(sidebarSrc).toContain('label: appModeDefinition("therapy-compass").label');

    for (const filename of therapyMetadataFiles) {
      const source = readFileSync(new URL(filename, import.meta.url), "utf8");
      expect(source, filename).toContain("Therapy mode");
      expect(source, filename).not.toContain("Therapy Compass");
    }
  });

  it("loads its dataset from a non-/mockups path (proxy.ts 404s every /mockups path in production)", () => {
    const base = loaderSrc.match(/const BASE = "([^"]+)"/)?.[1];
    expect(base).toBeTruthy();
    expect(base).not.toMatch(/^\/mockups/);
  });

  it("ships the dataset at the non-mockups public path the loader points to", () => {
    for (const file of ["therapies.json", "therapies-index.json", "pathways.json", "reference.json"]) {
      expect(existsSync(new URL(file, dataDir))).toBe(true);
    }
  });

  it("ships a materially smaller catalogue index for browse and search routes", () => {
    const fullSize = readFileSync(new URL("therapies.json", dataDir)).byteLength;
    const indexSize = readFileSync(new URL("therapies-index.json", dataDir)).byteLength;
    expect(indexSize).toBeLessThan(fullSize * 0.4);
    expect(loaderSrc).toContain('options.catalogue === "full" ? "therapies.json" : "therapies-index.json"');
  });

  it("keeps therapy-compass route-owned when the shared composer has a submitted query", () => {
    // Otherwise /therapy-compass?q=…&run=1 renders ClinicalDashboard over TherapyCompassPage.
    expect(
      shouldRenderDashboardSearch({ hasSubmittedSearch: true, mode: "therapy-compass", pathname: "/therapy-compass" }),
    ).toBe(false);
  });

  it("honors run-enabled deep links by routing to the in-tool search instead of landing on Home", () => {
    const routeSrc = readFileSync(new URL("../src/app/(search-app)/therapy-compass/page.tsx", import.meta.url), "utf8");
    const bindingsSrc = readFileSync(
      new URL("../src/components/therapy-compass/bindings.tsx", import.meta.url),
      "utf8",
    );
    // The home route reads q/run and redirects a run-enabled deep link to the dedicated search route...
    expect(routeSrc).toMatch(/searchParams/);
    expect(routeSrc).toMatch(/redirect\(`\/therapy-compass\/search/);
    // ...and the provider derives the active screen from the pathname and seeds the query from ?q.
    expect(bindingsSrc).toMatch(/resolveRoute\(pathname\)/);
    expect(bindingsSrc).toMatch(/searchParams\.get\("q"\)/);
  });

  it("keeps a single main landmark on the therapy home route", () => {
    const workspaceSrc = readFileSync(
      new URL("../src/components/therapy-compass/workspace.tsx", import.meta.url),
      "utf8",
    );
    const homeSrc = readFileSync(
      new URL("../src/components/therapy-compass/screens/home-screen.tsx", import.meta.url),
      "utf8",
    );
    // Home uses ModeHomeMain; workspace must not wrap home in a second <main>.
    expect(homeSrc).toMatch(/ModeHomeMain/);
    expect(workspaceSrc).toMatch(/asMain=\{!isHome\}/);
    expect(workspaceSrc).toContain(
      "const homeNeedsMainLandmark = Boolean(b.error) || (b.loading && b.therapies.length === 0);",
    );
    expect(workspaceSrc).toContain("const useMainLandmark = asMain || homeNeedsMainLandmark;");
    expect(workspaceSrc).toContain('const Tag = useMainLandmark ? "main" : "div"');
  });

  it("wires therapy-compass home into the shared desktop composer portal", () => {
    const shellSrc = readFileSync(
      new URL("../src/components/clinical-dashboard/global-search-shell.tsx", import.meta.url),
      "utf8",
    );
    const homeSrc = readFileSync(
      new URL("../src/components/therapy-compass/screens/home-screen.tsx", import.meta.url),
      "utf8",
    );
    expect(homeSrc).toContain("desktopComposerSlotId={modeHomeDesktopComposerSlotId}");
    expect(shellSrc).toContain('searchMode === "therapy-compass" && pathname === "/therapy-compass"');
  });
});
