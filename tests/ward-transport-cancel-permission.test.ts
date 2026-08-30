import { describe, expect, it } from "vitest";

import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * WHO MAY CANCEL A TRANSPORT — `TR-D6`, owner, 2026-08-30, verbatim from the register:
 *
 *   *"A TRANSPORT MAY BE CANCELLED BY THE TEAM THAT BOOKED IT AND BY THE COORDINATOR. The sending
 *   team owns the job (`TR-D5`), so it may undo it; the coordinator is the only role that sees the
 *   whole picture and is therefore the only one positioned to notice a booking that has become
 *   wrong.* ⚠️ *The receiving ward may NOT cancel — it did not book it, and a booking cancelled by
 *   the destination is indistinguishable on the sending board from one that failed."*
 *
 * ⚠️ **THE CODE IMPLEMENTED THE EXACT INVERSE, AND IT LOOKED ENTIRELY REASONABLE.** The reducer
 * permitted a `ward` caller only when its stated unit MATCHED `movement.acceptedUnitId` — that is,
 * only the receiving ward, the one role the ruling excludes — and rejected every other ward. It
 * carried a careful comment about claim-not-proof discipline while doing it. Nothing was sloppy;
 * the rule was simply backwards, and "a ward may act on its own patient" is such a natural
 * sentence that it reads as correct in review.
 *
 * ⚠️ **AND THE HARM IS NOT ABSTRACT, WHICH IS WHY THE OWNER GAVE A REASON RATHER THAN A RULE.** A
 * cancellation by the destination looks, from the sending department, exactly like a booking that
 * failed. The sending team cannot tell "they changed their mind" from "it never went through", so
 * it re-books — or does not, and waits for a vehicle nobody is sending.
 *
 * The sending team is an emergency department: `Movement.originEdId` is required, so every
 * movement in this model originates at one. Hence `["coordinator", "ed"]`.
 */
const NOW = NOW_ANCHOR;
const ACCEPTING_UNIT = "fre-adult-open";

/**
 * ⚠️ HOW A CANCELLATION IS RECORDED, because my first draft of this file asserted the wrong thing
 * and the coordinator case failed while being permitted.
 *
 * `CANCEL_TRANSPORT` does NOT set `transport.cancelledAt`. It unwinds exactly one reservation —
 * appending a `transport_cancelled` entry to `movement.unwinds` with the role and the reason — and
 * immediately issues a REPLACEMENT job, because the movement still needs transporting. That is the
 * `UnwindRecord` contract working as designed: the movement survives, keeps its acceptance, and the
 * cancelled job stays named in the audit trail.
 *
 * `cancelledAt` is set by a different event entirely — an examination whose outcome closes the
 * movement — where the transport is cancelled as a CONSEQUENCE rather than as an act. Six screens
 * render "Cancelled" from that flag, and none of them is describing this event.
 *
 * So the observable here is the unwind record, never the flag.
 */

/** A movement carried to a booked transport job by the real event path, not hand-assembled. */
function withBookedTransport(): { state: WardFlowState; movementId: string } {
  const movementId = "WF-001";
  const events = [
    { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [ACCEPTING_UNIT] },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: ACCEPTING_UNIT },
    { type: "HOLD_BED", role: "ward", unitId: ACCEPTING_UNIT },
    { type: "HANDOVER_READY", role: "ed" },
    { type: "TRANSPORT_ACCEPTED", role: "officer" },
  ] as const;

  let state = seedWardFlowState();
  for (const event of events) {
    state = wardFlowReducer(state, { ...event, now: NOW, movementId } as never);
  }
  return { state, movementId };
}

function cancel(state: WardFlowState, movementId: string, role: string, actingUnitId?: string) {
  return wardFlowReducer(state, {
    type: "CANCEL_TRANSPORT",
    role,
    now: NOW,
    movementId,
    reason: "destination_changed",
    ...(actingUnitId === undefined ? {} : { actingUnitId }),
  } as never);
}

function unwinds(state: WardFlowState, movementId: string) {
  const movement = state.movements.find((candidate) => candidate.id === movementId);
  return (movement?.unwinds ?? []).filter((entry) => entry.kind === "transport_cancelled");
}

describe("who may cancel a transport", () => {
  const { state, movementId } = withBookedTransport();
  const movement = state.movements.find((candidate) => candidate.id === movementId);

  it("reaches a real booked transport job, or every assertion below is vacuous", () => {
    // ⚠️ The canary. A walk that was rejected leaves no transport job, and then EVERY cancel below
    // is refused for "no transport job to cancel" — which would look exactly like a permission
    // rule working perfectly while testing nothing at all.
    expect(state.rejections, "the setup walk must be accepted in full").toEqual([]);
    expect(movement?.transport, "there must be a transport job to cancel").toBeDefined();
    expect(movement?.transport?.cancelledAt).toBeUndefined();
    expect(
      movement?.acceptedUnitId,
      "the movement must be accepted somewhere, or 'the receiving ward' names nobody",
    ).toBe(ACCEPTING_UNIT);
  });

  it("lets the COORDINATOR cancel — the only role that sees the whole picture", () => {
    const after = cancel(state, movementId, "coordinator");
    expect(after.rejections).toEqual([]);
    expect(unwinds(after, movementId)).toHaveLength(1);
    expect(unwinds(after, movementId)[0]).toMatchObject({ by: "coordinator", reason: "destination_changed" });
  });

  it("lets the SENDING EMERGENCY DEPARTMENT cancel — it booked the job, so it may undo it", () => {
    const after = cancel(state, movementId, "ed");
    expect(after.rejections).toEqual([]);
    expect(unwinds(after, movementId)).toHaveLength(1);
    expect(unwinds(after, movementId)[0]).toMatchObject({ by: "ed", reason: "destination_changed" });
  });

  it("⚠️ REFUSES THE RECEIVING WARD, which is the whole of TR-D6", () => {
    const after = cancel(state, movementId, "ward", ACCEPTING_UNIT);
    expect(
      after.rejections.length,
      "the receiving ward cancelled a transport it did not book. From the sending department that " +
        "is indistinguishable from a booking that failed, so they cannot tell 'they changed their " +
        "mind' from 'it never went through' — they re-book, or wait for a vehicle nobody is " +
        "sending. TR-D6 excludes this role by name.",
    ).toBe(1);
    expect(
      unwinds(after, movementId),
      "the job must be untouched, not merely reported as refused",
    ).toEqual([]);
  });

  it("refuses ANY ward, not only the receiving one — a ward is never the booking team here", () => {
    // Stated separately because "refuses the accepted unit" is satisfied by a rule that permits
    // every OTHER ward, which is precisely the inverted rule this file replaced.
    const after = cancel(state, movementId, "ward", "rph-adult-secure");
    expect(after.rejections.length).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });

  it("names exactly the two permitted roles in the permission table", () => {
    expect([...EVENT_ROLE.CANCEL_TRANSPORT].sort()).toEqual(["coordinator", "ed"]);
    expect(
      EVENT_ROLE.CANCEL_TRANSPORT,
      "`ward` back in this list is TR-D6 reversed, whatever the reducer does underneath",
    ).not.toContain("ward");
  });

  it("still REQUIRES a reason — TR-D6 says that must not be weakened to optional", () => {
    const after = wardFlowReducer(state, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW,
      movementId,
    } as never);
    expect(after.rejections.length).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });
});
