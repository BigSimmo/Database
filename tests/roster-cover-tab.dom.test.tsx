/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RosterCoverTab } from "@/components/roster/manage/roster-cover-tab";
import type { RosterOverview } from "@/lib/roster/team/model";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const overview: RosterOverview = {
  service: { id: "team", name: "Example team" },
  me: { role: "manager", grade: null, rotationEndsOn: null },
  latestPublication: null,
  seenLatest: true,
  settings: { swapApproval: "auto_same_grade", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};

it("counts a Sunday target (weekday 7) and a Monday target (weekday 1) on those days", async () => {
  // Saturday 24 October 2026, Perth.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-24T02:00:00Z") });
  const need = (id: string, weekday: number) => ({
    id,
    weekday,
    date: null,
    kind: "day",
    grade: null,
    siteId: null,
    needed: 2,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const what = new URL(String(input), "http://localhost").searchParams.get("what");
      return Response.json(
        what === "maker"
          ? {
              codes: [],
              needs: [need("c1000000-0000-4000-8000-000000000001", 7), need("c1000000-0000-4000-8000-000000000002", 1)],
              drafts: [],
            }
          : what === "assignments"
            ? { assignments: [] }
            : { swaps: [], openShifts: [], seen: null },
      );
    }),
  );
  render(<RosterCoverTab serviceId="team" overview={overview} />);
  const sunday = (await screen.findByText("Sun 25 Oct")).closest("tr")!;
  expect(within(sunday).getByText("0 / 2")).toBeTruthy();
  const monday = screen.getByText("Mon 26 Oct").closest("tr")!;
  expect(within(monday).getByText("0 / 2")).toBeTruthy();
  const saturday = screen.getByText("Sat 24 Oct").closest("tr")!;
  expect(within(saturday).queryByText(/\/ 2/)).toBeNull();
});
