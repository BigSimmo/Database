/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RosterDraftPublication } from "@/components/roster/maker/roster-draft-publication";
import { RosterDutyAgreements } from "@/components/roster/maker/roster-duty-agreements";
import type { RosterDraft } from "@/lib/roster/maker/model";
import type { RosterOverview } from "@/lib/roster/team/model";

const SERVICE = "5e000000-0000-4000-8000-000000000001";
const DRAFT = "5e000000-0000-4000-8000-000000000002";
const USER = "5e000000-0000-4000-8000-000000000003";
const PROPOSAL = "5e000000-0000-4000-8000-000000000004";
const now = "2026-09-27T00:00:00Z";
const row = {
  userId: USER,
  rosterName: null,
  siteId: null,
  startsAt: "2026-10-01T00:00:00Z",
  endsAt: "2026-10-01T08:00:00Z",
  shiftCode: "D",
  kind: "day",
  grade: "registrar",
};
const snapshot: RosterDraft = {
  draft: { id: DRAFT, version: 2, periodStart: "2026-10-01", periodEnd: "2026-10-02", basedOnPublicationId: null },
  assignments: [],
  changes: [
    {
      id: "8",
      actorId: USER,
      at: now,
      source: "grid",
      change: { op: "remove", before: row, after: null },
      undoneAt: null,
      canUndo: true,
    },
  ],
};
const overview: RosterOverview = {
  service: { id: SERVICE, name: "Example team" },
  me: { role: "manager", grade: "consultant", rotationEndsOn: null },
  latestPublication: null,
  seenLatest: true,
  settings: { swapApproval: "manager", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};
const proposal = {
  id: PROPOSAL,
  draftId: DRAFT,
  draftVersion: 2,
  periodStart: "2026-10-01",
  periodEnd: "2026-10-02",
  scope: "full",
  changeId: null,
  createdAt: now,
  status: "pending",
  before: [row],
  after: [],
  affected: [{ userId: USER, displayName: "Alex Example", before: [row], after: [], agreedAt: null }],
  blockers: [],
  protectedChanges: [],
  canPublish: false,
};
const state = (value = proposal) => ({
  settingsToken: "token",
  needs: [],
  rules: { minBreakHours: null, maxHours7d: null, source: null, reviewedOn: null },
  proposals: [value],
  reconciliation: null,
});
const own = () => ({
  id: PROPOSAL,
  draftId: DRAFT,
  draftVersion: 2,
  periodStart: "2026-10-01",
  periodEnd: "2026-10-02",
  scope: "full",
  createdAt: now,
  status: "pending",
  before: [row],
  after: [],
  agreedAt: null as string | null,
});
let posts: Record<string, unknown>[];
beforeEach(() => {
  posts = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("publication and personal agreement", () => {
  it("requires current agreement and explicit review before publishing a removal", async () => {
    const agreed = { ...proposal, affected: [{ ...proposal.affected[0]!, agreedAt: now }], canPublish: true };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init) => {
        if (init?.method !== "POST") return Response.json(state(agreed));
        const body = JSON.parse(String(init.body));
        posts.push(body);
        return body.action === "proposal.create"
          ? Response.json({ proposal })
          : Response.json({
              publicationId: PROPOSAL,
              version: 3,
              draftVersion: 3,
              changedUserIds: [USER],
              swapsCancelled: [],
              replayed: false,
            });
      }),
    );
    const published = vi.fn();
    render(
      <RosterDraftPublication
        serviceId={SERVICE}
        snapshot={snapshot}
        overview={overview}
        people={[]}
        onPublished={published}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Review whole draft" }));
    await screen.findByText(/Alex Example: Waiting for agreement/);
    expect(screen.getByText("No duties")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/I reviewed the before and after/));
    expect(screen.getByRole("button", { name: "Publish reviewed duties" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reload publication reviews" }));
    await screen.findByText(/Alex Example: Agreed/);
    expect(screen.getByRole("button", { name: "Publish reviewed duties" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/I reviewed the before and after/));
    fireEvent.click(screen.getByRole("button", { name: "Publish reviewed duties" }));
    await waitFor(() => expect(published).toHaveBeenCalledOnce());
    expect(posts).toEqual([
      { action: "proposal.create", draftId: DRAFT, expectedVersion: 2, scope: "full" },
      { action: "proposal.publish", proposalId: PROPOSAL },
    ]);
  });

  it("pins single-change review to the selected audit id and refuses an uncertain publish result", async () => {
    const single = { ...proposal, scope: "change", changeId: "8", affected: [], canPublish: true };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init) => {
        const body = JSON.parse(String(init?.body));
        posts.push(body);
        return body.action === "proposal.create"
          ? Response.json({ proposal: single })
          : Response.json({ message: "Conflict" }, { status: 409 });
      }),
    );
    render(
      <RosterDraftPublication
        serviceId={SERVICE}
        snapshot={snapshot}
        overview={overview}
        people={[]}
        onPublished={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Single draft change"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Review only selected change" }));
    await screen.findByText(/Only change 8/);
    fireEvent.click(screen.getByLabelText(/I reviewed the before and after/));
    fireEvent.click(screen.getByRole("button", { name: "Publish reviewed duties" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Publish reviewed duties" })).toBeDisabled();
    expect(posts[0]).toEqual({
      action: "proposal.create",
      draftId: DRAFT,
      expectedVersion: 2,
      scope: "change",
      changeId: "8",
    });
    expect(posts).toHaveLength(2);
  });

  it("records only session-person agreement after reviewing their own removal", async () => {
    let agreed = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init) => {
        if (init?.method === "POST") {
          posts.push(JSON.parse(String(init.body)));
          agreed = true;
          return Response.json({ ok: true });
        }
        return Response.json({ proposals: [{ ...own(), agreedAt: agreed ? now : null }] });
      }),
    );
    render(<RosterDutyAgreements serviceId={SERVICE} />);
    const select = await screen.findByLabelText("Duty change to review");
    fireEvent.change(select, { target: { value: PROPOSAL } });
    expect(screen.getByRole("button", { name: "Record my agreement" })).toBeDisabled();
    expect(posts).toHaveLength(0);
    fireEvent.click(screen.getByLabelText(/I have reviewed and agree/));
    fireEvent.click(screen.getByRole("button", { name: "Record my agreement" }));
    await screen.findByText(/Your agreement is recorded/);
    expect(posts).toEqual([{ action: "agree", proposalId: PROPOSAL }]);
  });
});
