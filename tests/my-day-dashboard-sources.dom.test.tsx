/** @vitest-environment jsdom */

// The dashboard's extra reads never hand a signed-in reader invented data:
// Roster's example roster, a demo Teaching team and a demo CPD year all read
// as "unavailable" unless the page is a local demo build (allowSample).

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const roster = vi.hoisted(() => ({
  current: { status: "ready", shifts: [] as unknown[], sample: false, demoMode: false },
}));
vi.mock("@/components/roster/use-roster-shifts", () => ({
  useRosterShifts: () => roster.current,
}));

const teaching = vi.hoisted(() => ({ current: { status: "ready", data: null as unknown } }));
vi.mock("@/components/teaching/use-teaching-resource", () => ({
  useTeachingResource: () => ({ ...teaching.current, code: null, refreshing: false, retry: () => undefined }),
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({ status: "authenticated", authEpoch: 1 }),
}));

import { useMyDayDashboardSources } from "@/components/my-day/use-my-day-dashboard-sources";

const TODAY = "2026-10-03";
const SHIFT = {
  id: "s1",
  startsAt: "2026-10-03T09:00:00Z",
  endsAt: "2026-10-04T00:30:00Z",
  title: "On call",
  location: null,
  sourceUid: null,
  kind: "on_call",
  source: "manual",
  seriesId: null,
  workplace: null,
};
const session = (id: string, serviceId: string) => ({
  occurrenceId: id,
  serviceId,
  title: `Session ${id}`,
  startsAt: "2026-10-03T06:00:00Z",
  endsAt: "2026-10-03T07:00:00Z",
  venue: null,
  hasJoinLink: false,
  status: "scheduled",
  isPresenter: false,
  source: "teaching",
});

function stubCpd({ demoMode }: { demoMode: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.startsWith("/api/cme/year")
        ? { year: 2026, requirementSet: { year: 2026, totalHours: 50, requirements: [] }, demoMode }
        : {
            year: 2026,
            demoMode,
            entries: [
              { id: "e1", archivedAt: null, allocations: [{ hours: 20 }, { hours: 12 }] },
              { id: "e2", archivedAt: "2026-05-01", allocations: [{ hours: 99 }] },
            ],
          };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

beforeEach(() => {
  roster.current = { status: "ready", shifts: [SHIFT], sample: false, demoMode: false };
  teaching.current = {
    status: "ready",
    data: {
      teams: [
        { id: "real", isDemo: false },
        { id: "demo", isDemo: true },
      ],
      sessions: [session("r", "real"), session("d", "demo"), { ...session("x", "real"), status: "cancelled" }],
      relocated: [],
    },
  };
});
afterEach(() => vi.unstubAllGlobals());

describe("useMyDayDashboardSources", () => {
  it("reads the reader's own roster, today's real sessions and CPD hours", async () => {
    stubCpd({ demoMode: false });
    const { result } = renderHook(() => useMyDayDashboardSources({ today: TODAY, allowSample: false }));
    expect(result.current.roster).toMatchObject({ status: "ready", sample: false });
    expect(result.current.roster.shifts).toHaveLength(1);
    expect(result.current.teaching.sessions.map((s) => s.occurrenceId)).toEqual(["r"]);
    await waitFor(() => expect(result.current.cpd.status).toBe("ready"));
    // Archived activities never count, as on the CPD page.
    expect(result.current.cpd).toMatchObject({ loggedHours: 32, targetHours: 50, year: 2026 });
  });

  it("drops every kind of invented data for a signed-in reader", async () => {
    stubCpd({ demoMode: true });
    roster.current = { status: "ready", shifts: [SHIFT], sample: true, demoMode: false };
    const { result } = renderHook(() => useMyDayDashboardSources({ today: TODAY, allowSample: false }));
    expect(result.current.roster).toMatchObject({ status: "unavailable", shifts: [] });
    expect(result.current.teaching.sessions.some((s) => s.serviceId === "demo")).toBe(false);
    await waitFor(() => expect(result.current.cpd.status).toBe("unavailable"));
    expect(result.current.cpd.loggedHours).toBe(0);
  });

  it("keeps demo data, flagged as sample, in a local demo build", async () => {
    stubCpd({ demoMode: true });
    roster.current = { status: "ready", shifts: [SHIFT], sample: false, demoMode: true };
    const { result } = renderHook(() => useMyDayDashboardSources({ today: TODAY, allowSample: true }));
    expect(result.current.roster).toMatchObject({ status: "ready", sample: true });
    expect(result.current.teaching.sessions.map((s) => s.occurrenceId)).toEqual(["r", "d"]);
    await waitFor(() => expect(result.current.cpd).toMatchObject({ status: "ready", sample: true }));
  });

  it("hides CPD when no target is confirmed, and reports a failed read as failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/cme/year")
          ? new Response(JSON.stringify({ year: 2026, requirementSet: null }), { status: 200 })
          : new Response(JSON.stringify({ year: 2026, entries: [] }), { status: 200 }),
      ),
    );
    const first = renderHook(() => useMyDayDashboardSources({ today: TODAY, allowSample: false }));
    await waitFor(() => expect(first.result.current.cpd.status).toBe("unavailable"));
    first.unmount();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    roster.current = { status: "error", shifts: [], sample: false, demoMode: false };
    const second = renderHook(() => useMyDayDashboardSources({ today: TODAY, allowSample: false }));
    expect(second.result.current.roster.status).toBe("failed");
    await waitFor(() => expect(second.result.current.cpd.status).toBe("failed"));
  });
});
