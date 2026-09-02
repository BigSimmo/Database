import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ⚠️ THE REFER CONTROL, FOR A WARD THAT ONLY DECLINED BEFORE — the half of `4e07bf520` that was
 * wrong, and that its own author's browser check walked straight past.
 *
 * The owner ruled that re-approaching a ward which declined earlier needs NO WRITTEN REASON. The
 * reducer already agreed: `prior_decline` is absent from `SUITABILITY_GATES`, and a probe confirmed
 * `REFER_TO_UNITS` into a previously-declining ward with no `overrideReason` produces 0 rejections
 * and records 0 overrides. THE ENGINE ASKS FOR NOTHING.
 *
 * The screen asked for something. `canRefer` read `verdict.eligible`, which is false for such a
 * ward because the gate genuinely fails, so Refer was inert and said:
 *
 *     "Not eligible — Already declined this movement. Use Override instead."
 *
 * ⚠️ BOTH HALVES FALSE, and the second half is the owner's ruling INVERTED: it instructs a
 * clinician to record a reason the system never wanted, in a patient's file.
 *
 * ⚠️ WHY NO EXISTING TEST CAUGHT IT, WHICH IS THE TRANSFERABLE PART. `4e07bf520` fixed the
 * candidates LIST and left the Refer BUTTON reading a different fact — the falsehood was MOVED, not
 * removed. A browser check then passed, because it searched for the sentence that had been deleted
 * and that sentence was genuinely gone. Confirming the old wording is absent is not confirming the
 * screen is right. Found by an adversarial reviewer that measured the rendered control instead.
 */
const DECLINED_ROW = "Already declined this movement";
const OVERRIDE_SENTENCE = "Use Override instead";
const MOVEMENT_ID = "WF-009";

function Harness({ movementId }: { movementId: string }) {
  const { movements, units, bedReleases, referrals, now, dispatch } = useWardFlow();
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  return (
    <ShortlistPanel
      movement={movements.find((candidate) => candidate.id === movementId)}
      now={now}
      units={units}
      bedReleases={bedReleases}
      referrals={referrals}
      selectedUnitId={selectedUnitId}
      onSelectUnit={setSelectedUnitId}
      dispatch={dispatch}
    />
  );
}

function renderPanel(movementId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness movementId={movementId} />
    </WardFlowProvider>,
  );
}

/**
 * Picks a candidate row by what the COORDINATOR READS on it, never by an id this test invents or a
 * verdict it recomputes — a recomputed verdict can agree with the code while both are wrong.
 */
function candidateRowWhere(predicate: (text: string) => boolean, describe: string): HTMLElement {
  const rows = screen.getAllByTestId(/^ward-shortlist-candidate-/);
  expect(rows.length, `${MOVEMENT_ID} offers no candidates at all, so nothing below is exercised`).toBeGreaterThan(0);
  const found = rows.find((row) => predicate(row.textContent ?? ""));
  expect(
    found,
    `no candidate row for ${MOVEMENT_ID} is ${describe} — the fixture no longer contains the case ` +
      `this test exists for, so every assertion below would hold over nothing`,
  ).toBeDefined();
  return found as HTMLElement;
}

describe("the Refer control for a ward that only declined before", () => {
  it("is usable, and never tells the coordinator to record a reason the engine does not want", () => {
    renderPanel(MOVEMENT_ID);
    const declined = candidateRowWhere(
      (text) => text.includes(DECLINED_ROW) && !text.includes("Eligible now"),
      `showing "${DECLINED_ROW}" while not being plainly eligible`,
    );

    fireEvent.click(declined);
    const refer = screen.getByTestId("ward-shortlist-refer");

    expect(
      refer.getAttribute("aria-disabled"),
      "Refer is inert for a ward that only declined before, so the one path the owner ruled needs " +
        "nothing recorded is the one path the screen closes",
    ).toBeNull();

    // ⚠️ The sentence, not the attribute. A control can be enabled and still carry the old copy.
    expect(
      document.body.textContent?.includes(OVERRIDE_SENTENCE),
      `the screen still says "${OVERRIDE_SENTENCE}" about a ward needing no reason — the owner's ` +
        "ruling inverted, instructing a clinician to record something the reducer never asked for",
    ).toBe(false);
  });

  /**
   * ⚠️ THE CONTROL, AND WITHOUT IT THE TEST ABOVE IS SATISFIED BY DELETING THE MESSAGE ENTIRELY.
   *
   * A ward failing a JUDGEMENT gate must still be refused by Refer and must still be sent to
   * Override, because there a reason genuinely buys something. If this goes green while the case
   * above is green, the fix removed a false sentence. If BOTH go green only because the sentence
   * no longer exists anywhere, this one fails — which is the point.
   */
  it("still refuses, and still names Override, for a ward a recorded reason could actually place", () => {
    renderPanel(MOVEMENT_ID);
    const overridable = candidateRowWhere(
      (text) => !text.includes(DECLINED_ROW) && !text.includes("Eligible now"),
      "a non-declined ward that is also not plainly eligible (an overridable one)",
    );

    fireEvent.click(overridable);
    const refer = screen.getByTestId("ward-shortlist-refer");

    expect(
      refer.getAttribute("aria-disabled"),
      "Refer now advertises an action the reducer will refuse — a coordinator taps it and the " +
        "referral is silently held back",
    ).toBe("true");
    expect(
      document.body.textContent?.includes(OVERRIDE_SENTENCE),
      "the coordinator is told the ward is unavailable and never told that a recorded reason is " +
        "the route that works, so the override path becomes undiscoverable",
    ).toBe(true);
  });
});
