import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Ledger #093: Next streaming can leave a hidden duplicate page root. Bare
 * `page.getByTestId(...)` then fails Playwright strict mode under full-suite
 * load (Production UI shard 2 on PR #1729: `dsm-home-main` resolved to 2).
 *
 * Page-root / shell surfaces in `tests/ui-route-coverage.spec.ts` must go
 * through `visibleByTestId` (or `expectSingleSettledOwner`) from
 * `tests/playwright-settlement.ts`. This offline contract keeps that defect
 * from returning as a red CI flake.
 */
const ROUTE_COVERAGE = "tests/ui-route-coverage.spec.ts";

const PAGE_ROOT_TEST_IDS = [
  // `dsm-home-main` and `dsm-home-compare` left this list with the DSM detailed
  // home: `/dsm` redirects onto the shared home, so the route proves
  // `shared-home-empty-state` instead and Compare is reached from the mode nav.
  "shared-home-empty-state",
  "dsm-comparison-page",
  "dsm-differential-considerations-page",
  "search-query-ribbon",
] as const;

const FORMS_SECTION_NAV = "tests/ui-forms-section-nav.spec.ts";

const FORMULATION = "tests/ui-formulation.spec.ts";

// Production UI shard 3 on PR #2651: the `/formulation/compare` lede resolved
// to 2 elements — the live copy under `mobile-composer-reserve-pad` and a
// hidden streaming twin beside it. These are the copy assertions on that spec's
// page-root surfaces; each must go through `visibleByText`.
const FORMULATION_PAGE_COPY = [
  String.raw`/replaying what happened or trying to prevent what might happen next/i`,
  `"Most useful distinction", { exact: true }`,
  String.raw`/does not assert causation/i`,
  `"Selected mechanism", { exact: true }`,
  `"Psychiatric specifier", { exact: true }`,
] as const;

describe("playwright settlement contract (#093)", () => {
  it("ui-route-coverage scopes page-root testids through visibleByTestId", () => {
    const source = readFileSync(ROUTE_COVERAGE, "utf8");
    expect(source).toMatch(/import\s*\{[^}]*\bvisibleByTestId\b[^}]*\}\s*from\s*["']\.\/playwright-settlement["']/);

    for (const testId of PAGE_ROOT_TEST_IDS) {
      expect(source, `${testId} must use visibleByTestId`).toContain(`visibleByTestId(currentPage, "${testId}")`);
      expect(source, `${testId} must not use bare getByTestId`).not.toMatch(
        new RegExp(String.raw`getByTestId\(\s*["']${testId}["']\s*\)`),
      );
    }
  });

  it("ui-forms-section-nav scopes form-detail-header through visibleByTestId", () => {
    // Production UI shard 1 on PR #1781: bare form-detail-header resolved to 2
    // under full-suite load (in-flow + phone-portaled / streaming twin).
    const source = readFileSync(FORMS_SECTION_NAV, "utf8");
    expect(source).toMatch(/import\s*\{[^}]*\bvisibleByTestId\b[^}]*\}\s*from\s*["']\.\/playwright-settlement["']/);
    expect(source).toContain('visibleByTestId(page, "form-detail-header")');
    expect(source).not.toMatch(/getByTestId\(\s*["']form-detail-header["']\s*\)/);
  });

  it("ui-formulation scopes page-root copy and the query ribbon through the settlement helpers", () => {
    const source = readFileSync(FORMULATION, "utf8");
    expect(source).toMatch(/import\s*\{[^}]*\bvisibleByText\b[^}]*\}\s*from\s*["']\.\/playwright-settlement["']/);

    for (const query of FORMULATION_PAGE_COPY) {
      expect(source, `${query} must use visibleByText`).toContain(`visibleByText(page, ${query})`);
      expect(source, `${query} must not use bare getByText`).not.toContain(`page.getByText(${query})`);
    }

    expect(source).toContain('visibleByTestId(page, "search-query-ribbon")');
    expect(source).not.toMatch(/getByTestId\(\s*["']search-query-ribbon["']\s*\)/);
  });

  it("keeps absence assertions bare, because a visible filter would hide the duplicate", () => {
    // `visibleByText` narrows to the visible owner. On a `toHaveCount(0)` the
    // narrowing is the bug: a hidden duplicate of copy that must not render at
    // all would pass. Absence is proved against the whole document.
    for (const spec of [FORMULATION, FORMS_SECTION_NAV, ROUTE_COVERAGE]) {
      const offending = readFileSync(spec, "utf8")
        .split("\n")
        .filter((line) => /\bvisibleBy(?:Text|TestId)\(/.test(line) && /toHaveCount\(\s*0\s*\)/.test(line));
      expect(offending, `${spec} must not filter to visible in an absence assertion`).toEqual([]);
    }
  });
});
