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
    expect(thresholds).toEqual(["16rem", "26rem", "34rem"]);

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
    expect(modeNavCss.indexOf(".mode-nav__bar {\n    display: grid")).toBeGreaterThan(
      modeNavCss.indexOf("@container mode-nav"),
    );
  });

  it("never scrolls sideways at any density", () => {
    // A sideways-scrolling bar hides destinations people then never find — the
    // exact defect this replaced in Therapy.
    expect(modeNavCss).not.toMatch(/overflow(-x)?:\s*(auto|scroll)/);
  });

  it("distributes phone slots as equal columns", () => {
    // Equal columns make the outer margins and inter-slot gaps identical by
    // construction, rather than by hand-tuned padding that drifts.
    expect(modeNavCss).toContain("grid-auto-columns: 1fr");
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

  it("gives Therapy four destinations in declared order and no record-scoped artifacts", () => {
    const itemIds = [...therapyNavSource.matchAll(/\bid: "([a-z-]+)"/g)].map((match) => match[1]);
    // Order is load-bearing: at three slots the survivors are the first two.
    expect(itemIds).toEqual(["search", "compare", "recommend", "pathways"]);

    // Compare carries fill, not catalogue size: "3/4" is worth a glance, "205"
    // is noise on every screen.
    expect(therapyNavSource).toContain("${b.compareSlugs.length}/${MAX_COMPARE}");
  });

  it("keeps the old strip for every Therapy route except search", () => {
    // The rollout is reversible by one line, and the pill strip still ships on
    // compare / recommend / pathways / detail.
    expect(therapyNavSource).toContain("PhoneHeaderCollapsePortal");
    expect(therapyNavSource).toContain('data-testid="therapy-compass-section-nav"');
    expect(workspaceSource).toContain("b.isSearch ? <TherapyModeNav /> : <TherapyCompassNav />");
  });
});
