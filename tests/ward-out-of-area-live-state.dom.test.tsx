import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  OutOfAreaBoard,
  sinceArrivalLabel,
} from "@/components/ward-management/out-of-area/out-of-area-board";
import { seedWardFlowState, seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { allUnits } from "@/components/ward-management/ward-sites";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ⚠️ A FIXED, NON-ZERO ANCHOR OFFSET — the condition under which this defect exists and the one
 * every other DOM test in this project removes.
 *
 * `wallClockNow()` returns minutes-into-the-day (0-1439), so 0 is a real reading — midnight — and
 * gives an offset of 0 - 642 = -642 minutes against the fixture's anchor. Mocked rather than taken
 * from the real clock so the assertions are deterministic; `importActual` keeps every other clock
 * export intact, because the component and the provider both use several.
 *
 * ⚠️ **THE VALUE IS CHOSEN, NOT ARBITRARY, AND THE FIRST ONE I PICKED PROVED NOTHING.** The offset
 * only changes a WHOLE-DAY figure for an admission near a day boundary, and every seeded arrival
 * sits 90 minutes into its day. A positive offset cannot reach 1440 from there (the largest
 * available is +797), so at 23:59 the live and frozen readings agree and the test passes against
 * either data source. Midnight's -642 crosses backwards and they diverge. The canary below is what
 * caught that, on the first run, before the assertion could pass for the wrong reason.
 */
const MOCKED_WALL_CLOCK = 0;

vi.mock("@/components/ward-management/ward-clock", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-clock")>()),
  wallClockNow: () => MOCKED_WALL_CLOCK,
}));

/**
 * A LENGTH OF STAY IS COUNTED FROM THE SAME CLOCK THE ARRIVAL WAS RECORDED ON.
 *
 * Ward Board found this shape on `edPressure`: a seed-module parameter default, omitted by every
 * caller, so a RE-ANCHORED `now` was subtracted from an UN-RE-ANCHORED fixture. One side of the
 * subtraction moved. This file is the second instance, which Board's fix did not reach and nobody
 * had reported:
 *
 *     OutOfAreaBoard({ admissions = wardAdmissions })   // the frozen seed
 *     const { units, now } = useWardFlow();             // re-anchored to the hour the demo opens
 *
 * ⚠️ **AND THIS SCREEN IS THE WORST PLACE IN THE PROTOTYPE FOR IT, BECAUSE IT RENDERS DAYS IN A
 * BED.** Board's own framing: *a wrong clock looks wrong; a wrong length of stay looks PLAUSIBLE.*
 * A patient shown as eighteen days out of area instead of nine is a believable number on a screen
 * built to be believed, and out-of-area duration is exactly the figure that gets escalated on.
 *
 * ⚠️ **THE TRAP IN TESTING IT, WHICH IS WHY THE OLD SUITE WAS EXHAUSTIVE AND STILL BLIND.** Every
 * existing DOM test pins `initialNow`, which makes the anchor offset ZERO — and at zero offset the
 * shifted and unshifted fixtures are identical, so the bug cannot appear. Every unit test passed
 * `admissions` explicitly, which never takes the default. The suite covered the parameter
 * thoroughly and never once covered its ABSENCE at a non-zero offset, the only condition in which
 * the defect exists. **So this file renders `<OutOfAreaBoard />` with NO prop, which is exactly how
 * the route renders it.**
 */
describe("the out-of-area board reads live admissions, not the frozen seed", () => {
  it("renders with no prop at all, the way the route does", () => {
    // If this component still defaulted to the seed module, this render would silently use it and
    // every assertion about content below would still pass — which is why the real proof is the
    // absence of the seed import, asserted in the sibling test.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OutOfAreaBoard />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-out-of-area-board")).toBeInTheDocument();
  });

  it("⚠️ DOES NOT IMPORT THE ADMISSIONS SEED AT ALL — the only durable form of this guard", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      "src/components/ward-management/out-of-area/out-of-area-board.tsx",
      "utf8",
    );
    expect(
      source.includes("ward-admissions-seed"),
      "this screen must take its admissions from the provider, which re-anchors them to the same " +
        "clock `now` is on. Importing the seed module here is the whole defect: a default nobody " +
        "passes, subtracted from a clock that has moved. Reach the fixture through " +
        "`WardFlowProvider` in tests instead.",
    ).toBe(false);
  });

  it("⚠️ RENDERS THE STAY LENGTH THE LIVE CLOCK GIVES, at a NON-ZERO anchor offset", () => {
    /*
     * THE CONDITION EVERY OTHER DOM TEST IN THIS PROJECT EXCLUDES BY CONSTRUCTION.
     *
     * `initialNow` is deliberately NOT passed here. Passing it makes the anchor offset zero, and at
     * zero offset the shifted and unshifted fixtures are byte-identical — so a screen reading the
     * frozen seed and a screen reading live state render the same thing and no assertion can tell
     * them apart. That is why the defect survived a suite that covered this component thoroughly.
     *
     * With no `initialNow` the provider takes `wallClockNow() - NOW_ANCHOR`, mocked below to a
     * fixed value so this stays deterministic. The provider then shifts the seed by that offset and
     * sets `now = NOW_ANCHOR + offset + elapsed`, so for LIVE admissions the offset cancels in
     * `now - arrivedAt` and the stay length is right. For SEED admissions it does not cancel, and
     * every stay is inflated by the offset.
     */
    const offset = MOCKED_WALL_CLOCK - NOW_ANCHOR;
    expect(offset, "the mocked clock must give a real offset or this test is the zero-offset one").not.toBe(0);

    const units = allUnits();
    const nowLive = NOW_ANCHOR + offset;
    const live = outOfAreaLedger(seedWardFlowStateAt(offset).admissions, units, nowLive);
    const frozen = outOfAreaLedger(seedWardFlowState().admissions, units, nowLive);

    const liveLabels = live.entries.map((entry) => sinceArrivalLabel(entry, nowLive));
    const frozenLabels = frozen.entries.map((entry) => sinceArrivalLabel(entry, nowLive));

    // ⚠️ The canary, and it is the whole reason this test can prove anything. The offset is under a
    // day, so it only changes a WHOLE-DAY figure for an admission near a day boundary. If no entry
    // crosses one, both readings agree and every assertion below passes against either data source.
    expect(
      liveLabels,
      `no stay length differs between the live and frozen fixtures at an offset of ${offset} ` +
        "minutes, so this test cannot distinguish them. Choose a MOCKED_WALL_CLOCK that moves at " +
        "least one admission across a day boundary rather than deleting this assertion.",
    ).not.toEqual(frozenLabels);

    // No `initialNow` on the provider either — that is the point.
    render(
      <WardFlowProvider>
        <OutOfAreaBoard />
      </WardFlowProvider>,
    );
    for (const label of liveLabels) {
      expect(
        screen.getAllByText(label).length,
        `the screen must show "${label}", the stay length the live clock gives. If it is showing ` +
          "the frozen fixture's figure instead, every length of stay here is inflated by the " +
          "anchor offset — and a wrong length of stay looks entirely plausible.",
      ).toBeGreaterThan(0);
    }
  });

  it("keeps an override for tests, and the override still works", () => {
    // The injection point was never the problem — Board's lesson. What was wrong was that omitting
    // it reached the seed. Omitting it now reaches live state, so the override can stay.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OutOfAreaBoard admissions={[]} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-out-of-area-board")).toBeInTheDocument();
  });
});
