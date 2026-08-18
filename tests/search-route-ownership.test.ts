import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { sourceFrom, sourceSegment } from "./helpers/source-contract";

import { consolidatedModeHomeModeIds } from "@/lib/consolidated-mode-home-redirect";

import {
  isAlwaysStandaloneShellPath,
  isDashboardModeHref,
  isStandaloneModeHomePath,
  shouldRenderClinicalDashboard,
  shouldRenderDashboardSearch,
} from "@/lib/search-route-ownership";

describe("shared-search route ownership", () => {
  it("keeps submitted searches in route-owned mode workflows", () => {
    for (const mode of [
      "services",
      "forms",
      "favourites",
      "differentials",
      "dsm",
      "specifiers",
      "formulation",
      "therapy-compass",
      "tools",
      "calculators",
    ] as const) {
      expect(shouldRenderDashboardSearch({ hasSubmittedSearch: true, mode, pathname: `/${mode}` })).toBe(false);
    }
  });

  it("routes dashboard-owned submitted workflows to ClinicalDashboard", () => {
    expect(shouldRenderDashboardSearch({ hasSubmittedSearch: true, mode: "answer", pathname: "/" })).toBe(true);
    expect(
      shouldRenderDashboardSearch({ hasSubmittedSearch: true, mode: "documents", pathname: "/documents/search" }),
    ).toBe(true);
    expect(shouldRenderClinicalDashboard({ hasSubmittedSearch: false, mode: "answer", pathname: "/" })).toBe(true);
  });

  it("never replaces an explicit medication detail or document-search mockup", () => {
    expect(
      shouldRenderClinicalDashboard({
        hasSubmittedSearch: true,
        mode: "prescribing",
        pathname: "/medications/acamprosate",
      }),
    ).toBe(false);
    expect(
      shouldRenderDashboardSearch({
        hasSubmittedSearch: true,
        mode: "documents",
        pathname: "/mockups/document-search/search",
      }),
    ).toBe(false);
  });

  it("classifies standalone mode homes from pathname alone", () => {
    for (const pathname of ["/favourites", "/tools", "/medications"]) {
      expect(isStandaloneModeHomePath(pathname)).toBe(true);
    }
    expect(isStandaloneModeHomePath("/")).toBe(false);
    expect(isStandaloneModeHomePath("/services/crisis")).toBe(false);
    expect(isStandaloneModeHomePath("/dsm/search")).toBe(false);
  });

  /*
   * Consolidated modes own no composer at their bare path.
   *
   * The ten consolidated modes no longer render a home of their own —
   * they redirect onto the one shared home at `/?mode=<id>`, whose composer the
   * dashboard owns. Claiming standalone ownership for a path that renders nothing
   * would reserve hero composer geometry on a route that never paints, so these
   * must classify false while their SUB-routes keep standalone shell treatment.
   */
  it("does not claim composer ownership for consolidated mode homes", () => {
    for (const modeId of consolidatedModeHomeModeIds) {
      expect(isStandaloneModeHomePath(`/${modeId}`)).toBe(false);
    }
    // Nine of the ten namespaces still need the standalone shell for their own
    // sub-routes. Documents is the exception in both directions: its sub-routes
    // (`/documents/search`, the viewer) are dashboard-rendered, which is exactly
    // why it was never in `alwaysStandaloneShellPathPrefixes` to begin with.
    for (const modeId of consolidatedModeHomeModeIds) {
      expect(isAlwaysStandaloneShellPath(`/${modeId}`)).toBe(modeId !== "documents");
    }
  });

  it("marks route-owned namespaced paths as always-standalone shell (no searchParams gate)", () => {
    expect(isAlwaysStandaloneShellPath("/forms")).toBe(true);
    expect(isAlwaysStandaloneShellPath("/favourites")).toBe(true);
    expect(isAlwaysStandaloneShellPath("/differentials/presentations/acute-confusion-encephalopathy")).toBe(true);
    expect(isAlwaysStandaloneShellPath("/medications/acamprosate")).toBe(true);
    expect(isAlwaysStandaloneShellPath("/tools")).toBe(true);
    // `/` and Documents still need searchParams for the dashboard gate.
    expect(isAlwaysStandaloneShellPath("/")).toBe(false);
    expect(isAlwaysStandaloneShellPath("/documents/search")).toBe(false);
  });

  it("classifies dashboard mode hrefs without parsing the destination page", () => {
    expect(isDashboardModeHref("/")).toBe(true);
    expect(isDashboardModeHref("/?mode=answer")).toBe(true);
    expect(isDashboardModeHref("/?mode=documents&focus=1")).toBe(true);
    expect(isDashboardModeHref("/documents/search")).toBe(true);
    expect(isDashboardModeHref("/documents/search?q=lithium&run=1")).toBe(true);
    expect(isDashboardModeHref("/services")).toBe(false);
    expect(isDashboardModeHref("/differentials?q=mania&run=1")).toBe(false);
    expect(isDashboardModeHref("/documents/searching")).toBe(false);
  });

  it("keeps shell mode-home detection pathname-gated (no searchMode∧pathname AND)", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
      "utf8",
    );
    expect(shellSource).toContain("isStandaloneModeHomePath(pathname)");
    expect(shellSource).not.toMatch(/searchMode === "services" && pathname === "\/services"/);
    // changeMode must not optimistic-set searchMode before navigation.
    // The pill always returns to the shared home. A current query is carried only
    // as a draft, never as `run=1`; pending state still guards the push.
    expect(shellSource).toMatch(
      /function changeMode\(mode: AppModeId\) \{[\s\S]*?const carriedQuery = query\.trim\(\) \|\| requestedQuery\.trim\(\);[\s\S]*?const href = appModeSelectionHref\(mode, \{[\s\S]*?query: carriedQuery \|\| undefined,[\s\S]*?router\.push\(href\);\n  \}/,
    );
    const changeMode = shellSource.slice(
      shellSource.indexOf("function changeMode("),
      shellSource.indexOf("function startNewAnswerChat("),
    );
    expect(changeMode).not.toContain("run: true");
    expect(shellSource).not.toMatch(
      /function changeMode\(mode: AppModeId\) \{[\s\S]*?setSearchMode\(mode\);[\s\S]*?router\.push/,
    );
    expect(shellSource).toContain("alreadyOnDestination");
    expect(shellSource).toContain("setPendingModeNavigation");
    // Blanket mode-equality early return would break same-mode home returns.
    expect(shellSource).not.toMatch(
      /function changeMode\(mode: AppModeId\) \{[\s\S]*?if \(mode === searchMode\) return;/,
    );
  });

  it("seeds always-standalone submitted params before the bridge hydrates", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
      "utf8",
    );
    expect(shellSource).toContain("function readInitialBrowserSubmittedSearchParamString()");
    expect(shellSource).toContain("window.location.search.slice(1)");
    expect(shellSource).toContain('params.get("run") === "1" && query ? search : ""');
    expect(shellSource).toMatch(
      /useSyncExternalStore\(\s*subscribeNoop,\s*readInitialBrowserSubmittedSearchParamString,\s*\(\) => "",\s*\)/,
    );
    expect(shellSource).toContain("searchParamString || browserSearchParamString");
  });

  it("resets shared phone scroll chrome when the pathname changes", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
      "utf8",
    );
    const hideSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/use-hide-on-scroll.ts"),
      "utf8",
    );
    expect(hideSource).toContain("const reset = useCallback");
    expect(hideSource).toMatch(/return \{ hidden: active && hidden, reportScroll, reset \}/);
    // Hide state resets via the reporter resetKey; scroll offset resets explicitly.
    expect(shellSource).toContain("useScrollHideReporter(false, true, pathname)");
    expect(shellSource).toMatch(/main\.scrollTop = 0[\s\S]*\}, \[pathname\]\)/);
  });

  it("reserves home geometry without inflating the header while the hero portal attaches", () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/master-search-header.tsx"),
      "utf8",
    );
    expect(headerSource).toContain("desktopComposerPortalFallback");
    expect(headerSource).toContain("homeComposerMediaEligible");
    expect(headerSource).toMatch(
      /const homePortalPending =\s*Boolean\(desktopHomeComposerSlotId\) && homeComposerMediaEligible && !desktopComposerPortalFallback/,
    );
    expect(headerSource).toContain("setHomeComposerMediaEligible(mediaQuery.matches)");
    expect(headerSource).toContain("const portalFallbackDelayMs = 8_000");
    expect(headerSource).toContain("let portalFailureStartedAt: number | null = null");
    expect(headerSource).toContain("portalFailureStartedAt = null");
    expect(headerSource).toContain("portalFailureStartedAt ??= now");
    expect(headerSource).toContain("now - portalFailureStartedAt");
    expect(headerSource).not.toContain("portalRetryStartedAt");
    expect(headerSource).not.toContain("portalRetryCount");
    expect(headerSource).toMatch(
      /desktopComposerPortalActive && desktopComposerPortalHost\s*\?\s*null\s*:\s*homePortalPending\s*\?\s*null\s*:\s*renderSearchComposer\("default"\)/,
    );
    expect(headerSource).toContain("setDesktopComposerPortalFallback(true)");
  });

  it("waits for page-owned composer slots to hydrate before portal adoption", () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/master-search-header.tsx"),
      "utf8",
    );
    const slotSource = readFileSync(resolve(process.cwd(), "src/components/desktop-composer-portal-slot.tsx"), "utf8");
    const homeTemplateSource = readFileSync(resolve(process.cwd(), "src/components/mode-home-template.tsx"), "utf8");
    const globalsSource = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const composerLibSource = readFileSync(resolve(process.cwd(), "src/lib/mode-home-composer.ts"), "utf8");
    expect(composerLibSource).toContain('desktopComposerSlotReadyAttr = "data-composer-slot-ready"');
    expect(slotSource).toContain("desktopComposerSlotReadyAttr");
    expect(slotSource).toContain("useEffect");
    expect(headerSource).toContain("isDesktopComposerSlotReady(slot)");
    expect(headerSource).toContain("attributeFilter: [desktopComposerSlotReadyAttr]");
    expect(headerSource).toContain("setModeHomeComposerReservePending");
    expect(headerSource).toContain("searchComposerVisible");
    expect(composerLibSource).toContain('modeHomeComposerReserveAttr = "data-composer-reserve"');
    expect(homeTemplateSource).toContain(
      "data-[composer-reserve=pending]:min-h-[var(--spacing-mode-home-composer-phone)]",
    );
    expect(homeTemplateSource).toContain(
      "sm:data-[composer-reserve=pending]:min-h-[var(--spacing-mode-home-composer-wide)]",
    );
    expect(homeTemplateSource).toContain("[&:not(:empty)]:min-h-[var(--spacing-mode-home-composer-phone)]");
    expect(homeTemplateSource).not.toContain("mode-home-composer-slot hidden");
    // Unconditional always-on reserve would leave a permanent empty band when
    // the portal never adopts; pending/filled gating is the CLS-safe contract.
    expect(homeTemplateSource).not.toMatch(
      /mode-home-composer-slot block min-h-\[var\(--spacing-mode-home-composer-phone\)\]/,
    );
    expect(globalsSource).toContain("--spacing-mode-home-composer-phone: 6.625rem");
    expect(globalsSource).toContain("--spacing-mode-home-composer-wide: 5.5rem");
  });

  it("leaves the dashboard shell without eager chrome thrash", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/ClinicalDashboard.tsx"), "utf8");
    expect(dashboardSource).toContain("isDashboardModeHref");
    // crossModeSearch still navigates out of the shell without rewriting local
    // chrome first: an eager setSearchMode flipped hero/dock for a frame before
    // ClinicalDashboard unmounted.
    expect(dashboardSource).toMatch(
      /function crossModeSearch\(mode: AppModeId, crossQuery: string\) \{[\s\S]*?if \(!isDashboardModeHref\(href\)\) \{[\s\S]*?router\.push\(href\);\n      return;/,
    );
  });

  it("keeps the mode pill from navigating while the shared home is showing", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/ClinicalDashboard.tsx"), "utf8");
    const selectSearchMode = sourceFrom(dashboardSource, "function selectSearchMode(", {
      label: "selectSearchMode",
    });

    // Isolate the shared-home branch so the negative assertions below cannot be
    // satisfied by unrelated code further down selectSearchMode. The end marker
    // is an indentation depth, which is why it goes through the guarded helper:
    // unguarded, a reformat would turn every negative assertion below into a
    // vacuous pass rather than a failure.
    const sharedHomeBranch = sourceSegment(selectSearchMode, "if (showSharedHome) {", "\n    }", {
      label: "selectSearchMode shared-home branch",
    });

    // `/` is the single home page. On it the pill only retargets the composer:
    // rewrite `?mode=` in place, never push a route and never re-render the page.
    expect(sharedHomeBranch).toMatch(/window\.history\.replaceState\(null, "", appModeSelectionHref\(mode/);
    // replaceState only — a push would add a history entry per mode pick, so Back
    // would step back through picks instead of leaving home.
    expect(sharedHomeBranch).not.toContain("router.push");
    // The URL must own searchMode here: setting modeChangeFromUiRef would make the
    // URL-sync effect skip, and the pill would never update.
    expect(sharedHomeBranch).not.toContain("modeChangeFromUiRef.current = true");
    expect(sharedHomeBranch).not.toContain("setSearchMode(");
    // Off the shared home, the current query becomes a draft on `/`; it is not
    // submitted into the selected mode until the user explicitly asks.
    expect(selectSearchMode).toMatch(
      /const href = appModeSelectionHref\(mode, \{[\s\S]*?query: carriedQuery \|\| undefined/,
    );
    // Returning home must invalidate the in-flight search before clearing UI —
    // the dashboard stays mounted, so a late applySearchResult would otherwise
    // restore the old answer and rewrite run=1 over the draft home.
    const leaveResultsBranch = sourceSegment(
      selectSearchMode,
      "// Outside the shared home",
      "function stageAnswerFollowUpDraft",
      { label: "selectSearchMode leave-results branch" },
    );
    expect(leaveResultsBranch).toMatch(/stopSearch\(\);\s*clearModeResultState\(\);/);
    expect(
      sourceSegment(selectSearchMode, "function selectSearchMode(", "function stageAnswerFollowUpDraft", {
        label: "selectSearchMode before stageAnswerFollowUpDraft",
      }),
    ).not.toContain("crossModeSearch(mode, carriedQuery)");
    expect(dashboardSource).toContain('if (pathname === "/" && !submittedUrlRunRequested) return;');
    expect(dashboardSource).toContain("if (modeChangeFromUiRef.current && !submittedUrlModeMatchesActive) return;");
    // Ask-this / cross-mode into Answer must not depend solely on auto-run: the
    // dashboard stays mounted, so submit explicitly after pushing run=1.
    expect(dashboardSource).toMatch(
      /if \(mode === "answer" \|\| mode === "documents"\) \{[\s\S]*?void executeSearch\(crossQuery, mode/,
    );
    expect(dashboardSource).toMatch(
      /const showSharedHome = shouldShowSharedHome\(\{[\s\S]*?pathname,[\s\S]*?mode: searchParams\.get\("mode"\),[\s\S]*?submittedAnswerSearchActive,[\s\S]*?\}\);/,
    );
  });

  it("routes a submitted shared-composer search to the selected mode's own surface", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/ClinicalDashboard.tsx"), "utf8");
    const ask = sourceFrom(dashboardSource, "async function ask(", {
      label: "ClinicalDashboard async function ask",
    });

    // Before this branch existed, every mode except documents/prescribing fell
    // through to an in-place executeSearch. That was only safe while `/` plus a
    // namespaced mode was unreachable; the shared home makes it the normal state.
    expect(ask).toMatch(
      /const modeDestination = appModeHomeHref\(searchMode, \{[\s\S]*?run: true,[\s\S]*?\}\);\n    if \(trimmedQuery && !isDashboardModeHref\(modeDestination\)\) \{[\s\S]*?router\.push\(modeDestination\);\n      return;/,
    );
  });

  it("keeps the unsubmitted shared home from auto-running composer drafts", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
      "utf8",
    );
    // `/` mounts ClinicalDashboard with nothing submitted. autoRunSearch must stay
    // gated on run=1 there — otherwise every keystroke fires a search.
    expect(shellSource).toMatch(/autoRunSearch=\{\s*pathname === "\/" \? hasSubmittedModeSearch : true\s*\}/);
    // `/documents` was the one other path that needed this gate. It redirects to
    // the shared home now, so the dashboard never renders an unsubmitted mode home
    // anywhere but `/` — which is why the separate path set could go.
    expect(
      shouldRenderClinicalDashboard({ hasSubmittedSearch: false, mode: "documents", pathname: "/documents" }),
    ).toBe(false);
    expect(shouldRenderClinicalDashboard({ hasSubmittedSearch: false, mode: "documents", pathname: "/" })).toBe(true);
    // `/medications` is always-standalone; the dashboard gate never sees it.
    expect(isAlwaysStandaloneShellPath("/medications")).toBe(true);
  });

  it("sends settings landing views to real mode homes, not bare /?mode=", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
      "utf8",
    );
    expect(shellSource).toContain('router.replace("/documents", { scroll: false })');
    expect(shellSource).toContain('router.replace("/tools", { scroll: false })');
    expect(shellSource).not.toContain("router.replace(`/?mode=${landingMode}`");
  });

  it("lets settings landing win over remembered-mode seeding on cold /", () => {
    const dashboardSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/use-home-mode-seed.ts"),
      "utf8",
    );
    const seedStart = dashboardSource.indexOf("Seed a cold `/` visit from the remembered mode.");
    expect(seedStart).toBeGreaterThan(-1);
    // Slice to end of file rather than a fixed window: the module is this hook and
    // its doc comment, and a character budget silently stops covering the effect
    // as soon as the comment grows.
    const seedEffect = dashboardSource.slice(seedStart);
    expect(seedEffect).toContain("landingModeForPreference(readAppPreferences().landing)");
    // replaceState, never a push: seeding must not add a history entry.
    expect(seedEffect).toMatch(/window\.history\.replaceState\(\s*null,\s*"",\s*appModeSelectionHref\(lastAppMode/);
    expect(seedEffect).not.toContain("router.push");
    // The rest of the URL rides along. Seeding only runs with no mode/query in the
    // URL, but `focus=1` and the scope/queryMode context can still be present, and
    // rewriting without them silently dropped them on a cold `/` visit.
    expect(seedEffect).toContain("readSearchNavigationContext(searchParams)");
    expect(seedEffect).toMatch(/focus: searchParams\.get\("focus"\) === "1"/);
    expect(seedEffect).toContain("scopeFilters: navigationContext.scopeFilters");
    expect(seedEffect).toContain("Settings landing view also wins over last-mode");
    expect(readFileSync(resolve(process.cwd(), "src/components/ClinicalDashboard.tsx"), "utf8")).toContain(
      "useHomeModeSeed({ pathname, searchParams, lastAppMode })",
    );
  });
});
