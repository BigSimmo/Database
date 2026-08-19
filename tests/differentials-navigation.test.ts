import { describe, expect, it } from "vitest";

import {
  differentialCompareQueueItems,
  resolveDifferentialCompareHandoff,
  resolveDifferentialCompareLaunchHref,
} from "@/lib/differentials";
import {
  differentialCompareSearchHref,
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
    const handoff = resolveDifferentialCompareHandoff(
      ["anorexia-nervosa", "bulimia-nervosa-binge-purge-pattern"],
      "Pain",
    );

    expect(handoff.kind).toBe("presentation");
    expect(handoff.href).toMatch(/^\/differentials\/presentations\/[^/?]+/);
    expect(handoff.href).toContain("q=Pain");
    expect(handoff.href).toContain("ids=");
    expect(handoff.href).not.toContain("0.0.0.0");
  });

  it("keeps cross-presentation compare selection on the ad-hoc compare page with every id", () => {
    const handoff = resolveDifferentialCompareHandoff(
      ["medical-gi-endocrine-painful-organic-cause", "bpsd-as-unmet-need-delirium-pain-mimic"],
      "Pain",
    );

    expect(handoff.kind).toBe("ad-hoc");
    expect(handoff.href).toBe(
      "/differentials/compare?q=Pain&ids=medical-gi-endocrine-painful-organic-cause%2Cbpsd-as-unmet-need-delirium-pain-mimic",
    );
  });

  it("parses and builds compare selection ids on the current URL search", () => {
    expect(differentialIdsFromSearchParams("q=Pain&ids=a%2Cb")).toEqual(["a", "b"]);
    expect(differentialIdsFromSearchParams("ids=DELIRIUM,Unknown,delirium")).toEqual(["delirium", "unknown"]);
    expect(
      differentialSelectionIdsSearch(
        ["medical-gi-endocrine-painful-organic-cause", "bpsd-as-unmet-need-delirium-pain-mimic"],
        "?q=Pain&run=1",
      ),
    ).toBe("?q=Pain&run=1&ids=medical-gi-endocrine-painful-organic-cause%2Cbpsd-as-unmet-need-delirium-pain-mimic");
  });

  it("preserves every selected diagnosis id across the presentations redirect", () => {
    const handoff = resolveDifferentialCompareHandoff(
      ["anorexia-nervosa", "bulimia-nervosa-binge-purge-pattern"],
      "pain",
    );

    expect(handoff.kind).toBe("presentation");
    expect(handoff.href).toContain("anorexia-nervosa");
    expect(handoff.href).toContain("bulimia-nervosa-binge-purge-pattern");
  });

  it("launches same-presentation compare into the presentation workflow", () => {
    const href = resolveDifferentialCompareLaunchHref(
      ["anorexia-nervosa", "bulimia-nervosa-binge-purge-pattern"],
      "Pain",
    );
    expect(href).toMatch(/^\/differentials\/presentations\/[^/?]+/);
    expect(href).toContain("ids=");
  });

  it("launches cross-presentation compare into the compare workspace", () => {
    const href = resolveDifferentialCompareLaunchHref(
      ["medical-gi-endocrine-painful-organic-cause", "bpsd-as-unmet-need-delirium-pain-mimic"],
      "Pain",
    );
    expect(href).toContain("/differentials/compare?");
    expect(href).toContain("workspace=1");
    expect(href).toContain("ids=");
  });

  it("launches single-diagnosis compare into the default presentation workflow", () => {
    const href = resolveDifferentialCompareLaunchHref(["wernicke-encephalopathy"], "Pain");
    expect(href).toMatch(/^\/differentials\/presentations\//);
    expect(href).toContain("acute-confusion-encephalopathy");
    expect(href).toContain("ids=wernicke-encephalopathy");
  });

  it("builds compare queue titles from known diagnosis slugs only", () => {
    const items = differentialCompareQueueItems([
      "delirium",
      "unknown-diagnosis-slug",
      "dementia-neurocognitive-disorder",
    ]);
    expect(items.map((item) => item.slug)).toEqual(["delirium", "dementia-neurocognitive-disorder"]);
    expect(items[0]).toEqual({ slug: "delirium", title: "Delirium" });
    expect(items[1]?.title.toLowerCase()).toContain("dementia");
  });

  it("preserves compare-queue ids when returning to Search", () => {
    const href = differentialCompareSearchHref("Pain", ["wernicke-encephalopathy", "delirium"]);
    expect(href).toContain("/differentials/search?");
    expect(href).toContain("q=Pain");
    expect(href).toContain("run=1");
    expect(href).toMatch(/ids=wernicke-encephalopathy%2Cdelirium|ids=wernicke-encephalopathy,delirium/);
  });
});
