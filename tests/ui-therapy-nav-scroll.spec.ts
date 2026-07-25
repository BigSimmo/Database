import { expect, test, type Page } from "playwright/test";
import { resolve } from "node:path";

import { scrollPrimarySurface } from "./playwright-scroll";

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
    if (!new Set(["therapies.json", "therapies-index.json", "pathways.json", "reference.json"]).has(filename)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      path: resolve(process.cwd(), "public", "therapy-compass-data", filename),
    });
  });
}

async function gotoTherapySearch(page: Page) {
  await page.goto("/therapy-compass/search?q=CBT&run=1", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
  await page.addStyleTag({
    content: ":root{--safe-area-top:59px !important;--safe-area-bottom:34px !important;}",
  });
  await page.waitForTimeout(700);
}

async function waitForMainScrollHandler(page: Page) {
  const main = page.locator("#main-content");
  await expect
    .poll(
      async () =>
        main.evaluate((element) => {
          const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
          if (!propsKey) return false;
          const props = (element as unknown as Record<string, Record<string, unknown>>)[propsKey];
          return typeof props?.onScroll === "function";
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
  await installTherapyFixtures(page);
});

test("phone Therapy section nav hides and returns with the universal header", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoTherapySearch(page);

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

  await waitForMainScrollHandler(page);
  await page.locator("#main-content").evaluate((node) => {
    const spacer = document.createElement("div");
    spacer.setAttribute("data-testid", "therapy-nav-hide-scroll-spacer");
    spacer.style.height = "2400px";
    node.appendChild(spacer);
  });

  await expect(collapseHost).not.toHaveAttribute("data-scroll-hidden", "true");

  for (const offset of [40, 80, 120, 160, 220, 300]) {
    await scrollPrimarySurface(page, offset);
  }

  await expect(collapseHost).toHaveAttribute("data-scroll-hidden", "true", { timeout: 5_000 });
  // Collapsed chrome is clipped by the 0fr track — height/bottom must leave the viewport.
  await expect
    .poll(async () =>
      sectionNav.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { height: rect.height, bottom: rect.bottom };
      }),
    )
    .toEqual(expect.objectContaining({ height: expect.any(Number) }));
  await expect
    .poll(async () =>
      sectionNav.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return rect.height <= 1 || rect.bottom <= 1;
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
