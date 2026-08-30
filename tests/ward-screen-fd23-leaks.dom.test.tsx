import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { withdrawalReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/**
 * `FD-23` ON THE ONE SURFACE MOST ABLE TO BREAK IT.
 *
 * A ward-facing screen may not reveal where else a patient has been referred. This page's inbox
 * reads `referredUnitIds` — a LIST of every ward addressed — so the field that answers "am I
 * addressed?" also carries "who else is?". Both leaks below were LIVE on the seeded fixture,
 * visible without dispatching anything, and confirmed on screen before they were fixed.
 *
 * ⚠️ NEITHER WAS CAUGHT BY ANYTHING, and the reason is the same in both cases: the forbidden thing
 * was a VALUE in a permitted place. No structural guard inspects the text inside a `<span>`, and no
 * field-presence check can see that a legal field carries an illegal string. So these assertions
 * read the rendered TEXT, which is the only level at which either defect exists.
 *
 * Both cases are pinned to seeded movements rather than constructed, deliberately: the point is
 * that the fixture a demonstration actually runs on contains them. A constructed case would prove
 * the render path and say nothing about what anybody would see.
 */
function findSeeded(predicate: (movement: (typeof wardMovements)[number]) => boolean, label: string) {
  const found = wardMovements.filter(predicate);
  // A canary on the fixture itself. If the seed changes so that no movement has this shape, the
  // assertions below would pass by having nothing to check — a green test measuring an empty set.
  expect(found.length, `the seed no longer contains ${label}, so the guard below proves nothing`).toBeGreaterThan(0);
  return found[0];
}

describe("FD-23 on the ward page", () => {
  it("never names a co-addressed ward, and never reveals that one exists", () => {
    /*
     * ⚠️ THIS TEST PINS TWO THINGS OF DIFFERENT STATUS AND SAYS SO, because a future session will
     * otherwise read a red here as one regression when it may be a decision landing.
     *
     * SETTLED — the owner's ruling, verbatim in `ward-referral-visibility.ts`: "a ward cannot see
     * where else a patient has been referred." The identity assertion below is that rule. It must
     * never be relaxed, and no ruling on the open question can reach it.
     *
     * ⚠️ ALSO SETTLED, by the owner on 2026-08-31 — whether a ward may know that co-addressees
     * EXIST, without knowing who. It was open for about an hour and this block said so. HE RULED
     * NOT TOLD. The arguments are kept below rather than deleted, because the losing side was
     * strong and a reader who rediscovers it would otherwise think nobody had weighed it. The removed
     * "Parallel referral" badge said exactly that and named nowhere, so the owner's sentence does
     * not decide it. Two live readings point opposite ways: a badge invites a ward to wait out the
     * competition (so four wards could each deprioritise the same patient), while the owner's own
     * stated reason — "so a ward does not spend its time on a patient who is being placed elsewhere"
     * — argues for telling it. The cost of hiding it is real in the window before anyone accepts,
     * when no cancellation has fired and no ward knows it is one of three.
     *
     * ⚠️ AND THE COST WAS ACCEPTED, NOT RETIRED. Twice it was argued that `withdrawnReferrals`
     * already pays for hiding this. It does not: `ACCEPT_IN_PRINCIPLE` is its only writer, so
     * nothing reaches a ward until somebody accepts, and the deliberation window is unprotected by
     * construction. The owner was given that trade explicitly and chose this side. Both assertions
     * below are now his ruling, and neither is a placeholder.
     */
    const parallel = findSeeded(
      (movement) => movement.stage === "destination_review" && movement.referredUnitIds.length > 1,
      "a movement in destination_review addressed to more than one ward",
    );
    const unitId = parallel.referredUnitIds[0];

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={unitId} />
      </WardFlowProvider>,
    );

    const card = screen.getByTestId(`ward-incoming-${parallel.id}`);

    // SETTLED. The co-addressed ward must not appear under any wording — this is the owner's rule
    // and it survives somebody reintroducing the disclosure under a different label.
    for (const otherUnitId of parallel.referredUnitIds.filter((id) => id !== unitId)) {
      expect(card, "a ward may not see WHERE else a patient was referred — the owner's ruling").not.toHaveTextContent(
        otherUnitId,
      );
    }

    // RULED, not provisional. Asserted on the CARD rather than the document, because the question
    // is what a charge nurse reads — a document-wide check would pass if the badge merely moved.
    expect(
      card,
      "the parallel-referral badge is back. The owner ruled on 2026-08-31 that a ward is not told a " +
        "patient is also referred elsewhere, not even the bare fact. This is a regression.",
    ).not.toHaveTextContent(/parallel/i);
  });

  it("never names the unit that accepted, when telling a ward its referral was withdrawn", () => {
    /*
     * THE LEAK THAT SAT INSIDE THE SAFEGUARD. `withdrawnReferrals` exists so a ward is told its
     * referral ended rather than watching `referredUnitIds` go quiet — and the reducer writes
     * `reason: "withdrawn — placed at <name>"`, the seed writes "Referral withdrawn once RGH Adult
     * Secure confirmed the bed", and the page rendered it raw. FSH Adult Secure was told RGH won.
     *
     * ⚠️ THE MODEL HAS SINCE CLOSED THIS AT SOURCE, AND THIS TEST TOLD ME SO BY GOING RED.
     * `reason` is now a `WithdrawalReason` union, so the fixture holds `another_unit_accepted` and
     * no ward name exists in it to leak. The old assertion — that no unit name survives into the
     * rendered text — could no longer fail from any input the model can produce, and the vacuity
     * canary beside it said exactly that: "the fixture's reasons no longer name anything, so this
     * guard is vacuous."
     *
     * That is the canary working, not a regression. A guard that cannot fail is worse than no
     * guard because it reports safety it is not checking — so it is REPLACED, never deleted and
     * never relaxed to keep it green.
     *
     * WHAT IS STILL THIS PAGE'S TO GET WRONG, now that prose cannot arrive from the model:
     * rendering the raw union member instead of its label. `another_unit_accepted` on a clinical
     * screen is not a privacy failure, it is an incomprehensible one — and it is exactly what a
     * careless "simplify" back to `{entry.reason}` produces.
     */
    const withdrawnFrom = findSeeded(
      (movement) => movement.withdrawnReferrals.length > 0,
      "a movement with a withdrawn referral",
    );
    const entry = withdrawnFrom.withdrawnReferrals[0];

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={entry.unitId} />
      </WardFlowProvider>,
    );

    const card = screen.getByTestId(`ward-withdrawn-${withdrawnFrom.id}`);
    const shown = within(card).getByTestId(`ward-withdrawn-reason-${withdrawnFrom.id}`).textContent ?? "";

    // The raw union member must never reach the screen — the "simplify it back to `{entry.reason}`"
    // regression, and now the only way this line can go wrong from here.
    expect(shown, "the withdrawal code is being rendered instead of its label").not.toBe(entry.reason);
    expect(shown).not.toMatch(/_/);

    // It must be the SHARED label, not a second copy of the same sentence written here. Two copies
    // that agree today are the thing that drifts, and drift is how the leak came back last time.
    expect(shown).toBe(withdrawalReasonLabels[entry.reason]);

    // And a unit name must still never appear, however the label is later worded. Ward Core guards
    // the label vocabulary at source; this asserts the same rule where a ward actually reads it,
    // because that is the only place the harm occurs.
    for (const unit of allUnits()) {
      expect(shown, `the withdrawal line names ${unit.name}`).not.toContain(unit.name);
    }

    // The ward is still told the thing it can act on, or the fix has traded a leak for silence.
    expect(shown).toMatch(/withdrawn/i);
    expect(shown).toMatch(/accepted/i);
  });
});
