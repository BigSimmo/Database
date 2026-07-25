import { describe, expect, it } from "vitest";

import {
  infoPageBackHref,
  mobileBackHref,
} from "@/components/clinical-dashboard/global-search-shell";

describe("infoPageBackHref", () => {
  it.each([
    ["/services/community-team", "/services"],
    ["/forms/12a", "/forms"],
    ["/medications/lithium", "/?mode=prescribing"],
    ["/differentials/diagnoses/delirium", "/differentials"],
    ["/dsm/diagnoses/delirium", "/dsm"],
    ["/specifiers/anxious-distress", "/specifiers"],
    ["/formulation/example", "/formulation"],
    ["/therapy-compass/cbt/brief", "/therapy-compass"],
    ["/factsheets/lithium", "/factsheets"],
    ["/documents/example", "/documents/search?mode=documents"],
  ])("maps %s to its stable in-app parent", (pathname, expected) => {
    expect(infoPageBackHref(pathname)).toBe(expected);
  });

  it("leaves non-detail routes on browser-history behaviour", () => {
    expect(infoPageBackHref("/services")).toBeNull();
    expect(infoPageBackHref("/privacy")).toBeNull();
  });
});

describe("mobileBackHref", () => {
  it("routes submitted differential search back to the differentials home with focus", () => {
    expect(mobileBackHref("/differentials", "differentials", true)).toBe("/differentials?focus=1");
  });

  it("does not invent a target for non-submitted differential home visits", () => {
    expect(mobileBackHref("/differentials", "differentials", false)).toBeNull();
  });

  it("still prefers info-page parents over mode-home fallbacks", () => {
    expect(mobileBackHref("/differentials/diagnoses/delirium", "differentials", true)).toBe(
      "/differentials",
    );
  });
});
