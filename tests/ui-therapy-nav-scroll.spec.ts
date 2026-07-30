import { expect, test, type Page } from "playwright/test";
import { resolve } from "node:path";

import { appendPrimaryScrollSpacer, readPrimaryScrollGeometry, scrollPrimarySurface } from "./playwright-scroll";

/**
 * Therapy section nav must hide/reveal with the universal top bar on phones.
 * Sticky-in-content left the strip pinned after header collapse (the defect
 * these checks guard). The nav portals into universal-header-collapse below
 * the phone seam so one scroll signal owns both surfaces.
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
    if (!/^(?:therapies(?:-(?:home|index))?\.[a-f0-9]{16}|pathways|reference)\.json$/.test(filename)) {
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
  // Compare, not search: `/therapy-compass/search` moved to the shared `ModeNav`
  // (see `ui-mode-nav-density.spec.ts`). Every other Therapy route still ships
  // the original pill strip, so this route keeps that strip's coverage alive
  // until the rollout continues.
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

test("phone Therapy section nav hides and returns with the universal header", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoTherapyCompare(page);

  const collapseHost = page.getByTestId("universal-header-collapse");
  const sectionNav = page.getByTestId("therapy-compass-section-nav");
  const addonHost = page.getByTestId("header-collapse-addon");

  await expect(collapseHost).toBeVisible();
  await expect(sectionNav).toBeVisible();
  await expect(addonHost).toBeVisible();

  // Anchored: the portaled strip lives inside the collapse row, not sticky in content.
  await expect
    .poll(async () => sectionNav.evaluate((node) => Boolean(node.closest('[data-testid="universal-header-collapse"]'))))
    .toBe(true);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const inContent = document.querySelector("#main-content [data-testid='therapy-compass-section-nav']");
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
  // Collapsed chrome is clipped by the 0fr track. With the always-on
  // chrome-safe-area-top spacer, the collapse host sits below that band — so
  // "off screen" means above-or-at the spacer bottom, not necessarily y<=1.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const nav = document.querySelector('[data-testid="therapy-compass-section-nav"]');
        const collapse = document.querySelector('[data-testid="universal-header-collapse"]');
        if (!(nav instanceof HTMLElement) || !(collapse instanceof HTMLElement)) return false;
        const navRect = nav.getBoundingClientRect();
        const collapseRect = collapse.getBoundingClientRect();
        return navRect.height <= 1 || navRect.bottom <= collapseRect.top + 1;
      }),
    )
    .toBe(true);

  for (const offset of [220, 140, 60, 0]) {
    await scrollPrimarySurface(page, offset);
  }

  await expect(collapseHost).not.toHaveAttribute("data-scroll-hidden", "true", { timeout: 5_000 });
  await expect(sectionNav).toBeVisible();
  const box = await sectionNav.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.height).toBeGreaterThan(8);
});
