import { describe, expect, it } from "vitest";

import {
  isDocumentViewerOwnedRoute,
  mobileComposerDifferentialsCompareReserve,
  mobileComposerHiddenReserve,
  mobileComposerIdleReserve,
  mobileComposerVisibleReserve,
  resolveDashboardVisibleMobileComposerReserve,
  resolveMobileComposerReserve,
  resolveShellVisibleMobileComposerReserve,
} from "@/components/clinical-dashboard/mobile-composer-reserve";

describe("mobile composer reserve contract", () => {
  it("collapses to the hidden pad without Safari toolbar safe-area", () => {
    expect(mobileComposerHiddenReserve).toBe("0.75rem");
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

  it("reserves compact dock clearance on standalone mode homes (phone dock, hero from sm up)", () => {
    expect(
      resolveShellVisibleMobileComposerReserve({
        shouldShowSearchComposer: true,
        documentViewerOwnedRoute: false,
        isStandaloneModeHome: true,
        searchMode: "services",
        differentialsCompareAddonActive: false,
      }),
    ).toBe(mobileComposerVisibleReserve.shellDock);
  });

  it("uses the compact dock reserve for every non-answer dashboard dock (mode homes included)", () => {
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
  });

  it("keeps differentials compare clearance shared across hosts", () => {
    expect(mobileComposerVisibleReserve.differentialsCompare).toBe(mobileComposerDifferentialsCompareReserve);
    expect(mobileComposerDifferentialsCompareReserve).toContain("12.5rem");
    expect(mobileComposerDifferentialsCompareReserve).toContain("var(--safe-area-bottom)");
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
