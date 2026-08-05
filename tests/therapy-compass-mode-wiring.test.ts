import { existsSync, readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { isStandaloneModeHomePath, shouldRenderDashboardSearch } from "@/lib/search-route-ownership";
import {
  THERAPY_CATALOGUE_ASSETS,
  THERAPY_CATALOGUE_ASSETS_PREVIOUS,
  THERAPY_CATALOGUE_SUMMARY,
} from "@/components/therapy-compass/data/generated-assets";

// Guards the two production-mode wiring invariants for Therapy Compass. Both were
// real breakages caught in review when the mockup was promoted to a live mode.

const loaderSrc = readFileSync(
  new URL("../src/components/therapy-compass/data/use-therapy-data.ts", import.meta.url),
  "utf8",
);
const bindingsSrc = readFileSync(new URL("../src/components/therapy-compass/bindings.tsx", import.meta.url), "utf8");
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
    expect(appModesSrc).toContain('placeholder: "Search therapies…"');
    expect(appModesSrc).toContain('inputAriaLabel: "Search therapies by problem, symptom, skill, or population"');
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

  it("commits no catalogue assets older than the one-deploy grace generation", () => {
    // Every regeneration mints new hashed filenames. Without pruning, each data
    // revision strands the previous full catalogue (~2.5 MB) plus both
    // projections in `public/` permanently — in git history and in every Docker
    // image. PR #1489 stranded two inside a single pull request and needed a
    // hand-deletion commit. `check:therapy-data-index` enforces the same rule;
    // this pins it for anyone who adds a hashed file without rerunning it.
    // Typed as string: the manifests are `as const`, so an inferred Set would be
    // keyed to today's exact filenames and reject any other name outright.
    const manifested = new Set<string>([
      ...Object.values(THERAPY_CATALOGUE_ASSETS),
      ...Object.values(THERAPY_CATALOGUE_ASSETS_PREVIOUS),
    ]);
    const hashed = readdirSync(dataDir).filter((name) =>
      /^therapies(?:-(?:home|index))?\.[a-f0-9]{16}\.json$/.test(name),
    );
    expect(hashed.length).toBeGreaterThan(0);
    expect(hashed.filter((name) => !manifested.has(name))).toEqual([]);
    // Growth is bounded at two generations per stem, not N.
    expect(hashed.length).toBeLessThanOrEqual(6);
  });

  it("retains the previous generation on disk so pre-deploy bundles do not 404", () => {
    // A session that started before the last deploy has the previous
    // content-addressed URL compiled into its bundle. Pruning it the moment the
    // catalogue regenerates reintroduces the deployment-straddling 404 the
    // unversioned aliases exist to prevent, one level down.
    for (const file of Object.values(THERAPY_CATALOGUE_ASSETS_PREVIOUS)) {
      expect(existsSync(new URL(file, dataDir)), file).toBe(true);
    }
  });

  it("falls back from a stale hashed catalogue URL to the unversioned alias", () => {
    // Covers bundles older than the grace generation, and mid-rollout clients.
    expect(loaderSrc).toContain("async function fetchCatalogue");
    expect(loaderSrc).toContain("CATALOGUE_ALIASES[catalogue]");
    for (const alias of Object.values(legacyCatalogueAssets)) {
      expect(loaderSrc, alias).toContain(alias);
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

  it("keeps projections available without putting one on the Therapy home paint path", () => {
    const fullSize = readFileSync(new URL(THERAPY_CATALOGUE_ASSETS.full, dataDir)).byteLength;
    const indexSize = readFileSync(new URL(THERAPY_CATALOGUE_ASSETS.index, dataDir)).byteLength;
    const homeSize = readFileSync(new URL(THERAPY_CATALOGUE_ASSETS.home, dataDir)).byteLength;
    expect(indexSize).toBeLessThan(fullSize * 0.1);
    expect(homeSize).toBeLessThanOrEqual(indexSize);
    // The loader still selects by catalogue kind from the generated manifest —
    // the lookup moved inside fetchCatalogue when the alias fallback landed, so
    // pin both halves rather than the old single expression.
    expect(loaderSrc).toContain("fetchCatalogue(options.catalogue)");
    expect(loaderSrc).toContain("THERAPY_CATALOGUE_ASSETS[catalogue]");
    expect(bindingsSrc).toContain("enabled: !isHome");
    expect(bindingsSrc).toContain("THERAPY_CATALOGUE_SUMMARY.totalCount");
    expect(bindingsSrc).not.toContain('screen === "home" ? "home"');
    expect(bindingsSrc).toContain('screen === "pathways" ? "index"');
    expect(bindingsSrc).not.toContain('screen === "search" || screen === "pathways"');
  });

  it("generates Therapy home count and artifact defaults from the current catalogue", () => {
    const home = JSON.parse(readFileSync(new URL(THERAPY_CATALOGUE_ASSETS.home, dataDir), "utf8")) as Array<{
      slug: string;
      briefInterventionAvailable: boolean;
      patientSheetAvailable: boolean;
    }>;
    expect(THERAPY_CATALOGUE_SUMMARY.totalCount).toBe(home.length);
    expect(THERAPY_CATALOGUE_SUMMARY.defaultBriefSlug).toBe(
      home.find((therapy) => therapy.briefInterventionAvailable)?.slug,
    );
    expect(THERAPY_CATALOGUE_SUMMARY.defaultSheetSlug).toBe(
      home.find((therapy) => therapy.patientSheetAvailable)?.slug,
    );
  });

  it("uses } as const–terminated parsing for the therapy catalogue summary staleness check", () => {
    const generatorSrc = readFileSync(new URL("../scripts/build-therapies-index.mjs", import.meta.url), "utf8");
    expect(generatorSrc).toContain("function extractConstObjectBody");
    expect(generatorSrc).toContain('extractConstObjectBody(currentManifest, "THERAPY_CATALOGUE_SUMMARY")');
    // Nested `}` must not truncate the summary parse (previous `[^}]*` hole).
    expect(generatorSrc).not.toMatch(/THERAPY_CATALOGUE_SUMMARY = \\\{\[\^\}]\*\\\}/);

    const extractConstObjectBody = (source: string, name: string) =>
      source.match(new RegExp(`${name} = \\{([\\s\\S]*?)\\} as const`))?.[1] ?? "";
    const nested =
      'export const THERAPY_CATALOGUE_SUMMARY = {\n  totalCount: 1,\n  note: { nested: "}" },\n  defaultBriefSlug: "a",\n  defaultSheetSlug: "b",\n} as const;\n';
    const block = extractConstObjectBody(nested, "THERAPY_CATALOGUE_SUMMARY");
    expect(block).toContain('defaultBriefSlug: "a"');
    expect(block).toContain('defaultSheetSlug: "b"');
    expect(block.match(/defaultSheetSlug: (null|"[^"]+")/)?.[1]).toBe('"b"');
  });

  it("does not mangle ordinary sk- substrings like task-centred in generated JSON", () => {
    // Regression for the old mid-word sk- → s\u006b- rewrite in the generator.
    for (const kind of ["home", "index"] as const) {
      const text = readFileSync(new URL(THERAPY_CATALOGUE_ASSETS[kind], dataDir), "utf8");
      expect(text, kind).toContain('"slug": "task-centred-practice"');
      expect(text, kind).not.toContain("\\u006b");
    }
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

  it("keeps the results-band shelf Clear filter-only so it cannot delete the query", () => {
    // Shipped defect (PR #1555): the shelf is labelled "Filtered by" and its
    // trailing Clear was wired to `clearSearch`, which resets EMPTY_SEARCH —
    // including `query: ""`. So Clear silently deleted the search term the user
    // was reading, while the code comment beside it claimed the query was
    // deliberately excluded. The sheet's own "Clear all" still resets
    // everything on purpose; only the shelf is filter-only.
    const searchScreenSrc = readFileSync(
      new URL("../src/components/therapy-compass/screens/search-screen.tsx", import.meta.url),
      "utf8",
    );
    expect(searchScreenSrc).toContain("onClearFilters={b.clearSearchFilters}");
    expect(searchScreenSrc).not.toContain("onClearFilters={b.clearSearch}");
    // The binding must preserve the query rather than reset the whole shape.
    expect(bindingsSrc).toContain(
      "clearSearchFilters: () => setSearch((prev) => ({ ...EMPTY_SEARCH, query: prev.query }))",
    );
    // The sheet keeps the full reset.
    expect(searchScreenSrc).toContain("onClear={b.clearSearch}");
  });
});
