/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RosterMakerTab } from "@/components/roster/maker/roster-maker-tab";
import type { RosterOverview } from "@/lib/roster/team/model";

const SERVICE = "5e000000-0000-4000-8000-000000000001";
const DRAFT = "5e000000-0000-4000-8000-000000000002";
const ALEX = "5e000000-0000-4000-8000-000000000003";
const ASSIGNMENT = "5e000000-0000-4000-8000-000000000004";
const overview: RosterOverview = {
  service: { id: SERVICE, name: "Example team" },
  me: { role: "manager", grade: "consultant", rotationEndsOn: null },
  latestPublication: null,
  seenLatest: true,
  settings: { swapApproval: "manager", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};
const people = {
  people: [
    {
      userId: ALEX,
      displayName: "Alex Example",
      rosterName: "Alex Example",
      grade: "registrar",
      joinedAt: "2026-01-01T00:00:00Z",
      serviceRole: "member",
      role: "member",
      rotationEndsOn: null,
    },
  ],
};
const maker = {
  codes: [
    { code: "D", kind: "day", starts: "08:00", ends: "16:30", label: "Day" },
    { code: "N", kind: "night", starts: "21:30", ends: "08:00", label: "Night" },
    { code: "OFF", kind: "off", starts: null, ends: null, label: "Off" },
  ],
  needs: [],
  drafts: [],
};
const oldAssignment = {
  id: ASSIGNMENT,
  userId: ALEX,
  rosterName: null,
  siteId: null as string | null,
  startsAt: "2026-10-01T00:00:00Z",
  endsAt: "2026-10-01T08:30:00Z",
  shiftCode: "D",
  kind: "day",
  grade: "registrar",
};
function snapshot(version = 1, assignments = [oldAssignment], changes: object[] = []) {
  return {
    draft: { id: DRAFT, periodStart: "2026-10-01", periodEnd: "2026-10-02", basedOnPublicationId: null, version },
    assignments,
    changes,
  };
}

let posts: Array<Record<string, unknown>>;
let fetchMock: ReturnType<typeof vi.fn>;
let nextPost: (body: Record<string, unknown>) => Response;
let currentSnapshot: ReturnType<typeof snapshot>;
beforeEach(() => {
  posts = [];
  currentSnapshot = snapshot();
  nextPost = (body) => Response.json(snapshot(body.action === "draft.open" ? 1 : 2));
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("what=people")) return Response.json(people);
    if (url.includes("what=maker")) return Response.json(maker);
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      posts.push(body);
      return nextPost(body);
    }
    return Response.json(currentSnapshot);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openDraft(version = 1, currentOverview = overview) {
  render(<RosterMakerTab serviceId={SERVICE} overview={currentOverview} />);
  fireEvent.change(screen.getByLabelText("Period starts"), { target: { value: "2026-10-01" } });
  fireEvent.change(screen.getByLabelText("Period ends"), { target: { value: "2026-10-02" } });
  fireEvent.click(screen.getByRole("button", { name: "Open draft" }));
  await screen.findByText(new RegExp(`Draft v${version}`));
}

describe("manager draft editing", () => {
  it("opens a period, previews a manual change, then applies only a draft command", async () => {
    await openDraft();
    expect(posts).toEqual([{ action: "draft.open", periodStart: "2026-10-01", periodEnd: "2026-10-02" }]);
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /Edit Alex Example.*1 Oct/ }));
    fireEvent.change(screen.getByLabelText("Shift code"), { target: { value: "N" } });
    fireEvent.click(screen.getByRole("button", { name: "Review change" }));
    const review = screen.getByRole("dialog", { name: "Review draft change" });
    expect(within(review).getByText(/Before.*D.*08:00.*16:30/i)).toBeInTheDocument();
    expect(within(review).getByText(/After.*N.*21:30.*08:00/i)).toBeInTheDocument();
    expect(posts).toHaveLength(1);
    fireEvent.click(within(review).getByRole("button", { name: "Apply to draft" }));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1]).toEqual({
      action: "draft.change",
      draftId: DRAFT,
      expectedVersion: 1,
      source: "grid",
      ops: [
        expect.objectContaining({ op: "update", id: ASSIGNMENT, row: expect.objectContaining({ shiftCode: "N" }) }),
      ],
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/publish"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
  });

  it("keeps a stale proposal until the manager reviews the fresh draft", async () => {
    nextPost = (body) =>
      body.action === "draft.change"
        ? Response.json({ code: "roster_draft_conflict", message: "Draft changed" }, { status: 409 })
        : Response.json(snapshot());
    await openDraft();
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /Edit Alex Example.*1 Oct/ }));
    fireEvent.change(screen.getByLabelText("Shift code"), { target: { value: "N" } });
    fireEvent.click(screen.getByRole("button", { name: "Review change" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply to draft" }));
    expect(await screen.findByText(/Draft changed.*review/i)).toBeInTheDocument();
    expect(screen.getByText(/^Proposed N for Alex Example/)).toBeInTheDocument();
    expect(posts).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Review against current draft" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Retry save" })).toBeNull();
  });

  it("preserves a co-manager's new site while reviewing a stale code change", async () => {
    const site = "5e000000-0000-4000-8000-000000000005";
    currentSnapshot = snapshot(2, [{ ...oldAssignment, siteId: site }]);
    let attempted = false;
    nextPost = (body) => {
      if (body.action !== "draft.change") return Response.json(snapshot());
      if (!attempted) {
        attempted = true;
        return Response.json({ code: "roster_draft_conflict" }, { status: 409 });
      }
      return Response.json(snapshot(3, [{ ...oldAssignment, siteId: site, shiftCode: "N" }]));
    };
    await openDraft();
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /Edit Alex Example.*1 Oct/ }));
    fireEvent.change(screen.getByLabelText("Shift code"), { target: { value: "N" } });
    fireEvent.click(screen.getByRole("button", { name: "Review change" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply to draft" }));
    const reviewAgain = await screen.findByRole("button", { name: "Review against current draft" });
    await waitFor(() => expect(reviewAgain).toBeEnabled());
    fireEvent.click(reviewAgain);
    fireEvent.click(screen.getByRole("button", { name: "Apply to draft" }));
    await waitFor(() => expect(posts).toHaveLength(3));
    expect((posts[2]!.ops as Array<{ row: Record<string, unknown> }>)[0]!.row).not.toHaveProperty("siteId");
  });

  it("previews and saves an intentional site-only edit", async () => {
    const site = { id: "5e000000-0000-4000-8000-000000000005", name: "Ward A" };
    await openDraft(1, { ...overview, sites: [site] });
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /Edit Alex Example.*1 Oct/ }));
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: site.id } });
    fireEvent.click(screen.getByRole("button", { name: "Review change" }));
    const review = screen.getByRole("dialog", { name: "Review draft change" });
    expect(within(review).getByText(/Before.*Site not specified/)).toBeInTheDocument();
    expect(within(review).getByText(/After.*Ward A/)).toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Apply to draft" }));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect((posts[1]!.ops as Array<{ row: Record<string, unknown> }>)[0]!.row.siteId).toBe(site.id);
  });

  it("describes a removed duty from its trusted before image, with an honest legacy fallback", async () => {
    nextPost = () =>
      Response.json(
        snapshot(
          4,
          [],
          [
            {
              id: "9",
              actorId: ALEX,
              at: "2026-09-27T00:00:00Z",
              source: "grid",
              undoneAt: null,
              canUndo: false,
              change: {
                op: "remove",
                id: ASSIGNMENT,
                before: {
                  id: ASSIGNMENT,
                  user_id: ALEX,
                  roster_name: null,
                  site_id: null,
                  starts_at: "2026-10-01T00:00:00Z",
                  ends_at: "2026-10-01T08:30:00Z",
                  shift_code: "D",
                  kind: "day",
                  grade: "registrar",
                },
                after: null,
              },
            },
            {
              id: "8",
              actorId: null,
              at: "2026-09-26T00:00:00Z",
              source: "grid",
              undoneAt: null,
              canUndo: false,
              change: { op: "remove", id: ASSIGNMENT },
            },
          ],
        ),
      );
    await openDraft(4);
    expect(screen.getByText(/Removed Alex Example.*Thu 1 Oct.*D/)).toBeInTheDocument();
    expect(screen.getByText(/Removed draft shift.*details unavailable for older change/)).toBeInTheDocument();
  });

  it("keeps typed words on the device and posts only a reviewed structured operation", async () => {
    await openDraft();
    const instruction = "Set Alex Example on 2026-10-01 to N";
    fireEvent.change(screen.getByLabelText("Change instruction"), { target: { value: instruction } });
    fireEvent.click(screen.getByRole("button", { name: "Review typed change" }));
    expect(screen.getByRole("dialog", { name: "Review draft change" })).toBeInTheDocument();
    expect(posts).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Apply to draft" }));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1]).toEqual({
      action: "draft.change",
      draftId: DRAFT,
      expectedVersion: 1,
      source: "typed",
      ops: [
        expect.objectContaining({ op: "update", id: ASSIGNMENT, row: expect.objectContaining({ shiftCode: "N" }) }),
      ],
    });
    expect(JSON.stringify(posts[1])).not.toContain(instruction);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes(instruction))).toBe(true);
  });

  it("supports arrow-key cell navigation and eligible Undo with the current version", async () => {
    nextPost = (body) =>
      Response.json(
        body.action === "draft.open"
          ? snapshot(
              4,
              [oldAssignment],
              [
                {
                  id: "8",
                  actorId: ALEX,
                  at: "2026-09-27T00:00:00Z",
                  source: "grid",
                  change: { op: "update" },
                  undoneAt: null,
                  canUndo: true,
                },
              ],
            )
          : snapshot(5),
      );
    await openDraft(4);
    const first = within(screen.getByRole("table")).getByRole("button", { name: /Edit Alex Example.*1 Oct/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(within(screen.getByRole("table")).getByRole("button", { name: /Edit Alex Example.*2 Oct/ })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Undo change 8" }));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1]).toEqual({ action: "draft.undo", draftId: DRAFT, expectedVersion: 4, changeId: "8" });
  });

  it("does not fetch draft data for a non-manager", () => {
    render(<RosterMakerTab serviceId={SERVICE} overview={{ ...overview, me: { ...overview.me, role: "member" } }} />);
    expect(screen.getByText(/Only your team's roster manager/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
