import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

// Mirrors tests/ward-flow-clock-consistency.dom.test.tsx: WardModeWorkspace renders next/link
// anchors and this suite never checks routing itself, so a plain <a> avoids requiring an App
// Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/** Raises the same `ADVANCE_CLOCK` demo event the real demo controls dispatch — the same
 * technique tests/ward-escalation.dom.test.tsx, tests/ward-handover.dom.test.tsx and
 * tests/ward-patient-search.dom.test.tsx already use to move the shared clock without reaching
 * into the reducer directly. */
function ClockAdvancer({ minutes }: { minutes: number }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-advance-clock"
      onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}
    >
      advance clock
    </button>
  );
}

/**
 * Raises a real `FLAG_BED_RELEASE` with no `blocker` — Phase 5 spec D3: a flag with no blocker
 * is a plain prediction — for `unitId`, at the live `now`. `expectedAt` is an optional override;
 * every existing call site below omits it and gets `now` by default, matching this suite's
 * original behaviour, which is exactly what lets `<ClockAdvancer>` push a later flag past 22:00
 * for the excluded-count test below (`FLAG_BED_RELEASE.expectedAt` no longer has to equal
 * `event.now` — see `ward-flow-events.ts`'s own doc comment — but nothing stops a caller choosing
 * to make them equal, which is what a default of `now` does here).
 */
function ExpectedReleaseFlagger({ unitId, expectedAt }: { unitId: string; expectedAt?: number }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-flag-expected-release"
      onClick={() =>
        dispatch({
          type: "FLAG_BED_RELEASE",
          role: "ward",
          now,
          unitId,
          actingUnitId: unitId,
          waitingOn: "Awaiting ward round",
          expectedAt: expectedAt ?? now,
        })
      }
    >
      flag expected release
    </button>
  );
}

/** Reads the live `refreshRequests` list straight from the shared provider, so a test can prove
 * a click on the coordinator's control actually reached the reducer rather than merely changing
 * on-screen text the reducer never saw. */
function RefreshRequestsProbe() {
  const { refreshRequests } = useWardFlow();
  return <div data-testid="test-refresh-requests-count">{refreshRequests.length}</div>;
}

/**
 * Task 8 (spec item 6). The capacity board already showed bed counts and freshness but not the
 * three properties that actually gate whether a patient can go to a unit — sex mix, specialling
 * headroom, and Mental Health Act authorisation — even though all three already exist on `Unit`
 * and already gate placement in `ward-eligibility.ts`.
 *
 * SJGS Adult Secure (`sjgs-adult-secure`) is authorised: false — private and not MHA-authorised,
 * per SJGS Adult Open's sibling fixture comment in ward-sites.ts (both SJGS units share that
 * note). SCGH Adult Open (`scgh-adult-open`) is authorised: true. Both are chosen deliberately
 * for an ASYMMETRIC sex mix (Female != Male) rather than the first false/true units found —
 * SJGS Adult Open (4F/4M) and RPH Adult Secure (9F/9M) both have equal Female/Male counts, so a
 * Female<->Male swap mutation on the render line would be invisible against them. Both units
 * used here have distinct counts, so the "both counts" requirement actually has teeth.
 */
const SJGS_ADULT_SECURE = unitById("sjgs-adult-secure");
const SCGH_ADULT_OPEN = unitById("scgh-adult-open");

describe("ward capacity board", () => {
  it("fixture assumption: SJGS Adult Secure is unauthorised with an asymmetric sex mix, SCGH Adult Open is authorised with an asymmetric sex mix", () => {
    expect(SJGS_ADULT_SECURE?.authorised).toBe(false);
    expect(SJGS_ADULT_SECURE?.sexMix).toEqual({ Female: 4, Male: 3 });
    expect(SCGH_ADULT_OPEN?.authorised).toBe(true);
    expect(SCGH_ADULT_OPEN?.sexMix).toEqual({ Female: 10, Male: 9 });
  });

  it("shows sex mix, specialling capacity, and MHA authorisation per unit row — both directions", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="capacity" />
      </WardFlowProvider>,
    );

    const unauthorisedRow = screen.getByTestId("ward-capacity-row-sjgs-adult-secure");
    // Rendering the flag is not a legal claim — just the unit's existing state, in the
    // codebase's own established wording ("not MHA-authorised"), nothing added.
    expect(screen.getByTestId("ward-capacity-authorised-sjgs-adult-secure")).toHaveTextContent("not MHA-authorised");
    expect(screen.getByTestId("ward-capacity-sexmix-sjgs-adult-secure")).toHaveTextContent("Female 4 · Male 3");
    expect(screen.getByTestId("ward-capacity-specialling-sjgs-adult-secure")).toHaveTextContent("0");
    expect(unauthorisedRow).toBeInTheDocument();

    const authorisedRow = screen.getByTestId("ward-capacity-row-scgh-adult-open");
    // The authorised row must NOT carry the not-authorised wording anywhere in its own cell —
    // both directions, or this test would pass even if every row said "not MHA-authorised".
    const authorisedCell = screen.getByTestId("ward-capacity-authorised-scgh-adult-open");
    expect(authorisedCell).toHaveTextContent("MHA-authorised");
    expect(authorisedCell).not.toHaveTextContent("not MHA-authorised");
    expect(screen.getByTestId("ward-capacity-sexmix-scgh-adult-open")).toHaveTextContent("Female 10 · Male 9");
    expect(screen.getByTestId("ward-capacity-specialling-scgh-adult-open")).toHaveTextContent("3");
    expect(authorisedRow).toBeInTheDocument();
  });

  it("replaces the per-unit row's undifferentiated Potential lump with its own Confirmed/Expected breakdown", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="capacity" />
      </WardFlowProvider>,
    );

    const bedStates = screen.getByTestId("ward-capacity-bed-states-rph-adult-secure");

    // The raw `unitCapacity().potential` figure — every release for this unit regardless of
    // state or timing — must never appear on this row again: the headline above already
    // separates it into Confirmed today / Expected today, and this row must agree rather than
    // showing an undifferentiated lump the headline no longer shows.
    expect(bedStates).not.toHaveTextContent("Potential");

    // The row must show the SAME per-unit Confirmed/Expected figures `capacityBreakdown` (the
    // headline's own source of truth) computes for this unit — not merely the labels, but the
    // real numbers, computed independently here from the live fixture rather than read back off
    // the screen.
    const unit = unitById("rph-adult-secure");
    expect(unit).toBeDefined();
    const expected = capacityBreakdown(unit!, bedReleases, leaveBeds, NOW_ANCHOR);

    const confirmedSpan = within(bedStates).getByText("Confirmed").closest("span");
    const expectedSpan = within(bedStates).getByText("Expected").closest("span");
    expect(confirmedSpan).toHaveTextContent(String(expected.confirmedToday));
    expect(expectedSpan).toHaveTextContent(String(expected.expectedToday));
  });
});

/**
 * Task 7 (Phase 5, spec D6/D12). Before this task the headline above the unit table was a single
 * `unitCapacity()` total keyed by five DIFFERENT states (available/held/potential/blocked/
 * occupied), where "potential" counted every bed release regardless of state or timing. This
 * suite proves the headline instead shows `capacityBreakdown()`'s five figures — Available now,
 * Confirmed today, Expected today, Held, Leave (usable) — as five separate cards, that
 * `Available now` is never softened by a expected or confirmed-but-unreleased bed, that the
 * excluded-beyond-tonight count is surfaced rather than silently dropped, and that the
 * coordinator's one permitted action (asking a ward to restate its numbers) is a real dispatch
 * that moves no bed figure at all.
 */
describe("ward capacity headline (Task 7)", () => {
  it("renders the capacity headline as six separate figures and never a sum", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="capacity" />
      </WardFlowProvider>,
    );

    const headline = screen.getByTestId("ward-capacity-headline");
    // Structural proof, not a text scan: exactly these six testids exist under the headline and
    // no others — a seventh card (a "total"/"sum") would fail this count even if it were labelled
    // something this test does not otherwise search for. The count rose from five to six with the
    // bed-model rework of 2026-08-28, which added `blocked-releases`; the guard is unchanged in
    // kind, and every card is still named individually below so the count alone can never stand
    // in for knowing WHICH cards are there.
    const cards = headline.querySelectorAll('[data-testid^="ward-capacity-headline-"]');
    expect(cards).toHaveLength(6);

    expect(screen.getByTestId("ward-capacity-headline-available-now")).toHaveTextContent("Available now");
    expect(screen.getByTestId("ward-capacity-headline-confirmed-today")).toHaveTextContent("Confirmed today");
    expect(screen.getByTestId("ward-capacity-headline-expected-today")).toHaveTextContent("Expected today");
    // Deliberately "Blocked releases", not the bare "Blocked": the per-unit rows below already
    // use that word for physically blocked BEDS, which is a different fact.
    expect(screen.getByTestId("ward-capacity-headline-blocked-releases")).toHaveTextContent("Blocked releases");
    expect(screen.getByTestId("ward-capacity-headline-held")).toHaveTextContent("Held");
    expect(screen.getByTestId("ward-capacity-headline-leave-usable")).toHaveTextContent("Leave (usable)");

    // No card anywhere in the headline claims to be a total/sum of the other four.
    expect(within(headline).queryByText(/total/i)).not.toBeInTheDocument();
    expect(within(headline).queryByText(/^sum$/i)).not.toBeInTheDocument();
  });

  it("leaves Available now exactly unchanged when a expected release is added, while Expected today moves", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="capacity" />
        <ExpectedReleaseFlagger unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // Read only the card's own `<strong>` figure, never the whole card's textContent — the card
    // also carries "Across N synthetic units", and its digits would otherwise run together with
    // the headline figure's own digits under a naive digit-only strip.
    const readFigure = (testId: string) => {
      const value = screen.getByTestId(testId).querySelector("strong")?.textContent;
      const parsed = Number(value);
      expect(Number.isNaN(parsed)).toBe(false);
      return parsed;
    };

    const availableBefore = readFigure("ward-capacity-headline-available-now");
    const expectedBefore = readFigure("ward-capacity-headline-expected-today");

    fireEvent.click(screen.getByTestId("test-flag-expected-release"));

    // THE single most important rule in the phase: a expected release must never soften
    // "Available now" — a coordinator must always be able to point at that number and say "that
    // is a bed I can fill this minute".
    expect(readFigure("ward-capacity-headline-available-now")).toBe(availableBefore);

    // The dispatch really landed — Expected today rose by exactly one — so this proves real
    // separation between the two figures, not merely that the click did nothing at all.
    expect(readFigure("ward-capacity-headline-expected-today")).toBe(expectedBefore + 1);
  });

  it("the coordinator's refresh control is a real button that dispatches REQUEST_CAPACITY_REFRESH and moves no bed figure", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="capacity" />
        <RefreshRequestsProbe />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("test-refresh-requests-count")).toHaveTextContent("0");
    const availableBefore = screen.getByTestId("ward-capacity-headline-available-now").textContent;
    const heldBefore = screen.getByTestId("ward-capacity-headline-held").textContent;

    const refreshButton = screen.getByTestId("ward-capacity-refresh-rph-adult-secure");
    // A real, wired <button> — never an advisory element with no handler.
    expect(refreshButton.tagName).toBe("BUTTON");
    expect(refreshButton).not.toHaveAttribute("disabled");
    expect(refreshButton).not.toHaveAttribute("aria-disabled");

    fireEvent.click(refreshButton);

    // The one observable effect of this control: a real dispatch reached the reducer's own
    // `refreshRequests` list — never a bed figure.
    expect(screen.getByTestId("test-refresh-requests-count")).toHaveTextContent("1");
    expect(screen.getByTestId("ward-capacity-headline-available-now")).toHaveTextContent(availableBefore ?? "");
    expect(screen.getByTestId("ward-capacity-headline-held")).toHaveTextContent(heldBefore ?? "");
  });

  it("shows the excluded count once a release falls beyond the board's horizon, and not before", () => {
    /*
     * REWRITTEN 2026-08-30 for WB-DB-7. This used to advance the clock 700 minutes so that
     * `FLAG_BED_RELEASE`'s own stamp landed past 22:00, which was the old cutoff. Under a rolling
     * horizon with a "tomorrow" band, a release later the same evening is correctly SHOWN rather
     * than excluded, so the clock advance no longer produces an exclusion and the fixture has to
     * reach two days out to make one.
     *
     * The property is unchanged: the excluded count appears only once something genuinely falls
     * outside the horizon, and it is reported rather than dropped in silence.
     */
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="capacity" />
        <ExpectedReleaseFlagger unitId="fre-adult-open" expectedAt={NOW_ANCHOR + 2 * MINUTES_PER_DAY} />
      </WardFlowProvider>,
    );

    // Baseline: every seeded release falls today or tomorrow, so nothing is excluded yet. This half
    // matters as much as the other - an assertion that only ever sees the count present would pass
    // on a screen that showed it unconditionally.
    expect(screen.queryByTestId("ward-capacity-excluded-beyond-today")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("test-flag-expected-release"));

    expect(
      screen.getByTestId("ward-capacity-excluded-beyond-today"),
      "a release beyond the horizon must be counted and shown, never quietly omitted",
    ).toHaveTextContent("1");
  });
});
