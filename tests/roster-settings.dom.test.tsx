/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHIFT_KIND_LABEL, type ShiftKind } from "@/lib/roster/shift-kind";
import type { OnCallShift } from "@/lib/roster/shifts/model";
import { addDaysToDate, perthWallToIso } from "@/lib/roster/shifts/perth-time";

/*
 * Roster Settings, and Delete my data with a 30-second Undo: nothing is
 * deleted until the 30 seconds end or the page closes. Every roster here is
 * invented ("Example Hospital").
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/roster/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { RosterSettingsPage } from "@/components/roster/roster-settings-page";

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
const day = (date: string) => shift(date, "08:00", "16:30", "day");
const manualWeekly = (date: string, seriesId: string) =>
  shift(date, "09:00", "17:00", "other", { source: "manual", seriesId, workplace: null });

function mockShifts(shifts: OnCallShift[]) {
  routes.set("GET /api/roster/shifts", () => Response.json({ shifts, latestImport: null }));
}
function mockSettings(settings: Record<string, unknown>) {
  routes.set("GET /api/roster/settings", () => Response.json({ settings }));
}
function fetchCalls(url: string, method: string) {
  return fetchMock.mock.calls.filter(([input, init]) => String(input) === url && (init?.method ?? "GET") === method);
}
async function deleteMyData() {
  fireEvent.click(screen.getByRole("button", { name: "Delete my data" }));
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
}

beforeEach(() => {
  routes.clear();
  mockSettings({ calendarShifts: false, rowName: null, codes: {} });
  routes.set("DELETE /api/roster/shifts", () => Response.json({ shifts: [], latestImport: null }));
  routes.set("PUT /api/roster/settings", (init) => Response.json({ settings: JSON.parse(String(init?.body)) }));
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const handler = routes.get(`${init?.method ?? "GET"} ${String(input)}`);
    return handler ? handler(init) : Response.json({});
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Roster Settings", () => {
  it("deletes nothing if Undo is pressed within 30 seconds, and everything after", async () => {
    mockShifts([day("2026-10-12"), manualWeekly("2026-10-14", "series-1")]);
    render(<RosterSettingsPage />);
    await screen.findByText("Example Hospital");
    vi.useFakeTimers();

    await deleteMyData();
    expect(screen.queryByText("Example Hospital")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(fetchCalls("/api/roster/shifts", "DELETE")).toHaveLength(0);
    expect(screen.getByText("Example Hospital")).toBeInTheDocument();

    await deleteMyData();
    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(fetchCalls("/api/roster/shifts", "DELETE")).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(fetchCalls("/api/roster/shifts", "DELETE")).toHaveLength(1);
  });

  it("sends the delete with keepalive if the page closes during the 30 seconds", async () => {
    mockShifts([day("2026-10-12")]);
    render(<RosterSettingsPage />);
    await screen.findByText("Example Hospital");
    vi.useFakeTimers();
    await deleteMyData();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    const calls = fetchCalls("/api/roster/shifts", "DELETE");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toMatchObject({ method: "DELETE", keepalive: true });
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(fetchCalls("/api/roster/shifts", "DELETE")).toHaveLength(1);
  });

  it("turns calendar shifts on through Roster settings and only then offers the evening reminder", async () => {
    mockShifts([]);
    render(<RosterSettingsPage />);
    const reminder = await screen.findByRole("switch", { name: "Remind me the evening before" });
    expect(reminder).toBeDisabled();
    expect(screen.getByText("Turn on Shifts on my calendar link first")).toBeInTheDocument();

    const calendar = screen.getByRole("switch", { name: "Shifts on my calendar link" });
    await waitFor(() => expect(calendar).toBeEnabled());
    fireEvent.click(calendar);
    await waitFor(() => expect(fetchCalls("/api/roster/settings", "PUT")).toHaveLength(1));
    expect(JSON.parse(String(fetchCalls("/api/roster/settings", "PUT")[0]?.[1]?.body))).toEqual({
      calendarShifts: true,
    });
    await waitFor(() => expect(screen.getByRole("switch", { name: "Remind me the evening before" })).toBeEnabled());
  });

  it("lists calendar links by host only, and refreshes or removes one", async () => {
    mockShifts([]);
    routes.set("GET /api/roster/links", () =>
      Response.json({
        links: [{ id: "l1", display: "calendar.example.org/…", workplace: "Example Hospital", failure: "unreachable" }],
      }),
    );
    routes.set("DELETE /api/roster/links", () => Response.json({ deleted: true }));
    render(<RosterSettingsPage />);
    expect(await screen.findByText("calendar.example.org/…")).toBeInTheDocument();
    expect(screen.getByText("That calendar could not be reached.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh calendar.example.org/…" }));
    await waitFor(() => expect(fetchCalls("/api/roster/links/refresh", "POST")).toHaveLength(1));
    expect(JSON.parse(String(fetchCalls("/api/roster/links/refresh", "POST")[0]?.[1]?.body))).toEqual({ id: "l1" });
    fireEvent.click(screen.getByRole("button", { name: "Remove calendar.example.org/…" }));
    await waitFor(() => expect(screen.queryByText("calendar.example.org/…")).toBeNull());
    expect(screen.getByText("Uploaded files are never kept.", { exact: false })).toBeInTheDocument();
  });
});
