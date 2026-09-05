import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-05, AND THE RE-POINT CLOSED A LIVE HOLE RATHER
 * THAN JUST MOVING A GREEN TICK.**
 *
 * This file used to render `<WardModeWorkspace mode="capacity" />`. MERGE 02 replaced that mode
 * with `CapacityScreen` and re-pointed the route, so the mode became unreachable and this clinical
 * guard went on passing about a screen no coordinator can open —
 * `ward-mode-workspace-reachability.test.ts` is what reports that.
 *
 * ⚠️ **THE OBVIOUS CONCLUSION — "the live screen already guards this, so just retire the file" —
 * WAS MEASURED AND IS FALSE.** `ward-capacity-screen.dom.test.tsx` carries a case named *"says who
 * confirmed each capacity figure, and never attributes a derived one to a ward"*, added during the
 * fold with a comment saying the property is "guarded here on the LIVE screen". **It cannot fail,
 * in either direction, and this was proved by mutation rather than by reading:**
 *
 *   - Its POSITIVE half asserts `toHaveTextContent(row.unit.name)` against the whole `<tr>`. The
 *     row's first cell already renders `<strong>{row.unit.name}</strong>` as the Ward column, so
 *     that assertion is satisfied by the ward's own name whatever the freshness stamp says.
 *   - Its NEGATIVE half loops over rows whose `allocatable.source !== "ward"`. **Every unit in
 *     `ward-sites.ts` seeds `allocatable.source: "ward"`** — the 23 `"feed"` values in that file
 *     are all on `empty`, a different field — so the loop iterates zero rows.
 *
 *   Two controls, 2026-09-05, source hash `51263c10` before and after each:
 *     - Deleting the attribution (`confirmedByRole={undefined}`): all 16 tests in
 *       `ward-capacity-screen.dom.test.tsx` stayed GREEN; here it fails the third case by name.
 *     - Restoring review Finding 6 itself (`confirmedByRole` unconditional AND `derived={false}`,
 *       the pre-fix state): `ward-capacity-screen.dom.test.tsx` again 16/16 GREEN; here it fails
 *       the second case by name and nothing else.
 *
 *   ⚠️ The second control had to be run TWICE. The first attempt used `perl -0pi -e` and perl
 *   interpolated `${row.unit.name}` inside its own replacement string, so the mutant that actually
 *   ran was `confirmedByRole={`NUM `}` — a different defect from the one being named. The verdict
 *   happened to be the same; the reasoning would not have been. **Read the mutated line back
 *   before believing a control.**
 *
 * **So this file is not redundant with that one; it is the only thing that can reach the defect.**
 * It mocks `useWardFlow` to construct the one state a real dispatch cannot produce — a feed-sourced
 * unit — because `CONFIRM_CAPACITY` only ever writes `source: "ward"` and no fixture seeds anything
 * else. That was this file's reason for existing against the old mode (review Finding 6) and it is
 * unchanged by the fold; only the screen under it moved.
 *
 * ⚠️ **AND THE ASSERTIONS BELOW ARE SCOPED TO THE STAMP, NEVER THE ROW**, precisely so they cannot
 * inherit the tautology described above: `/^Confirmed /` and `/^As at /` match the freshness
 * `<span>`'s own text, which the Ward column can never satisfy.
 */
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return { ...actual, useWardFlow: () => mockContext };
});

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seeded = seedWardFlowState();
const FEED_UNIT = seeded.units[0]!;
const WARD_UNIT = seeded.units[1]!;

const mockContext = {
  ...seeded,
  units: seeded.units.map((unit) =>
    unit.id === FEED_UNIT.id ? { ...unit, allocatable: { ...unit.allocatable, source: "feed" as const } } : unit,
  ),
  now: NOW_ANCHOR,
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

function networkRow(unitId: string) {
  const table = screen.getByTestId("ward-capacity-network-table");
  return within(table).getByTestId(`ward-capacity-network-row-${unitId}`);
}

describe("the Capacity screen's freshness stamp reflects allocatable.source, never an unconditional ward confirmation", () => {
  it("has both a feed-sourced and a ward-sourced unit to render, or both assertions below are vacuous", () => {
    /*
     * ⚠️ The anti-vacuity floor is the whole reason the file mocks the provider. Against the real
     * fixture the feed-sourced half of this guard has NOTHING to stand over — which is exactly how
     * the live screen's own version of this assertion came to be unfailable.
     */
    expect(mockContext.units.filter((unit) => unit.allocatable.source !== "ward").length).toBeGreaterThan(0);
    expect(mockContext.units.filter((unit) => unit.allocatable.source === "ward").length).toBeGreaterThan(0);
    expect(FEED_UNIT.id).not.toBe(WARD_UNIT.id);
  });

  it("renders 'As at HH:MM' for a feed-sourced unit, never a false ward attribution (review Finding 6)", () => {
    render(<CapacityScreen />);
    const row = networkRow(FEED_UNIT.id);

    // The defect this suite exists to catch: passing `confirmedByRole` unconditionally makes every
    // row read "Confirmed HH:MM · NUM <ward>" even where the ward never stood behind the figure.
    expect(
      within(row).queryByText(/^Confirmed /u),
      `${FEED_UNIT.id} is feed-sourced: no ward confirmed this figure, so the stamp must not say one did`,
    ).not.toBeInTheDocument();
    expect(within(row).getByText(/^As at /u)).toBeInTheDocument();
  });

  it("still names the ward on a ward-sourced unit's stamp, so the fix above cannot be 'drop the attribution'", () => {
    render(<CapacityScreen />);
    const row = networkRow(WARD_UNIT.id);

    /*
     * ⚠️ Matched against the STAMP's own text (`^Confirmed … · NUM <name>$`), not against the row.
     * The row contains the ward's name in its Ward column regardless, so a row-scoped
     * `toHaveTextContent(name)` here would pass with the attribution deleted — measured, see the
     * file header.
     */
    expect(within(row).getByText(new RegExp(`^Confirmed .* · NUM ${WARD_UNIT.name}$`, "u"))).toBeInTheDocument();
    expect(within(row).queryByText(/^As at /u)).not.toBeInTheDocument();
  });
});
