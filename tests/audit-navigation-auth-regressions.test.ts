import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as redirectApplications, HEAD as headApplications } from "@/app/applications/route";
import { resolveDifferentialCompareHandoff } from "@/lib/differentials";
import { legacyHomeRedirectUrl } from "@/lib/legacy-home-redirect";
import { sourceSegment } from "./helpers/source-contract";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const clinicalDashboardSource = source("src/components/ClinicalDashboard.tsx");
const masterSearchHeaderSource = source("src/components/clinical-dashboard/master-search-header.tsx");
const universalAlsoMatchesSource = source("src/components/clinical-dashboard/universal-search-also-matches.tsx");
const universalCommandSurfaceSource = source("src/components/clinical-dashboard/universal-search-command-surface.tsx");
const globalSearchShellSource = source("src/components/clinical-dashboard/global-search-shell.tsx");

describe("audit navigation and auth regressions", () => {
  it("keeps the tappable phone suggestion ticker connected to standalone homes", () => {
    expect(globalSearchShellSource).toContain('isStandaloneModeHome || (pathname === "/" && !hasSubmittedModeSearch)');
    expect(masterSearchHeaderSource).toContain("showPhoneSuggestionTicker={showPhoneSuggestionTickerOnHome}");
    expect(universalCommandSurfaceSource).toContain('data-testid="smart-search-phone-ticker"');
    expect(universalCommandSurfaceSource).toContain("onClick={() => onPickExample(resolvedTickerExample)}");
    expect(universalCommandSurfaceSource).toContain("examples.includes(heldTickerExample)");
    expect(universalCommandSurfaceSource).toContain("onQueryChange(example);");
  });
  it("redirects exact legacy route handlers at request time while retaining useful query state", () => {
    const applications = redirectApplications(
      new NextRequest("https://clinical-kb.test/applications?q=acute+care&tag=one&tag=two"),
    );
    expect(applications.status).toBe(307);
    expect(applications.headers.get("location")).toBe("/tools?q=acute+care&tag=one&tag=two");

    // `/differentials/compare` is a real page (no competing route.ts). Same-
    // presentation/bare selections redirect into a catalogue workflow; the
    // page source must keep that handoff via next/navigation redirect().
    const compareHandoff = resolveDifferentialCompareHandoff(["DELIRIUM", "unknown", "delirium"], "acute confusion");
    expect(compareHandoff.kind).toBe("presentation");
    expect(compareHandoff.href).toBe(
      "/differentials/presentations/acute-confusion-encephalopathy?q=acute+confusion&ids=delirium",
    );
    const comparePage = source("src/app/(search-app)/differentials/compare/page.tsx");
    expect(comparePage).toContain('from "next/navigation"');
    expect(comparePage).toContain("resolveDifferentialCompareHandoff");
    expect(comparePage).toContain("redirect(handoff.href)");
    expect(comparePage).not.toContain("NextResponse");

    // `/medications` is a real Medication mode home (no blanket 307). Submitted
    // deep links (`q` + `run=1`) still redirect to the dashboard prescribing
    // results surface so old bookmarks keep working.
    const medicationsPage = source("src/app/(search-app)/medications/page.tsx");
    expect(medicationsPage).toContain('appModeHomeHref("prescribing"');
    expect(medicationsPage).toContain("run: true");
    expect(medicationsPage).toContain("readSearchNavigationContext");
    expect(medicationsPage).toContain("redirect(");
    expect(medicationsPage).not.toContain('redirect("/?mode=prescribing")');
    expect(headApplications).toBe(redirectApplications);
  });

  it("only redirects submitted root legacy mode aliases, leaving bare /?mode= on the shared home", () => {
    // Selection-only (no q+run=1) must stay on `/` so the shared-home contract
    // covers favourites/differentials/specifiers the same as every other mode.
    expect(
      legacyHomeRedirectUrl(
        new URL("https://clinical-kb.test/?mode=favourites&q=+lithium+&focus=1&run=0&extra=drop"),
        "GET",
      ),
    ).toBeNull();
    expect(
      legacyHomeRedirectUrl(new URL("https://clinical-kb.test/?mode=specifiers&focus=1&unexpected=drop"), "GET"),
    ).toBeNull();
    expect(legacyHomeRedirectUrl(new URL("https://clinical-kb.test/?mode=favourites"), "GET")).toBeNull();

    const differentials = legacyHomeRedirectUrl(
      new URL("https://clinical-kb.test/?mode=differentials&q=acute+confusion&run=1&run=0&extra=drop"),
      "HEAD",
    );
    const favouritesSubmitted = legacyHomeRedirectUrl(
      new URL("https://clinical-kb.test/?mode=favourites&q=+lithium+&focus=1&run=1&extra=drop"),
      "GET",
    );
    expect(differentials?.toString()).toBe("https://clinical-kb.test/differentials?q=acute+confusion&run=1");
    expect(favouritesSubmitted?.toString()).toBe("https://clinical-kb.test/favourites?q=lithium&focus=1&run=1");
    expect(legacyHomeRedirectUrl(new URL("https://clinical-kb.test/?mode=favourites"), "POST")).toBeNull();
    expect(legacyHomeRedirectUrl(new URL("https://clinical-kb.test/?mode=answer"), "GET")).toBeNull();
    expect(source("src/proxy.ts")).toContain("legacyHomeRedirectUrl(request.nextUrl, request.method)");
  });

  it("closes the master mode menu when focus leaves its wrapper", () => {
    const focusLeaveContract = sourceSegment(
      masterSearchHeaderSource,
      "ref={modeMenuRef}",
      'className="relative z-[60]',
      { label: "master mode-menu focus boundary" },
    );

    expect(focusLeaveContract).toContain("onBlur={(event) => {");
    expect(focusLeaveContract).toContain("if (usesPhoneSearchLayout) return;");
    expect(focusLeaveContract).toContain("const nextFocusedElement = event.relatedTarget;");
    expect(focusLeaveContract).toContain("event.currentTarget.contains(nextFocusedElement)");
    expect(focusLeaveContract).toContain("setModeMenuOpen(false);");
  });

  it("opens the master mode menu as a phone bottom sheet below the phone layout gate", () => {
    expect(masterSearchHeaderSource).toContain('testId="app-mode-menu-sheet"');
    expect(masterSearchHeaderSource).toContain("enabled: modeMenuOpen && !usesPhoneSearchLayout");
    expect(masterSearchHeaderSource).toContain("{!usesPhoneSearchLayout && modeMenuOpen ? (");
    expect(masterSearchHeaderSource).toContain('aria-haspopup={usesPhoneSearchLayout ? "dialog" : "menu"}');
    expect(masterSearchHeaderSource).toContain('mobilePlacement="bottom"');
    expect(masterSearchHeaderSource).toContain(
      'contentClassName="max-h-[calc(100dvh-0.75rem)] rounded-t-3xl bg-[color:var(--surface-lux)] sm:max-w-md sm:rounded-2xl"',
    );
    expect(masterSearchHeaderSource).toMatch(/usesPhoneSearchLayout\s*\?\s*"min-h-14\b[\s\S]*:\s*"min-h-\[3\.25rem\]/);
    expect(masterSearchHeaderSource).toContain("phoneLayoutGateRef");
    // Hydration-safe: do not read matchMedia in useState (SSR/client mismatch → React #418).
    expect(masterSearchHeaderSource).toContain(
      "const [usesPhoneSearchLayout, setUsesPhoneSearchLayout] = useState(false);",
    );
    expect(masterSearchHeaderSource).toContain("setUsesPhoneSearchLayout(currentUsesPhoneSearchLayout());");
  });

  it("prefetches only the mode a user focuses or points at", () => {
    const modeOption = sourceSegment(
      masterSearchHeaderSource,
      "function renderModeMenuOption(",
      "function renderModeMenuOptions()",
      { label: "mode-menu option prefetch" },
    );
    const openModeMenuWithFocus = sourceSegment(
      masterSearchHeaderSource,
      "function openModeMenuWithFocus(",
      "function toggleModeMenu(",
      { label: "mode-menu focus-open prefetch" },
    );
    const toggleModeMenu = sourceSegment(
      masterSearchHeaderSource,
      "function toggleModeMenu(",
      "function handleModeTriggerKeyDown(",
      { label: "mode-menu toggle prefetch" },
    );

    expect(masterSearchHeaderSource).toContain("function prefetchModeSelection(modeId: AppModeId)");
    expect(masterSearchHeaderSource).toContain(
      'const href = modeId === "tools" ? "/tools" : appModeSelectionHref(modeId)',
    );
    expect(masterSearchHeaderSource).toContain("router.prefetch(href,");
    expect(masterSearchHeaderSource).toContain("onInvalidate:");
    expect(modeOption).toContain("onFocus={() => prefetchModeSelection(mode.id)}");
    expect(modeOption).toContain("onPointerEnter={() => prefetchModeSelection(mode.id)}");
    // Menu-open paths warm only the highlighted option — never every visible home.
    expect(openModeMenuWithFocus).toContain("prefetchModeSelection(highlighted.id)");
    expect(toggleModeMenu).toContain("prefetchModeSelection(highlighted.id)");
    expect(masterSearchHeaderSource).not.toContain("function prefetchModeSelections(");
    expect(masterSearchHeaderSource).not.toContain("visibleAppModeOptions.forEach((mode) => router.prefetch");
    expect(masterSearchHeaderSource).not.toContain(
      "new Set(visibleAppModeOptions.map((mode) => appModeHomeHref(mode.id)))",
    );
  });

  it("defers cross-mode search on narrow screens until expansion except for completed answers", () => {
    expect(universalAlsoMatchesSource).toContain('modeId !== "prescribing" && submissionActive');
    expect(universalAlsoMatchesSource).toContain('(isWide || modeId === "answer" || expanded)');
    expect(universalAlsoMatchesSource).toContain("enabled: trimmedQuery.length >= 2 && searchActive");
    expect(universalAlsoMatchesSource).toContain('if (modeId === "answer" && currentGroups.length === 0) return null;');
    expect(universalAlsoMatchesSource).toContain("const [viewportReady, setViewportReady] = useState(false);");
    expect(universalAlsoMatchesSource).toContain("setViewportReady(true);");
    expect(universalAlsoMatchesSource).toContain('searchPending ? "Searching other modes"');
  });

  it("mounts Answer-mode also-matches only after generation completes", () => {
    const alsoMatchesGate = sourceSegment(
      clinicalDashboardSource,
      "const showUniversalAlsoMatches =",
      "const showDesktopHomeComposer =",
      { label: "also-matches visibility gate" },
    );
    expect(alsoMatchesGate).toContain('activeModeResultKind === "tools"');
    expect(alsoMatchesGate).toContain('activeModeResultKind === "favourites"');
    expect(alsoMatchesGate).toContain('activeModeResultKind === "answer" && Boolean(answer) && !loading');
    expect(alsoMatchesGate).not.toContain(
      'activeModeResultKind === "answer" || activeModeResultKind === "tools" || activeModeResultKind === "favourites"',
    );
  });

  it("gates private polling and mutations on local readiness plus authenticated status", () => {
    const privateCapabilityContract = sourceSegment(
      clinicalDashboardSource,
      "const canUsePrivateApis =",
      "const canRunSearch =",
      { label: "private API capability" },
    );
    expect(privateCapabilityContract).toContain("const canUsePrivateApis =");
    expect(privateCapabilityContract).toContain(
      'localNoAuthMode || localDevCanAttemptPrivateApis || authStatus === "authenticated"',
    );

    const pollingContract = sourceSegment(
      clinicalDashboardSource,
      "if (!nextDemoMode && !canUsePrivateApis) {",
      "const shouldRefreshWorkState =",
      { label: "private polling capability" },
    );
    expect(pollingContract).toContain("if (!nextDemoMode && !canUsePrivateApis) {");
    expect(pollingContract).toContain("setDocuments([]);");
    expect(pollingContract).toContain("return;");

    const labelMutationContract = sourceSegment(
      clinicalDashboardSource,
      "const mutateDocumentLabel =",
      "const handleDocumentDeleted =",
      { label: "private label mutation" },
    );
    expect(labelMutationContract).toContain("if (!canUsePrivateApis) return false;");

    const indexingAdministrationContract = sourceSegment(
      clinicalDashboardSource,
      "const openLibraryHealthTarget = useCallback(",
      "const timeoutId = window.setTimeout(prefetchApplications, 250);",
      { label: "private indexing administration" },
    );
    expect(indexingAdministrationContract).toContain("if (!canUseAdministrativeApis) {");

    // Guard text alone would pass even if the guard fell through to the drawer-opening calls, so
    // pin the ORDER: the early return has to precede every administrative state change, and the
    // non-administrator branch must reach none of them.
    const guardIndex = indexingAdministrationContract.indexOf("if (!canUseAdministrativeApis) {");
    const earlyReturnIndex = indexingAdministrationContract.indexOf("return;", guardIndex);
    expect(earlyReturnIndex, "the administrator guard must return, not just warn").toBeGreaterThan(guardIndex);

    const deniedBranch = indexingAdministrationContract.slice(guardIndex, earlyReturnIndex);
    expect(deniedBranch).not.toContain("setIndexingAdminDrawerOpen(true)");
    expect(deniedBranch).not.toContain("setIndexingAdminMobileTab");
    expect(deniedBranch).not.toContain('setDocumentsDrawerMode("admin")');

    for (const administrativeCall of [
      "settingsState.setIndexingAdminDrawerOpen(true);",
      'settingsState.setIndexingAdminMobileTab("jobs");',
      'settingsState.setDocumentsDrawerMode("admin");',
    ]) {
      const callIndex = indexingAdministrationContract.indexOf(administrativeCall);
      expect(callIndex, `${administrativeCall} must exist in the administrator path`).toBeGreaterThan(-1);
      expect(callIndex, `${administrativeCall} must sit after the non-administrator early return`).toBeGreaterThan(
        earlyReturnIndex,
      );
    }

    // Rendering is gated on the same capability, so losing access mid-session cannot leave jobs,
    // batches or quality data painted from component state.
    expect(clinicalDashboardSource).toContain("{settingsState.indexingAdminDrawerOpen && canUseAdministrativeApis ? (");
  });

  it("keeps private indexing administration associated without exposing uploads", () => {
    expect(clinicalDashboardSource).toContain('aria-label="Indexing administration sections"');
    expect(clinicalDashboardSource).toContain('role="tab"');
    expect(clinicalDashboardSource).toContain("aria-selected={active}");
    expect(clinicalDashboardSource).toContain("aria-controls={tab.panelId}");
    expect(clinicalDashboardSource).toContain("tabIndex={active ? 0 : -1}");
    expect(clinicalDashboardSource).toContain('role={indexingAdminUsesDesktopRegions ? "region" : "tabpanel"}');
    for (const tab of ["setup", "jobs", "quality"]) {
      expect(clinicalDashboardSource).toContain(`"dashboard-indexing-admin-tab-${tab}"`);
    }
    for (const section of ["setup", "indexing", "quality"]) {
      expect(clinicalDashboardSource).toContain(`id="dashboard-${section}-section-heading"`);
    }
    // The viewport-driven region/tabpanel role is wired through the extracted hook, whose
    // media-query subscription carries the guard with it.
    expect(clinicalDashboardSource).toContain("useIndexingAdminDesktopLayout()");
    // Assert the EXPORTED hook's return wires the media-query subscription through
    // useSyncExternalStore with the () => false server snapshot, and that the call closes
    // right after that snapshot. Scoping to the exported function body (not the whole file)
    // plus the `return` anchor and trailing `)` means a stale/disconnected call elsewhere, a
    // comment or string, a present-but-unused helper, a dropped SSR fallback, or a mutated
    // snapshot such as `() => false || getUploadDesktopLayoutSnapshot()` all fail the guard.
    const indexingAdminDesktopHookSource = source(
      "src/components/clinical-dashboard/use-indexing-admin-desktop-layout.ts",
    );
    const useIndexingAdminDesktopLayoutBody = sourceSegment(
      indexingAdminDesktopHookSource,
      "export function useIndexingAdminDesktopLayout(",
      "}",
      { label: "indexing admin desktop layout hook" },
    );
    expect(useIndexingAdminDesktopLayoutBody).toMatch(
      /return\s+useSyncExternalStore\(\s*subscribeToIndexingAdminDesktopLayout,\s*getIndexingAdminDesktopLayoutSnapshot,\s*\(\)\s*=>\s*false\s*,?\s*\)\s*;?\s*$/,
    );
    // The source contract prevents the old effect/setState viewport pattern from returning.
    expect(indexingAdminDesktopHookSource).not.toContain("useEffect");
    expect(indexingAdminDesktopHookSource).not.toContain("useState");
    expect(indexingAdminDesktopHookSource).not.toContain("setIndexingAdminUsesDesktopRegions");
    expect(clinicalDashboardSource).not.toContain("UploadPanel");
    expect(clinicalDashboardSource).not.toContain('type="file"');
  });
});
