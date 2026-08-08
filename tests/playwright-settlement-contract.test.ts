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
  "dsm-home-main",
  "dsm-home-compare",
  "dsm-comparison-page",
  "dsm-differential-considerations-page",
  "search-query-ribbon",
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
});
