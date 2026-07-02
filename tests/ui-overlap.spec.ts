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

async function gotoHome(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // The dashboard is a client-only (`ssr: false`) dynamic import, so DOM-ready
  // and even network-idle can fire before the header mounts — Firefox and
  // WebKit paint the client chunk later than Chromium, which is why the overlap
  // assertion intermittently saw an empty shell. Wait for the real header to be
  // attached before measuring instead of relying on the flaky idle heuristic.
  await page.locator("header#search").waitFor({ state: "visible", timeout: 30_000 });
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
      await mockSetupStatus(page);
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
      await mockSetupStatus(page);
      await gotoHome(page);

      const input = page.locator('[data-testid="global-search-input"]:visible').first();
      await input.fill("Synthetic lithium monitoring guidance question");

      const clearButton = page.locator('[aria-label="Clear search question"]:visible').first();
      await expect(clearButton).toBeVisible();

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
});
