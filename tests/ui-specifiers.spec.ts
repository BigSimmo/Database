import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "playwright/test";

const axeWcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const axeBlockingImpacts = new Set(["critical", "serious"]);

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

async function gotoApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Deterministic app-shell mount wait (networkidle burned the full timeout on
  // routes with persistent background fetches; per-test assertions gate readiness).
  await page
    .locator("#main-content")
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => undefined);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectNoBlockingAxeViolations(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(axeWcagTags).analyze();
  await testInfo.attach("axe-violations", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });

  const blocking = results.violations
    .filter((violation) => axeBlockingImpacts.has(violation.impact ?? ""))
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
          .map((node) => `${node.target.join(" ")}: ${node.failureSummary ?? "no failure summary"}`)
          .join(" | ")}; see ${violation.helpUrl}`,
    );
  expect(blocking, "axe found critical/serious WCAG A/AA violations").toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test("searches clinical language without provenance fields and carries a result into wording", async ({
  page,
}, testInfo) => {
  await gotoApp(page, "/specifiers");

  await expect(page.getByRole("heading", { name: "Specifiers", exact: true })).toBeVisible();
  await expect(page.getByTestId("specifiers-home")).toBeVisible();

  const search = page.getByTestId("global-search-input").filter({ visible: true }).first();
  await expect(search).toHaveAccessibleName(
    /Search indexed guidelines by question or keyword - Search psychiatric specifiers by presentation or diagnosis/,
  );
  await search.fill("depressed but racing thoughts");
  await page.getByRole("button", { name: "Find matching psychiatric specifiers" }).click();

  await expect(page).toHaveURL(/\/specifiers\?.*q=depressed(?:\+|%20)but(?:\+|%20)racing(?:\+|%20)thoughts.*run=1/);
  const queryRibbon = page.getByTestId("search-query-ribbon");
  await expect(queryRibbon.getByRole("heading", { level: 1, name: "depressed but racing thoughts" })).toBeVisible();
  await expect(queryRibbon.getByRole("group", { name: "Filter specifier results" })).toBeVisible();
  await expect(page.getByText(/Results ranked by text relevance/i)).toHaveCount(0);
  await expect(page.getByText("Top match", { exact: true })).toBeVisible();
  // A lens, so the rail is a radiogroup rather than a toggle group — the sheet
  // already said one-of-N and the desktop rail now agrees with it.
  await expect(page.getByRole("radiogroup", { name: "Filter by specifier family" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filter by diagnosis" })).toBeVisible();
  await expect(page.getByText("Best fit", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/clinical fit/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open With mixed features" })).toBeVisible();
  await expect(page.getByText("Source status", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Source", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Open With mixed features" }).click();
  await expect(page).toHaveURL(/\/specifiers\/with-mixed-features$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "With mixed features", exact: true })).toBeVisible();
  // Address the record label by id. The in-page section sheet's labels do not
  // currently include these words, but the formulation sibling failed CI under
  // Playwright strict mode once a nav control shared the same text — pin the
  // unique target rather than relying on that coincidence.
  await expect(page.locator("#what-matters-now")).toBeVisible();

  await page.getByRole("link", { name: "Use in builder", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Build a clear diagnosis" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Specifier builder steps" })).toBeVisible();
  await expect(page.getByTestId("specifier-builder-episode-features")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Mixed features/ })).toBeChecked();
  await expect(page.getByTestId("specifier-working-wording")).toContainText(/with mixed features/i);
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAxeViolations(page, testInfo);
});

test("keeps mobile search, filters, results, and the fixed composer usable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/specifiers?q=returns+every+winter&run=1");

  const queryRibbon = page.getByTestId("search-query-ribbon");
  await expect(queryRibbon.getByRole("heading", { level: 1, name: "returns every winter" })).toBeVisible();
  await expect(queryRibbon.getByRole("group", { name: "Filter specifier results" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open With seasonal pattern" })).toBeVisible();
  // Both dimensions used to be side-by-side selects in the ribbon; they are now
  // one compact trigger opening a sheet that holds both groups.
  const filterTrigger = queryRibbon.getByTestId("specifier-filter-trigger-phone");
  await expect(filterTrigger).toBeVisible();
  await expect(filterTrigger).toHaveAccessibleName(/No filters active/);
  await expect(page.getByTestId("global-search-input").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Source status", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Source", { exact: true })).toHaveCount(0);

  await filterTrigger.click();
  const familyGroup = page.getByRole("radiogroup", { name: "Family" });
  const diagnosisGroup = page.getByRole("radiogroup", { name: "Diagnosis" });
  await familyGroup.getByRole("radio", { name: "Course" }).click();
  await expect(familyGroup.getByRole("radio", { name: "Course" })).toBeChecked();
  await diagnosisGroup.getByRole("radio", { name: "Depressive" }).click();
  await expect(diagnosisGroup.getByRole("radio", { name: "Depressive" })).toBeChecked();
  await page.getByTestId("specifier-filter-panel-done").click();

  // Two dimensions applied, counted independently on the badge.
  await expect(filterTrigger).toHaveAccessibleName(/2 filters active/);
  await expect(page.getByRole("link", { name: "Open With seasonal pattern" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Open With seasonal pattern" }).click();
  await expect(page.getByRole("heading", { name: "With seasonal pattern", exact: true })).toBeVisible();
  // The record's actions moved into the in-page header's ellipsis sheet.
  await page.getByTestId("specifier-actions-trigger").click();
  const recordActions = page.getByTestId("specifier-actions-sheet");
  await expect(recordActions.getByRole("link", { name: "Compare", exact: true })).toBeVisible();
  await expect(recordActions.getByRole("link", { name: "Build wording", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(recordActions).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAxeViolations(page, testInfo);
});

test("keeps the base diagnosis severity-neutral when applying a severity descriptor", async ({ page }) => {
  await gotoApp(page, "/specifiers/builder?specifier=mild-severity");

  await expect(page.getByTestId("specifier-builder-severity-remission")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Mild/ })).toBeChecked();
  await expect(page.getByTestId("specifier-working-wording")).toHaveText("Major depressive disorder, recurrent, mild");
  await expect(page.getByText(/severe, mild|moderate, mild/i)).toHaveCount(0);

  await page.getByRole("button", { name: /Step 2 of 4: Episode features/ }).click();
  const anxiousDistress = page.getByRole("checkbox", { name: /Anxious distress/ });
  await page.getByText("Anxious distress", { exact: true }).click();
  await expect(anxiousDistress).toBeChecked();
  await expect(page.getByTestId("specifier-working-wording")).toHaveText(
    "Major depressive disorder, recurrent, with anxious distress, mild",
  );
});

test("keeps the guided builder readable without horizontal overflow on phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/specifiers/builder?specifier=mild-severity");

  const steps = page.getByRole("list", { name: "Specifier builder steps" });
  await expect(steps).toBeVisible();
  await expect(steps.getByRole("button", { name: /Step 1 of 4: Base diagnosis/ })).toBeVisible();
  await expect(steps.getByRole("button", { name: /Step 2 of 4: Episode features/ })).toBeVisible();
  await expect(steps.getByRole("button", { name: /Step 3 of 4: Course and onset/ })).toBeVisible();
  await expect(steps.getByRole("button", { name: /Step 4 of 4: Severity or remission/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.getByRole("heading", { name: "Build a clear diagnosis" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Mild/ })).toBeChecked();
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAxeViolations(page, testInfo);
});

test("guides choices into a reviewable and copyable diagnosis", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => window.sessionStorage.setItem("specifier-builder-copied-text", value),
      },
    });
  });
  await gotoApp(page, "/specifiers/builder");

  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
  const previous = page.getByRole("button", { name: "Previous", exact: true });
  await expect(previous).toBeDisabled();

  await page.getByRole("button", { name: "Continue to features" }).click();
  await expect(page.getByRole("heading", { name: "Add episode features" })).toBeFocused();
  await page.getByText("Mixed features", { exact: true }).click();
  await page.getByRole("button", { name: "Continue to course" }).click();
  await page.getByRole("button", { name: "Continue to severity" }).click();

  await page.getByText("Mild", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /Mild/ })).toBeChecked();
  await page.getByText("Partial remission", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /Partial remission/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Mild/ })).not.toBeChecked();

  await page.getByRole("button", { name: "Review wording" }).click();
  const review = page.getByTestId("specifier-builder-review");
  await expect(review.getByRole("heading", { name: "Review the wording" })).toBeVisible();
  await expect(review.getByRole("heading", { name: "Review the wording" })).toBeFocused();
  await expect(review.getByTestId("specifier-completed-wording")).toHaveText(
    "Major depressive disorder, recurrent, with mixed features, in partial remission",
  );

  await review.getByRole("button", { name: "Copy wording" }).click();
  await expect(review.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect(review.getByRole("status")).toHaveText("Wording copied to the clipboard.");
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem("specifier-builder-copied-text")))
    .toBe("Major depressive disorder, recurrent, with mixed features, in partial remission");

  await review.getByRole("button", { name: "Edit Episode features" }).click();
  await expect(page.getByRole("checkbox", { name: /Mixed features/ })).toBeChecked();
  await page.getByRole("button", { name: /Step 4 of 4: Severity or remission/ }).click();
  await page.getByRole("button", { name: "Review wording" }).click();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("specifier-builder-base")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Diagnostic phrase" })).toHaveValue("mdd-recurrent");
  await expect(page.getByTestId("specifier-working-wording")).toHaveText("Major depressive disorder, recurrent");
  await expectNoBlockingAxeViolations(page, testInfo);
});

test("fits the guided builder across its responsive breakpoints", async ({ page }) => {
  for (const width of [320, 639, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await gotoApp(page, "/specifiers/builder");
    await expect(page.getByRole("list", { name: "Specifier builder steps" })).toBeVisible();
    await expect(page.getByTestId("specifier-builder-base")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("keeps the guide usable with reduced motion and forced colors", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await gotoApp(page, "/specifiers/builder");

  await expect
    .poll(() => page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches))
    .toBe(true);
  await expect.poll(() => page.evaluate(() => window.matchMedia("(forced-colors: active)").matches)).toBe(true);
  await page.getByRole("button", { name: "Continue to features" }).click();
  await expect(page.getByRole("heading", { name: "Add episode features" })).toBeFocused();
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAxeViolations(page, testInfo);
});

test("blocks incompatible specifiers and preserves severe psychotic-features wording", async ({ page }) => {
  // Psychotic features applies to MDD, so the deep link stays on the recurrent-MDD base.
  // Rapid cycling is bipolar-only, so it must remain blocked until a bipolar base is chosen.
  await gotoApp(page, "/specifiers/builder?specifier=with-psychotic-features");

  await page.getByRole("button", { name: /Step 3 of 4: Course and onset/ }).click();
  const rapidCycling = page.getByRole("checkbox", { name: /Rapid cycling/ });
  await expect(rapidCycling).toBeDisabled();
  await expect(rapidCycling).not.toBeChecked();
  await expect(page.getByTestId("specifier-working-wording")).toHaveText(
    "Major depressive disorder, recurrent, severe with psychotic features",
  );

  await page.getByRole("button", { name: /Step 1 of 4: Base diagnosis/ }).click();
  await page.getByRole("combobox", { name: "Diagnostic phrase" }).selectOption("bipolar-i-manic");
  await page.getByRole("button", { name: /Step 3 of 4: Course and onset/ }).click();
  await expect(rapidCycling).toBeEnabled();
  await page.getByText("Rapid cycling", { exact: true }).click();
  await expect(rapidCycling).toBeChecked();
});

test("infers a compatible diagnosis for non-MDD builder deep links", async ({ page }) => {
  await gotoApp(page, "/specifiers/builder?specifier=with-rapid-cycling&specifier=with-psychotic-features");

  await page.getByRole("button", { name: /Step 3 of 4: Course and onset/ }).click();
  const rapidCycling = page.getByRole("checkbox", { name: /Rapid cycling/ });
  await page.getByRole("button", { name: /Step 1 of 4: Base diagnosis/ }).click();
  await expect(page.getByRole("combobox", { name: "Diagnostic phrase" })).toHaveValue("bipolar-i-depressed");
  await page.getByRole("button", { name: /Step 3 of 4: Course and onset/ }).click();
  await expect(rapidCycling).toBeEnabled();
  await expect(rapidCycling).toBeChecked();
  await expect(page.getByTestId("specifier-working-wording")).toHaveText(
    "Bipolar I disorder, current episode depressed, severe with psychotic features, with rapid cycling",
  );

  await page.getByRole("button", { name: /Step 1 of 4: Base diagnosis/ }).click();
  await page.getByRole("combobox", { name: "Diagnostic phrase" }).selectOption("bipolar-i-manic");
  await page.getByRole("button", { name: /Step 3 of 4: Course and onset/ }).click();
  await expect(rapidCycling).toBeEnabled();
  await expect(rapidCycling).toBeChecked();
});
