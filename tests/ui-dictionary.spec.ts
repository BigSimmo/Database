import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "playwright/test";

/*
 * `/dictionary` is deliberately absent: it has no home of its own any more. The
 * bare path redirects to the shared lightweight home at `/?mode=dictionary`,
 * which is covered by the shared-home suites rather than here.
 */
const routes = [
  { path: "/dictionary/search?q=MSE", testId: "dictionary-catalogue-main" },
  // The same route with no query: one catalogue, two states.
  { path: "/dictionary/search", testId: "dictionary-catalogue-main" },
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

/**
 * Click a control whose handler only exists after React attaches.
 *
 * Every control here paints server-side, so a click issued the moment the
 * element is visible can land before hydration and be swallowed with no error —
 * the sheet simply never opens. Retrying until the expected surface appears is
 * honest about that race; a fixed `waitForTimeout` only moves it.
 */
async function clickUntil(trigger: Locator, settled: Locator) {
  await expect(async () => {
    await trigger.click();
    await expect(settled).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
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
  await gotoDictionary(page, "/dictionary/search?q=MSE", "dictionary-catalogue-main");

  const trigger = page.getByTestId("dictionary-filter-trigger-phone");
  await expect(trigger).toBeVisible();
  await expect(trigger.getByText("Filter", { exact: true })).toBeVisible();
  expect((await trigger.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);

  const sheet = page.getByTestId("dictionary-filter-sheet");
  await clickUntil(trigger, sheet);
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

/**
 * The merged catalogue's phone header.
 *
 * Dictionary had two destinations over one catalogue — `/dictionary/search` and
 * `/dictionary/browse` listed the same entries as the same rows from the same
 * data — and the Browse control row was `layout="equal"` and `w-full` below
 * `sm`, so a scope holding 11 of 107 entries took half the phone width. This
 * pins the shape that replaced it, measured rather than asserted by class name.
 */
test("merges search and browse into one catalogue with a measured phone header", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // `/dictionary/browse` must not 404; it forwards, query string intact.
  await page.goto("/dictionary/browse?view=abbreviations", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("dictionary-catalogue-main").filter({ visible: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page).toHaveURL(/\/dictionary\/search\?view=abbreviations/);

  await gotoDictionary(page, "/dictionary/search", "dictionary-catalogue-main");
  // The phone chrome stack is position:fixed and mounts collapsed, so every
  // offset below it is wrong until it settles (#XPY409, docs/testing.md).
  await page.waitForTimeout(1200);

  // Browsing: no summary line, and the joined two-cell toggle sized to its own
  // labels rather than stretching to the viewport. Compact in type and height;
  // counts use an explicit accessible name so it is "Abbreviations (N)" rather
  // than a jammed "AbbreviationsN".
  const toggle = page.getByTestId("dictionary-scope-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle.getByRole("button", { name: /Abbreviations \(\d+\)/ })).toBeVisible();
  await expect(toggle.getByRole("button", { name: /Terms \(\d+\)/ })).toBeVisible();
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(24);
  expect(toggleBox?.height ?? 0).toBeLessThanOrEqual(36);
  // Intrinsic, not full-bleed — the joined cells must not consume the Filter slot.
  expect(toggleBox?.width ?? 0).toBeLessThan(300);
  expect(toggleBox?.width ?? 0).toBeGreaterThan(140);
  await expect(page.getByTestId("dictionary-letter-chip")).toBeVisible();
  const filter = page.getByTestId("dictionary-filter-trigger-phone");
  await expect(filter.getByText("Filter", { exact: true })).toBeVisible();
  await expect(page.getByTestId("search-query-ribbon")).toHaveCount(0);
  // Filter stays on this row, to the right of the toggle. The compact toggle
  // plus the letter chip may wrap Filter at 390px; that is preferred to
  // clipping a count. Same top edge is required when they do fit.
  const browseRow = await page.evaluate(() => {
    const box = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect() ?? null;
    const toggle = box("dictionary-scope-toggle");
    const letter = box("dictionary-letter-chip");
    const filter = box("dictionary-filter-trigger-phone");
    const sameRow = Boolean(
      toggle &&
      filter &&
      filter.top < toggle.bottom - 4 &&
      filter.bottom > toggle.top + 4 &&
      filter.left >= toggle.right - 2,
    );
    return {
      toggleTop: toggle?.top ?? -1,
      letterTop: letter?.top ?? -1,
      filterTop: filter?.top ?? -1,
      filterBottomPastToggle: (filter?.top ?? 0) >= (toggle?.bottom ?? 9999) - 2,
      sameRow,
      overflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
    };
  });
  expect(browseRow.toggleTop).toBeGreaterThan(0);
  expect(browseRow.letterTop).toBeGreaterThan(0);
  expect(browseRow.filterTop).toBeGreaterThan(0);
  expect(browseRow.overflow).toBeLessThanOrEqual(2);
  expect(browseRow.sameRow || browseRow.filterBottomPastToggle).toBe(true);

  // At 320px the same controls may wrap; the contract is that they do not clip
  // a count out of view, whether they stay on one line or wrap.
  await page.setViewportSize({ width: 320, height: 760 });
  await page.waitForTimeout(400);
  const narrowRow = await page.evaluate(() => {
    const box = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect() ?? null;
    return {
      toggleWidth: box("dictionary-scope-toggle")?.width ?? 0,
      overflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
    };
  });
  expect(narrowRow.toggleWidth).toBeGreaterThan(140);
  expect(narrowRow.overflow).toBeLessThanOrEqual(2);
  await page.setViewportSize({ width: 390, height: 844 });

  // Searching: the query gets a line of its own, the alphabet stands down, and
  // Filter stays on the Terms / Abbreviations row rather than joining the ribbon.
  await gotoDictionary(page, "/dictionary/search?q=tardive+dyskinesia", "dictionary-catalogue-main");
  await page.waitForTimeout(1200);
  const ribbon = page.getByTestId("search-query-ribbon");
  await expect(ribbon).toBeVisible();
  await expect(ribbon.getByTestId("dictionary-clear-query")).toBeVisible();
  await expect(ribbon.getByTestId("dictionary-filter-trigger-phone")).toHaveCount(0);
  await expect(filter.getByText("Filter", { exact: true })).toBeVisible();
  await expect(page.getByTestId("dictionary-letter-chip")).toHaveCount(0);

  const resultControls = await page.evaluate(() => {
    const box = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect() ?? null;
    const toggle = box("dictionary-scope-toggle");
    const filter = box("dictionary-filter-trigger-phone");
    const toggleMid = toggle ? (toggle.top + toggle.bottom) / 2 : -1;
    const filterMid = filter ? (filter.top + filter.bottom) / 2 : -1;
    return {
      sameRow: Boolean(
        toggle &&
        filter &&
        filter.top < toggle.bottom - 4 &&
        filter.bottom > toggle.top + 4 &&
        filter.left >= toggle.right - 2,
      ),
      centersAligned: Math.abs(filterMid - toggleMid) <= 4,
    };
  });
  expect(resultControls.sameRow).toBe(true);
  expect(resultControls.centersAligned).toBe(true);

  // Its own line: the band sits entirely above the control row.
  const geometry = await page.evaluate(() => {
    const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const subject = document.querySelector<HTMLElement>('[data-testid="search-query-ribbon"] .search-band-subject');
    return {
      ribbonBottom: box('[data-testid="search-query-ribbon"]')?.bottom ?? -1,
      toggleTop: box('[data-testid="dictionary-scope-toggle"]')?.top ?? -1,
      subjectText: subject?.textContent ?? "",
      // Truncation is `scrollWidth > clientWidth`, not a guess from the string.
      subjectClipped: subject ? subject.scrollWidth - subject.clientWidth > 1 : true,
    };
  });
  expect(geometry.ribbonBottom).toBeGreaterThan(0);
  expect(geometry.toggleTop).toBeGreaterThanOrEqual(geometry.ribbonBottom);
  // The whole two-word term, not "tardive dyski…".
  expect(geometry.subjectText).toBe("tardive dyskinesia");
  expect(geometry.subjectClipped).toBe(false);

  // Singular at one, and the noun names the scope the reader chose rather than
  // the mode's generic "dictionary results".
  await gotoDictionary(page, "/dictionary/search?q=MMSE&view=abbreviations", "dictionary-catalogue-main");
  await expect(ribbon.getByRole("status")).toHaveText(/^1 abbreviation$/);

  // Clearing returns the whole catalogue.
  await clickUntil(page.getByTestId("dictionary-clear-query"), page.getByTestId("dictionary-letter-chip"));
  await expect(page).not.toHaveURL(/[?&]q=/);
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
