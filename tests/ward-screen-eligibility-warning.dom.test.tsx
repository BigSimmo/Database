import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as tests/ward-screen.dom.test.tsx and
// tests/ward-restriction-notice.test.ts's sibling dom suites.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { eligibility } from "@/components/ward-management/ward-eligibility";

/**
 * The sub-finding in `docs/ward-flow/the-engine-enforces-nothing.md`: `REFER_TO_UNITS`,
 * `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` check nothing about cohort, security, sex or forensic
 * status, so a ward can accept — and pull — a movement `eligibility()` would refuse outright, and
 * see nothing on its own screen. This suite drives the exact pair the finding demonstrated: WF-009
 * (Adult, Secure, Male, specialling, involuntary/detained under a 3B form) into
 * `brm-adult-secure`, the network's forensic bed, through the same real reducer events
 * (`REFER_TO_UNITS` then `ACCEPT_IN_PRINCIPLE`) the finding used — never a hand-authored fixture.
 *
 * This warning is INFORMATION, never a gate — the invariant guarded here (`referralAnswerBlocked`/
 * `pullBlockedReason` in `ward-screen.tsx` mirror the reducer's own eligibility-free checks so the
 * accept/decline/pull buttons "can never advertise different verdicts about whether the reducer
 * would take the action") must hold exactly as before: the warning changes what the ward is told,
 * never what its buttons do.
 */
const WF_009 = movementById("WF-009")!;
const BRM_ADULT_SECURE = unitById("brm-adult-secure")!;
const WF_017 = movementById("WF-017")!;
const BTY_ADULT_SECURE = unitById("bty-adult-secure")!;

function ReferWF009ToBrmAdultSecure() {
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
          // ⚠️ REQUIRED SINCE THE ENGINE GATE LANDED. WF-009 fails `forensic` at this unit —
          // measured, `eligibility()` returns ["forensic", "specialling"] — and `forensic` is a
          // judgement the engine now refuses to refer on without a recorded reason. Without this
          // the referral never arrives, and every assertion below fails far from the cause.
          // A coordinator would have to record exactly this to reach this screen state.
          overrideReason: "Clinical urgency outweighs the mismatch",
        })
      }
    >
      refer WF-009 to Broome Adult Secure
    </button>
  );
}

describe("ward screen eligibility warning — fixture sanity", () => {
  it("WF-009 against brm-adult-secure fails more than one real eligibility gate, and has never declined that unit", () => {
    // Guards the whole suite below: if either fact stops being true, the DOM assertions further
    // down would either false-positive or silently stop covering the case they exist for.
    expect(WF_009.declines.some((decline) => decline.unitId === "brm-adult-secure")).toBe(false);
    const verdict = eligibility(WF_009, BRM_ADULT_SECURE, NOW_ANCHOR);
    const failedGateNames = verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.gate);
    expect(failedGateNames).toContain("forensic");
    expect(failedGateNames).toContain("specialling");
    expect(failedGateNames.length).toBeGreaterThanOrEqual(2);
  });

  it("WF-017 against bty-adult-secure — already a live referral at seed — passes every real eligibility gate", () => {
    expect(WF_017.referredUnitIds).toContain("bty-adult-secure");
    expect(eligibility(WF_017, BTY_ADULT_SECURE, NOW_ANCHOR).eligible).toBe(true);
  });
});

describe("ward screen eligibility warning — an ineligible movement", () => {
  it("shows no warning before the referral exists, then names every failing gate once it does", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF009ToBrmAdultSecure />
        <WardScreen unitId="brm-adult-secure" />
      </WardFlowProvider>,
    );

    // Before the referral: WF-009 does not yet hold a live referral at this unit.
    expect(screen.queryByTestId("ward-incoming-WF-009")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "refer WF-009 to Broome Adult Secure" }));

    const incoming = screen.getByTestId("ward-incoming-WF-009");
    expect(incoming).toBeInTheDocument();

    const warning = screen.getByTestId("ward-eligibility-warning-WF-009");
    expect(warning).toHaveAttribute("data-level", "ineligible");
    // Both failing gates' own, unaltered detail text — never just the first.
    expect(warning).toHaveTextContent(/forensic bed and is never offered as a destination/i);
    expect(warning).toHaveTextContent(/0 specialling slots available/i);

    // THE INVARIANT: the Accept button's own wiring is untouched by this warning. WF-009 was
    // referred to exactly this unit and sits at destination_review with no accepted destination
    // yet, so `referralAnswerBlocked` (which knows nothing about eligibility) leaves it enabled —
    // exactly as it would with the warning absent.
    const acceptButton = screen.getByTestId("ward-accept-WF-009");
    expect(acceptButton).not.toHaveAttribute("aria-disabled");
  });
});

describe("ward screen eligibility warning — the engine, not the warning, is what refuses", () => {
  /**
   * ⚠️ PINNED AS ITS OWN CASE RATHER THAN BENT INTO THE TEST ABOVE, on Ward Lead's ruling, and the
   * separation is the point. The test above asserts a SCREEN property: the warning is information,
   * and it does not touch the Accept button's own wiring. This one asserts an ENGINE property: the
   * accept is refused. Two different things refuse to happen here and only one of them is the
   * warning's doing — carrying both in one test would make it impossible to tell which broke.
   *
   * The owner's ruling on the original finding: keep the same patient and the same unsuitable
   * ward, and assert the placement is now refused unless a reason is recorded. That is this test.
   *
   * ⚠️ IT DELIBERATELY STOPS AT THE REFUSAL, and that is a scope split rather than a remaining gap
   * — as of the same merge that added this refusal, `ward-screen.tsx` now DOES grow an override
   * control once the refusal names `OVERRIDE_REASON_REQUIRED`, and the "with a reason recorded, the
   * placement proceeds" half of the owner's ruling is proved for this EXACT fixture pair (WF-009
   * into `brm-adult-secure`) in `tests/ward-override-control.dom.test.tsx`, which also proves the
   * property this file does not: a refusal on a PHYSICAL fact (no specialling capacity, no
   * allocatable bed) shows the refusal and renders no control at all, because no recorded reason
   * buys a way past a fact about the world. Re-asserting either half here, on this same fixture,
   * would duplicate that file rather than add coverage — this test's job stays exactly what its own
   * heading says: the engine refuses, not the warning.
   */
  it("refuses the ward's Accept on a judgement gate, and the button's own wiring is not what stopped it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF009ToBrmAdultSecure />
        <WardScreen unitId="brm-adult-secure" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "refer WF-009 to Broome Adult Secure" }));

    const acceptButton = screen.getByTestId("ward-accept-WF-009");
    // Not locally blocked: `referralAnswerBlocked` knows nothing about eligibility, so the click
    // genuinely reaches the reducer. A test where the button were disabled would prove nothing
    // about the engine at all.
    expect(acceptButton).not.toHaveAttribute("aria-disabled");

    fireEvent.click(acceptButton);

    // The movement does not move. Before the gate existed it moved into "accepted" here, which is
    // the whole defect this change closed.
    expect(screen.getByTestId("ward-incoming-WF-009")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-accepted-WF-009")).not.toBeInTheDocument();

    // And the ward is told, by the refusal surface rather than by the warning span.
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/forensic/i);
    expect(alert).toHaveTextContent(/needs a recorded override reason/i);
  });
});
