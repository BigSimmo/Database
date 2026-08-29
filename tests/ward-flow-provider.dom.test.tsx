import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { absoluteWallClockMinutes, MINUTES_PER_DAY, wallClockNow } from "@/components/ward-management/ward-clock";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Only `wallClockNow` is mocked — `elapsedMinutesSinceMount` and every other export stay real,
// so this proves the provider's own accumulation logic, not a stand-in for it.
vi.mock("@/components/ward-management/ward-clock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-clock")>();
  return {
    ...actual,
    wallClockNow: vi.fn(actual.wallClockNow),
    absoluteWallClockMinutes: vi.fn(actual.absoluteWallClockMinutes),
  };
});

function Probe() {
  const { movements, units, now, rejections } = useWardFlow();
  return (
    <ul>
      <li data-testid="movements">{movements.length}</li>
      <li data-testid="units">{units.length}</li>
      <li data-testid="now">{now}</li>
      <li data-testid="rejections">{rejections.length}</li>
    </ul>
  );
}

/** Adds a control that raises a real, role-gated demo event, so a test can prove `dispatch`
 * is wired to the live reducer rather than being a no-op or resetting state on re-render. */
function DispatchProbe() {
  const { now, dispatch } = useWardFlow();
  return (
    <div>
      <span data-testid="now">{now}</span>
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 15 })}>
        advance
      </button>
    </div>
  );
}

describe("WardFlowProvider", () => {
  it("seeds the fixture and holds the clock at the injected instant", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("movements")).toHaveTextContent("48");
    // Was 22 before Phase 7 (spec "The front door") added `bty-youth` (East Metropolitan Youth
    // Unit) to the fixture in `ward-sites.ts`.
    expect(screen.getByTestId("units")).toHaveTextContent("23");
    expect(screen.getByTestId("now")).toHaveTextContent(String(NOW_ANCHOR));
    expect(screen.getByTestId("rejections")).toHaveTextContent("0");
  });

  it("refuses to be used outside the provider rather than returning an empty world", () => {
    // Conservative failure: a component rendered outside the provider must fail loudly, not
    // silently render zero patients, which would read as a quiet night.
    expect(() => render(<Probe />)).toThrow(/WardFlowProvider/);
  });

  describe("with the wall clock spied", () => {
    let setIntervalSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      setIntervalSpy = vi.spyOn(window, "setInterval");
    });

    afterEach(() => {
      setIntervalSpy.mockRestore();
    });

    it("never starts the ticking interval when a test pins the clock", () => {
      // This is the exact failure mode the brief calls out by name: a clock that ticks in
      // tests makes every later screen test flaky. `initialNow` must short-circuit the
      // interval entirely, not just cap its visible effect.
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Probe />
        </WardFlowProvider>,
      );
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });
  });

  it("dispatches through the live reducer and keeps the result across re-renders, rather than a no-op or a silent re-seed", () => {
    // Neither test above ever calls `dispatch`. Without this, a `dispatch` wired to a no-op,
    // or a provider that quietly re-seeds its state on every render, would still pass every
    // other check here.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DispatchProbe />
      </WardFlowProvider>,
    );
    const button = screen.getByRole("button", { name: "advance" });
    fireEvent.click(button);
    expect(screen.getByTestId("now")).toHaveTextContent(String(NOW_ANCHOR + 15));
    // A second dispatch must accumulate onto the first, not restart from the seeded state.
    fireEvent.click(button);
    expect(screen.getByTestId("now")).toHaveTextContent(String(NOW_ANCHOR + 30));
  });

  describe("wall-clock elapsed time beyond one day", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.mocked(wallClockNow).mockReset();
      vi.mocked(absoluteWallClockMinutes).mockReset();
    });

    it("keeps accumulating elapsed minutes past a full day, which is now true by construction", () => {
      /*
       * REWRITTEN 2026-08-30. The property is unchanged and the mechanism is gone.
       *
       * The original defect: `wallClockNow()` returns a minute of the day, so a dashboard mounted for
       * exactly 24 hours read the same value again, the difference landed on zero, and elapsed time
       * silently reset - moving every deadline, wait and expired hold on every screen backward by up
       * to a day. It was fixed by accumulating each 30s delta so no comparison ever reached back to
       * the original mount instant.
       *
       * The provider now reads `absoluteWallClockMinutes()`, which carries the date. Two readings
       * cannot alias, so elapsed time is a plain subtraction and the rollover class cannot occur at
       * all. This test therefore no longer reproduces a rollover - there is none to reproduce - and
       * asserts the surviving property directly: 1,500 minutes of real time, past a full day, must
       * read as 1,500 minutes.
       *
       * It still bites. Regress the provider to a minute-of-day clock and the mocked absolute reading
       * stops being consulted, elapsed collapses to zero, and the final assertion fails.
       */
      const startMinute = 600; // 10:00, the minute-of-day the demo anchors onto
      const mountAbsolute = 29_000_000; // an arbitrary absolute minute; only the difference matters
      const elapsedMinutes = 1_500; // past one full day (1,440)

      vi.mocked(wallClockNow).mockImplementation(() => startMinute);
      vi.mocked(absoluteWallClockMinutes).mockImplementation(() => mountAbsolute);

      render(
        <WardFlowProvider>
          <Probe />
        </WardFlowProvider>,
      );
      // The re-anchor: an unpinned provider mounting while the wall clock reads 10:00 shows 10:00,
      // not the fixture's authored 10:42.
      expect(screen.getByTestId("now")).toHaveTextContent(String(startMinute));

      vi.mocked(absoluteWallClockMinutes).mockImplementation(() => mountAbsolute + elapsedMinutes);
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(
        screen.getByTestId("now"),
        "elapsed time did not survive a span longer than a day. The provider must read an absolute " +
          "clock; a minute-of-day reading aliases every 24 hours and silently resets elapsed time to " +
          "zero, moving every deadline and wait on every screen backward by up to a day.",
      ).toHaveTextContent(String(startMinute + elapsedMinutes));
    });
  });
});
