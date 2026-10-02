import { describe, expect, it } from "vitest";

import { swapProgress } from "@/lib/roster/team/swap-progress";
import type { RosterAssignment, RosterManageSwap, RosterSwap } from "@/lib/roster/team/model";

/* The steps of a swap and who it is waiting on. Every person is invented. */

const ME = "a1000000-0000-4000-8000-000000000001";
const COLLEAGUE = "a1000000-0000-4000-8000-000000000002";
const OTHER = "a1000000-0000-4000-8000-000000000003";
const NOW = new Date("2026-10-10T02:00:00Z");

const give: RosterAssignment = {
  id: "a1000000-0000-4000-8000-0000000000a1",
  userId: ME,
  name: "Dr Mei Example",
  grade: "registrar",
  siteId: null,
  siteName: null,
  startsAt: "2026-10-20T13:30:00Z",
  endsAt: "2026-10-20T23:00:00Z",
  shiftCode: "N",
  kind: "night",
};

function swap(over: Partial<RosterSwap>): RosterSwap {
  return {
    id: "a1000000-0000-4000-8000-0000000000b1",
    status: "requested",
    autoApproved: false,
    needsManagerBecause: null,
    cancelReason: null,
    requesterId: ME,
    counterpartyId: COLLEAGUE,
    give,
    take: null,
    expiresAt: "2026-10-12T00:00:00Z",
    createdAt: "2026-10-09T00:00:00Z",
    decidedAt: null,
    requesterName: "Dr Mei Example",
    counterpartyName: "Dr Sam Example",
    ...over,
  };
}

const labels = (steps: { label: string }[]) => steps.map((s) => s.label);
const states = (steps: { state: string }[]) => steps.map((s) => s.state);

describe("swapProgress", () => {
  it("asks the colleague to answer, with the swap in their Needs you list", () => {
    const result = swapProgress(swap({ requesterId: COLLEAGUE, counterpartyId: ME }), ME, NOW);
    expect(result.tab).toBe("needs_you");
    expect(result.waitingOn).toBe("You");
    expect(result.ended).toBeNull();
    expect(labels(result.steps)).toEqual(["Requested", "Accepted", "Done"]);
    expect(states(result.steps)).toEqual(["done", "current", "todo"]);
  });

  it("shows the requester it is waiting on the colleague by name", () => {
    const result = swapProgress(swap({}), ME, NOW);
    expect(result.tab).toBe("sent");
    expect(result.waitingOn).toBe("Dr Sam Example");
  });

  it("falls back to a plain phrase when the colleague has no name", () => {
    expect(swapProgress(swap({ counterpartyName: null }), ME, NOW).waitingOn).toBe("Your colleague");
  });

  it("reads Expired, in history with nobody to wait on, once expiresAt has passed", () => {
    const result = swapProgress(
      swap({ requesterId: COLLEAGUE, counterpartyId: ME, expiresAt: "2026-10-10T01:59:59Z" }),
      ME,
      NOW,
    );
    expect(result.ended).toBe("Expired");
    expect(result.tab).toBe("history");
    expect(result.waitingOn).toBeNull();
    expect(states(result.steps)).toEqual(["done", "todo", "todo"]);
  });

  it("does not expire a swap that was already accepted", () => {
    const result = swapProgress(
      swap({ status: "accepted", needsManagerBecause: "within_7_days", expiresAt: "2026-10-01T00:00:00Z" }),
      ME,
      NOW,
    );
    expect(result.ended).toBeNull();
  });

  it("puts Manager approved as the current step when an accepted swap needs the manager", () => {
    const result = swapProgress(swap({ status: "accepted", needsManagerBecause: "within_7_days" }), ME, NOW);
    expect(labels(result.steps)).toEqual(["Requested", "Accepted", "Manager approved", "Done"]);
    expect(states(result.steps)).toEqual(["done", "done", "current", "todo"]);
    expect(result.waitingOn).toBe("Your manager");
    expect(result.tab).toBe("sent");
  });

  it("puts the swap in the manager's Needs you list and says it is waiting on them", () => {
    const result = swapProgress(swap({ status: "accepted", needsManagerBecause: "team_setting" }), OTHER, NOW);
    expect(result.tab).toBe("needs_you");
    expect(result.waitingOn).toBe("You");
  });

  it("shows a swap that approved itself as three steps, all done", () => {
    const result = swapProgress(swap({ status: "approved", autoApproved: true }), ME, NOW);
    expect(labels(result.steps)).toEqual(["Requested", "Accepted", "Done"]);
    expect(states(result.steps)).toEqual(["done", "done", "done"]);
    expect(result.tab).toBe("history");
    expect(result.waitingOn).toBeNull();
    expect(result.ended).toBeNull();
  });

  it("shows a manager-approved swap as four steps, all done", () => {
    const result = swapProgress(swap({ status: "approved", needsManagerBecause: "different_grade" }), ME, NOW);
    expect(states(result.steps)).toEqual(["done", "done", "done", "done"]);
  });

  it.each([
    ["declined", "Declined"],
    ["cancelled", "Cancelled"],
    ["expired", "Expired"],
    ["undone", "Undone"],
  ] as const)("ends a %s swap as %s, in history", (status, ended) => {
    const result = swapProgress(swap({ status }), ME, NOW);
    expect(result.ended).toBe(ended);
    expect(result.tab).toBe("history");
    expect(result.waitingOn).toBeNull();
    expect(states(result.steps)).not.toContain("current");
  });

  it("reads a manager's swap, which has no expiry, without error", () => {
    const manage: RosterManageSwap = {
      id: "a1000000-0000-4000-8000-0000000000b2",
      status: "requested",
      autoApproved: false,
      needsManagerBecause: null,
      requesterId: COLLEAGUE,
      counterpartyId: OTHER,
      give,
      take: null,
      decidedAt: null,
      requesterName: "Dr Sam Example",
      counterpartyName: "Dr Kai Example",
    };
    const result = swapProgress(manage, ME, NOW);
    expect(result.ended).toBeNull();
    expect(result.waitingOn).toBe("Dr Kai Example");
  });
});
