/** @vitest-environment jsdom */
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RosterManagePage } from "@/components/roster/manage/roster-manage-page";
import { RosterApproveTab } from "@/components/roster/manage/roster-approve-tab";
import { RosterTeamSettings } from "@/components/roster/manage/roster-team-settings";
import type { RosterOverview } from "@/lib/roster/team/model";
vi.mock("next/navigation", () => ({ usePathname: () => "/roster/manage", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/roster/manage/roster-manage-nav-header", () => ({ RosterManageNavHeader: () => null }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("never fetches manager data or renders controls for an ordinary member", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      actorId: "alex",
      teams: [{ serviceId: "team", name: "Example team", enabled: true, role: "member", grade: null }],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<RosterManagePage />);
  expect(await screen.findByText("Only your team's roster manager can see this page.")).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Approve")).toBeNull();
});

const overview: RosterOverview = {
  service: { id: "team", name: "Example team" },
  me: { role: "manager", grade: null, rotationEndsOn: null },
  latestPublication: null,
  seenLatest: true,
  settings: { swapApproval: "auto_same_grade", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};
it("rechecks a waiting swap before approving and sends no actor", async () => {
  const posts: unknown[] = [];
  const swap = {
    id: "swap",
    status: "accepted",
    requesterId: "alex",
    counterpartyId: "sam",
    needsManagerBecause: "within_7_days",
    autoApproved: false,
    give: {
      id: "give",
      userId: "alex",
      name: "Alex",
      grade: "registrar",
      startsAt: "2026-10-01T00:00:00Z",
      endsAt: "2026-10-01T09:00:00Z",
      kind: "day",
      shiftCode: "D",
      siteName: null,
      siteId: null,
    },
    take: null,
  };
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)));
      return Response.json({ result: { ok: true } });
    }
    const what = new URL(String(input), "http://localhost").searchParams.get("what");
    return Response.json(
      what === "manage"
        ? { swaps: [swap], openShifts: [], seen: null }
        : what === "people"
          ? {
              people: [
                { userId: "alex", displayName: "Alex" },
                { userId: "sam", displayName: "Sam" },
              ],
            }
          : what === "assignments"
            ? { assignments: [swap.give] }
            : { leave: [] },
    );
  });
  vi.stubGlobal("fetch", fetcher);
  render(<RosterApproveTab serviceId="team" />);
  expect(await screen.findByText("Needs you because it's within 7 days")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Swap · Alex and Sam/ }));
  await screen.findByText(/Rechecked/);
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(posts).toEqual([{ action: "swap.approve", swapId: "swap" }]));
  expect(fetcher.mock.calls.some(([input]) => String(input).includes("what=assignments"))).toBe(true);
});
it("saves all settings fields together when only one changes", async () => {
  const posts: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input, init) => {
      posts.push(JSON.parse(init.body));
      return Response.json({ result: { ok: true } });
    }),
  );
  render(<RosterTeamSettings serviceId="team" overview={overview} />);
  fireEvent.change(screen.getByLabelText("Where the rules come from"), {
    target: { value: "Example service agreement" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save team settings" }));
  await waitFor(() =>
    expect(posts).toEqual([
      {
        action: "settings.set",
        swapApproval: "auto_same_grade",
        rules: {},
        rulesSource: "Example service agreement",
        payFortnightAnchor: null,
      },
    ]),
  );
});
