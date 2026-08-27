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

function renderMorningPage({ withAccepter = false }: { withAccepter?: boolean } = {}) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MorningPage />
      {withAccepter && <ConcurrentAccepter />}
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
    expect(screen.getByTestId("ward-morning-view-live")).toHaveAttribute("aria-pressed", "true");

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

    // Stopped, not skipped ahead: further time must never reach beat 4.
    advance(TOUR_BEAT_INTERVAL_MS * 3);
    expect(screen.getByTestId("ward-morning-tour-beat")).toHaveTextContent("Beat 3 of 4");

    // Stop remains a real, working control from the refused state.
    fireEvent.click(screen.getByTestId("ward-morning-tour-stop"));
    expect(screen.getByTestId("ward-morning-tour-start")).toBeInTheDocument();
  });
});
