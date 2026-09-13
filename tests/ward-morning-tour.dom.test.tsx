import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite (ward-morning-page.dom.test.tsx, ward-handover.dom.test.tsx):
// `ClinicalRail` renders next/link anchors and this suite never checks routing, so a plain <a>
// avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { MorningPage } from "@/components/ward-management/morning/morning-page";
import { MorningTour } from "@/components/ward-management/morning/morning-tour";
import { TOUR_BEAT_INTERVAL_MS, tourBeatEvents } from "@/components/ward-management/morning/morning-tour";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * Simulates a concurrent human acceptance: a real, correctly-permissioned `ACCEPT_IN_PRINCIPLE`
 * dispatched from OUTSIDE the tour, timed to land between the tour's own beat 2 and beat 3 so its
 * beat 3 attempt at the same movement is genuinely refused by the reducer
 * (`movement.acceptedUnitId` is already set — see `ward-flow-reducer.ts`'s `ACCEPT_IN_PRINCIPLE`
 * case). This produces a real `Rejection` through the real reducer, not a hand-authored one and
 * not a source-code mutation — exactly the scenario the tour's halt-on-refusal logic exists for.
 */
function ConcurrentAccepter() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="concurrent-accept"
      onClick={() =>
        dispatch({
          type: "ACCEPT_IN_PRINCIPLE",
          role: "ward",
          now,
          movementId: "WF-901",
          unitId: "scgh-adult-open",
        })
      }
    >
      concurrent accept
    </button>
  );
}

/**
 * Read-only window into shared reducer state, for assertions the tour's own `phase` cannot prove
 * (Finding 2): whether the tour's own referral (`WF-901`) is still live, and what state the bed
 * release it confirms (`WR-002`) currently carries. `phase` flipping to `"idle"` is true whether
 * or not `finish()`'s `RESET_SCENARIO` dispatch actually runs — this reads the shared state the
 * dispatch is supposed to affect, directly.
 */
function StateProbe() {
  const { movements, bedReleases } = useWardFlow();
  return (
    <div
      data-testid="state-probe"
      data-tour-movement-exists={movements.some((movement) => movement.id === "WF-901")}
      data-release-state={bedReleases.find((release) => release.id === "WR-002")?.state ?? "missing"}
    />
  );
}

/** A real, non-tour `RAISE_REFERRAL` — same shape a real ED screen would dispatch — used by the
 *  Finding 1 guard test to prove an idle/never-started tour's unmount must not wipe real data. */
function ExternalRaiser() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="external-raise"
      onClick={() =>
        dispatch({
          type: "RAISE_REFERRAL",
          role: "ed",
          now,
          edId: "scgh-ed",
          draft: {
            cohort: "Adult",
            security: "Open",
            sex: "Female",
            specialling: false,
            legalStatus: "Voluntary",
            urgency: 2,
            legalFormCode: null,
          },
        })
      }
    >
      raise
    </button>
  );
}

/**
 * Mounts the tour DIRECTLY, beside the page rather than inside it.
 *
 * WHY, from 2026-08-30: the owner paused the guided tour — "pause the guided tour for now as the app
 * is not built. That should be done last." `MorningPage` no longer renders `MorningTour`, so a test
 * that mounted the page and looked for the tour would find nothing.
 *
 * The tour is PAUSED, NOT DELETED, and that distinction is only real if its behaviour stays covered.
 * Skipping this file would have been the easy alternative and the wrong one: a skipped test is a
 * check that cannot fail, so the tour would rot silently and whoever un-pauses it would inherit
 * whatever it had become. Mounting the component directly keeps every assertion below live against
 * the real reducer, exactly as before — only the page's own rendering of it has stopped.
 *
 * `onChangeView` is a no-op stub. It used to switch the page between a frozen and a live view;
 * WB-DB-11 removed that view entirely, so there is nothing left for it to change and the tour's
 * remaining behaviour is what these tests are about.
 *
 * The complement to this file is `tests/ward-morning-tour-paused.test.tsx`, which asserts the page
 * mounts no tour and dispatches nothing. Together they say: the tour works, and it is switched off.
 */
function renderMorningPage({ withAccepter = false }: { withAccepter?: boolean } = {}) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MorningPage />
      <MorningTour onChangeView={() => {}} />
      {withAccepter && <ConcurrentAccepter />}
      <StateProbe />
    </WardFlowProvider>,
  );
}

function advance(ms = TOUR_BEAT_INTERVAL_MS) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("MorningTour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches every beat under exactly the role EVENT_ROLE permits (controller ruling R4)", () => {
    // Static, no rendering required: this is the brief's own instruction — "verify each beat's
    // role against EVENT_ROLE before writing the beat" — turned into a permanent, automated
    // guard rather than a one-time manual check.
    for (let beat = 0; beat <= 4; beat++) {
      for (const event of tourBeatEvents(beat, NOW_ANCHOR)) {
        expect(EVENT_ROLE[event.type]).toContain(event.role);
      }
    }
  });

  it("begins with RESET_SCENARIO stated on screen, switches to the live view, and advances through all five beats before resetting back to idle", () => {
    installMatchMediaStub(false);
    renderMorningPage();

    fireEvent.click(screen.getByTestId("ward-morning-tour-start"));

    // Beat 0: says so on screen (hard requirement), and switches the page to the live view
    // (ruling R1 — the fixed view is a frozen snapshot and would never show beat 4).
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 0 of 4");
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/resetting/i);
    // The tour used to switch the page to the live view at Start, asserted here through the
    // fixed/live toggle's aria-pressed state. WB-DB-11 removed that toggle on 2026-08-30 - there
    // is one view now and it is always live - so there is no control left to press and nothing
    // for the tour to switch. The assertion is removed rather than adapted: adapting it would
    // have meant inventing a new thing for it to check, which is how a test outlives its subject.

    advance();
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 1 of 4");
    expect(screen.getByTestId("ward-morning-tour-caption")).toBeInTheDocument();

    advance();
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 2 of 4");
    expect(screen.getByTestId("ward-morning-tour-caption")).toBeInTheDocument();

    advance();
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 3 of 4");
    expect(screen.getByTestId("ward-morning-tour-caption")).toBeInTheDocument();

    advance();
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 4 of 4");
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/board updates/i);

    // Final transition: ends by resetting (hard requirement) — back to idle, Start reappears.
    advance();
    expect(screen.getByTestId("ward-morning-tour-start")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-morning-tour-beat")).not.toBeInTheDocument();

    // Finding 2: the two checks above are hollow — both depend solely on this component's own
    // `phase` state flipping to "idle", which happens whether or not the `RESET_SCENARIO`
    // dispatch inside `finish()` actually runs. Prove the SHARED reducer state really returned to
    // its seeded values: the referral the tour raised at beat 1 is gone, and the bed release it
    // confirmed at beat 3 is back to its seeded "expected" state.
    const resetProbe = screen.getByTestId("state-probe");
    expect(resetProbe).toHaveAttribute("data-tour-movement-exists", "false");
    expect(resetProbe).toHaveAttribute("data-release-state", "expected");
  });

  it("Stop halts at the current beat and does not advance further", () => {
    installMatchMediaStub(false);
    renderMorningPage();

    fireEvent.click(screen.getByTestId("ward-morning-tour-start"));
    advance(); // beat 1
    advance(); // beat 2
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 2 of 4");

    fireEvent.click(screen.getByTestId("ward-morning-tour-stop"));

    // Takes effect at the current beat, synchronously — zero further time advanced.
    expect(screen.getByTestId("ward-morning-tour-start")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-morning-tour-beat")).not.toBeInTheDocument();

    // Finding 2: Stop's "ends by resetting" runs through the SAME `finish()` as natural
    // completion — prove the shared state actually reset here too, not just this component's
    // phase. Beat 1's `RAISE_REFERRAL` (WF-901) must be gone from shared state.
    expect(screen.getByTestId("state-probe")).toHaveAttribute("data-tour-movement-exists", "false");

    // Stays that way: the pending auto-advance was genuinely cancelled, not merely outrun by
    // this assertion — advancing well past every remaining beat's interval must never revive it.
    advance(TOUR_BEAT_INTERVAL_MS * 5);
    expect(screen.getByTestId("ward-morning-tour-start")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-morning-tour-beat")).not.toBeInTheDocument();
  });

  it("under prefers-reduced-motion: reduce, the tour does not auto-advance and a Next control drives every beat instead", () => {
    installMatchMediaStub(true);
    renderMorningPage();

    fireEvent.click(screen.getByTestId("ward-morning-tour-start"));
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 0 of 4");
    expect(screen.getByTestId("ward-morning-tour-next")).toBeInTheDocument();

    // No timed transition at all: advancing fake time on its own does nothing.
    advance(TOUR_BEAT_INTERVAL_MS * 3);
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 0 of 4");

    fireEvent.click(screen.getByTestId("ward-morning-tour-next"));
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 1 of 4");

    fireEvent.click(screen.getByTestId("ward-morning-tour-next"));
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 2 of 4");

    fireEvent.click(screen.getByTestId("ward-morning-tour-next"));
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 3 of 4");

    fireEvent.click(screen.getByTestId("ward-morning-tour-next"));
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 4 of 4");

    // A fifth Next finishes the tour — ends by resetting, back to idle.
    fireEvent.click(screen.getByTestId("ward-morning-tour-next"));
    expect(screen.getByTestId("ward-morning-tour-start")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-morning-tour-beat")).not.toBeInTheDocument();
  });

  it("a refused dispatch surfaces as the existing Rejection and the tour stops at that beat rather than skipping ahead", () => {
    installMatchMediaStub(false);
    renderMorningPage({ withAccepter: true });

    fireEvent.click(screen.getByTestId("ward-morning-tour-start"));
    advance(); // beat 1 — RAISE_REFERRAL creates WF-901
    advance(); // beat 2 — REFER_TO_UNITS refers WF-901 to scgh-adult-open
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 2 of 4");

    // A concurrent, correctly-permissioned acceptance lands before the tour's own beat 3 fires.
    fireEvent.click(screen.getByTestId("concurrent-accept"));

    advance(); // beat 3 — the tour's own ACCEPT_IN_PRINCIPLE is now genuinely refused

    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 3 of 4");
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/already accepted/i);
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/invented/i);

    // Finding 3: a refused ACCEPT_IN_PRINCIPLE must never let the beat's second event
    // (CONFIRM_BED_RELEASE) still fire — the release stays exactly where the concurrent
    // acceptance left it (seeded "expected"), never flipped to "confirmed" under an acceptance
    // that was actually refused.
    expect(screen.getByTestId("state-probe")).toHaveAttribute("data-release-state", "expected");

    // Stopped, not skipped ahead: further time must never reach beat 4.
    advance(TOUR_BEAT_INTERVAL_MS * 3);
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 3 of 4");

    // Stop remains a real, working control from the refused state.
    fireEvent.click(screen.getByTestId("ward-morning-tour-stop"));
    expect(screen.getByTestId("ward-morning-tour-start")).toBeInTheDocument();
  });

  it("resets the shared scenario on unmount while mid-run, but not when unmounted from idle (Finding 1)", () => {
    installMatchMediaStub(false);
    const { rerender } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MorningPage />
        <MorningTour onChangeView={() => {}} />
        <ExternalRaiser />
        <StateProbe />
      </WardFlowProvider>,
    );

    // Case 1 — never started: a real, non-tour referral already exists in shared state (the same
    // way a real ED screen would raise one) before the tour is ever touched.
    fireEvent.click(screen.getByTestId("external-raise"));
    expect(screen.getByTestId("state-probe")).toHaveAttribute("data-tour-movement-exists", "true");

    // Unmount the whole page (and therefore the idle MorningTour) while the WardFlowProvider —
    // mounted at the route-group layout in the real app — stays alive, exactly like a next/link
    // navigation away from a screen that never touched the tour.
    rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ExternalRaiser />
        <StateProbe />
      </WardFlowProvider>,
    );

    // An idle tour's unmount must not wipe real, non-tour data out from under whoever raised it.
    expect(screen.getByTestId("state-probe")).toHaveAttribute("data-tour-movement-exists", "true");

    // Case 2 — mid-run: remount the page, start the tour, let it pass beat 1 (a fabricated
    // referral now exists in shared state), then navigate away exactly as `ClinicalRail`'s real
    // next/link controls would let a visitor do — nothing disables them while the tour runs.
    rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MorningPage />
        <MorningTour onChangeView={() => {}} />
        <ExternalRaiser />
        <StateProbe />
      </WardFlowProvider>,
    );
    // The provider instance persisted across both rerenders above (same component type/position),
    // so the Case 1 referral is still there; start the tour on top of it.
    fireEvent.click(screen.getByTestId("ward-morning-tour-start"));
    advance(); // beat 1 — RAISE_REFERRAL creates WF-901, now live in shared state
    expect(screen.getByTestId("state-probe")).toHaveAttribute("data-tour-movement-exists", "true");

    rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ExternalRaiser />
        <StateProbe />
      </WardFlowProvider>,
    );

    // Mid-run unmount must reset: the fabricated referral must not be left live for whoever looks
    // at this shared state next.
    expect(screen.getByTestId("state-probe")).toHaveAttribute("data-tour-movement-exists", "false");
  });

  it("every beat's caption states plainly that its figures are invented, and beats 1-3 describe what actually happened (Finding 4)", () => {
    installMatchMediaStub(false);
    renderMorningPage();

    fireEvent.click(screen.getByTestId("ward-morning-tour-start"));
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/invented/i);

    advance(); // beat 1 — RAISE_REFERRAL
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(
      /referred from the emergency department/i,
    );
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/invented/i);

    advance(); // beat 2 — REFER_TO_UNITS
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/refers the invented patient to a ward/i);
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/invented/i);

    advance(); // beat 3 — ACCEPT_IN_PRINCIPLE, then CONFIRM_BED_RELEASE
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/accepts the referral in principle/i);
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/invented/i);

    advance(); // beat 4 — the live board re-renders
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/board updates/i);
    expect(screen.getByTestId("ward-morning-tour-caption")).toHaveTextContent(/invented/i);
  });
});
