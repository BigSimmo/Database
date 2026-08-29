import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * One test for the first pass of the ward board, and deliberately only one thing each: that the
 * board draws a tile per recorded bed, and that every occupied tile states its own day count as
 * TEXT.
 *
 * The second of those is the one that matters. The stay band is rendered as a fill shade, and a
 * shade is invisible to a greyscale print, to forced-colors mode, and to a reader who cannot
 * separate two blues — so the day count on the tile is the entire reason the board is readable
 * without colour. A test that only counted tiles would stay green while every number vanished.
 *
 * The expected values are derived from the same seed the component reads rather than hard-coded,
 * because a hand-typed "20" would go stale the day an occupant is added to the fixture and would
 * then be a test asserting last month's ward.
 */
const UNIT_ID = "rph-adult-secure";
/** The ward the defect was FOUND on: it records blocked beds, so it is the one where drawing them
 *  as ordinary empty tiles put more fillable-looking tiles on screen than the header claimed. */
const BLOCKED_UNIT_ID = "fsh-adult-secure";

function unitFor(unitId: string): Unit {
  const unit = wardSites.flatMap((site) => site.units).find((candidate) => candidate.id === unitId);
  if (unit === undefined) throw new Error(`No seeded unit ${unitId} — this test cannot check anything.`);
  return unit;
}

function occupantsFor(unitId: string): Admission[] {
  return admissionsForUnit(wardAdmissions, unitId).filter(bedIsOccupied);
}

describe("ward board page", () => {
  it("draws one tile per recorded bed", () => {
    const unit = unitFor(UNIT_ID);
    const { container } = render(<WardBoard unitId={UNIT_ID} />);

    const tiles = container.querySelectorAll("[data-bed-kind]");
    // Guards the assertion below against passing on an empty ward: a board with zero beds and
    // zero tiles would satisfy an equality check while proving nothing.
    expect(unit.beds).toBeGreaterThan(0);
    expect(tiles).toHaveLength(unit.beds);
  });

  it("states the day count as text on every occupied tile", () => {
    const occupants = occupantsFor(UNIT_ID);
    // Only occupants who have actually ARRIVED carry a day count. A pulled bed is occupied — the
    // ward gave it away — but its stay has not started, so it shows "Empty, waiting" instead.
    const arrived = occupants.filter((admission) => daysInBed(admission, WARD_ADMISSIONS_ANCHOR) !== null);
    expect(arrived.length).toBeGreaterThan(0);

    const { container } = render(<WardBoard unitId={UNIT_ID} />);

    const occupiedTiles = [...container.querySelectorAll('[data-bed-kind="occupied"]')];
    expect(occupiedTiles).toHaveLength(arrived.length);

    // Compared as a SORTED MULTISET of exact strings, not with a per-tile substring search. A
    // substring check passes when a tile reading "45" is accepted as evidence for a five-day
    // stay, and it cannot notice a duplicated or missing number at all — this ward really does
    // hold two five-day stays and a forty-five-day one, so that weakness is not hypothetical.
    const rendered = occupiedTiles
      .map((tile) => tile.querySelector('[data-testid$="-days"]')?.textContent ?? "")
      .sort();
    const expected = arrived.map((admission) => String(daysInBed(admission, WARD_ADMISSIONS_ANCHOR))).sort();
    expect(rendered).toEqual(expected);

    // And the pulled bed is drawn as taken, never as a free bed.
    const pulled = occupants.filter((admission) => daysInBed(admission, WARD_ADMISSIONS_ANCHOR) === null);
    expect(container.querySelectorAll('[data-bed-kind="waiting"]')).toHaveLength(pulled.length);
    expect(screen.getAllByText("Empty, waiting")).toHaveLength(pulled.length);
  });
});

/**
 * The defect the render found, pinned so it cannot come back.
 *
 * A bed with nobody in it is not necessarily a bed you can fill. Drawing an out-of-service bed as
 * an ordinary empty tile is not a cosmetic slip: it is the board telling a coordinator there is
 * somewhere to put a person when there is not, which on `fsh-adult-secure` meant four
 * empty-looking tiles under a header saying three.
 *
 * `tests/ward-board-consistency.test.ts` already pins the arithmetic in the FIXTURE across all 23
 * units (`beds − occupied === empty + blocked`). What is asserted here is the different half of
 * it: that the RENDERED BOARD spends those beds on the right kinds of tile. Both are needed — the
 * fixture was correct throughout the period the board was wrong.
 */
describe("ward board page — out-of-service beds", () => {
  it("draws a unit's blocked beds as out-of-service tiles, not as fillable empty ones", () => {
    const unit = unitFor(BLOCKED_UNIT_ID);
    // Guards every assertion below against passing vacuously on a ward with nothing blocked — the
    // exact way this test could go green while the defect was fully intact.
    expect(unit.blocked).toBeGreaterThan(0);

    const { container } = render(<WardBoard unitId={BLOCKED_UNIT_ID} />);

    expect(container.querySelectorAll('[data-bed-kind="blocked"]')).toHaveLength(unit.blocked);
    // Said in WORDS on every one of them, not by fill alone.
    expect(screen.getAllByText("Out of service")).toHaveLength(unit.blocked);
  });

  /**
   * The whole point, stated as the thing a coordinator actually does: count the tiles that look
   * fillable and compare with the header. Asserted against the unit's OWN recorded empty figure
   * rather than against the number of tiles left over after the others are drawn, so a board that
   * simply relabelled some empties as blocked would not satisfy it.
   */
  it("leaves exactly the unit's recorded empty beds looking fillable", () => {
    const unit = unitFor(BLOCKED_UNIT_ID);
    const { container } = render(<WardBoard unitId={BLOCKED_UNIT_ID} />);

    expect(container.querySelectorAll('[data-bed-kind="empty"]')).toHaveLength(unit.empty.value);
  });

  /**
   * And the three kinds still add up to the ward's beds. A tile per bed was already asserted for
   * `rph-adult-secure`; here it is the partition that matters, because a blocked tile added
   * WITHOUT taking one away from the empties would leave the ward drawing more beds than it has —
   * the same defect in the opposite direction.
   */
  it("partitions every bed into occupied, out-of-service or empty, with none left over", () => {
    const unit = unitFor(BLOCKED_UNIT_ID);
    const { container } = render(<WardBoard unitId={BLOCKED_UNIT_ID} />);

    const counts = {
      occupied: container.querySelectorAll('[data-bed-kind="occupied"]').length,
      waiting: container.querySelectorAll('[data-bed-kind="waiting"]').length,
      blocked: container.querySelectorAll('[data-bed-kind="blocked"]').length,
      empty: container.querySelectorAll('[data-bed-kind="empty"]').length,
    };

    // "Waiting" is an OCCUPIED bed — the ward gave it away and the person has not arrived. It is
    // counted on the occupied side of this sum, never with the empties.
    expect(counts.occupied + counts.waiting).toBe(occupantsFor(BLOCKED_UNIT_ID).length);
    expect(counts.occupied + counts.waiting + counts.blocked + counts.empty).toBe(unit.beds);
    expect(container.querySelectorAll("[data-bed-kind]")).toHaveLength(unit.beds);
  });
});
