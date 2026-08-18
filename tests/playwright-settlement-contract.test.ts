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
});
