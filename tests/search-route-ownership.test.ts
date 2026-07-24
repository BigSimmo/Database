import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
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
    for (const pathname of [
      "/services",
      "/forms",
      "/favourites",
      "/differentials",
      "/dsm",
      "/specifiers",
      "/formulation",
      "/factsheets",
      "/therapy-compass",
      "/tools",
    ]) {
      expect(isStandaloneModeHomePath(pathname)).toBe(true);
    }
    expect(isStandaloneModeHomePath("/")).toBe(false);
    expect(isStandaloneModeHomePath("/services/crisis")).toBe(false);
    expect(isStandaloneModeHomePath("/dsm/search")).toBe(false);
  });

  it("classifies dashboard mode hrefs without parsing the destination page", () => {
    expect(isDashboardModeHref("/")).toBe(true);
    expect(isDashboardModeHref("/?mode=answer")).toBe(true);
    expect(isDashboardModeHref("/?mode=documents&focus=1")).toBe(true);
    expect(isDashboardModeHref("/services")).toBe(false);
    expect(isDashboardModeHref("/differentials?q=mania&run=1")).toBe(false);
  });

  it("keeps shell mode-home detection pathname-gated (no searchMode∧pathname AND)", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
      "utf8",
    );
    expect(shellSource).toContain("isStandaloneModeHomePath(pathname)");
    expect(shellSource).not.toMatch(/searchMode === "services" && pathname === "\/services"/);
    // changeMode must not optimistic-set searchMode before navigation.
    expect(shellSource).toMatch(/function changeMode\(mode: AppModeId\) \{[\s\S]*?navigateToMode\(mode\);\n  \}/);
    expect(shellSource).not.toMatch(
      /function changeMode\(mode: AppModeId\) \{[\s\S]*?setSearchMode\(mode\);[\s\S]*?navigateToMode\(mode\);/,
    );
  });
});
