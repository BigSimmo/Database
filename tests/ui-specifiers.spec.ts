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
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
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

  await expect(page.getByRole("heading", { name: "Refine the diagnosis with the right specifier" })).toBeVisible();
  await expect(page.getByTestId("specifiers-home")).toBeVisible();

  const search = page.getByTestId("global-search-input").filter({ visible: true }).first();
  await expect(search).toHaveAccessibleName(
    /Search indexed guidelines by question or keyword - Search psychiatric specifiers by presentation or diagnosis/,
  );
  await search.fill("depressed but racing thoughts");
  await page.getByRole("button", { name: "Find matching psychiatric specifiers" }).click();

  await expect(page).toHaveURL(/\/specifiers\?.*q=depressed(?:\+|%20)but(?:\+|%20)racing(?:\+|%20)thoughts.*run=1/);
  await expect(page.getByRole("heading", { name: /Matches for “depressed but racing thoughts”/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "With mixed features", exact: true })).toBeVisible();
  await expect(page.getByText("Source status", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Source", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Open With mixed features" }).click();
  await expect(page).toHaveURL(/\/specifiers\/with-mixed-features$/);
  await expect(page.getByRole("heading", { name: "With mixed features", exact: true })).toBeVisible();
  await expect(page.getByText("What matters now", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Use in builder", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Build the diagnosis in the right order" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Mixed features/ })).toBeChecked();
  await expect(page.getByText(/with mixed features/i).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAxeViolations(page, testInfo);
});

test("keeps mobile search, filters, results, and the fixed composer usable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/specifiers?q=returns+every+winter&run=1");

  await expect(page.getByRole("heading", { name: /Matches for “returns every winter”/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "With seasonal pattern", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filter by diagnosis" })).toBeVisible();
  await expect(page.getByTestId("global-search-input").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Source status", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Source", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Open With seasonal pattern" }).click();
  await expect(page.getByRole("heading", { name: "With seasonal pattern", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Compare", exact: true }).last()).toBeVisible();
  await expect(page.getByRole("link", { name: "Build wording", exact: true }).last()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAxeViolations(page, testInfo);
});

test("keeps the base diagnosis severity-neutral when applying a severity descriptor", async ({ page }) => {
  await gotoApp(page, "/specifiers/builder?specifier=mild-severity");

  await expect(page.getByRole("combobox", { name: "Diagnostic phrase" })).toHaveValue(
    "Major depressive disorder, recurrent",
  );
  await expect(page.getByText("Major depressive disorder, recurrent, mild", { exact: true })).toBeVisible();
  await expect(page.getByText(/severe, mild|moderate, mild/i)).toHaveCount(0);

  const anxiousDistress = page.getByRole("checkbox", { name: /Anxious distress/ });
  await page.getByText("Anxious distress", { exact: true }).click();
  await expect(anxiousDistress).toBeChecked();
  await expect(
    page.getByText("Major depressive disorder, recurrent, with anxious distress, mild", { exact: true }),
  ).toBeVisible();
});
