import { describe, expect, it } from "vitest";

import { requestStatusWords } from "@/lib/roster/team/request-status";
import type { RosterSwap, RosterOpenShift } from "@/lib/roster/team/model";

const ME = "5e000000-0000-4000-8000-000000000001";
const OTHER = "5e000000-0000-4000-8000-000000000002";
const swap = (status: RosterSwap["status"], extra: Partial<RosterSwap> = {}) =>
  ({
    status,
    requesterId: ME,
    counterpartyId: OTHER,
    counterpartyName: "Mei",
    cancelReason: null,
    autoApproved: false,
    ...extra,
  }) as RosterSwap;
const open = (status: RosterOpenShift["status"], extra: Partial<RosterOpenShift> = {}) =>
  ({ status, mine: true, claimedByMe: false, ...extra }) as RosterOpenShift;

describe("request status in words", () => {
  it("distinguishes my request from one that needs my answer", () => {
    expect(requestStatusWords(swap("requested"), ME)).toBe("Waiting for Mei");
    expect(requestStatusWords(swap("requested", { requesterId: OTHER, counterpartyId: ME }), ME)).toBe("Needs you");
  });

  it.each([
    ["accepted", "Waiting for your manager"],
    ["approved", "Approved"],
    ["declined", "Declined"],
    ["expired", "Expired"],
    ["undone", "Undone"],
  ] as const)("calls a %s swap %s", (status, words) => {
    expect(requestStatusWords(swap(status), ME)).toBe(words);
  });

  it.each([
    ["withdrawn", "Withdrawn"],
    ["roster_changed", "Cancelled: the roster changed"],
    ["member_left", "Cancelled: they left the team"],
    ["no_longer_fits", "Cancelled: it no longer fits"],
  ] as const)("explains %s", (reason, words) => {
    expect(requestStatusWords(swap("cancelled", { cancelReason: reason }), ME)).toBe(words);
  });

  it("keeps open shift states distinct", () => {
    expect(requestStatusWords(open("reported"), ME)).toBe("Your manager has been told");
    expect(requestStatusWords(open("open"), ME)).toBe("Offered to your team");
    expect(requestStatusWords(open("claimed"), ME)).toBe("Waiting for your manager");
    expect(requestStatusWords(open("approved"), ME)).toBe("Taken");
  });
});
