import { fireEvent, render, screen, within } from "@testing-library/react";
import { LEAVING_DESTINATIONS } from "../src/components/ward-management/ward-admissions";
import { describe, expect, it } from "vitest";

import { WardBoard } from "../src/components/ward-management/board/ward-board";
import { useWardFlow, WardFlowProvider } from "../src/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { WARD_ADMISSIONS_ANCHOR } from "../src/components/ward-management/ward-admissions-seed";

/*
 * DISCHARGING SOMEBODY FROM THE BOARD, end to end through the real screen.
 *
 * This is the first control on this board that changes anything. Until `RECORD_LEAVING` existed
 * the app had 36 events and none of them discharged anybody, so no test anywhere could drive a
 * person out of a bed and watch the ward's own figures move.
 *
 * ⚠️ EVERY RENDER HERE IS AT AN INSTANT THAT IS NOT `WARD_ADMISSIONS_ANCHOR`, deliberately. The
 * rest of this board's DOM suite renders at the anchor, which is the instant the fixture is
 * authored against — so seed state and live state coincide by construction and no assertion in
 * those files can tell them apart. That is exactly how this board came to read its numbers off the
 * un-mutated seed while every other screen read the provider, with all 127 board tests green.
 * Rendering off-anchor is what makes the assertions below about LIVE state.
 */

/** Forty minutes past the fixture's own instant: far enough that a seed-derived figure and a live
 *  one cannot be the same number by accident, close enough that no stay band changes. */
const OFF_ANCHOR = WARD_ADMISSIONS_ANCHOR + 40;

/** Chosen from the seed rather than hard-coded: the first ward that actually has somebody in a bed,
 *  so a fixture change cannot quietly make this file test an empty ward. */
function aWardWithAnOccupant() {
  const state = seedWardFlowState();
  const occupied = state.admissions.find((admission) => admission.state === "occupied");
  if (!occupied) throw new Error("the seed contains nobody occupying a bed");
  const unit = state.units.find((candidate) => candidate.id === occupied.unitId);
  if (!unit) throw new Error(`the seed has no unit ${occupied.unitId}`);
  return { unitId: unit.id, emptyBefore: unit.empty.value, admissionId: occupied.id };
}

function renderBoardAt(unitId: string, now: number) {
  return render(
    <WardFlowProvider initialNow={now}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

/**
 * READS THE MODEL, not the screen — deliberately, and it is the only thing in this file that does.
 *
 * `RECORD_LEAVING` writes `leavingDestination` onto the admission and no surface of the ward board
 * renders it back: the board shows that a bed freed, never where the person went. A test that
 * therefore checked only the board could not tell a transfer to another psychiatric ward from a
 * discharge to the community, and for one PR it did not (see the rewritten destination test below).
 *
 * So this mounts inside the SAME provider the board dispatches into and renders the reducer's own
 * departures as attributes. It is a probe, not a product surface: nothing outside this file may
 * rely on these test ids, and if the board ever renders the destination itself, this should be
 * deleted in favour of reading that.
 */
function DepartureProbe({ unitId }: { unitId: string }) {
  const { admissions } = useWardFlow();
  return (
    <ul data-testid="model-departures">
      {admissions
        .filter((admission) => admission.unitId === unitId && admission.state === "departed")
        .map((admission) => (
          <li
            key={admission.id}
            data-testid={`model-departure-${admission.id}`}
            data-admission-id={admission.id}
            data-destination={admission.leavingDestination ?? "no destination recorded"}
          />
        ))}
    </ul>
  );
}

function renderBoardWithModelProbeAt(unitId: string, now: number) {
  return render(
    <WardFlowProvider initialNow={now}>
      <WardBoard unitId={unitId} />
      <DepartureProbe unitId={unitId} />
    </WardFlowProvider>,
  );
}

/** Selects the first occupied bed tile on screen and returns the detail panel. */
function selectAnOccupiedBed() {
  const beds = screen.getByTestId("ward-board-beds");
  const occupiedTile = within(beds)
    .getAllByRole("listitem")
    .find((tile) => tile.getAttribute("data-bed-kind") === "occupied");
  if (!occupiedTile) throw new Error("the board rendered no occupied bed tile");
  fireEvent.click(within(occupiedTile).getByRole("button"));
  return screen.getByTestId("ward-board-detail");
}

describe("recording a departure from the ward board", () => {
  it("offers the control on an occupied bed, with every destination the model allows", () => {
    const { unitId } = aWardWithAnOccupant();
    renderBoardAt(unitId, OFF_ANCHOR);
    selectAnOccupiedBed();

    expect(screen.getByTestId("ward-board-record-leaving")).toBeTruthy();
    const destinations = screen.getByTestId("ward-board-leaving-destination");
    /*
     * Derived from LEAVING_DESTINATIONS rather than hard-coded, changed 2026-09-01 when the owner
     * added three. The old assertion read `toHaveLength(5)` and went red the moment the list grew —
     * correctly, but it made an ADDITION look like a regression.
     *
     * Asserting against the list's own length keeps what the original comment wanted (a reworded
     * label survives, a REMOVED destination does not) and stops a legitimate addition failing here
     * instead of in the file that owns the list.
     */
    expect(within(destinations).getAllByRole("option")).toHaveLength(LEAVING_DESTINATIONS.length);
    expect(LEAVING_DESTINATIONS.length, "the list emptied out; this assertion would pass on zero").toBeGreaterThan(4);
  });

  it("does NOT offer it on a bed nobody is in", () => {
    /*
     * An empty, held or out-of-service tile stands for a CLASS of bed rather than a person, so
     * there is nobody to discharge. Offering a control that the reducer would then refuse is how a
     * prototype teaches a clinician to distrust its controls.
     */
    const { unitId } = aWardWithAnOccupant();
    renderBoardAt(unitId, OFF_ANCHOR);

    const beds = screen.getByTestId("ward-board-beds");
    const notAPerson = within(beds)
      .getAllByRole("listitem")
      .find((tile) => {
        const kind = tile.getAttribute("data-bed-kind");
        return kind === "empty" || kind === "held" || kind === "blocked";
      });
    if (!notAPerson) throw new Error("the seed ward has no non-person tile to check");

    fireEvent.click(within(notAPerson).getByRole("button"));
    expect(screen.queryByTestId("ward-board-record-leaving")).toBeNull();
  });

  it("frees the bed on the board itself: one fewer occupant, one more the ward can release", () => {
    /*
     * THE ASSERTION THIS FILE EXISTS FOR, and the one the rest of the suite structurally cannot
     * make. It reads a figure the reducer changes, off-anchor, and compares it to what the board
     * showed BEFORE the event rather than to anything recomputed from the seed. If this board ever
     * goes back to reading seed state, the count cannot move and this fails.
     */
    const { unitId } = aWardWithAnOccupant();
    renderBoardAt(unitId, OFF_ANCHOR);

    const beds = screen.getByTestId("ward-board-beds");
    const occupiedBefore = within(beds)
      .getAllByRole("listitem")
      .filter((tile) => tile.getAttribute("data-bed-kind") === "occupied").length;
    const freeBefore = within(beds)
      .getAllByRole("listitem")
      .filter((tile) => {
        const kind = tile.getAttribute("data-bed-kind");
        return kind === "empty" || kind === "held";
      }).length;

    selectAnOccupiedBed();
    fireEvent.click(screen.getByTestId("ward-board-record-leaving-submit"));

    const after = screen.getByTestId("ward-board-beds");
    const occupiedAfter = within(after)
      .getAllByRole("listitem")
      .filter((tile) => tile.getAttribute("data-bed-kind") === "occupied").length;
    const freeAfter = within(after)
      .getAllByRole("listitem")
      .filter((tile) => {
        const kind = tile.getAttribute("data-bed-kind");
        return kind === "empty" || kind === "held";
      }).length;

    expect(occupiedAfter, "the departing person is still shown in a bed").toBe(occupiedBefore - 1);
    /*
     * ⚠️ EMPTY **OR HELD**, and the distinction is the design rather than a looser assertion.
     *
     * The first version of this test expected an EMPTY tile and got a held one. The held one is
     * correct: `RECORD_LEAVING` raises the ward's `empty` count but deliberately does NOT raise
     * `allocatable`, because `allocatable` is the ward's own claim about what it can actually
     * fill, and a bed whose occupant has just walked out is not yet a bed the ward has offered.
     * `held` on this board means exactly that — physically empty, not yet offered — so a just-
     * vacated bed landing there is the model working, not a rounding error.
     *
     * Asserted as the pair so the test pins what matters (the bed stops being occupied and becomes
     * available to the ward's own release flow) without freezing which side of that flow it sits on
     * the instant the person leaves.
     */
    expect(freeAfter, "the bed they left is still counted as occupied").toBe(freeBefore + 1);
  });

  it("closes the panel, because the person it described has gone", () => {
    const { unitId } = aWardWithAnOccupant();
    renderBoardAt(unitId, OFF_ANCHOR);
    selectAnOccupiedBed();

    expect(screen.getByTestId("ward-board-detail-person")).toBeTruthy();
    fireEvent.click(screen.getByTestId("ward-board-record-leaving-submit"));

    // Left open, the panel would describe a bed this ward no longer fills.
    expect(screen.queryByTestId("ward-board-record-leaving")).toBeNull();
    expect(screen.getByTestId("ward-board-select-hint")).toBeTruthy();
  });

  it("records the destination the ward chose, not the default", () => {
    /*
     * A transfer to another psychiatric ward is the one destination of the eight that is NOT a
     * statewide release: this ward's bed frees, but the person still occupies a bed somewhere in
     * the system. So the defect this test guards is the difference between somebody recorded as
     * still in care and somebody recorded as out of it.
     *
     * ⚠️ REWRITTEN 2026-09-01, BECAUSE THE VERSION THAT STOOD HERE COULD NOT FAIL. It asserted
     * `destinations.value` — the native `<select>` handing back the value `fireEvent.change` had
     * just written into it, which is jsdom's own behaviour and not a line of this project's code —
     * then clicked submit and asserted a hint element was truthy. It never looked at the model.
     *
     * Hardcoding the dispatch's `leavingDestination` to `LEAVING_DESTINATIONS[0].id`
     * ("Discharged to the community", which DOES count as a statewide release) left it green — and
     * left the whole file green: all five tests passed while every discharge recorded from this
     * board carried the wrong destination.
     *
     * It now reads the departure the REDUCER recorded, through the same provider the board
     * dispatches into, and diffs against the departures already on this ward before the click so a
     * seeded departure cannot stand in for the one this test made.
     */
    const chosen = "transferred-to-another-psychiatric-ward";
    const fallback = LEAVING_DESTINATIONS[0];

    /* Anti-vacuity, first and not ceremony. If the destination this test picks ever becomes the
     * one the control already defaults to, every assertion below passes on a submit button wired
     * to a constant — which is the exact defect being guarded against. */
    expect(chosen, "the chosen destination is the control's own default; this test cannot discriminate").not.toBe(
      fallback.id,
    );
    const chosenDestination = LEAVING_DESTINATIONS.find((destination) => destination.id === chosen);
    if (!chosenDestination) throw new Error(`the model no longer offers ${chosen}`);
    /* And the clinical half of the difference, pinned rather than assumed: a wrong destination here
     * is not a cosmetic label, it is the statewide flag flipping. */
    expect(chosenDestination.countsAsStatewideRelease, "a transfer to another ward is not a release").toBe(false);
    expect(fallback.countsAsStatewideRelease, "the default is no longer a release, so the two agree").toBe(true);

    const { unitId } = aWardWithAnOccupant();
    renderBoardWithModelProbeAt(unitId, OFF_ANCHOR);

    const departuresInModel = () =>
      screen.queryAllByTestId(/^model-departure-/u).map((row) => ({
        id: row.getAttribute("data-admission-id") ?? "",
        destination: row.getAttribute("data-destination") ?? "",
      }));

    const alreadyGone = new Set(departuresInModel().map((departure) => departure.id));

    selectAnOccupiedBed();
    const destinations = screen.getByTestId("ward-board-leaving-destination") as HTMLSelectElement;
    fireEvent.change(destinations, { target: { value: chosen } });
    fireEvent.click(screen.getByTestId("ward-board-record-leaving-submit"));

    const recorded = departuresInModel().filter((departure) => !alreadyGone.has(departure.id));
    expect(recorded, "clicking Record that they have left put no new departure in the model").toHaveLength(1);
    expect(
      recorded[0].destination,
      `the ward chose "${chosenDestination.label}" and the model recorded "${recorded[0].destination}"` +
        (recorded[0].destination === fallback.id
          ? ` — the first option in the list, so the chosen destination never reached the reducer`
          : ""),
    ).toBe(chosen);
  });
});
