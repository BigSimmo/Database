import { render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/**
 * OWNER RULING, 2026-09-02: a coordinator may see the suburb a referred patient is from —
 * `PD-3` permits a suburb precisely because it names a service area, never a dwelling. This suite
 * is the catcher for that ruling on the one surface where a coordinator is actually deciding
 * where a person goes (`ShortlistPanel`), and the guard that it stays off the ward's own screen.
 *
 * `Dianella` is a real catchment suburb (`ward-catchment.ts`, row `["6062", "Dianella",
 * "Mirrabooka", 4]`) chosen deliberately: it shares no substring with any hospital, unit, or
 * emergency-department name in `ward-sites.ts`'s site register, so a text assertion for it can
 * never be satisfied by an unrelated place name the screen would show anyway (the trap
 * `ward-screen-fd23-leaks.dom.test.tsx` already documents for "Armadale" — a real suburb that is
 * ALSO a real hospital name on this fixture).
 */
const TEST_SUBURB = "Dianella";
const TEST_ED_ID = "rph-ed";
const TEST_ORIGIN_SITE_CODE = "RPH";
/** The id the reducer's `nextFrontDoorReferralId` gives the first `RECEIVE_REFERRAL` raised
 *  against a freshly seeded state — see `ward-flow-reducer.ts`. */
const RAISED_REFERRAL_ID = "RF-901";
/** The id `nextReferralId` gives the first `RAISE_REFERRAL` raised against a freshly seeded
 *  state — mirrors `FIRST_RAISED_ID` in `ward-ed-screen.dom.test.tsx`. */
const RAISED_MOVEMENT_ID = "WF-901";

/**
 * Raises one front-door referral carrying `TEST_SUBURB`, then raises the ED journey linked to it
 * — both through the real reducer, dispatched exactly as `ward-ed-screen.dom.test.tsx` and
 * `ward-shortlist.dom.test.tsx` already dispatch events from a thin sibling that reads
 * `useWardFlow()`. Two `dispatch` calls in one effect body apply in order against the same
 * reducer, the same discipline those suites already rely on, so the second call's `referralId`
 * resolves against a referral the first call has already appended to state.
 */
function SeedReferredMovement() {
  const { now, dispatch } = useWardFlow();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId: TEST_ED_ID, purpose: "psychiatric_review" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: TEST_SUBURB },
      source: "community",
      urgency: 2,
      originSiteCode: TEST_ORIGIN_SITE_CODE,
      transportNeeded: false,
    });
    dispatch({
      type: "RAISE_REFERRAL",
      role: "ed",
      now,
      edId: TEST_ED_ID,
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        specialling: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
      referralId: RAISED_REFERRAL_ID,
    });
  }, [now, dispatch]);
  return null;
}

/** Mirrors `ShortlistHarness` in `ward-shortlist.dom.test.tsx`: the real provider state handed to
 *  the panel, so this exercises the real reducer and the real component wiring rather than a
 *  hand-built movement or a hand-built referral list. */
function ShortlistHarness() {
  const { movements, units, bedReleases, referrals, now, dispatch } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === RAISED_MOVEMENT_ID);
  return (
    <ShortlistPanel
      movement={movement}
      now={now}
      units={units}
      bedReleases={bedReleases}
      referrals={referrals}
      selectedUnitId={undefined}
      onSelectUnit={() => {}}
      dispatch={dispatch}
    />
  );
}

function renderCoordinatorShortlistWithSeededReferral() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SeedReferredMovement />
      <ShortlistHarness />
    </WardFlowProvider>,
  );
}

describe("coordinator shortlist shows a referred patient's suburb", () => {
  it("renders the suburb recorded on the patient's front-door referral", () => {
    renderCoordinatorShortlistWithSeededReferral();

    // A canary on the harness itself, so a broken seed reads as an obvious setup failure rather
    // than a false negative on the assertion below.
    expect(
      screen.getByTestId(`ward-shortlist-${RAISED_MOVEMENT_ID}`),
      "the seeded movement never reached the shortlist panel, so the suburb assertion below proves nothing",
    ).toBeInTheDocument();

    expect(screen.getByTestId("ward-shortlist-suburb")).toHaveTextContent(TEST_SUBURB);
  });

  it("shows no suburb line for a movement with no linked referral", () => {
    // WF-308 is the real fixture's own hand-authored movement, seeded with no `referralId` (see
    // that field's own doc comment on `Movement`: "OPTIONAL, AND NEVER BACKFILLED"). The absence
    // of the badge for the ordinary case is as much a contract as its presence for the seeded one
    // — a placeholder suburb here would be an invented administrative fact.
    function OrdinaryMovementHarness() {
      const { movements, units, bedReleases, referrals, now, dispatch } = useWardFlow();
      const movement = movements.find((candidate) => candidate.id === "WF-308");
      return (
        <ShortlistPanel
          movement={movement}
          now={now}
          units={units}
          bedReleases={bedReleases}
          referrals={referrals}
          selectedUnitId={undefined}
          onSelectUnit={() => {}}
          dispatch={dispatch}
        />
      );
    }

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OrdinaryMovementHarness />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-shortlist-WF-308")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-shortlist-suburb")).not.toBeInTheDocument();
  });
});

describe("FD-suburb: the ward's own screen never shows it", () => {
  /**
   * ⚠️ WATCHED FAILING BEFORE BEING TRUSTED, THE ONLY HONEST WAY A NEGATIVE LIKE THIS CAN BE.
   * Before this feature existed, nothing anywhere rendered a referral's suburb, so this assertion
   * necessarily already passed on the unmodified codebase — there was nothing yet to leak. A green
   * run on that baseline is not evidence the guard works; it is evidence there was nothing to
   * catch. This test was therefore proved by mutation rather than by a pre-fix red run: a suburb
   * line was temporarily added to `ward-screen.tsx`'s incoming-referral card (reading the exact
   * same shared `referrals` context this suite seeds), this test was re-run and confirmed to fail
   * against that mutation, and the mutation was then reverted. The command and its failing output
   * are recorded in this task's report rather than repeated here, so a reader trusts this guard for
   * the same reason `ward-screen-fd23-leaks.dom.test.tsx`'s own "detector is proved before it is
   * trusted" test exists: an absence check that cannot fire is indistinguishable from one that
   * passes.
   *
   * The mechanism this guard actually relies on is structural, not this assertion alone:
   * `ShortlistPanel` (where the suburb is rendered) lives under `coordinator/` and nothing under
   * `ward/` imports it or the `referralForMovement`/`referralSuburbLabel` helpers it calls. This
   * test pins the observable behaviour that structure produces.
   */
  it("never renders a referral's suburb on the ward's incoming-referral view", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SeedReferredMovement />
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // A canary on the ward screen actually having rendered real content, so a broken render
    // (unit not found, thrown error swallowed by jsdom) could not pass this test by leaving an
    // empty document with no suburb anywhere in it.
    expect(
      screen.getByTestId("ward-unit-screen"),
      "the ward screen did not render at all, so the absence assertion below proves nothing",
    ).toBeInTheDocument();

    expect(screen.queryByText(TEST_SUBURB)).not.toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toContain(TEST_SUBURB);
  });
});
