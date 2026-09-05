import { expect, test, type Page } from "playwright/test";

import { visibleByTestId } from "./playwright-settlement";

/**
 * The only 320px browser proof for the production `AccessibleTable` in its
 * low-confidence state: the "verify values against the source document" note
 * and the "Not recorded" missing-value phrase must stay fully legible — no
 * ellipsis, no clipping, no page overflow — at the narrowest phone width.
 *
 * Restored from PR #2006 (54585e98d). It closed /issues #237 inside
 * tests/ui-tools.spec.ts, and a merge commit one day later dropped it while no
 * non-merge commit ever did (audit M31); it lives in its own file now so the
 * project routing below can be pinned by name in
 * tests/playwright-pr-shards.test.ts. `@mockup` keeps it in the advisory
 * chromium-mockups project, because it navigates a /mockups fixture route.
 */

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

test("low-confidence AccessibleTable keeps its full missing-value phrase readable at 320px @mockup", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/mockups/accessible-table-browser-fixture", { waitUntil: "domcontentloaded" });

  const fixture = visibleByTestId(page, "accessible-table-browser-fixture");
  await expect(fixture).toBeVisible({ timeout: 15_000 });
  await expect(fixture.getByTestId("table-low-confidence-note")).toContainText(
    "verify values against the source document",
  );

  const table = fixture.getByRole("table", { name: "Clozapine ANC response" });
  await expect(table).toBeVisible();
  const missingValues = table.getByTestId("missing-value");
  await expect(missingValues).toHaveCount(2);
  await expect(missingValues.first()).toHaveText("Not recorded");

  const layout = await missingValues.first().evaluate((value) => {
    const wrapper = value.parentElement;
    if (!wrapper) throw new Error("Missing-value wrapper was not rendered");
    const valueRect = value.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const style = getComputedStyle(wrapper);
    return {
      valueLeft: valueRect.left,
      valueRight: valueRect.right,
      wrapperLeft: wrapperRect.left,
      wrapperRight: wrapperRect.right,
      wrapperClientWidth: wrapper.clientWidth,
      wrapperScrollWidth: wrapper.scrollWidth,
      whiteSpace: style.whiteSpace,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
    };
  });

  expect(layout.whiteSpace).toBe("normal");
  expect(layout.textOverflow).not.toBe("ellipsis");
  expect(layout.wrapperScrollWidth - layout.wrapperClientWidth).toBeLessThanOrEqual(1);
  expect(layout.valueLeft).toBeGreaterThanOrEqual(layout.wrapperLeft - 1);
  expect(layout.valueRight).toBeLessThanOrEqual(layout.wrapperRight + 1);
  await expectNoPageHorizontalOverflow(page);

  const screenshotPath = testInfo.outputPath("low-confidence-accessible-table-320px.png");
  await fixture.screenshot({ path: screenshotPath });
  await testInfo.attach("low-confidence-accessible-table-320px", {
    path: screenshotPath,
    contentType: "image/png",
  });
});
