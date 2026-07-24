import { describe, expect, it } from "vitest";

import { infoPageBackHref } from "@/components/clinical-dashboard/global-search-shell";

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
