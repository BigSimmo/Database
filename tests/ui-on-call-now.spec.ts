import { expect, test, type Page } from "playwright/test";

import { visibleByTestId } from "./playwright-settlement";

/**
 * Now (the On Call mode home) and Who's on, in a browser, on the demo
 * handbook (`src/lib/on-call/service-demo.ts`: "Demonstration Hospital", the
 * synthetic short code 55 and 9000 00xx placeholders only).
 *
 * The DOM tests (`tests/on-call-now.dom.test.tsx`) prove the order and the
 * rules. This proves what jsdom cannot: real heights (the 48px floor), and the
 * dark theme's rule that nothing bright is taller than a 48px control.
 */

const WIDTH = 390;
const HEIGHT = 844;
const TAP_FLOOR = 48;

async function openNow(page: Page, colorScheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme });
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.addInitScript((theme) => window.localStorage.setItem("clinical-kb-theme", theme), colorScheme);
  await page.goto("/on-call", { waitUntil: "domcontentloaded" });
  // The `(search-app)` group streams through a Suspense boundary, which parks a
  // hidden second copy of the page until its reveal; wait for one copy.
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 20_000 });
  await expect(visibleByTestId(page, "on-call-now-emergency")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("html")).toHaveClass(colorScheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`Now (${colorScheme})`, () => {
    test("leads with the hospital, then its emergency route, then Right now", async ({ page }) => {
      await openNow(page, colorScheme);
      await expect(visibleByTestId(page, "on-call-now-hospital")).toContainText("Demonstration Hospital");
      const emergency = visibleByTestId(page, "on-call-now-emergency");
      await expect(emergency).toContainText("55");
      await expect(emergency).toContainText("From a hospital phone");
      await expect(emergency.getByRole("link", { name: /from a mobile/i })).toHaveAttribute("href", /^tel:/);
      const tops = await Promise.all(
        ["on-call-now-hospital", "on-call-now-emergency", "on-call-now-right-now", "on-call-now-footer"].map(
          async (id) => (await visibleByTestId(page, id).boundingBox())?.y ?? Number.NaN,
        ),
      );
      expect(tops).toEqual([...tops].sort((a, b) => a - b));
    });

    test("has no search box and no ask box on the page", async ({ page }) => {
      await openNow(page, colorScheme);
      const main = visibleByTestId(page, "on-call-home-main");
      await expect(main.getByRole("searchbox")).toHaveCount(0);
      await expect(main.getByRole("textbox")).toHaveCount(0);
    });

    test("opens the shift lists sheet with the shift pick", async ({ page }) => {
      // The demo roster (`demoOnCallShifts`) is on shift 08:00–17:00 Perth today,
      // and a live rostered shift replaces the one-tap pick. Pin the browser to
      // 20:00 Perth today, between demo shifts, so the pick shows at any hour.
      const perthToday = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await page.clock.setFixedTime(new Date(`${perthToday}T20:00:00+08:00`));
      await openNow(page, colorScheme);
      await visibleByTestId(page, "on-call-now-checklists").click();
      const sheet = visibleByTestId(page, "on-call-now-checklists-sheet");
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole("radio", { name: "Night" })).toBeVisible();
      await expect(sheet.getByTestId("on-call-now-checklist-start")).toBeVisible();
    });

    test("gives every link and button on Now a 48px target", async ({ page }) => {
      await openNow(page, colorScheme);
      const short = await page.evaluate((floor) => {
        const controls = document.querySelectorAll<HTMLElement>(
          '[data-testid^="on-call-now-"] a, [data-testid^="on-call-now-"] button, [data-testid="on-call-home-recent"] a, [data-testid="on-call-home-recent"] button',
        );
        return Array.from(controls)
          .filter((node) => node.offsetParent !== null)
          .map((node) => ({
            label: node.getAttribute("aria-label") ?? node.textContent?.trim() ?? "",
            height: node.getBoundingClientRect().height,
          }))
          .filter((control) => control.height + 0.5 < floor);
      }, TAP_FLOOR);
      expect(short).toEqual([]);
    });

    if (colorScheme === "dark") {
      test("draws nothing bright taller than a 48px control", async ({ page }) => {
        await openNow(page, colorScheme);
        const bright = await page.evaluate((floor) => {
          const main = document.querySelector('[data-testid="on-call-home-main"]');
          if (!main) return ["no main"];
          const luminance = (colour: string) => {
            const match = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(colour);
            if (!match || (match[4] !== undefined && Number(match[4]) < 0.5)) return 0;
            const [r, g, b] = [match[1], match[2], match[3]].map((value) => {
              const channel = Number(value) / 255;
              return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          return Array.from(main.querySelectorAll<HTMLElement>("*"))
            .filter((node) => node.offsetParent !== null)
            .filter((node) => luminance(getComputedStyle(node).backgroundColor) > 0.8)
            .filter((node) => node.getBoundingClientRect().height > floor + 0.5)
            .map((node) => node.getAttribute("data-testid") ?? node.className.toString().slice(0, 60));
        }, TAP_FLOOR);
        expect(bright).toEqual([]);
      });
    }
  });
}

test("Who's on answers by URL while the flag hides it, under the hospital's name", async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.goto("/on-call/whos-on", { waitUntil: "domcontentloaded" });
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 20_000 });
  await expect(visibleByTestId(page, "on-call-hub-hospital")).toContainText("Demonstration Hospital", {
    timeout: 20_000,
  });
  await expect(visibleByTestId(page, "on-call-whos-on-team-Medicine")).toContainText("Registrar on call");
  await expect(page.getByText(/being built|being set up/i)).toHaveCount(0);
});
