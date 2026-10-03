/** @vitest-environment jsdom */

// My Day's small modules: each shows its content, and draws nothing (no box) when
// signed out, loading, failed or empty.

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const roster = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/components/roster/use-roster-shifts", () => ({ useRosterShifts: () => roster.current }));

const entries = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/lib/on-call/entry-store", () => ({ useOnCallEntries: () => entries.current }));

vi.mock("@/components/admin/admin-pinned-numbers", () => ({
  AdminPinnedNumbers: ({ items, testId }: { items: unknown[]; testId: string }) => (
    <div data-testid={testId}>{items.length}</div>
  ),
}));

const teaching = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/components/teaching/use-teaching-resource", () => ({ useTeachingResource: () => teaching.current }));

const auth = vi.hoisted(() => ({ status: "authenticated", authEpoch: 1 }));
vi.mock("@/lib/supabase/client", () => ({ useAuthSession: () => auth }));

import { MyDayCpdPace } from "@/components/my-day/modules/cpd-pace";
import { MyDayNextShift } from "@/components/my-day/modules/next-shift";
import { MyDayNextTeaching } from "@/components/my-day/modules/next-teaching";
import { MyDayOnCallShortcuts } from "@/components/my-day/modules/on-call-shortcuts";
import { MyDayPinnedNumbers } from "@/components/my-day/modules/pinned-numbers";

// 09:00 on Sat 26 Sep 2026 in Perth.
const NOW = new Date("2026-09-26T01:00:00Z");

function shift(startsAt: string, endsAt: string, extra: Record<string, unknown> = {}) {
  return { id: "s1", title: "Night shift", startsAt, endsAt, location: null, workplace: "Example Hospital", ...extra };
}

beforeEach(() => {
  auth.authEpoch = 1;
  roster.current = { status: "ready", shifts: [], sample: false, demoMode: false };
  entries.current = {
    loading: false,
    isOffline: false,
    loadError: null,
    signedOut: false,
    entries: [],
    demoMode: false,
  };
  teaching.current = { status: "idle", data: null };
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MyDayNextShift", () => {
  it("shows the next shift with its start and workplace, linking to Roster", () => {
    // Starts 15:20 Perth: 6 h 20 min after 09:00.
    roster.current = { ...roster.current, shifts: [shift("2026-09-26T07:20:00Z", "2026-09-26T23:00:00Z")] };
    render(<MyDayNextShift now={NOW} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/roster");
    expect(link.textContent).toContain("Night shift · starts in 6 h 20 min");
    expect(link.textContent).toContain("Example Hospital");
  });

  it("shows when the shift on now ends", () => {
    roster.current = { ...roster.current, shifts: [shift("2026-09-25T23:00:00Z", "2026-09-26T08:00:00Z")] };
    render(<MyDayNextShift now={NOW} />);
    expect(screen.getByTestId("my-day-module-next-shift").textContent).toContain("On now · ends 16:00");
  });

  it.each([
    ["loading", { status: "loading" }],
    ["signed out", { status: "signed-out" }],
    ["failed", { status: "error" }],
    ["empty", { status: "ready", shifts: [] }],
    [
      "sample data",
      {
        status: "ready",
        sample: true,
        demoMode: false,
        shifts: [shift("2026-09-26T07:20:00Z", "2026-09-26T23:00:00Z")],
      },
    ],
  ])("renders nothing when %s", (_name, state) => {
    roster.current = { shifts: [], sample: false, demoMode: false, ...state };
    const { container } = render(<MyDayNextShift now={NOW} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows sample shifts in demo mode", () => {
    roster.current = {
      status: "ready",
      sample: true,
      demoMode: true,
      shifts: [shift("2026-09-26T07:20:00Z", "2026-09-26T23:00:00Z")],
    };
    render(<MyDayNextShift now={NOW} />);
    expect(screen.getByTestId("my-day-module-next-shift")).toBeTruthy();
  });
});

describe("MyDayPinnedNumbers", () => {
  it("renders the shared pinned list once entries loaded", () => {
    render(<MyDayPinnedNumbers />);
    expect(screen.getByTestId("my-day-module-pinned")).toBeTruthy();
  });

  it.each([
    ["loading", { loading: true }],
    ["failed", { loadError: "failed" }],
    ["offline", { isOffline: true }],
    ["signed out", { signedOut: true }],
  ])("renders nothing when %s", (_name, patch) => {
    entries.current = { ...entries.current, ...patch };
    const { container } = render(<MyDayPinnedNumbers />);
    expect(container.innerHTML).toBe("");
  });
});

describe("MyDayNextTeaching", () => {
  const session = {
    occurrenceId: "occ-1",
    serviceId: "svc",
    title: "Grand rounds",
    startsAt: "2026-09-29T01:00:00Z",
    endsAt: "2026-09-29T02:00:00Z",
    venue: "Room 4",
    hasJoinLink: false,
    status: "scheduled",
    isPresenter: false,
    source: "teaching",
  };

  it("shows title, Perth day and time, venue and the session link", () => {
    teaching.current = { status: "ready", data: { session } };
    render(<MyDayNextTeaching />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/teaching/session/occ-1");
    expect(link.textContent).toContain("Grand rounds");
    expect(link.textContent).toContain("Tue 29 Sep · 09:00 · Room 4");
  });

  it.each([
    ["loading", { status: "loading", data: null }],
    ["failed", { status: "error", data: null }],
    ["signed out", { status: "signed-out", data: null }],
    ["empty", { status: "ready", data: { session: null } }],
    ["cancelled", { status: "ready", data: { session: { ...session, status: "cancelled" } } }],
  ])("renders nothing when %s", (_name, state) => {
    teaching.current = state;
    const { container } = render(<MyDayNextTeaching />);
    expect(container.innerHTML).toBe("");
  });
});

describe("MyDayCpdPace", () => {
  const set = { year: 2026, totalHours: 50, requirements: [] };

  function respond(map: Record<string, { ok: boolean; body?: unknown }>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const hit = Object.entries(map).find(([prefix]) => url.startsWith(prefix))?.[1] ?? { ok: false };
        return { ok: hit.ok, status: hit.ok ? 200 : 500, json: async () => hit.body };
      }),
    );
  }

  it("shows hours logged of the target and links to CPD", async () => {
    respond({
      "/api/cme/entries": {
        ok: true,
        body: {
          entries: [{ id: "e1", archivedAt: null, allocations: [{ category: "educational-activities", hours: 12.5 }] }],
        },
      },
      "/api/cme/year": { ok: true, body: { requirementSet: set } },
    });
    render(<MyDayCpdPace now={NOW} />);
    await waitFor(() => expect(screen.getByTestId("my-day-module-cpd")).toBeTruthy());
    expect(screen.getByRole("link").getAttribute("href")).toBe("/cme");
    expect(screen.getByTestId("my-day-module-cpd").textContent).toContain("CPD: 12.5 of 50 h this year");
    expect(screen.getByTestId("my-day-module-cpd").textContent).not.toMatch(/behind/i);
  });

  it("reads the current CPD year once and not again on a re-render", async () => {
    respond({
      "/api/cme/entries": { ok: true, body: { entries: [] } },
      "/api/cme/year": { ok: true, body: { requirementSet: set } },
    });
    const { rerender } = render(<MyDayCpdPace now={NOW} />);
    await waitFor(() => expect(screen.getByTestId("my-day-module-cpd")).toBeTruthy());
    rerender(<MyDayCpdPace now={new Date(NOW.getTime() + 60_000)} />);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls.map((call) => call[0])).toEqual([
      "/api/cme/entries?year=2026",
      "/api/cme/year?year=2026",
    ]);
  });

  it.each([
    [
      "the entries read failed",
      { "/api/cme/entries": { ok: false }, "/api/cme/year": { ok: true, body: { requirementSet: set } } },
    ],
    [
      "the year read failed",
      { "/api/cme/entries": { ok: true, body: { entries: [] } }, "/api/cme/year": { ok: false } },
    ],
    [
      "the year is not confirmed",
      {
        "/api/cme/entries": { ok: true, body: { entries: [] } },
        "/api/cme/year": { ok: true, body: { requirementSet: null } },
      },
    ],
  ])("renders nothing when %s", async (_name, map) => {
    respond(map);
    const { container } = render(<MyDayCpdPace now={NOW} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(container.innerHTML).toBe("");
  });
});

describe("MyDayOnCallShortcuts", () => {
  it("links to the call log and the handover builder", () => {
    render(<MyDayOnCallShortcuts />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/on-call/call#on-call-call-log-heading", "/on-call/call#on-call-handover-heading"]);
  });
});
