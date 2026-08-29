import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  isPastExpectedDischarge,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * The far-right "Who is in these beds" panel.
 *
 * **The assertion this suite exists for is the first one, and it is not about the panel's own
 * arithmetic.** The panel's sibling — the destinations panel, shipped earlier the same day —
 * was written as `arrowTargets(admissions, now)` against the whole network's 267 admissions
 * instead of one ward's eighteen, and offered "Kimberley 28 people" on a twenty-bed ward. Nothing
 * failed and nothing could have: `arrowTargets` was correct, and all nine of its assertions passed
 * because every one of them supplies its own admissions. A derivation's tests cannot see a caller
 * handing it the wrong collection.
 *
 * So the first test below asserts the thing a ward can check without a computer: the people listed
 * in this panel, plus the beds drawn as out-of-service, held and empty, come to exactly the number
 * of beds the ward has. It runs across EVERY seeded unit rather than the one this panel was built
 * against, because the wrong-collection defect is invisible on a ward whose numbers happen to be
 * plausible and glaring on the next one along.
 *
 * Every expectation is derived from the same seed the component reads. A hand-typed "18" would be
 * a test asserting last month's ward the day an occupant is added to the fixture.
 */
function renderWardBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

/** The unit the panel was built and looked at on: 20 beds, 18 taken, one of them a pulled bed with
 *  no stay, one occupant confirmed AND blocked, and three people past the ward's own date. */
const UNIT_ID = "rph-adult-secure";

const ALL_UNITS: Unit[] = wardSites.flatMap((site) => site.units);

function unitFor(unitId: string): Unit {
  const unit = ALL_UNITS.find((candidate) => candidate.id === unitId);
  if (unit === undefined) throw new Error(`No seeded unit ${unitId} — this test cannot check anything.`);
  return unit;
}

/** Exactly the two calls the component makes, so a scoping mistake in the component shows up as a
 *  disagreement with this rather than being reproduced by it. */
function occupantsFor(unitId: string): Admission[] {
  return admissionsForUnit(wardAdmissions, unitId).filter(bedIsOccupied);
}

function panelIn(container: HTMLElement): HTMLElement {
  const panel = container.querySelector<HTMLElement>('[aria-labelledby="ward-board-people-heading"]');
  if (panel === null) throw new Error("The ward board rendered no people panel.");
  return panel;
}

function panelRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid^="ward-board-person-"]')].filter(
    // `-days` shares the prefix; only the row elements are wanted.
    (element) => element.tagName === "LI",
  );
}

describe("ward board people panel — the figure has to be possible, not merely computed", () => {
  it("lists every occupied bed on every seeded ward, and never more people than the ward has beds", () => {
    // Non-vacuity: a fixture that lost its units would otherwise make this suite pass by
    // iterating nothing at all.
    expect(ALL_UNITS.length).toBeGreaterThan(20);

    const offenders: string[] = [];
    let checkedWithOccupants = 0;

    for (const unit of ALL_UNITS) {
      const { container, unmount } = renderWardBoard(unit.id);
      const rows = panelRows(container).length;
      const expected = occupantsFor(unit.id).length;
      if (expected > 0) checkedWithOccupants += 1;

      // The arithmetic a ward does in its head, and the one the "Kimberley 28 people" defect
      // failed: the listed people plus the beds nobody is in must equal the ward's beds.
      const unoccupiedTiles =
        container.querySelectorAll('[data-bed-kind="blocked"]').length +
        container.querySelectorAll('[data-bed-kind="held"]').length +
        container.querySelectorAll('[data-bed-kind="empty"]').length;

      if (rows !== expected) offenders.push(`${unit.id}: panel listed ${rows} people, ward holds ${expected}`);
      if (rows > unit.beds) offenders.push(`${unit.id}: panel listed ${rows} people in ${unit.beds} beds`);
      if (rows + unoccupiedTiles !== unit.beds) {
        offenders.push(`${unit.id}: ${rows} people + ${unoccupiedTiles} unoccupied tiles ≠ ${unit.beds} beds`);
      }
      unmount();
    }

    // Reported as a list rather than failing on the first ward, so a scoping mistake shows its
    // real blast radius — every ward at once — instead of one unit's numbers.
    expect(offenders).toEqual([]);
    expect(checkedWithOccupants).toBeGreaterThan(20);
  });

  it("says the same two numbers in the intro sentence that it draws underneath it", () => {
    const unit = unitFor(UNIT_ID);
    const { container } = renderWardBoard(UNIT_ID);

    const rows = panelRows(container).length;
    expect(rows).toBeGreaterThan(0);

    // The sentence is the reason this defect is catchable by eye at all, so it is pinned as text
    // rather than trusted to be built from the same variables.
    const intro = within(panelIn(container)).getByTestId("ward-board-people-count");
    expect(intro.textContent).toContain(`${rows} of this ward's ${unit.beds} beds are taken`);
  });
});

describe("ward board people panel — what each person's entry states", () => {
  it("states every arrived occupant's day count, matching the tiles exactly", () => {
    const occupants = occupantsFor(UNIT_ID);
    const arrived = occupants.filter((admission) => daysInBed(admission, WARD_ADMISSIONS_ANCHOR) !== null);
    expect(arrived.length).toBeGreaterThan(0);

    const { container } = renderWardBoard(UNIT_ID);
    const panel = panelIn(container);

    // A sorted multiset of exact strings, never a substring sweep: a substring check accepts a
    // row reading "45" as evidence for a five-day stay and cannot see a duplicated or missing
    // number at all. This ward really does hold two five-day stays and a forty-five-day one.
    const rendered = [...panel.querySelectorAll('[data-testid$="-days"]')].map((el) => el.textContent ?? "").sort();
    const expected = arrived
      .map((admission) => {
        const days = daysInBed(admission, WARD_ADMISSIONS_ANCHOR);
        return `${days} day${days === 1 ? "" : "s"}`;
      })
      .sort();
    expect(rendered).toEqual(expected);

    // And the panel and the grid agree, which is the whole reason both are scoped by the same
    // pair of calls.
    const tileDays = [...container.querySelectorAll('[data-bed-kind="occupied"] [data-testid$="-days"]')]
      .map((el) => `${el.textContent} day${el.textContent === "1" ? "" : "s"}`)
      .sort();
    expect(rendered).toEqual(tileDays);
  });

  it("gives a pulled bed no stay and no expected date, rather than a zero-day one", () => {
    const pulled = occupantsFor(UNIT_ID).filter(
      (admission) => daysInBed(admission, WARD_ADMISSIONS_ANCHOR) === null,
    );
    // Non-vacuity: without a pulled occupant in the fixture this asserts nothing.
    expect(pulled.length).toBeGreaterThan(0);

    const panel = panelIn(renderWardBoard(UNIT_ID).container);
    expect(within(panel).getAllByText("No stay yet — not arrived")).toHaveLength(pulled.length);
    // A pulled admission carries no expected date in the fixture, and an absent date must read as
    // absent — never as "expected out in 0 days".
    expect(panel.textContent).not.toMatch(/Expected out in 0 days/);
  });

  it("orders people by the ward's expected date, soonest first, with the undated last", () => {
    const { container } = renderWardBoard(UNIT_ID);
    const rows = panelRows(container);

    const byId = new Map(occupantsFor(UNIT_ID).map((admission) => [admission.id, admission]));
    const ordered = rows.map((row) => {
      const id = (row.getAttribute("data-testid") ?? "").replace("ward-board-person-", "");
      const admission = byId.get(id);
      if (admission === undefined) throw new Error(`Panel row ${id} is not an occupant of ${UNIT_ID}.`);
      return admission.expectedDischargeAt;
    });

    // Non-vacuity: the ordering claim means nothing without both kinds present, and this ward has
    // both people with dates already passed and people with no date at all.
    expect(ordered.filter((at) => at === null).length).toBeGreaterThan(0);
    expect(ordered.filter((at) => at !== null).length).toBeGreaterThan(1);

    const dated = ordered.filter((at): at is number => at !== null);
    expect(dated).toEqual([...dated].sort((a, b) => a - b));
    // Every dated person comes before every undated one — asserted as a position, so a single
    // undated row sorted into the middle fails.
    expect(ordered.slice(0, dated.length).every((at) => at !== null)).toBe(true);
  });

  it("marks exactly the people past the ward's own expected date, in words", () => {
    const past = occupantsFor(UNIT_ID).filter((admission) =>
      isPastExpectedDischarge(admission, WARD_ADMISSIONS_ANCHOR),
    );
    expect(past.length).toBeGreaterThan(0);

    const panel = panelIn(renderWardBoard(UNIT_ID).container);
    expect(within(panel).getAllByText("Past date")).toHaveLength(past.length);

    // The magnitude too, and with its sign the right way round: `arrowTargets` deliberately floors
    // a passed date to zero and this panel deliberately does not, so a copy of that floor landing
    // here would silently render every overdue person as leaving within a day.
    for (const admission of past) {
      const overdueDays = Math.floor(
        (WARD_ADMISSIONS_ANCHOR - (admission.expectedDischargeAt ?? 0)) / (24 * 60),
      );
      expect(panel.textContent).toContain(
        `${overdueDays} day${overdueDays === 1 ? "" : "s"} past the ward's expected date`,
      );
    }
  });

  it("distinguishes a confirmed discharge from a planned one, and never infers a confirmation", () => {
    const occupants = occupantsFor(UNIT_ID);
    const confirmed = occupants.filter((admission) => admission.dischargeConfirmedAt !== null);
    const plannedOnly = occupants.filter(
      (admission) => admission.dischargeConfirmedAt === null && admission.expectedDischargeAt !== null,
    );
    // Both sides must exist or this proves nothing: a panel that said "Confirmed" for everybody,
    // or for nobody, would satisfy a one-sided check.
    expect(confirmed.length).toBeGreaterThan(0);
    expect(plannedOnly.length).toBeGreaterThan(0);

    const panel = panelIn(renderWardBoard(UNIT_ID).container);
    const confirmations = [...panel.querySelectorAll("p")].filter((p) =>
      (p.textContent ?? "").includes("a decision, not a plan"),
    );
    expect(confirmations).toHaveLength(confirmed.length);
    expect(
      within(panel).getAllByText(/Not confirmed — the ward's plan, not yet its decision\./),
    ).toHaveLength(plannedOnly.length);

    // The role, from the record — and the confirming role, not the date-setting one. The fixture
    // deliberately makes those two different so a screen that confuses them looks wrong.
    for (const admission of confirmed) {
      expect(panel.textContent).toContain(`Confirmed by ${admission.dischargeConfirmedBy} — a decision, not a plan.`);
    }
  });

  it("names a recorded blocker and stays silent where none is recorded", () => {
    const blocked = occupantsFor(UNIT_ID).filter((admission) => admission.blockReason !== null);
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.length).toBeLessThan(occupantsFor(UNIT_ID).length);

    const panel = panelIn(renderWardBoard(UNIT_ID).container);
    const blockerLines = [...panel.querySelectorAll("p")].filter((p) =>
      (p.textContent ?? "").startsWith("Held up by:"),
    );
    expect(blockerLines).toHaveLength(blocked.length);
    for (const admission of blocked) {
      expect(panel.textContent).toContain(`Held up by: ${admission.blockReason}.`);
    }

    // Silence, never "Nothing outstanding" — nobody has looked at what is holding these
    // discharges up, and saying nothing is outstanding would be a ward's finding rather than this
    // panel's ignorance. The same distinction `derivedBedReleases` draws for `waitingOn`.
    expect(panel.textContent).not.toMatch(/Nothing outstanding/i);
  });
});

/**
 * The owner decision this panel is most likely to be "helpfully" broken by later.
 *
 * `Admission` carries no diagnosis and must not grow one (`ward-admissions.ts`, rule 3, pinned
 * structurally by `tests/ward-admission-model.test.ts`). The brief for this panel asked for one
 * anyway, so the risk is not that somebody adds the field — that test catches it — but that a
 * screen adds a ROW for it: an empty "Diagnosis: —", a "not recorded" placeholder, or a heading
 * with nothing under it. Each of those reads as a field a ward is expected to fill in later, which
 * is how a record grows a column nobody agreed to.
 */
describe("ward board people panel — no diagnosis, and no placeholder for one", () => {
  it("mentions diagnosis exactly once, to say the record does not hold one", () => {
    const panel = panelIn(renderWardBoard(UNIT_ID).container);

    const mentions = [...panel.querySelectorAll("p")].filter((p) => /diagnos/i.test(p.textContent ?? ""));
    expect(mentions).toHaveLength(1);
    expect(mentions[0]?.textContent).toBe("No diagnosis is shown: this record does not hold one.");
  });

  it("renders no diagnosis field, label or placeholder on any person's entry", () => {
    const { container } = renderWardBoard(UNIT_ID);
    const rows = panelRows(container);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      const text = row.textContent ?? "";
      expect(text).not.toMatch(/diagnos/i);
      // The placeholder shapes specifically: an em-dash, an en-dash or "not recorded" standing in
      // for a value. Nothing on a person's entry may be an empty slot awaiting content.
      expect(text).not.toMatch(/(Diagnosis|Condition|Problem)\s*[:—–-]/i);
    }

    // And the whole page, not just the panel — a diagnosis row added to a tile would pass a
    // panel-scoped check.
    const board = container.querySelector('[data-testid="ward-board"]');
    const pageMentions = (board?.textContent ?? "").match(/diagnos/gi) ?? [];
    expect(pageMentions).toHaveLength(1);
  });
});
