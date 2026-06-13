import { afterEach, describe, expect, it, vi } from "vitest";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const documentId = "11111111-1111-4111-8111-111111111111";
const otherDocumentId = "22222222-2222-4222-8222-222222222222";
const imageId = "33333333-3333-4333-8333-333333333333";
const token = "valid-token";

type QueryError = { message: string };
type QueryResult = { data: unknown; error: QueryError | null };
type QueryFilter = { column: string; value: unknown };
type QueryInFilter = { column: string; values: unknown[] };
type QueryCall = {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  selected?: string;
  range?: { from: number; to: number };
  orFilters: string[];
  filters: QueryFilter[];
  inFilters: QueryInFilter[];
  overlapsFilters: QueryInFilter[];
  insertPayload?: unknown;
  updatePayload?: unknown;
  limitCount?: number;
  maybeSingle: boolean;
  single: boolean;
};
type QueryResolver = (call: QueryCall) => QueryResult;

function ok(data: unknown): QueryResult {
  return { data, error: null };
}

function fail(message: string): QueryResult {
  return { data: null, error: { message } };
}

class QueryBuilder implements PromiseLike<QueryResult> {
  constructor(
    private readonly call: QueryCall,
    private readonly resolver: QueryResolver,
  ) {}

  select(selected?: string) {
    this.call.selected = selected;
    return this;
  }

  insert(payload: unknown) {
    this.call.operation = "insert";
    this.call.insertPayload = payload;
    return this;
  }

  update(payload: unknown) {
    this.call.operation = "update";
    this.call.updatePayload = payload;
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

  neq(column: string, value: unknown) {
    this.call.filters.push({ column, value });
    return this;
  }

  not(column: string, _operator: string, value: unknown) {
    this.call.filters.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.call.inFilters.push({ column, values });
    return this;
  }

  overlaps(column: string, values: unknown[]) {
    this.call.overlapsFilters.push({ column, values });
    return this;
  }

  order() {
    return this;
  }

  range(from: number, to: number) {
    this.call.range = { from, to };
    return this;
  }

  or(filter: string) {
    this.call.orFilters.push(filter);
    return this;
  }

  limit(count: number) {
    this.call.limitCount = count;
    return this;
  }

  single() {
    this.call.single = true;
    return this.resolve();
  }

  maybeSingle() {
    this.call.maybeSingle = true;
    return this.resolve();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private resolve() {
    return Promise.resolve(this.resolver(this.call));
  }
}

function createSupabaseMock(resolve: QueryResolver = () => ok([])) {
  const calls: QueryCall[] = [];
  const listUsers = vi.fn(
    async (): Promise<{
      data: { users: Array<{ id: string; email?: string | null }>; nextPage: number };
      error: QueryError | null;
    }> => ({ data: { users: [], nextPage: 0 }, error: null }),
  );
  const upload = vi.fn(async (...args: [string, unknown, Record<string, unknown>]) => {
    void args;
    return {
      data: { path: "uploaded" },
      error: null,
    };
  });
  const createSignedUrl = vi.fn(async (path: string) => ({
    data: { signedUrl: `https://signed.local/${path}` },
    error: null,
  }));
  const remove = vi.fn(async (...args: [string[]]) => {
    void args;
    return { data: [], error: null };
  });
  const storageFrom = vi.fn(() => ({ upload, createSignedUrl, remove }));
  const getUser = vi.fn(async (receivedToken?: string) =>
    receivedToken === token
      ? { data: { user: { id: userId } }, error: null }
      : { data: { user: null }, error: { message: "Invalid token" } },
  );
  const rpc = vi.fn(async () => ok([]));
  const client = {
    auth: { getUser, admin: { listUsers } },
    calls,
    from: vi.fn((table: string) => {
      const call: QueryCall = {
        table,
        operation: "select",
        orFilters: [],
        filters: [],
        inFilters: [],
        overlapsFilters: [],
        maybeSingle: false,
        single: false,
      };
      calls.push(call);
      return new QueryBuilder(call, resolve);
    }),
    rpc,
    storage: { from: storageFrom },
    storageMocks: { upload, createSignedUrl, remove, storageFrom },
  };

  return client;
}

function mockRuntime(
  client: ReturnType<typeof createSupabaseMock>,
  ragMock?: Record<string, unknown>,
  options: { localNoAuth?: boolean; localOwnerEmail?: string } = {},
) {
  vi.resetModules();
  vi.doUnmock("@/lib/rag");
  vi.doUnmock("@/lib/openai");
  vi.doUnmock("@/lib/document-enrichment");
  vi.doUnmock("@/lib/deep-memory");
  vi.doMock("@/lib/env", () => ({
    env: {
      MAX_UPLOAD_MB: 150,
      SUPABASE_DOCUMENT_BUCKET: "clinical-documents",
      SUPABASE_IMAGE_BUCKET: "clinical-images",
      RAG_SEARCH_CACHE_TTL_MS: 0,
      RAG_SEARCH_CACHE_SIZE: 0,
      RAG_ANSWER_CACHE_TTL_MS: 0,
      RAG_ANSWER_CACHE_SIZE: 0,
      RAG_AWAIT_QUERY_LOGS: false,
      LOCAL_NO_AUTH_OWNER_EMAIL: options.localOwnerEmail,
    },
    isDemoMode: () => false,
    isLocalNoAuthMode: () => Boolean(options.localNoAuth),
    requireOpenAIEnv: () => undefined,
    requireServerEnv: () => undefined,
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => client,
  }));
  if (ragMock) {
    vi.doMock("@/lib/rag", () => ragMock);
  }
}

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

function localPortRequest(port: number, path: string, init?: RequestInit) {
  return new Request(`http://localhost:${port}${path}`, init);
}

function authenticatedRequest(path: string, init?: RequestInit) {
  return request(path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

async function payload(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("private document API access", () => {
  it("rejects local no-auth private calls from unmanaged localhost ports before Supabase access", async () => {
    const client = createSupabaseMock();
    mockRuntime(client, undefined, { localNoAuth: true });
    const { GET } = await import("../src/app/api/documents/route");

    const response = await GET(localPortRequest(3000, "/api/documents"));

    expect(response.status).toBe(401);
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects managed-port private calls with stale localhost referers before Supabase access", async () => {
    const client = createSupabaseMock();
    mockRuntime(client, undefined, { localNoAuth: true });
    const { GET } = await import("../src/app/api/documents/route");

    const response = await GET(
      localPortRequest(4298, "/api/documents", {
        headers: {
          referer: "http://localhost:3000/",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("resolves local no-auth owner from documents before listing auth users", async () => {
    const documents = [{ id: documentId, owner_id: userId, title: "Owned document" }];
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.selected === "owner_id") {
        return ok({ owner_id: userId });
      }
      if (call.table === "documents") {
        return ok(documents);
      }
      return ok([]);
    });
    mockRuntime(client, undefined, { localNoAuth: true });
    const { GET } = await import("../src/app/api/documents/route");

    const response = await GET(localPortRequest(4298, "/api/documents"));
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.documents).toEqual(documents.map((document) => ({ ...document, labels: [], summary: null })));
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.calls[0]).toMatchObject({ table: "documents", selected: "owner_id" });
  });

  it("resolves configured local no-auth owner email before document fallback", async () => {
    const documents = [{ id: documentId, owner_id: userId, title: "Configured owner document" }];
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.selected === "owner_id") {
        return ok({ owner_id: otherUserId });
      }
      if (call.table === "documents") {
        return ok(documents);
      }
      return ok([]);
    });
    client.auth.admin.listUsers.mockResolvedValueOnce({
      data: { users: [{ id: userId, email: "clinician@example.test" }], nextPage: 0 },
      error: null,
    });
    mockRuntime(client, undefined, { localNoAuth: true, localOwnerEmail: "clinician@example.test" });
    const { GET } = await import("../src/app/api/documents/route");

    const response = await GET(localPortRequest(4298, "/api/documents"));
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.documents).toEqual(documents.map((document) => ({ ...document, labels: [], summary: null })));
    expect(client.auth.admin.listUsers.mock.invocationCallOrder[0]).toBeLessThan(
      client.from.mock.invocationCallOrder[0],
    );
    expect(client.calls.some((call) => call.selected === "owner_id")).toBe(false);
    expect(client.calls[0].filters).toContainEqual({ column: "owner_id", value: userId });
  });

  it("rejects unauthenticated document listing", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/route");

    const response = await GET(request("/api/documents"));

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: "Authentication required." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("filters authenticated document listing by owner", async () => {
    const documents = [{ id: documentId, owner_id: userId, title: "Owned document" }];
    const client = createSupabaseMock((call) => (call.table === "documents" ? ok(documents) : ok([])));
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/route");

    const response = await GET(authenticatedRequest("/api/documents"));
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.documents).toEqual(documents.map((document) => ({ ...document, labels: [], summary: null })));
    expect(body.pagination).toMatchObject({ limit: 100, offset: 0, nextOffset: 1, hasMore: false });
    expect(client.calls[0].filters).toContainEqual({ column: "owner_id", value: userId });
    expect(client.calls[0].selected).toContain("id,owner_id,title");
    expect(client.calls[0].selected).not.toBe("*");
    expect(client.calls[0].range).toEqual({ from: 0, to: 99 });
  });

  it("does not return raw internal database errors", async () => {
    const client = createSupabaseMock(() => fail("secret storage path and connection details"));
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/route");

    const response = await GET(authenticatedRequest("/api/documents"));

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({ error: "Request failed." });
  });

  it("allows document signed URLs only for owned documents", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.filters.some((filter) => filter.value === userId)) {
        return ok({ storage_path: `${userId}/documents/${documentId}/source.pdf`, file_type: "application/pdf" });
      }
      return ok(null);
    });
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/signed-url/route");

    const response = await GET(authenticatedRequest(`/api/documents/${documentId}/signed-url`), {
      params: Promise.resolve({ id: documentId }),
    });
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.url).toContain(`${userId}/documents/${documentId}/source.pdf`);
    expect(client.storageMocks.createSignedUrl).toHaveBeenCalledWith(
      `${userId}/documents/${documentId}/source.pdf`,
      600,
    );
  });

  it("rejects document signed URLs for another user's document", async () => {
    const client = createSupabaseMock(() => ok(null));
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/signed-url/route");

    const response = await GET(authenticatedRequest(`/api/documents/${otherDocumentId}/signed-url`), {
      params: Promise.resolve({ id: otherDocumentId }),
    });

    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({ error: "Document not found." });
    expect(client.storageMocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("allows image signed URLs only when the parent document is owned", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "document_images") {
        return ok({
          document_id: documentId,
          storage_path: `${userId}/images/${imageId}.png`,
          mime_type: "image/png",
          caption: "Owned image",
        });
      }
      if (call.table === "documents" && call.filters.some((filter) => filter.value === userId)) {
        return ok({ id: documentId });
      }
      return ok(null);
    });
    mockRuntime(client);
    const { GET } = await import("../src/app/api/images/[id]/signed-url/route");

    const response = await GET(authenticatedRequest(`/api/images/${imageId}/signed-url`), {
      params: Promise.resolve({ id: imageId }),
    });
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.mimeType).toBe("image/png");
    expect(client.storageMocks.createSignedUrl).toHaveBeenCalledWith(`${userId}/images/${imageId}.png`, 600);
  });

  it("rejects image signed URLs when the parent document belongs to another user", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "document_images") {
        return ok({
          document_id: otherDocumentId,
          storage_path: `${otherUserId}/images/${imageId}.png`,
          mime_type: "image/png",
          caption: "Other image",
        });
      }
      return ok(null);
    });
    mockRuntime(client);
    const { GET } = await import("../src/app/api/images/[id]/signed-url/route");

    const response = await GET(authenticatedRequest(`/api/images/${imageId}/signed-url`), {
      params: Promise.resolve({ id: imageId }),
    });

    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({ error: "Image not found." });
    expect(client.storageMocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("stores uploaded documents with owner_id and a user-scoped storage path", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "insert") {
        const inserted = call.insertPayload as { id: string; owner_id: string; storage_path: string };
        return ok({ id: inserted.id, owner_id: inserted.owner_id, storage_path: inserted.storage_path });
      }
      if (call.table === "ingestion_jobs" && call.operation === "insert") {
        return ok({ id: "job-1", document_id: documentId });
      }
      return ok([]);
    });
    mockRuntime(client);
    const { POST } = await import("../src/app/api/upload/route");
    const formData = new FormData();
    formData.set("file", new File(["%PDF-1.7"], "guideline.pdf", { type: "application/pdf" }));
    formData.set("title", "Guideline");

    const response = await POST(
      authenticatedRequest("/api/upload", {
        method: "POST",
        body: formData,
      }),
    );
    const documentInsert = client.calls.find((call) => call.table === "documents" && call.operation === "insert");
    const inserted = documentInsert?.insertPayload as { owner_id: string; storage_path: string };
    const uploadPath = client.storageMocks.upload.mock.calls[0]?.[0] as string;

    expect(response.status).toBe(201);
    expect(inserted.owner_id).toBe(userId);
    expect(inserted.storage_path).toBe(uploadPath);
    expect(uploadPath).toMatch(new RegExp(`^${userId}/documents/[0-9a-f-]+/guideline\\.pdf$`));
    expect(client.storageMocks.remove).not.toHaveBeenCalled();
  });

  it("assigns a smart unique title when a different document has the same upload name", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select" && call.maybeSingle) {
        return ok(null);
      }
      if (call.table === "documents" && call.operation === "select") {
        return ok([{ id: "existing-doc", title: "Guideline", file_name: "guideline.pdf", content_hash: "other-hash" }]);
      }
      if (call.table === "documents" && call.operation === "insert") {
        const inserted = call.insertPayload as { id: string; title: string; metadata: Record<string, unknown> };
        return ok({ id: inserted.id, title: inserted.title, metadata: inserted.metadata });
      }
      if (call.table === "ingestion_jobs" && call.operation === "insert") {
        return ok({ id: "job-1", document_id: documentId });
      }
      return ok([]);
    });
    mockRuntime(client);
    const { POST } = await import("../src/app/api/upload/route");
    const formData = new FormData();
    formData.set("file", new File(["%PDF-1.7 revised"], "guideline.pdf", { type: "application/pdf" }));

    const response = await POST(
      authenticatedRequest("/api/upload", {
        method: "POST",
        body: formData,
      }),
    );
    const documentInsert = client.calls.find((call) => call.table === "documents" && call.operation === "insert");
    const inserted = documentInsert?.insertPayload as { title: string; metadata: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(inserted.title).toBe("Guideline (Copy 2)");
    expect(inserted.metadata.smart_title_base).toBe("Guideline");
    expect(inserted.metadata.smart_title_duplicate_reason).toBe("same_title_or_filename");
    expect(inserted.metadata.smart_title_duplicate_index).toBe(2);
  });

  it("alerts on exact-copy uploads without storing or queueing a duplicate", async () => {
    const duplicate = {
      id: documentId,
      title: "Existing guideline",
      file_name: "guideline.pdf",
      status: "indexed",
      page_count: 4,
      chunk_count: 8,
      image_count: 1,
      created_at: "2026-05-27T00:00:00.000Z",
    };
    const client = createSupabaseMock((call) => (call.table === "documents" ? ok(duplicate) : ok([])));
    mockRuntime(client);
    const { POST } = await import("../src/app/api/upload/route");
    const formData = new FormData();
    formData.set("file", new File(["%PDF-1.7"], "guideline.pdf", { type: "application/pdf" }));

    const response = await POST(
      authenticatedRequest("/api/upload", {
        method: "POST",
        body: formData,
      }),
    );
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      duplicate: true,
      duplicateReason: "exact_content_hash",
      document: duplicate,
    });
    expect(String(body.message)).toContain("Exact copy already exists");
    expect(client.calls[0].filters).toContainEqual({ column: "owner_id", value: userId });
    expect(client.storageMocks.upload).not.toHaveBeenCalled();
    expect(client.calls.some((call) => call.table === "ingestion_jobs" && call.operation === "insert")).toBe(false);
  });

  it("returns first-class document matches for document-focused search", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "document_labels") {
        return ok([
          {
            id: "label-1",
            document_id: documentId,
            label: "agitation",
            label_type: "topic",
            source: "generated",
            confidence: 0.9,
          },
        ]);
      }
      if (call.table === "document_summaries") {
        return ok([{ document_id: documentId, summary: "High-yield agitation management guidance." }]);
      }
      if (call.table === "document_images") {
        return ok([
          {
            document_id: documentId,
            source_kind: "table_crop",
            searchable: true,
            image_type: "clinical_table",
            clinical_relevance_score: 0.9,
            metadata: { clinical_use_class: "clinical_evidence" },
          },
          {
            document_id: documentId,
            source_kind: "embedded",
            searchable: true,
            image_type: "graph",
            clinical_relevance_score: 0.82,
            metadata: { clinical_use_class: "clinical_evidence" },
          },
        ]);
      }
      return ok([]);
    });
    client.rpc.mockResolvedValue({
      data: [
        {
          document_id: documentId,
          labels: [
            {
              id: "label-1",
              document_id: documentId,
              label: "agitation",
              label_type: "topic",
              source: "generated",
              confidence: 0.9,
            },
          ],
          summary: "High-yield agitation management guidance.",
        },
      ],
      error: null,
    });
    mockRuntime(client, {
      searchChunksWithTelemetry: vi.fn(async () => ({
        results: [
          {
            id: "chunk-1",
            document_id: documentId,
            title: "Agitation and arousal",
            file_name: "MHSP.AgitationArousalPharmaMgt.pdf",
            page_number: 3,
            chunk_index: 0,
            section_heading: "Management",
            content: "Agitation management table text.",
            image_ids: [],
            similarity: 0.9,
            hybrid_score: 0.92,
            images: [],
          },
        ],
        telemetry: {
          retrieval_strategy: "text",
          search_cache_hit: false,
          embedding_skipped: true,
          embedding_cache_hit: false,
          text_fast_path_latency_ms: 10,
          embedding_latency_ms: 0,
          supabase_rpc_latency_ms: 12,
          rerank_latency_ms: 1,
        },
      })),
    });
    const { POST } = await import("../src/app/api/search/route");

    const response = await POST(
      authenticatedRequest("/api/search", {
        method: "POST",
        body: JSON.stringify({ query: "agitation management tables", mode: "documents", documentLimit: 10 }),
      }),
    );
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.documentMatches).toEqual([
      expect.objectContaining({
        document_id: documentId,
        title: "Agitation and arousal",
        bestPages: [3],
        tableCount: 1,
        imageCount: 2,
        summarySnippet: "High-yield agitation management guidance.",
      }),
    ]);
    expect(body.relatedDocuments).toHaveLength(1);
  });

  it("rejects unauthenticated reindex requests", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { POST } = await import("../src/app/api/documents/[id]/reindex/route");

    const response = await POST(
      request(`/api/documents/${documentId}/reindex`, {
        method: "POST",
        body: JSON.stringify({ mode: "enrichment" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: "Authentication required." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("runs enrichment-only reindex for owned indexed documents using generic metadata", async () => {
    const document = {
      id: documentId,
      owner_id: userId,
      title: "Future Uploaded Protocol",
      file_name: "future-upload.pdf",
      source_path: null,
      import_batch_id: null,
      metadata: { existing: true },
    };
    const chunks = [
      {
        id: "chunk-1",
        page_number: 1,
        chunk_index: 0,
        section_heading: "Workflow",
        content: "Future uploaded protocol workflow content.",
      },
    ];
    const images = [
      {
        id: imageId,
        page_number: 1,
        caption: "Clinical workflow table.",
        image_type: "clinical_table",
        labels: ["workflow"],
      },
    ];
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") return ok(document);
      if (call.table === "document_chunks") return ok(chunks);
      if (call.table === "document_images") return ok(images);
      return ok([]);
    });
    const upsertDocumentEnrichment = vi.fn(async () => ({
      summary: { id: "summary-1", document_id: documentId, summary: "Source-backed summary." },
      labels: [],
    }));
    const upsertDocumentDeepMemory = vi.fn(async () => ({
      sections: [],
      memoryCards: [],
    }));
    mockRuntime(client);
    vi.doMock("@/lib/document-enrichment", () => ({ upsertDocumentEnrichment }));
    vi.doMock("@/lib/deep-memory", () => ({ upsertDocumentDeepMemory }));
    const { POST } = await import("../src/app/api/documents/[id]/reindex/route");

    const response = await POST(
      authenticatedRequest(`/api/documents/${documentId}/reindex`, {
        method: "POST",
        body: JSON.stringify({ mode: "enrichment" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(200);
    expect(upsertDocumentEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({
          id: documentId,
          title: "Future Uploaded Protocol",
          metadata: { existing: true },
        }),
        chunks,
        images,
      }),
    );
    expect(client.calls[0].selected).toContain("metadata");
    expect(client.calls[0].filters).toContainEqual({ column: "owner_id", value: userId });
    expect(upsertDocumentDeepMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({ id: documentId }),
        chunks,
        images,
      }),
    );
  });

  it("paginates enrichment-only reindex chunks and images for deep memory rebuilds", async () => {
    const document = {
      id: documentId,
      owner_id: userId,
      title: "Large Protocol",
      file_name: "large.pdf",
      source_path: null,
      import_batch_id: null,
      metadata: {},
    };
    const firstChunkPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `chunk-${index}`,
      document_id: documentId,
      page_number: 1,
      chunk_index: index,
      section_heading: "Large section",
      content: `Content ${index}`,
      image_ids: [],
      metadata: {},
    }));
    const finalChunk = {
      id: "chunk-final",
      document_id: documentId,
      page_number: 2,
      chunk_index: 1000,
      section_heading: "Final section",
      content: "Final content",
      image_ids: [],
      metadata: {},
    };
    const firstImagePage = Array.from({ length: 1000 }, (_, index) => ({
      id: `image-${index}`,
      page_number: 1,
      caption: `Image ${index}`,
      image_type: "clinical_table",
      labels: [],
      source_kind: "table_crop",
      clinical_relevance_score: 0.5,
      metadata: {},
    }));
    const finalImage = {
      id: "image-final",
      page_number: 2,
      caption: "Final image",
      image_type: "clinical_table",
      labels: [],
      source_kind: "table_crop",
      clinical_relevance_score: 0.95,
      metadata: {},
    };
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") return ok(document);
      if (call.table === "document_chunks") {
        return call.range?.from === 0 ? ok(firstChunkPage) : ok([finalChunk]);
      }
      if (call.table === "document_images") {
        return call.range?.from === 0 ? ok(firstImagePage) : ok([finalImage]);
      }
      return ok([]);
    });
    const upsertDocumentEnrichment = vi.fn(async () => ({
      summary: { id: "summary-1", document_id: documentId, summary: "Source-backed summary." },
      labels: [],
    }));
    const upsertDocumentDeepMemory = vi.fn(async () => ({
      sections: [],
      memoryCards: [],
    }));
    mockRuntime(client);
    vi.doMock("@/lib/document-enrichment", () => ({ upsertDocumentEnrichment }));
    vi.doMock("@/lib/deep-memory", () => ({ upsertDocumentDeepMemory }));
    const { POST } = await import("../src/app/api/documents/[id]/reindex/route");

    const response = await POST(
      authenticatedRequest(`/api/documents/${documentId}/reindex`, {
        method: "POST",
        body: JSON.stringify({ mode: "enrichment" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const chunkSelects = client.calls.filter((call) => call.table === "document_chunks");
    const imageSelects = client.calls.filter((call) => call.table === "document_images");

    expect(response.status).toBe(200);
    expect(chunkSelects.map((call) => call.range)).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
    expect(imageSelects.map((call) => call.range)).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
    expect(upsertDocumentDeepMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        chunks: expect.arrayContaining([expect.objectContaining({ id: "chunk-final" })]),
        images: expect.arrayContaining([expect.objectContaining({ id: "image-final" })]),
      }),
    );
  });

  it("cleans up uploaded storage when document insert fails", async () => {
    const client = createSupabaseMock((call) =>
      call.table === "documents" && call.operation === "insert" ? fail("document insert failed") : ok([]),
    );
    mockRuntime(client);
    const { POST } = await import("../src/app/api/upload/route");
    const formData = new FormData();
    formData.set("file", new File(["%PDF-1.7"], "guideline.pdf", { type: "application/pdf" }));

    const response = await POST(
      authenticatedRequest("/api/upload", {
        method: "POST",
        body: formData,
      }),
    );
    const uploadPath = client.storageMocks.upload.mock.calls[0]?.[0] as string;

    expect(response.status).toBe(400);
    expect(client.storageMocks.remove).toHaveBeenCalledWith([uploadPath]);
  });

  it("cleans up uploaded storage when job insert fails", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "insert") {
        return ok({ id: documentId });
      }
      if (call.table === "ingestion_jobs" && call.operation === "insert") {
        return fail("job insert failed");
      }
      return ok([]);
    });
    mockRuntime(client);
    const { POST } = await import("../src/app/api/upload/route");
    const formData = new FormData();
    formData.set("file", new File(["%PDF-1.7"], "guideline.pdf", { type: "application/pdf" }));

    const response = await POST(
      authenticatedRequest("/api/upload", {
        method: "POST",
        body: formData,
      }),
    );
    const uploadPath = client.storageMocks.upload.mock.calls[0]?.[0] as string;

    expect(response.status).toBe(400);
    expect(client.storageMocks.remove).toHaveBeenCalledWith([uploadPath]);
  });

  it("does not return document details for an unowned document", async () => {
    const client = createSupabaseMock(() => ok(null));
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/route");

    const response = await GET(authenticatedRequest(`/api/documents/${otherDocumentId}`), {
      params: Promise.resolve({ id: otherDocumentId }),
    });

    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({ error: "Document not found." });
    expect(client.calls).toHaveLength(1);
  });

  it("allows owners to rename the document display title without changing file provenance", async () => {
    const original = {
      id: documentId,
      owner_id: userId,
      title: "Original title",
      file_name: "source.pdf",
      storage_path: `${userId}/documents/${documentId}/source.pdf`,
      content_hash: "hash-1",
      metadata: { source_path: "C:\\Guidelines\\source.pdf" },
    };
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") return ok(original);
      if (call.table === "documents" && call.operation === "update") {
        return ok({
          ...original,
          ...(call.updatePayload as Record<string, unknown>),
        });
      }
      return ok([]);
    });
    const invalidateRagCachesForDocumentMutation = vi.fn();
    mockRuntime(client, { invalidateRagCachesForDocumentMutation });
    const { PATCH } = await import("../src/app/api/documents/[id]/route");

    const response = await PATCH(
      authenticatedRequest(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Better clinical title" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = await payload(response);
    const updateCall = client.calls.find((call) => call.table === "documents" && call.operation === "update");
    const update = updateCall?.updatePayload as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect((body.document as Record<string, unknown>).title).toBe("Better clinical title");
    expect(update.title).toBe("Better clinical title");
    expect(update).not.toHaveProperty("file_name");
    expect(update).not.toHaveProperty("storage_path");
    expect(update).not.toHaveProperty("content_hash");
    expect(client.calls[0].filters).toContainEqual({ column: "owner_id", value: userId });
    expect(invalidateRagCachesForDocumentMutation).toHaveBeenCalledWith(userId);
  });

  it("rejects invalid document rename titles", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { PATCH } = await import("../src/app/api/documents/[id]/route");

    const response = await PATCH(
      authenticatedRequest(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "   " }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(400);
    expect(await payload(response)).toEqual({ error: "Enter a document title between 1 and 180 characters." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("does not rename another user's document", async () => {
    const client = createSupabaseMock(() => ok(null));
    mockRuntime(client);
    const { PATCH } = await import("../src/app/api/documents/[id]/route");

    const response = await PATCH(
      authenticatedRequest(`/api/documents/${otherDocumentId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Not mine" }),
      }),
      { params: Promise.resolve({ id: otherDocumentId }) },
    );

    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({ error: "Document not found." });
    expect(client.calls[0].filters).toContainEqual({ column: "owner_id", value: userId });
  });

  it("permanently deletes an owned document, query logs, and storage objects", async () => {
    const sourcePath = `${userId}/documents/${documentId}/source.pdf`;
    const imagePath = `${userId}/images/${imageId}.png`;
    const chunkId = "44444444-4444-4444-8444-444444444444";
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return ok({ id: documentId, owner_id: userId, title: "Owned", storage_path: sourcePath });
      }
      if (call.table === "ingestion_jobs" && call.operation === "select") return ok([]);
      if (call.table === "document_images" && call.operation === "select") return ok([{ storage_path: imagePath }]);
      if (call.table === "document_chunks" && call.operation === "select") return ok([{ id: chunkId }]);
      if (call.table === "storage_cleanup_jobs" && call.operation === "insert") return ok({ id: "cleanup-1" });
      if (call.table === "storage_cleanup_jobs" && call.operation === "update") return ok([]);
      if (call.table === "rag_queries" && call.operation === "delete") return ok([]);
      if (call.table === "documents" && call.operation === "delete") return ok([]);
      return ok([]);
    });
    mockRuntime(client);
    const { DELETE } = await import("../src/app/api/documents/[id]/route");

    const response = await DELETE(authenticatedRequest(`/api/documents/${documentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: documentId }),
    });
    const body = await payload(response);
    const ragDelete = client.calls.find((call) => call.table === "rag_queries" && call.operation === "delete");
    const documentDelete = client.calls.find((call) => call.table === "documents" && call.operation === "delete");
    const cleanupInsert = client.calls.find(
      (call) => call.table === "storage_cleanup_jobs" && call.operation === "insert",
    );
    const cleanupUpdate = client.calls.find(
      (call) => call.table === "storage_cleanup_jobs" && call.operation === "update",
    );

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ deleted: true, documentId, storageWarnings: [] });
    expect(cleanupInsert?.insertPayload).toMatchObject({
      owner_id: userId,
      document_id: documentId,
      document_paths: [sourcePath],
      image_paths: [imagePath],
      status: "pending",
    });
    expect(cleanupUpdate?.updatePayload).toMatchObject({ status: "completed", storage_removed: 0 });
    expect(ragDelete?.filters).not.toContainEqual({ column: "owner_id", value: userId });
    expect(ragDelete?.overlapsFilters).toContainEqual({ column: "source_chunk_ids", values: [chunkId] });
    expect(documentDelete?.filters).toContainEqual({ column: "id", value: documentId });
    expect(documentDelete?.filters).toContainEqual({ column: "owner_id", value: userId });
    expect(client.storageMocks.storageFrom).toHaveBeenCalledWith("clinical-documents");
    expect(client.storageMocks.storageFrom).toHaveBeenCalledWith("clinical-images");
    expect(client.storageMocks.remove).toHaveBeenCalledWith([sourcePath]);
    expect(client.storageMocks.remove).toHaveBeenCalledWith([imagePath]);
  });

  it("paginates delete cleanup rows before removing the document", async () => {
    const sourcePath = `${userId}/documents/${documentId}/source.pdf`;
    const firstImagePage = Array.from({ length: 1000 }, (_, index) => ({
      storage_path: `${userId}/images/${index}.png`,
    }));
    const finalImage = { storage_path: `${userId}/images/final.png` };
    const firstChunkPage = Array.from({ length: 1000 }, (_, index) => ({ id: `chunk-${index}` }));
    const finalChunk = { id: "chunk-final" };
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return ok({ id: documentId, owner_id: userId, title: "Owned", storage_path: sourcePath });
      }
      if (call.table === "ingestion_jobs" && call.operation === "select") return ok([]);
      if (call.table === "document_images" && call.operation === "select") {
        return call.range?.from === 0 ? ok(firstImagePage) : ok([finalImage]);
      }
      if (call.table === "document_chunks" && call.operation === "select") {
        return call.range?.from === 0 ? ok(firstChunkPage) : ok([finalChunk]);
      }
      if (call.table === "storage_cleanup_jobs" && call.operation === "insert") return ok({ id: "cleanup-1" });
      if (call.table === "storage_cleanup_jobs" && call.operation === "update") return ok([]);
      if (call.table === "rag_queries" && call.operation === "delete") return ok([]);
      if (call.table === "documents" && call.operation === "delete") return ok([]);
      return ok([]);
    });
    mockRuntime(client);
    const { DELETE } = await import("../src/app/api/documents/[id]/route");

    const response = await DELETE(authenticatedRequest(`/api/documents/${documentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: documentId }),
    });
    const imageSelects = client.calls.filter((call) => call.table === "document_images" && call.operation === "select");
    const chunkSelects = client.calls.filter((call) => call.table === "document_chunks" && call.operation === "select");
    const ragDelete = client.calls.find((call) => call.table === "rag_queries" && call.operation === "delete");

    expect(response.status).toBe(200);
    expect(imageSelects.map((call) => call.range)).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
    expect(chunkSelects.map((call) => call.range)).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
    expect(ragDelete?.overlapsFilters[0]?.values).toContain("chunk-final");
    expect(client.storageMocks.remove).toHaveBeenCalledWith(expect.arrayContaining([finalImage.storage_path]));
  });

  it("blocks permanent delete while a document is actively indexing", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return ok({ id: documentId, owner_id: userId, title: "Owned", storage_path: "source.pdf" });
      }
      if (call.table === "ingestion_jobs" && call.operation === "select") {
        return ok([{ id: "job-1", status: "processing" }]);
      }
      return ok([]);
    });
    mockRuntime(client);
    const { DELETE } = await import("../src/app/api/documents/[id]/route");

    const response = await DELETE(authenticatedRequest(`/api/documents/${documentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: documentId }),
    });

    expect(response.status).toBe(409);
    expect(await payload(response)).toEqual({
      error: "Document is currently indexing. Stop or wait for the worker before deleting.",
    });
    expect(client.calls.some((call) => call.table === "documents" && call.operation === "delete")).toBe(false);
    expect(client.storageMocks.remove).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated search and answer requests", async () => {
    const searchChunksWithTelemetry = vi.fn(async () => ({
      results: [],
      telemetry: {
        search_cache_hit: false,
        text_fast_path_latency_ms: 0,
        embedding_skipped: true,
        embedding_latency_ms: 0,
        embedding_cache_hit: false,
        supabase_rpc_latency_ms: 0,
        rerank_latency_ms: 0,
        retrieval_strategy: "text_fast_path",
      },
    }));
    const answerQuestionWithScope = vi.fn(async () => ({
      answer: "No owned evidence.",
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
    }));
    const client = createSupabaseMock();
    mockRuntime(client, { searchChunksWithTelemetry, answerQuestionWithScope });

    const searchRoute = await import("../src/app/api/search/route");
    const answerRoute = await import("../src/app/api/answer/route");

    const searchResponse = await searchRoute.POST(
      request("/api/search", {
        method: "POST",
        body: JSON.stringify({ query: "monitoring", documentIds: [otherDocumentId] }),
      }),
    );
    const answerResponse = await answerRoute.POST(
      request("/api/answer", {
        method: "POST",
        body: JSON.stringify({ query: "monitoring", documentId: otherDocumentId }),
      }),
    );

    expect(searchResponse.status).toBe(401);
    expect(answerResponse.status).toBe(401);
    expect(await payload(searchResponse)).toEqual({ error: "Authentication required." });
    expect(await payload(answerResponse)).toEqual({ error: "Authentication required." });
    expect(searchChunksWithTelemetry).not.toHaveBeenCalled();
    expect(answerQuestionWithScope).not.toHaveBeenCalled();
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it("rate limits authenticated answer generation without limiting authenticated search", async () => {
    const searchChunksWithTelemetry = vi.fn(async () => ({
      results: [],
      telemetry: {
        search_cache_hit: false,
        text_fast_path_latency_ms: 0,
        embedding_skipped: true,
        embedding_latency_ms: 0,
        embedding_cache_hit: false,
        supabase_rpc_latency_ms: 0,
        rerank_latency_ms: 0,
        retrieval_strategy: "text_fast_path",
      },
    }));
    const answerQuestionWithScope = vi.fn(async () => ({
      answer: "Source-backed answer.",
      grounded: true,
      confidence: "medium",
      citations: [],
      sources: [],
    }));
    const client = createSupabaseMock();
    mockRuntime(client, { searchChunksWithTelemetry, answerQuestionWithScope });

    const answerRoute = await import("../src/app/api/answer/route");
    const searchRoute = await import("../src/app/api/search/route");
    const answerRequest = () =>
      authenticatedRequest("/api/answer", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ query: "monitoring" }),
      });

    for (let index = 0; index < 30; index += 1) {
      const response = await answerRoute.POST(answerRequest());
      expect(response.status).toBe(200);
    }

    const limited = await answerRoute.POST(answerRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(await payload(limited)).toEqual({ error: "Too many public answer requests. Retry shortly." });
    expect(answerQuestionWithScope).toHaveBeenCalledTimes(30);

    const searchResponse = await searchRoute.POST(
      authenticatedRequest("/api/search", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ query: "monitoring" }),
      }),
    );

    expect(searchResponse.status).toBe(200);
    expect(searchChunksWithTelemetry).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));
  });

  it("rate limits abnormal authenticated search bursts with retry metadata", async () => {
    const searchChunksWithTelemetry = vi.fn(async () => ({
      results: [],
      telemetry: {
        search_cache_hit: false,
        text_fast_path_latency_ms: 0,
        embedding_skipped: true,
        embedding_latency_ms: 0,
        embedding_cache_hit: false,
        supabase_rpc_latency_ms: 0,
        rerank_latency_ms: 0,
        retrieval_strategy: "text_fast_path",
        weighted_top_score: 0,
        rrf_top_score: 0,
      },
    }));
    const client = createSupabaseMock();
    mockRuntime(client, { searchChunksWithTelemetry });
    vi.doMock("@/lib/public-rate-limit", async () => {
      const actual = await vi.importActual<typeof import("../src/lib/public-rate-limit")>("@/lib/public-rate-limit");
      return {
        ...actual,
        consumePublicSearchRateLimit: (headers: Headers) =>
          actual.consumePublicSearchRateLimit(headers, Date.now(), { limit: 2, windowMs: 60_000 }),
      };
    });
    const searchRoute = await import("../src/app/api/search/route");
    const searchRequest = () =>
      authenticatedRequest("/api/search", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.20" },
        body: JSON.stringify({ query: "monitoring", includeRelatedDocuments: false }),
      });

    expect((await searchRoute.POST(searchRequest())).status).toBe(200);
    expect((await searchRoute.POST(searchRequest())).status).toBe(200);

    const limited = await searchRoute.POST(searchRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(await payload(limited)).toEqual({
      error: "Search is temporarily rate limited because too many requests were received. Retry shortly.",
      retryAfterSeconds: 60,
    });
    expect(searchChunksWithTelemetry).toHaveBeenCalledTimes(2);
  });

  it("coalesces identical in-flight authenticated search requests", async () => {
    let releaseSearch!: () => void;
    const searchGate = new Promise<void>((resolve) => {
      releaseSearch = resolve;
    });
    const searchChunksWithTelemetry = vi.fn(async () => {
      await searchGate;
      return {
        results: [],
        telemetry: {
          search_cache_hit: false,
          text_fast_path_latency_ms: 0,
          embedding_skipped: true,
          embedding_latency_ms: 0,
          embedding_cache_hit: false,
          supabase_rpc_latency_ms: 0,
          rerank_latency_ms: 0,
          retrieval_strategy: "text_fast_path",
          weighted_top_score: 0,
          rrf_top_score: 0,
        },
      };
    });
    const client = createSupabaseMock();
    mockRuntime(client, { searchChunksWithTelemetry });
    const searchRoute = await import("../src/app/api/search/route");
    const searchRequest = () =>
      authenticatedRequest("/api/search", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.21" },
        body: JSON.stringify({ query: "monitoring", includeRelatedDocuments: false }),
      });

    const first = searchRoute.POST(searchRequest());
    const second = searchRoute.POST(searchRequest());
    for (let index = 0; index < 10 && searchChunksWithTelemetry.mock.calls.length === 0; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(searchChunksWithTelemetry).toHaveBeenCalledTimes(1);

    releaseSearch();
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    const firstPayload = await payload(firstResponse);
    const secondPayload = await payload(secondResponse);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstPayload.telemetry).toMatchObject({ coalesced: false });
    expect(secondPayload.telemetry).toMatchObject({ coalesced: true });
  });

  it("streams answer progress before the final answer for authenticated users", async () => {
    const answerQuestionWithScope = vi.fn(async (args: { onProgress?: (event: unknown) => void | Promise<void> }) => {
      await args.onProgress?.({ stage: "retrieved", message: "Retrieved 2 candidate sources." });
      return {
        answer: "Owned evidence.",
        grounded: true,
        confidence: "medium",
        citations: [],
        sources: [],
      };
    });
    const client = createSupabaseMock();
    mockRuntime(client, { answerQuestionWithScope });
    const { POST } = await import("../src/app/api/answer/stream/route");

    const response = await POST(
      authenticatedRequest("/api/answer/stream", {
        method: "POST",
        body: JSON.stringify({ query: "monitoring", documentId: otherDocumentId }),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body.indexOf("event: progress")).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("event: final")).toBeGreaterThan(body.indexOf("event: progress"));
    expect(body).toContain("Retrieved 2 candidate sources.");
    expect(answerQuestionWithScope).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: userId, documentId: otherDocumentId, onProgress: expect.any(Function) }),
    );
    expect(client.auth.getUser).toHaveBeenCalledWith(token);
  });

  it("emits a structured SSE error when authenticated streaming answers are rate limited", async () => {
    const answerQuestionWithScope = vi.fn(async () => ({
      answer: "Owned evidence.",
      grounded: true,
      confidence: "medium",
      citations: [],
      sources: [],
    }));
    const client = createSupabaseMock();
    mockRuntime(client, { answerQuestionWithScope });

    const answerRoute = await import("../src/app/api/answer/route");
    const streamRoute = await import("../src/app/api/answer/stream/route");
    const answerRequest = () =>
      authenticatedRequest("/api/answer", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.11" },
        body: JSON.stringify({ query: "monitoring" }),
      });

    for (let index = 0; index < 30; index += 1) {
      const response = await answerRoute.POST(answerRequest());
      expect(response.status).toBe(200);
    }

    const response = await streamRoute.POST(
      authenticatedRequest("/api/answer/stream", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.11" },
        body: JSON.stringify({ query: "monitoring", documentId: otherDocumentId }),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(body).toContain("event: error");
    expect(body).toContain('"status":429');
    expect(body).toContain("Too many public answer requests. Retry shortly.");
    expect(answerQuestionWithScope).toHaveBeenCalledTimes(30);
  });

  it("returns a generic not found response when summarizing an unowned document", async () => {
    const summarizeDocument = vi.fn(async () => {
      throw new Error("Document not found.");
    });
    const client = createSupabaseMock();
    mockRuntime(client, { summarizeDocument });
    const { POST } = await import("../src/app/api/documents/[id]/summarize/route");

    const response = await POST(
      authenticatedRequest(`/api/documents/${otherDocumentId}/summarize`, { method: "POST" }),
      {
        params: Promise.resolve({ id: otherDocumentId }),
      },
    );

    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({ error: "Document not found." });
    expect(summarizeDocument).toHaveBeenCalledWith(otherDocumentId, userId);
  });

  it("passes owner scope into retrieval RPCs", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const embedTextWithTelemetry = vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry,
      generateTextResponse: vi.fn(),
      generateStructuredTextResponse: vi.fn(),
      generateStructuredTextResult: vi.fn(),
    }));
    const { searchChunks } = await import("../src/lib/rag");

    const results = await searchChunks({
      query: "monitoring",
      documentId: otherDocumentId,
      ownerId: userId,
    });

    expect(results).toEqual([]);
    expect(embedTextWithTelemetry).toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith(
      "match_document_chunks_hybrid",
      expect.objectContaining({
        owner_filter: userId,
        document_filters: [otherDocumentId],
      }),
    );
  });

  it("uses the DB-backed document lookup RPC with owner scope", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const embedTextWithTelemetry = vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry,
      generateTextResponse: vi.fn(),
      generateStructuredTextResponse: vi.fn(),
      generateStructuredTextResult: vi.fn(),
    }));
    const { searchChunks } = await import("../src/lib/rag");

    await searchChunks({
      query: "Find the NOCC document",
      ownerId: userId,
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "match_documents_for_query",
      expect.objectContaining({
        owner_filter: userId,
      }),
    );
  });
});
