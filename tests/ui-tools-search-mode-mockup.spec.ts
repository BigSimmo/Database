import { expect, test, type Page } from "playwright/test";

const mockupPath = "/mockups/tools-search-mode?mode=tools&q=Compare";

async function gotoMockup(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto(mockupPath, { waitUntil: "domcontentloaded" });
  const mockup = page.locator('[data-testid="tools-search-mode-mockup"]:visible');
  await expect(mockup).toBeVisible();
  await expect(page.locator('[data-testid="global-search-input"]:visible')).toHaveValue("Compare");
  return mockup;
}

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(Math.max(geometry.body, geometry.document)).toBeLessThanOrEqual(geometry.viewport + 1);
}

test.describe("Perfected Tools results mode mockup @mockup", () => {
  test("desktop uses universal search and keeps results beside the selected-tool panel", async ({ page }) => {
    const mockup = await gotoMockup(page, 1440);

    await expect(mockup.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
    await expect(mockup.getByText("2 tools", { exact: true })).toBeVisible();
    await expect(mockup.getByRole("heading", { level: 2, name: "Differentials" }).first()).toBeVisible();
    const selectedResult = mockup.getByRole("article").filter({ hasText: "Differentials" });
    await expect(selectedResult).toHaveAttribute("data-selected", "true");
    await expect(selectedResult.getByText("Source-backed")).toBeVisible();
    await expect(selectedResult.getByText("High yield")).toBeVisible();
    await expect(selectedResult.getByText("Broad or complex presentations")).toBeVisible();
    await expect(mockup.locator("aside").getByRole("heading", { name: "Best for" })).toBeVisible();
    await expect(mockup.locator("aside").getByText("Selected tool")).toBeVisible();
    await expect(mockup.getByTestId("tools-search-mode-hero")).toHaveCount(0);
    await expect(mockup.getByTestId("universal-also-matches")).toBeVisible();
    await expect(mockup.getByText("Dose converter")).toHaveCount(0);

    const categoryRail = mockup.getByRole("radiogroup", { name: "Tool category" });
    const allToolsFilter = categoryRail.getByRole("radio", { name: "All tools (2)" });
    await allToolsFilter.focus();
    await page.keyboard.press("ArrowRight");
    await expect(categoryRail.getByRole("radio", { name: "Assess (1)" })).toHaveAttribute("aria-checked", "true");
    await expect(categoryRail.getByRole("radio", { name: "Treat (0)" })).toBeDisabled();

    const searchInput = page.locator('[data-testid="global-search-input"]:visible');
    await searchInput.fill("Safety");
    await expect(mockup.getByRole("heading", { level: 1, name: "Safety" })).toBeVisible();
    // Filling the universal composer opens its suggestions over the category
    // rail. Dismiss that owned surface and wait for its explicit state change
    // before asking Playwright to click a control behind it.
    await searchInput.press("Escape");
    await expect(searchInput).toHaveValue("Safety");
    await expect(searchInput).toHaveAttribute("aria-expanded", "false");
    const treatmentFilter = categoryRail.getByRole("radio", { name: "Treat (2)" });
    await treatmentFilter.click();
    await expect(treatmentFilter).toHaveAttribute("aria-checked", "true");
    await page.locator('[data-testid="global-search-input"]:visible').fill("Compare");
    await expect(mockup.getByText("0 tools", { exact: true })).toBeVisible();
    await expect(mockup.getByRole("heading", { name: "No tools match" })).toBeVisible();
    await expect(mockup.locator("aside")).toHaveCount(0);
    await allToolsFilter.click();
    await expect(mockup.getByRole("heading", { level: 2, name: "Differentials" }).first()).toBeVisible();
    await expect(mockup.locator("aside").getByRole("heading", { name: "Differentials" })).toBeVisible();

    const output = mockup.locator("aside").getByRole("button", { name: "Output" });
    await output.click();
    await expect(output).toHaveAttribute("aria-expanded", "true");
    await expect(mockup.locator("#desktop-tool-detail-output")).toContainText("Ranked differentials");

    await page.locator('[data-testid="global-search-input"]:visible').fill("Safety");
    await expect(mockup.getByRole("heading", { level: 1, name: "Safety" })).toBeVisible();
    await expect(mockup.locator("aside").getByRole("heading", { name: "Risk & Safety" })).toBeVisible();

    await page.locator('[data-testid="global-search-input"]:visible').fill("");
    await expect(mockup.getByRole("heading", { level: 1, name: "All tools" })).toBeVisible();
    const renderedResultCount = await mockup.getByRole("article").count();
    expect(renderedResultCount).toBeGreaterThan(4);
    await expect(mockup.getByText(`${renderedResultCount} tools`, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("does not let persisted mockup utilities override live-route inline themes", async ({ page }) => {
    await gotoMockup(page, 1440);

    await page.goto("/reference/colour-coding", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/reference\/colour-coding$/);
    await expect(page.getByRole("heading", { level: 1, name: "Colour coding & badges" })).toBeVisible();

    const inlineBorderColor = await page.evaluate(() => {
      const themedCard = document.createElement("div");
      themedCard.className = "border border-[color:var(--border)]";
      themedCard.style.borderTopColor = "rgb(1, 2, 3)";
      document.body.append(themedCard);
      return window.getComputedStyle(themedCard).borderTopColor;
    });
    expect(inlineBorderColor).toBe("rgb(1, 2, 3)");
  });

  test("desktop details use inline semantics and preserve visible programmatic focus", async ({ page }) => {
    const mockup = await gotoMockup(page, 1440);
    const details = mockup.getByRole("button", { name: "View details for Differentials" });

    expect(await details.getAttribute("aria-haspopup")).toBeNull();
    await details.click();

    const panel = mockup.locator("aside");
    await expect(panel).toBeFocused();
    const outline = await panel.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });

  test("matches the exact displayed tool title after normalising punctuation", async ({ page }) => {
    const mockup = await gotoMockup(page, 1440);
    await page.locator('[data-testid="global-search-input"]:visible').fill("Risk & Safety");

    // The claim is that "&" normalises and the exactly-titled tool wins — not that it is
    // the only match. "Risk & Safety" legitimately also matches "Safety plan" and
    // "Differentials" on their own terms, so the "1 tool" this line used to carry was the
    // same rot the count assertion below was already rewritten to avoid: it went red the
    // moment the catalogue grew into it. Assert the ranking instead, which is the claim.
    const results = mockup.locator('section[aria-label="Tool results"] article');
    await expect(results.first().getByRole("heading", { level: 2, name: "Risk & Safety" })).toBeVisible();
  });

  test("renders every result included in the reported count", async ({ page }) => {
    const mockup = await gotoMockup(page, 1440);
    await page.locator('[data-testid="global-search-input"]:visible').fill("");

    // The claim is self-consistency — the headline count matches the rows actually
    // rendered — so it reads the rendered count rather than pinning an absolute.
    // A hard-coded total silently rots the moment the catalogue gains a tool, which
    // is what "Add Ward Flow" (#2140) did to the 14 this line used to carry.
    const results = mockup.locator('section[aria-label="Tool results"] article');
    const rendered = await results.count();
    expect(rendered, "the unfiltered mockup must render at least one tool").toBeGreaterThan(0);
    await expect(mockup.getByText(`${rendered} tools`, { exact: true })).toBeVisible();
  });

  test("phone keeps results visible until Details opens the preferred bottom sheet", async ({ page }) => {
    const mockup = await gotoMockup(page, 390, 844);

    const sheet = page.locator('[data-testid="tools-search-detail-sheet"]:visible');
    await expect(sheet).toHaveCount(0);
    await expect(mockup.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
    await expect(mockup.getByRole("heading", { level: 2, name: "Differentials" })).toBeVisible();

    const details = mockup.getByRole("button", { name: "View details for Differentials" });
    await details.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Differentials" })).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Best for" })).toBeVisible();

    const neededInput = sheet.getByRole("button", { name: "Needed input" });
    await neededInput.click();
    await expect(neededInput).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);

    await details.click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Close Differentials" }).click();
    await expect(details).toBeFocused();
    await expectNoHorizontalOverflow(page);
  });

  test("closes the phone detail sheet when the viewport enters desktop layout", async ({ page }) => {
    const mockup = await gotoMockup(page, 390, 844);
    const sheet = page.locator('[data-testid="tools-search-detail-sheet"]:visible');

    await mockup.getByRole("button", { name: "View details for Differentials" }).click();
    await expect(sheet).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(sheet).toHaveCount(0);
    await expect(mockup.locator("aside")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(sheet).toHaveCount(0);
  });

  test("closes the phone filter sheet when the viewport enters desktop layout", async ({ page }) => {
    const mockup = await gotoMockup(page, 390, 844);
    const trigger = mockup.getByTestId("tools-search-filter-trigger-phone");

    await trigger.click();
    const filterSheet = page.locator('[data-testid="tools-search-filter-sheet"]:visible');
    await expect(filterSheet).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(filterSheet).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(filterSheet).toHaveCount(0);
  });

  test("phone filter sheet follows the shared local-filter behavior", async ({ page }) => {
    const mockup = await gotoMockup(page, 390, 844);
    const trigger = mockup.getByTestId("tools-search-filter-trigger-phone");

    await page.locator('[data-testid="global-search-input"]:visible').fill("Safety");
    await expect(mockup.getByRole("heading", { level: 1, name: "Safety" })).toBeVisible();

    await trigger.click();
    const filterSheet = page.locator('[data-testid="tools-search-filter-sheet"]:visible');
    await expect(filterSheet).toBeVisible();
    await expect(filterSheet.getByText("2 tools", { exact: true })).toBeVisible();
    await expect(filterSheet.getByRole("radio", { name: /Evidence/ })).toHaveAttribute("aria-disabled", "true");

    const treatment = filterSheet.getByRole("radio", { name: /Treat/ });
    await treatment.click();
    await expect(treatment).toHaveAttribute("aria-checked", "true");
    await expect(filterSheet).toBeVisible();
    await expect(filterSheet.getByText("2 tools", { exact: true })).toBeVisible();
    await filterSheet.getByTestId("tools-search-filter-sheet-done").click();
    await expect(filterSheet).toHaveCount(0);
    await expect(trigger).toContainText("1");

    await trigger.click();
    await filterSheet.getByRole("button", { name: "Clear filters" }).click();
    await expect(filterSheet).toBeVisible();
    await expect(filterSheet.getByRole("radio", { name: /All tools/ })).toHaveAttribute("aria-checked", "true");
    await expect(filterSheet.getByText("2 tools", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("keeps its shared controls and tool sheet legible in forced colors with reduced motion", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    const mockup = await gotoMockup(page, 390, 844);

    await mockup.getByRole("button", { name: "View details for Differentials" }).click();
    const sheet = page.locator('[data-testid="tools-search-detail-sheet"]:visible');
    await expect(sheet.getByText("Source-backed")).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Compare Differentials" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  for (const width of [320, 390, 639, 768, 1440, 1920]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await gotoMockup(page, width, 900);
      await expectNoHorizontalOverflow(page);
    });
  }
});
