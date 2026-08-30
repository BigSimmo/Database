import { describe, expect, it } from "vitest";

import { EVENT_ROLE, WARD_FLOW_ROLE_LABELS } from "../src/components/ward-management/ward-flow-events";

/**
 * WHO MAY DO WHAT, written out by hand and compared for exact equality.
 *
 * WHY THIS EXISTS, and it is not a hypothetical. On 2026-08-30 three permissions were widened —
 * `RAISE_REFERRAL` from `["ed"]`, and `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` from `["coordinator"]` —
 * and the entire ward suite stayed green. Nothing pinned the table. Every test that touches roles
 * reads `EVENT_ROLE[type][0]` FROM THE SOURCE, so both sides of every such assertion came from the
 * same place and no change to a permission could ever fail one.
 *
 * That is a permissions table with no guard, which is worse than an unguarded ordinary constant:
 * widening one is invisible in a diff review that is looking at the feature, and the widening
 * carried a real defect with it — the reducer went on recording every referral decision as the
 * coordinator's after a ward could make one.
 *
 * SO THIS LIST IS HAND-WRITTEN AND MUST STAY HAND-WRITTEN. Deriving it from `EVENT_ROLE` would
 * reproduce exactly the hole it closes. Updating it is the deliberate act; if a permission change
 * is right, change both and say which ruling permitted it.
 */
describe("who may raise which event", () => {
  const PERMISSIONS: Record<string, string[]> = {
    ACCEPT_IN_PRINCIPLE: ["ward"],
    ACCEPT_REFERRAL: ["ward", "coordinator"],
    ADD_PATIENT: ["ed", "community", "coordinator"],
    ADVANCE_CLOCK: ["demo"],
    BLOCK_BED_RELEASE: ["ward"],
    CANCEL_TRANSPORT: ["coordinator", "ward"],
    CHANGE_LEGAL_STATUS: ["coordinator", "ed"],
    CHANGE_URGENCY: ["coordinator", "ed"],
    CLEAR_BED_RELEASE_BLOCK: ["ward"],
    CONFIRM_BED_RELEASE: ["ward"],
    CONFIRM_CAPACITY: ["ward"],
    DECLINE: ["ward"],
    DECLINE_REFERRAL: ["ward", "coordinator"],
    END_LEAVE_BED: ["ward"],
    FLAG_BED_RELEASE: ["ward"],
    HANDOVER_READY: ["ed"],
    HOLD_BED: ["ward"],
    PATIENT_ARRIVED: ["officer"],
    PATIENT_COLLECTED: ["officer"],
    RAISE_REFERRAL: ["ed", "community", "ward"],
    RECEIVE_REFERRAL: ["community"],
    RECORD_ESCALATION: ["coordinator"],
    RECORD_EXAMINATION: ["ed"],
    RECORD_LEAVE_BED: ["ward"],
    RECORD_LOCAL_BED_SOUGHT: ["coordinator"],
    REFER_TO_UNITS: ["coordinator"],
    RELEASE_BED: ["ward"],
    RELEASE_HOLD: ["coordinator", "ward"],
    REQUEST_CAPACITY_REFRESH: ["coordinator"],
    RESET_SCENARIO: ["demo"],
    REVERT_BED_RELEASE: ["ward"],
    SET_BED_PREPARATION: ["ward"],
    SET_SCENARIO: ["demo"],
    TRANSPORT_ACCEPTED: ["officer"],
    TRANSPORT_EN_ROUTE: ["officer"],
  };

  it("covers every event that exists, so a new event cannot arrive unpermissioned", () => {
    expect(Object.keys(EVENT_ROLE).sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  it("grants exactly these roles and no others", () => {
    for (const [event, roles] of Object.entries(PERMISSIONS)) {
      expect(
        [...EVENT_ROLE[event as keyof typeof EVENT_ROLE]],
        `${event}'s permitted roles changed. A permission is never widened by accident: name the ` +
          "ruling that permitted it, check what the reducer writes for the newly-permitted role, " +
          "and update this list deliberately.",
      ).toEqual(roles);
    }
  });

  it("gives every role a decision label, so a decision can never be recorded against a blank", () => {
    const roles = new Set(Object.values(PERMISSIONS).flat());
    expect(roles.size).toBeGreaterThan(1);
    for (const role of roles) {
      expect(WARD_FLOW_ROLE_LABELS[role as keyof typeof WARD_FLOW_ROLE_LABELS], `${role} has no label`).toBeTruthy();
    }
  });

  it("keeps the table discriminating — not every event permits every role", () => {
    // A table that granted everything to everyone would satisfy the assertions above just as well.
    const allRoles = new Set(Object.values(PERMISSIONS).flat());
    const singleRoleEvents = Object.values(PERMISSIONS).filter((roles) => roles.length === 1);
    expect(singleRoleEvents.length).toBeGreaterThan(0);
    expect(allRoles.size).toBeGreaterThan(2);
  });
});
