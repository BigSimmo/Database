import { expect, test, type Page } from "playwright/test";
import { resolve } from "node:path";

import { appendPrimaryScrollSpacer, scrollPrimarySurface } from "./playwright-scroll";

const phoneViewport = { width: 390, height: 844 };
const desktopViewport = { width: 1280, height: 900 };

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

async function gotoPathways(page: Page, pathway = "anxiety-pathway") {
  await page.goto(`/therapy-compass/pathways?pathway=${pathway}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
  await page.addStyleTag({
    content: ":root{--safe-area-top:59px !important;--safe-area-bottom:34px !important;}",
  });
  await page.waitForTimeout(700);
}

async function readCautionGeometry(page: Page) {
  return page.evaluate(() => {
    const caution = document.querySelector<HTMLElement>('[data-testid="therapy-pathway-caution"]');
    const dock = document.querySelector<HTMLElement>(".answer-footer-search-dock");
    if (!caution || !dock) {
      throw new Error("Expected both the pathway caution band and the answer footer search dock to be present");
    }
    const cautionRect = caution.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    return {
      cautionBottom: cautionRect.bottom,
      dockTop: dockRect.top,
      reserve: getComputedStyle(document.querySelector("#main-content")!)
        .getPropertyValue("--mobile-composer-reserve")
        .trim(),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
  await installTherapyFixtures(page);
});

test("phone pathways picker opens, anxiety steps scroll above composer, caution stays visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(phoneViewport);
  await gotoPathways(page);

  const picker = page.getByTestId("therapy-pathway-picker");
  await expect(picker).toBeVisible();
  await expect(page.getByTestId("therapy-pathway-steps")).toBeVisible();
  await expect(page.locator(".therapy-pathway-list")).toBeHidden();

  // Selecting a different pathway must actually change the active pathway, not just close the
  // sheet — clicking the already-active row would pass a check that only asserts the panel closed.
  await page.getByRole("button", { name: "Change pathway" }).click();
  await expect(page.getByTestId("therapy-pathway-picker-panel")).toBeVisible();
  await page.getByRole("button", { name: "Mood pathway" }).click();
  await expect(page.getByTestId("therapy-pathway-picker-panel")).toBeHidden();
  await expect(page).toHaveURL(/pathway=mood-pathway/);
  await expect(picker.getByText("Mood pathway", { exact: false }).first()).toBeVisible();

  // Switch back to Anxiety pathway so the remaining steps/caution/composer assertions below,
  // which are scoped to the anxiety fixture data, stay valid.
  await page.getByRole("button", { name: "Change pathway" }).click();
  await expect(page.getByTestId("therapy-pathway-picker-panel")).toBeVisible();
  await page.getByRole("button", { name: "Anxiety pathway" }).click();
  await expect(page.getByTestId("therapy-pathway-picker-panel")).toBeHidden();
  await expect(page).toHaveURL(/pathway=anxiety-pathway/);

  const lastStep = page.getByTestId("therapy-pathway-steps").getByRole("button", { name: "Open record" }).last();
  await expect(lastStep).toBeVisible();

  await appendPrimaryScrollSpacer(page, { heightPx: 2400, testId: "therapy-pathways-scroll-spacer" });
  for (const offset of [80, 160, 240, 320, 400, 520, 640]) {
    await scrollPrimarySurface(page, offset);
  }

  await lastStep.scrollIntoViewIfNeeded();
  const caution = page.getByTestId("therapy-pathway-caution");
  await expect(caution).toBeVisible();

  const geometry = await readCautionGeometry(page);
  expect(geometry.cautionBottom).toBeLessThanOrEqual(geometry.dockTop + 1);
});

test("desktop pathways keeps list and detail visible together", async ({ page }) => {
  await page.setViewportSize(desktopViewport);
  await gotoPathways(page);

  await expect(page.locator(".therapy-pathway-list")).toBeVisible();
  await expect(page.getByTestId("therapy-pathway-steps-desktop")).toBeVisible();
  await expect(page.getByTestId("therapy-pathway-picker")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Anxiety pathway", level: 2 })).toBeVisible();
  await expect(page.getByTestId("therapy-pathway-caution")).toBeVisible();
});
