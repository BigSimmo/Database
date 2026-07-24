import { afterEach, describe, expect, it, vi } from "vitest";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const documentId = "11111111-1111-4111-8111-111111111111";
const missingDocumentId = "22222222-2222-4222-8222-222222222222";
const factId = "33333333-3333-4333-8333-333333333333";
const imageId = "44444444-4444-4444-8444-444444444444";
const committedGeneration = "55555555-5555-4555-8555-555555555555";
const replacementGeneration = "66666666-6666-4666-8666-666666666666";

type QueryError = { message: string };
type QueryResult = { data: unknown; error: QueryError | null };
type QueryOperation = "select" | "update" | "upsert" | "delete";
type QueryCall = {
  table: string;
  operation: QueryOperation;
  selected?: string;
  payload?: unknown;
  options?: unknown;
  filters: Array<{ column: string; value: unknown }>;
  inFilters: Array<{ column: string; values: unknown[] }>;
};
type QueryResolver = (call: QueryCall) => QueryResult;

class QueryBuilder implements PromiseLike<QueryResult> {
  constructor(
    private readonly call: QueryCall,
    private readonly resolveCall: QueryResolver,
  ) {}

  select(selected?: string) {
    this.call.selected = selected;
    return this;
  }

  update(payload: unknown) {
    this.call.operation = "update";
    this.call.payload = payload;
    return this;
  }

  upsert(payload: unknown, options?: unknown) {
    this.call.operation = "upsert";
    this.call.payload = payload;
    this.call.options = options;
    return this;
  }

  delete() {
    this.call.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.call.filters.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.call.inFilters.push({ column, values });
    return this;
  }

  maybeSingle() {
    return this.resolve();
  }

  single() {
    return this.resolve();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private resolve() {
    return Promise.resolve(this.resolveCall(this.call));
  }
}

function createSupabaseMock(resolveCall: QueryResolver) {
  const calls: QueryCall[] = [];
  return {
    calls,
    client: {
      from: vi.fn((table: string) => {
        const call: QueryCall = {
          table,
          operation: "select",
          filters: [],
          inFilters: [],
        };
        calls.push(call);
        return new QueryBuilder(call, resolveCall);
      }),
      rpc: vi.fn(async (name: string) => {
        // The document-admin routes consult the rate limiter before touching tables.
        // Return a not-limited row so these functional tests exercise the happy path.
        if (name === "consume_api_rate_limit" || name === "consume_api_subject_rate_limit") {
          return {
            data: [
              {
                limited: false,
                limit_value: 60,
                remaining: 59,
                retry_after_seconds: 60,
                reset_at: new Date(Date.now() + 60_000).toISOString(),
              },
            ],
            error: null,
          };
        }
        return { data: [], error: null };
      }),
    },
  };
}

function mockRouteRuntime(client: ReturnType<typeof createSupabaseMock>["client"]) {
  const invalidateRagCachesForOwner = vi.fn();
  class AuthenticationError extends Error {}
  vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
  vi.doMock("@/lib/supabase/auth", () => ({
    AuthenticationError,
    requireAuthenticatedUser: vi.fn(async () => ({ id: ownerId })),
    unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
  }));
  vi.doMock("@/lib/rag/rag", () => ({ invalidateRagCachesForOwner }));
  return { invalidateRagCachesForOwner };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("/api/documents/bulk", () => {
  it("applies owner-scoped metadata, title, and label edits", async () => {
    const supabase = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return {
          data: [{ id: documentId, title: "Old title", metadata: { retained: true } }],
          error: null,
        };
      }
      return { data: null, error: null };
    });
    const { invalidateRagCachesForOwner } = mockRouteRuntime(supabase.client);
    const { POST } = await import("../src/app/api/documents/bulk/route");

    const response = await POST(
      new Request("http://localhost/api/documents/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentIds: [documentId, missingDocumentId],
          metadata: { sourceStatus: "review_due", publisher: "WA Health" },
          titleEdit: { prefix: "Updated: ", find: "Old", replace: "New" },
          labels: {
            add: [{ label: "Cardiology", label_type: "topic", confidence: 0.9 }],
            remove: [{ label: "Legacy", label_type: "topic" }],
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      updatedCount: 1,
      missingDocumentIds: [missingDocumentId],
      results: [{ documentId, updated: true }],
    });

    const labelInsert = supabase.calls.find((call) => call.table === "document_labels" && call.operation === "upsert");
    expect(labelInsert?.payload).toEqual([
      expect.objectContaining({
        owner_id: ownerId,
        document_id: documentId,
        label: "cardiology",
        label_type: "topic",
        source: "manual",
      }),
    ]);

    const labelDelete = supabase.calls.find((call) => call.table === "document_labels" && call.operation === "delete");
    expect(labelDelete?.filters).toEqual(
      expect.arrayContaining([
        { column: "owner_id", value: ownerId },
        { column: "label", value: "legacy" },
        { column: "label_type", value: "topic" },
      ]),
    );
    expect(labelDelete?.inFilters).toContainEqual({ column: "document_id", values: [documentId] });

    const documentUpdate = supabase.calls.find((call) => call.table === "documents" && call.operation === "update");
    expect(documentUpdate?.payload).toMatchObject({
      title: "Updated: New title",
      metadata: {
        retained: true,
        document_status: "review_due",
        publisher: "WA Health",
        bulk_metadata_updated_by: ownerId,
      },
    });
    expect(documentUpdate?.filters).toEqual(
      expect.arrayContaining([
        { column: "id", value: documentId },
        { column: "owner_id", value: ownerId },
      ]),
    );
    expect(invalidateRagCachesForOwner).toHaveBeenCalledWith(ownerId);
  });

  it("does not leak the raw database error in a per-document bulk failure", async () => {
    const rawDbError = 'duplicate key value violates unique constraint "documents_secret_internal_idx"';
    const supabase = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return { data: [{ id: documentId, title: "Old title", metadata: {} }], error: null };
      }
      if (call.table === "documents" && call.operation === "update") {
        return { data: null, error: { message: rawDbError } };
      }
      return { data: null, error: null };
    });
    mockRouteRuntime(supabase.client);
    const { POST } = await import("../src/app/api/documents/bulk/route");

    const response = await POST(
      new Request("http://localhost/api/documents/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentIds: [documentId], metadata: { publisher: "WA Health" } }),
      }),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      updatedCount: number;
      results: Array<{ documentId: string; updated: boolean; error?: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: false, updatedCount: 0 });
    expect(payload.results[0]).toMatchObject({
      documentId,
      updated: false,
      error: "Bulk edit failed for this document.",
    });
    // The raw DB constraint text must never reach the client.
    expect(JSON.stringify(payload)).not.toContain("documents_secret_internal_idx");
    expect(JSON.stringify(payload)).not.toContain("unique constraint");
  });

  it("clears a stale publisher_code when publisherCode is null", async () => {
    const supabase = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return {
          data: [
            {
              id: documentId,
              title: "WACHS lithium",
              metadata: {
                publisher_code: "WACHS",
                publisher: "WA Country Health Service",
                jurisdiction: "Australia/WA",
              },
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mockRouteRuntime(supabase.client);
    const { POST } = await import("../src/app/api/documents/bulk/route");

    const response = await POST(
      new Request("http://localhost/api/documents/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentIds: [documentId],
          metadata: { publisherCode: null, publisher: "Unknown clinic", jurisdiction: null },
        }),
      }),
    );
    const payload = await response.json();
    const documentUpdate = supabase.calls.find((call) => call.table === "documents" && call.operation === "update");

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, updatedCount: 1 });
    expect(documentUpdate?.payload).toMatchObject({
      metadata: {
        publisher: "Unknown clinic",
        bulk_metadata_updated_by: ownerId,
      },
    });
    expect(documentUpdate?.payload).toEqual(
      expect.objectContaining({
        metadata: expect.not.objectContaining({
          publisher_code: expect.anything(),
          jurisdiction: expect.anything(),
        }),
      }),
    );
  });

  it("clears a stale publisher_code when only publisher/jurisdiction are corrected", async () => {
    const supabase = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return {
          data: [
            {
              id: documentId,
              title: "Misclassified note",
              metadata: {
                publisher_code: "WACHS",
                publisher: "WA Country Health Service",
                jurisdiction: "Australia/WA",
              },
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mockRouteRuntime(supabase.client);
    const { POST } = await import("../src/app/api/documents/bulk/route");

    const response = await POST(
      new Request("http://localhost/api/documents/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentIds: [documentId],
          metadata: { publisher: "Local clinic handout", jurisdiction: "Australia/WA" },
        }),
      }),
    );
    const documentUpdate = supabase.calls.find((call) => call.table === "documents" && call.operation === "update");

    expect(response.status).toBe(200);
    expect(documentUpdate?.payload).toMatchObject({
      metadata: {
        publisher: "Local clinic handout",
        jurisdiction: "Australia/WA",
      },
    });
    expect(
      (documentUpdate?.payload as { metadata?: Record<string, unknown> } | undefined)?.metadata,
    ).not.toHaveProperty("publisher_code");
  });

  it("rejects an unknown publisherCode with HTTP 400 before per-document updates", async () => {
    const supabase = createSupabaseMock(() => ({ data: null, error: null }));
    mockRouteRuntime(supabase.client);
    const { POST } = await import("../src/app/api/documents/bulk/route");

    const response = await POST(
      new Request("http://localhost/api/documents/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentIds: [documentId],
          metadata: { publisherCode: "NOT_A_REAL_CODE" },
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "Unknown publisher code." });
    expect(supabase.calls.some((call) => call.table === "documents")).toBe(false);
  });

  it("applies a registered publisherCode and overwrites publisher locality fields", async () => {
    const supabase = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return {
          data: [
            {
              id: documentId,
              title: "Lithium",
              metadata: { publisher_code: "BMJ", publisher: "BMJ Best Practice", jurisdiction: "International" },
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mockRouteRuntime(supabase.client);
    const { POST } = await import("../src/app/api/documents/bulk/route");

    const response = await POST(
      new Request("http://localhost/api/documents/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentIds: [documentId],
          metadata: { publisherCode: "WACHS" },
        }),
      }),
    );
    const documentUpdate = supabase.calls.find((call) => call.table === "documents" && call.operation === "update");

    expect(response.status).toBe(200);
    expect(documentUpdate?.payload).toMatchObject({
      metadata: {
        publisher_code: "WACHS",
        publisher: "WA Country Health Service",
        jurisdiction: "Australia/WA",
      },
    });
  });
});

describe("/api/documents/[id]/table-facts", () => {
  it("rejects an invalid document UUID before querying UUID columns", async () => {
    const supabase = createSupabaseMock(() => ({ data: null, error: null }));
    mockRouteRuntime(supabase.client);
    const { GET } = await import("../src/app/api/documents/[id]/table-facts/route");

    const response = await GET(new Request("http://localhost/api/documents/not-a-uuid/table-facts"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid document id.",
      code: "invalid_route_params",
    });
    expect(supabase.calls).toHaveLength(0);
  });

  it("updates a committed table fact and its linked source image", async () => {
    const supabase = createSupabaseMock((call) => {
      if (call.table === "documents") {
        return { data: { id: documentId, metadata: { index_generation_id: committedGeneration } }, error: null };
      }
      if (call.table === "document_table_facts" && call.operation === "select") {
        return {
          data: {
            id: factId,
            document_id: documentId,
            owner_id: ownerId,
            source_image_id: imageId,
            metadata: { index_generation_id: committedGeneration },
          },
          error: null,
        };
      }
      if (call.table === "document_table_facts" && call.operation === "update") {
        return { data: { id: factId, metadata: call.payload }, error: null };
      }
      if (call.table === "document_images" && call.operation === "select") {
        return { data: { id: imageId, metadata: { index_generation_id: committedGeneration } }, error: null };
      }
      return { data: null, error: null };
    });
    const { invalidateRagCachesForOwner } = mockRouteRuntime(supabase.client);
    const { PATCH } = await import("../src/app/api/documents/[id]/table-facts/route");

    const response = await PATCH(
      new Request(`http://localhost/api/documents/${documentId}/table-facts`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          factId,
          reviewClass: "clinical_useful",
          notes: "Verified against the source table",
          confidence: 0.95,
        }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(200);
    const factUpdate = supabase.calls.find(
      (call) => call.table === "document_table_facts" && call.operation === "update",
    );
    expect(factUpdate?.payload).toMatchObject({
      metadata: expect.objectContaining({
        index_generation_id: committedGeneration,
        review_class: "clinical_useful",
        reviewed_by: ownerId,
        review_confidence: 0.95,
      }),
    });
    const imageUpdate = supabase.calls.find((call) => call.table === "document_images" && call.operation === "update");
    expect(imageUpdate?.payload).toMatchObject({
      searchable: true,
      metadata: expect.objectContaining({
        index_generation_id: committedGeneration,
        review_class: "clinical_useful",
        reviewed_by: ownerId,
      }),
    });
    expect(invalidateRagCachesForOwner).toHaveBeenCalledWith(ownerId);
  });

  it("rejects a stale linked image before mutating the committed fact", async () => {
    const supabase = createSupabaseMock((call) => {
      if (call.table === "documents") {
        return { data: { id: documentId, metadata: { index_generation_id: committedGeneration } }, error: null };
      }
      if (call.table === "document_table_facts" && call.operation === "select") {
        return {
          data: {
            id: factId,
            document_id: documentId,
            owner_id: ownerId,
            source_image_id: imageId,
            metadata: { index_generation_id: committedGeneration },
          },
          error: null,
        };
      }
      if (call.table === "document_table_facts" && call.operation === "update") {
        return { data: { id: factId, metadata: call.payload }, error: null };
      }
      if (call.table === "document_images" && call.operation === "select") {
        return { data: { id: imageId, metadata: { index_generation_id: replacementGeneration } }, error: null };
      }
      return { data: null, error: null };
    });
    const { invalidateRagCachesForOwner } = mockRouteRuntime(supabase.client);
    const { PATCH } = await import("../src/app/api/documents/[id]/table-facts/route");

    const response = await PATCH(
      new Request(`http://localhost/api/documents/${documentId}/table-facts`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ factId, reviewClass: "bad_extraction" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(404);
    expect(supabase.calls.some((call) => call.table === "document_table_facts" && call.operation === "update")).toBe(
      false,
    );
    expect(supabase.calls.some((call) => call.table === "document_images" && call.operation === "update")).toBe(false);
    expect(invalidateRagCachesForOwner).not.toHaveBeenCalled();
  });
});
