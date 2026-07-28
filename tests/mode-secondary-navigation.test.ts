import { describe, expect, it } from "vitest";

import { appModeIds, type AppModeId } from "@/lib/app-modes";
import { isInformationPage } from "@/lib/information-pages";
import {
  isModeSecondaryNavigationRoute,
  modeSecondaryNavigationHref,
  modeSecondaryNavigationRegistry,
} from "@/lib/mode-secondary-navigation";

const expectedLabels: Record<AppModeId, string[]> = {
  answer: ["Ask"],
  documents: ["Search"],
  services: ["Search"],
  forms: ["Search"],
  favourites: ["Search"],
  differentials: ["Search", "Diagnoses", "Compare"],
  dsm: ["Search", "Compare"],
  specifiers: ["Find", "Build", "Compare", "Map"],
  formulation: ["Find", "Build", "Compare", "Map"],
  prescribing: ["Search"],
  tools: ["Search"],
  "therapy-compass": ["Search", "Recommend", "Compare", "Pathways", "Brief Intervention", "Patient Sheets"],
  factsheets: ["Search"],
};

const cleanLandingPath: Record<AppModeId, string> = {
  answer: "/",
  documents: "/",
  services: "/services",
  forms: "/forms",
  favourites: "/favourites",
  differentials: "/differentials",
  dsm: "/dsm",
  specifiers: "/specifiers",
  formulation: "/formulation",
  prescribing: "/medications",
  tools: "/tools",
  "therapy-compass": "/therapy-compass",
  factsheets: "/factsheets",
};

describe("mode secondary navigation registry", () => {
  it("covers all 13 modes with the approved destinations and no Home item", () => {
    expect(Object.keys(modeSecondaryNavigationRegistry).sort()).toEqual([...appModeIds].sort());
    expect(appModeIds).toHaveLength(13);

    for (const modeId of appModeIds) {
      const labels = modeSecondaryNavigationRegistry[modeId].map((item) => item.label);
      expect(labels).toEqual(expectedLabels[modeId]);
      expect(labels.map((label) => label.toLowerCase())).not.toContain("home");
    }
  });

  it("suppresses clean landing pages but renders after a submitted mode search", () => {
    for (const modeId of appModeIds) {
      expect(
        isModeSecondaryNavigationRoute({ modeId, pathname: cleanLandingPath[modeId], hasSubmittedSearch: false }),
      ).toBe(false);
      expect(
        isModeSecondaryNavigationRoute({ modeId, pathname: cleanLandingPath[modeId], hasSubmittedSearch: true }),
      ).toBe(true);
    }
  });

  it("recognises explicit workflow routes without treating detail routes as mode navigation", () => {
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "specifiers",
        pathname: "/specifiers/builder",
        hasSubmittedSearch: false,
      }),
    ).toBe(true);
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "formulation",
        pathname: "/formulation/map",
        hasSubmittedSearch: false,
      }),
    ).toBe(true);
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "specifiers",
        pathname: "/specifiers/with-anxious-distress",
        hasSubmittedSearch: false,
      }),
    ).toBe(false);
  });

  it("translates compatible workflow selection state into each destination URL", () => {
    expect(
      modeSecondaryNavigationHref({
        modeId: "specifiers",
        itemId: "builder",
        href: "/specifiers/builder",
        currentSearchParams: new URLSearchParams("a=first&b=second"),
      }),
    ).toBe("/specifiers/builder?specifier=first&specifier=second");

    expect(
      modeSecondaryNavigationHref({
        modeId: "formulation",
        itemId: "compare",
        href: "/formulation/compare",
        currentSearchParams: new URLSearchParams("mechanism=threat&mechanism=avoidance"),
      }),
    ).toBe("/formulation/compare?a=threat&b=avoidance");

    expect(
      modeSecondaryNavigationHref({
        modeId: "differentials",
        itemId: "compare",
        href: "/differentials/presentations",
        currentSearchParams: new URLSearchParams("q=confusion&ids=delirium%2Cdementia"),
      }),
    ).toBe("/differentials/presentations?q=confusion&ids=delirium%2Cdementia");
  });
});

describe("information page classification", () => {
  it.each([
    "/services/crisis-team",
    "/forms/form-1",
    "/medications/sertraline",
    "/specifiers/with-anxious-distress",
    "/formulation/avoidance",
    "/factsheets/sertraline",
    "/therapy-compass/cbt",
    "/therapy-compass/cbt/brief",
    "/therapy-compass/cbt/sheet",
    "/differentials/diagnoses/delirium",
    "/differentials/presentations/acute-confusion-encephalopathy",
    "/dsm/diagnoses/major-depressive-disorder",
    "/dsm/diagnoses/major-depressive-disorder/differentials",
    "/documents/11111111-1111-4111-8111-111111111111",
  ])("classifies %s as an information page", (pathname) => {
    expect(isInformationPage(pathname)).toBe(true);
  });

  it.each([
    "/services",
    "/forms",
    "/specifiers/builder",
    "/formulation/compare",
    "/factsheets/search",
    "/therapy-compass/search",
    "/differentials/diagnoses",
    "/dsm/compare",
    "/documents/search",
  ])("does not classify workflow route %s as an information page", (pathname) => {
    expect(isInformationPage(pathname)).toBe(false);
  });
});
