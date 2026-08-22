import { describe, expect, it } from "vitest";

import { planRequestBatch } from "../scripts/ledger-inbox.mjs";

const UPDATE_ID = "11111111-1111-4111-8111-111111111111";
const CANCEL_ID = "22222222-2222-4222-8222-222222222222";
const APPLIED_ID = "33333333-3333-4333-8333-333333333333";
const UNKNOWN_ID = "44444444-4444-4444-8444-444444444444";

function update(id: string, issueId = "#316") {
  return {
    version: 1,
    id,
    createdOn: "2026-08-14",
    action: "update",
    payload: { id: issueId, detail: `detail for ${issueId}` },
  };
}

function done(id: string, issueId = "#316") {
  return {
    version: 1,
    id,
    createdOn: "2026-08-14",
    action: "done",
    payload: { id: issueId, outcome: `resolved ${issueId}` },
  };
}

function queue(id: string, issueId = "#316") {
  return {
    version: 1,
    id,
    createdOn: "2026-08-14",
    action: "queue",
    payload: { id: issueId, acuity: "A2" },
  };
}

function cancel(id: string, requestId: string) {
  return {
    version: 1,
    id,
    createdOn: "2026-08-14",
    action: "cancel",
    payload: { requestId, reason: "superseded" },
  };
}

// planRequestBatch reads the applied directory itself by default; every test here
// injects the requests so the assertions do not depend on the repo's real inbox.
function plan(requests: object[], appliedRequests: ReturnType<typeof update | typeof cancel>[] = []) {
  const warnings: string[] = [];
  const result = planRequestBatch(requests, {
    appliedRequests: new Map(appliedRequests.map((request) => [request.id, request])),
    warn: (message: string) => warnings.push(message),
  });
  return { ...result, warnings };
}

describe("ledger inbox cancellation planning", () => {
  it("cancels a pending request in the same batch", () => {
    const result = plan([update(UPDATE_ID), cancel(CANCEL_ID, UPDATE_ID)]);

    expect(result.active).toHaveLength(0);
    expect(result.cancelledIds).toEqual([UPDATE_ID]);
    expect(result.cancellations).toEqual([{ requestId: CANCEL_ID, targetId: UPDATE_ID, reason: "superseded" }]);
    expect(result.warnings).toHaveLength(0);
    expect(result.ineffectiveCancellations).toHaveLength(0);
  });

  // The race this exists for: another branch reconciled first and applied the
  // target, so this cancellation can no longer take effect. Throwing here wedges
  // check:docs-links, check:ledger-write-discipline and reconcile at once, with no
  // legal way out because write discipline forbids deleting the queued request.
  it("does not throw when the cancelled target was already applied elsewhere", () => {
    const result = plan([update(UPDATE_ID), cancel(CANCEL_ID, APPLIED_ID)], [update(APPLIED_ID)]);

    expect(result.active).toHaveLength(1);
    expect(result.cancelledIds).toHaveLength(0);
    expect(result.ineffectiveCancellations).toEqual([{ requestId: CANCEL_ID, targetId: APPLIED_ID }]);
  });

  it("says loudly that an already-applied cancellation changed nothing", () => {
    const result = plan([cancel(CANCEL_ID, APPLIED_ID)], [update(APPLIED_ID)]);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain(CANCEL_ID);
    expect(result.warnings[0]).toContain(APPLIED_ID);
    expect(result.warnings[0]).toContain("did not take effect");
    // The operator must be told to fix the row another way, not left assuming the
    // cancellation did its job.
    expect(result.warnings[0]).toContain("new update request");
  });

  it("still throws when the target never existed", () => {
    expect(() => plan([cancel(CANCEL_ID, UNKNOWN_ID)], [update(APPLIED_ID)])).toThrow(
      /targets missing pending request/,
    );
  });

  it("still refuses to cancel another cancellation", () => {
    expect(() => plan([update(UPDATE_ID), cancel(CANCEL_ID, UPDATE_ID), cancel(APPLIED_ID, CANCEL_ID)])).toThrow(
      /cannot cancel another cancellation/,
    );
  });

  it("still refuses to cancel a cancellation that was already applied", () => {
    expect(() => plan([cancel(CANCEL_ID, APPLIED_ID)], [cancel(APPLIED_ID, UPDATE_ID)])).toThrow(
      /cannot cancel another cancellation/,
    );
  });

  it("still refuses to cancel the same request twice", () => {
    expect(() => plan([update(UPDATE_ID), cancel(CANCEL_ID, UPDATE_ID), cancel(APPLIED_ID, UPDATE_ID)])).toThrow(
      /cancelled more than once/,
    );
  });

  it("keeps requiring a decision when two mutations target one row", () => {
    expect(() => plan([update(UPDATE_ID), update(CANCEL_ID)])).toThrow(
      /multiple pending mutations require an explicit cancellation decision/,
    );
  });

  it("treats a queue edit and closure as conflicting mutations in either order", () => {
    for (const requests of [
      [queue(UPDATE_ID), done(CANCEL_ID)],
      [done(UPDATE_ID), queue(CANCEL_ID)],
    ]) {
      expect(() => plan(requests)).toThrow(/multiple pending mutations require an explicit cancellation decision/);
    }
  });

  it("an ineffective cancellation does not resolve a competing-mutation conflict", () => {
    // The cancellation lost its race, so both updates are still active and the
    // conflict must still be raised rather than silently half-applied.
    expect(() =>
      plan([update(UPDATE_ID), update(CANCEL_ID), cancel(UNKNOWN_ID, APPLIED_ID)], [update(APPLIED_ID)]),
    ).toThrow(/multiple pending mutations require an explicit cancellation decision/);
  });
});
