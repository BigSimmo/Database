import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

// Same reason as every sibling dom suite (ward-handover.dom.test.tsx, ward-ed-screen.dom.test.tsx):
// `ClinicalRail` renders next/link anchors and this suite never checks routing, so a plain <a>
// avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EVENING_SHIFT_END_MINUTES } from "@/components/ward-management/ward-bed-availability";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DischargeBoard />
    </WardFlowProvider>,
  );
}

/**
 * Raises a real `FLAG_BED_RELEASE` reducer event — the same mechanism `ward-handover.dom.test.tsx`'s
 * `ClockAdvancer` uses to move shared state without reaching into the reducer directly — carrying
 * an explicit `expectedAt` two full days out, safely beyond the rolling horizon WB-DB-7 introduced. `FLAG_BED_RELEASE`
 * carries the ward's own estimate as `event.expectedAt` (see `ward-flow-events.ts`'s own doc
 * comment); this is a real, reducer-produced `BedRelease` whose `expectedAt` genuinely falls
 * beyond tonight — not a fixture or component change, and independent of the board's own live
 * `now` (pinned at `NOW_ANCHOR`).
 */
function FarFutureReleaseFlagger() {
  const { dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "FLAG_BED_RELEASE",
          role: "ward",
          now: EVENING_SHIFT_END_MINUTES + 100,
          unitId: "rph-adult-secure",
          actingUnitId: "rph-adult-secure",
          waitingOn: "Nothing outstanding",
          expectedAt: NOW_ANCHOR + 2 * MINUTES_PER_DAY,
        })
      }
    >
      flag far-future release
    </button>
  );
}

/**
 * The rendered "Expected" cell of every data row in a group's table — the third column, which
 * `discharge-board.tsx` fills with `BAND_LABELS[releaseBand(release, now)]`. Read through the
 * rendered table rather than by calling `releaseBand` again, so the assertion fails if the band
 * the screen SHOWS stops matching the clock the provider serves.
 */
function expectedColumn(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[2]?.textContent ?? "");
}

describe("DischargeBoard", () => {
  it("groups releases under Blocked, Confirmed, Expected, Discharged today, in that exact order", () => {
    renderBoard();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Blocked", "Confirmed", "Expected", "Discharged today"]);
  });

  it("names the blocker on a blocked row", () => {
    renderBoard();

    // WR-007 in the real fixture (ward-movements.ts) is blocked with blocker "Awaiting
    // accommodation" — chosen from BED_RELEASE_BLOCKERS, never free text.
    const blockedTable = screen.getByTestId("ward-discharge-table-blocked");
    expect(within(blockedTable).getByText("Awaiting accommodation")).toBeInTheDocument();
  });

  /**
   * Bed-model rework (2026-08-28). The Blocked group is now keyed on the FLAG, not on a state, so
   * it holds releases at two different stages at once — and every row states its own stage.
   * Without that column the group would swallow the fact this rework exists to preserve: that a
   * stuck discharge can be one the ward has already DECIDED. A coordinator who cannot tell a
   * blocked prediction from a blocked confirmation cannot tell which bed to chase first.
   *
   * The real fixture seeds exactly this pair — WR-007 confirmed-and-blocked at fsh-adult-secure,
   * WR-009 expected-and-blocked at rgh-adult-secure — so the assertion is over a genuinely mixed
   * group, not one row that happens to agree with whatever the implementation prints.
   */
  it("states each blocked row's own stage, so a blocked confirmation is not mistaken for a blocked prediction", () => {
    renderBoard();

    const blockedTable = screen.getByTestId("ward-discharge-table-blocked");
    const dataRows = within(blockedTable).getAllByRole("row").slice(1);
    expect(dataRows).toHaveLength(2);

    const stagesByUnit = new Map(
      dataRows.map((row) => {
        const cells = within(row).getAllByRole("cell");
        return [cells[0].textContent, cells[3].textContent];
      }),
    );
    expect(stagesByUnit.get("FSH Adult Secure")).toBe("Confirmed");
    expect(stagesByUnit.get("RGH Adult Secure")).toBe("Expected");
  });

  /**
   * The grouping rule itself, stated as a rule rather than inferred from the fixture: the flag is
   * read BEFORE the stage. A blocked-but-confirmed release belongs in Blocked (the group a
   * coordinator scans first) and must NOT also appear under Confirmed — this board is a work
   * queue, where each release appears exactly once. That is deliberately the opposite trade-off
   * from `CapacityBreakdown.blockedToday`, which is a set of counts and cross-cuts on purpose.
   */
  it("puts a blocked-but-confirmed release in Blocked and nowhere else", () => {
    renderBoard();

    const confirmedTable = screen.getByTestId("ward-discharge-table-confirmed");
    expect(within(confirmedTable).queryByText("FSH Adult Secure")).not.toBeInTheDocument();

    const blockedTable = screen.getByTestId("ward-discharge-table-blocked");
    expect(within(blockedTable).getByText("FSH Adult Secure")).toBeInTheDocument();
  });

  it("renders each row's confirming role exactly once — never duplicated alongside the freshness stamp", () => {
    renderBoard();

    // WR-007 (fixture: ward-movements.ts) is blocked at fsh-adult-secure with
    // confirmedBy "NUM FSH Adult Secure". `WardFreshness` already renders that role inside its
    // own "Confirmed HH:MM · <role>" stamp, so the role string must appear exactly once per
    // rendering (table row, and separately the phone card) — a count, not mere presence, so a
    // reintroduced standalone `{release.confirmedBy}` line is caught rather than tolerated.
    const blockedTable = screen.getByTestId("ward-discharge-table-blocked");
    const tableOccurrences = blockedTable.textContent?.match(/NUM FSH Adult Secure/g) ?? [];
    expect(tableOccurrences).toHaveLength(1);

    const blockedCards = screen.getByTestId("ward-discharge-cards-blocked");
    const cardOccurrences = blockedCards.textContent?.match(/NUM FSH Adult Secure/g) ?? [];
    expect(cardOccurrences).toHaveLength(1);
  });

  it("states the excluded-beyond-today count as the literal digit 0 when nothing is excluded", () => {
    renderBoard();

    // The real fixture's nine bed releases all fall at or before EVENING_SHIFT_END_MINUTES
    // (22:00) from NOW_ANCHOR — none is beyond tonight, so the count must render as 0, not be
    // hidden and not be worded as "none".
    const excluded = screen.getByTestId("ward-discharge-excluded");
    expect(excluded).toHaveTextContent(/^0\b/);
    expect(excluded.textContent?.toLowerCase()).not.toContain("none");
  });

  it("gives every row in every non-empty group a freshness stamp", () => {
    renderBoard();

    for (const key of ["blocked", "confirmed", "expected", "discharged-today"]) {
      const table = screen.getByTestId(`ward-discharge-table-${key}`);
      const rows = within(table).getAllByRole("row");
      // First row is the header row (<th> cells) — every remaining row is a data row and must
      // carry the shared WardFreshness stamp ("Confirmed HH:MM · role", since every BedRelease
      // carries a real confirmedAt/confirmedBy).
      const dataRows = rows.slice(1);
      expect(dataRows.length).toBeGreaterThan(0);
      for (const row of dataRows) {
        expect(within(row).getByText(/^Confirmed \d{2}:\d{2} ·/)).toBeInTheDocument();
      }
    }
  });

  it("counts a release expected beyond tonight without listing it in any group", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
        <FarFutureReleaseFlagger />
      </WardFlowProvider>,
    );

    // Baseline measured against the real fixture (ward-movements.ts): 2 blocked (WR-007, WR-009),
    // 2 confirmed (WR-001, WR-004), 4 expected (WR-002, WR-003, WR-005, WR-006), 1 released today
    // (WR-008) — 9 rows total, 0 excluded, matching the earlier "renders 0" test.
    fireEvent.click(screen.getByRole("button", { name: "flag far-future release" }));

    // The new release is real reducer state now (a tenth BedRelease, expected, expectedAt =
    // EVENING_SHIFT_END_MINUTES + 100), so the excluded count must move off 0 — the half of the
    // spec's promise the earlier "renders 0" test cannot exercise on its own.
    const excluded = screen.getByTestId("ward-discharge-excluded");
    expect(excluded).toHaveTextContent(/^1\b/);
    expect(excluded.textContent?.toLowerCase()).not.toContain("none");

    // Being counted and being listed are different things (D5): the new release is `expected`,
    // so a leak would land it in the Expected group specifically. That group's row count must
    // stay at its pre-flag 4, not grow to 5.
    const expectedTable = screen.getByTestId("ward-discharge-table-expected");
    const expectedDataRows = within(expectedTable).getAllByRole("row").slice(1);
    expect(expectedDataRows).toHaveLength(4);

    // Belt and braces: total data rows across every group must stay at 9 even though the reducer
    // now holds 10 bed releases — the tenth is declared (via the count above) but never listed.
    const totalDataRows = ["blocked", "confirmed", "expected", "discharged-today"]
      .map((key) => within(screen.getByTestId(`ward-discharge-table-${key}`)).getAllByRole("row").length - 1)
      .reduce((sum, count) => sum + count, 0);
    expect(totalDataRows).toBe(9);
  });

  /**
   * ⚠️ **HARNESS FOR THE TWO TESTS BELOW.** They need `now` to move while the FIXTURE STAYS PUT,
   * and on this line that is `ADVANCE_CLOCK` rather than a second render: the reducer adds to
   * `state.clockOffsetMinutes` without reseeding, and the provider computes
   * `now = NOW_ANCHOR + anchorOffsetMinutes + elapsed + state.clockOffsetMinutes`.
   *
   * ⚠️ The role is `demo`, and it is not interchangeable: the reducer refuses this event from any
   * other role with "ADVANCE_CLOCK requires role demo". Moving the clock is a demonstration
   * control, not a clinical act, so no ward or coordinator role may do it.
   */
  function ClockAdvancer({ minutes }: { minutes: number }) {
    const { dispatch, now } = useWardFlow();
    return (
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}>
        advance the clock
      </button>
    );
  }

  /**
   * Both tests below exist because of #YTR84P. `WardFlowProvider`'s `initialNow` prop once
   * discarded its value — the render body forced `elapsed = 0` when pinned, so a pinned provider
   * always served `NOW_ANCHOR` (642, 10:42) whatever instant it was handed. The provider now
   * serves the instant it is given, and these are the first tests that spend that: each drives one
   * of `releaseBand`'s two `now`-dependent branches (`ward-bed-availability.ts`) through a real
   * rendered screen rather than by calling the pure function directly, which is what
   * `tests/ward-bed-availability.test.ts` already does. That is a defect no other DOM suite can
   * see, since every one of them pins `NOW_ANCHOR` and never moves it.
   *
   * ⚠️ **THE MECHANISM CHANGED ON THIS LINE, AND THE REASON IS A DESIGN DIFFERENCE RATHER THAN A
   * DEFECT ON EITHER SIDE.** As written on `main` these tests moved `now` by rendering a SECOND
   * provider at a later `initialNow`. Here, `initialNow` also moves the demo day: the provider
   * derives `anchorOffsetMinutes = initialNow - NOW_ANCHOR` and seeds with
   * `seedWardFlowStateAt(offset)`, so **fixture and clock travel together**, every release stays
   * the same distance in the future, and the band never changes. That is deliberate — it keeps the
   * demo day coherent at any pinned instant — and it is the later decision, so it stands.
   *
   * `ADVANCE_CLOCK` is this line's equivalent of "move `now` past the fixture": it moves the clock
   * WITHOUT reseeding, which is exactly the axis these tests need. ⚠️ **The property that matters
   * is unchanged — both branches are still driven THROUGH A RENDERED SCREEN, never by calling
   * `releaseBand` directly. A translation that ended up testing the pure function would have lost
   * the thing these tests are for.**
   *
   * ⚠️ **They also use this line's GROUP NAMES.** `main` says `released-today` and `predicted`;
   * here they are `discharged-today` and `expected`. The first is not cosmetic: "released" was
   * renamed on 2026-08-30 because it reads as release from detention.
   */
  it("moves a confirmed release from By midday to Now once the clock passes its expected instant", () => {
    // The confirmed group is WR-001 (expectedAt NOW_ANCHOR + 45 = 687) and WR-004 (+30 = 672) in
    // the real fixture (ward-movements.ts). Both fall after NOW_ANCHOR (642) and at or before
    // MIDDAY_MINUTES (720), so at the anchor both sit in the by-midday band.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
        <ClockAdvancer minutes={700 - NOW_ANCHOR} />
      </WardFlowProvider>,
    );

    expect(expectedColumn(screen.getByTestId("ward-discharge-table-confirmed"))).toEqual(["By midday", "By midday"]);

    // 11:40 — past both expected instants, still the same operating day, still before midday. The
    // ONLY thing that differs is the clock: same mount, same fixture, same releases.
    fireEvent.click(screen.getByRole("button", { name: "advance the clock" }));

    expect(expectedColumn(screen.getByTestId("ward-discharge-table-confirmed"))).toEqual(["Now", "Now"]);
  });

  it("drops yesterday's discharged row out of Discharged today when the clock reaches the next operating day", () => {
    // `releaseBand`'s other `now`-dependent branch: a discharged bed counts as discharged TODAY for
    // its own operating day only. WR-008 is discharged with confirmedAt NOW_ANCHOR - 15 (627,
    // day 0), so a clock a full day later must drop it — the same-clock-time trap the band comment
    // warns about, since 627 + 1440 falls at the identical time of day.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
        <ClockAdvancer minutes={MINUTES_PER_DAY} />
      </WardFlowProvider>,
    );

    // ⚠️ ASSERTED BEFORE THE CLOCK MOVES, so "the group is empty afterwards" cannot pass because it
    // was empty all along — the row has to be there first for its disappearance to mean anything.
    expect(screen.getByTestId("ward-discharge-table-discharged-today")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "advance the clock" }));

    // Empty groups render their reason note instead of a table, so the table must be gone entirely.
    expect(screen.getByTestId("ward-discharge-group-discharged-today-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-discharge-table-discharged-today")).not.toBeInTheDocument();

    // Dropped from the group is not the same as dropped from the board: WR-008 must still be
    // declared at the foot, which is the half a "the group is empty" assertion cannot reach.
    const excluded = screen.getByTestId("ward-discharge-excluded");
    expect(excluded).toHaveTextContent(/^1\b/);
    expect(excluded.textContent?.toLowerCase()).not.toContain("none");

    // The other eight releases are untouched: every fixture expectedAt falls at or before
    // EVENING_SHIFT_END_MINUTES (1320), so none of them is excluded by the day-later clock.
    const listed = ["blocked", "confirmed", "expected"]
      .map((key) => within(screen.getByTestId(`ward-discharge-table-${key}`)).getAllByRole("row").length - 1)
      .reduce((sum, count) => sum + count, 0);
    expect(listed).toBe(8);
  });
});
