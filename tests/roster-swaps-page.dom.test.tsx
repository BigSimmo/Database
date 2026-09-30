// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchRead: vi.fn(), post: vi.fn(), reload: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ useAuthSession: () => ({ status: "authenticated", authEpoch: 1 }) }));
vi.mock("@/components/roster/use-roster-team", () => ({
  useRosterTeams: () => teamsState,
  useRosterRead: (serviceId: string | null, what: string) =>
    serviceId
      ? {
          status: "ready",
          data: reads[what as keyof typeof reads],
          message: null,
          reload: mocks.reload,
          readAt: new Date("2030-03-01T02:00:00Z"),
        }
      : { status: "loading", data: null, message: null, reload: mocks.reload, readAt: null },
  fetchRosterRead: mocks.fetchRead,
  postRosterAction: mocks.post,
}));
vi.mock("@/components/roster/ask/roster-ask-box", () => ({ RosterAskBox: () => null }));
vi.mock("@/components/roster/use-roster-shifts", () => ({ useRosterShifts: () => ({ status: "ready", shifts: [] }) }));

import { RosterSwapsPage } from "@/components/roster/swaps/roster-swaps-page";
import { SwapProgressLine } from "@/components/roster/swaps/swap-progress-line";
import { swapProgress } from "@/lib/roster/team/swap-progress";

const ME = "5e000000-0000-4000-8000-000000000001";
const SAM = "5e000000-0000-4000-8000-000000000002";
const SERVICE = "5e000000-0000-4000-8000-000000000003";
const NOOR = "5e000000-0000-4000-8000-000000000008";
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
const sams = {
  id: GIVE,
  userId: SAM,
  name: "Sam",
  grade: "resident",
  siteId: null,
  siteName: null,
  startsAt: "2030-03-12T00:00:00Z",
  endsAt: "2030-03-12T08:00:00Z",
  shiftCode: "D",
  kind: "day",
};
const mine = {
  ...sams,
  id: TAKE,
  userId: ME,
  name: "You",
  startsAt: "2030-03-19T00:00:00Z",
  endsAt: "2030-03-19T08:00:00Z",
};
const swap = {
  id: "5e000000-0000-4000-8000-000000000004",
  status: "requested",
  requesterId: SAM,
  counterpartyId: ME,
  requesterName: "Sam",
  counterpartyName: "You",
  give: sams,
  take: mine,
  autoApproved: false,
  needsManagerBecause: null,
  cancelReason: null,
  expiresAt: "2099-01-01T00:00:00Z",
  createdAt: "2030-03-01T00:00:00Z",
  decidedAt: null,
};
const open = {
  id: OPEN,
  status: "open",
  mine: false,
  claimedByMe: false,
  urgent: false,
  startsAt: "2030-03-26T00:00:00Z",
  endsAt: "2030-03-26T08:00:00Z",
  shiftCode: "D",
  kind: "day",
  minGrade: "resident",
  siteId: null,
};
const reads = {
  overview,
  assignments: { assignments: [sams, mine] as unknown[] },
  requests: { swaps: [swap] as unknown[], openShifts: [] as unknown[] },
  manage: { swaps: [] as unknown[], openShifts: [], seen: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  teamsState.data.teams[0]!.role = "member";
  reads.requests.swaps = [swap];
  reads.requests.openShifts = [];
  reads.manage.swaps = [];
  reads.assignments.assignments = [sams, mine];
  overview.me.grade = "resident";
  mocks.fetchRead.mockImplementation(async (_serviceId: string, what: string) => ({
    ok: true,
    data: reads[what as keyof typeof reads],
    readAt: new Date("2030-03-01T02:00:00Z"),
  }));
  mocks.post.mockResolvedValue({ ok: true, result: { swapId: swap.id, status: "approved", autoApproved: false } });
});
afterEach(cleanup);

const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.textContent?.replace(/\d+$/, ""));

describe("Swaps page tabs", () => {
  it("gives a member Needs you, Sent, Open shifts and History, and no team tab", () => {
    render(<RosterSwapsPage />);
    expect(tabNames()).toEqual(["Needs you", "Sent", "Open shifts", "History"]);
  });

  it("gives a manager an All team swaps tab that lists every swap with its progress", async () => {
    const user = userEvent.setup();
    teamsState.data.teams[0]!.role = "manager";
    reads.manage.swaps = [
      {
        ...swap,
        status: "accepted",
        needsManagerBecause: "within_7_days",
        counterpartyId: NOOR,
        counterpartyName: "Noor",
      },
    ];
    render(<RosterSwapsPage />);
    expect(tabNames()).toEqual(["Needs you", "Sent", "Open shifts", "History", "All team swaps"]);
    await user.click(screen.getByRole("tab", { name: /All team swaps/ }));
    expect(screen.getByText("Sam and Noor")).toBeTruthy();
    expect(screen.getByText("Waiting on you")).toBeTruthy();
  });
});

describe("Swaps page swaps", () => {
  it("shows a swap waiting on me in Needs you with Accept, and sends the accept", async () => {
    const user = userEvent.setup();
    render(<RosterSwapsPage />);
    expect(screen.getByText("Sam asks to swap")).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "Accept swap" }));
    expect(mocks.post).toHaveBeenCalledWith(SERVICE, { action: "swap.accept", swapId: swap.id });
    expect(await screen.findByText("Swap accepted")).toBeTruthy();
  });

  it("shows a swap that ran out of time in History as Expired, with no Accept", async () => {
    const user = userEvent.setup();
    reads.requests.swaps = [{ ...swap, expiresAt: "2020-01-01T00:00:00Z" }];
    render(<RosterSwapsPage />);
    expect(screen.queryByRole("button", { name: "Accept swap" })).toBeNull();
    expect(screen.getByText("Nothing needs you right now.")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept swap" })).toBeNull();
  });

  it("shows a swap I sent in Sent and lets me withdraw it", async () => {
    const user = userEvent.setup();
    reads.requests.swaps = [
      { ...swap, requesterId: ME, counterpartyId: SAM, requesterName: "You", counterpartyName: "Sam" },
    ];
    render(<RosterSwapsPage />);
    await user.click(screen.getByRole("tab", { name: /Sent/ }));
    expect(screen.getByText("Waiting on Sam, expires Thu 1 Jan")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(mocks.post).toHaveBeenCalledWith(SERVICE, { action: "swap.cancel", swapId: swap.id });
  });

  it("says when a swap I sent runs out, in Perth time", async () => {
    const user = userEvent.setup();
    reads.requests.swaps = [
      { ...swap, requesterId: ME, counterpartyId: SAM, requesterName: "You", counterpartyName: "Sam" },
    ];
    render(<RosterSwapsPage />);
    await user.click(screen.getByRole("tab", { name: /Sent/ }));
    expect(screen.getByText("Waiting on Sam, expires Thu 1 Jan")).toBeTruthy();
  });

  it("says when a swap waiting on me runs out", () => {
    render(<RosterSwapsPage />);
    expect(screen.getByText("Waiting on you, expires Thu 1 Jan")).toBeTruthy();
  });

  it("shows a declined swap in History with its reason", async () => {
    const user = userEvent.setup();
    reads.requests.swaps = [{ ...swap, status: "declined" }];
    render(<RosterSwapsPage />);
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByText("Declined")).toBeTruthy();
    expect(screen.queryByText(/expires/)).toBeNull();
  });

  it("shows a cancelled swap in History with why it was cancelled", async () => {
    const user = userEvent.setup();
    reads.requests.swaps = [{ ...swap, status: "cancelled", cancelReason: "roster_changed" }];
    render(<RosterSwapsPage />);
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByText("Cancelled: the roster changed")).toBeTruthy();
  });

  it("shows an ended swap in All team swaps without an expiry", async () => {
    const user = userEvent.setup();
    teamsState.data.teams[0]!.role = "manager";
    reads.manage.swaps = [
      { ...swap, status: "declined", counterpartyId: NOOR, counterpartyName: "Noor" },
      { ...swap, id: "5e000000-0000-4000-8000-000000000009", status: "requested", counterpartyId: NOOR },
    ];
    render(<RosterSwapsPage />);
    await user.click(screen.getByRole("tab", { name: /All team swaps/ }));
    expect(screen.getByText("Declined")).toBeTruthy();
    expect(screen.queryByText(/expires/)).toBeNull();
  });

  it("marks the current step of the progress line", async () => {
    const user = userEvent.setup();
    reads.requests.swaps = [
      { ...swap, requesterId: ME, counterpartyId: SAM, requesterName: "You", counterpartyName: "Sam" },
    ];
    render(<RosterSwapsPage />);
    await user.click(screen.getByRole("tab", { name: /Sent/ }));
    const line = screen.getByRole("list", { name: "Swap progress" });
    const current = within(line)
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "step");
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toContain("Accepted");
  });
});

describe("Swaps page open shifts", () => {
  beforeEach(() => {
    reads.requests.swaps = [];
    reads.requests.openShifts = [open];
  });

  it("takes an eligible open shift with its id and removes it after someone else took it", async () => {
    const user = userEvent.setup();
    mocks.post.mockResolvedValueOnce({
      ok: false,
      code: "roster_open_shift_taken",
      message: "Someone else took this shift first.",
    });
    render(<RosterSwapsPage />);
    await user.click(screen.getByRole("tab", { name: /Open shifts/ }));
    await user.click(screen.getByRole("button", { name: "Take it" }));
    expect(mocks.post).toHaveBeenCalledWith(SERVICE, { action: "open.claim", openShiftId: OPEN });
    expect(await screen.findByText("Someone else took this shift first.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Take it" })).toBeNull();
  });

  it("hides an open shift that clashes with my team shift", async () => {
    const user = userEvent.setup();
    reads.requests.openShifts = [{ ...open, startsAt: mine.startsAt, endsAt: mine.endsAt }];
    render(<RosterSwapsPage />);
    await user.click(screen.getByRole("tab", { name: /Open shifts/ }));
    expect(screen.queryByRole("button", { name: "Take it" })).toBeNull();
  });

  it("hides Take it and explains grade setup when the actor has no known grade", async () => {
    const user = userEvent.setup();
    overview.me.grade = null;
    render(<RosterSwapsPage />);
    await user.click(screen.getByRole("tab", { name: /Open shifts/ }));
    expect(screen.queryByRole("button", { name: "Take it" })).toBeNull();
    expect(screen.getByText("Add your grade in Your team before taking an open shift.")).toBeTruthy();
  });

  it("lets me withdraw a shift I offered", async () => {
    const user = userEvent.setup();
    reads.requests.openShifts = [{ ...open, mine: true }];
    render(<RosterSwapsPage />);
    await user.click(screen.getByRole("tab", { name: /Open shifts/ }));
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(mocks.post).toHaveBeenCalledWith(SERVICE, { action: "open.cancel", openShiftId: OPEN });
  });
});

describe("SwapProgressLine", () => {
  it("is a list with the current step marked and says how an ended swap ended", () => {
    const progress = swapProgress({ ...swap, expiresAt: "2020-01-01T00:00:00Z" } as never, ME, new Date());
    render(<SwapProgressLine steps={progress.steps} waitingOn={progress.waitingOn} ended={progress.ended} />);
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.queryByText(/Waiting on/)).toBeNull();
  });
});
