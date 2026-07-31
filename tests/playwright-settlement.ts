import { expect, type Locator, type Page } from "playwright/test";

/**
 * Wait for a hydrating/portalling surface to converge to exactly one visible
 * DOM owner. Hidden or outgoing duplicates are still duplicates: accepting
 * `locator.first()` here would let a stale RSC tree hide a production defect.
 */
export async function expectSingleSettledOwner(
  locator: Locator,
  { message = "expected one settled DOM owner", timeout = 15_000 }: { message?: string; timeout?: number } = {},
) {
  await expect
    .poll(
      async () => {
        const count = await locator.count();
        const visibility = await Promise.all(
          Array.from({ length: count }, (_, index) =>
            locator
              .nth(index)
              .isVisible()
              .catch(() => false),
          ),
        );
        return { count, visibleCount: visibility.filter(Boolean).length };
      },
      { message, timeout },
    )
    .toEqual({ count: 1, visibleCount: 1 });

  return locator.first();
}

/**
 * Scope a testid to the visible DOM owner (#093).
 *
 * Next streaming can leave a hidden duplicate page root in the tree under
 * full-suite load. Bare `page.getByTestId(...)` then trips Playwright strict
 * mode; bare `.first()` can pin the hidden clone. Prefer this helper (or
 * pad-scoping under `mobile-composer-reserve-pad`) for page-root / shell
 * surfaces. Use `expectSingleSettledOwner` when the duplicate must fully
 * disappear rather than merely be ignored while hidden.
 */
export function visibleByTestId(page: Page, testId: string): Locator {
  return page.getByTestId(testId).filter({ visible: true });
}
