import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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
    expect(screen.getByTestId("units")).toHaveTextContent("22");
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
});
