/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHIFT_KIND_LABEL, type ShiftKind } from "@/lib/roster/shift-kind";
import { monthGridRange } from "@/lib/calendar/month-grid";
import type { OnCallShift } from "@/lib/roster/shifts/model";
import { addDaysToDate, perthWallToIso } from "@/lib/roster/shifts/perth-time";

/*
 * Roster Shifts: Week, Month and Hours, and the "+ Add" sheet. Every roster
 * here is invented ("Example Hospital", "Dr Alex Example").
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/roster/shifts",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { RosterShiftsPage } from "@/components/roster/roster-shifts-page";

type Handler = (init?: RequestInit) => Response | Promise<Response>;
const routes = new Map<string, Handler>();
let fetchMock: ReturnType<typeof vi.fn>;

function shift(
  date: string,
  start: string,
  end: string,
  kind: ShiftKind,
  extra: Partial<OnCallShift> = {},
): OnCallShift {
  return {
    id: `${kind}-${date}`,
    startsAt: perthWallToIso(date, start)!,
    endsAt: perthWallToIso(end > start ? date : addDaysToDate(date, 1), end)!,
    title: SHIFT_KIND_LABEL[kind],
    location: null,
    sourceUid: null,
    kind,
    source: "import",
    seriesId: null,
    workplace: "Example Hospital",
    ...extra,
  };
}
const night = (date: string) => shift(date, "21:30", "08:00", "night");
const day = (date: string) => shift(date, "08:00", "16:30", "day");

function mockShifts(shifts: OnCallShift[]) {
  routes.set("GET /api/roster/shifts", () => Response.json({ shifts, latestImport: null }));
}
function mockSettings(settings: Record<string, unknown>) {
  routes.set("GET /api/roster/settings", () => Response.json({ settings }));
}
function mockTeamWindow(from: string, to: string, dates: string[], sample = false) {
  const teamId = "22222222-2222-4222-8222-222222222222";
  const actorId = "11111111-1111-4111-8111-111111111111";
  routes.set("GET /api/roster/team", () =>
    Response.json({
      actorId,
      teams: [{ serviceId: teamId, name: "General Medicine", enabled: true, role: "member", grade: "registrar" }],
      ...(sample ? { sample: true } : {}),
    }),
  );
  const url = `/api/roster/team/${teamId}?what=assignments&from=${from}&to=${to}`;
  routes.set(`GET ${url}`, () =>
    Response.json({
      assignments: dates.map((date, index) => ({
        id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, "0")}`,
        userId: actorId,
        name: "Dr Alex Example",
        grade: "registrar",
        siteId: null,
        siteName: "Example Hospital",
        startsAt: `${date}T08:00:00+08:00`,
        endsAt: `${date}T16:30:00+08:00`,
        shiftCode: "D",
        kind: "day",
      })),
    }),
  );
  return url;
}
function fetchCalls(url: string, method: string) {
  return fetchMock.mock.calls.filter(([input, init]) => String(input) === url && (init?.method ?? "GET") === method);
}

beforeEach(() => {
  routes.clear();
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const handler = routes.get(`${init?.method ?? "GET"} ${String(input)}`);
    return handler ? handler(init) : Response.json({});
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Roster Shifts", () => {
  it("loads the newly selected week before saying it has no team shifts", async () => {
    mockShifts([]);
    mockTeamWindow("2026-10-12", "2026-10-18", []);
    const nextUrl = mockTeamWindow("2026-10-19", "2026-10-25", ["2026-10-20"]);
    render(<RosterShiftsPage now={new Date("2026-10-13T02:00:00Z")} />);
    await screen.findByText("No shifts this week");
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.queryByText("No shifts this week")).toBeNull();
    await waitFor(() => expect(fetchCalls(nextUrl, "GET")).toHaveLength(1));
    expect(await screen.findByText("Tue 20 Oct")).toBeInTheDocument();
  });

  it("never puts a sample team's invented shifts into the doctor's own roster", async () => {
    mockShifts([]);
    const url = mockTeamWindow("2026-10-12", "2026-10-18", ["2026-10-13"], true);
    render(<RosterShiftsPage now={new Date("2026-10-13T02:00:00Z")} />);
    await screen.findByText("No shifts this week");
    expect(fetchCalls(url, "GET")).toHaveLength(0);
    expect(screen.queryByText("Tue 13 Oct")).toBeNull();
  });

  it("stops going back once the previous week is outside the loaded history", async () => {
    mockShifts([]);
    for (const [from, to] of [
      ["2026-10-12", "2026-10-18"],
      ["2026-10-05", "2026-10-11"],
      ["2026-09-28", "2026-10-04"],
      ["2026-09-21", "2026-09-27"],
    ])
      mockTeamWindow(from, to, []);
    render(<RosterShiftsPage now={new Date("2026-10-13T02:00:00Z")} />);
    await screen.findByText("No shifts this week");
    const previous = () => screen.findByRole("button", { name: "Previous week" });
    for (let step = 0; step < 3; step += 1) {
      const button = await previous();
      expect(button).toBeEnabled();
      fireEvent.click(button);
    }
    expect(await previous()).toBeDisabled();
  });

  it("loads the newly selected month before displaying its team shifts", async () => {
    mockShifts([]);
    mockTeamWindow("2026-10-12", "2026-10-18", []);
    const october = monthGridRange("2026-10");
    const octoberUrl = mockTeamWindow(october.start, october.end, []);
    const november = monthGridRange("2026-11");
    const nextUrl = mockTeamWindow(november.start, november.end, ["2026-11-10"]);
    render(<RosterShiftsPage now={new Date("2026-10-13T02:00:00Z")} />);
    await screen.findByText("No shifts this week");
    fireEvent.click(screen.getByRole("radio", { name: "Month" }));
    await waitFor(() => expect(fetchCalls(octoberUrl, "GET")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId("roster-team-shifts-loading")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await waitFor(() => expect(fetchCalls(nextUrl, "GET")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId("roster-team-shifts-loading")).toBeNull());
    expect(screen.getByTestId("roster-shifts-month")).toHaveTextContent("D · Day");
  });

  it("shows a night as +1 in the week", async () => {
    mockShifts([night("2026-10-15")]);
    render(<RosterShiftsPage now={new Date("2026-10-13T02:00:00Z")} />);
    expect(await screen.findByText(/08:00\s*\+1/)).toBeInTheDocument();
    const row = screen.getByTestId("roster-shifts-row");
    expect(row).toHaveTextContent("Thu 15 Oct");
    expect(row).toHaveTextContent("Night · Example Hospital");
    expect(screen.getByRole("heading", { name: /12–18 Oct · 10\.5\sh/ })).toBeInTheDocument();
  });

  it("stores nothing about the doctor's roster on the device", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mockShifts([night("2026-10-15")]);
    mockSettings({
      rowName: "Dr Alex Example",
      codes: { "Example Hospital": { ADO: { kind: "off" } } },
      calendarShifts: true,
    });
    render(<RosterShiftsPage now={new Date("2026-10-13T02:00:00Z")} />);
    // The shared segmented control is a radio group, so the views are radios, not tabs.
    await screen.findByRole("radio", { name: "Week" });
    await screen.findByText(/08:00\s*\+1/);
    fireEvent.click(screen.getByRole("radio", { name: "Month" }));
    fireEvent.click(screen.getByRole("radio", { name: "Hours" }));
    await screen.findByTestId("roster-hours");
    const written = setItem.mock.calls.map(([key, value]) => `${key}=${value}`).join("\n");
    expect(written).not.toMatch(/Alex Example|Example Hospital|ADO|21:30|2026-10/);
  });

  it("shows the fortnight's rostered hours and logs a late finish with one tap", async () => {
    // Monday 12 Oct day shift finished at 16:30; it is now 17:45 Perth.
    mockShifts([day("2026-10-12"), night("2026-10-15")]);
    routes.set("POST /api/roster/extra-time", () => Response.json({ saved: true }));
    render(<RosterShiftsPage now={new Date("2026-10-12T09:45:00Z")} />);
    await screen.findByText(/08:00\s*\+1/);
    fireEvent.click(screen.getByRole("radio", { name: "Hours" }));
    const hours = await screen.findByTestId("roster-hours");
    expect(hours).toHaveTextContent("19 h rostered, not pay");
    expect(within(hours).getByTestId("roster-hours-claim-link")).toHaveAttribute("href", "/my-work");

    fireEvent.click(screen.getByRole("button", { name: "Stayed late" }));
    await screen.findByText("Saved");
    const [call] = fetchCalls("/api/roster/extra-time", "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      kind: "stayed_late",
      startedAt: "2026-10-12T08:30:00.000Z",
      endedAt: "2026-10-12T09:45:00.000Z",
    });
    expect(screen.getByRole("button", { name: "Stayed late" })).toBeDisabled();
    expect(within(screen.getByTestId("roster-hours-facts")).getByText("1.25 h")).toBeInTheDocument();
    // Extra time is never read back, so the tile says it covers this visit only.
    expect(screen.getByTestId("roster-hours-facts")).toHaveTextContent("Extra time recorded this visit");
  });

  it("reads a new calendar link straight away, and shows the new shifts", async () => {
    mockShifts([]);
    routes.set("POST /api/roster/links", () =>
      Response.json({
        link: {
          id: "new-link",
          workplace: "Example Hospital",
          hostPreview: "calendar.example.org/…",
          lastFetchedAt: null,
          lastError: null,
          createdAt: "2026-10-13T02:00:00Z",
        },
      }),
    );
    routes.set("POST /api/roster/links/refresh", () => {
      mockShifts([night("2026-10-15")]);
      return Response.json({ results: [{ id: "new-link", ok: true }] });
    });
    render(<RosterShiftsPage now={new Date("2026-10-13T02:00:00Z")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    fireEvent.click(await screen.findByRole("button", { name: /Add a calendar link/ }));
    fireEvent.change(screen.getByLabelText("Calendar link"), {
      target: { value: "https://calendar.example.org/feed.ics" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(await screen.findByText(/08:00\s*\+1/)).toBeInTheDocument();
    const refreshes = fetchCalls("/api/roster/links/refresh", "POST");
    expect(refreshes).toHaveLength(1);
    expect(JSON.parse(String(refreshes[0]?.[1]?.body))).toEqual({ id: "new-link" });
  });

  it("says plainly when a workplace already has a calendar link", async () => {
    mockShifts([]);
    routes.set("POST /api/roster/links", () =>
      Response.json({ error: "Duplicate", code: "duplicate_workplace" }, { status: 409 }),
    );
    render(<RosterShiftsPage now={new Date("2026-10-13T02:00:00Z")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    fireEvent.click(await screen.findByRole("button", { name: /Add a calendar link/ }));
    fireEvent.change(screen.getByLabelText("Calendar link"), {
      target: { value: "https://calendar.example.org/feed.ics" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(await screen.findByText("You already have a calendar link for that workplace.")).toBeInTheDocument();
    expect(fetchCalls("/api/roster/links/refresh", "POST")).toHaveLength(0);
  });

  it("adds a shift by hand that repeats weekly", async () => {
    mockShifts([]);
    routes.set("POST /api/roster/shifts/manual", () => Response.json({ shifts: [] }));
    render(<RosterShiftsPage now={new Date("2026-10-13T02:00:00Z")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    fireEvent.click(await screen.findByRole("button", { name: /Add a shift/ }));
    fireEvent.change(screen.getByLabelText("Shift"), { target: { value: "evening" } });
    fireEvent.change(screen.getByLabelText("Repeat weekly"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shift" }));
    await waitFor(() => expect(fetchCalls("/api/roster/shifts/manual", "POST")).toHaveLength(1));
    const body = JSON.parse(String(fetchCalls("/api/roster/shifts/manual", "POST")[0]?.[1]?.body));
    expect(body).toEqual({
      shift: {
        startsAt: "2026-10-13T06:00:00.000Z",
        endsAt: "2026-10-13T14:30:00.000Z",
        title: "Evening",
        location: null,
        sourceUid: null,
        kind: "evening",
      },
      repeatWeeks: 3,
    });
  });

  it("removes a hand-added shift with its weekly repeats", async () => {
    const series = "44444444-4444-4444-8444-444444444444";
    mockShifts([
      shift("2026-10-14", "09:00", "17:00", "other", { source: "manual", seriesId: series, workplace: null }),
    ]);
    routes.set(`DELETE /api/roster/shifts/manual/${series}`, () => Response.json({ deleted: true }));
    render(<RosterShiftsPage now={new Date("2026-10-13T02:00:00Z")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Other work on Wed 14 Oct and its repeats" }));
    // It asks first, naming what goes, and removes nothing until confirmed.
    expect(fetchCalls(`/api/roster/shifts/manual/${series}`, "DELETE")).toHaveLength(0);
    expect(screen.getByTestId("confirm-dialog")).toHaveTextContent("every weekly repeat of it");
    fireEvent.click(screen.getByRole("button", { name: "Remove shift and repeats" }));
    await screen.findByText("Removed");
    expect(screen.queryByTestId("roster-shifts-row")).toBeNull();
  });
});
