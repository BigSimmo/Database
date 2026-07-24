import { describe, expect, it, vi } from "vitest";

import {
  isStrandedQueuedDocument,
  listStrandedQueuedDocuments,
  recoverStrandedQueuedDocuments,
} from "../src/lib/stranded-queued-recovery";

describe("stranded queued-without-job recovery (#062)", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("reproduces the upload crash window: queued document with zero open jobs is stranded once aged", () => {
    // Upload inserts documents then ingestion_jobs as two PostgREST calls
    // (src/app/api/upload/route.ts). A process kill between them leaves this shape.
    const afterDocumentInsert = {
      status: "queued" as const,
      created_at: "2026-07-24T11:30:00.000Z",
      updated_at: "2026-07-24T11:30:00.000Z",
    };
    expect(
      isStrandedQueuedDocument({
        document: afterDocumentInsert,
        openJobCount: 0,
        minAgeMinutes: 15,
        now,
      }),
    ).toBe(true);
  });

  it("does not treat a young queued row as stranded (in-flight upload still finishing)", () => {
    expect(
      isStrandedQueuedDocument({
        document: {
          status: "queued",
          created_at: "2026-07-24T11:55:00.000Z",
          updated_at: "2026-07-24T11:55:00.000Z",
        },
        openJobCount: 0,
        minAgeMinutes: 15,
        now,
      }),
    ).toBe(false);
  });

  it("does not treat a queued row that already has an open job as stranded", () => {
    expect(
      isStrandedQueuedDocument({
        document: {
          status: "queued",
          created_at: "2026-07-24T11:00:00.000Z",
          updated_at: "2026-07-24T11:00:00.000Z",
        },
        openJobCount: 1,
        minAgeMinutes: 15,
        now,
      }),
    ).toBe(false);
  });

  it("lists only aged queued documents that lack open jobs, scoped by owner when provided", async () => {
    const ownerId = "22222222-2222-4222-8222-222222222222";
    const stranded = {
      id: "11111111-1111-4111-8111-111111111111",
      owner_id: ownerId,
      status: "queued",
      error_message: null,
      page_count: 0,
      chunk_count: 0,
      image_count: 0,
      import_batch_id: null,
      created_at: "2026-07-24T11:00:00.000Z",
      updated_at: "2026-07-24T11:00:00.000Z",
    };
    const withOpenJob = {
      ...stranded,
      id: "33333333-3333-4333-8333-333333333333",
    };

    const filters: Array<{ column: string; value: unknown }> = [];
    const documentsQuery: Record<string, unknown> = {};
    documentsQuery.select = vi.fn(() => documentsQuery);
    documentsQuery.eq = vi.fn((column: string, value: unknown) => {
      filters.push({ column, value });
      return documentsQuery;
    });
    documentsQuery.not = vi.fn((column: string, operator: string, value: unknown) => {
      filters.push({ column, value: `${operator}:${String(value)}` });
      return documentsQuery;
    });
    documentsQuery.lt = vi.fn(() => documentsQuery);
    documentsQuery.order = vi.fn(() => documentsQuery);
    documentsQuery.range = vi.fn(async () => ({ data: [stranded, withOpenJob], error: null }));

    let jobInCalls = 0;
    let recoveryJobStatuses: string[] = [];
    const jobsQuery: Record<string, unknown> = {};
    jobsQuery.select = vi.fn(() => jobsQuery);
    jobsQuery.in = vi.fn((column: string, values: string[]) => {
      jobInCalls += 1;
      if (jobInCalls >= 2) {
        if (column === "status") recoveryJobStatuses = [...values];
        return Promise.resolve({ data: [{ document_id: withOpenJob.id }], error: null });
      }
      return jobsQuery;
    });

    const supabase = {
      from: vi.fn((table: string) => (table === "documents" ? documentsQuery : jobsQuery)),
    };

    const listed = await listStrandedQueuedDocuments({
      supabase: supabase as never,
      ownerId,
      minAgeMinutes: 15,
      limit: 20,
      now,
    });

    expect(filters).toContainEqual({ column: "owner_id", value: ownerId });
    expect(filters).toContainEqual({ column: "status", value: "queued" });
    expect(filters).toContainEqual({ column: "owner_id", value: "is:null" });
    expect(recoveryJobStatuses).toEqual(["pending", "processing", "failed"]);
    expect(listed.map((document) => document.id)).toEqual([stranded.id]);
  });

  it("pages past open-job queued rows so stranded candidates are not starved by the limit", async () => {
    const ownerId = "22222222-2222-4222-8222-222222222222";
    const stranded = {
      id: "11111111-1111-4111-8111-111111111111",
      owner_id: ownerId,
      status: "queued",
      error_message: null,
      page_count: 0,
      chunk_count: 0,
      image_count: 0,
      import_batch_id: null,
      created_at: "2026-07-24T11:00:00.000Z",
      updated_at: "2026-07-24T11:00:00.000Z",
    };
    const openJobIds = Array.from(
      { length: 20 },
      (_, index) => `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
    );
    const openJobRows = openJobIds.map((id, index) => ({
      ...stranded,
      id,
      created_at: `2026-07-24T10:${String(index).padStart(2, "0")}:00.000Z`,
      updated_at: `2026-07-24T10:${String(index).padStart(2, "0")}:00.000Z`,
    }));

    let page = 0;
    const documentsQuery: Record<string, unknown> = {};
    documentsQuery.select = vi.fn(() => documentsQuery);
    documentsQuery.eq = vi.fn(() => documentsQuery);
    documentsQuery.not = vi.fn(() => documentsQuery);
    documentsQuery.lt = vi.fn(() => documentsQuery);
    documentsQuery.order = vi.fn(() => documentsQuery);
    documentsQuery.range = vi.fn(async () => {
      page += 1;
      if (page === 1) return { data: openJobRows, error: null };
      if (page === 2) return { data: [stranded], error: null };
      return { data: [], error: null };
    });

    let pendingDocumentIds: string[] = [];
    const jobsQuery: Record<string, unknown> = {};
    jobsQuery.select = vi.fn(() => jobsQuery);
    jobsQuery.in = vi.fn((column: string, values: string[]) => {
      if (column === "document_id") {
        pendingDocumentIds = [...values];
        return jobsQuery;
      }
      return Promise.resolve({
        data: pendingDocumentIds.filter((id) => openJobIds.includes(id)).map((document_id) => ({ document_id })),
        error: null,
      });
    });

    const supabase = {
      from: vi.fn((table: string) => (table === "documents" ? documentsQuery : jobsQuery)),
    };

    const listed = await listStrandedQueuedDocuments({
      supabase: supabase as never,
      ownerId,
      minAgeMinutes: 15,
      limit: 1,
      now,
    });

    expect(page).toBeGreaterThanOrEqual(2);
    expect(listed.map((document) => document.id)).toEqual([stranded.id]);
  });

  it("recovers with the atomic owner-scoped RPC and treats an existing job as idempotent", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { outcome: "queued", job: { id: "job-1" } }, error: null })
      .mockResolvedValueOnce({ data: { outcome: "ingestion_active" }, error: null });

    const docs = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        owner_id: "22222222-2222-4222-8222-222222222222",
        status: "queued",
        error_message: null,
        page_count: 0,
        chunk_count: 0,
        image_count: 0,
        import_batch_id: null,
        created_at: "2026-07-24T11:00:00.000Z",
        updated_at: "2026-07-24T11:00:00.000Z",
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        owner_id: "22222222-2222-4222-8222-222222222222",
        status: "queued",
        error_message: null,
        page_count: 0,
        chunk_count: 0,
        image_count: 0,
        import_batch_id: null,
        created_at: "2026-07-24T11:00:00.000Z",
        updated_at: "2026-07-24T11:00:00.000Z",
      },
    ];

    const results = await recoverStrandedQueuedDocuments({ supabase: { rpc } as never, documents: docs });
    expect(results).toEqual([
      { documentId: docs[0].id, outcome: "enqueued", jobId: "job-1" },
      { documentId: docs[1].id, outcome: "already_active" },
    ]);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "request_ingestion_reindex_if_agent_idle", {
      p_document_id: docs[0].id,
      p_owner_id: docs[0].owner_id,
      p_stale_before: expect.any(String),
      p_max_attempts: expect.any(Number),
    });
  });

  it("fails closed for an ownerless candidate instead of issuing an unscoped recovery mutation", async () => {
    const rpc = vi.fn();
    const document = {
      id: "11111111-1111-4111-8111-111111111111",
      owner_id: null,
      status: "queued",
      error_message: null,
      page_count: 0,
      chunk_count: 0,
      image_count: 0,
      import_batch_id: null,
      created_at: "2026-07-24T11:00:00.000Z",
      updated_at: "2026-07-24T11:00:00.000Z",
    };

    await expect(
      recoverStrandedQueuedDocuments({ supabase: { rpc } as never, documents: [document] }),
    ).resolves.toEqual([{ documentId: document.id, outcome: "skipped_ownerless" }]);
    expect(rpc).not.toHaveBeenCalled();
  });
});
