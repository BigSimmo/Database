import { afterEach, describe, expect, it, vi } from "vitest";

const documentId = "44444444-4444-4444-8444-444444444444";
const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

// Minimal chainable Supabase mock covering exactly the calls enqueueDocumentReindexJob makes:
//   documents.update(...).eq(...).eq(...)                     -> awaited { error }
//   ingestion_jobs.insert(...).select().single()              -> { data, error }
//   ingestion_jobs.select("id").eq(...).in(...).limit(1)      -> { data, error }  (23505 path)
//   documents.update(...).eq(...).eq(...).eq(...)             -> awaited { error }  (rollback)
type ClientConfig = {
  jobInsert?: { data: unknown; error: { code?: string; message: string } | null };
  competing?: { data: unknown[]; error: null };
};

function makeClient(cfg: ClientConfig) {
  const calls = { documentUpdates: 0, competingSelects: 0 };
  function builder(table: string) {
    const state = { isCompetingSelect: false };
    const b: Record<string, unknown> = {};
    b.update = () => {
      if (table === "documents") calls.documentUpdates += 1;
      return b;
    };
    b.insert = () => b;
    b.select = (cols?: string) => {
      if (cols === "id") state.isCompetingSelect = true;
      return b;
    };
    b.eq = () => b;
    b.in = () => b;
    b.limit = () => {
      calls.competingSelects += 1;
      return Promise.resolve(cfg.competing ?? { data: [], error: null });
    };
    b.single = () => Promise.resolve(cfg.jobInsert ?? { data: { id: "job1" }, error: null });
    // Awaiting a documents.update chain resolves here.
    b.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve, reject);
    return b;
  }
  return { client: { from: (t: string) => builder(t) }, calls };
}

async function load(cfg: ClientConfig = {}) {
  vi.doMock("@/lib/env", () => ({ env: { WORKER_MAX_ATTEMPTS: 3 } }));
  const { enqueueDocumentReindexJob } = await import("../src/lib/ingestion-enqueue");
  const { client, calls } = makeClient(cfg);
  return { enqueueDocumentReindexJob, client, calls };
}

const doc = { id: documentId, owner_id: ownerId, status: "queued", import_batch_id: null };

describe("enqueueDocumentReindexJob", () => {
  it("returns enqueued with the inserted job on success", async () => {
    const { enqueueDocumentReindexJob, client } = await load();
    const result = await enqueueDocumentReindexJob({ supabase: client as never, document: doc });
    expect(result).toEqual({ outcome: "enqueued", job: { id: "job1" } });
  });

  it("returns document_deleted on a 23503 FK violation", async () => {
    const { enqueueDocumentReindexJob, client } = await load({
      jobInsert: { data: null, error: { code: "23503", message: "fk" } },
    });
    const result = await enqueueDocumentReindexJob({ supabase: client as never, document: doc });
    expect(result).toEqual({ outcome: "document_deleted" });
  });

  it("returns already_active without rolling back when a competing open job exists (23505)", async () => {
    const { enqueueDocumentReindexJob, client, calls } = await load({
      jobInsert: { data: null, error: { code: "23505", message: "dup" } },
      competing: { data: [{ id: "other-job" }], error: null },
    });
    const result = await enqueueDocumentReindexJob({ supabase: client as never, document: doc });
    expect(result).toEqual({ outcome: "already_active" });
    // Only the initial queue-state update ran; no rollback update.
    expect(calls.documentUpdates).toBe(1);
    expect(calls.competingSelects).toBe(1);
  });

  it("rolls back the queue-state write when a 23505 leaves no competing open job", async () => {
    const { enqueueDocumentReindexJob, client, calls } = await load({
      jobInsert: { data: null, error: { code: "23505", message: "dup" } },
      competing: { data: [], error: null },
    });
    const result = await enqueueDocumentReindexJob({ supabase: client as never, document: doc });
    expect(result).toEqual({ outcome: "already_active" });
    // Initial queue update + the compensating rollback update.
    expect(calls.documentUpdates).toBe(2);
  });

  it("throws on an unexpected job-insert error", async () => {
    const { enqueueDocumentReindexJob, client } = await load({
      jobInsert: { data: null, error: { code: "42P01", message: "boom" } },
    });
    await expect(enqueueDocumentReindexJob({ supabase: client as never, document: doc })).rejects.toThrow("boom");
  });
});
