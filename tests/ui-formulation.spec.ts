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

test("searches patient language, opens a mechanism guide, and carries it into the builder", async ({
  page,
}, testInfo) => {
  await gotoApp(page, "/formulation");

  await expect(page.getByRole("heading", { name: "How can I help with the formulation?" })).toBeVisible();
  await expect(page.getByTestId("formulation-home")).toBeVisible();

  const search = page.getByTestId("global-search-input").filter({ visible: true }).first();
  await expect(search).toHaveAccessibleName(
    /Search indexed guidelines by question or keyword - Search formulation mechanisms by pattern or patient language/,
  );
  await search.fill("I keep going over it");
  await page.getByRole("button", { name: "Find matching formulation mechanisms" }).click();

  await expect(page).toHaveURL(/\/formulation\?.*q=I(?:\+|%20)keep(?:\+|%20)going(?:\+|%20)over(?:\+|%20)it.*run=1/);
  await expect(page.getByRole("heading", { name: /Mechanisms matching “I keep going over it”/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rumination", exact: true })).toBeVisible();
  await expect(page.getByText("Source status", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Source", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Open Rumination" }).click();
  await expect(page).toHaveURL(/\/formulation\/rumination$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Rumination", exact: true })).toBeVisible();
  await expect(page.getByText("What matters now", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Use in formulation", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Build a formulation that can be tested" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Rumination/ })).toBeChecked();
  await expect(page.getByText(/Rumination appears to keep the patient caught/i).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAxeViolations(page, testInfo);
});

test("keeps mobile search, domain filtering, record actions, and universal chrome usable", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/formulation?q=What+if+something+goes+wrong&run=1");

  await expect(page.getByRole("heading", { name: /Mechanisms matching “What if something goes wrong”/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Worry", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filter by formulation domain" })).toBeVisible();
  await expect(page.getByTestId("global-search-input").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Source status", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Source", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Open Worry" }).click();
  await expect(page.getByRole("heading", { name: "Worry", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Compare", exact: true }).last()).toBeVisible();
  await expect(page.getByRole("link", { name: "Use in formulation", exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAxeViolations(page, testInfo);
});

test("moves a selected mechanism through framework, quality review, and an editable draft", async ({
  page,
}, testInfo) => {
  await gotoApp(page, "/formulation/builder?mechanism=rumination&template=5Ps");

  await expect(page.getByRole("checkbox", { name: /Rumination/ })).toBeChecked();
  await page.getByRole("button", { name: /Continue to framework/ }).click();
  await expect(page.getByTestId("formulation-builder-structure")).toBeVisible();
  const cbtCycle = page.getByRole("radio", { name: /CBT cycle/ });
  await page.getByText("CBT cycle", { exact: true }).click();
  await expect(cbtCycle).toBeChecked();
  await page
    .getByRole("textbox", { name: "Presenting problem" })
    .fill("De-identified recurring low mood and overthinking.");

  await page.getByRole("button", { name: "Review quality", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Evidence supporting this mechanism" })
    .fill("Repetitive review follows perceived failures and delays sleep.");
  await page
    .getByRole("textbox", { name: "Alternative explanation" })
    .fill("Check future-focused worry and realistic problem solving.");

  await page.getByRole("button", { name: "Create draft" }).click();
  const draft = page.getByRole("textbox", { name: "Formulation draft" });
  await expect(draft).toHaveValue(/CBT cycle formulation/);
  await expect(draft).toHaveValue(/Rumination appears to keep the patient caught/);

  await draft.fill("Stale edited draft");
  await page.getByRole("button", { name: /Select\s+Mechanisms/ }).click();
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("button", { name: /Draft\s+Formulation/ }).click();
  await expect(draft).not.toHaveValue("Stale edited draft");
  await expect(draft).toHaveValue(/Select mechanisms and add case evidence/);
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAxeViolations(page, testInfo);
});

test("keeps legacy specifier detail links on a valid formulation route", async ({ page }) => {
  await gotoApp(page, "/specifiers/with-anxious-distress");

  await expect(page).toHaveURL(/\/formulation\?q=with\+anxious\+distress&run=1$/);
  await expect(page.getByRole("heading", { name: /Mechanisms matching “with anxious distress”/ })).toBeVisible();
  await expect(page.getByText("Page not found", { exact: true })).toHaveCount(0);
});

test("compares supported alternatives and groups mechanisms without implying causation", async ({ page }) => {
  await gotoApp(page, "/formulation/compare?a=rumination&b=worry");
  await expect(page.getByRole("heading", { name: "Compare mechanisms" })).toBeVisible();
  await expect(page.getByText(/replaying what happened or trying to prevent what might happen next/i)).toBeVisible();
  await expect(page.getByText("Most useful distinction", { exact: true })).toBeVisible();

  await gotoApp(page, "/formulation/map?mechanism=shame");
  await expect(page.getByRole("heading", { name: "Mechanism map" })).toBeVisible();
  await expect(page.getByText(/does not assert causation/i)).toBeVisible();
  await expect(page.getByText("Selected mechanism", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shame", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
