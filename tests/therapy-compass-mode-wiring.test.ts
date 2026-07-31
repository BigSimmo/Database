import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { isStandaloneModeHomePath, shouldRenderDashboardSearch } from "@/lib/search-route-ownership";
import { THERAPY_CATALOGUE_ASSETS } from "@/components/therapy-compass/data/generated-assets";

// Guards the two production-mode wiring invariants for Therapy Compass. Both were
// real breakages caught in review when the mockup was promoted to a live mode.

const loaderSrc = readFileSync(
  new URL("../src/components/therapy-compass/data/use-therapy-data.ts", import.meta.url),
  "utf8",
);
const dataDir = new URL("../public/therapy-compass-data/", import.meta.url);
const legacyCatalogueAssets = {
  full: "therapies.json",
  index: "therapies-index.json",
  home: "therapies-home.json",
} as const;
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
  it("uses Therapy for user-facing mode copy, search results ribbon, and page metadata", () => {
    const appModesSrc = readFileSync(new URL("../src/lib/app-modes.ts", import.meta.url), "utf8");
    const homeSrc = readFileSync(
      new URL("../src/components/therapy-compass/screens/home-screen.tsx", import.meta.url),
      "utf8",
    );
    const workspaceSrc = readFileSync(
      new URL("../src/components/therapy-compass/workspace.tsx", import.meta.url),
      "utf8",
    );
    const searchSrc = readFileSync(
      new URL("../src/components/therapy-compass/screens/search-screen.tsx", import.meta.url),
      "utf8",
    );
    const sidebarSrc = readFileSync(
      new URL("../src/components/clinical-dashboard/ClinicalSidebar.tsx", import.meta.url),
      "utf8",
    );

    expect(appModesSrc).toContain('label: "Therapy"');
    expect(appModesSrc).toContain('submitAriaLabel: "Open Therapy"');
    expect(homeSrc).toContain('title="Therapy"');
    // Search route owns filters/results only; the results ribbon is the page h1.
    expect(searchSrc).toContain("SearchResultsHeaderBand");
    expect(searchSrc).toContain("headingLevel={1}");
    expect(searchSrc).not.toContain("Search therapies");
    expect(searchSrc).not.toContain("Find source-grounded therapy records");
    expect(workspaceSrc).toContain("Therapy could not load");
    // Therapy stays out of the six-item sidebar; mode discovery is via Tools/search.
    expect(sidebarSrc).not.toContain('id: "therapy-compass"');
    expect(appModesSrc).not.toContain("Therapy mode");
    expect(homeSrc).not.toContain("Therapy mode");
    expect(searchSrc).not.toContain("Therapy Search");
    expect(workspaceSrc).not.toContain("Therapy mode");

    for (const filename of therapyMetadataFiles) {
      const source = readFileSync(new URL(filename, import.meta.url), "utf8");
      expect(source, filename).toContain("Therapy");
      expect(source, filename).not.toContain("Therapy mode");
      expect(source, filename).not.toContain("Therapy Compass");
    }
  });

  it("loads its dataset from a non-/mockups path (proxy.ts 404s every /mockups path in production)", () => {
    const base = loaderSrc.match(/const BASE = "([^"]+)"/)?.[1];
    expect(base).toBeTruthy();
    expect(base).not.toMatch(/^\/mockups/);
  });

  it("ships the dataset at the non-mockups public path the loader points to", () => {
    for (const file of [...Object.values(THERAPY_CATALOGUE_ASSETS), "pathways.json", "reference.json"]) {
      expect(existsSync(new URL(file, dataDir))).toBe(true);
    }
  });

  it("keeps unversioned catalogue aliases for clients spanning a deployment", () => {
    for (const kind of ["full", "index", "home"] as const) {
      const current = readFileSync(new URL(THERAPY_CATALOGUE_ASSETS[kind], dataDir));
      const legacy = readFileSync(new URL(legacyCatalogueAssets[kind], dataDir));
      expect(legacy.equals(current), legacyCatalogueAssets[kind]).toBe(true);
    }
  });

  it("caches hashed catalogue assets immutably and forces alias revalidation", () => {
    const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
    expect(nextConfig).toContain(
      'source: "/therapy-compass-data/:asset(therapies(?:-(?:home|index))?\\\\.[a-f0-9]{16}\\\\.json)"',
    );
    expect(nextConfig).toContain('value: "public, max-age=31536000, immutable"');
    expect(nextConfig).toContain('source: "/therapy-compass-data/:asset(therapies(?:-(?:home|index))?\\\\.json)"');
    expect(nextConfig).toContain('value: "public, max-age=0, must-revalidate"');
  });

  it("ships a materially smaller catalogue index for browse and search routes", () => {
    const fullSize = readFileSync(new URL(THERAPY_CATALOGUE_ASSETS.full, dataDir)).byteLength;
    const indexSize = readFileSync(new URL(THERAPY_CATALOGUE_ASSETS.index, dataDir)).byteLength;
    expect(indexSize).toBeLessThan(fullSize * 0.4);
    expect(loaderSrc).toContain("THERAPY_CATALOGUE_ASSETS[options.catalogue]");
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
    // Mode homes are pathname-gated so optimistic searchMode cannot flip hero→dock mid-nav.
    expect(shellSrc).toContain("isStandaloneModeHomePath(pathname)");
    expect(isStandaloneModeHomePath("/therapy-compass")).toBe(true);
  });
});
