import { describe, expect, it } from "vitest";

import { buildOpenShifts, buildPublishPayload, type RosterPublishRow } from "@/lib/roster/publish/build";
import { compareWithLive } from "@/lib/roster/publish/compare";
import type { RosterAssignment, RosterChanges } from "@/lib/roster/team/model";

const JORDAN = "5e000000-0000-4000-8000-000000000001";
const KAI = "5e000000-0000-4000-8000-000000000002";
const ASSIGNMENT = "5e000000-0000-4000-8000-000000000003";
const SWAP = "5e000000-0000-4000-8000-000000000004";
const period = { start: "2026-10-01", end: "2026-10-31" };
const liveAfterSwap: RosterAssignment = {
  id: ASSIGNMENT,
  userId: KAI,
  name: "Kai Example",
  grade: "registrar",
  siteId: null,
  siteName: null,
  startsAt: "2026-10-13T23:00:00.000Z",
  endsAt: "2026-10-14T07:30:00.000Z",
  shiftCode: "D",
  kind: "day",
};
const fileWithJordanBack: RosterPublishRow = {
  rowName: "Jordan Example",
  userId: JORDAN,
  rosterName: null,
  siteId: null,
  startsAt: liveAfterSwap.startsAt,
  endsAt: liveAfterSwap.endsAt,
  shiftCode: "D",
  kind: "day",
  grade: "registrar",
};
const approved: RosterChanges["swaps"][number] = {
  swapId: SWAP,
  giveAssignmentId: ASSIGNMENT,
  takeAssignmentId: null,
  requesterId: JORDAN,
  counterpartyId: KAI,
  decidedAt: "2026-10-05T08:00:00Z",
  autoApproved: false,
};

describe("team roster comparison", () => {
  it("keeps an approved swap unless the manager explicitly chooses the file", () => {
    const result = compareWithLive({
      fileRows: [fileWithJordanBack],
      live: [liveAfterSwap],
      approvedChanges: [approved],
      period,
    });
    expect(result.undoesSwaps).toHaveLength(1);
    expect(result.rows).toContainEqual(expect.objectContaining({ userId: KAI, startsAt: liveAfterSwap.startsAt }));
    expect(result.rows).not.toContainEqual(expect.objectContaining({ userId: JORDAN }));
    const payload = buildPublishPayload({ period, sourceName: "oct.xlsx", rows: result.rows, choices: {} });
    expect(payload.assignments).toContainEqual(expect.objectContaining({ userId: KAI }));
    const useFile = compareWithLive({
      fileRows: [fileWithJordanBack],
      live: [liveAfterSwap],
      approvedChanges: [approved],
      period,
      choices: { [SWAP]: "file" },
    });
    expect(useFile.rows).toContainEqual(fileWithJordanBack);
  });

  it("keeps an unmatched named row visible as an addition", () => {
    const row: RosterPublishRow = { ...fileWithJordanBack, rowName: "Locum 1", userId: null, rosterName: "Locum 1" };
    const result = compareWithLive({ fileRows: [row], live: [], approvedChanges: [], period });
    expect(result.added).toHaveLength(1);
    expect(result.rows[0]?.rosterName).toBe("Locum 1");
  });

  it("keeps an approved open claim instead of reposting an older TBA row", () => {
    const openShiftId = "5e000000-0000-4000-8000-000000000009";
    const tba: RosterPublishRow = { ...fileWithJordanBack, rowName: "TBA", userId: null, rosterName: null };
    const claim: RosterChanges["openShifts"][number] = {
      openShiftId,
      assignmentId: ASSIGNMENT,
      claimedBy: KAI,
      decidedAt: "2026-10-05T08:00:00Z",
    };
    const kept = compareWithLive({
      fileRows: [],
      fileOpenShifts: [tba],
      live: [liveAfterSwap],
      approvedChanges: [],
      approvedOpenShifts: [claim],
      period,
    });
    expect(kept.undoesOpenClaims).toHaveLength(1);
    expect(kept.rows).toContainEqual(expect.objectContaining({ userId: KAI }));
    expect(kept.openShifts).toEqual([]);
    const twoVacancies = compareWithLive({
      fileRows: [],
      fileOpenShifts: [tba, { ...tba }],
      live: [liveAfterSwap],
      approvedChanges: [],
      approvedOpenShifts: [claim],
      period,
    });
    expect(twoVacancies.rows).toHaveLength(1);
    expect(twoVacancies.rows[0]?.userId).toBe(KAI);
    expect(twoVacancies.openShifts).toEqual([tba]);
    const overridden = compareWithLive({
      fileRows: [],
      fileOpenShifts: [tba],
      live: [liveAfterSwap],
      approvedChanges: [],
      approvedOpenShifts: [claim],
      period,
      openChoices: { [openShiftId]: "file" },
    });
    expect(overridden.rows).toEqual([]);
    expect(overridden.openShifts).toEqual([tba]);
    expect(
      buildOpenShifts({ period, rows: overridden.openShifts, now: new Date("2026-09-01T00:00:00Z") }),
    ).toHaveLength(1);
  });

  it("checks Perth's start date over New Year and refuses long or unsorted payloads", () => {
    const night: RosterPublishRow = {
      ...fileWithJordanBack,
      startsAt: "2026-12-31T13:30:00.000Z",
      endsAt: "2027-01-01T00:00:00.000Z",
      kind: "night",
      shiftCode: "N",
    };
    const payload = buildPublishPayload({
      period: { start: "2026-12-28", end: "2027-01-10" },
      sourceName: null,
      rows: [night],
      choices: {},
    });
    expect(payload.assignments[0].startsAt).toBe("2026-12-31T13:30:00.000Z");
    expect(() =>
      buildPublishPayload({ period: { start: "2026-10-01", end: "2027-05-01" }, sourceName: null, rows: [] }),
    ).toThrow(/186/);
    expect(() =>
      buildPublishPayload({
        period,
        sourceName: null,
        rows: [{ ...fileWithJordanBack, userId: null, rosterName: null }],
      }),
    ).toThrow(/Sort/);
  });
});
