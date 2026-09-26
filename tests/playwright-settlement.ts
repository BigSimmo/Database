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

/**
 * Scope a rendered-copy query to the visible DOM owner (#093).
 *
 * The text counterpart of `visibleByTestId`, for pages that assert on copy
 * rather than on a testid. Production UI shard 3 on PR #2651:
 * `/formulation/compare` resolved its comparison lede to 2 elements — the live
 * one under `mobile-composer-reserve-pad` and a hidden streaming twin beside
 * it — and a bare `getByText` failed strict mode.
 *
 * Only for `toBeVisible` assertions. A `toHaveCount(0)` assertion must stay
 * bare: filtering to visible there would let a hidden duplicate of copy that
 * should not exist at all pass unnoticed.
 */
export function visibleByText(page: Page, text: string | RegExp, options?: { exact?: boolean }): Locator {
  return page.getByText(text, options).filter({ visible: true });
}

/**
 * Click a control only once scroll-driven chrome has stopped moving it.
 *
 * Above the phone breakpoint the universal header scroll-hides by collapsing its own in-flow
 * row (`grid-template-rows` 1fr -> 0fr in `master-search-header.tsx`), so a scroll moves
 * everything below it by the header's height one render later. Playwright's `click()` scrolls
 * its target into view and dispatches about 10 ms afterwards; on a loaded CI runner the
 * collapse lands between the two, the press goes to whatever slid under the pointer, and the
 * click reports success while nothing happened. Release traces showed exactly that for the
 * tools details panel and the document source-text accordion: alternating click points one
 * header-height apart, "intercepts pointer events" retries, then a final click that missed.
 *
 * Scroll first, wait until the target holds still across frames, then click. The target is
 * already in view, so `click()` scrolls nothing and triggers no second collapse.
 */
export async function clickWhenSettled(locator: Locator, { timeout = 10_000 }: { timeout?: number } = {}) {
  await locator.scrollIntoViewIfNeeded({ timeout });
  let previous = "";
  await expect
    .poll(
      async () => {
        await locator
          .page()
          .evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50))),
              ),
          );
        const box = await locator.boundingBox();
        const current = box ? `${Math.round(box.x)},${Math.round(box.y)}` : "";
        const settled = current !== "" && current === previous;
        previous = current;
        return settled;
      },
      { message: "the control must stop moving before it is clicked", timeout },
    )
    .toBe(true);
  await locator.click({ timeout });
}
