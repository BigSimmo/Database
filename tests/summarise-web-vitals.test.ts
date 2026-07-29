import { describe, expect, it } from "vitest";

import {
  WEB_VITALS_THRESHOLDS,
  expectedMobileRuns,
  expectedRuns,
  collidingRouteSlugs,
  incompleteEvidence,
  isProductionVerdict,
  measuredRequestedPage,
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
  const url = `https://psychiatry.tools/${run}`;
  return {
    run,
    url,
    requestedUrl: url,
    runtimeError: null,
    performanceScore: 0.99,
    lcpMs,
    cls,
    tbtMs: 10,
    fcpMs: 500,
  };
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
    expect(renderTable(mobileOnly, DEFAULT_ROUTES)).toContain("NOT an #017 verdict");
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

  // An origin check alone passes a route that redirected to another page on the
  // same host — an auth bounce to /login, a same-origin error page, a mistyped
  // route. The numbers are clean but they describe a different page, and the
  // filename cannot reveal it.
  it("rejects a run that redirected to a different same-origin path", () => {
    const rows = allRuns().map((r) => (r.run === "mobile-dsm" ? { ...r, url: "https://psychiatry.tools/login" } : r));
    expect(isProductionVerdict(rows)).toBe(true); // origin is still canonical
    expect(measuredRequestedPage(rows.find((r) => r.run === "mobile-dsm"))).toBe(false);
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual(["mobile-dsm"]);
  });

  it("rejects a run that reported a Lighthouse runtime error", () => {
    const rows = allRuns().map((r) => (r.run === "desktop-forms" ? { ...r, runtimeError: "NO_FCP" } : r));
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual(["desktop-forms"]);
  });

  // /documents/search?q=depression and /documents/search are different pages to
  // measure: one renders results, the other an empty state.
  it("rejects a redirect that drops the query string", () => {
    const requested = "https://psychiatry.tools/documents/search?q=depression";
    const rows = allRuns().map((r) =>
      r.run === "mobile-documents-search"
        ? { ...r, requestedUrl: requested, url: "https://psychiatry.tools/documents/search" }
        : r,
    );
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual(["mobile-documents-search"]);
  });

  it("accepts the same query with params in a different order", () => {
    const rows = allRuns().map((r) =>
      r.run === "mobile-dsm"
        ? {
            ...r,
            requestedUrl: "https://psychiatry.tools/dsm?a=1&b=2",
            url: "https://psychiatry.tools/dsm?b=2&a=1",
          }
        : r,
    );
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual([]);
  });

  it("tolerates a trailing-slash difference between requested and final URL", () => {
    const rows = allRuns().map((r) => (r.run === "mobile-forms" ? { ...r, url: `${r.requestedUrl}/` } : r));
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual([]);
  });
});

// LIVE_DOMAIN_URL can point the workflow at a staging cutover. That is a useful
// dry run, but #017 asks for evidence from the production origin, so such a run
// must not emit the closure sentence. Read from each report's own final URL so a
// redirect to another host is caught too, not just a deliberate override.
describe("production-origin gate", () => {
  const staging = (run: string) => ({
    run,
    url: `https://staging.psychiatry.tools/${run}`,
    performanceScore: 0.99,
    lcpMs: 1200,
    cls: 0.01,
    tbtMs: 10,
    fcpMs: 500,
  });

  it("states the #017 closure only for the canonical production origin", () => {
    const rows = expectedRuns(DEFAULT_ROUTES).map((run) => row(run, 1200, 0.01));
    expect(isProductionVerdict(rows)).toBe(true);
    expect(renderTable(rows, DEFAULT_ROUTES)).toContain("NOT yet an #017 closure");
  });

  it("refuses an #017 verdict for a staging override even when every threshold passes", () => {
    const rows = expectedRuns(DEFAULT_ROUTES).map(staging);
    expect(mobileBreaches(rows, DEFAULT_ROUTES)).toEqual([]); // thresholds all pass
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual([]); // evidence is complete
    expect(isProductionVerdict(rows)).toBe(false);
    const table = renderTable(rows, DEFAULT_ROUTES);
    expect(table).not.toContain("NOT yet an #017 closure");
    expect(table).toContain("NOT an #017 verdict");
    expect(table).toContain("https://staging.psychiatry.tools");
  });

  it("refuses a verdict when only some reports left the canonical origin", () => {
    const rows = expectedRuns(DEFAULT_ROUTES).map((run) => row(run, 1200, 0.01));
    expect(isProductionVerdict([...rows.slice(1), staging("mobile-root")])).toBe(false);
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

// A run that cannot produce a verdict must not emit verdict prose at all. Both
// the threshold sentence and the "findings become actionable" sentence used to
// be reachable while the run was separately disqualified — for incomplete
// evidence or for a non-production origin — so the summary asserted a verdict in
// bold and then contradicted it. Whichever line a reader took away, one was
// false. These pin that the disqualification is the ONLY verdict-shaped claim.
describe("verdict prose is gated on the run being able to produce a verdict", () => {
  const staging = (run: string, lcpMs = 1200) => {
    const url = `https://staging.psychiatry.tools/${run}`;
    return { ...row(run, lcpMs, 0.01), url, requestedUrl: url };
  };

  it("suppresses the threshold claim when a run measured the wrong page", () => {
    const rows = expectedRuns(DEFAULT_ROUTES).map((run) =>
      run === "mobile-dsm" ? { ...row(run, 1200, 0.01), url: "https://psychiatry.tools/login" } : row(run, 1200, 0.01),
    );
    // The redirected run still carries passing numbers, so nothing breaches.
    expect(mobileBreaches(rows, DEFAULT_ROUTES)).toEqual([]);
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual(["mobile-dsm"]);

    const table = renderTable(rows, DEFAULT_ROUTES);
    expect(table).toContain("NOT an #017 verdict");
    expect(table).toContain("mobile-dsm");
    // The two claims that must not survive a disqualified run.
    expect(table).not.toContain("Every mobile route is within");
    expect(table).not.toContain("NOT yet an #017 closure");
    // The measurement is still reported, explicitly subordinated.
    expect(table).toContain("For reference only");
  });

  it("does not call a staging breach actionable", () => {
    const rows = expectedRuns(DEFAULT_ROUTES).map((run) => staging(run, run === "mobile-forms" ? 3000 : 1200));
    expect(incompleteEvidence(rows, DEFAULT_ROUTES)).toEqual([]); // evidence is complete…
    expect(isProductionVerdict(rows)).toBe(false); // …but not from production
    expect(mobileBreaches(rows, DEFAULT_ROUTES)).toHaveLength(1);

    const table = renderTable(rows, DEFAULT_ROUTES);
    expect(table).toContain("NOT an #017 verdict");
    expect(table).toContain("https://staging.psychiatry.tools");
    expect(table).not.toContain("become actionable, ranked by measured contribution");
    // The breach is still visible, as a measurement rather than a verdict.
    expect(table).toContain("mobile-forms");
    expect(table).toContain("This is a measurement, not a verdict");
  });

  it("reports both disqualifiers together rather than only the first", () => {
    const rows = expectedRuns(DEFAULT_ROUTES)
      .filter((run) => !run.startsWith("desktop-"))
      .map((run) => staging(run));
    const table = renderTable(rows, DEFAULT_ROUTES);
    expect(table).toContain("produced no usable report");
    expect(table).toContain("asks for evidence from https://psychiatry.tools");
  });
});

// Chrome ships with the runner image, not with the pinned LIGHTHOUSE_VERSION, so
// it moves underneath a baseline and a metric shift can originate in the browser
// rather than the application. summariseReport keeps what actually drove the run.
describe("measurement environment", () => {
  it("records the Chrome build that produced the report", () => {
    const summary = summariseReport("mobile-root", {
      requestedUrl: "https://psychiatry.tools/",
      finalDisplayedUrl: "https://psychiatry.tools/",
      environment: { hostUserAgent: "Mozilla/5.0 … Chrome/141.0.0.0 Safari/537.36" },
      categories: { performance: { score: 0.99 } },
      audits: {},
    });
    expect(summary.chromeVersion).toBe("Mozilla/5.0 … Chrome/141.0.0.0 Safari/537.36");
  });

  it("leaves the field null when the report does not state it", () => {
    expect(summariseReport("mobile-root", { audits: {} }).chromeVersion).toBeNull();
  });
});
