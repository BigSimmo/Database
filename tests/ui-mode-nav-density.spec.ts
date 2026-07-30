import { expect, test, type Page } from "playwright/test";

/**
 * `ModeNav` promises that a slot shows its real word or folds into More — it
 * never abbreviates. Ledger #113: that promise was broken at every phone width
 * because the lower bands used equal `1fr` tracks, so the widest slot set what
 * every slot got and the label's `truncate` hid the shortfall. Nothing
 * overflowed and nothing failed; the word was simply gone.
 *
 * A static `rem` threshold cannot prove fit for an arbitrary item list, and
 * `ModeNav` is shared — Therapy is only its first consumer. So the contract is
 * held here instead: at each band boundary every rendered label must be fully
 * visible. A mode whose labels are longer than the thresholds allow fails this
 * spec rather than shipping clipped words.
 *
 * Widths are the boundaries themselves (22rem = 352px, 33rem = 528px) and one
 * pixel either side, because a threshold that is one slot too generous only
 * misbehaves in the first pixels above it. That makes this the most valuable
 * place to assert and the least forgiving: the same labels rasterise wider on a
 * CI runner than on a development box, so the thresholds carry ~8% headroom
 * rather than the pixel or two a single machine's measurements would suggest.
 */

const BAND_3_PX = 352; // 22rem — first two destinations + More
const BAND_4_PX = 528; // 33rem — all four destinations

/**
 * The nav as it is actually anchored, not as it is momentarily served.
 *
 * Two things make a bare `getByTestId("mode-nav")` wrong here. Next streams the
 * server-rendered copy while the client tree hydrates, so the id can resolve to
 * two elements and Playwright fails on strict mode (ledger #093). And the
 * density decision is a CONTAINER query: it only means anything once the bar is
 * inside the container it will live in, because `ModeNavHeaderPortal` resolves
 * its host in a layout effect and renders in page flow until then — a different
 * width from the header slot. Scoping to the collapse host solves both: it
 * names exactly one element, and it is the one the user sees.
 */
const anchoredNav = '[data-testid="universal-header-collapse"] [data-testid="mode-nav"]';

async function gotoTherapySearch(page: Page) {
  await page.goto("/therapy-compass/search?q=CBT&run=1", { waitUntil: "domcontentloaded" });
  await expect(page.locator(anchoredNav)).toBeVisible({ timeout: 20_000 });
}

type NavState = {
  state: "bar" | "collapsed" | "none";
  labels: { text: string; clipped: boolean; scrollWidth: number; clientWidth: number }[];
  barOverflows: boolean;
};

async function readNav(page: Page): Promise<NavState> {
  return page.evaluate((selector) => {
    const nav = document.querySelector(selector);
    const bar = nav?.querySelector(".mode-nav__bar") ?? null;
    const control = nav?.querySelector(".mode-nav__control") ?? null;
    const shown = (node: Element | null) => Boolean(node) && getComputedStyle(node!).display !== "none";

    const labels: NavState["labels"] = [];
    if (shown(bar)) {
      for (const slot of bar!.querySelectorAll("li")) {
        if (getComputedStyle(slot).display === "none") continue;
        const label = slot.querySelector("span.truncate");
        if (!(label instanceof HTMLElement)) continue;
        labels.push({
          text: label.textContent ?? "",
          // A truncated label reports more content than it can show. The 0.5px
          // slack absorbs sub-pixel text metrics, not a missing character.
          clipped: label.scrollWidth > label.clientWidth + 0.5,
          scrollWidth: label.scrollWidth,
          clientWidth: label.clientWidth,
        });
      }
    }
    return {
      state: shown(bar) ? "bar" : shown(control) ? "collapsed" : "none",
      labels,
      barOverflows: bar instanceof HTMLElement ? bar.scrollWidth > bar.clientWidth + 1 : false,
    };
  }, anchoredNav);
}

function expectNoClippedLabels(nav: NavState, where: string) {
  const clipped = nav.labels.filter((label) => label.clipped);
  expect(
    clipped,
    `${where}: ${clipped.map((l) => `"${l.text}" needs ${l.scrollWidth}px, has ${l.clientWidth}px`).join("; ")}`,
  ).toEqual([]);
  // Fitting by overflowing sideways is not fitting. A bar wider than its
  // container hides destinations behind an edge people never scroll to.
  expect(nav.barOverflows, `${where}: the bar overflows its container`).toBe(false);
}

test.describe("ModeNav density", () => {
  for (const { width, expected, slots } of [
    { width: BAND_3_PX - 1, expected: "collapsed" as const, slots: 0 },
    { width: BAND_3_PX, expected: "bar" as const, slots: 3 },
    { width: BAND_3_PX + 1, expected: "bar" as const, slots: 3 },
    { width: BAND_4_PX - 1, expected: "bar" as const, slots: 3 },
    { width: BAND_4_PX, expected: "bar" as const, slots: 4 },
    { width: BAND_4_PX + 1, expected: "bar" as const, slots: 4 },
  ]) {
    test(`shows every label in full at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoTherapySearch(page);

      // Poll the density itself rather than asserting one sample: the band is
      // re-evaluated as the header settles, and a single early read is a coin
      // flip. A band that never arrives still fails, on the timeout.
      await expect.poll(async () => (await readNav(page)).state, { timeout: 10_000 }).toBe(expected);

      const nav = await readNav(page);
      expect(nav.labels).toHaveLength(slots);
      expectNoClippedLabels(nav, `${width}px`);
    });
  }

  test("falls back to the collapsed control rather than clipping at 200% text", async ({ page }) => {
    // The `rem` unit is the whole mechanism the density bands rest on: raising
    // the browser or OS text size grows the root font, so the container
    // measures FEWER rem and the bar steps down exactly when its labels would
    // stop fitting (WCAG 1.4.4 Resize Text, 1.4.10 Reflow). A px threshold
    // would ignore the request and clip. The style has to land before the
    // container query is evaluated, hence document_start rather than a later
    // addStyleTag.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = "html { font-size: 32px !important; }";
        document.head.appendChild(style);
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoTherapySearch(page);

    // 390px at a 32px root is 12.19rem — below the 22rem bar band.
    await expect.poll(async () => (await readNav(page)).state, { timeout: 10_000 }).toBe("collapsed");

    const nav = await readNav(page);
    expectNoClippedLabels(nav, "390px at 200% text");
    // The page itself must not gain a sideways scrollbar from the reflow.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
    ).toBe(false);
  });
});
