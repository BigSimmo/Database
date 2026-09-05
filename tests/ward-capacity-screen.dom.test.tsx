import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import {
  bedKindGaps,
  bedKindTotals,
  networkTotals,
  freeingCellText,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases, wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * MERGE 02 — the ward-confirmed capacity view and the morning bed-state board become one screen
 * answering one question: where is a bed KIND short across the network?
 *
 * ⚠️ Every expected value below comes from calling the same derivation functions the screen itself
 * calls (`bedKindGaps`, `bedKindTotals`, `networkWardRows`, `networkTotals`), against the real
 * fixture — never a hand-written number. A hand-written expectation is the thing that goes stale
 * the day the fixture changes, and it goes stale by passing.
 */
const NOW = NOW_ANCHOR;
const units = allUnits();
const gapRows = bedKindGaps(wardMovements, units, NOW);
const gapTotals = bedKindTotals(gapRows);
// ⚠️ THE SAME ARGUMENTS THE SCREEN USES, INCLUDING `bedReleases`. This read `networkWardRows(units,
// NOW)` and the screen read `(units, now, bedReleases)` — so the expectation and the render
// disagreed about whether a freeing figure exists at all, and two tests failed while both sides were
// individually correct. A test that calls the production function with DIFFERENT arguments from the
// caller is testing a configuration nothing ships.
const networkRows = networkWardRows(units, NOW, bedReleases);
const netTotals = networkTotals(networkRows);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

describe("the Capacity screen", () => {
  it("has a non-empty population to render, or every assertion below is vacuous", () => {
    expect(gapRows.length).toBe(4);
    expect(networkRows.length).toBeGreaterThan(0);
    expect(netTotals.beds).toBeGreaterThan(0);
  });

  it("has the page shell — a rail, a main landmark and an <h1> — like every other Ward Flow screen", () => {
    // ⚠️ `DelaysScreen` shipped without this once (see its own doc comment) and no component test
    // caught it, because a component test cannot see a missing page shell — the shell is exactly
    // what it does not render. This screen's shell is asserted from the start rather than added
    // after the fact.
    renderScreen();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Capacity" })).toBeInTheDocument();
  });

  it("shows the ready-bed split as a bar whose numbers are the real locked/open sums, never invented", () => {
    const totalLocked = networkRows.reduce((sum, row) => sum + row.lockedReady, 0);
    const totalReady = netTotals.ready;
    expect(totalReady, "no ready bed in the fixture — this guard proved nothing").toBeGreaterThan(0);
    renderScreen();
    // WardBar's accessible name names every segment and its count — `\\b`, not `\b`: in a template
    // literal `\b` is a literal backspace byte, not a regex word boundary, and it can never match.
    expect(
      screen.getByRole("img", { name: new RegExp(`Locked ready ${totalLocked}\\b.*Open ready`, "su") }),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${totalReady} of ${netTotals.beds} beds\\b`, "u"))).toBeInTheDocument();
  });

  it("renders exactly the four bed-kind rows the derivations return, each with its own real waiting and beds-that-fit", () => {
    renderScreen();
    const table = screen.getByTestId("ward-capacity-gap-table");
    for (const row of gapRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-gap-row-${row.id}`);
      expect(tableRow, `row ${row.id}`).toHaveTextContent(row.need);
      expect(within(tableRow).getByTestId("ward-capacity-waiting")).toHaveTextContent(String(row.waiting));
      expect(within(tableRow).getByTestId("ward-capacity-beds-that-fit")).toHaveTextContent(String(row.bedsThatFit));
    }
  });

  /**
   * ⚠️ THE ONE THING THE DESIGN LOCK NAMES BY SECTION NUMBER (§5.1): a negative gap must read as a
   * shortfall in words, never only as a minus sign or a tinted number.
   */
  it("labels every negative gap a shortfall in words, not only as a signed number", () => {
    const shortfallRows = gapRows.filter((row) => row.gap < 0);
    expect(shortfallRows.length, "the fixture has no shortfall row — this guard proved nothing").toBeGreaterThan(0);
    renderScreen();
    const table = screen.getByTestId("ward-capacity-gap-table");
    for (const row of shortfallRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-gap-row-${row.id}`);
      expect(within(tableRow).getByText(/shortfall/iu)).toBeInTheDocument();
      // The magnitude is real too — not just the word.
      expect(tableRow).toHaveTextContent(`${Math.abs(row.gap)} short`);
    }
  });

  it("shows a non-negative gap as 'exactly enough' or 'spare capacity' in words, never only the word 'shortfall'", () => {
    const nonNegativeRows = gapRows.filter((row) => row.gap >= 0);
    expect(nonNegativeRows.length, "the fixture has no non-negative row — this guard proved nothing").toBeGreaterThan(
      0,
    );
    renderScreen();
    const table = screen.getByTestId("ward-capacity-gap-table");
    for (const row of nonNegativeRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-gap-row-${row.id}`);
      expect(within(tableRow).queryByText(/shortfall/iu)).toBeNull();
      expect(within(tableRow).getByText(row.gap === 0 ? /exactly enough/iu : /spare capacity/iu)).toBeInTheDocument();
    }
  });

  it("shows the 'all four together' total row, matching bedKindTotals exactly", () => {
    renderScreen();
    const totalRow = screen.getByTestId("ward-capacity-gap-total");
    expect(within(totalRow).getByTestId("ward-capacity-waiting")).toHaveTextContent(String(gapTotals.waiting));
    expect(within(totalRow).getByTestId("ward-capacity-beds-that-fit")).toHaveTextContent(
      String(gapTotals.bedsThatFit),
    );
    expect(totalRow).toHaveTextContent(
      gapTotals.gap < 0 ? /shortfall/iu : gapTotals.gap === 0 ? /exactly enough/iu : /spare capacity/iu,
    );
  });

  it("lists every network ward exactly once, with an honest denominator on the panel count", () => {
    renderScreen();
    expect(
      screen.getByText(new RegExp(`${networkRows.length} wards?\\b`, "u")),
      "the panel count does not say how many wards are shown",
    ).toBeInTheDocument();
    const table = screen.getByTestId("ward-capacity-network-table");
    const rendered = within(table)
      .getAllByRole("row")
      .filter((row) => row.getAttribute("data-testid")?.startsWith("ward-capacity-network-row-"));
    expect(rendered.length).toBe(networkRows.length);
    for (const row of networkRows) {
      expect(within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`)).toBeInTheDocument();
    }
  });

  /*
   * ⚠️ **UPDATED 2026-09-05 BECAUSE THE SCREEN NOW STATES A ZERO IN WORDS, AND THE OLD ASSERTION
   * PINNED THE RENDERING RATHER THAN THE CLAIM.** It read `toHaveTextContent(String(row.ready))`
   * for every row, so it went red the moment three wards began reading "none" instead of "0" — a
   * legitimate change obeying the design rule this repo already applies two columns over. That is
   * the shape the standing policy warns about: a guard that fights a redesign gets deleted, and the
   * honest guards go with it in the same tidy-up.
   *
   * **What is asserted now is the CLAIM: each row states its ward's own real ready count.** The
   * word-for-zero transform is applied here as the test's own inverse of the component's, exactly
   * as the retired capacity board's test did, so a rewording of the absence does not break this but
   * a WRONG NUMBER still does.
   */
  it("names every ward's real ready and locked-ready counts in its own network row", () => {
    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");

    /*
     * Floored: if no ward had a zero ready count, the word branch below would never be exercised
     * and this case would silently stop covering it. Three wards do today.
     */
    expect(
      networkRows.filter((row) => row.ready === 0).length,
      "no ward has a zero ready count, so the stated-absence branch is not being checked at all",
    ).toBeGreaterThan(0);

    for (const row of networkRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      const readyCell = within(tableRow).getByTestId("ward-capacity-network-ready");
      const pending = within(readyCell).queryByTestId("ward-capacity-network-pending");
      const figure = (readyCell.textContent ?? "").replace(pending?.textContent ?? "\u0000", "").trim();

      expect(figure, `${row.unit.id} has ${row.ready} ready bed(s) and its row does not say so`).toBe(
        row.ready === 0 ? "none" : String(row.ready),
      );

      // Both directions on the absence: the digit must not survive beside the word, or a cell
      // reading "0 none" would pass while still making the claim the rule forbids.
      if (row.ready === 0) expect(figure).not.toMatch(/0/u);

      expect(within(tableRow).getByTestId("ward-capacity-network-locked")).toHaveTextContent(String(row.lockedReady));
    }
  });

  /**
   * ⚠️ THE TRAP THIS TEST IS FOR: `NetworkWardRow.freeing` is `number | undefined`, and it is
   * `undefined` on every row today (see the field's own doc comment in `capacity-derivations.ts`).
   * A screen that rendered a bare `{row.freeing}` here would print the literal word "undefined" —
   * or, worse, a naive `row.freeing ?? 0` would print a false "0", claiming nothing is freeing
   * today. Both are wrong; only a stated absence is honest. This walks every row the fixture
   * actually produces, rather than asserting the shape of one hand-picked row.
   */
  /**
   * ⚠️ **BOTH DIRECTIONS, because the first version pinned a MOMENT rather than a property.** It
   * asserted every row reads "not tracked" and floored on there being at least one untracked row —
   * true while `freeing` was undefined everywhere, and false the hour the derivation was wired to
   * the real bed releases. A test that fails when the product gets BETTER is one somebody deletes.
   *
   * The property that survives either state: a tracked row shows its real figure, an untracked row
   * says so in words, and neither ever renders "undefined" or a fabricated zero.
   *
   * 🔴 **AND THE SECOND VERSION STILL PINNED A PHRASE.** It matched the untracked arm against
   * `/not tracked/i` — the literal copy — which is the kind of guard that goes red on a legitimate
   * rewording and gets deleted with the honest ones beside it. Worse, that arm CANNOT RUN:
   * `CapacityScreen` reads `bedReleases` from `useWardFlow()`, typed `BedRelease[]` and never
   * `undefined`, so `networkWardRows` always returns a number. Measured here 2026-09-05: 23 rows,
   * 0 untracked, 15 of them showing a real `0`. A dead branch guarding a phrase was two problems
   * wearing one coat.
   *
   * Both arms now compare against `freeingCellText` — the module's own single decision, whose
   * absence branch is directly constructible and whose PROPERTY (a sentence, never a figure, never
   * "undefined") is proved exhaustively in `ward-capacity-derivations.test.ts`. This test's job is
   * the other half: that the screen defers to that decision rather than making its own. The two
   * halves together are what the phrase match was standing in for, and neither is a tautology on
   * its own — mutate the cell to `row.freeing ?? 0` and the tracked arm goes red here on the
   * fifteen wards whose real figure is not zero... which is why the tracked arm also asserts the
   * FIGURE independently, below, rather than only the helper's answer.
   */
  it("shows a real freeing figure where one exists and states the absence in words where it does not", () => {
    expect(networkRows.length, "no ward rows — this guard would prove nothing").toBeGreaterThan(5);
    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");
    for (const row of networkRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      const cell = within(tableRow).getByTestId("ward-capacity-network-freeing");
      expect(cell, `${row.unit.id} rendered the literal word "undefined"`).not.toHaveTextContent(/undefined/iu);
      expect(cell?.textContent?.trim(), `${row.unit.id} does not render the module's own decision`).toBe(
        freeingCellText(row.freeing),
      );
      if (row.freeing === undefined) {
        // The property, restated at the screen so a future inline rewrite of the cell cannot pass:
        // an absent figure reads as a sentence, never as something a coordinator could take for a
        // count. Unreachable today (see the note above); reachable the day a ward stops reporting.
        const text = cell?.textContent?.trim() ?? "";
        expect(text, `${row.unit.id} states its absence with no words at all`).toMatch(/\p{L}/u);
        expect(Number(text), `${row.unit.id} states its absence as a figure`).toBeNaN();
      } else {
        expect(cell, `${row.unit.id} should show its real figure ${row.freeing}`).toHaveTextContent(
          String(row.freeing),
        );
      }
    }
  });

  /**
   * The panel half of the same property. Asserts the FIGURE the panel reports, not the ARIA shape of
   * whatever renders it — a bar today, something else after a redesign, and this test does not care.
   *
   * 🔴 **THE UNTRACKED ARM WAS ASSERTING A PHRASE THE PANEL HAS NEVER CONTAINED.** It required
   * `/not tracked/i`; the panel's absence paragraph says "Nothing this screen reads can say how
   * many beds will free up before the day ends…" and the words "not tracked" appear nowhere in it.
   * That arm would have failed the moment it ran, and the only reason it never has is that
   * `freeingTracked` is true for every render the app can produce. **A wrong expectation hidden
   * behind an unreachable branch is worse than no expectation: it reads, to the next person, as
   * settled.**
   *
   * What it asserts instead are the two fabrications the field's own doc comment names — the
   * literal word "undefined", and a bare `0` presented as the total. Deliberately NOT a ban on the
   * WORD "zero": the real paragraph says "A zero here would claim nothing is freeing today", which
   * mentions a zero in order to explain why it is not shown. Banning the word would go red on the
   * most honest sentence on the screen.
   */
  it("reports the freeing total in its panels, or says the figure is not tracked", () => {
    const tracked = networkRows.map((row) => row.freeing).filter((value): value is number => value !== undefined);
    const total = tracked.reduce((sum, value) => sum + value, 0);
    renderScreen();
    const panels = screen.getAllByRole("region", { name: /freeing today/iu });
    expect(panels.length, "no 'freeing today' panel rendered at all").toBeGreaterThan(0);
    for (const panel of panels) {
      if (tracked.length === 0) {
        expect(panel, "nothing is tracked, so the panel must not print a bare 0 as the total").not.toHaveTextContent(
          /(?:^|\s)0(?:\s|$)/u,
        );
        expect(panel?.textContent ?? "", "nothing is tracked, so the panel must say so in words").toMatch(/\p{L}/u);
      } else {
        expect(panel, `the panel should report the real total ${total}`).toHaveTextContent(String(total));
      }
      expect(panel).not.toHaveTextContent(/undefined/iu);
    }
  });

  it("puts every named person-fact behind a real unit, never a bare unresolved site code", () => {
    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");
    // Every unit in this fixture resolves to a real site (`siteByCode`), so the fallback text
    // must never appear — proving the row reads the real site name rather than showing nothing.
    expect(within(table).queryByText(/No site matches/u)).toBeNull();
  });

  it("shows 'Worth your attention' with exactly the bed kinds that are short, and states the absence in words when none are", () => {
    const shortfalls = gapRows.filter((row) => row.gap < 0);
    renderScreen();
    const panel = screen.getByRole("region", { name: /Worth your attention/u });
    if (shortfalls.length === 0) {
      expect(panel).toHaveTextContent(/no bed kind is short/iu);
    } else {
      for (const row of shortfalls) {
        expect(within(panel).getByText(row.need)).toBeInTheDocument();
      }
    }
  });

  it("states its own boundary: this table is about the whole board, never a single patient's destination", () => {
    renderScreen();
    const panel = screen.getByRole("region", { name: /Where the mismatch is/u });
    expect(panel).toHaveTextContent(/never says which ward should take which person/iu);
  });

  /**
   * 🔴 OWNER RULING 2026-09-05: a bed still being cleaned is FREE but not PULLABLE, and the screen
   * must say so beside the Ready figure without changing it. Ward Lead measured the harm: the
   * reducer rejects PULL_PATIENT with "every free bed at X is still being made ready", so a
   * coordinator could commit two patients and have the second refused at the moment of action,
   * after the ward had been told.
   *
   * Asserts the PROPERTY, not the sentence: wherever a pending figure exists the row states it and
   * the Ready number is unchanged; where none exists the row says nothing rather than "0".
   */
  it("states beds still being made ready beside the Ready figure, without altering it", () => {
    const withPending = networkRows.filter((row) => (row.pendingPreparation ?? 0) > 0);
    expect(withPending.length, "no ward has a bed being made ready — this would be vacuous").toBeGreaterThan(0);
    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");
    for (const row of withPending) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      expect(
        within(tableRow).getByTestId("ward-capacity-network-ready"),
        `${row.unit.id}: the Ready figure itself must not change`,
      ).toHaveTextContent(String(row.ready));
      expect(
        within(tableRow).getByTestId("ward-capacity-network-pending"),
        `${row.unit.id} has ${row.pendingPreparation} being made ready and must say so`,
      ).toHaveTextContent(String(row.pendingPreparation));
    }
    for (const row of networkRows.filter((r) => (r.pendingPreparation ?? 0) === 0)) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      expect(
        within(tableRow).queryByTestId("ward-capacity-network-pending"),
        `${row.unit.id} has none pending and must not render a bare zero`,
      ).toBeNull();
    }
  });

  /**
   * 🔴 WHO CONFIRMED THE FIGURE — a clinical property my fold dropped, guarded here on the LIVE
   * screen because the test that used to guard it now renders a mode no route reaches.
   *
   * `source === "ward"` means the ward itself stood behind the number; anything else means it was
   * derived from a feed. A coordinator ringing a ward about its own figure needs to know which.
   * Asserts the PROPERTY against the fixture, not the sentence: a ward-sourced row names the ward,
   * a derived row does not claim one.
   */
  it("says who confirmed each capacity figure, and never attributes a derived one to a ward", () => {
    const wardSourced = networkRows.filter((row) => row.unit.allocatable.source === "ward");
    expect(wardSourced.length, "no ward-sourced figure — this assertion would be vacuous").toBeGreaterThan(0);
    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");
    for (const row of wardSourced) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      expect(tableRow, `${row.unit.id} is ward-confirmed and must name the ward`).toHaveTextContent(row.unit.name);
    }
    for (const row of networkRows.filter((r) => r.unit.allocatable.source !== "ward")) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      const stamp = within(tableRow).queryByText(/Confirmed .* · /u);
      expect(stamp, `${row.unit.id} is derived and must not be attributed to a ward`).toBeNull();
    }
  });
});

/*
 * 🔴 **TWO FIGURES ON ONE SCREEN MUST NOT SHARE A LABEL WHEN THEY COUNT DIFFERENT THINGS.**
 *
 * Found by Ward Verifier on 2026-09-06, by sweeping for the label rather than by eye:
 *
 *     "Ready now" bar key   Locked ready  8   -> 8 locked BEDS
 *     the ward filter chip  Locked ready  7   -> 7 WARDS holding one
 *
 * Both visible at once, in identical words, with nothing to tell them apart. A coordinator reading
 * 7 under 8 has no way to know these are different quantities rather than one figure disagreeing
 * with itself — and noticing exactly that kind of disagreement is what the screen is for.
 *
 * ⚠️ **THIS IS A PROPERTY, NOT A PIN ON THE PHRASE THAT HAPPENED TO COLLIDE.** Asserting the new
 * wording would go green the day somebody reintroduces the collision under different words. What is
 * asserted is that the two groups share NO label at all: the bar's key counts beds, every filter
 * chip counts wards, so any label common to both is a units collision whatever it says.
 *
 * The floor matters as much as the assertion. Both sets must be non-empty and must genuinely
 * differ in size — if the bar ever rendered no key, or the filters no chips, an intersection of
 * nothing would pass while proving nothing.
 */
describe("the Capacity screen never labels a bed count and a ward count with the same words", () => {
  function labelsIn(container: HTMLElement, selector: string): string[] {
    return (
      Array.from(container.querySelectorAll(selector))
        .map((node) => (node.textContent ?? "").replace(/\s+/gu, " ").trim())
        // Both a key item and a filter chip render "<label> <count>"; the count is what differs
        // between them and is not part of the name being compared.
        .map((text) => text.replace(/\s*\d+\s*$/u, "").trim())
        .filter((text) => text !== "")
    );
  }

  it("has a bar key and a filter group to compare, or the intersection below is vacuous", () => {
    renderScreen();
    const bar = document.querySelector('[data-ward-primitive="bar"]') as HTMLElement;
    const filters = document.querySelector('[data-ward-primitive="filters"]') as HTMLElement;
    expect(bar, "no WardBar on the capacity screen — this guard has nothing to stand over").not.toBeNull();
    expect(filters, "no filter group on the capacity screen").not.toBeNull();
    expect(labelsIn(bar, "li").length, "the bar renders no key items").toBeGreaterThan(0);
    expect(labelsIn(filters, "button").length, "the filter group renders no chips").toBeGreaterThan(0);
  });

  it("shares no label between the bed-counting bar key and the ward-counting filter chips", () => {
    renderScreen();
    const barLabels = labelsIn(document.querySelector('[data-ward-primitive="bar"]') as HTMLElement, "li");
    const chipLabels = labelsIn(document.querySelector('[data-ward-primitive="filters"]') as HTMLElement, "button");
    const shared = barLabels.filter((label) => chipLabels.includes(label));

    expect(
      shared,
      "these words label a BED count in the bar and a WARD count in the filters, on screen at the " +
        "same time. Rename one — the numbers are both correct and neither should move.",
    ).toEqual([]);
  });
});
