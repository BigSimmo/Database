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
  operation: "select" | "insert";
  selected?: string;
  filters: QueryFilter[];
  inFilters: QueryInFilter[];
  insertPayload?: unknown;
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

  eq(column: string, value: unknown) {
    this.call.filters.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.call.inFilters.push({ column, values });
    return this;
  }

  order() {
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
    auth: { getUser },
    calls,
    from: vi.fn((table: string) => {
      const call: QueryCall = {
        table,
        operation: "select",
        filters: [],
        inFilters: [],
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

function mockRuntime(client: ReturnType<typeof createSupabaseMock>, ragMock?: Record<string, unknown>) {
  vi.resetModules();
  vi.doUnmock("@/lib/rag");
  vi.doUnmock("@/lib/openai");
  vi.doMock("@/lib/env", () => ({
    env: {
      MAX_UPLOAD_MB: 150,
      SUPABASE_DOCUMENT_BUCKET: "clinical-documents",
      SUPABASE_IMAGE_BUCKET: "clinical-images",
    },
    isDemoMode: () => false,
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
    expect(body.documents).toEqual(documents);
    expect(client.calls[0].filters).toContainEqual({ column: "owner_id", value: userId });
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

  it("passes owner scope through search and answer routes", async () => {
    const searchChunks = vi.fn(async () => []);
    const answerQuestionWithScope = vi.fn(async () => ({
      answer: "No owned evidence.",
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
    }));
    const client = createSupabaseMock();
    mockRuntime(client, { searchChunks, answerQuestionWithScope });

    const searchRoute = await import("../src/app/api/search/route");
    const answerRoute = await import("../src/app/api/answer/route");

    await searchRoute.POST(
      authenticatedRequest("/api/search", {
        method: "POST",
        body: JSON.stringify({ query: "monitoring", documentIds: [otherDocumentId] }),
      }),
    );
    await answerRoute.POST(
      authenticatedRequest("/api/answer", {
        method: "POST",
        body: JSON.stringify({ query: "monitoring", documentId: otherDocumentId }),
      }),
    );

    expect(searchChunks).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: userId, documentIds: [otherDocumentId] }),
    );
    expect(answerQuestionWithScope).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: userId, documentId: otherDocumentId }),
    );
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

  it("does not call retrieval RPCs when owner scoping removes all requested documents", async () => {
    const client = createSupabaseMock((call) => (call.table === "documents" ? ok([]) : ok([])));
    mockRuntime(client);
    const embedText = vi.fn(async () => [0.1, 0.2, 0.3]);
    vi.doMock("@/lib/openai", () => ({
      embedText,
      generateTextResponse: vi.fn(),
    }));
    const { searchChunks } = await import("../src/lib/rag");

    const results = await searchChunks({
      query: "monitoring",
      documentId: otherDocumentId,
      ownerId: userId,
    });

    expect(results).toEqual([]);
    expect(embedText).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.calls[0].filters).toContainEqual({ column: "owner_id", value: userId });
    expect(client.calls[0].inFilters).toContainEqual({ column: "id", values: [otherDocumentId] });
  });
});
