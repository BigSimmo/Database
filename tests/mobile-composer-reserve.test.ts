import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isDocumentViewerOwnedRoute,
  mobileComposerDifferentialsCompareReserve,
  mobileComposerHiddenReserve,
  mobileComposerHiddenReserveRem,
  mobileComposerIdleReserve,
  mobileComposerVisibleReserve,
  resolveDashboardVisibleMobileComposerReserve,
  resolveMobileComposerReserve,
  resolveShellVisibleMobileComposerReserve,
} from "@/components/clinical-dashboard/mobile-composer-reserve";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("mobile composer reserve contract", () => {
  it("collapses to zero hidden pad without Safari toolbar safe-area", () => {
    expect(mobileComposerHiddenReserve).toBe("0rem");
    expect(mobileComposerHiddenReserveRem).toBe(0);
    // The rem number feeds readChromeCollapseMetrics' px math; it must stay
    // equal to the CSS string above or the collapse budget silently drifts.
    expect(`${mobileComposerHiddenReserveRem}rem`).toBe(mobileComposerHiddenReserve);
    expect(resolveMobileComposerReserve(true, mobileComposerVisibleReserve.shellAnswer)).toBe(
      mobileComposerHiddenReserve,
    );
    expect(resolveMobileComposerReserve(false, mobileComposerVisibleReserve.shellAnswer)).toBe(
      mobileComposerVisibleReserve.shellAnswer,
    );
    expect(mobileComposerHiddenReserve).not.toContain("safe-area");
    expect(mobileComposerHiddenReserve).not.toContain("env(");
  });

  it("keeps idle and document-viewer shell pads free of toolbar insets", () => {
    expect(mobileComposerIdleReserve).toBe("2rem");
    expect(
      resolveShellVisibleMobileComposerReserve({
        shouldShowSearchComposer: false,
        documentViewerOwnedRoute: true,
        isStandaloneModeHome: false,
        searchMode: "documents",
        differentialsCompareAddonActive: false,
      }),
    ).toBe(mobileComposerHiddenReserve);
  });

  it("keeps only the idle content pad on standalone mode homes (in-flow hero pill, no dock)", () => {
    expect(
      resolveShellVisibleMobileComposerReserve({
        shouldShowSearchComposer: true,
        documentViewerOwnedRoute: false,
        isStandaloneModeHome: true,
        searchMode: "services",
        differentialsCompareAddonActive: false,
      }),
    ).toBe(mobileComposerIdleReserve);
  });

  it("uses the compact dock reserve for non-answer dashboard docks when the hero does not own phones", () => {
    for (const searchMode of ["documents", "services", "forms", "tools", "favourites"]) {
      expect(
        resolveDashboardVisibleMobileComposerReserve({
          searchMode,
          hasAnswerFollowUps: false,
          differentialsCompareAddonActive: false,
        }),
      ).toBe(mobileComposerVisibleReserve.dashboardDock);
    }
  });

  it("keeps only the idle content pad when the dashboard hero owns the phone composer", () => {
    expect(
      resolveDashboardVisibleMobileComposerReserve({
        searchMode: "documents",
        hasAnswerFollowUps: false,
        differentialsCompareAddonActive: false,
        heroOwnsPhoneComposer: true,
      }),
    ).toBe(mobileComposerIdleReserve);
    expect(
      resolveDashboardVisibleMobileComposerReserve({
        searchMode: "tools",
        hasAnswerFollowUps: false,
        differentialsCompareAddonActive: false,
        heroOwnsPhoneComposer: true,
      }),
    ).toBe(mobileComposerIdleReserve);
    expect(
      resolveDashboardVisibleMobileComposerReserve({
        searchMode: "answer",
        hasAnswerFollowUps: false,
        differentialsCompareAddonActive: false,
        heroOwnsPhoneComposer: true,
      }),
    ).toBe(mobileComposerIdleReserve);
  });

  it("derives hero phone ownership from the mounted hero slot, not answer-home alone", () => {
    // Answer-home + !canRunSearch keeps showAnswerHome true while the hero slot
    // is unset (showDesktopHomeComposer requires !error). Ownership must follow
    // the slot so the dock reserve stays and the fixed composer cannot cover the
    // setup/error message.
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    const header = source("src/components/clinical-dashboard/master-search-header.tsx");
    expect(dashboard).toContain('(activeModeResultKind === "favourites" && favouritesAccessible)');
    expect(dashboard).toContain(
      'const heroComposerBreakpoint = showDesktopHomeComposer || showAnswerHome ? "all" : "sm-up";',
    );
    expect(dashboard).toContain(
      'const heroOwnsPhoneComposer = Boolean(desktopHomeComposerSlotId) && heroComposerBreakpoint === "all";',
    );
    expect(dashboard).not.toContain("const heroOwnsPhoneComposer = showDesktopHomeComposer || showAnswerHome;");
    // Prescribing leaves MedicationHome as soon as the draft query is non-empty;
    // keep the hero slot (and idle phone reserve) only while that home mounts.
    expect(dashboard).toMatch(
      /searchMode === "prescribing" &&\s*activeModeResultKind === "documents" &&\s*!modeSearchSubmitted &&\s*!query\.trim\(\)/,
    );
    // DifferentialsHome shows results (no mode-home slot) when a draft query
    // coincides with stale evidence matches after clearing a submitted search.
    expect(dashboard).toMatch(
      /activeModeResultKind === "differentials" &&\s*!modeSearchSubmitted &&\s*!\(query\.trim\(\) && documentMatches\.length > 0\)/,
    );
    expect(header).toContain(
      'const heroComposerOwnsPhones = Boolean(desktopHomeComposerSlotId) && heroComposerBreakpoint === "all";',
    );
    expect(
      resolveDashboardVisibleMobileComposerReserve({
        searchMode: "answer",
        hasAnswerFollowUps: false,
        differentialsCompareAddonActive: false,
        heroOwnsPhoneComposer: false,
      }),
    ).toBe(mobileComposerVisibleReserve.dashboardAnswer);
  });

  it("keeps the answer dock reserve compact, growing only for the follow-up chip row", () => {
    expect(
      resolveDashboardVisibleMobileComposerReserve({
        searchMode: "answer",
        hasAnswerFollowUps: false,
        differentialsCompareAddonActive: false,
      }),
    ).toBe(mobileComposerVisibleReserve.dashboardAnswer);
    expect(
      resolveDashboardVisibleMobileComposerReserve({
        searchMode: "answer",
        hasAnswerFollowUps: true,
        differentialsCompareAddonActive: false,
      }),
    ).toBe(mobileComposerVisibleReserve.dashboardAnswerWithFollowUps);
    expect(mobileComposerVisibleReserve.dashboardAnswer).toContain("var(--safe-area-bottom)");
    expect(mobileComposerVisibleReserve.dashboardAnswerWithFollowUps).toContain("var(--safe-area-bottom)");
    expect(mobileComposerVisibleReserve.dashboardAnswer).toContain("var(--keyboard-height, 0px)");
    expect(mobileComposerVisibleReserve.dashboardAnswerWithFollowUps).toContain("var(--keyboard-height, 0px)");
  });

  it("keeps differentials compare clearance shared across hosts", () => {
    expect(mobileComposerVisibleReserve.differentialsCompare).toBe(mobileComposerDifferentialsCompareReserve);
    expect(mobileComposerDifferentialsCompareReserve).toContain("12.5rem");
    expect(mobileComposerDifferentialsCompareReserve).toContain("var(--safe-area-bottom)");
    expect(mobileComposerDifferentialsCompareReserve).toContain("var(--keyboard-height, 0px)");
    expect(mobileComposerDifferentialsCompareReserve).not.toContain("env(safe-area-inset-bottom)");
    expect(
      resolveDashboardVisibleMobileComposerReserve({
        searchMode: "differentials",
        hasAnswerFollowUps: false,
        differentialsCompareAddonActive: true,
      }),
    ).toBe(mobileComposerDifferentialsCompareReserve);
    expect(
      resolveShellVisibleMobileComposerReserve({
        shouldShowSearchComposer: true,
        documentViewerOwnedRoute: false,
        isStandaloneModeHome: false,
        searchMode: "differentials",
        differentialsCompareAddonActive: true,
      }),
    ).toBe(mobileComposerDifferentialsCompareReserve);
  });

  it("classifies document viewer owned routes", () => {
    expect(isDocumentViewerOwnedRoute("/documents/abc")).toBe(true);
    expect(isDocumentViewerOwnedRoute("/documents/source")).toBe(true);
    expect(isDocumentViewerOwnedRoute("/documents/source/evidence")).toBe(true);
    expect(isDocumentViewerOwnedRoute("/documents/search")).toBe(false);
    expect(isDocumentViewerOwnedRoute("/documents")).toBe(false);
    expect(isDocumentViewerOwnedRoute("/forms")).toBe(false);
  });
});
