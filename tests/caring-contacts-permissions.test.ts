// tests/caring-contacts-permissions.test.ts
import { describe, expect, it } from "vitest";

import { actorId, teamId } from "@/lib/caring-contacts/ids";
import {
  ALL_ACTIONS,
  ROLE_ACTIONS,
  UNGRANTED_ACTIONS,
  canApproveOwnAuthoredVersion,
  canPerformCaringContactAction,
  type Actor,
  type CaringContactAction,
  type CaringContactRole,
  type Resource,
} from "@/lib/caring-contacts/permissions";

const TEAM_A = teamId("TEAM-A");
const TEAM_B = teamId("TEAM-B");
const ROLES: readonly CaringContactRole[] = ["coordinator", "teamLead", "auditor"];

const resourceIn = (team = TEAM_A): Resource => ({ teamId: team });

const actorWith = (roles: readonly CaringContactRole[], team = TEAM_A): Actor => ({
  id: actorId("ACTOR-1"),
  teamId: team,
  roles,
});

// ---------------------------------------------------------------------------
// Rule 1 — deny by default
// ---------------------------------------------------------------------------

describe("rule 1: deny by default", () => {
  it("denies an action not granted to any of the actor's roles", () => {
    const coordinator = actorWith(["coordinator"]);
    const decision = canPerformCaringContactAction(coordinator, "approveServiceRestart", resourceIn());
    expect(decision).toEqual({ allowed: false, reason: "action-not-granted" });
  });

  it("denies when the actor holds several roles but none is granted the action", () => {
    const actor = actorWith(["coordinator", "auditor"]);
    const decision = canPerformCaringContactAction(actor, "approvePathwayVersion", resourceIn());
    expect(decision).toEqual({ allowed: false, reason: "action-not-granted" });
  });
});

// ---------------------------------------------------------------------------
// Rule 2 — team scope is checked before the role grant
// ---------------------------------------------------------------------------

describe("rule 2: team scope precedes the role grant", () => {
  it("denies with cross-team-denied when the resource belongs to another team", () => {
    const teamLead = actorWith(["teamLead"], TEAM_A);
    const decision = canPerformCaringContactAction(teamLead, "changeContactDate", resourceIn(TEAM_B));
    expect(decision).toEqual({ allowed: false, reason: "cross-team-denied" });
  });

  it("returns cross-team-denied rather than action-not-granted, so a cross-team actor never learns which actions exist", () => {
    const auditor = actorWith(["auditor"], TEAM_A);
    const decision = canPerformCaringContactAction(auditor, "reassignPlan", resourceIn(TEAM_B));
    expect(decision).toEqual({ allowed: false, reason: "cross-team-denied" });
  });

  it("allows a same-team actor holding the right role", () => {
    const teamLead = actorWith(["teamLead"], TEAM_A);
    const decision = canPerformCaringContactAction(teamLead, "reassignPlan", resourceIn(TEAM_A));
    expect(decision).toEqual({ allowed: true });
  });
});

// ---------------------------------------------------------------------------
// Rule 3 — auditor may only viewAccessTrail
// ---------------------------------------------------------------------------

describe("rule 3: auditor is confined to viewAccessTrail", () => {
  const auditor = actorWith(["auditor"]);

  it("allows viewAccessTrail", () => {
    expect(canPerformCaringContactAction(auditor, "viewAccessTrail", resourceIn())).toEqual({ allowed: true });
  });

  it("denies viewing a referral", () => {
    expect(canPerformCaringContactAction(auditor, "viewReferral", resourceIn())).toEqual({
      allowed: false,
      reason: "action-not-granted",
    });
  });

  it("denies every mutating action", () => {
    const mutations: readonly CaringContactAction[] = [
      "acceptReferral",
      "claimPlan",
      "activatePlan",
      "pausePlan",
      "resumePlan",
      "withdrawPlan",
      "reassignPlan",
      "moveContactWithinDay",
      "changeContactDate",
      "authorPathwayVersion",
      "approvePathwayVersion",
      "approveServiceRestart",
    ];
    for (const action of mutations) {
      expect(canPerformCaringContactAction(auditor, action, resourceIn())).toEqual({
        allowed: false,
        reason: "action-not-granted",
      });
    }
  });

  it("denies generating a clinical record summary", () => {
    expect(canPerformCaringContactAction(auditor, "generateClinicalRecordSummary", resourceIn())).toEqual({
      allowed: false,
      reason: "action-not-granted",
    });
  });

  it("contrast: a coordinator (not an auditor) may generate a clinical record summary", () => {
    const coordinator = actorWith(["coordinator"]);
    expect(canPerformCaringContactAction(coordinator, "generateClinicalRecordSummary", resourceIn())).toEqual({
      allowed: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Rule 4 — contact date changes and plan reassignment require teamLead
// ---------------------------------------------------------------------------

describe("rule 4: changeContactDate and reassignPlan require teamLead", () => {
  it("denies changeContactDate to coordinator", () => {
    const coordinator = actorWith(["coordinator"]);
    expect(canPerformCaringContactAction(coordinator, "changeContactDate", resourceIn())).toEqual({
      allowed: false,
      reason: "action-not-granted",
    });
  });

  it("allows changeContactDate to teamLead", () => {
    const teamLead = actorWith(["teamLead"]);
    expect(canPerformCaringContactAction(teamLead, "changeContactDate", resourceIn())).toEqual({ allowed: true });
  });

  it("denies reassignPlan to coordinator", () => {
    const coordinator = actorWith(["coordinator"]);
    expect(canPerformCaringContactAction(coordinator, "reassignPlan", resourceIn())).toEqual({
      allowed: false,
      reason: "action-not-granted",
    });
  });

  it("allows reassignPlan to teamLead", () => {
    const teamLead = actorWith(["teamLead"]);
    expect(canPerformCaringContactAction(teamLead, "reassignPlan", resourceIn())).toEqual({ allowed: true });
  });

  it("allows moveContactWithinDay to coordinator", () => {
    const coordinator = actorWith(["coordinator"]);
    expect(canPerformCaringContactAction(coordinator, "moveContactWithinDay", resourceIn())).toEqual({
      allowed: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Rule 5 — pathway version authoring, approval, and the self-approval guard
// ---------------------------------------------------------------------------

describe("rule 5: pathway version approval requires teamLead and forbids self-approval", () => {
  it("denies approvePathwayVersion to coordinator", () => {
    const coordinator = actorWith(["coordinator"]);
    expect(canPerformCaringContactAction(coordinator, "approvePathwayVersion", resourceIn())).toEqual({
      allowed: false,
      reason: "action-not-granted",
    });
  });

  it("allows approvePathwayVersion to teamLead", () => {
    const teamLead = actorWith(["teamLead"]);
    expect(canPerformCaringContactAction(teamLead, "approvePathwayVersion", resourceIn())).toEqual({
      allowed: true,
    });
  });

  it("allows authorPathwayVersion to coordinator", () => {
    const coordinator = actorWith(["coordinator"]);
    expect(canPerformCaringContactAction(coordinator, "authorPathwayVersion", resourceIn())).toEqual({
      allowed: true,
    });
  });

  it("denies self-approval when the author and the approver are the same actor", () => {
    const author = actorId("ACTOR-1");
    expect(canApproveOwnAuthoredVersion(author, author)).toEqual({
      allowed: false,
      reason: "self-approval-denied",
    });
  });

  it("allows approval when the approver differs from the author", () => {
    const author = actorId("ACTOR-1");
    const approver = actorId("ACTOR-2");
    expect(canApproveOwnAuthoredVersion(author, approver)).toEqual({ allowed: true });
  });
});

// ---------------------------------------------------------------------------
// Rule 6 — the safety stop is never blocked; the restart needs teamLead
// ---------------------------------------------------------------------------

describe("rule 6: triggerServiceSafetyStop is unblockable; approveServiceRestart requires teamLead", () => {
  it.each(ROLES)("allows triggerServiceSafetyStop for role %s", (role) => {
    const actor = actorWith([role]);
    expect(canPerformCaringContactAction(actor, "triggerServiceSafetyStop", resourceIn())).toEqual({
      allowed: true,
    });
  });

  it("denies approveServiceRestart to coordinator", () => {
    const coordinator = actorWith(["coordinator"]);
    expect(canPerformCaringContactAction(coordinator, "approveServiceRestart", resourceIn())).toEqual({
      allowed: false,
      reason: "action-not-granted",
    });
  });

  it("denies approveServiceRestart to auditor", () => {
    const auditor = actorWith(["auditor"]);
    expect(canPerformCaringContactAction(auditor, "approveServiceRestart", resourceIn())).toEqual({
      allowed: false,
      reason: "action-not-granted",
    });
  });

  it("allows approveServiceRestart to teamLead", () => {
    const teamLead = actorWith(["teamLead"]);
    expect(canPerformCaringContactAction(teamLead, "approveServiceRestart", resourceIn())).toEqual({
      allowed: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Rule 7 — an actor with no roles is denied everything
// ---------------------------------------------------------------------------

describe("rule 7: an actor with no roles is denied everything", () => {
  it("denies with no-roles for an ordinary action", () => {
    const actor = actorWith([]);
    expect(canPerformCaringContactAction(actor, "viewReferral", resourceIn())).toEqual({
      allowed: false,
      reason: "no-roles",
    });
  });

  it("denies with no-roles even for triggerServiceSafetyStop", () => {
    const actor = actorWith([]);
    expect(canPerformCaringContactAction(actor, "triggerServiceSafetyStop", resourceIn())).toEqual({
      allowed: false,
      reason: "no-roles",
    });
  });

  it("still checks team scope before the no-roles refusal", () => {
    const actor = actorWith([], TEAM_A);
    expect(canPerformCaringContactAction(actor, "viewReferral", resourceIn(TEAM_B))).toEqual({
      allowed: false,
      reason: "cross-team-denied",
    });
  });
});

// ---------------------------------------------------------------------------
// Table-driven completeness: no action can silently default to allowed
// ---------------------------------------------------------------------------

describe("every CaringContactAction is explicitly classified", () => {
  it.each(ALL_ACTIONS)("%s is granted to at least one role, or explicitly listed as ungranted", (action) => {
    const grantedToSomeRole = ROLES.some((role) => ROLE_ACTIONS[role].includes(action));
    const explicitlyUngranted = UNGRANTED_ACTIONS.includes(action);
    expect(grantedToSomeRole || explicitlyUngranted).toBe(true);
  });

  it("has no action that is both granted and marked ungranted", () => {
    const grantedActions = new Set(ROLES.flatMap((role) => ROLE_ACTIONS[role]));
    for (const action of UNGRANTED_ACTIONS) {
      expect(grantedActions.has(action)).toBe(false);
    }
  });

  it("covers every action in ALL_ACTIONS with no leftovers on either side", () => {
    const covered = new Set<CaringContactAction>([
      ...ROLES.flatMap((role) => ROLE_ACTIONS[role]),
      ...UNGRANTED_ACTIONS,
    ]);
    expect([...covered].sort()).toEqual([...ALL_ACTIONS].sort());
  });

  it("falls through to action-not-granted for an action absent from every grant list (deny-by-default sanity check)", () => {
    const coordinator = actorWith(["coordinator"]);
    const decision = canPerformCaringContactAction(
      coordinator,
      "someHypotheticalFutureAction" as CaringContactAction,
      resourceIn(),
    );
    expect(decision).toEqual({ allowed: false, reason: "action-not-granted" });
  });
});
