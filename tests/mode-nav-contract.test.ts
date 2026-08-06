import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MODE_NAV_BANDS, MODE_NAV_MIN_ITEMS, planModeNavBands } from "@/components/mode-nav/mode-nav-bands";

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const modeNavSource = read("src/components/mode-nav/mode-nav.tsx");
const portalSource = read("src/components/mode-nav/mode-nav-portal.tsx");
const globalsSource = read("src/app/globals.css");
const therapyNavSource = read("src/components/therapy-compass/nav.tsx");
const workspaceSource = read("src/components/therapy-compass/workspace.tsx");

/** The slice of globals.css owned by the bar, so assertions cannot drift into other rules. */
const modeNavCss = globalsSource.slice(
  globalsSource.indexOf("@utility mode-nav"),
  globalsSource.indexOf("/* Motion keyframes"),
);

describe("ModeNav band planning", () => {
  it("shows every destination when they all fit, with no overflow entry", () => {
    for (const capacity of MODE_NAV_BANDS) {
      const plan = planModeNavBands(capacity);
      for (let index = 0; index < capacity; index += 1) {
        expect(plan.firstVisibleBand.has(index)).toBe(true);
      }
    }
    // Four destinations fit the 4- and 5-slot bands outright.
    expect(planModeNavBands(4).moreUntil).toBe(3);
    expect(planModeNavBands(3).moreUntil).toBeNull();
  });

  it("folds only the tail, so slots that stay never move", () => {
    // Therapy: Search, Compare, Recommend, Pathways.
    const plan = planModeNavBands(4);
    expect(plan.firstVisibleBand.get(0)).toBe(3); // Search — visible in every band
    expect(plan.firstVisibleBand.get(1)).toBe(3); // Compare — visible in every band
    expect(plan.firstVisibleBand.get(2)).toBe(4); // Recommend — appears at 4 slots
    expect(plan.firstVisibleBand.get(3)).toBe(4); // Pathways — appears at 4 slots

    // A wider band is always a superset of a narrower one. That is what keeps
    // muscle memory intact across a rotation: nothing is ever reordered.
    for (const [index, band] of plan.firstVisibleBand) {
      for (const capacity of MODE_NAV_BANDS) {
        if (capacity >= band) expect(plan.firstVisibleBand.get(index)).toBeLessThanOrEqual(capacity);
      }
    }
  });

  it("never plans more slots than the cap, at any item count", () => {
    for (let count = MODE_NAV_MIN_ITEMS; count <= 12; count += 1) {
      const plan = planModeNavBands(count);
      for (const capacity of MODE_NAV_BANDS) {
        const visible = [...plan.firstVisibleBand.values()].filter((band) => band <= capacity).length;
        const moreVisible = plan.moreUntil !== null && capacity <= plan.moreUntil ? 1 : 0;
        expect(visible + moreVisible).toBeLessThanOrEqual(capacity);
      }
    }
  });

  it("always offers a route to every destination", () => {
    // Anything folded must be reachable through More; nothing may be stranded.
    for (let count = MODE_NAV_MIN_ITEMS; count <= 12; count += 1) {
      const plan = planModeNavBands(count);
      const folded = count - [...plan.firstVisibleBand.keys()].length;
      if (folded > 0) expect(plan.moreUntil).not.toBeNull();
    }
  });
});

describe("ModeNav density contract", () => {
  it("chooses density by container width in rem, never px", () => {
    const thresholds = [...modeNavCss.matchAll(/@container mode-nav \(min-width: ([^)]+)\)/g)].map((m) => m[1].trim());
    // Raised from 16/26/34 by ledger #113. Those were budgeted for equal `1fr`
    // tracks and were short by roughly the count badge; the slots are now
    // content-sized, so each threshold is the measured sum of the intrinsic
    // widths it must hold, plus ~8% — enough to absorb the font-metric
    // difference between a development box and a CI runner, which is real and
    // failed a first attempt at 21/31rem by a single pixel.
    expect(thresholds).toEqual(["22rem", "33rem", "42rem"]);

    // The unit is the mechanism: raising the browser or OS text size grows the
    // root font, so a phone crosses a threshold exactly when its labels would
    // stop fitting. A px threshold would ignore the text-size request and clip
    // instead (WCAG 1.4.4 Resize Text, 1.4.10 Reflow).
    for (const threshold of thresholds) {
      expect(threshold).toMatch(/rem$/);
    }

    // The CSS bands and the TS capacities must not drift apart.
    expect(MODE_NAV_BANDS).toEqual([3, 4, 5]);
  });

  it("never measures layout at runtime", () => {
    // "Priority plus" would let the bar's contents change under the user
    // between screens and orientations.
    expect(modeNavSource).not.toMatch(/getBoundingClientRect|offsetWidth|scrollWidth|ResizeObserver|matchMedia/);
  });

  it("makes the collapsed control the default and the bar the enhancement", () => {
    // Anything unmeasured, unsupported or mid-load must render the one state
    // that cannot overflow at any width or text size.
    const baseBar = modeNavCss.match(/\.mode-nav__bar\s*\{([^}]*)\}/)?.[1] ?? "";
    const baseControl = modeNavCss.match(/\.mode-nav__control\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(baseBar).toContain("display: none");
    expect(baseControl).toContain("display: flex");
    // The bar is only ever revealed inside a container query.
    expect(modeNavCss.indexOf(".mode-nav__bar {\n    display: flex")).toBeGreaterThan(
      modeNavCss.indexOf("@container mode-nav"),
    );
  });

  it("never scrolls sideways at any density", () => {
    // A sideways-scrolling bar hides destinations people then never find — the
    // exact defect this replaced in Therapy.
    expect(modeNavCss).not.toMatch(/overflow(-x)?:\s*(auto|scroll)/);
  });

  it("sizes slots to their content, never to equal tracks", () => {
    // Ledger #113: equal `1fr` tracks make the WIDEST slot set what every slot
    // needs, and the label's `truncate` then hides the shortfall silently —
    // nothing overflows, nothing fails, the word is just gone. Measured in
    // Chromium, that clipped at every phone width. Content-sized slots cannot
    // be narrower than their own label, so the failure mode is gone rather
    // than merely retuned.
    expect(modeNavCss).not.toContain("grid-auto-columns");
    expect(modeNavCss).not.toMatch(/\.mode-nav__bar\s*\{[^}]*display:\s*grid/);

    // Exactly one bar layout, so a future edit cannot reintroduce a second one
    // that behaves differently at a band nobody re-measures.
    const barDisplays = [...modeNavCss.matchAll(/\.mode-nav__bar\s*\{([^}]*)\}/g)]
      .map((match) => match[1].match(/display:\s*([a-z]+)/)?.[1])
      .filter(Boolean);
    expect(barDisplays).toEqual(["none", "flex"]);
  });
});

describe("ModeNav header anchoring", () => {
  it("claims the shared header slot at every width without touching the header", () => {
    expect(portalSource).toContain("phoneHeaderCollapseAddonSlotId");
    // Wider than PhoneHeaderCollapsePortal's gate by design: the bar must hide
    // with the header on tablet and desktop too.
    expect(portalSource).not.toContain("matchMedia");
    expect(portalSource).not.toContain("max-width: 639px");
    // Same before-paint move and observer discipline as the phone portal.
    expect(portalSource).toContain("useLayoutEffect");
    expect(portalSource).toContain("new MutationObserver(sync)");
    // Falls back to normal flow when no host exists, so navigation is never lost.
    expect(portalSource).toContain("host ? createPortal(children, host) : children");
  });

  it("keeps the addon slot to a single page-owned header", () => {
    // DocumentViewer and the differentials detail page already claim the slot on
    // phones. Neither mode may also mount a bar there; today neither can,
    // because both have fewer than MODE_NAV_MIN_ITEMS destinations and ModeNav
    // renders nothing. This fails the moment that stops being true.
    expect(read("src/components/DocumentViewer.tsx")).toContain("PhoneHeaderCollapsePortal");
    expect(read("src/components/differentials/differential-detail-page.tsx")).toContain("PhoneHeaderCollapsePortal");
    expect(modeNavSource).toMatch(/items\.length < MODE_NAV_MIN_ITEMS\) return null/);
  });
});

describe("ModeNav item contract", () => {
  it("routes with real hrefs so deep links, back and prefetch keep working", () => {
    expect(modeNavSource).toContain("href={item.href}");
    expect(modeNavSource).not.toMatch(/onClick\?:/);
  });

  it("gives Therapy its seven destinations in declared order", () => {
    const itemIds = [...therapyNavSource.matchAll(/\bid: "([a-z-]+)"/g)].map((match) => match[1]);
    // Order is load-bearing: at three slots the survivors are the first two, so
    // the library door and the only destination carrying state are the ones
    // that stay on the bar. Everything from `home` on is reached through More
    // at every band, which is where the two long labels have to live.
    expect(itemIds).toEqual(["search", "compare", "recommend", "pathways", "home", "brief", "sheets"]);

    // Compare carries fill, not catalogue size: "3/4" is worth a glance, "205"
    // is noise on every screen.
    expect(therapyNavSource).toContain("${b.compareSlugs.length}/${MAX_COMPARE}");
  });

  it("routes the record-scoped destinations through resolved hrefs, never a handler", () => {
    // `ModeNavItem` takes an href so deep links, back and prefetch work. These
    // two resolve a slug, so the resolution has to reach the item as a value.
    expect(therapyNavSource).toContain("href: b.briefHref");
    expect(therapyNavSource).toContain("href: b.sheetHref");
    expect(therapyNavSource).not.toMatch(/onClick/);
  });

  it("names the active page rather than letting a prefix match claim it", () => {
    // Home's href is the mode base, and every Therapy route starts with it, so
    // ModeNav's own `startsWith` derivation would light Home up everywhere.
    expect(therapyNavSource).toContain("activeId={b.screen}");
  });

  it("puts every Therapy route on the shared bar", () => {
    // The pill strip is gone: no second nav, no sideways scroll, no route-local
    // portal competing for the header's addon slot.
    expect(therapyNavSource).not.toContain("TherapyCompassNav");
    expect(therapyNavSource).not.toContain("PhoneHeaderCollapsePortal");
    expect(therapyNavSource).not.toContain('data-testid="therapy-compass-section-nav"');
    expect(globalsSource).not.toContain('[data-testid="therapy-compass-section-nav"]');
    expect(workspaceSource).toContain("<TherapyModeNav />");
    expect(workspaceSource).not.toContain("TherapyCompassNav");
  });

  it("keeps the mode home free of the bar, as every mode home is", () => {
    // ModeHomeTemplate already surfaces the same destinations as tiles.
    expect(workspaceSource).toContain("{isHome ? null : <TherapyModeNav />}");
  });
});

describe("ModeNav overflow slot", () => {
  const moreSlot = modeNavSource.slice(
    modeNavSource.indexOf("plan.moreUntil !== null ? ("),
    modeNavSource.indexOf("</ul>"),
  );

  it("never borrows the active label, so the slot has one width at every route", () => {
    // The thresholds are the measured sum of the slots' intrinsic widths. At
    // the 22rem band the More slot's whole budget is ~107px, of which its box,
    // icon, gap and chevron take ~71px — a ~36px label allowance. Therapy's
    // "Brief Intervention" wants ~213px. Borrowing is not affordable at any
    // label length worth having, and widening the bands would cost every mode.
    // Scoped to the rendered ink, which is what has a width — the accessible
    // name below may and does carry the folded page's label.
    const slotInk = moreSlot.match(/<SlotInk[^/]*\/>/)?.[0] ?? "";
    expect(slotInk).toContain('label="More"');
    expect(slotInk).toContain('state="off"');
    expect(slotInk).not.toContain("active");
    expect(slotInk).not.toContain("icon");
  });

  it("lets CSS decide whether More is carrying the current page", () => {
    // The component knows which band would reveal the item; only the container
    // query knows the band. Deciding in the component alone can only ask "does
    // this item have a band at all", which is silent for every page whose band
    // the current width has not reached — five of Therapy's seven on a phone.
    expect(modeNavSource).toContain("data-active-from={activeFrom}");
    expect(modeNavSource).toContain('activeBand ?? "none"');
    expect(modeNavSource).not.toContain("moreHoldsActive");

    // Off by default; on only while the page has no visible slot of its own.
    expect(modeNavCss).toMatch(/\.mode-nav__more\[data-active-from\]\s*\.mode-nav__rule/);
    for (const band of ["3", "4", "5"]) {
      expect(modeNavCss).toContain(`.mode-nav__more[data-active-from="${band}"] .mode-nav__rule`);
    }
    // Band 4 turns off at 33rem and band 5 at 42rem — the same widths that
    // reveal those slots — so nothing is ever marked twice.
    const at33 = modeNavCss.slice(modeNavCss.indexOf("@container mode-nav (min-width: 33rem)"));
    expect(at33).toContain('.mode-nav__more[data-active-from="4"] .mode-nav__rule');
    const at42 = modeNavCss.slice(modeNavCss.indexOf("@container mode-nav (min-width: 42rem)"));
    expect(at42).toContain('.mode-nav__more[data-active-from="5"] .mode-nav__rule');
  });

  it("names the carried page to assistive technology at exactly those widths", () => {
    // Composed into the accessible name, not an aria-label, so `display: none`
    // can take it out of the accessibility tree per band. Visible "More" stays
    // the name's prefix (WCAG 2.5.3).
    expect(moreSlot).toContain('className="mode-nav__more-name sr-only"');
    expect(moreSlot).toContain(", current page: {active.label}");
    expect(moreSlot).not.toMatch(/aria-label=/);
    expect(modeNavCss).toMatch(/\.mode-nav__more-name\s*\{\s*display:\s*none/);
    expect(modeNavCss).toContain(".mode-nav__more[data-active-from] .mode-nav__more-name");
  });
});

describe("ModeNav centring", () => {
  it("measures the centred column, never the full-bleed rail", () => {
    // A container query on the rail would report the viewport width while the
    // slots have the capped column — density decided against a width that does
    // not exist. The container also carries no padding of its own, so its
    // inline-size is unambiguous.
    const containerRules = [...modeNavCss.matchAll(/container-type:\s*inline-size/g)];
    expect(containerRules).toHaveLength(1);
    const utilityBody = modeNavCss.match(/@utility mode-nav\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(utilityBody).toContain("container-type: inline-size");
    expect(utilityBody).toContain("margin-inline: auto");
    // 80rem is the header row's own max-w-7xl; the ink offset is added back on
    // both sides so the first tab's INK lands on the header's content edge.
    expect(utilityBody).toContain("max-width: calc(80rem + 2 * var(--mode-nav-ink-offset))");
    expect(modeNavCss).not.toMatch(/\.mode-nav-rail\s*\{[^}]*container-type/);
  });

  it("takes its gutter from the header token, minus the bar's own ink offset", () => {
    // A literal here is how the bar and the header drift apart — the same
    // reason `.edge-glass-header` reads the token. Subtracting the ink offset
    // is what keeps the container width, and so the calibrated bands,
    // unchanged below `lg` where the two gutters already agree.
    expect(modeNavCss).toContain("var(--header-edge-pad)");
    expect(modeNavCss).toContain("var(--mode-nav-ink-offset)");
    expect(globalsSource).toContain("--mode-nav-ink-offset: 1rem;");
  });
});
