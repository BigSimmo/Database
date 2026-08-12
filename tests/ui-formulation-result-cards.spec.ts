import { expect, test, type Page } from "playwright/test";
import { stubZeroTouchPoints } from "./helpers/zero-touch";

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
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
  await stubZeroTouchPoints({ page });
});

test("separates mechanism cards and keeps the primary action in the card footer", async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await gotoApp(page, "/formulation?q=What+if+something+goes+wrong&run=1");

    const cards = page.locator("[data-formulation-result-card]");
    const topMatch = page.getByTestId("formulation-top-match");
    const actionFooter = topMatch.locator("[data-formulation-card-action]");
    const action = actionFooter.getByRole("link", { name: "Open Worry" });

    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(1);
    await expect(action).toBeVisible();

    const geometry = await topMatch.evaluate((card) => {
      const detailsElement = card.querySelector<HTMLElement>("[data-formulation-card-details]");
      const footerElement = card.querySelector<HTMLElement>("[data-formulation-card-action]");
      const actionElement = footerElement?.querySelector<HTMLElement>("a");
      const accentElement = card.querySelector<HTMLElement>("[data-formulation-card-accent]");
      const nextCard = card.nextElementSibling as HTMLElement | null;
      if (!detailsElement || !footerElement || !actionElement || !accentElement || !nextCard) {
        throw new Error("Expected complete formulation result-card structure");
      }

      const cardRect = card.getBoundingClientRect();
      const detailsRect = detailsElement.getBoundingClientRect();
      const footerRect = footerElement.getBoundingClientRect();
      const actionRect = actionElement.getBoundingClientRect();
      const nextCardRect = nextCard.getBoundingClientRect();
      const cardStyle = getComputedStyle(card);
      const accentStyle = getComputedStyle(accentElement);

      return {
        actionHeight: actionRect.height,
        actionWidth: actionRect.width,
        accentBackground: accentStyle.backgroundColor,
        cardBottom: cardRect.bottom,
        cardRadius: Number.parseFloat(cardStyle.borderRadius),
        cardShadow: cardStyle.boxShadow,
        cardWidth: cardRect.width,
        detailsBottom: detailsRect.bottom,
        footerBottom: footerRect.bottom,
        footerTop: footerRect.top,
        nextCardGap: nextCardRect.top - cardRect.bottom,
      };
    });

    expect(geometry.detailsBottom).toBeLessThanOrEqual(geometry.footerTop + 1);
    expect(Math.abs(geometry.cardBottom - geometry.footerBottom)).toBeLessThanOrEqual(1);
    expect(geometry.actionHeight).toBeGreaterThanOrEqual(47);
    expect(geometry.cardRadius).toBeGreaterThanOrEqual(12);
    expect(geometry.cardShadow).not.toBe("none");
    expect(geometry.accentBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(geometry.nextCardGap).toBeGreaterThanOrEqual(16);
    if (viewport.width === 320) {
      expect(geometry.actionWidth).toBeGreaterThanOrEqual(geometry.cardWidth - 40);
    } else {
      expect(geometry.actionWidth).toBeLessThan(geometry.cardWidth / 2);
    }

    await action.focus();
    await expect(action).toBeFocused();
    await expectNoHorizontalOverflow(page);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect
      .poll(() => topMatch.evaluate((card) => Number.parseFloat(getComputedStyle(card).transitionDuration)))
      .toBeLessThanOrEqual(0.001);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }

  await page.emulateMedia({ forcedColors: "active" });
  const forcedColorsAction = page
    .getByTestId("formulation-top-match")
    .locator("[data-formulation-card-action]")
    .getByRole("link", { name: "Open Worry" });
  await expect(forcedColorsAction).toBeVisible();
  await forcedColorsAction.focus();
  await expect(forcedColorsAction).toBeFocused();
});
