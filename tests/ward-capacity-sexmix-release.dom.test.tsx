import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-06, AFTER THE SIGNAL IT ASKS FOR WAS BUILT.**
 *
 * This file rendered `<WardModeWorkspace mode="capacity" />`. MERGE 02 replaced that mode, so it
 * has been protecting a test rather than a user — the last of the seven files
 * `ward-mode-workspace-reachability.test.ts` reported.
 *
 * **The clinical property is unchanged and is Ward Lead's ruling of 2026-09-05.** `RELEASE_BED`
 * raises `allocatable.value` and `empty.value` together (`ward-flow-reducer.ts` 2335-2343, read
 * rather than recalled) and **never touches `sexMix`** — the model cannot know which sex left, and
 * guessing a decrement would invent a fact about a person. So for a moment a ward's recorded
 * male/female total and its occupancy disagree, and `allocatable` — which is what `ready` reads —
 * has just moved. The screen must say the figure may not have settled.
 *
 * ⚠️ **THE SIGNAL, NEVER THE DATA, AND THE THIRD CASE BELOW ENFORCES THAT.** The old version
 * asserted a rendered sex mix ("Female 9 · Male 9") because the retired board showed one. This
 * screen shows none, and whether those counts belong on a network view is still an open question
 * for the owner. A test that demanded them here would prejudge it — so instead this pins that no
 * such figure leaks onto the screen along with the warning.
 */
function ReleaseWr001() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({ type: "RELEASE_BED", role: "ward", now, releaseId: "WR-001", actingUnitId: "rph-adult-secure" })
      }
    >
      release WR-001
    </button>
  );
}

const SUBJECT = "rph-adult-secure";

function renderBoard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
      <ReleaseWr001 />
    </WardFlowProvider>,
  );
}

describe("the Capacity screen says when a ward's bed records are mid-update", () => {
  it("fixture precondition: every ward's recorded sex mix matches its occupancy at seed", () => {
    /*
     * ⚠️ The anti-vacuity floor, and it runs in the harder direction. If any ward already
     * disagreed at seed, the "silent before" case below would be asserting an absence that was
     * never there to lose, and the "present after" case could pass on a screen that warned
     * unconditionally.
     */
    const disagreeing = networkWardRows(allUnits(), NOW_ANCHOR, bedReleases)
      .filter((row) => row.bedRecordsMidUpdate)
      .map((row) => row.unit.id);
    expect(disagreeing, "a seeded ward already disagrees, so both cases below are weakened").toEqual([]);
    expect(allUnits().length, "no units to check").toBeGreaterThan(1);
  });

  it("says nothing on a settled board", () => {
    renderBoard();
    expect(
      screen.queryByTestId(`ward-capacity-mid-update-${SUBJECT}`),
      "a caution shown on a settled board would be ignored within a day and make every figure look doubtful",
    ).not.toBeInTheDocument();
  });

  it("warns on the ward whose bed was released, and on no other ward", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "release WR-001" }));

    expect(
      screen.getByTestId(`ward-capacity-mid-update-${SUBJECT}`),
      "the released ward's figure moved and nothing says it may not have settled",
    ).toHaveTextContent(/may not be settled/iu);

    /*
     * The direction check, carried across from the retired version: the warning is scoped to the
     * ward that actually changed. Without it, a screen warning on every row would pass the
     * assertion above while telling a coordinator that no figure anywhere can be trusted.
     */
    const others = allUnits().filter((unit) => unit.id !== SUBJECT);
    expect(others.length).toBeGreaterThan(0);
    for (const unit of others) {
      expect(
        screen.queryByTestId(`ward-capacity-mid-update-${unit.id}`),
        `${unit.id}'s records did not change and it must not claim to be mid-update`,
      ).not.toBeInTheDocument();
    }
  });

  it("carries the signal without putting any sex-mix figure on the screen", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "release WR-001" }));

    const row = within(screen.getByTestId("ward-capacity-network-table")).getByTestId(
      `ward-capacity-network-row-${SUBJECT}`,
    );
    /*
     * `Female`/`Male` as whole words. Matched on the row rather than the document so an unrelated
     * mention elsewhere on the page cannot fail this, and matched as words so "female" inside a
     * longer clinical phrase is not caught by accident.
     */
    expect(row.textContent ?? "", "a sex-mix figure reached a screen that carries only the signal").not.toMatch(
      /\b(Female|Male)\b/u,
    );
  });
});
