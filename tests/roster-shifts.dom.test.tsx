/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHIFT_KIND_LABEL, type ShiftKind } from "@/lib/roster/shift-kind";
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
    await screen.findByText("Removed");
    expect(screen.queryByTestId("roster-shifts-row")).toBeNull();
  });
});
