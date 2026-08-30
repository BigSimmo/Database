import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { admissionsForUnit } from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { derivedBedReleases } from "@/components/ward-management/ward-discharge-dates";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { CAPACITY_FIGURE_LABELS } from "@/components/ward-management/ward-morning-rollup";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * THE TRIAGE BAR, and the one failure it is most likely to have.
 *
 * A sibling panel shipped "Kimberley 28 people" on a twenty-bed ward this morning. Its derivation
 * was right and all nine of its assertions passed; it had been handed the whole network's 267
 * admissions instead of one ward's, and no test of a derivation can see a caller passing it the
 * wrong set. So these tests check the RENDERED figures against a per-unit derivation computed here,
 * for all 23 seeded units, and additionally check that each figure is POSSIBLE for a ward of that
 * size rather than merely equal to something.
 *
 * They also pin the vocabulary. The six labels must be `CAPACITY_FIGURE_LABELS`' own strings, so a
 * hardcoded copy in the board — which would pass any check that read the board's own markup back —
 * fails here instead.
 */
function renderWardBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

const UNIT_ID = "rph-adult-secure";
const allUnits: Unit[] = wardSites.flatMap((site) => site.units);

/** The releases the board itself derives, computed here independently of it. */
function releasesFor(): ReturnType<typeof derivedBedReleases> {
  return derivedBedReleases([...wardAdmissions], WARD_ADMISSIONS_ANCHOR);
}

const FIGURE_KEYS = ["availableNow", "confirmedToday", "expectedToday", "blockedToday", "held", "leaveUsable"] as const;

describe("ward board triage bar — the home page's six figures, in the home page's words", () => {
  it("renders all six figures with the shared labels, never a retyped copy", () => {
    renderWardBoard(UNIT_ID);
    const bar = screen.getByTestId("ward-board-triage");

    // Non-vacuity: the shared constant really does hold six entries, so "all six" means something.
    expect(Object.keys(CAPACITY_FIGURE_LABELS)).toHaveLength(6);

    for (const key of FIGURE_KEYS) {
      const figure = within(bar).getByTestId(`ward-board-figure-${key}`);
      // The exact string the morning page renders. A board that typed "Available Now" or "Blocked"
      // would satisfy any check written against its own markup and fail this one.
      expect(figure.textContent).toContain(CAPACITY_FIGURE_LABELS[key]);
    }
  });

  it("prints this ward's own figures, not the network's, on every seeded unit", () => {
    const releases = releasesFor();
    let checked = 0;

    for (const unit of allUnits) {
      const { unmount } = renderWardBoard(unit.id);
      const breakdown = capacityBreakdown(unit, [...releases], [], WARD_ADMISSIONS_ANCHOR);

      for (const key of FIGURE_KEYS) {
        const figure = screen.getByTestId(`ward-board-figure-${key}`);
        const value = Number((figure.textContent ?? "").match(/\d+/)?.[0]);
        expect(value, `${unit.id} ${key}`).toBe(breakdown[key]);
        // POSSIBLE, not merely computed. No capacity figure for one ward can exceed that ward's
        // own bed count — which is exactly the check the "28 people on a 20-bed ward" defect would
        // have failed while its own derivation tests all passed.
        expect(value, `${unit.id} ${key} exceeds the ward's ${unit.beds} beds`).toBeLessThanOrEqual(unit.beds);
      }

      checked += 1;
      unmount();
    }

    expect(checked).toBeGreaterThan(20);
  });

  it("agrees with the headline about how many beds can be filled today", () => {
    renderWardBoard(UNIT_ID);
    const available = screen.getByTestId("ward-board-figure-availableNow").textContent ?? "";
    const headline = screen.getByTestId("ward-board-headline").textContent ?? "";
    const value = (available.match(/\d+/) ?? [])[0];
    expect(value).toBeDefined();
    expect(headline).toContain(value!);
  });
});

describe("ward board triage bar — the toggle changes emphasis and hides nothing", () => {
  it("builds the Going out list from the selected basis, on every seeded unit", async () => {
    const user = userEvent.setup();
    const releases = releasesFor();
    let checkedWithRows = 0;

    for (const unit of allUnits) {
      const { unmount } = renderWardBoard(unit.id);
      const breakdown = capacityBreakdown(unit, [...releases], [], WARD_ADMISSIONS_ANCHOR);

      const rowsNow = () => screen.queryAllByTestId(/^ward-board-outgoing-derived-/).length;

      // Confirmed is the default — the owner's "daily discharges" before the toggle to "expects".
      expect(screen.getByTestId("ward-board-basis-confirmed").getAttribute("aria-pressed")).toBe("true");
      expect(rowsNow(), `${unit.id} confirmed rows`).toBe(breakdown.confirmedToday);

      await user.click(screen.getByTestId("ward-board-basis-expected"));
      expect(screen.getByTestId("ward-board-basis-expected").getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByTestId("ward-board-basis-confirmed").getAttribute("aria-pressed")).toBe("false");
      expect(rowsNow(), `${unit.id} expected rows`).toBe(breakdown.expectedToday);

      if (breakdown.confirmedToday + breakdown.expectedToday > 0) checkedWithRows += 1;
      unmount();
    }

    // Without this the loop above would be satisfied by 23 wards that all render nothing.
    expect(checkedWithRows).toBeGreaterThan(5);
  });

  it("keeps all six figures on the bar in both states, so nothing can be toggled out of sight", async () => {
    const user = userEvent.setup();
    renderWardBoard(UNIT_ID);

    for (const key of FIGURE_KEYS) expect(screen.getByTestId(`ward-board-figure-${key}`)).toBeTruthy();
    await user.click(screen.getByTestId("ward-board-basis-expected"));
    for (const key of FIGURE_KEYS) expect(screen.getByTestId(`ward-board-figure-${key}`)).toBeTruthy();

    // Blocked releases in particular: the figure a coordinator most needs to chase must never be
    // the one a display control can remove.
    expect(screen.getByTestId("ward-board-figure-blockedToday").textContent).toContain(
      CAPACITY_FIGURE_LABELS.blockedToday,
    );
  });

  it("says in words which basis is showing, so a printed sheet is not ambiguous", async () => {
    const user = userEvent.setup();
    renderWardBoard(UNIT_ID);

    // The toggle is a button and buttons are stripped from every printed sheet by the global reset,
    // so the pressed state alone cannot survive onto paper.
    expect(screen.getByTestId("ward-board-outgoing-count").textContent).toContain(
      CAPACITY_FIGURE_LABELS.confirmedToday,
    );
    await user.click(screen.getByTestId("ward-board-basis-expected"));
    expect(screen.getByTestId("ward-board-outgoing-count").textContent).toContain(CAPACITY_FIGURE_LABELS.expectedToday);
  });
});

describe("ward board flow column — who is coming in", () => {
  it("lists this ward's own arrivals and never the network's, on every seeded unit", () => {
    let checkedWithRows = 0;

    for (const unit of allUnits) {
      const { container, unmount } = renderWardBoard(unit.id);
      const expected = admissionsForUnit(wardAdmissions, unit.id).filter(
        (admission) => admission.state === "pulled" || admission.state === "waitlisted",
      );

      const rows = container.querySelectorAll("[data-incoming-state]");
      expect(rows, `${unit.id} incoming rows`).toHaveLength(expected.length);

      // A pulled bed is one of this ward's beds, so the pulled rows can never outnumber them —
      // the arithmetic check the "28 people on a 20-bed ward" defect would have failed.
      const pulled = [...rows].filter((row) => row.getAttribute("data-incoming-state") === "pulled");
      expect(pulled.length, `${unit.id} pulled rows vs ${unit.beds} beds`).toBeLessThanOrEqual(unit.beds);

      if (expected.length > 0) checkedWithRows += 1;
      unmount();
    }

    expect(checkedWithRows).toBeGreaterThan(3);
  });

  it("draws a given-away bed and a waitlisted person as different things", () => {
    // `scgh-adult-open` is the one seeded ward carrying both a pulled bed and a waitlisted person,
    // which is what makes the distinction checkable at all rather than assumed.
    const { container } = renderWardBoard("scgh-adult-open");
    const rows = [...container.querySelectorAll<HTMLElement>("[data-incoming-state]")];
    const pulled = rows.filter((row) => row.getAttribute("data-incoming-state") === "pulled");
    const waiting = rows.filter((row) => row.getAttribute("data-incoming-state") === "waitlisted");
    expect(pulled.length).toBeGreaterThan(0);
    expect(waiting.length).toBeGreaterThan(0);

    for (const row of pulled) {
      expect(row.textContent).toContain("Bed already given away");
      // The only clock the record holds for an arrival — never an estimated time of arrival.
      expect(row.textContent).toMatch(/Bed given away/);
    }
    for (const row of waiting) {
      expect(row.textContent).toContain("Waiting — no bed given");
      expect(row.textContent).not.toMatch(/Bed given away/);
    }
  });

  it("says nothing at all about when anybody will arrive", () => {
    const { container } = renderWardBoard("scgh-adult-open");
    const panel = container.querySelector<HTMLElement>('[data-testid="ward-board-incoming"]');
    expect(panel).not.toBeNull();
    // The record holds no arrival time, no transport and no estimate. A board that invented one
    // would be read as fact by a coordinator planning around it.
    expect(panel!.textContent).not.toMatch(/\bETA\b|arriv(es|ing|al) (at|in|by)|expected to arrive/i);
    expect(panel!.textContent).toContain("nothing about when anybody will get here");
  });
});

describe("ward board flow column — what is going out", () => {
  it("names beds and never the people in them", () => {
    const { container } = renderWardBoard(UNIT_ID);
    const panel = container.querySelector<HTMLElement>('[data-testid="ward-board-outgoing"]');
    expect(panel).not.toBeNull();
    const rows = [...panel!.querySelectorAll<HTMLElement>('[data-testid^="ward-board-outgoing-derived-"]')];
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      const text = row.textContent ?? "";
      // A `BedRelease` carries nothing about the departing patient — not a sex, not a home region,
      // not a destination. Any of those appearing here would mean the component had recovered the
      // person from the release, which is the one property that type exists to prevent.
      expect(text).not.toMatch(/\b(Male|Female)\b/);
      expect(text).not.toMatch(/\bfrom (Perth|Kimberley|Pilbara|Peel|Wheatbelt|Gascoyne|Goldfields|Mid West)/);
    }
    expect(panel!.textContent).toContain("These are beds, not people");
  });
});

describe("ward board flow column — since yesterday", () => {
  it("counts this ward's own last day, keeping departed admissions in", () => {
    // `arm-adult-open` carries a seeded departure inside the last day; `admissionsForUnit` would
    // drop it, which is why the component filters by hand there and why this is checked.
    const { container } = renderWardBoard("arm-adult-open");
    const left = container.querySelector<HTMLElement>('[data-testid="ward-board-since-discharged"]');
    expect(left).not.toBeNull();
    expect(Number((left!.textContent ?? "").match(/\d+/)?.[0])).toBeGreaterThan(0);
  });

  it("does not report the whole network's departures as this ward's", () => {
    // `bty-youth` has no seeded departure at all. A component reading the unscoped seed would show
    // the network's four here instead of zero.
    const { container } = renderWardBoard("bty-youth");
    const left = container.querySelector<HTMLElement>('[data-testid="ward-board-since-discharged"]');
    expect(left).not.toBeNull();
    expect(Number((left!.textContent ?? "").match(/\d+/)?.[0])).toBe(0);
  });
});
