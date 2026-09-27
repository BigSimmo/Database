// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ fetchRead: vi.fn(), post: vi.fn(), reload: vi.fn() }));
vi.mock("@/components/roster/use-roster-team", () => ({
  useRosterTeams: () => teamsState,
  useRosterRead: (_serviceId: string | null, what: string) => ({
    status: "ready",
    data: reads[what as keyof typeof reads],
    message: null,
    reload: mocks.reload,
    readAt: new Date("2026-10-20T10:21:00Z"),
  }),
  fetchRosterRead: mocks.fetchRead,
  postRosterAction: mocks.post,
}));
vi.mock("@/components/roster/ask/roster-ask-box", () => ({ RosterAskBox: () => null }));
vi.mock("@/components/roster/use-roster-shifts", () => ({ useRosterShifts: () => ({ status: "ready", shifts: [] }) }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

import { RosterRequestsPage } from "@/components/roster/requests/roster-requests-page";

const ME = "5e000000-0000-4000-8000-000000000001";
const MEI = "5e000000-0000-4000-8000-000000000002";
const SERVICE = "5e000000-0000-4000-8000-000000000003";
const SWAP = "5e000000-0000-4000-8000-000000000004";
const OPEN = "5e000000-0000-4000-8000-000000000005";
const GIVE = "5e000000-0000-4000-8000-000000000006";
const TAKE = "5e000000-0000-4000-8000-000000000007";
const teamsState = {
  status: "ready",
  data: {
    teams: [{ serviceId: SERVICE, name: "Example team", enabled: true, role: "member", grade: "resident" }],
    actorId: ME,
  },
};
const overview = {
  service: { id: SERVICE, name: "Example team" },
  me: { role: "member", grade: "resident" as string | null, rotationEndsOn: null },
  latestPublication: null,
  seenLatest: false,
  settings: { swapApproval: "auto_same_grade", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};
const give = {
  id: GIVE,
  userId: MEI,
  name: "Mei",
  grade: "resident",
  siteId: null,
  siteName: null,
  startsAt: "2026-10-31T08:00:00Z",
  endsAt: "2026-10-31T16:00:00Z",
  shiftCode: "D",
  kind: "day",
};
const take = {
  ...give,
  id: TAKE,
  userId: ME,
  name: "You",
  startsAt: "2026-11-07T08:00:00Z",
  endsAt: "2026-11-07T16:00:00Z",
};
const swap = {
  id: SWAP,
  status: "requested",
  requesterId: MEI,
  counterpartyId: ME,
  requesterName: "Mei",
  counterpartyName: "You",
  give,
  take,
  autoApproved: false,
  needsManagerBecause: null,
  cancelReason: null,
  expiresAt: "2026-10-30T00:00:00Z",
  createdAt: "2026-10-19T00:00:00Z",
  decidedAt: null,
};
const open = {
  id: OPEN,
  status: "open",
  mine: false,
  claimedByMe: false,
  urgent: false,
  startsAt: "2026-11-12T08:00:00Z",
  endsAt: "2026-11-12T16:00:00Z",
  shiftCode: "D",
  kind: "day",
  minGrade: "resident",
  siteId: null,
};
const reads = {
  overview,
  assignments: { assignments: [give, take] },
  requests: { swaps: [swap], openShifts: [] as (typeof open)[] },
  unavailability: { unavailability: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  teamsState.data.teams.length = 1;
  window.history.replaceState({}, "", "/roster/requests");
  reads.requests.swaps = [swap];
  reads.requests.openShifts = [];
  overview.me.grade = "resident";
  reads.assignments.assignments = [give, take];
  mocks.fetchRead.mockImplementation(async (_serviceId: string, what: string) => ({
    ok: true,
    data: what === "leave_overlap" ? { alreadyOff: 2 } : reads[what as keyof typeof reads],
    readAt: new Date("2026-10-20T10:21:00Z"),
  }));
  mocks.post.mockResolvedValue({
    ok: true,
    result: { swapId: SWAP, openShiftId: OPEN, status: "approved", autoApproved: true },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ leave: [] })),
  );
});

it("uses a valid team ID in a multi-team handoff and never takes an actor from the URL", async () => {
  const second = "5e000000-0000-4000-8000-000000000009";
  teamsState.data.teams.push({ ...teamsState.data.teams[0]!, serviceId: second, name: "Other team" });
  window.history.replaceState({}, "", `/roster/requests?start=swap&team=${second}&assignment=${TAKE}&actorId=${MEI}`);
  render(<RosterRequestsPage />);
  expect(await screen.findByRole("dialog", { name: "Swap a shift" })).toBeTruthy();
  expect(mocks.fetchRead).toHaveBeenCalledWith(second, "overview");
  expect(mocks.post).not.toHaveBeenCalled();
});

it("accepts a same-grade swap after a fresh read and exposes ten-minute undo", async () => {
  const user = userEvent.setup();
  render(<RosterRequestsPage />);
  await user.click(screen.getByRole("button", { name: "Review" }));
  expect(screen.getByText(/You'll be off .*Nov.* and on .*Oct/)).toBeTruthy();
  expect(await screen.findByText(/Both residents, so it approves itself/)).toBeTruthy();
  expect(screen.getByText("Rechecked 18:21")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Accept swap" }));
  expect(mocks.post).toHaveBeenCalledWith(SERVICE, { action: "swap.accept", swapId: SWAP });
  expect(await screen.findByRole("button", { name: "Undo for 10 min" })).toBeTruthy();
});

it("opens an Ask dates handoff with Prefer off already selected", async () => {
  const day = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  window.history.replaceState({}, "", `/roster/requests?start=dates&team=${SERVICE}&date=${day}&kind=prefer_off`);
  render(<RosterRequestsPage />);
  expect(await screen.findByRole("dialog", { name: "Dates I can't work" })).toBeTruthy();
  expect(await screen.findByRole("button", { name: `${day}: Prefer off` })).toBeTruthy();
});

it("shows why a near swap needs a manager", async () => {
  const user = userEvent.setup();
  const soon = {
    ...give,
    startsAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 5 * 86_400_000 + 8 * 3_600_000).toISOString(),
  };
  reads.requests.swaps = [{ ...swap, give: soon }];
  reads.assignments.assignments = [soon, take];
  render(<RosterRequestsPage />);
  await user.click(screen.getByRole("button", { name: "Review" }));
  expect(await screen.findByText("Needs your manager because it's within 7 days")).toBeTruthy();
});

it("takes an eligible open shift with its id and removes it after someone else took it", async () => {
  const user = userEvent.setup();
  reads.requests.swaps = [];
  reads.requests.openShifts = [open];
  mocks.post.mockResolvedValueOnce({
    ok: false,
    code: "roster_open_shift_taken",
    message: "Someone else took this shift first.",
  });
  render(<RosterRequestsPage />);
  await user.click(screen.getByRole("button", { name: "Take it" }));
  expect(mocks.post).toHaveBeenCalledWith(SERVICE, { action: "open.claim", openShiftId: OPEN });
  expect(await screen.findByText("Someone else took this shift first.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Take it" })).toBeNull();
});

it("hides an open shift that clashes with my team shift", () => {
  reads.requests.swaps = [];
  reads.requests.openShifts = [{ ...open, startsAt: take.startsAt, endsAt: take.endsAt }];
  render(<RosterRequestsPage />);
  expect(screen.queryByRole("button", { name: "Take it" })).toBeNull();
});

it("hides Take it and explains grade setup when the actor has no known grade", () => {
  reads.requests.swaps = [];
  reads.requests.openShifts = [open];
  overview.me.grade = null;
  render(<RosterRequestsPage />);
  expect(screen.queryByRole("button", { name: "Take it" })).toBeNull();
  expect(screen.getByText("Add your grade in Your team before taking an open shift.")).toBeTruthy();
});

it("shows an anonymous leave overlap count", async () => {
  const user = userEvent.setup();
  reads.requests.swaps = [];
  render(<RosterRequestsPage />);
  await user.click(screen.getByRole("button", { name: "New" }));
  await user.click(screen.getByRole("button", { name: "Plan leave" }));
  await user.type(screen.getByLabelText("From"), "2026-12-22");
  await user.type(screen.getByLabelText("To"), "2027-01-02");
  expect(await screen.findByText("2 of the team are already off these dates")).toBeTruthy();
  expect(mocks.fetchRead).toHaveBeenCalledWith(SERVICE, "leave_overlap", { from: "2026-12-22", to: "2027-01-02" });
});
