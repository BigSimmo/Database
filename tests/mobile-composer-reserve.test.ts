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
        useCompactBottomSearch: false,
      }),
    ).toBe(mobileComposerHiddenReserve);
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
        compactMobileBottomSearch: true,
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
