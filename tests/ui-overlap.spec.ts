import { expect, test, type Page } from "playwright/test";

/**
 * Element-overlap regression coverage.
 *
 * The page-overflow smoke checks only assert document-level horizontal
 * overflow, which overlapping siblings never trigger. This header bug class
 * shipped three separate times (source ledger under the mode pill, the
 * composer clear button over typed text, and the standalone-home status chips
 * under the pill), so these tests assert directly that visible header
 * elements do not stack on top of each other at any supported width, and
 * that the composer clear button occupies its own slot.
 */

const headerWidths = [640, 768, 1024, 1152, 1280, 1366, 1440, 1536] as const;

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test Supabase project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search schema ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required for UI smoke." },
];

async function mockSetupStatus(page: Page) {
  await page.route("**/api/setup-status**", async (route) => {
    await route.fulfill({ json: { demoMode: true, checks: readySetupChecks } });
  });
}

async function mockDemoDashboard(page: Page) {
  await mockSetupStatus(page);
  await page.route(/\/api\/local-project-id$/, async (route) => {
    await route.fulfill({
      json: {
        appName: "Clinical Guide",
        projectId: "test-project",
        identityPath: "/api/local-project-id",
        localServer: {
          currentUrl: "http://localhost:4298",
          currentPort: 4298,
          projectPortStart: 4298,
          projectPortEnd: 53210,
          safeLocalOrigin: true,
          requestOrigin: null,
          requestReferer: null,
          unsafeLocalCaller: null,
        },
      },
    });
  });
  await page.route(/\/api\/documents(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        documents: [],
        demoMode: true,
        pagination: { limit: 150, offset: 0, total: 0, nextOffset: 0, hasMore: false },
      },
    });
  });
}

async function gotoHome(page: Page) {
  // Pin mode=answer so GlobalSearchShell does not immediately router.replace()
  // for a stored landing preference. That replace can briefly leave two mounted
  // shells (and two header#search nodes), which trips Playwright strict mode.
  await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });
  const searchHeader = page.locator("header#search");
  // Same settle pattern as expectSingleMedicationPage in ui-smoke: Suspense /
  // client remount can transiently yield two banners. Wait for exactly one so
  // a permanent double-render still fails toHaveCount(1).
  if ((await searchHeader.count()) !== 1) {
    await expect(searchHeader).toHaveCount(1, { timeout: 30_000 });
  }
  await expect(searchHeader).toHaveCount(1, { timeout: 30_000 });
  await expect(searchHeader).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Open answer options" }).waitFor({ state: "visible", timeout: 30_000 });
}

type OverlapReport = { count: number; overlaps: string[] };

async function collectHeaderOverlaps(page: Page): Promise<OverlapReport> {
  return page.evaluate(() => {
    const header = Array.from(document.querySelectorAll("header#search, header, [role='banner']")).find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (!header) return { count: 0, overlaps: ["visible header not found"] };
    // Interactive controls plus the styled status chips (spans) that sit
    // alongside them; nested elements are excluded via the contains() check.
    const candidates = Array.from(
      header.querySelectorAll("button, summary, a, div > span.inline-flex, div > span.grid"),
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const overlaps: string[] = [];
    const label = (element: Element) =>
      element.getAttribute("aria-label") ?? (element.textContent ?? "").trim().slice(0, 24);
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i].getBoundingClientRect();
        const b = candidates[j].getBoundingClientRect();
        const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const nested = candidates[i].contains(candidates[j]) || candidates[j].contains(candidates[i]);
        // 4px tolerance ignores subpixel rounding and intentional edge kisses.
        if (xOverlap > 4 && yOverlap > 4 && !nested) {
          overlaps.push(
            `"${label(candidates[i])}" overlaps "${label(candidates[j])}" by ${Math.round(Math.min(xOverlap, yOverlap))}px`,
          );
        }
      }
    }
    return { count: candidates.length, overlaps };
  });
}

test.describe("Header element overlap coverage", () => {
  for (const width of headerWidths) {
    test(`header controls do not overlap at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockDemoDashboard(page);
      await gotoHome(page);

      const report = await collectHeaderOverlaps(page);
      expect(report.count, "expected at least the mode pill and one control in the header").toBeGreaterThanOrEqual(2);
      expect(report.overlaps, `overlapping header elements at ${width}px`).toEqual([]);
    });
  }

  for (const viewport of [
    { name: "mobile", width: 390, height: 820 },
    { name: "desktop", width: 1280, height: 900 },
  ] as const) {
    test(`composer clear button does not cover typed text at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockDemoDashboard(page);
      await gotoHome(page);

      const input = page.locator('[data-testid="global-search-input"]:visible').first();
      await expect(input).toBeEditable();
      await expect(async () => {
        await input.click();
        await input.fill("Synthetic lithium monitoring guidance question");
        await expect(input).toHaveValue("Synthetic lithium monitoring guidance question");
        await expect(page.locator('[aria-label="Clear search question"]:visible').first()).toBeVisible();
      }).toPass({ timeout: 15_000 });

      const geometry = await page.evaluate(() => {
        const inputElement = document.querySelector('[data-testid="global-search-input"]');
        const clearElement = document.querySelector('[aria-label="Clear search question"]');
        if (!inputElement || !clearElement) return null;
        const inputRect = inputElement.getBoundingClientRect();
        const clearRect = clearElement.getBoundingClientRect();
        return { inputRight: inputRect.right, clearLeft: clearRect.left };
      });

      expect(geometry, "input and clear button must both render").not.toBeNull();
      expect(
        geometry!.inputRight,
        "the input must end before the clear button starts (no text under the button)",
      ).toBeLessThanOrEqual(geometry!.clearLeft + 1);
    });
  }

  test("desktop smart search keeps rotating text above and prompts below the composer", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoDashboard(page);
    await gotoHome(page);

    const rotatingText = page.getByTestId("smart-search-rotating-text");
    const promptRow = page.getByTestId("smart-search-prompt-row");
    await expect(rotatingText).toBeVisible();
    await expect(rotatingText).toContainText("Smart search");
    await expect(promptRow).toBeVisible();
    await expect(promptRow.getByRole("button", { name: "lithium level timing" })).toBeVisible();
    await expect(promptRow.getByRole("button", { name: "clozapine ANC monitoring" })).toBeVisible();

    const geometry = await page.evaluate(() => {
      const hint = document.querySelector('[data-testid="smart-search-rotating-text"]');
      const prompt = document.querySelector('[data-testid="smart-search-prompt-row"]');
      const pill = document.querySelector(".answer-footer-search-pill");
      if (!hint || !prompt || !pill) return null;
      const hintRect = hint.getBoundingClientRect();
      const promptRect = prompt.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();
      return {
        hintBottom: hintRect.bottom,
        pillTop: pillRect.top,
        pillBottom: pillRect.bottom,
        promptTop: promptRect.top,
      };
    });

    expect(geometry, "smart search hint, composer, and prompt row must render").not.toBeNull();
    expect(geometry!.hintBottom, "rotating text should sit above the smart search bar").toBeLessThanOrEqual(
      geometry!.pillTop + 1,
    );
    expect(geometry!.promptTop, "smart prompts should sit below the smart search bar").toBeGreaterThanOrEqual(
      geometry!.pillBottom - 1,
    );

    await promptRow.getByRole("button", { name: "lithium level timing" }).click();
    await expect(page.locator('[data-testid="global-search-input"]:visible').first()).toHaveValue(
      "lithium level timing",
    );
  });

  test("phone smart search does not show the desktop rotating text or prompt row", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoDashboard(page);
    await gotoHome(page);

    await expect(page.getByTestId("smart-search-rotating-text")).toBeHidden();
    await expect(page.getByTestId("smart-search-prompt-row")).toBeHidden();
  });
});
