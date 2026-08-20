import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "playwright/test";

/*
 * `/dictionary` is deliberately absent: it has no home of its own any more. The
 * bare path redirects to the shared lightweight home at `/?mode=dictionary`,
 * which is covered by the shared-home suites rather than here. The retired
 * detailed home lives at `/mockups/dictionary-home-detailed`, which 404s in
 * production and is out of scope for a production-route sweep.
 */
const routes = [
  { path: "/dictionary/search?q=MSE", testId: "dictionary-search-main" },
  { path: "/dictionary/browse", testId: "dictionary-browse-main" },
  { path: "/dictionary/topics", testId: "dictionary-topics-main" },
  {
    path: "/dictionary/topics/assessment-and-measurement",
    testId: "dictionary-topic-detail-main",
  },
  { path: "/dictionary/auditory-hallucination", testId: "dictionary-term-main" },
  {
    path: "/dictionary/compare?a=mental-state-examination&b=mini-mental-state-examination",
    testId: "dictionary-compare-main",
  },
  { path: "/dictionary/sources", testId: "dictionary-sources-main" },
] as const;

async function blockExternalRequests(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
}

async function gotoDictionary(page: Page, path: string, testId: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(testId).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectDictionaryRoute(page: Page, route: (typeof routes)[number]) {
  await gotoDictionary(page, route.path, route.testId);
  await expect(page.locator("#main-content h1")).toHaveCount(1);
  await expect(page.locator("#main-content table")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
}

async function expectNoBlockingAxeViolations(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  await testInfo.attach("dictionary-axe-violations", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });
  const blocking = results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => `${violation.id}: ${violation.help}`);
  expect(blocking, "axe found critical or serious Dictionary violations").toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
  { name: "compact phone", width: 320, height: 760 },
] as const) {
  test(`renders every Dictionary route without overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) await expectDictionaryRoute(page, route);
  });
}

test("keeps mixed result filters truthful, URL-owned, and phone-operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoDictionary(page, "/dictionary/search?q=MSE", "dictionary-search-main");

  const trigger = page.getByTestId("dictionary-filter-trigger-phone");
  await expect(trigger).toBeVisible();
  expect((await trigger.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  await trigger.click();

  const sheet = page.getByTestId("dictionary-filter-sheet");
  await expect(sheet).toBeVisible();
  await sheet.getByTestId("dictionary-filter-sheet-find").fill("Assessment and measurement");
  await sheet.getByRole("button", { name: /^Assessment and measurement/ }).click();
  await expect(page).toHaveURL(/topic=assessment-and-measurement/);
  await sheet.getByTestId("dictionary-filter-sheet-done").click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: "Remove Topic: Assessment and measurement filter" })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/topic=assessment-and-measurement/);
  await expectNoHorizontalOverflow(page);
});

test("uses a readable phone definition and stacked comparison sections", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await gotoDictionary(page, "/dictionary/auditory-hallucination", "dictionary-term-main");

  const status = page.getByTestId("dictionary-source-status-summary");
  await expect(status).toBeVisible();
  await expect(status).toContainText("Source linked");
  await expect(page.getByRole("complementary", { name: "Entry details" })).toBeHidden();
  const disclosures = page
    .locator(
      "#dictionary-meaning, #dictionary-context, #dictionary-distinctions, #dictionary-sources, #dictionary-related",
    )
    .getByRole("button");
  await expect(disclosures).toHaveCount(5);
  for (const button of await disclosures.all()) {
    expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
  await expect(page.locator("#dictionary-meaning-content")).toBeVisible();
  await expect(page.locator("#dictionary-context-content")).toBeHidden();

  await gotoDictionary(
    page,
    "/dictionary/compare?a=mental-state-examination&b=mini-mental-state-examination",
    "dictionary-compare-main",
  );
  const meaning = page.getByRole("group", { name: "Meaning" });
  await expect(meaning).toHaveCount(0);
  const phoneSection = page.locator("details.source-print").first();
  await expect(phoneSection).toBeVisible();
  const paired = phoneSection.locator("p");
  await expect(paired).toHaveCount(2);
  const boxes = await paired.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
  expect(boxes[1]).toBeGreaterThan(boxes[0]);
  await expectNoHorizontalOverflow(page);
});

test("preserves contrast modes, reduced motion, axe, and print content", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await gotoDictionary(page, "/dictionary/auditory-hallucination", "dictionary-term-main");
  await expectNoBlockingAxeViolations(page, testInfo);

  await page.emulateMedia({ colorScheme: "light", forcedColors: "active", reducedMotion: "reduce" });
  await expect(page.getByTestId("dictionary-source-status-summary")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.emulateMedia({ media: "print", forcedColors: "none" });
  await expect(page.locator("#dictionary-context-content")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print entry" })).toBeHidden();

  await page.emulateMedia({ media: "screen", colorScheme: "light" });
  await gotoDictionary(
    page,
    "/dictionary/compare?a=mental-state-examination&b=mini-mental-state-examination",
    "dictionary-compare-main",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("A · MSE", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("B · MMSE", { exact: true }).first()).toBeVisible();
});
