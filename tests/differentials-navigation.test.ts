import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET as redirectPresentations } from "@/app/(search-app)/differentials/presentations/route";
import {
  differentialIdsFromSearchParams,
  differentialRouteWithQuery,
  differentialSelectedCompareHref,
  differentialSelectionIdsSearch,
} from "@/lib/differentials-navigation";

describe("differentials navigation", () => {
  it("builds same-origin relative query routes", () => {
    expect(differentialRouteWithQuery("/differentials/diagnoses", " acute confusion ")).toBe(
      "/differentials/diagnoses?q=acute+confusion",
    );
  });

  it("keeps compare-selected hrefs client-safe and ID-preserving without resolving the workflow locally", () => {
    const href = differentialSelectedCompareHref(
      "Pain",
      new Set(["anorexia-nervosa", "bulimia-nervosa-binge-purge-pattern"]),
    );

    expect(href).toBe("/differentials/compare?q=Pain&ids=anorexia-nervosa%2Cbulimia-nervosa-binge-purge-pattern");
    expect(href).not.toContain("0.0.0.0");
    expect(href).not.toMatch(/^https?:\/\//);
  });

  it("does not import the differentials snapshot module from the client-safe navigation helpers", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../src/lib/differentials-navigation.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/lib\/differentials["']/);
    expect(source).not.toMatch(/differentials-snapshot|loadDifferentialSnapshot/);
  });

  it("redirects same-presentation compare selection to the hosting workflow", () => {
    const response = redirectPresentations(
      new NextRequest(
        "http://0.0.0.0:4461/differentials/presentations?q=Pain&ids=anorexia-nervosa,bulimia-nervosa-binge-purge-pattern",
      ),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toMatch(/^\/differentials\/presentations\/[^/?]+/);
    expect(location).toContain("q=Pain");
    expect(location).toContain("ids=");
    expect(location).not.toContain("0.0.0.0");
  });

  it("redirects cross-presentation compare selection to the ad-hoc compare route with every id", () => {
    const response = redirectPresentations(
      new NextRequest(
        "http://0.0.0.0:4461/differentials/presentations?q=Pain&ids=medical-gi-endocrine-painful-organic-cause,bpsd-as-unmet-need-delirium-pain-mimic",
      ),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe(
      "/differentials/compare?q=Pain&ids=medical-gi-endocrine-painful-organic-cause%2Cbpsd-as-unmet-need-delirium-pain-mimic",
    );
  });

  it("parses and builds compare selection ids on the current URL search", () => {
    expect(differentialIdsFromSearchParams("q=Pain&ids=a%2Cb")).toEqual(["a", "b"]);
    expect(
      differentialSelectionIdsSearch(
        ["medical-gi-endocrine-painful-organic-cause", "bpsd-as-unmet-need-delirium-pain-mimic"],
        "?q=Pain&run=1",
      ),
    ).toBe("?q=Pain&run=1&ids=medical-gi-endocrine-painful-organic-cause%2Cbpsd-as-unmet-need-delirium-pain-mimic");
  });
});
