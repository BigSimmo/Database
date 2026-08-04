import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET as redirectPresentations } from "@/app/(search-app)/differentials/presentations/route";
import { differentialRouteWithQuery, differentialSelectedCompareHref } from "@/lib/differentials-navigation";

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

    expect(href).toBe("/differentials/presentations?q=Pain&ids=anorexia-nervosa%2Cbulimia-nervosa-binge-purge-pattern");
    expect(href).not.toContain("0.0.0.0");
    expect(href).not.toMatch(/^https?:\/\//);
  });

  it("does not import the differentials snapshot module from the client-safe navigation helpers", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../src/lib/differentials-navigation.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/lib\/differentials["']/);
    expect(source).not.toMatch(/differentials-snapshot|loadDifferentialSnapshot/);
  });

  it("redirects compare selection with a relative Location even when the request host is a bind address", () => {
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
});
