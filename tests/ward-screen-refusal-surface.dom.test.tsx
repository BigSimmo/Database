import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as tests/ward-screen.dom.test.tsx and
// tests/ward-screen-eligibility-warning.dom.test.tsx.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * `ward-screen.tsx` dispatches `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` and, until this change,
 * never read `rejections` at all — a ward whose click the reducer refused saw nothing happen.
 * This suite drives BOTH dispatch sites to a genuine reducer refusal, through real events only
 * (never a hand-authored fixture edit), and checks the alert this task adds actually renders —
 * and, just as importantly, stays absent when nothing has been refused.
 */

function ReferWF319ToAlbAdultOpen() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "REFER_TO_UNITS",
          role: "coordinator",
          now,
          movementId: "WF-319",
          unitIds: ["alb-adult-open"],
        })
      }
    >
      refer WF-319 to Albany Adult Open
    </button>
  );
}

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

/**
 * Forces the ONLY real, reachable `ACCEPT_IN_PRINCIPLE` refusal this screen's own eligible-looking
 * button can produce: a second acceptance of a movement the first already won. `WardScreen`'s
 * `referralAnswerBlocked` is an exact mirror of every OTHER reducer precondition (see that
 * function's own doc comment), so the button is never rendered enabled for a refusal the reducer
 * would actually raise — except this one, which cannot be seen coming from a single render because
 * it depends on what a second, concurrent accept just did.
 *
 * The trigger dispatches an ordinary, winning `ACCEPT_IN_PRINCIPLE` for the same movement and unit
 * `WardScreen`'s own button is about to try, then clicks that real button SYNCHRONOUSLY, inside the
 * same event handler — never via a second `fireEvent` call, which would let React flush and remove
 * the button from the DOM (accepted, it moves out of "incoming") before the second click could ever
 * land. Because both dispatches happen inside one native click handler, React's automatic batching
 * queues them against the same `useReducer` in order: this one first (accepted), `WardScreen`'s own
 * second (refused, because the movement is already accepted) — so `WardScreen`'s own
 * `priorRejectionCountRef` capture (read synchronously, before ITS dispatch) is still the count
 * from before either action, and the growth its effect sees is correctly attributed to its own
 * click.
 */
function TriggerDoubleAccept({ movementId, unitId }: { movementId: string; unitId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="trigger-double-accept"
      onClick={() => {
        dispatch({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", now, movementId, unitId });
        (document.querySelector(`[data-testid="ward-accept-${movementId}"]`) as HTMLButtonElement | null)?.click();
      }}
    >
      trigger double accept
    </button>
  );
}

describe("ward screen surfaces a refused action to the ward user", () => {
  it("shows nothing before any action, and nothing after one that succeeds", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF319ToAlbAdultOpen />
        <WardScreen unitId="alb-adult-open" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "refer WF-319 to Albany Adult Open" }));
    expect(screen.getByTestId("ward-incoming-WF-319")).toBeInTheDocument();
    // Before any click on this screen's own accept/pull buttons: no refusal to show.
    expect(screen.queryAllByRole("alert")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("ward-accept-WF-319"));
    // The accept itself succeeds — the referral carried an override reason, so the same judgement
    // gate that held the referral back does not refuse the acceptance either. Still nothing.
    expect(screen.getByTestId("ward-accepted-WF-319")).toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("names the reason a pull was refused, on the row the pull button sits in", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF319ToAlbAdultOpen />
        <WardScreen unitId="alb-adult-open" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "refer WF-319 to Albany Adult Open" }));
    fireEvent.click(screen.getByTestId("ward-accept-WF-319"));

    const acceptedRow = screen.getByTestId("ward-accepted-WF-319");
    // ⚠️ THE PAIR CHANGED WHEN THE ENGINE GATE LANDED, AND WHY IT CHANGED IS THE POINT.
    // This was WF-009 into Broome Adult Secure. Measured, that pair fails TWO gates —
    // ["forensic", "specialling"] — and `forensic` is a judgement the engine now refuses without a
    // recorded reason. So the referral never arrived and the accept never succeeded: the fixture
    // had been resting on the hole this gate closed, which is the strongest evidence the gate does
    // something on real seed data rather than only on a test built to show it.
    //
    // WF-319 into Albany Adult Open was chosen by searching every movement/unit pair for one that
    // fails ONLY `specialling` — a physical fact, refused whatever reason is recorded — while
    // passing every judgement gate. So the accept genuinely succeeds, the pull genuinely refuses,
    // and neither outcome depends on an override. `allocatable` is 1, so the pull button is not
    // locally blocked and the click reaches the reducer for real.
    const pullButton = within(acceptedRow).getByTestId("ward-pull-WF-319");
    expect(pullButton).not.toHaveAttribute("aria-disabled");

    fireEvent.click(pullButton);

    // The movement stays right where it was — a refused pull is not a state transition — so the
    // alert renders on the SAME row, next to the SAME button the ward just pressed.
    const alert = within(screen.getByTestId("ward-accepted-WF-319")).getByRole("alert");
    expect(alert).toHaveTextContent(/Pull a bed not recorded/i);
    expect(alert).toHaveTextContent(/no one-to-one specialling capacity left/i);
  });

  it("names the reason a second accept was refused, on the row it now occupies", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF301ToRphAdultSecure />
        <TriggerDoubleAccept movementId="WF-301" unitId="rph-adult-secure" />
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "refer WF-301 to RPH Adult Secure" }));
    expect(screen.getByTestId("ward-incoming-WF-301")).toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("trigger-double-accept"));

    // The winning accept moved WF-301 out of "incoming" and into "accepted" — the SAME place the
    // refused SECOND accept (WardScreen's own click, refused as already-accepted) has to show up,
    // because that is where the row lives now.
    expect(screen.queryByTestId("ward-incoming-WF-301")).not.toBeInTheDocument();
    const acceptedRow = screen.getByTestId("ward-accepted-WF-301");
    expect(acceptedRow).toBeInTheDocument();

    const alert = within(acceptedRow).getByRole("alert");
    expect(alert).toHaveTextContent(/Accept in principle not recorded/i);
    expect(alert).toHaveTextContent(/already accepted/i);
  });
});
