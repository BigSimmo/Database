import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors tests/ward-restriction-notice.test.ts's sibling dom suites (mode-nav.dom.test.tsx,
// ward-flow-clock-consistency.dom.test.tsx, ward-flow-queue-selection.dom.test.tsx):
// `ClinicalRail` renders next/link anchors and this suite never checks routing itself, so a
// plain <a> avoids requiring an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { bedReleases, movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/** Looked up against the raw seed fixture only to pin the fixture assumption below — never
 *  imported by `ward-screen.tsx` itself (`tests/ward-flow-single-source.test.ts` bans that). */
function bedReleaseById(id: string) {
  return bedReleases.find((release) => release.id === id);
}

function RequestBtyAdultSecureRefresh() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: "bty-adult-secure" })
      }
    >
      request bty-adult-secure refresh
    </button>
  );
}

/**
 * Addendum R38: the brief's own chosen unit (`bty-adult-secure`) can never exercise a
 * restriction notice — its one live referral, WF-017, is Involuntary/Secure, and
 * `restrictionNotice` returns undefined for that pair (both levels require either an
 * Open-security movement or a Voluntary one against a Secure unit). Proving the notice actually
 * renders on this screen needs a pair that genuinely produces one.
 *
 * WF-301 is that pair, already measured and pinned against the real fixture in
 * `tests/ui-ward-coordinator.spec.ts`'s "gives a voluntary patient on a locked ward its own, more
 * prominent notice on the diagram" test: WF-301 is a Voluntary movement whose cohort (Adult)
 * shortlists exactly the three Secure adult wards, `rph-adult-secure` among them — verified below
 * again, independently, against the real fixture rather than assumed, so this test fails loudly
 * rather than silently no-op'ing if the fixture ever changes underneath it.
 *
 * WF-301 sits at `placement_requested` at seed (no live referral yet — the generated fixture's
 * `security: "Secure"` and `stage` both derive from `index % 7`, so a generated Secure movement
 * is always seeded at `placement_requested`, never already referred). A real `REFER_TO_UNITS`
 * dispatch — not a hand-authored fixture edit — creates the live referral, exactly the same
 * "dispatch a real event from a sibling, then read the target component again" technique
 * `tests/ward-flow-queue-selection.dom.test.tsx` uses to prove state is derived, not cached.
 */
const WF_301 = movementById("WF-301");
const RPH_ADULT_SECURE = unitById("rph-adult-secure");

function ReferWF301ToRphAdultSecure() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "REFER_TO_UNITS",
          role: "coordinator",
          now,
          movementId: "WF-301",
          unitIds: ["rph-adult-secure"],
        })
      }
    >
      refer WF-301 to RPH Adult Secure
    </button>
  );
}

describe("ward screen restriction notice", () => {
  it("fixture assumption: WF-301 is Voluntary and RPH Adult Secure is Secure — the pair restrictionNotice flags", () => {
    // Guards the whole suite below: if either fact stops being true, every other assertion here
    // would either false-positive or silently stop covering the case it exists for.
    expect(WF_301?.legalStatus).toBe("Voluntary");
    expect(WF_301?.security).toBe("Secure");
    expect(RPH_ADULT_SECURE?.security).toBe("Secure");
  });

  it("renders the sharper voluntary-on-locked notice once this ward genuinely holds that referral", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF301ToRphAdultSecure />
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // Before the referral: WF-301 does not yet hold a live referral anywhere, so RPH Adult
    // Secure's incoming list does not carry it.
    expect(screen.queryByTestId("ward-incoming-WF-301")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "refer WF-301 to RPH Adult Secure" }));

    // After a real REFER_TO_UNITS dispatch, WF-301 is a live incoming referral at this unit —
    // derived fresh from the provider's own `movements`, not a locally cached list.
    const incoming = screen.getByTestId("ward-incoming-WF-301");
    expect(incoming).toBeInTheDocument();

    const notice = screen.getByTestId("ward-restriction-notice-WF-301");
    expect(notice).toHaveTextContent("Voluntary patient on a locked ward — review legal status before admission");
    // The sharper level, distinguished by its own data attribute — never wording alone.
    expect(notice).toHaveAttribute("data-level", "voluntary_on_locked");
  });

  it("names bty-adult-secure's unresolved id when the route carries one, never a substituted ward", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="does-not-exist-in-the-fixture" />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-unit-screen")).toHaveTextContent("does-not-exist-in-the-fixture");
    expect(screen.queryByTestId("ward-unit-beds")).not.toBeInTheDocument();
  });
});

function ConfirmRphAdultSecureCapacityAtZero() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "CONFIRM_CAPACITY",
          role: "ward",
          now,
          unitId: "rph-adult-secure",
          actingUnitId: "rph-adult-secure",
          value: 0,
        })
      }
    >
      confirm rph-adult-secure capacity at zero
    </button>
  );
}

describe("ward screen live unit capacity", () => {
  it("resolves the unit from the provider's live units, not the frozen unitById() fixture", () => {
    // rph-adult-secure is seeded with allocatable.value 1 (pinned by
    // tests/ward-flow-reducer.test.ts's "writes the ward's restated allocatable count" case).
    const seededUnit = unitById("rph-adult-secure");
    expect(seededUnit?.allocatable.value).toBe(1);

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ConfirmRphAdultSecureCapacityAtZero />
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    expect(screen.getByText(/Currently confirmed 1 at/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "confirm rph-adult-secure capacity at zero" }));

    // After a real CONFIRM_CAPACITY dispatch updates state.units, the screen must show the new
    // live count — resolving from the frozen fixture would keep showing 1 forever.
    expect(screen.getByText(/Currently confirmed 0 at/)).toBeInTheDocument();
  });
});

/**
 * Visual-fix pass: this ward screen used to render a single "Potential" chip sourced from
 * `unitCapacity()`'s raw, state-and-timing-blind release count — the same unit's own bed release
 * could be explicitly listed as `Confirmed` in the "Bed releases" list below while this chip row
 * still called it `Potential`, contradicting both itself and the capacity board's own
 * Confirmed/Predicted split one screen over. This suite pins the fix: the chip row must never
 * render the word "Potential" again, and must instead show the same Confirmed/Predicted/Leave
 * figures `capacityBreakdown()` computes — the one the capacity board already uses.
 *
 * rph-adult-secure is the phase's own chosen unit and carries exactly one seeded bed release
 * (WR-001, `confirmed`, expected well inside today — asserted at the top of the earlier "bed
 * release controls" suite above) and exactly one seeded leave bed (WL-001, `usable: true`). That
 * gives an unambiguous, non-zero expectation for all three new figures: Confirmed 1, Predicted 0,
 * Leave (usable) 1.
 */
describe("ward screen bed capacity chip row uses the shared breakdown, not the raw potential count", () => {
  it("never renders 'Potential', and renders Confirmed/Predicted/Leave from capacityBreakdown()", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const chipRow = screen.getByTestId("ward-unit-beds");

    // The defect this suite exists to catch: the word this screen used to show for a figure the
    // capacity board no longer calls "Potential" anywhere. A chip row that still said "Potential 1"
    // here — right next to the same release explicitly listed as "Confirmed" below — is exactly
    // the contradiction being fixed.
    expect(chipRow).not.toHaveTextContent("Potential");

    // The replacement figures, sourced from the same `capacityBreakdown()` the capacity board
    // reads, not re-derived by hand and not read from `unitCapacity()`.
    expect(chipRow).toHaveTextContent("Confirmed 1");
    expect(chipRow).toHaveTextContent("Predicted 0");
    expect(chipRow).toHaveTextContent("Leave (usable) 1");

    // The four physical states are untouched by this fix — same figures, same order, same chips.
    expect(chipRow).toHaveTextContent("Ready 1");
    expect(chipRow).toHaveTextContent("Held 1");
    expect(chipRow).toHaveTextContent("Blocked 0");
    expect(chipRow).toHaveTextContent("Occupied 18");
  });

  /**
   * Bed-model rework (2026-08-28): the ward's own blocked-release figure, shown BESIDE Confirmed
   * and Predicted rather than instead of either.
   *
   * The two words matter as much as the number. This chip row already carries a "Blocked" chip
   * meaning physically blocked BEDS (`unitCapacity().blocked`, 0 at rph-adult-secure), so the new
   * figure reads "Blocked releases" — two chips reading the same word beside each other while
   * meaning different things would be a defect, not a tidy-up. Both are asserted here together,
   * which is the only place in the suite where the distinction can actually go wrong.
   */
  it("renders the blocked-release count beside Confirmed, worded so it cannot be read as the physical Blocked chip", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const chipRow = screen.getByTestId("ward-unit-beds");
    // rph-adult-secure's one seeded release (WR-001) is confirmed and unblocked.
    expect(chipRow).toHaveTextContent("Confirmed 1");
    expect(screen.getByTestId("ward-unit-blocked-releases")).toHaveTextContent("Blocked releases 0");
    // ...and the physical bed chip still says its own, different thing.
    expect(chipRow).toHaveTextContent("Blocked 0");
  });

  /**
   * The same unit's figures after the ward reports that confirmed discharge stuck — the exact
   * journey the rework exists for, at the screen a ward actually looks at. Confirmed must NOT
   * fall; before the rework it fell to 0 here, so the ward's screen looked better at the moment
   * its bed became harder to free.
   */
  it("keeps Confirmed at 1 when the ward blocks its confirmed release, and moves Blocked releases to 1", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId("ward-bed-release-block-toggle-WR-001"));
    fireEvent.change(screen.getByTestId("ward-bed-release-blocker-WR-001"), {
      target: { value: "Awaiting clean" },
    });
    fireEvent.click(screen.getByTestId("ward-bed-release-block-submit-WR-001"));

    const chipRow = screen.getByTestId("ward-unit-beds");
    expect(chipRow).toHaveTextContent("Confirmed 1");
    expect(screen.getByTestId("ward-unit-blocked-releases")).toHaveTextContent("Blocked releases 1");
    // The row itself states both facts, in two separate elements.
    const row = screen.getByTestId("ward-bed-release-WR-001");
    expect(within(row).getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByTestId("ward-bed-release-blocked-flag-WR-001")).toHaveTextContent("Blocked");
  });
});

/**
 * Task 5 (spec D10/D12): the ward's own bed-release controls, and the refresh-requested mark.
 * All four cases render a fresh `WardFlowProvider` each time, so each starts from the real seed
 * fixture (`ward-movements.ts`'s `bedReleases`) untouched by any other test in this file.
 *
 * WR-002 (`scgh-adult-open`, `predicted`, confidence `likely`) and WR-001 (`rph-adult-secure`,
 * `confirmed`) are the two seeded releases this suite exercises — both asserted directly against
 * the fixture below so this suite fails loudly, not silently, if the fixture ever changes under
 * it (the same discipline the restriction-notice suite above already uses for WF-301).
 */
describe("ward screen bed release controls", () => {
  it("fixture assumption: WR-002 is predicted at scgh-adult-open and WR-001 is confirmed at rph-adult-secure", () => {
    const wr002 = bedReleaseById("WR-002");
    const wr001 = bedReleaseById("WR-001");
    expect(wr002?.unitId).toBe("scgh-adult-open");
    expect(wr002?.state).toBe("predicted");
    expect(wr001?.unitId).toBe("rph-adult-secure");
    expect(wr001?.state).toBe("confirmed");
  });

  it("renders the bed release state as a sentence-case display label, never the raw lowercase union value", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="scgh-adult-open" />
      </WardFlowProvider>,
    );

    // WR-002 is `predicted` in the fixture (asserted above). The screen must show the display
    // label "Predicted", never the raw union value "predicted" — a coordinator reading this row
    // sees the same sentence-case convention every other status label on this screen uses.
    const row = screen.getByTestId("ward-bed-release-WR-002");
    const stateText = row.querySelector("strong")?.textContent ?? "";
    expect(stateText).toBe("Predicted");
    // Guards the actual defect directly: the raw lowercase value must not be what is rendered.
    expect(stateText).not.toBe("predicted");
    expect(stateText).not.toMatch(/^[a-z]/);
  });

  it("confirming a predicted release updates the row", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="scgh-adult-open" />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-bed-release-WR-002")).toHaveTextContent("Predicted");

    fireEvent.click(screen.getByTestId("ward-bed-release-confirm-WR-002"));

    expect(screen.getByTestId("ward-bed-release-WR-002")).toHaveTextContent("Confirmed");
    // A confirmed release offers no Confirm control any more.
    expect(screen.queryByTestId("ward-bed-release-confirm-WR-002")).not.toBeInTheDocument();
  });

  it("blocking asks for a reason and refuses without one", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="scgh-adult-open" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId("ward-bed-release-block-toggle-WR-002"));

    const submit = screen.getByTestId("ward-bed-release-block-submit-WR-002");
    // No blocker chosen yet: the submit control is natively disabled, not merely advisory.
    expect(submit).toBeDisabled();

    // Clicking a disabled submit dispatches nothing — the row must still read "Predicted".
    fireEvent.click(submit);
    expect(screen.getByTestId("ward-bed-release-WR-002")).toHaveTextContent("Predicted");

    fireEvent.change(screen.getByTestId("ward-bed-release-blocker-WR-002"), {
      target: { value: "Awaiting clean" },
    });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);

    const row = screen.getByTestId("ward-bed-release-WR-002");
    expect(row).toHaveTextContent("Blocked");
    expect(row).toHaveTextContent("Awaiting clean");
  });

  it("releasing removes it from the pending list", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-bed-release-WR-001")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-bed-release-release-WR-001"));

    expect(screen.queryByTestId("ward-bed-release-WR-001")).not.toBeInTheDocument();
  });

  it("a refresh request raised by a coordinator appears on this ward's screen as a visible mark naming the time and role", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RequestBtyAdultSecureRefresh />
        <WardScreen unitId="bty-adult-secure" />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId("ward-refresh-request-mark")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "request bty-adult-secure refresh" }));

    const mark = screen.getByTestId("ward-refresh-request-mark");
    // NOW_ANCHOR is 10:42 (ward-sites.ts) and REQUEST_CAPACITY_REFRESH is coordinator-only
    // (ward-flow-events.ts's EVENT_ROLE), so the recorded role is always literally "coordinator".
    expect(mark).toHaveTextContent("10:42");
    expect(mark).toHaveTextContent("coordinator");
  });

  it("recording a leave bed then ending it removes it from this unit's rows, and the usable-leave figure drops", () => {
    // scgh-adult-open carries no seeded leave bed (only rph-adult-secure/WL-001 and
    // scgh-older-adult/WL-002 do — ward-movements.ts), so this starts from a clean, empty list.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="scgh-adult-open" />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-leave-bed-list")).toHaveTextContent("No bed currently on leave");
    expect(screen.getByTestId("ward-leave-bed-form")).toHaveTextContent("0 beds currently on leave at SCGH Adult Open");

    fireEvent.click(screen.getByTestId("ward-leave-bed-usable"));
    fireEvent.change(screen.getByTestId("ward-leave-bed-expected-return"), { target: { value: "12:15" } });
    fireEvent.click(screen.getByTestId("ward-leave-bed-submit"));

    const list = screen.getByTestId("ward-leave-bed-list");
    expect(list).toHaveTextContent("Usable while away");
    expect(screen.getByTestId("ward-leave-bed-form")).toHaveTextContent(
      "1 bed currently on leave at SCGH Adult Open, 1 usable while away",
    );

    fireEvent.click(within(list).getByRole("button", { name: "Ended" }));

    expect(screen.getByTestId("ward-leave-bed-list")).toHaveTextContent("No bed currently on leave");
    expect(screen.getByTestId("ward-leave-bed-form")).toHaveTextContent("0 beds currently on leave at SCGH Adult Open");
  });
});
