import { describe, expect, it } from "vitest";

import { cmeEntryToRow, rowToCmeEntry } from "@/lib/cme/repository";

describe("row mapping", () => {
  it("round-trips an entry with several allocations", () => {
    const entry = {
      id: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-11",
      title: "Peer review group — September",
      allocations: [
        { category: "reviewing" as const, hours: 1 },
        { category: "measuring" as const, hours: 0.5 },
      ],
      reflection: "Brought two cases to the group.",
      costCents: null,
      transcribed: false,
      routineId: null,
      documentId: null,
      buckets: [],
    };
    const row = cmeEntryToRow(entry, "owner-1", "year-1");
    expect(row.activity_date).toBe("2026-09-11");
    expect(row.owner_id).toBe("owner-1");
    expect(
      rowToCmeEntry(
        { ...row, id: entry.id },
        entry.allocations.map((a) => ({ category: a.category, hours: a.hours })),
      ),
    ).toEqual(entry);
  });

  it("carries a cost through as whole cents, never a float", () => {
    const row = cmeEntryToRow({ ...baseEntry(), costCents: 124_000 }, "owner-1", "year-1");
    expect(row.cost_cents).toBe(124_000);
    expect(Number.isInteger(row.cost_cents)).toBe(true);
  });
});

function baseEntry() {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    date: "2026-08-22",
    title: "WA Branch training day",
    allocations: [{ category: "educational" as const, hours: 6 }],
    reflection: "",
    costCents: null,
    transcribed: false,
    routineId: null,
    documentId: null,
    buckets: [],
  };
}
