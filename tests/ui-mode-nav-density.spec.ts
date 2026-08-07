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

const BAND_3_PX = 352; // 22rem — two destinations + More
const BAND_4_PX = 528; // 33rem — three destinations + More
const BAND_5_PX = 672; // 42rem — four destinations + More

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

async function gotoTherapy(page: Page, route = "/therapy-compass/search?q=CBT&run=1") {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator(anchoredNav)).toBeVisible({ timeout: 20_000 });
}

const gotoTherapySearch = (page: Page) => gotoTherapy(page);

/**
 * Every mode that renders the bar, with the destination count that sets its
 * density.
 *
 * Therapy was the only consumer when this spec was written, so every route it
 * drove was `/therapy-compass/*` — and the promise in the header, that a mode
 * whose labels outgrow the thresholds fails here rather than shipping clipped
 * words, held for exactly one mode. The four registry-driven modes have short
 * labels and would have passed silently either way, which is precisely why the
 * gap survives until a mode with long ones adopts.
 *
 * `items` is pinned against the registry by `tests/mode-nav-contract.test.ts`,
 * so adopting a mode or adding a destination without coming back here fails
 * offline rather than leaving a mode uncovered.
 */
const MODES = [
  { modeId: "therapy-compass", route: "/therapy-compass/search?q=CBT&run=1", items: 7 },
  { modeId: "dsm", route: "/dsm/compare", items: 2 },
  { modeId: "specifiers", route: "/specifiers/compare", items: 4 },
  { modeId: "formulation", route: "/formulation/compare", items: 4 },
  { modeId: "differentials", route: "/differentials/diagnoses", items: 3 },
  { modeId: "factsheets", route: "/factsheets/search", items: 2 },
];

/**
 * A band of capacity C shows `min(items, C)` slots: every destination when they
 * fit, otherwise C-1 of them plus More. Derived rather than tabulated so a mode
 * with a different count needs no second table to keep in step.
 */
const slotsAt = (items: number, capacity: number) => Math.min(items, capacity);

/**
 * A route whose destination is permanently in the overflow.
 *
 * Therapy ships seven destinations and the bands cap at five slots, so Brief
 * Intervention never gets one — which fires `moreHoldsActive`, the branch that
 * decides what the More slot renders when the current page has folded. If it
 * ever borrows the folded label, this is the route where "Brief Intervention"
 * lands beside Search and Compare in a 352px bar and the arithmetic stops
 * working (~430px of content, 352px of space).
 */
const FOLDED_ACTIVE_ROUTE = "/therapy-compass/acceptance-and-commitment-therapy-act/brief";

/**
 * The other permanently-folded destination. Both record-scoped pages reach the
 * More slot by the same route through `data-active-from="none"`, but they are
 * separate items with separate labels — and "Patient Sheets" is the second
 * longest label in the set, so it is the one that would expose a regression
 * where the slot sizes to its content after all.
 */
const FOLDED_SHEET_ROUTE = "/therapy-compass/acceptance-and-commitment-therapy-act/sheet";

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
  for (const { modeId, route, items } of MODES) {
    for (const { width, expected, capacity } of [
      { width: BAND_3_PX - 1, expected: "collapsed" as const, capacity: 0 },
      { width: BAND_3_PX, expected: "bar" as const, capacity: 3 },
      { width: BAND_3_PX + 1, expected: "bar" as const, capacity: 3 },
      { width: BAND_4_PX - 1, expected: "bar" as const, capacity: 3 },
      { width: BAND_4_PX, expected: "bar" as const, capacity: 4 },
      { width: BAND_4_PX + 1, expected: "bar" as const, capacity: 4 },
      { width: BAND_5_PX, expected: "bar" as const, capacity: 5 },
    ]) {
      test(`shows every ${modeId} label in full at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await gotoTherapy(page, route);

        // Poll the density itself rather than asserting one sample: the band is
        // re-evaluated as the header settles, and a single early read is a coin
        // flip. A band that never arrives still fails, on the timeout.
        await expect.poll(async () => (await readNav(page)).state, { timeout: 10_000 }).toBe(expected);

        const nav = await readNav(page);
        expect(nav.labels).toHaveLength(slotsAt(items, capacity));
        expectNoClippedLabels(nav, `${modeId} at ${width}px`);
      });
    }
  }

  /**
   * The folded-active branch, on a mode that is not Therapy.
   *
   * Specifiers and Formulation carry four destinations, so at the 22rem band
   * two of them fold and the More slot has to carry the current page's rule.
   * That is the branch ledger #113's fix turned into a container-query decision
   * (invariant I5), and until these modes adopted, no route outside Therapy
   * exercised it. `map` is the last item, so it is folded at this band and only
   * this band.
   */
  for (const [modeId, route] of [
    ["specifiers", "/specifiers/map"],
    ["formulation", "/formulation/map"],
  ] as const) {
    test(`marks a folded ${modeId} page through the overflow slot at ${BAND_3_PX}px`, async ({ page }) => {
      await page.setViewportSize({ width: BAND_3_PX, height: 900 });
      await gotoTherapy(page, route);

      await expect.poll(async () => (await readNav(page)).state, { timeout: 10_000 }).toBe("bar");

      const nav = await readNav(page);
      expectNoClippedLabels(nav, `${modeId} folded at ${BAND_3_PX}px`);
      // The slot keeps its own word — borrowing "Map" is what the band budget
      // cannot pay for at any label length worth having.
      expect(nav.labels.at(-1)?.text).toBe("More");
      expect(nav.labels.map((slot) => slot.text)).not.toContain("Map");

      const marked = await page.evaluate((selector) => {
        const onScreen = (node: Element) => {
          const slot = node.closest("li");
          return Boolean(slot) && getComputedStyle(slot!).display !== "none";
        };
        const painted = (node: Element) => {
          const value = getComputedStyle(node).backgroundColor;
          return value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
        };
        const bar = document.querySelector(`${selector} .mode-nav__bar`);
        const rules = [...(bar?.querySelectorAll(".mode-nav__rule") ?? [])].filter(
          (rule) => onScreen(rule) && painted(rule),
        );
        const names = [...(bar?.querySelectorAll(".mode-nav__more-name") ?? [])].filter(
          (name) => getComputedStyle(name).display !== "none",
        );
        return { rules: rules.length, names: names.map((name) => name.textContent ?? "") };
      }, anchoredNav);

      // Exactly one mark at any width: never zero, never both.
      expect(marked.rules, `${route}: painted rules`).toBe(1);
      expect(marked.names, `${route}: announced name`).toEqual([", current page: Map"]);
    });
  }

  for (const width of [BAND_3_PX, BAND_4_PX, BAND_5_PX]) {
    for (const [route, label] of [
      [FOLDED_ACTIVE_ROUTE, "Brief Intervention"],
      [FOLDED_SHEET_ROUTE, "Patient Sheets"],
    ] as const) {
      test(`keeps the overflow slot at one width on ${label} (${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await gotoTherapy(page, route);

        await expect.poll(async () => (await readNav(page)).state, { timeout: 10_000 }).toBe("bar");

        const nav = await readNav(page);
        expectNoClippedLabels(nav, `${width}px on ${label}`);
        // The last slot is the overflow control, and its word does not change
        // with the route. Borrowing the folded page's label is what the band
        // budget cannot pay for; the rule and the off-screen name carry the
        // signal instead, and neither has a width.
        expect(nav.labels.at(-1)?.text).toBe("More");
        expect(nav.labels.map((slot) => slot.text)).not.toContain(label);
      });
    }
  }

  /**
   * Every Therapy destination, at every band, must say where you are.
   *
   * `search`/`compare` always have their own slot, `recommend` appears at 33rem
   * and `pathways` at 42rem, and `brief` never does — so the mark moves between
   * the page's own tab and the More slot as the container narrows. A component
   * that decides this alone can only see "has a band at all", which leaves five
   * of the seven pages showing nothing on a phone. Exactly one of the two must
   * be marked at any width: never zero, never both.
   */
  for (const width of [BAND_3_PX, BAND_4_PX, BAND_5_PX]) {
    test(`marks the current page exactly once at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const [route, label] of [
        ["/therapy-compass/search?q=CBT&run=1", "Search"],
        ["/therapy-compass/compare", "Compare"],
        ["/therapy-compass/recommend", "Recommend"],
        ["/therapy-compass/pathways", "Pathways"],
        [FOLDED_ACTIVE_ROUTE, "Brief Intervention"],
        [FOLDED_SHEET_ROUTE, "Patient Sheets"],
      ] as const) {
        await gotoTherapy(page, route);
        await expect.poll(async () => (await readNav(page)).state, { timeout: 10_000 }).toBe("bar");

        const marked = await page.evaluate((selector) => {
          const accent = getComputedStyle(document.documentElement).getPropertyValue("--clinical-accent").trim();
          const onScreen = (node: Element) => {
            const slot = node.closest("li");
            return Boolean(slot) && getComputedStyle(slot!).display !== "none";
          };
          const painted = (node: Element) => {
            const value = getComputedStyle(node).backgroundColor;
            return value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
          };
          const bar = document.querySelector(`${selector} .mode-nav__bar`);
          const rules = [...(bar?.querySelectorAll(".mode-nav__rule") ?? [])].filter(
            (rule) => onScreen(rule) && painted(rule),
          );
          const names = [...(bar?.querySelectorAll(".mode-nav__more-name") ?? [])].filter(
            (name) => getComputedStyle(name).display !== "none",
          );
          return { accent, rules: rules.length, names: names.map((name) => name.textContent ?? "") };
        }, anchoredNav);

        expect(marked.rules, `${route} at ${width}px: painted rules`).toBe(1);
        // And the announced name agrees: present only while More is carrying it.
        expect(marked.names.length, `${route} at ${width}px: announced names`).toBeLessThanOrEqual(1);
        if (marked.names.length === 1) {
          expect(marked.names[0], `${route} at ${width}px`).toBe(`, current page: ${label}`);
        }
      }
    });
  }

  test("puts the first tab's ink on the header's content edge from tablet up", async ({ page }) => {
    // The bar is full-bleed so its rule spans the viewport, but its slots ride
    // the same centred max-w-7xl column as the header row. Without that the
    // first tab sits at the viewport edge while the mode pill above it is
    // centred — the desktop defect this pairing fixes.
    for (const width of [1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoTherapySearch(page);

      await expect.poll(async () => (await readNav(page)).state, { timeout: 10_000 }).toBe("bar");

      const offsets = await page.evaluate((selector) => {
        // The SlotInk wrapper, not the label span: the ink starts at the icon.
        const ink = document.querySelector(`${selector} .mode-nav__bar li:not(.hidden) > a > span`);
        // The header's own centred row, whose left content edge the ink meets.
        const headerRow = document.querySelector("#search .max-w-7xl");
        if (!(ink instanceof HTMLElement) || !(headerRow instanceof HTMLElement)) return null;
        return { ink: ink.getBoundingClientRect().left, header: headerRow.getBoundingClientRect().left };
      }, anchoredNav);

      expect(offsets, `${width}px: could not resolve both edges`).not.toBeNull();
      // 1px of slack for sub-pixel centring of an odd-width column.
      expect(
        Math.abs(offsets!.ink - offsets!.header),
        `${width}px: tab ink vs header content edge`,
      ).toBeLessThanOrEqual(1);

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
        `${width}px: page scrolls sideways`,
      ).toBe(false);
    }
  });

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
