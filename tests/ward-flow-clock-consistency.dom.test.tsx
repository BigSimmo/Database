import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **RE-POINTED AT `MovementsScreen` ON 2026-09-05.** This file rendered `<WardModeWorkspace
 * mode="movements" />`; MERGE 03 replaced that mode with `MovementsScreen` and re-pointed the
 * route, so the pin went on passing over a screen no coordinator can open.
 *
 * **The property is unchanged and is not about wording:** a board that displays elapsed time must
 * read the LIVE shared clock, not a value captured when the module was imported. `ADVANCE_CLOCK`
 * folds into `clockOffsetMinutes` in the provider and therefore into the `now` every screen reads;
 * a screen that reached for the frozen `NOW_ANCHOR` constant instead would render correct-looking
 * durations forever while the rest of the app moved on — two screens disagreeing about one
 * patient, which is the defect this file was written for.
 *
 * ⚠️ **NOTHING ELSE ON THIS SCREEN ADVANCES THE CLOCK, WHICH IS WHY THIS FILE STILL EARNS ITS
 * PLACE.** `ward-movements-screen.dom.test.tsx` renders at a pinned `initialNow` and never moves
 * it — every one of its assertions is a photograph. Measured by mutation, 2026-09-05, source hash
 * `ca510d77` before and after: replacing the screen's `now` with the imported `NOW_ANCHOR`
 * constant left all 15 of its cases GREEN, and failed *"moves an open movement's journey time when
 * the shared clock advances"* here, alone and by name.
 *
 * ⚠️ **THE SECOND CASE IS THE OTHER HALF OF THE SAME MECHANISM AND HAS NEVER BEEN CHECKED UNDER A
 * MOVING CLOCK.** `StageRow` freezes a closed movement's clock at `closure.at` rather than
 * counting on to `now`. That is guarded today only at a standstill, where "frozen at closure.at"
 * and "counting to now" are two fixed numbers that happen to differ. Under an advancing clock the
 * distinction becomes the behaviour a reader actually relies on: the closed row must not move
 * while the open row beside it does. Its own control: `clockEnd = now` fails *"leaves a closed
 * movement's frozen clock where it is while the clock moves around it"*, alone and by name.
 *
 * Expected durations are computed with the screen's own `splitDuration` against the record's own
 * `openedAt`/`closure.at`, never written in — a fixture change moves the expectation with it.
 */

/** Raises the same `ADVANCE_CLOCK` demo event the demo controls dispatch, so this test can move the
 *  shared clock without reaching into the reducer. Mirrors `DispatchProbe` in
 *  ward-flow-provider.dom.test.tsx. */
function ClockAdvancer({ minutes }: { minutes: number }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}>
      advance clock
    </button>
  );
}

const ADVANCE_BY = 60;

/*
 * ⚠️ Both subjects are DISCOVERED from the fixture rather than named, and the discovery is floored
 * below. `journeyStages` groups by stage with no open/closed filter, so a closed movement genuinely
 * sits in a stage group beside open ones — that adjacency is the whole reason the freeze exists.
 */
const OPEN_SUBJECT = wardMovements.find((movement) => movement.closure === undefined);
const CLOSED_SUBJECT = wardMovements.find((movement) => movement.closure !== undefined && movement.stage !== "arrived");

function renderBoard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MovementsScreen />
      <ClockAdvancer minutes={ADVANCE_BY} />
    </WardFlowProvider>,
  );
  return screen.getByRole("region", { name: /Where each move has got to/u });
}

function rowFor(board: HTMLElement, id: string): HTMLElement {
  const idNode = within(board).getByText(id, { selector: "[data-ward-primitive='record-id']" });
  return idNode.closest("[data-ward-primitive='record-row']") as HTMLElement;
}

describe("the movements board reads the live shared clock, not a value frozen at import", () => {
  it("has an open movement and a closed one sitting in stage groups, or both cases below are vacuous", () => {
    expect(OPEN_SUBJECT, "no open movement in the fixture — nothing can demonstrate a moving clock").toBeDefined();
    expect(
      CLOSED_SUBJECT,
      "no closed movement sits in a stage group — the freeze case below would have nothing to stand over",
    ).toBeDefined();
  });

  it("moves an open movement's journey time when the shared clock advances", () => {
    const movement = OPEN_SUBJECT!;
    const before = splitDuration(NOW_ANCHOR - movement.openedAt);
    const after = splitDuration(NOW_ANCHOR + ADVANCE_BY - movement.openedAt);
    /*
     * The two renderings must actually differ, or a screen reading a frozen constant would pass
     * this by coincidence. Floored rather than escaped: an `if (before !== after)` guard here would
     * quietly skip and report a pass, which is worse than not checking.
     */
    expect(before, "the advance does not change this movement's displayed duration").not.toBe(after);

    const board = renderBoard();
    expect(rowFor(board, movement.id)).toHaveTextContent(before);

    fireEvent.click(screen.getByRole("button", { name: "advance clock" }));

    const row = rowFor(board, movement.id);
    expect(row).toHaveTextContent(after);
    expect(row).not.toHaveTextContent(before);
  });

  it("leaves a closed movement's frozen clock where it is while the clock moves around it", () => {
    const movement = CLOSED_SUBJECT!;
    const frozen = splitDuration(Math.max(movement.closure!.at - movement.openedAt, 0));
    const ifItHadKeptRunning = splitDuration(NOW_ANCHOR + ADVANCE_BY - movement.openedAt);
    expect(
      frozen,
      "the frozen and still-running figures render identically for this movement, so this case " +
        "cannot discriminate. Pick a different subject rather than trusting the green.",
    ).not.toBe(ifItHadKeptRunning);

    const board = renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "advance clock" }));

    const row = rowFor(board, movement.id);
    expect(
      row,
      `${movement.id} closed at its own recorded instant; its journey time must not follow now`,
    ).toHaveTextContent(frozen);
    expect(row).not.toHaveTextContent(ifItHadKeptRunning);
  });
});
