import { describe, expect, it } from "vitest";
import { previewDraftUpload } from "@/lib/roster/maker/upload";
import type { RosterDraft } from "@/lib/roster/maker/model";
import type { RosterAssignment, RosterChanges, RosterPerson, RosterShiftCode } from "@/lib/roster/team/model";

const ALEX = "11111111-1111-4111-8111-111111111111";
const SAM = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const SWAP = "44444444-4444-4444-8444-444444444444";
const person = (userId: string, displayName: string): RosterPerson => ({
  userId,
  displayName,
  rosterName: null,
  joinedAt: "2026-01-01T00:00:00Z",
  serviceRole: "member",
  role: "member",
  grade: "registrar",
  rotationEndsOn: null,
});
const people = [person(ALEX, "Alex Example"), person(SAM, "Sam Example")];
const codes: RosterShiftCode[] = [{ code: "D", kind: "day", starts: "08:00", ends: "16:00", label: null }];
const row = {
  userId: ALEX,
  rosterName: null,
  siteId: null,
  startsAt: "2026-10-01T00:00:00Z",
  endsAt: "2026-10-01T08:00:00Z",
  shiftCode: "D",
  kind: "day" as const,
  grade: "registrar" as const,
};
const draft = (assignments: RosterDraft["assignments"], changes: RosterDraft["changes"] = []): RosterDraft => ({
  draft: { id: ID, periodStart: "2026-10-01", periodEnd: "2026-10-02", basedOnPublicationId: null, version: 1 },
  assignments,
  changes,
});
const liveRow = (id: string, userId: string): RosterAssignment => ({
  id,
  userId,
  name: userId === ALEX ? "Alex Example" : "Sam Example",
  siteId: null,
  siteName: null,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  shiftCode: "D",
  kind: "day",
  grade: "registrar",
});
const noChanges: RosterChanges = { swaps: [], openShifts: [] };
const input = (name: string, cell: string) => ({ dates: ["2026-10-01"], rows: [{ name, cells: [cell] }] });

describe("draft upload reconciliation", () => {
  it("keeps a draft edit behind explicit review on repeated stale uploads", () => {
    const edited = draft(
      [{ id: ID, ...row }],
      [
        {
          id: "1",
          actorId: ALEX,
          at: "2026-09-27T00:00:00Z",
          source: "grid",
          change: { before: null, after: { user_id: ALEX, roster_name: null, starts_at: row.startsAt } },
          undoneAt: null,
          canUndo: true,
        },
      ],
    );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = previewDraftUpload({
        grid: input("Alex Example", "OFF"),
        draft: edited,
        live: [],
        changes: noChanges,
        people,
        codes,
      });
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0]).toMatchObject({
        reason: "This duty was edited in the draft.",
        operation: { op: "remove", id: ID },
      });
    }
  });

  it("flags a stale file that would reverse an approved swap", () => {
    const changes: RosterChanges = {
      swaps: [
        {
          swapId: SWAP,
          giveAssignmentId: ID,
          takeAssignmentId: null,
          requesterId: ALEX,
          counterpartyId: SAM,
          decidedAt: "2026-09-27T00:00:00Z",
          autoApproved: false,
        },
      ],
      openShifts: [],
    };
    const result = previewDraftUpload({
      grid: input("Alex Example", "OFF"),
      draft: draft([{ id: ID, ...row }]),
      live: [liveRow(ID, SAM)],
      changes,
      people,
      codes,
    });
    expect(result.differences[0]?.reason).toContain("approved live swap");
  });

  it("shows removals and refuses unknown codes or row identities", () => {
    const removal = previewDraftUpload({
      grid: input("Alex Example", "OFF"),
      draft: draft([{ id: ID, ...row }]),
      live: [],
      changes: noChanges,
      people,
      codes,
    });
    expect(removal.differences[0]).toMatchObject({
      person: "Alex Example",
      date: "2026-10-01",
      operation: { op: "remove" },
    });
    const unknown = previewDraftUpload({
      grid: input("Unknown Doctor", "XYZ"),
      draft: draft([]),
      live: [],
      changes: noChanges,
      people,
      codes,
    });
    expect(unknown.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("Choose who row"), expect.stringContaining("unknown code")]),
    );
  });

  it("treats TBA as vacancy and keeps a separate explicitly named row", () => {
    const result = previewDraftUpload({
      grid: {
        dates: ["2026-10-01"],
        rows: [
          { name: "TBA", cells: ["D"] },
          { name: "Locum A", cells: ["D"] },
        ],
      },
      draft: draft([]),
      live: [],
      changes: noChanges,
      people,
      codes,
      choices: { 1: { kind: "named" } },
    });
    expect(result.errors).toEqual([]);
    expect(result.vacancies).toHaveLength(1);
    expect(result.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          person: "Unfilled (TBA)",
          operation: expect.objectContaining({
            op: "add",
            row: expect.objectContaining({ userId: null, rosterName: null, shiftCode: "D" }),
          }),
        }),
        expect.objectContaining({
          operation: expect.objectContaining({
            op: "add",
            row: expect.objectContaining({ userId: null, rosterName: "Locum A" }),
          }),
        }),
      ]),
    );
  });

  it("preserves repeated identical vacancies as a multiset and shows Perth times", () => {
    const grid = {
      dates: ["2026-10-01"],
      rows: [
        { name: "TBA", cells: ["D"] },
        { name: "TBA", cells: ["D"] },
      ],
    };
    const empty = previewDraftUpload({ grid, draft: draft([]), live: [], changes: noChanges, people, codes });
    expect(empty.differences).toHaveLength(2);
    expect(new Set(empty.differences.map((item) => item.key)).size).toBe(2);
    expect(
      empty.differences.every(
        (item) =>
          item.operation.op === "add" && item.operation.row.userId === null && item.operation.row.rosterName === null,
      ),
    ).toBe(true);
    expect(empty.differences[0]?.after).toContain("08:00–16:00");
    const one = previewDraftUpload({
      grid,
      draft: draft([{ id: ID, ...row, userId: null, rosterName: null, grade: null }]),
      live: [],
      changes: noChanges,
      people,
      codes,
    });
    expect(one.differences).toHaveLength(1);
    expect(one.differences[0]?.operation.op).toBe("add");
  });

  it("requires review before a stale TBA file recreates a claimed live shift", () => {
    const changes: RosterChanges = {
      swaps: [],
      openShifts: [{ openShiftId: SWAP, assignmentId: ID, claimedBy: SAM, decidedAt: "2026-09-27T00:00:00Z" }],
    };
    const result = previewDraftUpload({
      grid: input("TBA", "D"),
      draft: draft([]),
      live: [liveRow(ID, SAM)],
      changes,
      people,
      codes,
    });
    expect(result.differences).toHaveLength(1);
    expect(result.differences[0]?.reason).toContain("already claimed");
  });
});
