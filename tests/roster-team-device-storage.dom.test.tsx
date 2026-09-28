/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/roster/team",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/roster/ask/roster-ask-box", () => ({ RosterAskBox: () => null }));

import { RosterTeamPage } from "@/components/roster/team/roster-team-page";
import { RosterRequestsPage } from "@/components/roster/requests/roster-requests-page";
import { RosterManagePage } from "@/components/roster/manage/roster-manage-page";

const actorId = "11111111-1111-4111-8111-111111111111";
const teamId = "22222222-2222-4222-8222-222222222222";
const team = { serviceId: teamId, name: "General Medicine", enabled: true, role: "manager", grade: "registrar" };
const overview = {
  service: { id: teamId, name: team.name },
  me: { role: "manager", grade: "registrar", rotationEndsOn: null },
  latestPublication: null,
  seenLatest: true,
  settings: { swapApproval: "manager", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([
  ["Team", <RosterTeamPage key="team" now={new Date("2026-10-12T00:00:00Z")} />],
  ["Requests", <RosterRequestsPage key="requests" />],
  ["Manage", <RosterManagePage key="manage" />],
] as const)("keeps %s team details out of device storage and caches", async (_name, page) => {
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  const openCache = vi.fn();
  vi.stubGlobal("caches", { open: openCache });
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/roster/team") return Response.json({ actorId, teams: [team] });
    if (url.startsWith(`/api/roster/team/${teamId}`)) {
      const what = new URL(url, "https://example.invalid").searchParams.get("what");
      if (what === "overview") return Response.json(overview);
      if (what === "assignments")
        return Response.json({
          assignments: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              userId: actorId,
              name: "Alex Example",
              grade: "registrar",
              siteId: null,
              siteName: "Example Hospital",
              startsAt: "2026-10-12T00:00:00Z",
              endsAt: "2026-10-12T08:00:00Z",
              shiftCode: "D",
              kind: "day",
            },
          ],
        });
      if (what === "requests") return Response.json({ swaps: [], openShifts: [] });
      if (what === "manage") return Response.json({ swaps: [], openShifts: [], seen: null });
      if (what === "people") return Response.json({ people: [] });
      if (what === "team_leave") return Response.json({ leave: [] });
      return Response.json({});
    }
    if (url === "/api/roster/shifts") return Response.json({ shifts: [], latestImport: null });
    if (url === "/api/roster/leave") return Response.json({ leave: [] });
    return Response.json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  render(page);
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes(`/api/roster/team/${teamId}`))).toBe(true),
  );
  expect(setItem.mock.calls.map(([, value]) => String(value)).join(" ")).not.toMatch(
    /Example|Mei|Sam|2026-1[01]|General Medicine/,
  );
  expect(openCache).not.toHaveBeenCalled();
});
