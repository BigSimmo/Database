/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHIFT_KIND_LABEL, type ShiftKind } from "@/lib/roster/shift-kind";
import type { OnCallShift } from "@/lib/roster/shifts/model";
import { addDaysToDate, perthWallToIso } from "@/lib/roster/shifts/perth-time";

/*
 * Roster Today. Every roster here is invented ("Example Hospital").
 * `fetch` is mocked per route; the clock is pinned through the `now` prop.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/roster",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { RosterTodayPage } from "@/components/roster/roster-today-page";

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
function mockLinks(links: unknown[]) {
  routes.set("GET /api/roster/links", () => Response.json({ links }));
}

function renderToday(now = "2026-10-13T02:00:00Z") {
  return render(<RosterTodayPage now={new Date(now)} />);
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
});

describe("Roster Today", () => {
  it("leads a day off with the next shift", async () => {
    mockShifts([night("2026-10-15")]);
    renderToday("2026-10-13T02:00:00Z");
    expect(await screen.findByText(/Thu 15 Oct/)).toBeInTheDocument();
    expect(screen.getByText("21:30")).toBeInTheDocument();
    expect(screen.getByTestId("roster-today-hero")).toHaveTextContent("Day off");
  });

  it("shows the empty state with both ways in", async () => {
    mockShifts([]);
    renderToday();
    expect(await screen.findByRole("button", { name: "Import a file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a shift" })).toBeInTheDocument();
    expect(screen.getByText("In a hospital team? Your roster manager will invite you.")).toBeInTheDocument();
  });

  it("opens the import flow and the add-a-shift sheet from the empty state", async () => {
    mockShifts([]);
    renderToday();
    fireEvent.click(await screen.findByRole("button", { name: "Import a file" }));
    expect(await screen.findByTestId("roster-import-flow")).toHaveTextContent("Step 1 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add a shift" }));
    expect(await screen.findByTestId("roster-add-shift-form")).toBeInTheDocument();
  });

  it("counts down before a shift that starts today and draws the week as letters", async () => {
    mockShifts([day("2026-10-13"), night("2026-10-15")]);
    renderToday("2026-10-12T23:05:00Z"); // 07:05 Tuesday in Perth
    const hero = await screen.findByTestId("roster-today-hero");
    expect(hero).toHaveTextContent("Day · Example Hospital");
    expect(hero).toHaveTextContent("Starts in 55 min");
    const strip = screen.getByTestId("roster-today-week-strip");
    expect(strip.querySelectorAll("[data-kind]")).toHaveLength(2);
    expect(screen.getByLabelText("Thu 15 Oct: Night")).toBeInTheDocument();
    expect(screen.getByTestId("roster-today-next-night")).toHaveTextContent("Thu 15 Oct");
  });

  it("turns into the night dial between midnight and 06:00 on a night", async () => {
    mockShifts([night("2026-10-15")]);
    renderToday("2026-10-15T19:12:00Z"); // 03:12 Friday in Perth
    const dial = await screen.findByTestId("roster-night-dial");
    expect(screen.getByTestId("roster-night-dial-left")).toHaveTextContent("4 h 48 min");
    expect(dial).toHaveTextContent("left · ends 08:00");
    expect(screen.queryByTestId("roster-today-hero")).toBeNull();
  });

  it("shows the green Up to date only while a calendar link refreshed in the last six hours", async () => {
    mockShifts([night("2026-10-15")]);
    mockLinks([{ id: "l1", display: "calendar.example.org/…", refreshedAt: "2026-10-12T22:00:00Z", failure: null }]);
    const { unmount } = renderToday("2026-10-13T02:00:00Z");
    expect(await screen.findByTestId("roster-fresh")).toHaveTextContent("Up to date");
    unmount();
    mockLinks([{ id: "l1", display: "calendar.example.org/…", refreshedAt: "2026-10-12T10:00:00Z", failure: null }]);
    renderToday("2026-10-13T02:00:00Z");
    await screen.findByText(/Thu 15 Oct/);
    expect(screen.queryByTestId("roster-fresh")).toBeNull();
  });

  it("asks a signed-out reader to sign in and offers no import", async () => {
    routes.set("GET /api/roster/shifts", () => Response.json({ error: "Sign in" }, { status: 401 }));
    renderToday();
    expect(await screen.findByTestId("roster-today-signed-out")).toHaveTextContent("Sign in to see your roster.");
    expect(screen.queryByRole("button", { name: "Import a file" })).toBeNull();
  });
});
