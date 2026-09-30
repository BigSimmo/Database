/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A tiny reactive stand-in for the URL, as in the staff calendar test.
const url = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { params: new URLSearchParams() };
  return {
    state,
    set(search: string) {
      state.params = new URLSearchParams(search);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replace: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/roster/team",
  useRouter: () => ({ push: vi.fn(), replace: url.replace, back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () =>
    useSyncExternalStore(
      url.subscribe,
      () => url.state.params,
      () => url.state.params,
    ),
}));
vi.mock("@/components/roster/ask/roster-ask-box", () => ({ RosterAskBox: () => null }));

import { approveAllWithoutWarnings } from "@/components/roster/team/calendar/needs-you-strip";
import { RosterTeamPage } from "@/components/roster/team/roster-team-page";
import type { RosterManageSwap } from "@/lib/roster/team/model";
import type { RuleFlag } from "@/lib/roster/team/rule-flags";

const ME = "11111111-1111-4111-8111-111111111111";
const SAM = "22222222-2222-4222-8222-222222222222";
const TEAM = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-15T00:00:00Z"); // 08:00 Thursday 15 October, Perth

const shift = (id: string, userId: string, name: string, kind: string, code: string, start: string, end: string) => ({
  id,
  userId,
  name,
  grade: "registrar",
  siteId: null,
  siteName: "Example Hospital",
  startsAt: start,
  endsAt: end,
  shiftCode: code,
  kind,
});
const ID = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
const mine = shift(ID(1), ME, "Alex Example", "day", "D", "2026-10-15T09:00:00+08:00", "2026-10-15T17:00:00+08:00");
const samThursdayNight = shift(
  ID(2),
  SAM,
  "Dr Sam Example",
  "night",
  "N",
  "2026-10-15T21:30:00+08:00",
  "2026-10-16T08:00:00+08:00",
);
const samFridayNight = shift(
  ID(3),
  SAM,
  "Dr Sam Example",
  "night",
  "N",
  "2026-10-16T21:30:00+08:00",
  "2026-10-17T08:00:00+08:00",
);
const meFriday = shift(ID(4), ME, "Alex Example", "day", "D", "2026-10-16T09:00:00+08:00", "2026-10-16T17:00:00+08:00");

const need = (n: number, weekday: number, kind: string, needed: number) => ({
  id: ID(100 + n),
  weekday,
  date: null,
  kind,
  grade: null,
  siteId: null,
  needed,
});

const swap = (id: string, give: unknown, take: unknown, over: Record<string, unknown> = {}) => ({
  id,
  status: "accepted",
  autoApproved: false,
  needsManagerBecause: "within_7_days",
  requesterId: SAM,
  counterpartyId: ME,
  give,
  take,
  decidedAt: null,
  requesterName: "Dr Sam Example",
  counterpartyName: "Alex Example",
  ...over,
});

type Options = {
  role?: "manager" | "member";
  rules?: Record<string, unknown>;
  assignments?: unknown[];
  needs?: unknown[];
  swaps?: unknown[];
  openShifts?: unknown[];
  makerFails?: boolean;
  refuse?: Set<string>;
};

function mockFetch(options: Options = {}) {
  const role = options.role ?? "manager";
  const posts: unknown[] = [];
  const reads: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const address = String(input);
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { swapId?: string };
      posts.push(body);
      if (body.swapId && options.refuse?.has(body.swapId))
        return Response.json({ code: "roster_conflict", message: "That shift has already changed." }, { status: 409 });
      return Response.json({ result: { ok: true, status: "approved" } });
    }
    if (address === "/api/roster/team")
      return Response.json({
        actorId: ME,
        teams: [{ serviceId: TEAM, name: "Example team", enabled: true, role, grade: "registrar" }],
      });
    reads.push(address);
    if (address.includes("what=overview"))
      return Response.json({
        service: { id: TEAM, name: "Example team" },
        me: { role, grade: "registrar", rotationEndsOn: null },
        latestPublication: null,
        seenLatest: true,
        settings: { swapApproval: "manager", rules: options.rules ?? {}, rulesSource: null, payFortnightAnchor: null },
        sites: [],
      });
    if (address.includes("what=assignments"))
      return Response.json({ assignments: options.assignments ?? [mine, samThursdayNight] });
    if (address.includes("what=maker")) {
      if (options.makerFails) return Response.json({ message: "Roster couldn't be reached." }, { status: 500 });
      return Response.json({ codes: [], needs: options.needs ?? [], drafts: [] });
    }
    if (address.includes("what=manage"))
      return Response.json({ swaps: options.swaps ?? [], openShifts: options.openShifts ?? [], seen: null });
    return Response.json({ swaps: [], openShifts: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, posts, reads };
}

beforeEach(() => {
  url.replace.mockReset();
  url.replace.mockImplementation((target: string) => act(() => url.set(target.split("?")[1] ?? "")));
  url.set("");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Team calendar, manager layer", () => {
  it("shows a member no strip, no counts and makes no manager reads", async () => {
    const { reads } = mockFetch({ role: "member", needs: [need(1, 4, "night", 2)] });
    render(<RosterTeamPage now={NOW} />);
    await screen.findByRole("table", { name: "Week roster" });
    expect(screen.queryByRole("region", { name: "Needs you" })).toBeNull();
    expect(screen.queryByText(/Nights 1 of 2/)).toBeNull();
    expect(reads.some((address) => address.includes("what=manage") || address.includes("what=maker"))).toBe(false);
  });

  it("shows a manager 'Nights 1 of 2' in red on a short day", async () => {
    mockFetch({ needs: [need(1, 4, "night", 2)] });
    render(<RosterTeamPage now={NOW} />);
    const count = await screen.findByText("Nights 1 of 2");
    expect(count.getAttribute("data-cover")).toBe("short");
    expect(count.className).toContain("--danger");
    // The short day is also offered in the strip.
    const strip = await screen.findByRole("region", { name: "Needs you" });
    expect(within(strip).getByRole("button", { name: /Thu 15 Oct/ })).toBeTruthy();
  });

  it("shows counts in each Month cell for a manager", async () => {
    mockFetch({ needs: [need(1, 4, "night", 2)] });
    url.set("view=month&date=2026-10-15");
    const { container } = render(<RosterTeamPage now={NOW} />);
    await screen.findByRole("grid");
    const cell = container.querySelector<HTMLElement>('[data-date="2026-10-15"]')!;
    await waitFor(() => expect(within(cell).getByText("Nights 1 of 2")).toBeTruthy());
    expect(cell.querySelector("[data-cover]")?.getAttribute("data-cover")).toBe("short");
  });

  it("lists a pending swap in the strip with Approve and Decline, and sends the decision", async () => {
    const { posts } = mockFetch({ swaps: [swap(ID(50), samThursdayNight, mine)] });
    render(<RosterTeamPage now={NOW} />);
    const strip = await screen.findByRole("region", { name: "Needs you" });
    expect(within(strip).getByText(/Swap · Dr Sam Example and Alex Example/)).toBeTruthy();
    expect(within(strip).getByText("Needs you because it's within 7 days")).toBeTruthy();
    fireEvent.click(within(strip).getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(posts).toEqual([{ action: "swap.decline", swapId: ID(50) }]));
    expect(within(strip).getByRole("button", { name: "Approve" })).toBeTruthy();
  });

  it("lists a taken open shift for approval", async () => {
    const { posts } = mockFetch({
      openShifts: [
        {
          id: ID(60),
          status: "claimed",
          urgent: false,
          startsAt: "2026-10-16T09:00:00+08:00",
          endsAt: "2026-10-16T17:00:00+08:00",
          shiftCode: "D",
          kind: "day",
          minGrade: null,
          siteId: null,
          postedBy: ME,
          claimedBy: SAM,
          claimedAt: "2026-10-14T00:00:00Z",
        },
      ],
    });
    render(<RosterTeamPage now={NOW} />);
    const strip = await screen.findByRole("region", { name: "Needs you" });
    expect(within(strip).getByText(/Day on Fri 16 Oct was taken/)).toBeTruthy();
    fireEvent.click(within(strip).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(posts).toEqual([{ action: "open.approve", openShiftId: ID(60) }]));
  });

  it("marks a shift that breaks a team rule and explains it in the shift sheet", async () => {
    mockFetch({ rules: { maxNightsInRow: 1 }, assignments: [mine, samThursdayNight, samFridayNight] });
    render(<RosterTeamPage now={NOW} />);
    const flagged = await screen.findByRole("button", { name: /Dr Sam Example, Night.*2nd night in a row/ });
    expect(flagged.getAttribute("data-flagged")).toBe("true");
    fireEvent.click(flagged);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("Rule warnings")).toBeTruthy();
    expect(within(sheet).getByText("2nd night in a row (team limit 1)")).toBeTruthy();
  });

  it("offers a manager 'Offer to the team' on an upcoming shift", async () => {
    const { posts } = mockFetch();
    render(<RosterTeamPage now={NOW} />);
    fireEvent.click(await screen.findByRole("button", { name: /Dr Sam Example, Night/ }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "Offer to the team" }));
    await waitFor(() => expect(posts).toEqual([{ action: "open.post", assignmentId: samThursdayNight.id }]));
    expect(await within(sheet).findByText("Offered to the team.")).toBeTruthy();
  });

  it("'Approve all without warnings' skips a flagged swap and reports a server refusal", async () => {
    const flaggedSwap = swap(ID(51), samFridayNight, mine);
    const refusedSwap = swap(ID(52), meFriday, samThursdayNight, { requesterId: ME, counterpartyId: SAM });
    const cleanSwap = swap(
      ID(53),
      shift(ID(5), SAM, "Dr Sam Example", "day", "D", "2026-10-17T09:00:00+08:00", "2026-10-17T17:00:00+08:00"),
      null,
    );
    const { posts } = mockFetch({
      rules: { maxNightsInRow: 1 },
      assignments: [mine, samThursdayNight, samFridayNight, meFriday],
      swaps: [flaggedSwap, refusedSwap, cleanSwap],
      refuse: new Set([ID(52)]),
    });
    render(<RosterTeamPage now={NOW} />);
    const strip = await screen.findByRole("region", { name: "Needs you" });
    // Wait for the rule flags, which come from a separate read.
    await screen.findByRole("button", { name: /2nd night in a row/ });
    fireEvent.click(within(strip).getByRole("button", { name: "Approve all without warnings" }));
    expect(
      await within(strip).findByText("Approved 1. 1 left for you to read because a shift has a rule warning."),
    ).toBeTruthy();
    expect(within(strip).getByRole("alert").textContent).toContain("That shift has already changed.");
    // The flagged swap is never sent; the other two go one after the other.
    expect(posts).toEqual([
      { action: "swap.approve", swapId: ID(52) },
      { action: "swap.approve", swapId: ID(53) },
    ]);
  });

  it("hides counts and the strip when the maker read fails, and the staff calendar still works", async () => {
    mockFetch({ makerFails: true, needs: [need(1, 4, "night", 2)], swaps: [swap(ID(50), samThursdayNight, mine)] });
    render(<RosterTeamPage now={NOW} />);
    const board = await screen.findByRole("table", { name: "Week roster" });
    expect(within(board).getByRole("button", { name: /Dr Sam Example, Night/ })).toBeTruthy();
    // Give the failed read time to settle, then check nothing manager-only appeared.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("region", { name: "Needs you" })).toBeNull();
    expect(screen.queryByText(/Nights 1 of 2/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows no counts for a team with no targets", async () => {
    mockFetch({ needs: [] });
    render(<RosterTeamPage now={NOW} />);
    await screen.findByRole("table", { name: "Week roster" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/ of \d/)).toBeNull();
  });
});

describe("approveAllWithoutWarnings", () => {
  const item = (id: string, giveId: string): RosterManageSwap =>
    swap(id, { ...mine, id: giveId }, null) as unknown as RosterManageSwap;
  const flag: RuleFlag = { assignmentId: ID(11), rule: "maxNightsInRow", words: "2nd night in a row" };

  it("sends swap.approve one at a time, skipping flagged swaps and collecting refusals", async () => {
    const order: string[] = [];
    let running = 0;
    const post = vi.fn(async (action: { action: string; swapId?: string }) => {
      running += 1;
      expect(running).toBe(1);
      order.push(action.swapId ?? "");
      await Promise.resolve();
      running -= 1;
      return action.swapId === ID(72)
        ? ({ ok: false, code: "roster_conflict", message: "Refused." } as const)
        : ({ ok: true, result: { ok: true } } as const);
    });
    const outcome = await approveAllWithoutWarnings(
      [item(ID(70), ID(11)), item(ID(71), ID(12)), item(ID(72), ID(13)), item(ID(73), ID(14))],
      new Map([[ID(11), [flag]]]),
      post,
    );
    expect(order).toEqual([ID(71), ID(72), ID(73)]);
    expect(outcome).toEqual({ approved: 2, refused: [{ id: ID(72), message: "Refused." }] });
  });
});
