import { expect, test, type Page } from "playwright/test";

// Dedicated coverage for the additive "Concept 4 — Task directory" hybrid route.
// Kept in its own file so it doesn't collide with the shared tests/ui-tools.spec.ts.

const PATH = "/mockups/tools-task-directory";

async function goto(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("Tools task directory mockup (Concept 4)", () => {
  test.describe.configure({ timeout: 60_000 });

  test("renders task-grouped rows and is reachable", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto(page, PATH);

    await expect(page.getByRole("heading", { level: 1, name: "Task directory" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assess" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coordinate" })).toBeVisible();
    await expect(page.getByTestId("tools-visible-count")).toContainText("Showing 7 of 7 tools");
    await expectNoHorizontalOverflow(page);
  });

  test("search narrows the list, shows an empty state, and clears", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto(page, PATH);

    const search = page.getByTestId("tools-search-input");
    await search.fill("medication");
    await expect(page.getByLabel("Open Medication Prescribing")).toBeVisible();
    await expect(page.getByLabel("Open Documents")).toHaveCount(0);
    await expect(page.getByTestId("tools-visible-count")).toContainText("Showing 1 of 7 tools");

    await search.fill("zzzzznotarealtool");
    await expect(page.getByTestId("tools-empty-state")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(search).toHaveValue("");
    await expect(page.getByLabel("Open Documents").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("clinical/admin chips filter by derived category", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto(page, PATH);

    // Clinical = reference/assessment/care (4), Admin = coordination/personal (3).
    await expect(page.getByRole("button", { name: /Clinical/ })).toContainText("4");
    await expect(page.getByRole("button", { name: /Admin/ })).toContainText("3");

    await page.getByRole("button", { name: /Admin/ }).click();
    await expect(page.getByTestId("tools-visible-count")).toContainText("Showing 3 of 7 tools");
    await expect(page.getByLabel("Open Services").first()).toBeVisible();
    await expect(page.getByLabel("Open Differentials")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("never overflows horizontally across sizes", async ({ page }) => {
    await goto(page, PATH);
    for (const width of [320, 375, 768, 1280, 1536]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      await expectNoHorizontalOverflow(page);
    }
  });
});
