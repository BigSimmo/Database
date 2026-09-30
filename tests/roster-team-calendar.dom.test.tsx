/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A tiny reactive stand-in for the URL: router.replace updates it and the
// components read it back through useSearchParams, as they do in the app.
const url = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { search: "", params: new URLSearchParams() };
  return {
    state,
    set(search: string) {
      state.search = search;
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

import { RosterTeamPage } from "@/components/roster/team/roster-team-page";

const ME = "11111111-1111-4111-8111-111111111111";
const SAM = "22222222-2222-4222-8222-222222222222";
const TEAM = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-15T00:00:00Z"); // 08:00 Thursday 15 October, Perth

const mine = {
  id: "44444444-4444-4444-8444-444444444444",
  userId: ME,
  name: "Alex Example",
  grade: "registrar",
  siteId: null,
  siteName: "Example Hospital",
  startsAt: "2026-10-15T09:00:00+08:00",
  endsAt: "2026-10-15T17:00:00+08:00",
  shiftCode: "D",
  kind: "day",
};
const sams = {
  id: "55555555-5555-4555-8555-555555555555",
  userId: SAM,
  name: "Dr Sam Example",
  grade: "registrar",
  siteId: null,
  siteName: "Example Hospital",
  startsAt: "2026-10-15T21:30:00+08:00",
  endsAt: "2026-10-16T08:00:00+08:00",
  shiftCode: "N",
  kind: "night",
};
const overview = {
  service: { id: TEAM, name: "Example team" },
  me: { role: "member", grade: "registrar", rotationEndsOn: null },
  latestPublication: null,
  seenLatest: true,
  settings: { rules: {} },
  sites: [],
};

function mockFetch(assignments: unknown[] | "fail" = [mine, sams]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const address = String(input);
    if (address === "/api/roster/team")
      return Response.json({
        actorId: ME,
        teams: [{ serviceId: TEAM, name: "Example team", enabled: true, role: "member", grade: "registrar" }],
      });
    if (address.includes("what=overview")) return Response.json(overview);
    if (address.includes("what=assignments")) {
      if (assignments === "fail") return Response.json({ message: "Roster couldn't be reached." }, { status: 500 });
      return Response.json({ assignments });
    }
    return Response.json({ swaps: [], openShifts: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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

describe("Team calendar", () => {
  it("opens on the Week view with a Month / Week / Day switch", async () => {
    mockFetch();
    render(<RosterTeamPage now={NOW} />);
    const views = await screen.findByRole("radiogroup", { name: "View" });
    const labels = within(views)
      .getAllByRole("radio")
      .map((radio) => radio.textContent);
    expect(labels).toEqual(["Month", "Week", "Day"]);
    expect((within(views).getByRole("radio", { name: "Week" }) as HTMLInputElement).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("writes the chosen view to the URL without adding history", async () => {
    mockFetch();
    render(<RosterTeamPage now={NOW} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Day" }));
    expect(url.replace).toHaveBeenCalledWith("/roster/team?view=day&date=2026-10-15", { scroll: false });
  });

  it("asks for one window of assignments matching the view", async () => {
    const fetchMock = mockFetch();
    url.set("view=day&date=2026-10-15");
    render(<RosterTeamPage now={NOW} />);
    await screen.findByRole("button", { name: /Dr Sam Example/ });
    const reads = fetchMock.mock.calls.map(([input]) => String(input)).filter((item) => item.includes("assignments"));
    expect(reads).toHaveLength(1);
    expect(reads[0]).toContain("from=2026-10-14");
    expect(reads[0]).toContain("to=2026-10-16");
  });

  it("jumps the Day view to a chosen date", async () => {
    mockFetch();
    url.set("view=day&date=2026-10-15");
    render(<RosterTeamPage now={NOW} />);
    fireEvent.change(await screen.findByLabelText("Go to date"), { target: { value: "2026-10-20" } });
    expect(url.replace).toHaveBeenCalledWith("/roster/team?view=day&date=2026-10-20", { scroll: false });
    expect(await screen.findByRole("heading", { name: /20 Oct/ })).toBeTruthy();
  });

  it("steps back beyond a week when the day is far from today", async () => {
    mockFetch();
    url.set("view=day&date=2026-10-01");
    render(<RosterTeamPage now={NOW} />);
    const previous = await screen.findByRole("button", { name: "Previous day" });
    expect((previous as HTMLButtonElement).disabled).toBe(false);
  });

  it("hides other people when Just me is chosen", async () => {
    mockFetch();
    url.set("view=day&date=2026-10-15");
    render(<RosterTeamPage now={NOW} />);
    expect(await screen.findByRole("button", { name: /Dr Sam Example/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Just me" }));
    expect(url.replace).toHaveBeenCalledWith("/roster/team?view=day&date=2026-10-15&show=me", { scroll: false });
    expect(screen.queryByRole("button", { name: /Dr Sam Example/ })).toBeNull();
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("shows Try again after a failed read, not an empty calendar", async () => {
    mockFetch("fail");
    url.set("view=day&date=2026-10-15");
    render(<RosterTeamPage now={NOW} />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("Appears once your manager adds you.")).toBeNull();
  });

  it("opens my own future shift with Swap and Give away", async () => {
    mockFetch();
    url.set("view=day&date=2026-10-15");
    render(<RosterTeamPage now={NOW} />);
    fireEvent.click(await screen.findByRole("button", { name: /You.*09:00–17:00/ }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: "Swap" })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: "Give away" })).toBeTruthy();
  });

  it("offers no Swap or Give away on someone else's shift", async () => {
    mockFetch();
    url.set("view=day&date=2026-10-15");
    render(<RosterTeamPage now={NOW} />);
    fireEvent.click(await screen.findByRole("button", { name: /Dr Sam Example/ }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(/21:30–08:00 \+1/)).toBeTruthy();
    expect(within(sheet).queryByRole("button", { name: "Swap" })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Give away" })).toBeNull();
  });

  it("offers no Swap or Give away on my own shift once it has started", async () => {
    mockFetch();
    url.set("view=day&date=2026-10-15");
    render(<RosterTeamPage now={new Date("2026-10-15T03:00:00Z")} />);
    fireEvent.click(await screen.findByRole("button", { name: /You.*09:00–17:00/ }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).queryByRole("button", { name: "Swap" })).toBeNull();
  });

  it("shows the Week view as a board with me first and a sticky names column", async () => {
    mockFetch();
    render(<RosterTeamPage now={NOW} />);
    const board = await screen.findByRole("table", { name: "Week roster" });
    const names = within(board)
      .getAllByRole("rowheader")
      .map((header) => header.textContent);
    expect(names[0]).toMatch(/^You/);
    expect(names[1]).toMatch(/Dr Sam Example/);
    expect(within(board).getAllByRole("rowheader")[0].className).toContain("sticky left-0");
    expect(board.parentElement?.className).toContain("overflow-x-auto");
    expect(within(board).getByRole("button", { name: /Dr Sam Example.*Night.*21:30–08:00 \+1/ })).toBeTruthy();
  });

  it("opens the shift sheet from a board cell", async () => {
    mockFetch();
    render(<RosterTeamPage now={NOW} />);
    fireEvent.click(await screen.findByRole("button", { name: /You.*Day.*09:00–17:00/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("Compare shows exactly two rows: me and the chosen colleague", async () => {
    const third = {
      ...sams,
      id: "66666666-6666-4666-8666-666666666666",
      userId: "77777777-7777-4777-8777-777777777777",
      name: "Pat Example",
    };
    mockFetch([mine, sams, third]);
    url.set(`show=compare:${SAM}`);
    render(<RosterTeamPage now={NOW} />);
    const board = await screen.findByRole("table", { name: "Week roster" });
    const headers = within(board)
      .getAllByRole("rowheader")
      .map((header) => header.textContent ?? "");
    expect(headers).toHaveLength(2);
    expect(headers[0]).toMatch(/^You/);
    expect(headers[1]).toMatch(/Dr Sam Example/);
  });

  it("Compare still shows the colleague's row when they have no shifts that week", async () => {
    mockFetch([mine]);
    url.set(`show=compare:${SAM}`);
    render(<RosterTeamPage now={NOW} />);
    const board = await screen.findByRole("table", { name: "Week roster" });
    expect(within(board).getAllByRole("rowheader")).toHaveLength(2);
  });

  it("marks the cell of a shift in my own pending swap", async () => {
    const fetchMock = mockFetch();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("what=requests"))
        return Response.json({
          openShifts: [],
          swaps: [
            {
              id: "88888888-8888-4888-8888-888888888888",
              status: "requested",
              autoApproved: false,
              needsManagerBecause: null,
              cancelReason: null,
              requesterId: ME,
              counterpartyId: SAM,
              give: mine,
              take: sams,
              expiresAt: "2026-10-20T00:00:00Z",
              createdAt: "2026-10-14T00:00:00Z",
              decidedAt: null,
            },
          ],
        });
      return base(input);
    });
    render(<RosterTeamPage now={NOW} />);
    const cell = await screen.findByRole("button", { name: /You.*Day.*09:00–17:00/ });
    await vi.waitFor(() => expect(cell.getAttribute("data-pending-swap")).toBe("true"));
    expect(screen.getByRole("button", { name: /Dr Sam Example.*Night/ }).getAttribute("data-pending-swap")).toBe(
      "true",
    );
  });

  it("shows open shifts in an amber row labelled Open shift", async () => {
    const fetchMock = mockFetch();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("what=requests"))
        return Response.json({
          swaps: [],
          openShifts: [
            {
              id: "99999999-9999-4999-8999-999999999999",
              status: "open",
              urgent: false,
              startsAt: "2026-10-16T09:00:00+08:00",
              endsAt: "2026-10-16T17:00:00+08:00",
              shiftCode: "D",
              kind: "day",
              minGrade: null,
              siteId: null,
              mine: false,
              claimedByMe: false,
            },
          ],
        });
      return base(input);
    });
    render(<RosterTeamPage now={NOW} />);
    const cell = await screen.findByText("Open shift");
    expect(cell.closest("[data-open-shift]")?.className).toContain("--warning");
    expect(screen.getByRole("rowheader", { name: /Open shifts/ })).toBeTruthy();
  });

  it("writes nothing to the device", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mockFetch();
    render(<RosterTeamPage now={NOW} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Day" }));
    fireEvent.click(await screen.findByRole("radio", { name: "Just me" }));
    expect(setItem).not.toHaveBeenCalled();
  });
});
