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
    expect(shellSource).toContain("resetPhoneScrollHideRef.current()");
    expect(shellSource).toMatch(/main\.scrollTop = 0[\s\S]*\}, \[pathname\]\)/);
  });

  it("keeps the default composer until the hero portal host attaches", () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/master-search-header.tsx"),
      "utf8",
    );
    expect(headerSource).not.toContain("desktopHomeComposerSlotId && !desktopHomeComposerFallback");
    expect(headerSource).toMatch(
      /desktopHomeComposerActive && desktopHomeComposerHost\s*\?\s*null\s*:\s*renderSearchComposer\("default"\)/,
    );
  });

  it("leaves the dashboard shell without eager chrome thrash", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/ClinicalDashboard.tsx"), "utf8");
    expect(dashboardSource).toContain("isDashboardModeHref");
    expect(dashboardSource).toMatch(
      /function selectSearchMode\(mode: AppModeId\) \{[\s\S]*?if \(!isDashboardModeHref\(href\)\) \{[\s\S]*?router\.push\(href\);\n      return;/,
    );
    expect(dashboardSource).toMatch(
      /function crossModeSearch\(mode: AppModeId, crossQuery: string\) \{[\s\S]*?if \(!isDashboardModeHref\(href\)\) \{[\s\S]*?router\.push\(href\);\n      return;/,
    );
  });
});
