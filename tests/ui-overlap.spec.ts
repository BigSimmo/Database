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
  // Wait until React settles on a single header. During client remount /
  // hydration a second transient header#search can exist briefly; checking
  // count then immediately calling waitFor races that flicker into a strict-mode
  // violation. Retry count+visibility together so permanent double-render still
  // fails while transient remounts can settle.
  await expect(async () => {
    const header = page.locator("header#search");
    await expect(header).toHaveCount(1);
    await expect(header).toBeVisible();
  }).toPass({ timeout: 30_000 });
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

      // gotoHome settles on a single visible header, but a later React remount
      // can detach it again between that settle and this measurement — the
      // header then has a 0x0 rect, no candidates are collected, and count is 0.
      // Retry the collection (not the overlap assertion) so a header that never
      // renders still fails, while a transient remount settles. Without this the
      // suite fails at a different, arbitrary width on each contended run.
      let report = await collectHeaderOverlaps(page);
      await expect(async () => {
        report = await collectHeaderOverlaps(page);
        expect(report.count, "expected the active mode control in the header").toBeGreaterThanOrEqual(
          width >= 768 ? 1 : 2,
        );
      }).toPass({ timeout: 15_000 });
      expect(report.overlaps, `overlapping header elements at ${width}px`).toEqual([]);

      if (width >= 768) {
        await expect(page.getByRole("button", { name: "Start a new chat" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "New chat", exact: true })).toBeVisible();
      }
    });
  }

  for (const viewport of [
    { name: "narrow-phone", width: 360, height: 780 },
    { name: "phone", width: 390, height: 820 },
  ] as const) {
    test(`header menu and new-chat insets stay symmetric on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockDemoDashboard(page);
      await gotoHome(page);

      const menu = page.getByRole("button", { name: "Open Clinical Guide menu" });
      const newChat = page.getByRole("button", { name: "Start a new chat" });
      await expect(menu).toBeVisible();
      await expect(newChat).toBeVisible();

      // Headless Chromium reports env(safe-area-inset-*) as 0, so this asserts
      // the --header-edge-pad (1rem) chrome inset — not notch asymmetry.
      //
      // Sample the geometry inside a retry: a React remount can leave the header
      // mid-layout, and a single sample then reads transient boxes. The
      // assertions themselves are unchanged and still strict, so a genuinely
      // asymmetric header fails once the retry budget is spent — only a
      // transient one settles.
      await expect(async () => {
        const menuBox = await menu.boundingBox();
        const newChatBox = await newChat.boundingBox();
        expect(menuBox, "menu control must have geometry").not.toBeNull();
        expect(newChatBox, "new-chat control must have geometry").not.toBeNull();

        const leftInset = menuBox!.x;
        const rightInset = viewport.width - (newChatBox!.x + newChatBox!.width);
        // 1rem header pad (~16px) with 2px subpixel tolerance.
        expect(leftInset, "left menu inset should be at least ~1rem").toBeGreaterThanOrEqual(14);
        expect(rightInset, "right new-chat inset should be at least ~1rem").toBeGreaterThanOrEqual(14);
        expect(
          Math.abs(leftInset - rightInset),
          `left/right insets should match (left=${leftInset}, right=${rightInset})`,
        ).toBeLessThanOrEqual(2);
      }).toPass({ timeout: 15_000 });
    });
  }

  for (const viewport of [
    { name: "narrow-phone", width: 360, height: 780 },
    { name: "phone", width: 390, height: 820 },
  ] as const) {
    test(`in-page action group stays inside the header gutter on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockDemoDashboard(page);
      await page.goto("/therapy-compass/cognitive-behavioural-therapy-cbt", { waitUntil: "domcontentloaded" });

      const back = page.getByRole("link", { name: /Back to /i });
      const actionGroup = page.getByTestId("therapy-detail-action-group");
      await expect(actionGroup).toBeVisible({ timeout: 30_000 });
      await expect(back).toBeVisible();

      // Same contract as hamburger / new-chat: --header-edge-pad (~16px) with
      // 2px subpixel tolerance. Headless Chromium reports safe-area insets as 0.
      await expect(async () => {
        const backBox = await back.boundingBox();
        const groupBox = await actionGroup.boundingBox();
        expect(backBox, "back control must have geometry").not.toBeNull();
        expect(groupBox, "action group must have geometry").not.toBeNull();

        const leftInset = backBox!.x;
        const rightInset = viewport.width - (groupBox!.x + groupBox!.width);
        expect(leftInset, "left back inset should be at least ~1rem").toBeGreaterThanOrEqual(14);
        expect(rightInset, "right action-group inset should be at least ~1rem").toBeGreaterThanOrEqual(14);
        expect(
          Math.abs(leftInset - rightInset),
          `left/right insets should match (left=${leftInset}, right=${rightInset})`,
        ).toBeLessThanOrEqual(2);
      }).toPass({ timeout: 15_000 });
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

  test("desktop dormant search keeps prompts below the composer without a Smart promise", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDemoDashboard(page);
    await gotoHome(page);

    const rotatingText = page.getByTestId("smart-search-rotating-text");
    const promptRow = page.getByTestId("smart-search-prompt-row");
    await expect(rotatingText).toHaveCount(0);
    await expect(promptRow).toBeVisible();
    await expect(promptRow.getByRole("button", { name: "lithium level timing" })).toBeVisible();
    await expect(promptRow.getByRole("button", { name: "clozapine ANC monitoring" })).toBeVisible();

    const geometry = await page.evaluate(() => {
      const prompt = document.querySelector('[data-testid="smart-search-prompt-row"]');
      const pill = document.querySelector(".answer-footer-search-pill");
      if (!prompt || !pill) return null;
      const promptRect = prompt.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();
      return {
        pillBottom: pillRect.bottom,
        promptTop: promptRect.top,
      };
    });

    expect(geometry, "composer and prompt row must render").not.toBeNull();
    expect(geometry!.promptTop, "prompts should sit below the search bar").toBeGreaterThanOrEqual(
      geometry!.pillBottom - 1,
    );

    await promptRow.getByRole("button", { name: "lithium level timing" }).click();
    await expect(page.locator('[data-testid="global-search-input"]:visible').first()).toHaveValue(
      "lithium level timing",
    );
  });

  test("phone home keeps one tappable example ticker without a Smart promise", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoDashboard(page);
    await gotoHome(page);

    // The desktop prompt rail is display:none on a phone, so the ticker is the
    // only suggestion a phone home page carries. It offers an ordinary search,
    // which is why it stays while the Smart line does not.
    await expect(page.getByTestId("smart-search-rotating-text")).toHaveCount(0);
    await expect(page.getByTestId("smart-search-prompt-row")).toBeHidden();

    const ticker = page.getByTestId("smart-search-phone-ticker");
    await expect(ticker).toBeVisible();
    await expect(ticker).toContainText("Try this");
    await expect(ticker).toContainText("Tap to search");

    const tickerBox = await ticker.boundingBox();
    expect(tickerBox, "phone suggestion ticker must render").not.toBeNull();
    expect(tickerBox!.height, "phone ticker must meet the tap-target floor").toBeGreaterThanOrEqual(48);

    const suggestion = (await ticker.getAttribute("aria-label"))?.replace("Try suggested search: ", "");
    expect(suggestion).toBeTruthy();
    await ticker.click();
    await expect(page.locator('[data-testid="global-search-input"]:visible').first()).toHaveValue(suggestion ?? "");
  });

  test("phone suggestion ticker renders on /documents mode home", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockDemoDashboard(page);
    await page.goto("/documents", { waitUntil: "domcontentloaded" });
    await expect(async () => {
      const header = page.locator("header#search");
      await expect(header).toHaveCount(1);
      await expect(header).toBeVisible();
    }).toPass({ timeout: 30_000 });

    const ticker = page.getByTestId("smart-search-phone-ticker");
    await expect(ticker).toBeVisible();
    // Documents has no governed Smart answers, so the ticker must stay an
    // ordinary example search — no "Smart search" line beside it.
    await expect(page.getByTestId("smart-search-rotating-text")).toHaveCount(0);
    const tickerBox = await ticker.boundingBox();
    expect(tickerBox, "phone suggestion ticker must render on /documents home").not.toBeNull();
    expect(tickerBox!.height, "phone ticker must meet the tap-target floor on /documents").toBeGreaterThanOrEqual(48);
  });
});
