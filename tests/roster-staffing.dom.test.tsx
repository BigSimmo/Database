/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RosterStaffingPanel } from "@/components/roster/maker/roster-staffing-panel";
import type { RosterDraft } from "@/lib/roster/maker/model";
import type { RosterOverview } from "@/lib/roster/team/model";

const SERVICE = "5e000000-0000-4000-8000-000000000001";
const DRAFT = "5e000000-0000-4000-8000-000000000002";
const ALEX = "5e000000-0000-4000-8000-000000000003";
const NEED = "5e000000-0000-4000-8000-000000000004";
const SITE = "5e000000-0000-4000-8000-000000000005";
const overview: RosterOverview = {
  service: { id: SERVICE, name: "Example team" },
  me: { role: "manager", grade: "consultant", rotationEndsOn: null },
  latestPublication: null,
  seenLatest: false,
  settings: { swapApproval: "manager", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [{ id: SITE, name: "Ward A" }],
};
const snapshot: RosterDraft = {
  draft: { id: DRAFT, periodStart: "2026-10-01", periodEnd: "2026-10-02", basedOnPublicationId: null, version: 1 },
  assignments: [
    {
      id: "5e000000-0000-4000-8000-000000000006",
      userId: ALEX,
      rosterName: null,
      siteId: SITE,
      startsAt: "2026-10-01T00:00:00Z",
      endsAt: "2026-10-01T08:30:00Z",
      shiftCode: "D",
      kind: "day",
      grade: "registrar",
    },
  ],
  changes: [],
};
const state = {
  settingsToken: "v1",
  needs: [{ id: NEED, weekday: 4, date: null, siteId: SITE, grade: "registrar", kind: "day", needed: 2 }],
  rules: { minBreakHours: null, maxHours7d: null, source: null, reviewedOn: null },
  proposals: [],
  reconciliation: null,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the draft gap without inventing times and saves needs with reviewed team rules atomically", async () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
    Response.json(
      init?.method === "POST"
        ? {
            ...state,
            settingsToken: "v2",
            rules: { minBreakHours: 10, maxHours7d: 40, source: "Team policy", reviewedOn: "2026-09-27" },
          }
        : state,
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<RosterStaffingPanel serviceId={SERVICE} overview={overview} snapshot={snapshot} />);
  expect(await screen.findByText(/1 rostered \/ 2 needed/)).toBeInTheDocument();
  expect(screen.getByText(/Gap: 1 more registrar day shift needed.*no time has been set/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Minimum break hours"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Maximum worked hours in any seven days"), { target: { value: "40" } });
  fireEvent.change(screen.getByLabelText("Rule source"), { target: { value: "Team policy" } });
  fireEvent.change(screen.getByLabelText("Rules reviewed on"), { target: { value: "2026-09-27" } });
  fireEvent.click(screen.getByRole("button", { name: "Save staffing settings" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect(JSON.parse(String(post[1]!.body))).toEqual({
    action: "settings.save",
    expectedToken: "v1",
    needs: [{ weekday: 4, date: null, siteId: SITE, grade: "registrar", kind: "day", needed: 2 }],
    rules: { minBreakHours: 10, maxHours7d: 40, source: "Team policy", reviewedOn: "2026-09-27" },
  });
});

it("keeps the proposed count after a conflict and requires explicit review before retry", async () => {
  let getCount = 0;
  const posts: object[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method)
        return Response.json(
          ++getCount === 1 ? state : { ...state, settingsToken: "v2", needs: [{ ...state.needs[0], needed: 4 }] },
        );
      posts.push(JSON.parse(String(init.body)));
      return posts.length === 1
        ? Response.json({ code: "roster_conflict" }, { status: 409 })
        : Response.json({ ...state, settingsToken: "v3", needs: [{ ...state.needs[0], needed: 3 }] });
    }),
  );
  render(<RosterStaffingPanel serviceId={SERVICE} overview={overview} snapshot={snapshot} />);
  const needed = await screen.findByLabelText("Needed");
  fireEvent.change(needed, { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Save staffing settings" }));
  await screen.findByText(/Another manager changed staffing settings/);
  expect((needed as HTMLInputElement).value).toBe("3");
  expect(screen.getByText(/need 4/)).toBeInTheDocument();
  expect(posts).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Save staffing settings" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Review my values against current" }));
  fireEvent.click(screen.getByRole("button", { name: "Save staffing settings" }));
  await waitFor(() => expect(posts).toHaveLength(2));
  expect(posts[1]).toEqual(expect.objectContaining({ expectedToken: "v2" }));
});
