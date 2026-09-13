import { fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WITHDRAWING A REFERRAL — and, more importantly, NOT OFFERING IT WHERE THE REDUCER WOULD REFUSE.
 *
 * ⚠️ **The control's availability is the thing under test, not the withdrawal.** `WITHDRAW_REFERRAL`
 * refuses three states — a closed movement, one already accepted, and one holding no live referral —
 * and a button that offers an action the reducer will bounce teaches a clinician that this screen's
 * controls are decorative. That is the single lesson a prototype must never teach, so each refusal
 * is asserted as an UNAVAILABLE CONTROL rather than as a rejected event.
 *
 * The middle refusal is a clinical distinction rather than a technical one: a ward holding a bed has
 * already acted, and releasing that bed is the ward's own decline. If this test ever passes because
 * the control disappeared entirely, that is not the same thing — `aria-disabled` keeps the control
 * reachable so the REASON can be read, which is why every assertion below checks the attribute and
 * the accompanying reason rather than absence from the DOM.
 */

const ED_ID = "fsh-ed";

const seenRef: { current: Movement[] } = { current: [] };

function MovementProbe() {
  const movements = useWardFlow().movements;
  useLayoutEffect(() => {
    seenRef.current = movements;
  });
  return null;
}

function renderEd() {
  seenRef.current = [];
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={ED_ID} />
      <MovementProbe />
    </WardFlowProvider>,
  );
}

/** Movements this department is holding open, which is exactly what the patients section lists. */
function openHere(): Movement[] {
  return seenRef.current.filter(
    (movement) => movement.originEdId === ED_ID && !movement.closure && movement.stage !== "arrived",
  );
}

function toggleFor(movementId: string): HTMLElement {
  return screen.getByTestId(`ward-ed-withdraw-referral-toggle-${movementId}`);
}

describe("withdrawing a referral from the emergency department", () => {
  it("offers the control only where the reducer would accept it", () => {
    renderEd();
    const movements = openHere();
    expect(movements.length).toBeGreaterThan(0);

    // Every open movement carries the control. Availability is what varies, never presence — an
    // absent control cannot explain itself, and the reason is the point.
    for (const movement of movements) {
      const toggle = toggleFor(movement.id);
      const withdrawable = movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0;
      expect(toggle.getAttribute("aria-disabled")).toBe(withdrawable ? null : "true");
      if (!withdrawable) {
        // The reason must be readable, not merely implied by the control being inert.
        expect(toggle.getAttribute("title")).toBeTruthy();
        expect(screen.getByText(String(toggle.getAttribute("title")))).toBeTruthy();
      }
    }
  });

  it("names the accepted case as the ward's decline rather than the referrer's withdrawal", () => {
    renderEd();
    const accepted = openHere().find((movement) => movement.acceptedUnitId !== undefined);
    expect(accepted, "the fixture must carry an accepted movement or this asserts nothing").toBeTruthy();
    const title = toggleFor(accepted!.id).getAttribute("title") ?? "";
    expect(title).toContain("has pulled a bed");
    expect(title).toContain("ward's own decline");
  });

  it("withdraws every live referral and closes the movement", () => {
    renderEd();
    const target = openHere().find(
      (movement) => movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0,
    );
    expect(target, "the fixture must carry a withdrawable movement or this asserts nothing").toBeTruthy();
    const id = target!.id;

    fireEvent.click(toggleFor(id));
    fireEvent.click(screen.getByTestId(`ward-ed-withdraw-referral-confirm-${id}`));

    const after = seenRef.current.find((movement) => movement.id === id);
    expect(after?.referredUnitIds).toEqual([]);
    expect(after?.closure?.outcome).toBe("did_not_proceed");
    // The vocabulary is the owner's, never the caller's — the event carries no reason field.
    expect(after?.withdrawnReferrals.every((entry) => entry.reason === "referrer_withdrew")).toBe(true);
    // Gone from the department's list, which is what a clinician actually sees.
    expect(screen.queryByTestId(`ward-ed-patient-${id}`)).toBeNull();
  });

  it("keeps the referral when the second step is declined", () => {
    renderEd();
    const target = openHere().find(
      (movement) => movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0,
    );
    const id = target!.id;
    const before = [...target!.referredUnitIds];

    fireEvent.click(toggleFor(id));
    fireEvent.click(screen.getByTestId(`ward-ed-withdraw-referral-cancel-${id}`));

    expect(seenRef.current.find((movement) => movement.id === id)?.referredUnitIds).toEqual(before);
    expect(screen.queryByTestId(`ward-ed-withdraw-referral-${id}`)).toBeNull();
    expect(screen.getByTestId(`ward-ed-patient-${id}`)).toBeTruthy();
  });
});
