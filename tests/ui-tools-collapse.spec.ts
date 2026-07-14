import { expect, test, type Page } from "playwright/test";

// Additive coverage for collapse-on-filter: when a search/filter is active the
// static primary region (Start here / workflow lanes / launcher overview) is
// hidden so results are never shown beneath a still-populated grid.

async function goto(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Deterministic app-shell mount wait (networkidle burned the full timeout on
  // routes with persistent background fetches; per-test assertions gate readiness).
  await page
    .locator("#main-content")
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => undefined);
}

// The shell's expanded sidebar (now the desktop default) contributes its own
// "Search recent chats" searchbox, so mockup searches must be scoped to the
// page content instead of grabbing the first searchbox on the page.
function mockupSearch(page: Page) {
  return page.locator("#main-content").getByRole("searchbox").first();
}

test.describe("Tools mockups collapse the primary region when filtering @mockup", () => {
  test.describe.configure({ timeout: 60_000 });

  test("command center hides Start here and avoids a populated grid over an empty state", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto(page, "/mockups/tools-command-center");

    await expect(page.getByRole("heading", { name: "Start here" })).toBeVisible();

    const search = mockupSearch(page);
    await search.fill("medication");
    await expect(page.getByRole("heading", { name: "Start here" })).toHaveCount(0);
    await expect(page.getByLabel("Open Medication Prescribing")).toBeVisible();

    // No-match: empty state shows and the pinned grid is gone (not sitting above it).
    await search.fill("zzzzznotarealtool");
    await expect(page.getByText(/No tools match/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start here" })).toHaveCount(0);
  });

  test("workflow board has a Resume lane and hides lanes when searching", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto(page, "/mockups/tools-workflow-board");

    await expect(page.getByRole("heading", { name: "Resume" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assess" })).toBeVisible();

    await mockupSearch(page).fill("medication");
    await expect(page.getByRole("heading", { name: "Assess" })).toHaveCount(0);
    await expect(page.getByLabel("Open Medication Prescribing")).toBeVisible();
  });

  test("split pane swaps the launcher overview to live results when filtering", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto(page, "/mockups/tools-split-pane");

    await expect(page.getByRole("heading", { name: "Launcher overview" })).toBeVisible();

    await mockupSearch(page).fill("medication");
    await expect(page.getByRole("heading", { name: "Launcher overview" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    // The split-pane card is a button; it must expose an explicit accessible
    // action name, not just its concatenated card text (2026-07-13 audit).
    await expect(page.getByRole("button", { name: /^Preview Medication Prescribing/ })).toBeVisible();
  });
});
