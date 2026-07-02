import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const documentId = "11111111-1111-4111-8111-111111111111";

type QueryError = { message: string };
type QueryResult = { data: unknown; error: QueryError | null; count?: number | null };
type QueryFilter = { column: string; value: unknown };
type QueryInFilter = { column: string; values: unknown[] };
type QueryCall = {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  selected?: string;
  range?: { from: number; to: number };
  filters: QueryFilter[];
  inFilters: QueryInFilter[];
  orFilters: string[];
  limitCount?: number;
  maybeSingle: boolean;
  single: boolean;
  insertPayload?: unknown;
  updatePayload?: unknown;
};
type QueryResolver = (call: QueryCall) => QueryResult;

function ok(data: unknown, count?: number | null): QueryResult {
  return { data, error: null, count };
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

  gte(column: string, value: unknown) {
    this.call.filters.push({ column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.call.filters.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.call.inFilters.push({ column, values });
    return this;
  }

  or(filter: string) {
    this.call.orFilters.push(filter);
    return this;
  }

  order() {
    return this;
  }

  range(from: number, to: number) {
    this.call.range = { from, to };
    return this;
  }

  limit(count: number) {
    this.call.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.call.maybeSingle = true;
    return this.resolve();
  }

  single() {
    this.call.single = true;
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
  const upload = vi.fn(async () => ({ data: { path: "uploaded" }, error: null }));
  const remove = vi.fn(async () => ({ data: [], error: null }));
  const createSignedUrl = vi.fn(async (path: string) => ({
    data: { signedUrl: `https://signed.local/${path}` },
    error: null,
  }));
  const storageFrom = vi.fn(() => ({ upload, remove, createSignedUrl }));
  const client = {
    calls,
    from: vi.fn((table: string) => {
      const call: QueryCall = {
        table,
        operation: "select",
        filters: [],
        inFilters: [],
        orFilters: [],
        maybeSingle: false,
        single: false,
      };
      calls.push(call);
      return new QueryBuilder(call, resolve);
    }),
    rpc: vi.fn(async () => ok([])),
    storage: { from: storageFrom },
    storageMocks: { upload, remove, createSignedUrl, storageFrom },
  };
  return client;
}

function mockRuntime(client: ReturnType<typeof createSupabaseMock>) {
  vi.resetModules();
  const requireAuthenticatedUser = vi.fn(async () => ({ id: userId }));
  const createAdminClient = vi.fn(() => client);
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
      WORKER_STALE_AFTER_MINUTES: 10,
      WORKER_MAX_ATTEMPTS: 3,
    },
    isDemoMode: () => false,
    isLocalNoAuthMode: () => false,
    requireOpenAIEnv: () => undefined,
    requireServerEnv: () => undefined,
  }));
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));
  vi.doMock("@/lib/supabase/auth", () => ({
    AuthenticationError: class AuthenticationError extends Error {},
    requireAuthenticatedUser,
    unauthorizedResponse: () =>
      new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
  }));
  vi.doMock("@/lib/rag", () => ({
    invalidateRagCachesForDocumentMutation: vi.fn(),
    invalidateRagCachesForOwner: vi.fn(),
  }));
  vi.doMock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));
  return { createAdminClient, requireAuthenticatedUser };
}

function authenticatedRequest(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      authorization: "Bearer valid-token",
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

describe("API validation contracts", () => {
  it("keeps route-local request parsing out of the Phase 1 target files", () => {
    const targetRouteFiles = [
      "src/app/api/documents/route.ts",
      "src/app/api/documents/[id]/route.ts",
      "src/app/api/documents/[id]/search/route.ts",
      "src/app/api/documents/[id]/reindex/route.ts",
      "src/app/api/ingestion/quality/route.ts",
      "src/app/api/upload/route.ts",
      "src/app/api/jobs/route.ts",
      "src/app/api/ingestion/jobs/route.ts",
    ];
    const forbiddenPatterns = [
      /Number\.parseInt/,
      /\bparseInt\s*\(/,
      /new URL\(request\.url\)\.searchParams/,
      /searchParams\.get\s*\(/,
      /formData\.get\(["'](?:title|description)["']\)/,
    ];
    const violations = targetRouteFiles.flatMap((file) => {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      return forbiddenPatterns.filter((pattern) => pattern.test(source)).map((pattern) => `${file}: ${pattern.source}`);
    });

    expect(violations).toEqual([]);
  });

  it("clamps and defaults document list pagination through the route query schema", async () => {
    const client = createSupabaseMock(() => ok([], 0));
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/route");

    const clampedResponse = await GET(authenticatedRequest("/api/documents?limit=999&offset=-20&includeMeta=false"));
    const clampedBody = await payload(clampedResponse);
    const defaultedResponse = await GET(
      authenticatedRequest("/api/documents?limit=not-a-number&offset=bad&includeMeta=false"),
    );
    const defaultedBody = await payload(defaultedResponse);

    expect(clampedResponse.status).toBe(200);
    expect(clampedBody.pagination).toMatchObject({ limit: 200, offset: 0 });
    expect(client.calls[0].range).toEqual({ from: 0, to: 199 });
    expect(defaultedResponse.status).toBe(200);
    expect(defaultedBody.pagination).toMatchObject({ limit: 100, offset: 0 });
    expect(client.calls[1].range).toEqual({ from: 0, to: 99 });
  });

  it("treats empty document-detail chunk as absent and clamps page/chunk windows", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.maybeSingle) {
        return ok({ id: documentId, owner_id: userId, page_count: 5, chunk_count: 20, metadata: {} });
      }
      if (call.table === "document_summaries" && call.maybeSingle) return ok(null);
      return ok([]);
    });
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/route");

    const response = await GET(
      authenticatedRequest(`/api/documents/${documentId}?chunk=&page=999&pageLimit=999&chunkLimit=999&chunkOffset=-20`),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = await payload(response);
    const chunkCalls = client.calls.filter((call) => call.table === "document_chunks");

    expect(response.status).toBe(200);
    expect(body.pageWindow).toMatchObject({ from: 1, to: 5, limit: 40 });
    expect(body.chunkWindow).toMatchObject({ offset: 0, limit: 80, selectedChunkId: null });
    expect(chunkCalls).toHaveLength(1);
    expect(chunkCalls[0].range).toEqual({ from: 0, to: 79 });
    expect(chunkCalls[0].filters).not.toContainEqual({ column: "id", value: "" });
  });

  it("returns an empty direct document search response for empty query values before auth or Supabase access", async () => {
    const client = createSupabaseMock();
    const runtime = mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/search/route");

    const response = await GET(authenticatedRequest(`/api/documents/${documentId}/search?q=&limit=`), {
      params: Promise.resolve({ id: documentId }),
    });
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ query: "", results: [], pageHits: [], hitCount: 0 });
    expect(runtime.createAdminClient).not.toHaveBeenCalled();
    expect(runtime.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("clamps ingestion quality limit through the route query schema", async () => {
    const client = createSupabaseMock((call) => (call.table === "documents" ? ok([]) : ok([])));
    mockRuntime(client);
    const { GET } = await import("../src/app/api/ingestion/quality/route");

    const response = await GET(authenticatedRequest("/api/ingestion/quality?limit=999"));
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({ items: [] });
    expect(client.calls[0]).toMatchObject({ table: "documents", limitCount: 200 });
  });

  it("rejects invalid ingestion jobs batchId without querying jobs", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { GET } = await import("../src/app/api/ingestion/jobs/route");

    const response = await GET(authenticatedRequest("/api/ingestion/jobs?batchId=not-a-uuid"));
    const body = await payload(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid ingestion jobs query." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("accepts valid ingestion jobs batchId values and applies the batch filter", async () => {
    const batchId = "44444444-4444-4444-8444-444444444444";
    const client = createSupabaseMock(() => ok([]));
    mockRuntime(client);
    const { GET } = await import("../src/app/api/ingestion/jobs/route");

    const response = await GET(authenticatedRequest(`/api/ingestion/jobs?batchId=${batchId}`));

    expect(response.status).toBe(200);
    expect(client.calls[0].filters).toContainEqual({ column: "batch_id", value: batchId });
  });

  it("treats empty ingestion jobs batchId as absent", async () => {
    const client = createSupabaseMock(() => ok([]));
    mockRuntime(client);
    const { GET } = await import("../src/app/api/ingestion/jobs/route");

    const response = await GET(authenticatedRequest("/api/ingestion/jobs?batchId="));

    expect(response.status).toBe(200);
    expect(client.calls[0].filters).not.toContainEqual({ column: "batch_id", value: "" });
  });

  it("rejects invalid upload metadata before storage upload or database writes", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { POST } = await import("../src/app/api/upload/route");
    const formData = new FormData();
    formData.set("file", new File(["%PDF-1.7"], "guideline.pdf", { type: "application/pdf" }));
    formData.set("title", "x".repeat(181));

    const response = await POST(authenticatedRequest("/api/upload", { method: "POST", body: formData }));
    const body = await payload(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Upload metadata is invalid." });
    expect(client.storageMocks.upload).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects non-string multipart metadata fields before storage upload or database writes", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { POST } = await import("../src/app/api/upload/route");
    const formData = new FormData();
    formData.set("file", new File(["%PDF-1.7"], "guideline.pdf", { type: "application/pdf" }));
    formData.set("title", new File(["Guideline"], "title.txt", { type: "text/plain" }));

    const response = await POST(authenticatedRequest("/api/upload", { method: "POST", body: formData }));
    const body = await payload(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Upload metadata is invalid." });
    expect(client.storageMocks.upload).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects non-form upload content before storage upload or database writes", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { POST } = await import("../src/app/api/upload/route");

    const response = await POST(
      authenticatedRequest("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: "nope" }),
      }),
    );
    const body = await payload(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid upload form data." });
    expect(client.storageMocks.upload).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects malformed multipart upload bodies before storage upload or database writes", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { POST } = await import("../src/app/api/upload/route");

    const response = await POST(
      authenticatedRequest("/api/upload", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=broken" },
        body: "--broken\r\nContent-Disposition: form-data; name=\"file\"; filename=\"guideline.pdf\"\r\n\r\n%PDF-1.7",
      }),
    );
    const body = await payload(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid upload form data." });
    expect(client.storageMocks.upload).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("accepts valid document rename JSON through the shared body parser", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select" && call.maybeSingle) {
        return ok({
          id: documentId,
          owner_id: userId,
          title: "Old title",
          file_name: "old.pdf",
          storage_path: `${userId}/documents/${documentId}/old.pdf`,
          content_hash: "hash",
          metadata: {},
        });
      }
      if (call.table === "documents" && call.operation === "update") {
        return ok({ id: documentId, title: (call.updatePayload as { title: string }).title });
      }
      return ok([]);
    });
    mockRuntime(client);
    const { PATCH } = await import("../src/app/api/documents/[id]/route");

    const response = await PATCH(
      authenticatedRequest(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "New title" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = await payload(response);
    const updateCall = client.calls.find((call) => call.table === "documents" && call.operation === "update");

    expect(response.status).toBe(200);
    expect(body.document).toMatchObject({ id: documentId, title: "New title" });
    expect(updateCall?.updatePayload).toMatchObject({ title: "New title" });
  });

  it("rejects malformed document rename JSON before database access", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { PATCH } = await import("../src/app/api/documents/[id]/route");

    const response = await PATCH(
      authenticatedRequest(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: "{",
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = await payload(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Enter a document title between 1 and 180 characters." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects missing and unknown document rename fields before database access", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { PATCH } = await import("../src/app/api/documents/[id]/route");

    const missingResponse = await PATCH(
      authenticatedRequest(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const unknownResponse = await PATCH(
      authenticatedRequest(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "New title", unexpected: true }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(missingResponse.status).toBe(400);
    expect(await payload(missingResponse)).toEqual({ error: "Enter a document title between 1 and 180 characters." });
    expect(unknownResponse.status).toBe(400);
    expect(await payload(unknownResponse)).toEqual({ error: "Enter a document title between 1 and 180 characters." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects invalid direct document search route params before Supabase access", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/search/route");

    const response = await GET(authenticatedRequest("/api/documents/not-a-uuid/search?q=lithium"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    const body = await payload(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid document id." });
    expect(client.from).not.toHaveBeenCalled();
  });
});
