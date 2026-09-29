import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ teams: vi.fn(), read: vi.fn(), command: vi.fn() }));
vi.mock("@/lib/roster/team/repository", () => ({
  rosterReadTeams: mocks.teams,
  rosterRead: mocks.read,
  rosterCommand: mocks.command,
}));
import { calendarRosterShifts } from "@/lib/roster/team/calendar-shifts";
import { withdrawRosterRequests } from "@/lib/roster/team/delete-my-data";
import type { RosterAdminClient } from "@/lib/roster/team/api";
const team = { serviceId: "team", name: "Example team", enabled: true, role: "member", grade: null };
const now = new Date("2026-10-01T00:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  mocks.teams.mockResolvedValue([team]);
  mocks.command.mockResolvedValue({ ok: true });
});
it("includes only the feed owner's team assignments and excludes disabled teams", async () => {
  mocks.teams.mockResolvedValue([team, { ...team, serviceId: "disabled", enabled: false }]);
  const assignment = {
    id: "one",
    userId: "owner",
    name: "Private name",
    grade: null,
    siteId: null,
    siteName: "Private site",
    startsAt: "2026-10-02T00:00:00Z",
    endsAt: "2026-10-02T09:00:00Z",
    shiftCode: "D",
    kind: "day",
  };
  mocks.read.mockResolvedValue({ assignments: [assignment, { ...assignment, id: "other-shift", userId: "other" }] });
  const result = await calendarRosterShifts({} as RosterAdminClient, "owner", [], now);
  expect(result).toHaveLength(1);
  expect(result[0].source).toBe("team");
  expect(mocks.read).toHaveBeenCalledOnce();
  expect(mocks.read.mock.calls[0][1]).toBe("owner");
});
it("fails the calendar read when team access cannot be rechecked", async () => {
  mocks.read.mockRejectedValue(new Error("membership revoked"));
  await expect(calendarRosterShifts({} as RosterAdminClient, "owner", [], now)).rejects.toThrow();
});
it("withdraws only the actor's unfinished requests and future dates, never assignments", async () => {
  mocks.read.mockResolvedValue({
    swaps: [
      { id: "mine", requesterId: "owner", counterpartyId: "other", status: "accepted" },
      { id: "incoming", requesterId: "other", counterpartyId: "owner", status: "requested" },
      { id: "finished", requesterId: "owner", status: "approved" },
    ],
    openShifts: [
      { id: "open", mine: true, status: "open" },
      { id: "theirs", mine: false, status: "open" },
    ],
  });
  const eq = vi.fn().mockReturnThis();
  const gte = vi.fn().mockReturnThis();
  const limit = vi.fn().mockResolvedValue({ data: [{ on_date: "2028-01-01" }], error: null });
  const from = vi.fn(() => ({ select: () => ({ eq, gte, limit }) }));
  const result = await withdrawRosterRequests({ from } as unknown as RosterAdminClient, "owner", now);
  expect(result.skippedTeams).toBe(0);
  expect(mocks.command.mock.calls.map((args) => args[3])).toEqual([
    { action: "swap.cancel", swapId: "mine" },
    { action: "swap.decline", swapId: "incoming" },
    { action: "open.cancel", openShiftId: "open" },
    { action: "unavailability.set", set: [], clear: ["2028-01-01"] },
  ]);
  expect(from).toHaveBeenCalledWith("roster_unavailability");
  expect(eq).toHaveBeenCalledWith("user_id", "owner");
  expect(eq).toHaveBeenCalledWith("service_id", "team");
});
it("reports a refused team while continuing other teams", async () => {
  mocks.teams.mockResolvedValue([team, { ...team, serviceId: "second" }]);
  mocks.read.mockRejectedValue(new Error("refused"));
  expect((await withdrawRosterRequests({} as RosterAdminClient, "owner", now)).skippedTeams).toBe(2);
  expect(mocks.read).toHaveBeenCalledTimes(2);
});
