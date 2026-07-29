import { describe, expect, it } from "vitest";

import {
  WEB_VITALS_THRESHOLDS,
  expectedMobileRuns,
  expectedRuns,
  collidingRouteSlugs,
  incompleteEvidence,
  missingRuns,
  mobileBreaches,
  renderTable,
  routeSlug,
  summariseReport,
} from "../scripts/summarise-web-vitals.mjs";

// Kept in step with the workflow's `routes` dispatch default. Every entry must
// be a real page route in docs/site-map.md: a bare `/documents` has no
// `page.tsx`, so measuring it would have profiled the 404 document.
const DEFAULT_ROUTES = "/,/therapy-compass,/documents/search,/dsm,/forms";

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
      "mobile-documents-search",
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

// #017 asks for reproducible mobile AND desktop evidence, and a run that exits 0
// is a run whose verdict gets recorded. Both gaps below rendered a clean pass and
// exited 0 before this: a complete mobile sweep with no desktop reports at all,
// and a mobile report that exists but carries no LCP/CLS number.
describe("incompleteEvidence", () => {
  const allRuns = () => expectedRuns(DEFAULT_ROUTES).map((run) => row(run, 1200, 0.01));

  it("is empty when every requested mobile and desktop run reported", () => {
    expect(incompleteEvidence(allRuns(), DEFAULT_ROUTES)).toEqual([]);
  });

  it("covers both strategies, so a missing desktop report is incomplete evidence", () => {
    const mobileOnly = expectedMobileRuns(DEFAULT_ROUTES).map((run) => row(run, 1200, 0.01));
    expect(mobileBreaches(mobileOnly, DEFAULT_ROUTES)).toEqual([]); // thresholds all pass
    expect(missingRuns(mobileOnly, DEFAULT_ROUTES)).toEqual([
      "desktop-root",
      "desktop-therapy-compass",
      "desktop-documents-search",
      "desktop-dsm",
      "desktop-forms",
    ]);
    expect(incompleteEvidence(mobileOnly, DEFAULT_ROUTES)).toHaveLength(5);
    expect(renderTable(mobileOnly, DEFAULT_ROUTES)).toContain("Evidence is incomplete");
  });

  it("treats a present report with no LCP/CLS number as incomplete, not merely a breach", () => {
    const rows = allRuns().map((r) => (r.run === "mobile-dsm" ? { ...r, lcpMs: null } : r));
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual(["mobile-dsm"]);
  });

  it("does not treat an over-threshold measurement as incomplete evidence", () => {
    const rows = allRuns().map((r) =>
      r.run === "mobile-forms" ? { ...r, lcpMs: WEB_VITALS_THRESHOLDS.lcpMs + 1 } : r,
    );
    expect(mobileBreaches(rows, DEFAULT_ROUTES).map((b) => b.run)).toEqual(["mobile-forms"]);
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual([]);
  });

  // Completeness is a property of the whole matrix. Checking metric validity
  // only on mobile left a desktop report with null metrics reading as evidence.
  it("rejects a desktop report that exists but carries no LCP/CLS number", () => {
    const rows = allRuns().map((r) => (r.run === "desktop-forms" ? { ...r, cls: null } : r));
    expect(mobileBreaches(rows, DEFAULT_ROUTES)).toEqual([]); // mobile verdict is clean
    expect(missingRuns(rows, DEFAULT_ROUTES)).toEqual([]); // the file is present
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual(["desktop-forms"]);
  });

  // `/a/b` and `/a-b` both slug to `a-b`, so the second Lighthouse run
  // overwrites the first and one requested route is never retained — while the
  // surviving file satisfies the expected-run check for both.
  it("rejects colliding route slugs, which silently drop a requested route", () => {
    const colliding = "/a/b,/a-b";
    expect(collidingRouteSlugs(colliding)).toEqual(["a-b"]);
    const rows = [row("mobile-a-b", 1200, 0.01), row("desktop-a-b", 1200, 0.01)];
    expect(missingRuns(rows, colliding)).toEqual([]); // every expected key is "present"
    expect(incompleteEvidence(rows, colliding)).toContain("route slug collision: a-b");
  });

  it("accepts distinct routes that do not collide", () => {
    expect(collidingRouteSlugs(DEFAULT_ROUTES)).toEqual([]);
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
