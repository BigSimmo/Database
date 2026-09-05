/**
 * 🔴 **THIS FILE IS STILL RED IN `ward-mode-workspace-reachability.test.ts`, ON PURPOSE. TWO CASES
 * REMAIN POINTED AT THE DEAD MODE AND MUST NOT BE MADE GREEN BY DELETING THEM.**
 *
 * It began with 13 cases against `<WardModeWorkspace mode="capacity" />`, the mode MERGE 02
 * replaced with `CapacityScreen`. It now holds six: four against the live screen, two parked.
 * Every reduction is recorded in `diff-integrity.json`, and each note below names the mutation that
 * proved its claim — because "the subject moved" and "the subject is guarded where it moved to" are
 * different claims and only the second is worth retiring on.
 *
 * ## The four that are now live, and three of them are live because the SCREEN was changed
 *
 * The owner approved four of the five open questions on 2026-09-05, so the honest resolution
 * stopped being "retire or park" and became "build it, then re-point":
 *
 *   - **The coordinator's capacity-refresh control** was rebuilt on `CapacityScreen`. It had been
 *     lost by ACCIDENT, not by decision: `REQUEST_CAPACITY_REFRESH` was dispatched from exactly one
 *     place in the codebase — the retired capacity view — while the event type, the reducer case,
 *     the provider list and the ward-side DISPLAY of a request all kept working. A field with no
 *     producer, invisible to every gate because each half was individually correct.
 *   - **The excluded-beyond-horizon count** was built (`releasesBeyondToday`) and is stated on the
 *     screen. A bed freeing after today is correctly left out of every figure; being left out of a
 *     figure is not the same as being unmentioned.
 *   - **A ward's Mental Health Act authorisation** was added to the network view. ⚠️ It was never
 *     wholly lost — `ward/ward-screen.tsx` and `coordinator/flow-diagram.tsx` both render it. What
 *     the fold lost is seeing it for every ward AT ONCE, which is the question a capacity board
 *     answers and a per-ward page cannot.
 *   - **A zero stated in words** was fixed on the screen, and its two cases RETIRED rather than
 *     re-pointed, because `ward-capacity-screen.dom.test.tsx` now guards the claim for every row
 *     including both directions on the absence. A second guard over one fact drifts from the first.
 *
 * ## The two that remain parked, and why neither is unfinished tidying
 *
 *   1. **A ward's sex mix, and its specialling headroom, on a network view.** Every read of
 *      `unit.sexMix` in `src/` is eligibility logic or the reducer — no screen states a ward's
 *      male/female counts. `ward-board.tsx` shows each occupant's own sex on their row, so the fact
 *      is reachable one patient at a time. Specialling appears only as an eligibility gate for one
 *      named patient. ⚠️ The sex-mix half additionally overlaps Ward Lead's unbuilt sex-mix ruling
 *      AND an unsettled question of source: `ward-board-derivations.ts` carries `derivedSexMix`,
 *      whose own comment says it "replaces the hand-maintained `Unit.sexMix`". Building this
 *      without settling that first is how the two come to disagree.
 *   2. **The six-figure headline that never shows a sum.** `CapacityScreen` has no headline of that
 *      shape, so the structural guard against a seventh "total" card has nothing to stand over.
 *      **The owner made no ruling on this one and none was read into his silence.**
 *
 * ⚠️ **DO NOT "FIX" EITHER BY POINTING IT AT `CapacityScreen`.** Both would fail, and the tempting
 * repair is to weaken the assertion until it passes — which converts an open question into a false
 * answer. The honest routes stay what they were: build the missing surface, or retire the case with
 * an `approvedReductions` entry once an owner has decided it is not coming back.
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

    // "Ready" since the owner's 2026-09-04 ruling — one word for one number. The test id keeps its
    // old spelling deliberately: it is an addressing handle, not clinician-facing copy, and
    // renaming it would churn every selector for no reader's benefit.
    expect(screen.getByTestId("ward-capacity-headline-available-now")).toHaveTextContent("Ready");
    expect(screen.getByTestId("ward-capacity-headline-confirmed-today")).toHaveTextContent("Confirmed today");
    expect(screen.getByTestId("ward-capacity-headline-expected-today")).toHaveTextContent("Expected today");
    // Deliberately "Blocked releases", not the bare "Blocked": the per-unit rows below already
    // use that word for physically blocked BEDS, which is a different fact.
    expect(screen.getByTestId("ward-capacity-headline-blocked-releases")).toHaveTextContent("Blocked releases");
    expect(screen.getByTestId("ward-capacity-headline-held")).toHaveTextContent("Held");
    expect(screen.getByTestId("ward-capacity-headline-leave-usable")).toHaveTextContent("Leave (usable)");

    // Spec D9 (#WG24JB): confirmed and expected pending discharge cards link to the discharge
    // board. Read the expected href from WARD_NAV (the single source of Ward Flow destinations)
    // rather than pinning a duplicate literal, so a renamed/regrouped route fails this test
    // instead of silently drifting from the rail.
    const dischargeHref = WARD_NAV.find((item) => item.id === "discharges")?.href;
    expect(dischargeHref).toBeTruthy();
    expect(screen.getByTestId("ward-capacity-headline-confirmed-today")).toHaveAttribute("href", dischargeHref);
    // RENAMED predicted -> expected on this line by 390eba058, "A discharge is EXPECTED,
    // confirmed or discharged". Main's copy of this assertion still said "predicted"; the
    // href behaviour it checks is unchanged and is main's, the vocabulary is ours.
    expect(screen.getByTestId("ward-capacity-headline-expected-today")).toHaveAttribute("href", dischargeHref);
    expect(screen.getByTestId("ward-capacity-headline-available-now")).not.toHaveAttribute("href");

    // No card anywhere in the headline claims to be a total/sum of the other four.
    expect(within(headline).queryByText(/total/i)).not.toBeInTheDocument();
    expect(within(headline).queryByText(/^sum$/i)).not.toBeInTheDocument();
  });

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
