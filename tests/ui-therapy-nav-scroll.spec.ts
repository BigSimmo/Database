import { expect, test, type Page } from "playwright/test";
import { resolve } from "node:path";

import { appendPrimaryScrollSpacer, readPrimaryScrollGeometry, scrollPrimarySurface } from "./playwright-scroll";

/**
 * Therapy's mode nav must hide/reveal with the universal top bar on phones.
 * Sticky-in-content left the old pill strip pinned after header collapse (the
 * defect these checks guard). The bar portals into universal-header-collapse —
 * at every width now, not only below the phone seam — so one scroll signal owns
 * both surfaces.
 */

const phoneViewport = { width: 390, height: 844 };

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

async function installTherapyFixtures(page: Page) {
  await page.route("**/therapy-compass-data/*.json", async (route) => {
    const filename = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    if (!/^(?:therapies(?:-index)?\.[a-f0-9]{16}|pathways|reference)\.json$/.test(filename)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      path: resolve(process.cwd(), "public", "therapy-compass-data", filename),
    });
  });
}

async function gotoTherapyCompare(page: Page) {
  // Compare rather than search: both now ship the same shared bar, and this
  // route is the one that used to carry the pill strip, so it keeps the
  // anchoring coverage pointed where the defect actually lived. Density and
  // label fit are covered separately in `ui-mode-nav-density.spec.ts`.
  await page.goto("/therapy-compass/compare", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
  await page.addStyleTag({
    content: ":root{--safe-area-top:59px !important;--safe-area-bottom:34px !important;}",
  });
  await page.waitForTimeout(700);
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
  await installTherapyFixtures(page);
});

test("phone Therapy mode nav hides and returns with the universal header", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoTherapyCompare(page);

  const collapseHost = page.getByTestId("universal-header-collapse");
  const modeNav = page.locator('[data-testid="universal-header-collapse"] [data-testid="mode-nav"]');
  const addonHost = page.getByTestId("header-collapse-addon");

  await expect(collapseHost).toBeVisible();
  await expect(modeNav).toBeVisible();
  await expect(addonHost).toBeVisible();

  // Anchored: the portaled bar lives inside the collapse row, not sticky in content.
  await expect
    .poll(async () => modeNav.evaluate((node) => Boolean(node.closest('[data-testid="universal-header-collapse"]'))))
    .toBe(true);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const inContent = document.querySelector("#main-content [data-testid='mode-nav']");
        return inContent === null;
      }),
    )
    .toBe(true);

  await appendPrimaryScrollSpacer(page, { heightPx: 2400, testId: "therapy-nav-hide-scroll-spacer" });
  // Browser-mode phones deliberately leave #main-content in normal flow so
  // Safari can collapse its own toolbar; the document must drive both chrome
  // surfaces here. Standalone inner-scroll ownership is covered separately.
  await expect.poll(async () => (await readPrimaryScrollGeometry(page)).owner).toBe("document");

  await expect(collapseHost).not.toHaveAttribute("data-scroll-hidden", "true");

  for (const offset of [40, 80, 120, 160, 220, 300]) {
    await scrollPrimarySurface(page, offset);
  }

  await expect(collapseHost).toHaveAttribute("data-scroll-hidden", "true", { timeout: 5_000 });
  // Overlay motion translates the whole stack off the top edge at a stable
  // height, so "hidden" is the nav clearing the viewport top. The two collapse
  // readings are kept as alternatives: a clipped 0fr track (height <= 1) and a
  // nav sitting above the always-on chrome-safe-area-top band.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const nav = document.querySelector('[data-testid="universal-header-collapse"] [data-testid="mode-nav"]');
        const collapse = document.querySelector('[data-testid="universal-header-collapse"]');
        if (!(nav instanceof HTMLElement) || !(collapse instanceof HTMLElement)) return false;
        const navRect = nav.getBoundingClientRect();
        const collapseRect = collapse.getBoundingClientRect();
        return navRect.bottom <= 1 || navRect.height <= 1 || navRect.bottom <= collapseRect.top + 1;
      }),
    )
    .toBe(true);

  for (const offset of [220, 140, 60, 0]) {
    await scrollPrimarySurface(page, offset);
  }

  await expect(collapseHost).not.toHaveAttribute("data-scroll-hidden", "true", { timeout: 5_000 });
  await expect(modeNav).toBeVisible();
  const box = await modeNav.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.height).toBeGreaterThan(8);
});
