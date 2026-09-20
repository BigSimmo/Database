import { expect, test, type Page, type TestInfo } from "playwright/test";

const documentPath =
  "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442";
async function attachViewportScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  viewport: { width: number; height: number },
  path: string,
) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("body")).toBeVisible();

  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

test.describe("PsychSift visual QA artifacts", () => {
  test("captures dashboard and document viewer screenshots", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await attachViewportScreenshot(page, testInfo, "dashboard-mobile", { width: 390, height: 820 }, "/");
    await attachViewportScreenshot(page, testInfo, "dashboard-desktop", { width: 1280, height: 900 }, "/");
    await attachViewportScreenshot(page, testInfo, "document-mobile", { width: 390, height: 820 }, documentPath);
    await attachViewportScreenshot(page, testInfo, "document-desktop", { width: 1280, height: 900 }, documentPath);
  });

  /**
   * The human-review channel while the CME screens are still moving: nothing
   * here fails when a surface changes, it just attaches a screenshot for the
   * owner to look at each round. The clock is frozen for the same reason
   * `tests/ui-cme-phone.spec.ts` freezes it — the dashboard's "days left" and
   * pace projection move every night, and an unfrozen capture would not be
   * the same screen twice in a row.
   */
  test("captures the CME screens", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.clock.install({ time: new Date("2026-09-19T02:00:00Z") });
    await page.clock.pauseAt(new Date("2026-09-19T02:00:00Z"));
    for (const [name, path] of [
      ["cme-dashboard-mobile", "/cme"],
      ["cme-log-mobile", "/cme/log"],
      ["cme-new-entry-mobile", "/cme/new"],
      ["cme-programme-mobile", "/cme/programme"],
    ] as const) {
      await attachViewportScreenshot(page, testInfo, name, { width: 390, height: 820 }, path);
    }
  });
});
