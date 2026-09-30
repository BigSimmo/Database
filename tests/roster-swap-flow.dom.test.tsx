// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchRead: vi.fn(), post: vi.fn() }));
const auth = vi.hoisted(() => ({ status: "authenticated", authEpoch: 1 }));
vi.mock("@/lib/supabase/client", () => ({ useAuthSession: () => auth }));
vi.mock("@/components/roster/use-roster-team", () => ({
  fetchRosterRead: mocks.fetchRead,
  postRosterAction: mocks.post,
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

import { SwapAnswerCard, SwapFlowSheet } from "@/components/roster/swaps/swap-flow-sheet";
import { UNDO_MS } from "@/components/roster/swaps/use-delayed-roster-action";
import type { RosterAssignment, RosterSwap } from "@/lib/roster/team/model";

/*
 * The calendar-first swap flow: who, take back, check, send under a 10 second
 * Undo. Every person and time is invented; dates are far ahead so the shifts
 * are always still to come.
 */

const SERVICE = "5e000000-0000-4000-8000-000000000003";
const ME = "5e000000-0000-4000-8000-000000000001";
const SAM = "5e000000-0000-4000-8000-000000000002";
const NOOR = "5e000000-0000-4000-8000-000000000004";
const SWAP = "5e000000-0000-4000-8000-000000000005";

let counter = 0x100;
function shift(
  userId: string,
  name: string,
  grade: RosterAssignment["grade"],
  date: string,
  start: string,
  endDate: string,
  end: string,
  kind: RosterAssignment["kind"] = "day",
): RosterAssignment {
  return {
    id: `5e000000-0000-4000-8000-${(counter++).toString(16).padStart(12, "0")}`,
    userId,
    name,
    grade,
    siteId: null,
    siteName: null,
    startsAt: `${date}T${start}:00+08:00`,
    endsAt: `${endDate}T${end}:00+08:00`,
    shiftCode: kind === "night" ? "N" : "D",
    kind,
  };
}

const give = shift(ME, "Alex Example", "registrar", "2030-03-12", "21:30", "2030-03-13", "08:00", "night");
const myOther = shift(ME, "Alex Example", "registrar", "2030-03-14", "08:00", "2030-03-14", "16:30");
const samEarly = shift(SAM, "Dr Sam Example", "registrar", "2030-03-11", "08:00", "2030-03-11", "16:30");
const samLate = shift(SAM, "Dr Sam Example", "registrar", "2030-03-13", "09:00", "2030-03-13", "17:00");
const samClashesWithMine = shift(SAM, "Dr Sam Example", "registrar", "2030-03-14", "09:00", "2030-03-14", "17:00");
const noorDay = shift(NOOR, "Dr Noor Example", "resident", "2030-03-11", "08:00", "2030-03-11", "16:30");

const overview = {
  service: { id: SERVICE, name: "Example team" },
  me: { role: "member", grade: "registrar", rotationEndsOn: null },
  latestPublication: null,
  seenLatest: true,
  settings: { swapApproval: "auto_same_grade", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};
const reads = {
  assignments: { assignments: [give, myOther, samEarly, samLate, samClashesWithMine, noorDay] },
  overview,
};

const onSent = vi.fn();
const onClose = vi.fn();

function renderFlow(mode: "swap" | "give_away" = "swap") {
  return render(
    <SwapFlowSheet open onClose={onClose} serviceId={SERVICE} actorId={ME} give={give} mode={mode} onSent={onSent} />,
  );
}

async function toCheckStep() {
  await screen.findByText("Can swap");
  fireEvent.click(screen.getByRole("button", { name: /Dr Sam Example/ }));
  fireEvent.click(screen.getByRole("button", { name: "Nothing, just take my shift" }));
}

const swapCreate = {
  action: "swap.create",
  giveAssignmentId: give.id,
  counterpartyId: SAM,
  takeAssignmentId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  overview.settings.swapApproval = "auto_same_grade";
  auth.status = "authenticated";
  mocks.fetchRead.mockImplementation(async (_serviceId: string, what: string) => ({
    ok: true,
    data: reads[what as keyof typeof reads],
    readAt: new Date("2026-10-20T10:21:00Z"),
  }));
  mocks.post.mockResolvedValue({ ok: true, result: { swapId: SWAP, status: "requested" } });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("SwapFlowSheet: who and take back", () => {
  it("lists a lower-grade colleague under Can't swap with the reason", async () => {
    renderFlow();
    await screen.findByText("Can swap");
    const cannot = screen.getByRole("heading", { name: "Can't swap" }).closest("section")!;
    expect(within(cannot).getByText("Dr Noor Example")).toBeTruthy();
    expect(within(cannot).getByText("Lower grade than this shift needs")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Dr Sam Example/ })).toBeTruthy();
  });

  it("shows only the chosen colleague's compatible shifts, plus Nothing", async () => {
    renderFlow();
    await screen.findByText("Can swap");
    fireEvent.click(screen.getByRole("button", { name: /Dr Sam Example/ }));
    expect(screen.getByRole("button", { name: "Nothing, just take my shift" })).toBeTruthy();
    // Sam's 14 March shift overlaps one of mine, so it is left out.
    const choices = screen.getAllByRole("button").map((button) => button.textContent);
    expect(choices.filter((text) => /Mon 11 Mar|Wed 13 Mar/.test(text ?? ""))).toHaveLength(2);
    expect(choices.some((text) => /14 Mar/.test(text ?? ""))).toBe(false);
  });
});

describe("SwapFlowSheet: check and send", () => {
  it("says a same-grade swap goes through once they accept", async () => {
    renderFlow();
    await toCheckStep();
    expect(screen.getByText("Goes through straight away once they accept.")).toBeTruthy();
    expect(screen.getByText("Rechecked 18:21")).toBeTruthy();
    expect(screen.getByLabelText("Your week after")).toBeTruthy();
  });

  it("says why the manager is needed when the team asks for approval", async () => {
    overview.settings.swapApproval = "manager";
    renderFlow();
    await toCheckStep();
    expect(
      screen.getByText("Needs your manager's approval because the team asks your manager to approve swaps"),
    ).toBeTruthy();
  });

  it("holds the send for 10 seconds with an Undo, and Undo sends nothing", async () => {
    renderFlow();
    await toCheckStep();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "Send swap request" }));
    expect(screen.getByText("Sending in 10 seconds")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => vi.advanceTimersByTime(UNDO_MS + 1));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.getByText("Cancelled before sending.")).toBeTruthy();
    expect(onSent).not.toHaveBeenCalled();
  });

  it("sends after 10 seconds with keepalive, then reports it and closes", async () => {
    renderFlow();
    await toCheckStep();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "Send swap request" }));
    await act(async () => vi.advanceTimersByTime(UNDO_MS + 1));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith(SERVICE, swapCreate, { keepalive: true });
    expect(onSent).toHaveBeenCalledWith("Swap sent");
    expect(onClose).toHaveBeenCalled();
  });

  it("sends nothing when the page is left during the hold", async () => {
    renderFlow();
    await toCheckStep();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "Send swap request" }));
    await act(async () => vi.advanceTimersByTime(5_000));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await act(async () => vi.advanceTimersByTime(UNDO_MS));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
  });

  it("sends nothing when the window is closed during the hold", async () => {
    const { unmount } = renderFlow();
    await toCheckStep();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "Send swap request" }));
    unmount();
    await act(async () => vi.advanceTimersByTime(UNDO_MS + 1));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("shows the server's message when it refuses, and reads the roster again", async () => {
    mocks.post.mockResolvedValue({ ok: false, code: "roster_swap_clash", message: "Sam is already working then." });
    renderFlow();
    await toCheckStep();
    const readsBefore = mocks.fetchRead.mock.calls.length;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "Send swap request" }));
    await act(async () => vi.advanceTimersByTime(UNDO_MS + 1));
    expect(screen.getByRole("alert").textContent).toBe("Sam is already working then.");
    expect(mocks.fetchRead.mock.calls.length).toBeGreaterThan(readsBefore);
    expect(onSent).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("SwapFlowSheet: give away", () => {
  it("offers the shift with open.post and its assignment id after the hold", async () => {
    renderFlow("give_away");
    await screen.findByText(/Who can take it: 1 person/);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByRole("button", { name: "Offer to 1 person" }));
    expect(screen.getByText("Sending in 10 seconds")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(UNDO_MS + 1));
    expect(mocks.post).toHaveBeenCalledWith(
      SERVICE,
      { action: "open.post", assignmentId: give.id },
      { keepalive: true },
    );
    expect(onSent).toHaveBeenCalledWith("Offered to Dr Sam Example");
  });
});

describe("SwapAnswerCard", () => {
  const theirs = shift(SAM, "Dr Sam Example", "registrar", "2030-03-20", "08:00", "2030-03-20", "16:30");
  const swap: RosterSwap = {
    id: SWAP,
    status: "requested",
    autoApproved: false,
    needsManagerBecause: null,
    cancelReason: null,
    requesterId: SAM,
    counterpartyId: ME,
    give: theirs,
    take: myOther,
    expiresAt: "2099-01-01T00:00:00Z",
    createdAt: "2026-10-19T00:00:00Z",
    decidedAt: null,
    requesterName: "Dr Sam Example",
    counterpartyName: "Alex Example",
  };
  const done = vi.fn();

  it("shows what they give and get, and accepts", async () => {
    render(<SwapAnswerCard swap={swap} serviceId={SERVICE} actorId={ME} onDone={done} />);
    expect(screen.getByText("Dr Sam Example give")).toBeTruthy();
    expect(screen.getByText("Dr Sam Example get")).toBeTruthy();
    await screen.findByLabelText("Your week after");
    fireEvent.click(screen.getByRole("button", { name: "Accept swap" }));
    await act(async () => {});
    expect(mocks.post).toHaveBeenCalledWith(SERVICE, { action: "swap.accept", swapId: SWAP });
    expect(done).toHaveBeenCalledWith("Swap accepted");
  });

  it("reads Expired and offers no Accept once the swap has run out", () => {
    render(
      <SwapAnswerCard
        swap={{ ...swap, expiresAt: "2020-01-01T00:00:00Z" }}
        serviceId={SERVICE}
        actorId={ME}
        onDone={done}
      />,
    );
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept swap" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
  });

  it("declines", async () => {
    render(<SwapAnswerCard swap={swap} serviceId={SERVICE} actorId={ME} onDone={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    await act(async () => {});
    expect(mocks.post).toHaveBeenCalledWith(SERVICE, { action: "swap.decline", swapId: SWAP });
    expect(done).toHaveBeenCalledWith("Swap declined");
  });
});
