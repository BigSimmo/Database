import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = "supabase-ingest-webhook-secret-1";
const documentId = "44444444-4444-4444-8444-444444444444";
const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

type LoadOptions = {
  env?: Record<string, unknown>;
  demo?: boolean;
  safety?: unknown;
  document?: unknown;
  enqueueResult?: unknown;
};

async function loadRoute(options: LoadOptions = {}) {
  const rpcMock = vi.fn(async () => ({ error: null }));
  const maybeSingle = vi.fn(async () => ({
    data: options.document ?? { id: documentId, owner_id: ownerId, status: "queued", import_batch_id: null },
    error: null,
  }));
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = maybeSingle;
  const client = { from: vi.fn(() => chain), rpc: rpcMock };

  const checkIngestionMutationSafety = vi.fn(async () => options.safety ?? { ok: true });
  const enqueueDocumentReindexJob = vi.fn(async () => options.enqueueResult ?? { outcome: "enqueued", job: {} });

  vi.doMock("@/lib/env", () => ({
    env: { SUPABASE_INGESTION_WEBHOOK_SECRET: SECRET, WORKER_STALE_AFTER_MINUTES: 45, ...(options.env ?? {}) },
    isDemoMode: () => options.demo ?? false,
  }));
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
  vi.doMock("@/lib/ingestion-mutation-safety", () => ({ checkIngestionMutationSafety }));
  vi.doMock("@/lib/ingestion-enqueue", () => ({ enqueueDocumentReindexJob }));

  const route = await import("../src/app/api/webhooks/supabase/document-change/route");
  return { route, rpcMock, checkIngestionMutationSafety, enqueueDocumentReindexJob };
}

function post(body: unknown, headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) {
  return new Request("http://localhost/api/webhooks/supabase/document-change", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const insertEvent = (record: Record<string, unknown>) => ({ type: "INSERT", table: "documents", record });

describe("POST /api/webhooks/supabase/document-change", () => {
  it("returns 503 when the secret is unset", async () => {
    const { route } = await loadRoute({ env: { SUPABASE_INGESTION_WEBHOOK_SECRET: undefined } });
    const response = await route.POST(post(insertEvent({ id: documentId, owner_id: ownerId })));
    expect(response.status).toBe(503);
  });

  it("returns 401 on a bad secret", async () => {
    const { route } = await loadRoute();
    const response = await route.POST(
      post(insertEvent({ id: documentId, owner_id: ownerId }), { authorization: "Bearer wrong" }),
    );
    expect(response.status).toBe(401);
  });

  it("skips in demo mode", async () => {
    const { route, enqueueDocumentReindexJob } = await loadRoute({ demo: true });
    const response = await route.POST(post(insertEvent({ id: documentId, owner_id: ownerId })));
    const body = await response.json();
    expect(body.skipped).toBe(true);
    expect(enqueueDocumentReindexJob).not.toHaveBeenCalled();
  });

  it("skips a plain UPDATE with no reindex flag (loop-safety)", async () => {
    const { route, enqueueDocumentReindexJob } = await loadRoute();
    const response = await route.POST(
      post({ type: "UPDATE", table: "documents", record: { id: documentId, owner_id: ownerId, status: "indexed" } }),
    );
    const body = await response.json();
    expect(body.reason).toBe("no_actionable_transition");
    expect(enqueueDocumentReindexJob).not.toHaveBeenCalled();
  });

  it("skips DELETE and non-documents tables", async () => {
    const { route } = await loadRoute();
    const del = await route.POST(post({ type: "DELETE", table: "documents", old_record: { id: documentId } }));
    expect((await del.json()).reason).toBe("delete_event");
    const other = await route.POST(post({ type: "INSERT", table: "rag_queries", record: { id: documentId } }));
    expect((await other.json()).reason).toBe("not_documents_table");
  });

  it("enqueues a reindex job on a fresh INSERT", async () => {
    const { route, enqueueDocumentReindexJob } = await loadRoute();
    const response = await route.POST(post(insertEvent({ id: documentId, owner_id: ownerId, status: "queued" })));
    const body = await response.json();
    expect(response.status).toBe(202);
    expect(body.enqueued).toBe(true);
    expect(enqueueDocumentReindexJob).toHaveBeenCalledTimes(1);
  });

  it("acts on an explicit reindex flag and clears it", async () => {
    const { route, rpcMock, enqueueDocumentReindexJob } = await loadRoute({
      document: { id: documentId, owner_id: ownerId, status: "indexed", import_batch_id: null },
    });
    const response = await route.POST(
      post({
        type: "UPDATE",
        table: "documents",
        record: { id: documentId, owner_id: ownerId, status: "indexed", metadata: { reindex_requested: true } },
      }),
    );
    expect(response.status).toBe(202);
    expect(enqueueDocumentReindexJob).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("apply_document_metadata_patch", {
      p_document_id: documentId,
      p_metadata_patch: { reindex_requested: false },
    });
  });

  it("treats an active job as an idempotent skip without enqueueing", async () => {
    const { route, enqueueDocumentReindexJob } = await loadRoute({
      safety: {
        ok: false,
        status: 409,
        reason: "active_jobs",
        message: "busy",
        activeJobs: [],
        staleProcessingJobs: [],
      },
    });
    const response = await route.POST(post(insertEvent({ id: documentId, owner_id: ownerId, status: "queued" })));
    const body = await response.json();
    expect(body.reason).toBe("already_active");
    expect(enqueueDocumentReindexJob).not.toHaveBeenCalled();
  });

  it("returns 503 when Supabase is unavailable so the webhook retries", async () => {
    const { route } = await loadRoute({
      safety: {
        ok: false,
        status: 503,
        reason: "supabase_unavailable",
        message: "down",
        activeJobs: [],
        staleProcessingJobs: [],
      },
    });
    const response = await route.POST(post(insertEvent({ id: documentId, owner_id: ownerId, status: "queued" })));
    expect(response.status).toBe(503);
  });
});
