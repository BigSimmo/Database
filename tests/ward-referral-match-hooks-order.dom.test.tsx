import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { REFERRAL_DECLINE_REASONS, type Referral, type Unit } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * `ReferralMatchView` returns early for a referral with no psychiatric-ward destination — an ED or
 * a community team is answered by a person, not by matching a bed — and every one of its hooks was
 * called BELOW that return. React identifies a hook by its call ORDER inside a component, so a
 * component whose hook count depends on a prop has no stable identity for its own state.
 *
 * WHAT THIS DOES NOT DO IS THROW, and the reason is worth writing down so nobody re-derives it.
 * React 19.2.8 picks the hook dispatcher with
 * `null !== current && null !== current.memoizedState ? …OnUpdate : …OnMount`
 * (`react-dom/cjs/react-dom-client.development.js`), and detects the opposite direction with
 * `didRenderTooFewHooks = null !== currentHook && null !== currentHook.next`. A render that called
 * ZERO hooks leaves `memoizedState` null and never sets `currentHook`, so BOTH guards are asleep
 * for exactly this shape — an early return above every hook. "Rendered more hooks than during the
 * previous render." is never raised here.
 *
 * What happens instead is silent: React takes the MOUNT path again, so this view's local state —
 * the decline-reason draft a coordinator has already chosen, the rejection banner, the
 * prior-rejection ref, and the resize subscription behind `useBandGroupsOpenByDefault` — is
 * discarded and rebuilt, with the old subscription's cleanup never run. That is what the two
 * assertions below pin, because it is what a person would actually see and what actually leaks.
 * They fail while the hooks sit below the return and pass once they sit above it.
 */
function MatchHarness({ referral, units }: { referral: Referral; units: Unit[] }) {
  const { now, dispatch, rejections } = useWardFlow();
  return <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />;
}

/** Two referrals identical but for their destination, so the only thing that changes across the
 *  re-renders below is the branch the component takes — not the person, the urgency or the clock. */
const WARD_REFERRAL: Referral = {
  id: "RF-TEST-HOOKS",
  ageBand: "Adult",
  destinations: [
    {
      destination: {
        kind: "psychiatric_ward",
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
      },
      state: "queued",
    },
  ],
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: "Armadale" },
  source: "community",
  raisedAt: NOW_ANCHOR - 10,
  urgency: 2,
  originSiteCode: "RPH",
  transportNeeded: false,
};

const COMMUNITY_ONLY_REFERRAL: Referral = {
  ...WARD_REFERRAL,
  destinations: [{ destination: { kind: "community_team" }, state: "queued" }],
};

/** Any reason other than the `useState` initial value, taken from the list itself so that
 *  reordering or renaming the reasons cannot quietly turn this into a test of the default. */
const CHOSEN_DECLINE_REASON = REFERRAL_DECLINE_REASONS[REFERRAL_DECLINE_REASONS.length - 1];

/**
 * Counts subscriptions to the band-group media query. `jsdom.setup.ts` installs a stub that hands
 * back a fresh object per call, so the counters live out here rather than on any one of them.
 */
function installCountingMatchMedia() {
  const counts = { added: 0, removed: 0 };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {
        counts.added += 1;
      },
      removeEventListener: () => {
        counts.removed += 1;
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  return counts;
}

function tree(referral: Referral) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MatchHarness referral={referral} units={allUnits()} />
    </WardFlowProvider>
  );
}

describe("ReferralMatchView — every hook is called above the not-a-bed-question early return", () => {
  it("keeps its local state and its one subscription when a render takes the early-return branch", () => {
    const mediaCounts = installCountingMatchMedia();
    expect(CHOSEN_DECLINE_REASON).not.toBe(REFERRAL_DECLINE_REASONS[0]);

    const { rerender } = render(tree(WARD_REFERRAL));

    const select = screen.getByTestId("ward-referral-match-decline-reason");
    fireEvent.change(select, { target: { value: CHOSEN_DECLINE_REASON } });
    expect(screen.getByTestId("ward-referral-match-decline-reason")).toHaveValue(CHOSEN_DECLINE_REASON);
    expect(mediaCounts.added).toBe(1);

    // The same component, at the same position in the tree, now rendering a referral with no ward
    // destination. Non-vacuity: it really did take the early-return branch.
    rerender(tree(COMMUNITY_ONLY_REFERRAL));
    expect(screen.getByTestId("ward-referral-match-not-a-bed-question")).toBeInTheDocument();

    // And back. Non-vacuity again: it really did reach the bed shortlist, so the hooks under test
    // were genuinely run rather than skipped a second time.
    rerender(tree(WARD_REFERRAL));
    expect(screen.queryByTestId("ward-referral-match-not-a-bed-question")).not.toBeInTheDocument();

    // The coordinator's chosen decline reason is still chosen. With the hooks below the return,
    // React re-mounts them here and this reads back as the list's first reason instead.
    expect(screen.getByTestId("ward-referral-match-decline-reason")).toHaveValue(CHOSEN_DECLINE_REASON);

    // And the resize listener was subscribed once, not abandoned and replaced. A second `added`
    // with no matching `removed` is a listener nothing will ever detach.
    expect(mediaCounts).toEqual({ added: 1, removed: 0 });
  });
});
