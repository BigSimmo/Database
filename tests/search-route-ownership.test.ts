import { describe, expect, it } from "vitest";

import { shouldRenderClinicalDashboard, shouldRenderDashboardSearch } from "@/lib/search-route-ownership";

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
});
