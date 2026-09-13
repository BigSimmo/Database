import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as tests/ward-screen-refusal-surface.dom.test.tsx and
// tests/ward-screen.dom.test.tsx.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * `ward-screen.tsx`'s refusal alert (see `tests/ward-screen-refusal-surface.dom.test.tsx`) now
 * grows a reason control when, and only when, the engine's own refusal names
 * `OVERRIDE_REASON_REQUIRED` — a judgement gate a recorded reason can actually get past. A refusal
 * on a PHYSICAL fact (no specialling capacity, no allocatable bed) must show the alert and NO
 * control, because no reason buys anything there; offering one would be a false promise.
 *
 * Two real, measured movement/unit pairs drive every case, exactly as
 * `ward-screen-refusal-surface.dom.test.tsx` does — never a hand-authored fixture edit:
 *
 * - WF-319 into Albany Adult Open (`alb-adult-open`) fails ONLY `specialling`, a physical fact.
 * - WF-009 into Broome Adult Secure (`brm-adult-secure`) fails `["forensic", "specialling"]`;
 *   `forensic` is a judgement gate (`SUITABILITY_GATES`), so it is the one an override answers.
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

/**
 * ⚠️ THE REFERRAL ITSELF MUST CARRY THE OVERRIDE REASON, OR IT IS HELD BACK AND NOTHING RENDERS.
 * WF-009 into Broome Adult Secure fails `forensic`, a `SUITABILITY_GATES` member — so
 * `REFER_TO_UNITS` refuses this ward outright (per-ward hold-back, see the reducer's own comment on
 * that event) unless the referral itself is accompanied by a reason. This mirrors real coordinator
 * use: a coordinator referring into a forensic bed already knows it is a mismatch when they refer.
 */
function ReferWF009ToBrmAdultSecureWithReason() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "REFER_TO_UNITS",
          role: "coordinator",
          now,
          movementId: "WF-009",
          unitIds: ["brm-adult-secure"],
          overrideReason: "Clinical urgency outweighs the mismatch",
        })
      }
    >
      refer WF-009 to Broome Adult Secure, with a reason
    </button>
  );
}

describe("ward screen's override reason control", () => {
  it("shows nothing before any action — no refusal, no control", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF319ToAlbAdultOpen />
        <WardScreen unitId="alb-adult-open" />
      </WardFlowProvider>,
    );

    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(screen.queryByTestId("ward-override-form-WF-319")).not.toBeInTheDocument();
  });

  it("⚠️ THE MOST IMPORTANT CASE: a refusal no reason can answer shows the refusal and NO control", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF319ToAlbAdultOpen />
        <WardScreen unitId="alb-adult-open" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "refer WF-319 to Albany Adult Open" }));
    fireEvent.click(screen.getByTestId("ward-accept-WF-319"));

    // The accept succeeds (specialling is not a SUITABILITY_GATE, so it never blocks
    // ACCEPT_IN_PRINCIPLE) — same as ward-screen-refusal-surface.dom.test.tsx establishes.
    const acceptedRow = screen.getByTestId("ward-accepted-WF-319");
    const pullButton = within(acceptedRow).getByTestId("ward-pull-WF-319");
    expect(pullButton).not.toHaveAttribute("aria-disabled");

    fireEvent.click(pullButton);

    // The pull is refused on `specialling` alone — a physical fact — so the refusal alert must
    // show, but no reason can buy a way past it: the control must NOT appear.
    const alert = within(acceptedRow).getByRole("alert");
    expect(alert).toHaveTextContent(/Pull a bed not recorded/i);
    expect(alert).toHaveTextContent(/no one-to-one specialling capacity left/i);
    expect(screen.queryByTestId("ward-override-form-WF-319")).not.toBeInTheDocument();
  });

  it("a refusal a reason CAN answer shows the control, with all five reasons offered", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF009ToBrmAdultSecureWithReason />
        <WardScreen unitId="brm-adult-secure" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "refer WF-009 to Broome Adult Secure, with a reason" }));
    // The referral itself carried a reason, so the judgement gate (`forensic`) it would otherwise
    // fail is skipped for REFER_TO_UNITS — the ward genuinely holds a live referral.
    expect(screen.getByTestId("ward-incoming-WF-009")).toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);

    // The Accept button dispatches a FRESH ACCEPT_IN_PRINCIPLE with no reason of its own, so the
    // judgement gate is re-evaluated and refused — the referral's earlier reason does not carry
    // forward to a different event.
    fireEvent.click(screen.getByTestId("ward-accept-WF-009"));

    const incomingRow = screen.getByTestId("ward-incoming-WF-009");
    const alert = within(incomingRow).getByRole("alert");
    expect(alert).toHaveTextContent(/Accept in principle not recorded/i);
    expect(alert).toHaveTextContent(/forensic/i);

    const form = within(incomingRow).getByTestId("ward-override-form-WF-009");
    const radios = within(form).getAllByTestId("ward-override-option-WF-009");
    expect(radios).toHaveLength(OVERRIDE_REASONS.length);
    for (const reason of OVERRIDE_REASONS) {
      expect(within(form).getByRole("radio", { name: reason })).toBeInTheDocument();
    }
  });

  it("before a reason is chosen the submit is inert, and after choosing it is not", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF009ToBrmAdultSecureWithReason />
        <WardScreen unitId="brm-adult-secure" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "refer WF-009 to Broome Adult Secure, with a reason" }));
    fireEvent.click(screen.getByTestId("ward-accept-WF-009"));

    const form = screen.getByTestId("ward-override-form-WF-009");
    const submit = within(form).getByTestId("ward-override-submit-WF-009");
    expect(submit).toBeDisabled();

    fireEvent.click(within(form).getByRole("radio", { name: OVERRIDE_REASONS[1] }));
    expect(submit).not.toBeDisabled();
  });

  it("choosing a reason and submitting gets the movement through", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF009ToBrmAdultSecureWithReason />
        <WardScreen unitId="brm-adult-secure" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "refer WF-009 to Broome Adult Secure, with a reason" }));
    fireEvent.click(screen.getByTestId("ward-accept-WF-009"));

    const form = screen.getByTestId("ward-override-form-WF-009");
    fireEvent.click(within(form).getByRole("radio", { name: "Clinical urgency outweighs the mismatch" }));
    fireEvent.click(within(form).getByTestId("ward-override-submit-WF-009"));

    // The re-dispatched ACCEPT_IN_PRINCIPLE now carries the reason, so the judgement gate is
    // skipped and the movement actually moves — out of "incoming" and into "accepted".
    expect(screen.queryByTestId("ward-incoming-WF-009")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-accepted-WF-009")).toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });
});
