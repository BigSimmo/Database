/**
 * 🔴 **ONE CASE HERE STILL RENDERS THE DEAD MODE, ON PURPOSE. IT IS THE LAST ONE IN THE
 * REPOSITORY, AND IT MUST NOT BE MADE GREEN BY DELETING IT.**
 *
 * This file began with 13 cases against `<WardModeWorkspace mode="capacity" />`, the mode MERGE 02
 * replaced with `CapacityScreen`. It now holds five: four against the live screen, and one parked.
 * Every reduction is recorded in `diff-integrity.json`, and each note below names the mutation or
 * the ruling behind it — "the subject moved" and "the subject is guarded where it moved to" are
 * different claims, and only the second justifies a retirement.
 *
 * ## What happened to the other eight
 *
 * Three retired because their subject moved to `ward-screen.tsx` at `/ward/[unitId]` and was
 * PROVED guarded there by mutation. Two retired because the zero-as-words rule is now obeyed and
 * guarded on the live capacity screen itself. One re-pointed into
 * `ward-bed-release.dom.test.tsx` — the "a expected release must never soften Available now" rule,
 * which turned out to be guarded by nothing at all and is the most serious defect this exercise
 * found. Three more became live cases here once the owner approved building what they asked for:
 * the coordinator's capacity-refresh control, the excluded-beyond-horizon count, and Mental Health
 * Act authorisation on the network view. And the six-figure headline retired on the owner's own
 * ruling — leave the strip out.
 *
 * ## The one that remains, and why it is not unfinished tidying
 *
 * **A ward's sex mix and its specialling headroom, as FIGURES, on a network view.** Every read of
 * `unit.sexMix` in `src/` is eligibility logic or the reducer; no screen states a ward's
 * male/female counts. `ward-board.tsx` shows each occupant's own sex on their row, so the fact is
 * reachable one patient at a time. Specialling appears only as an eligibility gate for one named
 * patient.
 *
 * ⚠️ **THE SEX-MIX *SIGNAL* IS BUILT AND IS NOT WHAT THIS CASE IS ABOUT.** `CapacityScreen` now
 * says *"this ward's bed records are mid-update — this figure may not be settled"* when a ward's
 * recorded total and its occupancy disagree, and `ward-capacity-sexmix-release.dom.test.tsx`
 * guards it against the live screen. That was Ward Lead's ruling: carry the SIGNAL, not the data.
 * **Whether the DATA belongs on a network view is a separate question the owner has not been
 * asked**, and building it would answer it on his behalf.
 *
 * ⚠️ **DO NOT "FIX" THIS BY POINTING IT AT `CapacityScreen`.** It would fail, and the tempting
 * repair is to weaken the assertion until it passes — which converts an open question into a false
 * answer. The honest routes stay what they were: build the missing surface once someone has decided
 * it should exist, or retire the case with an `approvedReductions` entry once someone has decided
 * it should not.
 */

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

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { WARD_NAV } from "@/components/ward-management/ward-nav";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * Raises a real `FLAG_BED_RELEASE` with no `blocker` — Phase 5 spec D3: a flag with no blocker
 * is a plain prediction — for `unitId`, at the live `now`. `expectedAt` is an optional override;
 * every existing call site below omits it and gets `now` by default, matching this suite's
 * original behaviour. The excluded-count test below once reached a later `expectedAt` by
 * advancing the shared clock with a demo `ADVANCE_CLOCK` event; REWRITTEN 2026-08-30 for WB-DB-7,
 * it instead passes `expectedAt` two days out directly (`FLAG_BED_RELEASE.expectedAt` no longer
 * has to equal `event.now` — see `ward-flow-events.ts`'s own doc comment — but nothing stops a
 * caller choosing to make them equal, which is what a default of `now` does here).
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

  /*
   * 🔴 **SPLIT 2026-09-05. The MHA half is re-pointed at the live screen; the sex-mix and
   * specialling halves stay parked, because nothing reachable shows either of them.**
   */
  it("names every ward's Mental Health Act authorisation on the network view, both directions", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );

    const unauthorised = screen.getByTestId("ward-capacity-authorised-sjgs-adult-secure");
    expect(unauthorised).toHaveTextContent("not MHA-authorised");

    // Both directions, or this would pass on a screen that said "not MHA-authorised" on every row.
    const authorised = screen.getByTestId("ward-capacity-authorised-scgh-adult-open");
    expect(authorised).toHaveTextContent("MHA-authorised");
    expect(authorised).not.toHaveTextContent("not MHA-authorised");
  });

  /*
   * ⚠️ **STILL PARKED, AND STILL RENDERING THE DEAD MODE ON PURPOSE — see the file header.**
   * A ward's sex mix is rendered by NOTHING reachable (every read of `unit.sexMix` in `src` is
   * eligibility logic or the reducer), and specialling headroom likewise appears only as an
   * eligibility gate for one named patient, never as a network figure. Whether either belongs on a
   * capacity board is an owner question; the sex-mix half additionally overlaps Ward Lead's unbuilt
   * sex-mix ruling and the unsettled question of whether `Unit.sexMix` or `derivedSexMix` is the
   * honest source.
   */
  it("shows sex mix and specialling capacity per unit row — both directions", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="capacity" />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-capacity-sexmix-sjgs-adult-secure")).toHaveTextContent("Female 4 · Male 3");
    expect(screen.getByTestId("ward-capacity-specialling-sjgs-adult-secure")).toHaveTextContent("0");
    expect(screen.getByTestId("ward-capacity-sexmix-scgh-adult-open")).toHaveTextContent("Female 10 · Male 9");
    expect(screen.getByTestId("ward-capacity-specialling-scgh-adult-open")).toHaveTextContent("3");
  });

  /*
   * RETIRED 2026-09-05 — "replaces the per-unit row's undifferentiated Potential lump with its own
   * Confirmed/Expected breakdown". Recorded in `diff-integrity.json`.
   *
   * The subject MOVED and is guarded at its new home, proved by mutation rather than by reading:
   * `ward-screen.tsx` renders `Confirmed {breakdown.confirmedToday}` and `Expected
   * {breakdown.expectedToday}` in its bed grid, reachable at `/ward/[unitId]`. Making the Confirmed
   * chip read the Expected field turns THREE cases red across `ward-screen.dom.test.tsx`, one of
   * them "never renders 'Potential', and renders Confirmed/Expected/Leave from capacityBreakdown()".
   */
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
  /*
   * RETIRED 2026-09-06 — "renders the capacity headline as six separate figures and never a sum".
   * Recorded in `diff-integrity.json`. **The owner ruled on it**, with the recommendation put to him:
   * leave the strip out.
   *
   * The case guarded a structural property of a headline that no longer exists — exactly six cards
   * under the headline, so a seventh "total" could not be added unnoticed. `CapacityScreen` has no
   * headline of that shape, so the guard had nothing to stand over.
   *
   * ⚠️ **THE REASONING BEHIND THE RULING IS WORTH KEEPING, because it is the reason not to
   * reintroduce the strip casually.** The six figures count different things — beds ready now, beds
   * confirmed to free today, beds expected to free, blocked releases, held beds, usable leave beds.
   * A total of them would be a number with no referent, and a row of figures side by side is an
   * invitation to add them. The screen answers "where is the network short" instead, which is a
   * question no sum helps with.
   *
   * If a summary strip is ever wanted here, this guard is the one to bring back with it.
   */

  /*
   * RE-POINTED 2026-09-05 into `ward-bed-release.dom.test.tsx`, against the live `WardScreen` and
   * the ward's own flagging control, so the rule runs end to end through a real `FLAG_BED_RELEASE`.
   *
   * 🔴 **THIS ONE WAS A LIVE HOLE.** Rendering `Ready {capacity.available -
   * breakdown.expectedToday}` — a discharge that has not happened reducing the beds a ward can fill
   * now — was run against all 41 test files that render `WardScreen` or touch
   * `unitCapacity`/`capacityBreakdown`: 714 passed, nothing red. The mutation was live: two of the
   * five units those suites render carry `ready=2, expectedToday=1` and rendered `Ready 1`.
   */

  /*
   * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-05, AFTER THE CONTROL WAS PUT BACK.**
   *
   * ⚠️ **THIS WAS A CAPABILITY LOST BY ACCIDENT.** Measured before rebuilding it:
   * `REQUEST_CAPACITY_REFRESH` was dispatched from exactly ONE place in the whole codebase — the
   * capacity view MERGE 02 retired — while the event type, the reducer case, the provider list and
   * the ward-side DISPLAY of a request all kept working. So no coordinator could ask a ward to
   * restate its numbers, and `ward/ward-screen.tsx` carried a mark for something nothing could
   * produce. Every half was individually correct, which is why no gate saw it.
   *
   * The second half of this case is the clinical one and is not decoration: **asking must move no
   * bed figure.** A control that quietly adjusted a number while claiming only to record a request
   * would be the worst kind of defect on this screen.
   */
  it("the coordinator's refresh control is a real button that dispatches REQUEST_CAPACITY_REFRESH and moves no bed figure", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
        <RefreshRequestsProbe />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("test-refresh-requests-count")).toHaveTextContent("0");
    const table = screen.getByTestId("ward-capacity-network-table");
    const readyBefore = within(table).getByTestId("ward-capacity-network-row-rph-adult-secure").textContent;

    const refreshButton = screen.getByTestId("ward-capacity-refresh-rph-adult-secure");
    // A real, wired <button> — never an advisory element with no handler.
    expect(refreshButton.tagName).toBe("BUTTON");
    expect(refreshButton).not.toHaveAttribute("disabled");
    expect(refreshButton).not.toHaveAttribute("aria-disabled");

    fireEvent.click(refreshButton);

    // The one observable effect: a real dispatch reached the reducer's own `refreshRequests` list.
    expect(screen.getByTestId("test-refresh-requests-count")).toHaveTextContent("1");
    expect(
      within(screen.getByTestId("ward-capacity-network-table")).getByTestId(
        "ward-capacity-network-row-rph-adult-secure",
      ).textContent,
      "asking a ward to restate its numbers moved a figure on its row; this control records that " +
        "somebody asked and must change nothing else",
    ).toBe(readyBefore);
  });

  /*
   * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-05, AFTER THE FIGURE IT ASKS FOR WAS BUILT.**
   *
   * The rule is this file's own words: *"a release beyond the horizon must be counted and shown,
   * never quietly omitted."* `networkWardRows` drops a release whose `dayOf` is not today —
   * correctly, since "freeing today" must not include tomorrow — and said nothing about having
   * dropped it. `releasesBeyondToday` now counts them and the screen states them.
   *
   * Both halves matter and both are kept: the count must be ABSENT before anything falls outside
   * the horizon. An assertion that only ever sees the count present would pass on a screen showing
   * it unconditionally.
   */
  it("shows the excluded count once a release falls beyond the board's horizon, and not before", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
        <ExpectedReleaseFlagger unitId="fre-adult-open" expectedAt={NOW_ANCHOR + 2 * MINUTES_PER_DAY} />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId("ward-capacity-excluded-beyond-today")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("test-flag-expected-release"));

    expect(
      screen.getByTestId("ward-capacity-excluded-beyond-today"),
      "a release beyond the horizon must be counted and shown, never quietly omitted",
    ).toHaveTextContent("1");
  });
});

/**
 * Second-edition pass, capacity table (Part 2/3 of the task brief). Design language binding rule:
 * "a number that could be zero or unknown is rendered as a stated absence IN WORDS, never as `0`,
 * a dash or a blank". Scoped deliberately to the Ready ("available") figure alone — the row's other
 * five bed-state figures (Held/Confirmed/Expected/Blocked/Occupied) are asserted with literal
 * "0Confirmed"/"0Expected" text by `tests/ward-bed-release.dom.test.tsx` and
 * `tests/ward-bed-release-lifecycle.test.ts`, both outside this task's file ownership, so widening
 * the word-for-zero treatment to those cells would break coverage this task may not edit.
 */
/*
 * RETIRED 2026-09-05 — the two cases asserting that a unit with no ready bed reads "none" rather
 * than the digit "0", and the fixture assumption underneath them. Recorded in `diff-integrity.json`.
 *
 * **The rule is now OBEYED and GUARDED on the live screen**, which was not true when this file was
 * last touched: `capacity-screen.tsx` renders `row.ready === 0` as the word, and
 * `ward-capacity-screen.dom.test.tsx`'s "names every ward's real ready and locked-ready counts"
 * case asserts the claim for every row — including both directions on the absence, so a cell
 * reading "0 none" fails there too. That case also floors on there being a zero-ready ward at all,
 * so the branch cannot silently stop being covered.
 *
 * Re-pointing these here instead would have put a second guard over one fact. Two guards over one
 * fact drift apart, and the weaker one teaches the next reader that the stronger is redundant.
 */

/**
 * Task brief requirement: "tests/ward-capacity-reconciliation.test.ts already asserts
 * available/held/blocked/occupied sum to a unit's total beds — assert the screen SHOWS figures
 * obeying that identity." That file checks `unitCapacity()`'s own return value; this checks the
 * SCREEN, independently, against `unit.beds` — a raw fixture field, never a value read back from
 * `unitCapacity`/`capacityBreakdown` — so a defect that broke only the RENDERING of an otherwise
 * correct identity (a wrong label pointing at a sibling cell, a row reading another unit's figure)
 * would be caught here even though the underlying arithmetic test stays green.
 */

/**
 * "A leave bed is not counted as available (a leave bed is a bed a patient is expected back into)."
 * `rph-adult-secure` carries the live fixture's one usable leave bed (`WL-001`,
 * `ward-movements.ts`). The expected Ready figure is computed here from the unit's own
 * `allocatable`/`empty` fields — one layer below `unitCapacity`, never by calling it — so this
 * cannot pass merely because the screen and the test share the same derivation.
 */
