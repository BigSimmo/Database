import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@/lib/http";
import {
  CME_MAX_ENTRIES,
  cmeEntryToRow,
  fetchOwnerCmeEntries,
  fetchOwnerCmeYear,
  insertCmeEntry,
  rowToCmeEntry,
} from "@/lib/cme/repository";
import type { CmeEntry } from "@/lib/cme/types";

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

  it("round-trips transcribed:true, a non-null cost, and a non-empty buckets array", () => {
    // The two tests above only ever exercise transcribed:false, costCents:null and
    // buckets:[] — the falsy/empty branch of every one of those fields. This proves the
    // other branch: cmeEntryToRow stamps a transcribed_at instant, and rowToCmeEntry reads
    // it, the cost and the buckets back out unchanged.
    const entry = {
      id: "44444444-4444-4444-8444-444444444444",
      date: "2026-09-18",
      title: "CPD conference",
      allocations: [{ category: "measuring" as const, hours: 3 }],
      reflection: "Attended remotely.",
      costCents: 4_500,
      transcribed: true,
      routineId: null,
      documentId: null,
      buckets: ["conference", "external"],
    };
    const row = cmeEntryToRow(entry, "owner-1", "year-1");
    expect(row.transcribed_at).not.toBeNull();
    expect(row.cost_cents).toBe(4_500);
    expect(row.buckets).toEqual(["conference", "external"]);

    const result = rowToCmeEntry(
      { ...row, id: entry.id },
      entry.allocations.map((a) => ({ category: a.category, hours: a.hours })),
    );
    expect(result).toEqual(entry);
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

// --- fake client -----------------------------------------------------------
//
// A real supabase-js query builder is thenable: awaiting it after any chain of
// filter/modifier calls resolves to { data, error }. Each `.from(table)` call gets its
// own chain (mirroring the real client, which builds a fresh query per call) so a
// function that queries several tables — or the same table twice, such as
// insertCmeEntry's cleanup delete — can be driven with a distinct queued response per
// call while every filter call it made stays inspectable afterwards.

type FakeResponse = { data: unknown; error: { message: string } | null };

function makeChain(response: FakeResponse) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    single: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(response).then(resolve, reject);
    },
  };
  return chain;
}

function fakeClient(responsesByTable: Record<string, FakeResponse[]>) {
  const calls: Array<{ table: string; chain: ReturnType<typeof makeChain> }> = [];
  const queues = new Map(Object.entries(responsesByTable).map(([table, rows]) => [table, [...rows]]));
  const from = vi.fn((table: string) => {
    const queue = queues.get(table);
    if (!queue || queue.length === 0) {
      throw new Error(`fakeClient: no queued response left for table "${table}"`);
    }
    const chain = makeChain(queue.shift()!);
    calls.push({ table, chain });
    return chain;
  });
  return { from, calls };
}

const YEAR_ROW = {
  id: "year-1",
  owner_id: "owner-1",
  year: 2026,
  total_hours: 50,
  confirmed_on: "2026-01-01",
  confirmed_source: "college handbook",
  closed_at: null,
  shortfall_note: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("fetchOwnerCmeYear", () => {
  it("filters cme_years by owner_id and year on the same chain as from()", async () => {
    // The owner predicate rides the same chain as .from() — the only thing
    // npm run check:owner-scope can prove, and the only real protection RLS leaves in
    // application code for these tables. Asserting the mock was called with it, not just
    // that a result came back, is the point of this test.
    const client = fakeClient({
      cme_years: [{ data: YEAR_ROW, error: null }],
      cme_requirements: [{ data: [], error: null }],
    });
    await fetchOwnerCmeYear(client as never, "owner-1", 2026);
    expect(client.calls[0].table).toBe("cme_years");
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("year", 2026);
  });

  it("filters the cme_requirements read by owner_id and year_id on the same chain as from()", async () => {
    const client = fakeClient({
      cme_years: [{ data: YEAR_ROW, error: null }],
      cme_requirements: [{ data: [], error: null }],
    });
    await fetchOwnerCmeYear(client as never, "owner-1", 2026);
    expect(client.calls[1].table).toBe("cme_requirements");
    expect(client.calls[1].chain.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(client.calls[1].chain.eq).toHaveBeenCalledWith("year_id", YEAR_ROW.id);
  });

  it("applies CME_MAX_ENTRIES as a .limit() on the requirements read", async () => {
    const client = fakeClient({
      cme_years: [{ data: YEAR_ROW, error: null }],
      cme_requirements: [{ data: [], error: null }],
    });
    await fetchOwnerCmeYear(client as never, "owner-1", 2026);
    expect(client.calls[1].chain.limit).toHaveBeenCalledWith(CME_MAX_ENTRIES);
  });

  it("refuses to run without an owner rather than returning another tenant's year", async () => {
    const client = fakeClient({});
    await expect(fetchOwnerCmeYear(client as never, "", 2026)).rejects.toThrow(/owner/i);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns null and never queries cme_requirements when no year row exists yet", async () => {
    const client = fakeClient({
      cme_years: [{ data: null, error: null }],
    });
    const result = await fetchOwnerCmeYear(client as never, "owner-1", 2026);
    expect(result).toBeNull();
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].table).toBe("cme_years");
  });
});

describe("fetchOwnerCmeEntries", () => {
  it("filters by owner_id and year_id on the same chain as from()", async () => {
    const client = fakeClient({ cme_entries: [{ data: [], error: null }] });
    await fetchOwnerCmeEntries(client as never, "owner-1", "year-1");
    expect(client.calls[0].table).toBe("cme_entries");
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("year_id", "year-1");
  });

  it("applies CME_MAX_ENTRIES as a .limit()", async () => {
    const client = fakeClient({ cme_entries: [{ data: [], error: null }] });
    await fetchOwnerCmeEntries(client as never, "owner-1", "year-1");
    expect(client.calls[0].chain.limit).toHaveBeenCalledWith(CME_MAX_ENTRIES);
  });

  it("refuses to run without an owner rather than returning another tenant's entries", async () => {
    const client = fakeClient({});
    await expect(fetchOwnerCmeEntries(client as never, "", "year-1")).rejects.toThrow(/owner/i);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps each row's joined cme_allocations onto the returned entry", async () => {
    const client = fakeClient({
      cme_entries: [
        {
          data: [
            {
              id: "e1",
              activity_date: "2026-09-01",
              title: "Grand round",
              reflection: "",
              cost_cents: null,
              transcribed_at: null,
              routine_id: null,
              document_id: null,
              buckets: [],
              cme_allocations: [{ category: "educational", hours: 2 }],
            },
          ],
          error: null,
        },
      ],
    });
    const entries = await fetchOwnerCmeEntries(client as never, "owner-1", "year-1");
    expect(entries).toHaveLength(1);
    expect(entries[0].allocations).toEqual([{ category: "educational", hours: 2 }]);
  });
});

describe("insertCmeEntry", () => {
  const ENTRY: CmeEntry = {
    id: "33333333-3333-4333-8333-333333333333",
    date: "2026-09-15",
    title: "Journal club",
    allocations: [
      { category: "educational", hours: 2 },
      { category: "reviewing", hours: 1 },
    ],
    reflection: "Discussed a new RCT.",
    costCents: 5_000,
    transcribed: true,
    routineId: null,
    documentId: null,
    buckets: ["journal-club"],
  };

  function entryRowResponse(overrides: Record<string, unknown> = {}): FakeResponse {
    return {
      data: {
        id: ENTRY.id,
        owner_id: "owner-1",
        year_id: "year-1",
        activity_date: ENTRY.date,
        title: ENTRY.title,
        reflection: ENTRY.reflection,
        cost_cents: ENTRY.costCents,
        transcribed_at: "2026-09-15T00:00:00.000Z",
        routine_id: null,
        document_id: null,
        buckets: ENTRY.buckets,
        ...overrides,
      },
      error: null,
    };
  }

  it("refuses to run without an owner rather than writing another tenant's record", async () => {
    const client = fakeClient({});
    await expect(insertCmeEntry(client as never, "", "year-1", ENTRY)).rejects.toThrow(/owner/i);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects zero allocations before touching the database", async () => {
    const client = fakeClient({});
    const entry = { ...ENTRY, allocations: [] };
    const promise = insertCmeEntry(client as never, "owner-1", "year-1", entry);
    await expect(promise).rejects.toThrow(PublicApiError);
    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects two allocations sharing a category before touching the database", async () => {
    const client = fakeClient({});
    const entry = {
      ...ENTRY,
      allocations: [
        { category: "educational" as const, hours: 1 },
        { category: "educational" as const, hours: 2 },
      ],
    };
    const promise = insertCmeEntry(client as never, "owner-1", "year-1", entry);
    await expect(promise).rejects.toThrow(PublicApiError);
    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("writes owner_id on both the entry row and every allocation row", async () => {
    const client = fakeClient({
      cme_entries: [entryRowResponse()],
      cme_allocations: [
        {
          data: [
            { category: "educational", hours: 2 },
            { category: "reviewing", hours: 1 },
          ],
          error: null,
        },
      ],
    });
    const result = await insertCmeEntry(client as never, "owner-1", "year-1", ENTRY);

    expect(client.calls[0].table).toBe("cme_entries");
    expect(client.calls[0].chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: "owner-1", id: ENTRY.id }),
    );

    expect(client.calls[1].table).toBe("cme_allocations");
    expect(client.calls[1].chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ owner_id: "owner-1", entry_id: ENTRY.id, category: "educational" }),
      expect.objectContaining({ owner_id: "owner-1", entry_id: ENTRY.id, category: "reviewing" }),
    ]);

    expect(result.id).toBe(ENTRY.id);
    expect(result.allocations).toEqual(ENTRY.allocations);
  });

  it("deletes the just-created entry, owner-scoped, when the allocations insert fails", async () => {
    const client = fakeClient({
      cme_entries: [entryRowResponse(), { data: null, error: null }],
      cme_allocations: [{ data: null, error: { message: "allocations insert failed" } }],
    });
    await expect(insertCmeEntry(client as never, "owner-1", "year-1", ENTRY)).rejects.toThrow(
      "allocations insert failed",
    );

    expect(client.calls).toHaveLength(3);
    const deleteCall = client.calls[2];
    expect(deleteCall.table).toBe("cme_entries");
    expect(deleteCall.chain.delete).toHaveBeenCalled();
    expect(deleteCall.chain.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(deleteCall.chain.eq).toHaveBeenCalledWith("id", ENTRY.id);
  });

  it("surfaces both errors when the cleanup delete itself fails", async () => {
    const client = fakeClient({
      cme_entries: [entryRowResponse(), { data: null, error: { message: "delete failed" } }],
      cme_allocations: [{ data: null, error: { message: "allocations insert failed" } }],
    });
    await expect(insertCmeEntry(client as never, "owner-1", "year-1", ENTRY)).rejects.toThrow(
      "allocations insert failed (cleanup also failed: delete failed)",
    );
  });
});
