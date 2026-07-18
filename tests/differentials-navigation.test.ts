import { describe, expect, it } from "vitest";

import { differentialRouteWithQuery, differentialSelectedCompareHref } from "@/lib/differentials-navigation";

describe("differentials navigation", () => {
  it("builds same-origin relative query routes", () => {
    expect(differentialRouteWithQuery("/differentials/diagnoses", " acute confusion ")).toBe(
      "/differentials/diagnoses?q=acute+confusion",
    );
  });

  it("wires selected comparison directly to a presentation page instead of the redirect endpoint", () => {
    const href = differentialSelectedCompareHref("Pain", new Set(["anorexia-nervosa", "bulimia-nervosa-binge-purge-pattern"]));

    expect(href).toMatch(/^\/differentials\/presentations\/[^?]+\?/);
    expect(href).toContain("q=Pain");
    expect(href).toContain("ids=anorexia-nervosa%2Cbulimia-nervosa-binge-purge-pattern");
    expect(href).not.toContain("0.0.0.0");
  });
});
