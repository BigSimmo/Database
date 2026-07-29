import { describe, expect, it } from "vitest";

import {
  WEB_VITALS_THRESHOLDS,
  expectedMobileRuns,
  mobileBreaches,
  renderTable,
  routeSlug,
  summariseReport,
} from "../scripts/summarise-web-vitals.mjs";

const DEFAULT_ROUTES = "/,/therapy-compass,/documents,/dsm,/forms";

function row(run: string, lcpMs: number | null, cls: number | null) {
  return { run, url: `https://psychiatry.tools/${run}`, performanceScore: 0.99, lcpMs, cls, tbtMs: 10, fcpMs: 500 };
}

describe("routeSlug", () => {
  it("matches the filename slugs the workflow's sed expression produces", () => {
    expect(routeSlug("/")).toBe("root");
    expect(routeSlug("/dsm")).toBe("dsm");
    expect(routeSlug("/therapy-compass")).toBe("therapy-compass");
    expect(routeSlug("/a/b")).toBe("a-b");
    expect(routeSlug("  /forms  ")).toBe("forms");
    expect(routeSlug("")).toBeNull();
  });
});

describe("expectedMobileRuns", () => {
  it("derives one mobile run per requested route", () => {
    expect(expectedMobileRuns(DEFAULT_ROUTES)).toEqual([
      "mobile-root",
      "mobile-therapy-compass",
      "mobile-documents",
      "mobile-dsm",
      "mobile-forms",
    ]);
  });
});

describe("mobileBreaches", () => {
  it("passes when every requested mobile route reports inside the thresholds", () => {
    const rows = expectedMobileRuns(DEFAULT_ROUTES).map((run) => row(run, 1200, 0.01));
    expect(mobileBreaches(rows, DEFAULT_ROUTES)).toEqual([]);
  });

  it("treats a missing metric as a breach", () => {
    const rows = expectedMobileRuns(DEFAULT_ROUTES).map((run) =>
      run === "mobile-dsm" ? row(run, null, 0.01) : row(run, 1200, 0.01),
    );
    const breaches = mobileBreaches(rows, DEFAULT_ROUTES);
    expect(breaches.map((breach) => breach.run)).toEqual(["mobile-dsm"]);
  });

  it("treats an over-threshold metric as a breach", () => {
    const rows = expectedMobileRuns(DEFAULT_ROUTES).map((run) =>
      run === "mobile-forms" ? row(run, WEB_VITALS_THRESHOLDS.lcpMs + 1, 0.01) : row(run, 1200, 0.01),
    );
    expect(mobileBreaches(rows, DEFAULT_ROUTES).map((breach) => breach.run)).toEqual(["mobile-forms"]);
  });

  // The regression this file exists for: the workflow downgrades a per-route
  // Lighthouse failure to a warning, so a mobile route can produce no report at
  // all. Grading only the reports that exist reported a clean pass and would
  // have closed #017 on evidence that was never collected.
  it("treats a requested mobile route with no report as a breach", () => {
    const rows = [row("desktop-root", 900, 0.005)];
    const breaches = mobileBreaches(rows, DEFAULT_ROUTES);
    expect(breaches).toHaveLength(5);
    expect(breaches.every((breach) => breach.missingReport)).toBe(true);
    expect(renderTable(rows, DEFAULT_ROUTES)).not.toContain("Every mobile route is within");
  });

  it("does not read an all-desktop directory as a pass even with no route list", () => {
    const breaches = mobileBreaches([row("desktop-root", 900, 0.005)], "");
    expect(breaches).toHaveLength(1);
    expect(breaches[0].missingReport).toBe(true);
    expect(renderTable([row("desktop-root", 900, 0.005)], "")).not.toContain("Every mobile route is within");
  });
});

describe("summariseReport", () => {
  it("reads the lab metrics and treats a non-finite value as absent", () => {
    const summary = summariseReport("mobile-root", {
      finalDisplayedUrl: "https://psychiatry.tools/",
      categories: { performance: { score: 0.97 } },
      audits: {
        "largest-contentful-paint": { numericValue: 1234 },
        "cumulative-layout-shift": { numericValue: 0.02 },
        "total-blocking-time": { numericValue: 55 },
        "first-contentful-paint": { numericValue: Number.NaN },
      },
    });
    expect(summary).toMatchObject({ run: "mobile-root", lcpMs: 1234, cls: 0.02, tbtMs: 55, fcpMs: null });
  });
});
