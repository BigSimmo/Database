import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import type { MovementId } from "@/components/ward-management/ward-model";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ⚠️ THE CONTROLS ACTUALLY DO SOMETHING — which is the assertion the reducer tests cannot make.
 *
 * `tests/ward-urgent-flag.test.ts` and `tests/ward-movement-blocker.test.ts` prove the events work.
 * Neither can prove a SCREEN raises one, and that gap is exactly the shape of the defect being
 * repaired here: `Movement.flaggedUrgent` had a working ordering rule, a working badge, and no
 * control anywhere in the application. A reducer test would have been green throughout.
 *
 * This file therefore drives the real buttons on the real workspace, through a real provider, and
 * reads the result off the rendered page rather than out of state — so a control wired to local
 * `useState` instead of a dispatch fails here even though it would look right on screen.
 */
const WF_001 = movementById("WF-001");

function renderWorkspace(movementId: MovementId) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardPatientWorkspace movementId={movementId} />
    </WardFlowProvider>,
  );
}

describe("the movement workspace's urgent-flag control", () => {
  it("fixture assumption: WF-001 is open and unflagged", () => {
    expect(WF_001?.closure).toBeUndefined();
    expect(WF_001?.flaggedUrgent).toBe(false);
  });

  it("flags, says so in words, and offers the way back", () => {
    renderWorkspace("WF-001");
    const panel = screen.getByTestId("ward-patient-urgent-flag");

    // Before: the state is stated, not left to the button's label.
    expect(within(panel).getByText(/not flagged/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-console-urgent-flag-toggle"));

    // After: the page has re-rendered FROM THE RECORD. A control holding its own boolean would
    // also flip the label here — what it could not do is survive the round trip through the
    // reducer, which is what the queue-ordering sentence below depends on.
    expect(within(panel).getByText(/leads the queue ahead of every urgency tier/i)).toBeInTheDocument();
    expect(screen.getByTestId("ward-console-urgent-flag-toggle")).toHaveTextContent(/remove the urgent flag/i);

    // And back down again. A flag that could be set but not cleared would be a new permanent state.
    fireEvent.click(screen.getByTestId("ward-console-urgent-flag-toggle"));
    expect(within(panel).getByText(/not flagged/i)).toBeInTheDocument();
  });
});

describe("the movement workspace's blocker control", () => {
  it("fixture assumption: WF-001 carries the fixture's own opening blocker", () => {
    expect(WF_001?.blocker).toBe("Confirming destination options");
  });

  it("records what a person typed, verbatim, and shows it back from the record", () => {
    renderWorkspace("WF-001");
    const panel = screen.getByTestId("ward-patient-blocker");
    expect(within(panel).getByText("Confirming destination options")).toBeInTheDocument();

    const input = screen.getByTestId("ward-console-blocker-input");
    // One of the five values the owner's ruling turns on — free prose naming a party the model has
    // no field for. Typed through the real control rather than dispatched directly.
    fireEvent.change(input, { target: { value: "Awaiting specialling roster confirmation" } });
    fireEvent.submit(input.closest("form")!);

    expect(within(panel).getByText("Awaiting specialling roster confirmation")).toBeInTheDocument();
  });

  it("offers a Clear control, so nobody has to guess the magic words", () => {
    // ⚠️ The screen half of the repair. `hasActiveBlocker` recognises "nothing is blocking" by exact
    // match against a closed set, so a person TYPING "none — resolved" left the movement scoring ten
    // points as obstructed. This is the control that means they never have to.
    renderWorkspace("WF-001");
    const panel = screen.getByTestId("ward-patient-blocker");
    expect(within(panel).getByText("Confirming destination options")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-console-blocker-clear"));

    expect(within(panel).getByText("None — cleared")).toBeInTheDocument();
    // And it goes away once there is nothing left to clear — the reducer refuses a second clear,
    // and a control that will be refused teaches a clinician to distrust the controls.
    expect(screen.queryByTestId("ward-console-blocker-clear")).toBeNull();
  });

  it("cannot submit a blank, so an empty blocker never reaches the reducer", () => {
    renderWorkspace("WF-001");
    // Native `disabled` here is transient inertness — a form action awaiting validity — which is
    // what `docs/wiring-conventions.md` keeps `disabled` for. It is NOT an unavailable feature, so
    // `aria-disabled` would be the wrong pattern and the two together fail lint.
    const submit = screen.getByRole("button", { name: /record it/i });
    expect(submit).toBeDisabled();
    expect(submit).not.toHaveAttribute("aria-disabled");

    fireEvent.change(screen.getByTestId("ward-console-blocker-input"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: /record it/i })).toBeDisabled();
  });
});
