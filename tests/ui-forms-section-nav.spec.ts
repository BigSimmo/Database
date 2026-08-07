import { expect, test } from "playwright/test";

/**
 * `/issues` #256, proven where it actually failed: in the browser.
 *
 * `informationPageSectionDefinitions` claims `/forms/<slug>` before the mode
 * branch in `PageSecondaryNavigation`, then `AvailableInformationPageNavigation`
 * drops every section whose `targetIds` are absent from the DOM and returns
 * `null` when all are dropped. `form-detail-page.tsx` rendered no `id`
 * attributes at all, so the route was claimed and nothing was drawn — silently,
 * with no error and no failing test.
 *
 * The unit-level binding guard in `tests/page-secondary-navigation.dom.test.tsx`
 * matches `id="…"` in the source, which is necessary but not sufficient: it
 * cannot see whether an anchor is inside a branch that never renders, and jsdom
 * applies no Tailwind, so it cannot distinguish a `-mobile` target from its
 * `-desktop` twin. Only a real browser at a real width can.
 */
/**
 * A real catalogue slug, not the `/forms/form-1` placeholder the unit tests
 * use. Those only exercise pure predicates, which match on `/forms/` and never
 * resolve a record; a browser needs a route that actually renders.
 */
const FORM_ROUTE = "/forms/transport-crisis-form";

test.describe("Forms section navigation", () => {
  test("renders On this page against anchors the form record actually paints", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(FORM_ROUTE, { waitUntil: "domcontentloaded" });

    const onThisPage = page.getByRole("navigation", { name: "On this page" });
    await expect(onThisPage).toBeVisible({ timeout: 20_000 });

    // Every declared section resolves. Before the fix this nav did not exist.
    await expect(onThisPage.getByRole("link")).toHaveCount(6);
    await expect(onThisPage.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(onThisPage.getByRole("link", { name: "Legal boundary" })).toBeVisible();
  });

  test("resolves each breakpoint variant to the side that is actually visible", async ({ page }) => {
    // The -mobile/-desktop pairs are the part a source scan cannot check.
    // `AvailableInformationPageNavigation` takes the FIRST VISIBLE target, and
    // `lg:hidden` / `hidden lg:block` make exactly one side display:none per
    // width. If both resolved, or neither, the section would silently drop.
    for (const [label, width] of [
      ["phone", 390],
      ["desktop", 1280],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(FORM_ROUTE, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible({ timeout: 20_000 });

      const visible = await page.evaluate(() =>
        [
          "form-decision-context-mobile",
          "form-decision-context-desktop",
          "form-source-verification-mobile",
          "form-source-verification-desktop",
        ].filter((id) => {
          const el = document.getElementById(id);
          return Boolean(el && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none");
        }),
      );

      // Exactly one of each pair, never both and never neither.
      expect(
        visible.filter((id) => id.startsWith("form-decision-context")),
        `${label} decision context`,
      ).toHaveLength(1);
      expect(
        visible.filter((id) => id.startsWith("form-source-verification")),
        `${label} source/verification`,
      ).toHaveLength(1);
    }
  });
});
