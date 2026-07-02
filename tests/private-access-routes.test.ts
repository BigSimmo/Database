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

function rateLimitRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    limited: false,
    limit_value: 100,
    remaining: 99,
    retry_after_seconds: 60,
    reset_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
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

  is(column: string, value: unknown) {
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
  const rpc = vi.fn(async (name: string) =>
    name === "consume_api_rate_limit"
      ? {
          data: [rateLimitRow()],
          error: null,
        }
      : ok([]),
  );
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
  options: { localNoAuth?: boolean; localOwnerEmail?: string; providerMode?: string; openAiKey?: string } = {},
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
      // A key is present and provider mode is "auto" by default, so retrieval uses the online
      // embedding/hybrid path; tests can override to exercise the source-only path.
      OPENAI_API_KEY: options.openAiKey ?? "sk-test",
      RAG_PROVIDER_MODE: options.providerMode ?? "auto",
      LOCAL_NO_AUTH_OWNER_EMAIL: options.localOwnerEmail,
      WORKER_STALE_AFTER_MINUTES: 10,
      WORKER_MAX_ATTEMPTS: 3,
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

function authenticatedCookieRequest(path: string, init?: RequestInit) {
  return request(path, {
    ...init,
    headers: {
      cookie: `sb-access-token=${token}`,
      ...init?.headers,
    },
  });
}

function authenticatedAuthTokenCookieRequest(path: string, init?: RequestInit) {
  return request(path, {
    ...init,
    headers: {
      cookie: `sb-random-project-ref-auth-token=${encodeURIComponent(
        JSON.stringify({
          access_token: token,
          refresh_token: "refresh-token",
          type: "bearer",
        }),
      )}`,
      ...init?.headers,
    },
  });
}

async function payload(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function ssePayload(body: string, eventName: string) {
  const block = body.split("\n\n").find((chunk) => chunk.includes(`event: ${eventName}\n`));
  expect(block).toBeTruthy();
  const dataLine = block?.split("\n").find((line) => line.startsWith("data: "));
  expect(dataLine).toBeTruthy();
  return JSON.parse(dataLine!.slice("data: ".length)) as Record<string, unknown>;
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

  it("accepts legacy Supabase auth cookies for private document access", async () => {
    const documents = [{ id: documentId, owner_id: userId, title: "Owned document" }];
    const client = createSupabaseMock((call) => (call.table === "documents" ? ok(documents) : ok([])));
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/route");

    const response = await GET(authenticatedCookieRequest("/api/documents"));
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(client.auth.getUser).toHaveBeenCalledWith(token);
    expect(body.documents).toEqual(documents.map((document) => ({ ...document, labels: [], summary: null })));
    expect(client.calls[0].filters).toContainEqual({ column: "owner_id", value: userId });
  });

  it("accepts Supabase auth token cookies for private document access", async () => {
    const documents = [{ id: documentId, owner_id: userId, title: "Owned document" }];
    const client = createSupabaseMock((call) => (call.table === "documents" ? ok(documents) : ok([])));
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/route");

    const response = await GET(authenticatedAuthTokenCookieRequest("/api/documents"));
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(client.auth.getUser).toHaveBeenCalledWith(token);
    expect(body.documents).toEqual(documents.map((document) => ({ ...document, labels: [], summary: null })));
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

  it("does not leak demo documents from real-mode listing failures", async () => {
    const client = createSupabaseMock(() => {
      throw new Error("Missing server environment variables: SUPABASE_SERVICE_ROLE_KEY. See .env.example.");
    });
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/route");

    const response = await GET(authenticatedRequest("/api/documents"));
    const body = await payload(response);

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Request failed." });
    expect(body.documents).toBeUndefined();
    expect(body.demoMode).toBeUndefined();
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
          metadata: { index_generation_id: "generation-a" },
        });
      }
      if (call.table === "documents" && call.filters.some((filter) => filter.value === userId)) {
        return ok({ id: documentId, metadata: { index_generation_id: "generation-a" } });
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

  it("allows legacy image signed URLs when parent document generation metadata is missing", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "document_images") {
        return ok({
          document_id: documentId,
          storage_path: `${userId}/images/${imageId}.png`,
          mime_type: "image/png",
          caption: "Legacy indexed image",
          metadata: { index_generation_id: "generation-a" },
        });
      }
      if (call.table === "documents" && call.filters.some((filter) => filter.value === userId)) {
        return ok({ id: documentId, metadata: {} });
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

  it("rejects image signed URLs for uncommitted replacement generations", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "document_images") {
        return ok({
          document_id: documentId,
          storage_path: `${userId}/images/${imageId}.png`,
          mime_type: "image/png",
          caption: "Replacement image",
          metadata: { index_generation_id: "generation-new" },
        });
      }
      if (call.table === "documents" && call.filters.some((filter) => filter.value === userId)) {
        return ok({ id: documentId, metadata: { index_generation_id: "generation-old" } });
      }
      return ok(null);
    });
    mockRuntime(client);
    const { GET } = await import("../src/app/api/images/[id]/signed-url/route");

    const response = await GET(authenticatedRequest(`/api/images/${imageId}/signed-url`), {
      params: Promise.resolve({ id: imageId }),
    });

    expect(response.status).toBe(404);
    expect(client.storageMocks.createSignedUrl).not.toHaveBeenCalled();
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
      status: "failed",
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
    client.rpc.mockImplementation(async (name: string) =>
      name === "consume_api_rate_limit"
        ? { data: [rateLimitRow()], error: null }
        : {
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
          },
    );
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

  it("accepts differentials as a standalone source-library search mode", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "document_labels") {
        return ok([
          {
            id: "label-1",
            document_id: documentId,
            label: "acute confusion",
            label_type: "topic",
            source: "generated",
            confidence: 0.92,
          },
        ]);
      }
      if (call.table === "document_summaries") {
        return ok([{ document_id: documentId, summary: "Acute confusion differential guidance." }]);
      }
      if (call.table === "document_images") {
        return ok([]);
      }
      return ok([]);
    });
    client.rpc.mockImplementation(async (name: string) =>
      name === "consume_api_rate_limit"
        ? { data: [rateLimitRow()], error: null }
        : {
            data: [
              {
                document_id: documentId,
                labels: [
                  {
                    id: "label-1",
                    document_id: documentId,
                    label: "acute confusion",
                    label_type: "topic",
                    source: "generated",
                    confidence: 0.92,
                  },
                ],
                summary: "Acute confusion differential guidance.",
              },
            ],
            error: null,
          },
    );
    const searchChunksWithTelemetry = vi.fn(async () => ({
      results: [
        {
          id: "chunk-1",
          document_id: documentId,
          title: "Acute confusion differential guide",
          file_name: "acute-confusion-differentials.pdf",
          page_number: 4,
          chunk_index: 0,
          section_heading: "Differentials",
          content: "Acute confusion differentials include delirium, intoxication, seizure, withdrawal, and hypoxia.",
          image_ids: [],
          similarity: 0.9,
          hybrid_score: 0.93,
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
    }));
    mockRuntime(client, { searchChunksWithTelemetry });
    const { POST } = await import("../src/app/api/search/route");

    const response = await POST(
      authenticatedRequest("/api/search", {
        method: "POST",
        body: JSON.stringify({
          query: "acute confusion after surgery",
          mode: "differentials",
          queryMode: "compare_guidance",
          documentLimit: 10,
        }),
      }),
    );
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(searchChunksWithTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: userId,
        query: "acute confusion after surgery",
        queryMode: "compare_guidance",
        topK: 12,
      }),
    );
    expect(body.documentMatches).toEqual([
      expect.objectContaining({
        document_id: documentId,
        title: "Acute confusion differential guide",
        bestPages: [4],
        summarySnippet: "Acute confusion differential guidance.",
      }),
    ]);
    expect(body.relatedDocuments).toHaveLength(1);
    expect(body.scope).toEqual(expect.objectContaining({ queryMode: "compare_guidance" }));
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

  it("refuses to retry a job a live worker still holds (IDX-C3, B6)", async () => {
    // B6: the reset is a single conditional UPDATE guarded on status/locked_at.
    // A fresh 'processing' lock means the WHERE clause matches 0 rows, so the
    // update resolves with no row → refuse with 409.
    const client = createSupabaseMock((call) => {
      if (call.table === "ingestion_jobs" && call.operation === "select") {
        return ok({
          id: "99999999-9999-4999-8999-999999999999",
          document_id: documentId,
          batch_id: null,
          status: "processing",
          locked_at: null,
        });
      }
      if (call.table === "ingestion_jobs" && call.operation === "update") {
        // Guard rejected the reset: no row affected.
        return ok(null);
      }
      return ok([]);
    });
    mockRuntime(client);
    const { POST } = await import("../src/app/api/ingestion/jobs/[id]/retry/route");

    const response = await POST(
      authenticatedRequest("/api/ingestion/jobs/99999999-9999-4999-8999-999999999999/retry", { method: "POST" }),
      {
        params: Promise.resolve({ id: "99999999-9999-4999-8999-999999999999" }),
      },
    );

    expect(response.status).toBe(409);
    expect(String((await payload(response)).error)).toContain("still being processed");
    // The guarded update must carry the status/stale-lock filter atomically.
    const jobUpdate = client.calls.find((call) => call.table === "ingestion_jobs" && call.operation === "update");
    expect(jobUpdate?.filters.some((f) => f.column === "id")).toBe(true);
    expect(jobUpdate?.orFilters.some((f) => f.includes("status.neq.processing") && f.includes("locked_at"))).toBe(true);
    // Must NOT reset the document when the guard refused the job reset.
    expect(client.calls.some((call) => call.table === "documents" && call.operation === "update")).toBe(false);
  });

  it("re-queues a stale/non-processing job without resetting the live index (IDX-C3, IDX-H1, B6)", async () => {
    const client = createSupabaseMock((call) => {
      if (call.table === "ingestion_jobs" && call.operation === "select") {
        return ok({
          id: "99999999-9999-4999-8999-999999999999",
          document_id: documentId,
          batch_id: null,
          status: "failed",
          locked_at: null,
        });
      }
      if (call.table === "documents" && call.operation === "update") return ok([]);
      if (call.table === "ingestion_jobs" && call.operation === "update") {
        // Guard allowed the reset: one row affected.
        return ok({ id: "99999999-9999-4999-8999-999999999999", document_id: documentId, status: "pending" });
      }
      return ok([]);
    });
    mockRuntime(client);
    const { POST } = await import("../src/app/api/ingestion/jobs/[id]/retry/route");

    const response = await POST(
      authenticatedRequest("/api/ingestion/jobs/99999999-9999-4999-8999-999999999999/retry", { method: "POST" }),
      {
        params: Promise.resolve({ id: "99999999-9999-4999-8999-999999999999" }),
      },
    );
    const documentUpdate = client.calls.find((call) => call.table === "documents" && call.operation === "update");

    expect(response.status).toBe(200);
    // IDX-H1: only re-queue; never zero the chunk/page counts here (the worker resets at start).
    expect(documentUpdate?.updatePayload).toEqual({ status: "queued", error_message: null });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rolls back the job retry when document queue status update fails", async () => {
    const retryJobId = "99999999-9999-4999-8999-999999999999";
    const previousJob = {
      id: retryJobId,
      document_id: documentId,
      batch_id: null,
      status: "failed",
      stage: "failed",
      progress: 42,
      error_message: "OCR failed",
      attempt_count: 2,
      max_attempts: 3,
      locked_at: null,
      locked_by: null,
      next_run_at: null,
      completed_at: "2024-01-01T00:00:00.000Z",
    };

    let ingestionUpdateCount = 0;
    const client = createSupabaseMock((call) => {
      if (call.table === "ingestion_jobs" && call.operation === "select") {
        return ok(previousJob);
      }
      if (call.table === "ingestion_jobs" && call.operation === "update") {
        ingestionUpdateCount += 1;
        if (ingestionUpdateCount === 1) {
          return ok({ id: retryJobId, document_id: documentId, status: "pending" });
        }
        return ok({ id: retryJobId });
      }
      if (call.table === "documents" && call.operation === "update") return fail("documents update failed");
      return ok([]);
    });
    mockRuntime(client);
    const { POST } = await import("../src/app/api/ingestion/jobs/[id]/retry/route");

    const response = await POST(authenticatedRequest(`/api/ingestion/jobs/${retryJobId}/retry`, { method: "POST" }), {
      params: Promise.resolve({ id: retryJobId }),
    });

    expect(response.status).toBe(500);
    expect(String((await payload(response)).error)).toBe("Request failed.");
    const jobUpdates = client.calls.filter((call) => call.table === "ingestion_jobs" && call.operation === "update");
    expect(jobUpdates).toHaveLength(2);
    expect(jobUpdates[1]?.updatePayload).toEqual({
      status: previousJob.status,
      stage: previousJob.stage,
      progress: previousJob.progress,
      error_message: previousJob.error_message,
      attempt_count: previousJob.attempt_count,
      max_attempts: previousJob.max_attempts,
      locked_at: previousJob.locked_at,
      locked_by: previousJob.locked_by,
      next_run_at: previousJob.next_run_at,
      completed_at: previousJob.completed_at,
    });
  });

  it("runs enrichment-only reindex for owned indexed documents using generic metadata", async () => {
    const document = {
      id: documentId,
      owner_id: userId,
      title: "Future Uploaded Protocol",
      file_name: "future-upload.pdf",
      source_path: "legacy/imports/rollback.pdf",
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
      indexUnits: [],
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
        summary: "Source-backed summary.",
      }),
    );
  });

  it("filters enrichment-only reindex rows to the committed document generation", async () => {
    const document = {
      id: documentId,
      owner_id: userId,
      title: "Atomic Protocol",
      file_name: "atomic.pdf",
      source_path: null,
      import_batch_id: null,
      metadata: { index_generation_id: "11111111-1111-4111-8111-111111111111" },
    };
    const committedChunk = {
      id: "chunk-committed",
      document_id: documentId,
      page_number: 1,
      chunk_index: 0,
      section_heading: "Committed",
      content: "Committed generation content.",
      image_ids: [],
      metadata: { index_generation_id: "11111111-1111-4111-8111-111111111111" },
    };
    const uncommittedChunk = {
      id: "chunk-uncommitted",
      document_id: documentId,
      page_number: 1,
      chunk_index: 1,
      section_heading: "Uncommitted",
      content: "Replacement generation content.",
      image_ids: [],
      metadata: { index_generation_id: "22222222-2222-4222-8222-222222222222" },
    };
    const committedImage = {
      id: imageId,
      page_number: 1,
      caption: "Committed image.",
      image_type: "clinical_table",
      labels: [],
      clinical_relevance_score: 0.8,
      metadata: { index_generation_id: "11111111-1111-4111-8111-111111111111" },
    };
    const uncommittedImage = {
      id: "33333333-3333-4333-8333-333333333333",
      page_number: 1,
      caption: "Uncommitted image.",
      image_type: "clinical_table",
      labels: [],
      clinical_relevance_score: 0.9,
      metadata: { index_generation_id: "22222222-2222-4222-8222-222222222222" },
    };
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") return ok(document);
      if (call.table === "document_chunks") return ok([committedChunk, uncommittedChunk]);
      if (call.table === "document_images") return ok([uncommittedImage, committedImage]);
      return ok([]);
    });
    const upsertDocumentEnrichment = vi.fn(async () => ({
      summary: { id: "summary-1", document_id: documentId, summary: "Source-backed summary." },
      labels: [],
    }));
    const upsertDocumentDeepMemory = vi.fn(async () => ({
      sections: [],
      memoryCards: [],
      indexUnits: [],
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
        chunks: [committedChunk],
        images: [committedImage],
      }),
    );
    expect(upsertDocumentDeepMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        chunks: [committedChunk],
        images: [committedImage],
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
      indexUnits: [],
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
        summary: "Source-backed summary.",
      }),
    );
  });

  it("blocks full reindex when the selected document already has active indexing work", async () => {
    const document = {
      id: documentId,
      owner_id: userId,
      title: "Active Protocol",
      file_name: "active.pdf",
      source_path: null,
      import_batch_id: null,
      metadata: {},
    };
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") return ok(document);
      if (call.table === "import_batches") return ok([]);
      if (call.table === "ingestion_jobs" && call.operation === "select") {
        return ok([
          {
            id: "active-job-1",
            document_id: documentId,
            status: "processing",
            stage: "chunking",
            locked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error_message: null,
            attempt_count: 1,
            max_attempts: 3,
          },
        ]);
      }
      return ok([]);
    });
    mockRuntime(client);
    const { POST } = await import("../src/app/api/documents/[id]/reindex/route");

    const response = await POST(
      authenticatedRequest(`/api/documents/${documentId}/reindex`, {
        method: "POST",
        body: JSON.stringify({ mode: "full" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = await payload(response);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: "Document already has pending or processing indexing work.",
      safety: {
        safeToRun: false,
        reason: "active_jobs",
        activeJobCount: 1,
        staleProcessingJobCount: 0,
      },
    });
    expect(client.rpc).not.toHaveBeenCalledWith("reset_document_index", expect.anything());
    expect(client.calls.some((call) => call.table === "documents" && call.operation === "update")).toBe(false);
  });

  it("blocks enrichment-only reindex when the selected document already has active indexing work", async () => {
    const document = {
      id: documentId,
      owner_id: userId,
      title: "Active Protocol",
      file_name: "active.pdf",
      source_path: null,
      import_batch_id: null,
      metadata: { index_generation_id: "11111111-1111-4111-8111-111111111111" },
    };
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") return ok(document);
      if (call.table === "import_batches") return ok([]);
      if (call.table === "ingestion_jobs" && call.operation === "select") {
        return ok([
          {
            id: "active-job-1",
            document_id: documentId,
            status: "pending",
            stage: "queued",
            locked_at: null,
            updated_at: new Date().toISOString(),
            error_message: null,
            attempt_count: 0,
            max_attempts: 3,
          },
        ]);
      }
      return ok([]);
    });
    const upsertDocumentEnrichment = vi.fn();
    mockRuntime(client);
    vi.doMock("@/lib/document-enrichment", () => ({ upsertDocumentEnrichment }));
    const { POST } = await import("../src/app/api/documents/[id]/reindex/route");

    const response = await POST(
      authenticatedRequest(`/api/documents/${documentId}/reindex`, {
        method: "POST",
        body: JSON.stringify({ mode: "enrichment" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = await payload(response);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      safety: {
        safeToRun: false,
        reason: "active_jobs",
        activeJobCount: 1,
      },
    });
    expect(upsertDocumentEnrichment).not.toHaveBeenCalled();
    expect(client.calls.some((call) => call.table === "document_chunks")).toBe(false);
  });

  it("pauses full reindex when Supabase health is unavailable before queue mutation", async () => {
    const document = {
      id: documentId,
      owner_id: userId,
      title: "Unavailable Protocol",
      file_name: "unavailable.pdf",
      source_path: null,
      import_batch_id: null,
      metadata: {},
    };
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") return ok(document);
      if (call.table === "import_batches") return fail("<!doctype html><title>522 Connection timed out</title>");
      return ok([]);
    });
    mockRuntime(client);
    const { POST } = await import("../src/app/api/documents/[id]/reindex/route");

    const response = await POST(
      authenticatedRequest(`/api/documents/${documentId}/reindex`, {
        method: "POST",
        body: JSON.stringify({ mode: "full" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = await payload(response);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      safety: {
        safeToRun: false,
        reason: "supabase_unavailable",
        activeJobCount: 0,
      },
    });
    expect(String(body.error)).toContain("Reindex is paused.");
    expect(client.rpc).not.toHaveBeenCalledWith("reset_document_index", expect.anything());
    expect(client.calls.some((call) => call.table === "documents" && call.operation === "update")).toBe(false);
  });

  it("rolls back single-document queue mutation when full reindex job enqueue fails", async () => {
    const document = {
      id: documentId,
      owner_id: userId,
      title: "Rollback Protocol",
      file_name: "rollback.pdf",
      source_path: null,
      import_batch_id: null,
      status: "failed",
      error_message: "older failure",
      page_count: 12,
      chunk_count: 34,
      image_count: 2,
      metadata: {},
    };
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") return ok(document);
      if (call.table === "import_batches") return ok([]);
      if (call.table === "ingestion_jobs" && call.operation === "select") return ok([]);
      if (call.table === "ingestion_jobs" && call.operation === "insert") return fail("job insert failed");
      if (call.table === "documents" && call.operation === "update") return ok([]);
      return ok([]);
    });
    mockRuntime(client);
    const { POST } = await import("../src/app/api/documents/[id]/reindex/route");

    const response = await POST(
      authenticatedRequest(`/api/documents/${documentId}/reindex`, {
        method: "POST",
        body: JSON.stringify({ mode: "full" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = await payload(response);
    const documentUpdates = client.calls.filter((call) => call.table === "documents" && call.operation === "update");

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Request failed." });
    expect(documentUpdates).toHaveLength(2);
    expect(documentUpdates[0]?.updatePayload).toEqual({
      status: "queued",
      error_message: null,
      page_count: 0,
      chunk_count: 0,
      image_count: 0,
    });
    expect(documentUpdates[1]?.updatePayload).toEqual({
      status: "failed",
      error_message: "older failure",
      page_count: 12,
      chunk_count: 34,
      image_count: 2,
    });
  });

  it("rolls back per-document queue mutation when bulk full reindex enqueue fails", async () => {
    const document = {
      id: documentId,
      owner_id: userId,
      title: "Bulk Rollback Protocol",
      file_name: "bulk-rollback.pdf",
      source_path: "legacy/imports/bulk-rollback.pdf",
      import_batch_id: null,
      status: "failed",
      error_message: "older failure",
      page_count: 3,
      chunk_count: 8,
      image_count: 1,
      metadata: {},
    };
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") return ok([document]);
      if (call.table === "import_batches") return ok([]);
      if (call.table === "ingestion_jobs" && call.operation === "select") return ok([]);
      if (call.table === "documents" && call.operation === "update") return ok([]);
      if (call.table === "ingestion_jobs" && call.operation === "insert") return fail("bulk job insert failed");
      return ok([]);
    });
    mockRuntime(client, { invalidateRagCachesForOwner: vi.fn() });
    const { POST } = await import("../src/app/api/documents/bulk/reindex/route");

    const response = await POST(
      authenticatedRequest("/api/documents/bulk/reindex", {
        method: "POST",
        body: JSON.stringify({ documentIds: [documentId], mode: "full" }),
      }),
    );
    const body = await payload(response);
    const documentUpdates = client.calls.filter((call) => call.table === "documents" && call.operation === "update");

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: false,
      results: [
        {
          documentId,
          mode: "full",
          ok: false,
          error: "bulk job insert failed",
        },
      ],
    });
    expect(documentUpdates).toHaveLength(2);
    expect(documentUpdates[0]?.updatePayload).toEqual({
      status: "queued",
      error_message: null,
      page_count: 0,
      chunk_count: 0,
      image_count: 0,
    });
    expect(documentUpdates[1]?.updatePayload).toEqual({
      status: "failed",
      error_message: "older failure",
      page_count: 3,
      chunk_count: 8,
      image_count: 1,
    });
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

    expect(response.status).toBe(500);
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

    expect(response.status).toBe(500);
    expect(client.storageMocks.remove).toHaveBeenCalledWith([uploadPath]);
    expect(
      client.calls.some(
        (call) =>
          call.table === "documents" &&
          call.operation === "delete" &&
          call.filters.some((filter) => filter.column === "id" && typeof filter.value === "string") &&
          call.filters.some((filter) => filter.column === "owner_id" && filter.value === userId),
      ),
    ).toBe(true);
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

  it("filters document detail rows to the committed index generation", async () => {
    const committedGeneration = "11111111-1111-4111-8111-111111111111";
    const replacementGeneration = "22222222-2222-4222-8222-222222222222";
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return ok({
          id: documentId,
          owner_id: userId,
          page_count: 1,
          chunk_count: 1,
          image_count: 1,
          metadata: { index_generation_id: committedGeneration },
        });
      }
      if (call.table === "document_pages") return ok([{ id: "page-1", page_number: 1, text: "Page", metadata: {} }]);
      if (call.table === "document_images") {
        return ok([
          {
            id: "image-old",
            page_number: 1,
            caption: "Old",
            image_type: "clinical_table",
            metadata: { index_generation_id: committedGeneration },
          },
          {
            id: "image-new",
            page_number: 1,
            caption: "New",
            image_type: "clinical_table",
            metadata: { index_generation_id: replacementGeneration },
          },
        ]);
      }
      if (call.table === "document_chunks") {
        return ok([
          {
            id: "chunk-old",
            page_number: 1,
            chunk_index: 0,
            content: "Old",
            image_ids: [],
            metadata: { index_generation_id: committedGeneration },
          },
          {
            id: "chunk-new",
            page_number: 1,
            chunk_index: 1,
            content: "New",
            image_ids: [],
            metadata: { index_generation_id: replacementGeneration },
          },
        ]);
      }
      if (call.table === "document_table_facts") {
        return ok([
          { id: "fact-old", document_id: documentId, metadata: { index_generation_id: committedGeneration } },
          { id: "fact-new", document_id: documentId, metadata: { index_generation_id: replacementGeneration } },
        ]);
      }
      return ok([]);
    });
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/route");

    const response = await GET(authenticatedRequest(`/api/documents/${documentId}`), {
      params: Promise.resolve({ id: documentId }),
    });
    const body = (await payload(response)) as {
      images: Array<{ id: string }>;
      chunks: Array<{ id: string }>;
      tableFacts: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.images.map((image: { id: string }) => image.id)).toEqual(["image-old"]);
    expect(body.chunks.map((chunk: { id: string }) => chunk.id)).toEqual(["chunk-old"]);
    expect(body.tableFacts.map((fact: { id: string }) => fact.id)).toEqual(["fact-old"]);
  });

  it("filters direct document search fallback rows to the committed index generation", async () => {
    const committedGeneration = "11111111-1111-4111-8111-111111111111";
    const replacementGeneration = "22222222-2222-4222-8222-222222222222";
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return ok({ id: documentId, metadata: { index_generation_id: committedGeneration } });
      }
      if (call.table === "document_chunks") {
        return ok([
          {
            id: "chunk-old",
            page_number: 1,
            chunk_index: 0,
            section_heading: "Committed",
            content: "lithium monitoring committed row",
            image_ids: [],
            metadata: { index_generation_id: committedGeneration },
            index_generation_id: committedGeneration,
          },
          {
            id: "chunk-new",
            page_number: 1,
            chunk_index: 1,
            section_heading: "Replacement",
            content: "lithium monitoring replacement row",
            image_ids: [],
            metadata: { index_generation_id: replacementGeneration },
            index_generation_id: replacementGeneration,
          },
        ]);
      }
      return ok([]);
    });
    client.rpc.mockImplementation(async (name: string) =>
      name === "search_document_chunks" ? fail("missing rpc") : ok([]),
    );
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/search/route");

    const response = await GET(authenticatedRequest(`/api/documents/${documentId}/search?q=lithium`), {
      params: Promise.resolve({ id: documentId }),
    });
    const body = (await payload(response)) as { strategy: string; results: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.strategy).toBe("portable_ilike_fallback");
    expect(body.results.map((result: { id: string }) => result.id)).toEqual(["chunk-old"]);
  });

  it("filters table fact review rows to the committed index generation", async () => {
    const committedGeneration = "11111111-1111-4111-8111-111111111111";
    const replacementGeneration = "22222222-2222-4222-8222-222222222222";
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return ok({ id: documentId, metadata: { index_generation_id: committedGeneration } });
      }
      if (call.table === "document_table_facts") {
        return ok([
          { id: "fact-old", document_id: documentId, metadata: { index_generation_id: committedGeneration } },
          { id: "fact-new", document_id: documentId, metadata: { index_generation_id: replacementGeneration } },
        ]);
      }
      return ok([]);
    });
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/table-facts/route");

    const response = await GET(authenticatedRequest(`/api/documents/${documentId}/table-facts`), {
      params: Promise.resolve({ id: documentId }),
    });
    const body = (await payload(response)) as { tableFacts: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.tableFacts.map((fact: { id: string }) => fact.id)).toEqual(["fact-old"]);
  });

  it("rejects malformed document detail ids before Supabase uuid filters", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/route");

    const response = await GET(authenticatedRequest("/api/documents/=3&pageLimit=1"), {
      params: Promise.resolve({ id: "=3&pageLimit=1" }),
    });

    expect(response.status).toBe(400);
    expect(await payload(response)).toEqual({ error: "Invalid document id." });
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
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

  it("creates clean manual document labels for owned documents", async () => {
    const manualLabelId = "55555555-5555-4555-8555-555555555555";
    const client = createSupabaseMock((call) => {
      if (call.table === "documents") return ok({ id: documentId, owner_id: userId });
      if (call.table === "document_labels" && call.operation === "select" && call.maybeSingle) return ok(null);
      if (call.table === "document_labels" && call.operation === "insert") {
        return ok({ id: manualLabelId, ...(call.insertPayload as Record<string, unknown>) });
      }
      if (call.table === "document_labels" && call.operation === "select") {
        return ok([{ id: manualLabelId, document_id: documentId, label: "clozapine monitoring" }]);
      }
      return ok([]);
    });
    const invalidateRagCachesForDocumentMutation = vi.fn();
    mockRuntime(client, { invalidateRagCachesForDocumentMutation });
    const { POST } = await import("../src/app/api/documents/[id]/labels/route");

    const response = await POST(
      authenticatedRequest(`/api/documents/${documentId}/labels`, {
        method: "POST",
        body: JSON.stringify({ label: "Clozapine Monitoring!!", label_type: "medication" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = await payload(response);
    const insert = client.calls.find((call) => call.table === "document_labels" && call.operation === "insert");

    expect(response.status).toBe(201);
    expect(body.label).toMatchObject({ label: "clozapine monitoring", label_type: "medication", source: "manual" });
    expect(insert?.insertPayload).toMatchObject({
      document_id: documentId,
      owner_id: userId,
      label: "clozapine monitoring",
      label_type: "medication",
      source: "manual",
      confidence: 1,
    });
    expect(invalidateRagCachesForDocumentMutation).toHaveBeenCalledWith(userId);
  });

  it("creates manual site labels for owned documents", async () => {
    const manualLabelId = "55555555-5555-4555-8555-555555555556";
    const client = createSupabaseMock((call) => {
      if (call.table === "documents") return ok({ id: documentId, owner_id: userId });
      if (call.table === "document_labels" && call.operation === "select" && call.maybeSingle) return ok(null);
      if (call.table === "document_labels" && call.operation === "insert") {
        return ok({ id: manualLabelId, ...(call.insertPayload as Record<string, unknown>) });
      }
      if (call.table === "document_labels" && call.operation === "select") {
        return ok([{ id: manualLabelId, document_id: documentId, label: "fiona stanley hospital" }]);
      }
      return ok([]);
    });
    const invalidateRagCachesForDocumentMutation = vi.fn();
    mockRuntime(client, { invalidateRagCachesForDocumentMutation });
    const { POST } = await import("../src/app/api/documents/[id]/labels/route");

    const response = await POST(
      authenticatedRequest(`/api/documents/${documentId}/labels`, {
        method: "POST",
        body: JSON.stringify({ label: "FSH", label_type: "site" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = await payload(response);
    const insert = client.calls.find((call) => call.table === "document_labels" && call.operation === "insert");

    expect(response.status).toBe(201);
    expect(body.label).toMatchObject({ label: "fiona stanley hospital", label_type: "site", source: "manual" });
    expect(insert?.insertPayload).toMatchObject({
      document_id: documentId,
      owner_id: userId,
      label: "fiona stanley hospital",
      label_type: "site",
      source: "manual",
      confidence: 1,
    });
    expect(invalidateRagCachesForDocumentMutation).toHaveBeenCalledWith(userId);
  });

  it("rejects noisy manual document labels before insert", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { POST } = await import("../src/app/api/documents/[id]/labels/route");

    const response = await POST(
      authenticatedRequest(`/api/documents/${documentId}/labels`, {
        method: "POST",
        body: JSON.stringify({ label: "Document control", label_type: "topic" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(400);
    expect(await payload(response)).toEqual({
      error: "Enter a short, specific clinical tag. Generic document-control tags are not allowed.",
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("renames only manual document labels", async () => {
    const manualLabelId = "66666666-6666-4666-8666-666666666666";
    const client = createSupabaseMock((call) => {
      if (call.table === "documents") return ok({ id: documentId, owner_id: userId });
      if (call.table === "document_labels" && call.operation === "select" && call.maybeSingle) {
        return ok({ id: manualLabelId, metadata: { created_by: "test" } });
      }
      if (call.table === "document_labels" && call.operation === "update") {
        return ok({ id: manualLabelId, ...(call.updatePayload as Record<string, unknown>) });
      }
      if (call.table === "document_labels" && call.operation === "select") {
        return ok([{ id: manualLabelId, document_id: documentId, label: "lithium toxicity" }]);
      }
      return ok([]);
    });
    const invalidateRagCachesForDocumentMutation = vi.fn();
    mockRuntime(client, { invalidateRagCachesForDocumentMutation });
    const { PATCH } = await import("../src/app/api/documents/[id]/labels/route");

    const response = await PATCH(
      authenticatedRequest(`/api/documents/${documentId}/labels`, {
        method: "PATCH",
        body: JSON.stringify({ labelId: manualLabelId, label: "Lithium toxicity", label_type: "risk" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const update = client.calls.find((call) => call.table === "document_labels" && call.operation === "update");

    expect(response.status).toBe(200);
    expect(update?.filters).toContainEqual({ column: "source", value: "manual" });
    expect(update?.updatePayload).toMatchObject({ label: "lithium toxicity", label_type: "risk", source: "manual" });
    expect(invalidateRagCachesForDocumentMutation).toHaveBeenCalledWith(userId);
  });

  it("refuses to mutate generated document labels", async () => {
    const generatedLabelId = "77777777-7777-4777-8777-777777777777";
    const client = createSupabaseMock((call) => {
      if (call.table === "documents") return ok({ id: documentId, owner_id: userId });
      if (call.table === "document_labels" && call.operation === "select" && call.maybeSingle) return ok(null);
      return ok([]);
    });
    mockRuntime(client);
    const { PATCH } = await import("../src/app/api/documents/[id]/labels/route");

    const response = await PATCH(
      authenticatedRequest(`/api/documents/${documentId}/labels`, {
        method: "PATCH",
        body: JSON.stringify({ labelId: generatedLabelId, label: "Lithium toxicity", label_type: "risk" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({ error: "Manual tag not found." });
    expect(client.calls.some((call) => call.table === "document_labels" && call.operation === "update")).toBe(false);
  });

  it("deletes only manual document labels", async () => {
    const manualLabelId = "88888888-8888-4888-8888-888888888888";
    const client = createSupabaseMock((call) => {
      if (call.table === "documents") return ok({ id: documentId, owner_id: userId });
      if (call.table === "document_labels" && call.operation === "select" && call.maybeSingle) {
        return ok({ id: manualLabelId });
      }
      if (call.table === "document_labels" && call.operation === "delete") return ok([]);
      if (call.table === "document_labels" && call.operation === "select") return ok([]);
      return ok([]);
    });
    const invalidateRagCachesForDocumentMutation = vi.fn();
    mockRuntime(client, { invalidateRagCachesForDocumentMutation });
    const { DELETE } = await import("../src/app/api/documents/[id]/labels/route");

    const response = await DELETE(
      authenticatedRequest(`/api/documents/${documentId}/labels`, {
        method: "DELETE",
        body: JSON.stringify({ labelId: manualLabelId }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const deleteCall = client.calls.find((call) => call.table === "document_labels" && call.operation === "delete");

    expect(response.status).toBe(200);
    expect(await payload(response)).toMatchObject({ deleted: true, labelId: manualLabelId, labels: [] });
    expect(deleteCall?.filters).toContainEqual({ column: "source", value: "manual" });
    expect(invalidateRagCachesForDocumentMutation).toHaveBeenCalledWith(userId);
  });

  it("permanently deletes an owned document, indexing traces, and storage objects", async () => {
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
      if (call.table === "rag_query_misses" && call.operation === "delete") return ok([]);
      if (call.table === "rag_response_cache" && call.operation === "delete") return ok([]);
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
    const missDeletes = client.calls.filter((call) => call.table === "rag_query_misses" && call.operation === "delete");
    const cacheDelete = client.calls.find((call) => call.table === "rag_response_cache" && call.operation === "delete");
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
    expect(missDeletes.map((call) => call.overlapsFilters[0])).toEqual(
      expect.arrayContaining([
        { column: "top_chunk_ids", values: [chunkId] },
        { column: "cited_chunk_ids", values: [chunkId] },
      ]),
    );
    expect(
      missDeletes.some((call) =>
        call.orFilters.includes(`clicked_document_id.eq.${documentId},expected_document_id.eq.${documentId}`),
      ),
    ).toBe(true);
    expect(cacheDelete?.filters).toContainEqual({ column: "owner_id", value: userId });
    expect(cacheDelete?.inFilters).toContainEqual({ column: "cache_kind", values: ["search", "answer"] });
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
      if (call.table === "rag_query_misses" && call.operation === "delete") return ok([]);
      if (call.table === "rag_response_cache" && call.operation === "delete") return ok([]);
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

  it("does not delete the document if index trace cleanup fails", async () => {
    const sourcePath = `${userId}/documents/${documentId}/source.pdf`;
    const chunkId = "44444444-4444-4444-8444-444444444444";
    const client = createSupabaseMock((call) => {
      if (call.table === "documents" && call.operation === "select") {
        return ok({ id: documentId, owner_id: userId, title: "Owned", storage_path: sourcePath });
      }
      if (call.table === "ingestion_jobs" && call.operation === "select") return ok([]);
      if (call.table === "document_images" && call.operation === "select") return ok([]);
      if (call.table === "document_chunks" && call.operation === "select") return ok([{ id: chunkId }]);
      if (call.table === "storage_cleanup_jobs" && call.operation === "insert") return ok({ id: "cleanup-1" });
      if (call.table === "storage_cleanup_jobs" && call.operation === "update") return ok([]);
      if (call.table === "rag_queries" && call.operation === "delete") return fail("query log delete failed");
      if (call.table === "rag_query_misses" && call.operation === "delete") return ok([]);
      if (call.table === "rag_response_cache" && call.operation === "delete") return ok([]);
      if (call.table === "documents" && call.operation === "delete") return ok([]);
      return ok([]);
    });
    mockRuntime(client);
    const { DELETE } = await import("../src/app/api/documents/[id]/route");

    const response = await DELETE(authenticatedRequest(`/api/documents/${documentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: documentId }),
    });
    const cleanupUpdate = client.calls.find(
      (call) => call.table === "storage_cleanup_jobs" && call.operation === "update",
    );

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({ error: "Request failed." });
    expect(cleanupUpdate?.updatePayload).toMatchObject({
      status: "failed",
      last_error: "Index trace cleanup failed: query log delete failed",
    });
    expect(client.calls.some((call) => call.table === "documents" && call.operation === "delete")).toBe(false);
    expect(client.storageMocks.remove).not.toHaveBeenCalled();
  });

  // M9 (audit 2026-07-01): the guard covers PENDING jobs too — a just-queued
  // reindex racing a delete used to orphan freshly-uploaded storage objects.
  it.each(["processing", "pending"] as const)(
    "blocks permanent delete while a document has %s indexing work",
    async (jobStatus) => {
      const client = createSupabaseMock((call) => {
        if (call.table === "documents" && call.operation === "select") {
          return ok({ id: documentId, owner_id: userId, title: "Owned", storage_path: "source.pdf" });
        }
        if (call.table === "ingestion_jobs" && call.operation === "select") {
          return ok([{ id: "job-1", status: jobStatus }]);
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
        error: "Document has pending or processing indexing work. Stop or wait for the worker before deleting.",
      });
      expect(client.calls.some((call) => call.table === "documents" && call.operation === "delete")).toBe(false);
      expect(client.storageMocks.remove).not.toHaveBeenCalled();
    },
  );

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
    client.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) =>
      name === "consume_api_rate_limit" && args?.p_bucket === "answer"
        ? { data: [rateLimitRow({ limited: true, limit_value: 30, remaining: 0 })], error: null }
        : name === "consume_api_rate_limit"
          ? { data: [rateLimitRow()], error: null }
          : ok([]),
    );
    mockRuntime(client, { searchChunksWithTelemetry, answerQuestionWithScope });

    const answerRoute = await import("../src/app/api/answer/route");
    const searchRoute = await import("../src/app/api/search/route");
    const answerRequest = () =>
      authenticatedRequest("/api/answer", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ query: "monitoring" }),
      });

    const limited = await answerRoute.POST(answerRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(await payload(limited)).toEqual({
      error: "Too many answer requests. Retry shortly.",
      retryAfterSeconds: 60,
    });
    expect(answerQuestionWithScope).not.toHaveBeenCalled();

    const searchResponse = await searchRoute.POST(
      authenticatedRequest("/api/search", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ query: "monitoring" }),
      }),
    );

    expect(searchResponse.status).toBe(200);
    expect(searchChunksWithTelemetry).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));
    expect(client.rpc).toHaveBeenCalledWith(
      "consume_api_rate_limit",
      expect.objectContaining({ p_owner_id: userId, p_bucket: "answer" }),
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "consume_api_rate_limit",
      expect.objectContaining({ p_owner_id: userId, p_bucket: "search" }),
    );
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
    client.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) =>
      name === "consume_api_rate_limit" && args?.p_bucket === "search"
        ? { data: [rateLimitRow({ limited: true, limit_value: 2, remaining: 0 })], error: null }
        : name === "consume_api_rate_limit"
          ? { data: [rateLimitRow()], error: null }
          : ok([]),
    );
    mockRuntime(client, { searchChunksWithTelemetry });
    const searchRoute = await import("../src/app/api/search/route");
    const searchRequest = () =>
      authenticatedRequest("/api/search", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.20" },
        body: JSON.stringify({ query: "monitoring", includeRelatedDocuments: false }),
      });

    const limited = await searchRoute.POST(searchRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(await payload(limited)).toEqual({
      error: "Search is temporarily rate limited because too many requests were received. Retry shortly.",
      retryAfterSeconds: 60,
    });
    expect(searchChunksWithTelemetry).not.toHaveBeenCalled();
  });

  it("fails closed when the durable rate limit check is unavailable", async () => {
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
    const client = createSupabaseMock();
    client.rpc.mockImplementation(async (name: string) =>
      name === "consume_api_rate_limit" ? fail("limiter table unavailable") : ok([]),
    );
    mockRuntime(client, { searchChunksWithTelemetry });
    const { POST } = await import("../src/app/api/search/route");

    const response = await POST(
      authenticatedRequest("/api/search", {
        method: "POST",
        body: JSON.stringify({ query: "monitoring", includeRelatedDocuments: false }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await payload(response)).toEqual({ error: "Rate limit check is temporarily unavailable." });
    expect(searchChunksWithTelemetry).not.toHaveBeenCalled();
  });

  it("uses an in-memory limiter fallback for managed local no-auth search when the durable check is unavailable", async () => {
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
    const client = createSupabaseMock();
    client.auth.admin.listUsers.mockResolvedValueOnce({
      data: { users: [{ id: userId, email: "clinician@example.test" }], nextPage: 0 },
      error: null,
    });
    client.rpc.mockImplementation(async (name: string) =>
      name === "consume_api_rate_limit" ? fail("limiter table unavailable") : ok([]),
    );
    mockRuntime(
      client,
      { searchChunksWithTelemetry },
      { localNoAuth: true, localOwnerEmail: "clinician@example.test" },
    );
    const { POST } = await import("../src/app/api/search/route");

    const response = await POST(
      localPortRequest(4298, "/api/search", {
        method: "POST",
        body: JSON.stringify({ query: "monitoring", includeRelatedDocuments: false }),
      }),
    );

    expect(response.status).toBe(200);
    expect(searchChunksWithTelemetry).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));
    expect(client.rpc).toHaveBeenCalledWith(
      "consume_api_rate_limit",
      expect.objectContaining({ p_owner_id: userId, p_bucket: "search" }),
    );
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
    client.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) =>
      name === "consume_api_rate_limit" && args?.p_bucket === "answer"
        ? { data: [rateLimitRow({ limited: true, limit_value: 30, remaining: 0 })], error: null }
        : name === "consume_api_rate_limit"
          ? { data: [rateLimitRow()], error: null }
          : ok([]),
    );
    mockRuntime(client, { answerQuestionWithScope });

    const streamRoute = await import("../src/app/api/answer/stream/route");

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
    expect(body).toContain("Too many answer requests. Retry shortly.");
    expect(answerQuestionWithScope).not.toHaveBeenCalled();
  });

  it("uses an in-memory limiter fallback for managed local no-auth streaming answers when the durable check is unavailable", async () => {
    const answerQuestionWithScope = vi.fn(async () => ({
      answer: "Owned evidence.",
      grounded: true,
      confidence: "medium",
      citations: [],
      sources: [],
    }));
    const client = createSupabaseMock();
    client.auth.admin.listUsers.mockResolvedValueOnce({
      data: { users: [{ id: userId, email: "clinician@example.test" }], nextPage: 0 },
      error: null,
    });
    client.rpc.mockImplementation(async (name: string) =>
      name === "consume_api_rate_limit" ? fail("limiter table unavailable") : ok([]),
    );
    mockRuntime(client, { answerQuestionWithScope }, { localNoAuth: true, localOwnerEmail: "clinician@example.test" });
    const { POST } = await import("../src/app/api/answer/stream/route");

    const response = await POST(
      localPortRequest(4298, "/api/answer/stream", {
        method: "POST",
        body: JSON.stringify({ query: "monitoring", documentId: otherDocumentId }),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("event: final");
    expect(answerQuestionWithScope).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: userId, documentId: otherDocumentId, onProgress: expect.any(Function) }),
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "consume_api_rate_limit",
      expect.objectContaining({ p_owner_id: userId, p_bucket: "answer" }),
    );
  });

  it("does not stream internal PublicApiError details to clients", async () => {
    const answerQuestionWithScope = vi.fn(async () => {
      const { PublicApiError } = await import("../src/lib/http");
      throw new PublicApiError("Stream failed safely.", 503, {
        code: "stream_failed",
        causeMessage: "secret table public.private_data does not exist",
        sqlState: "42P01",
      });
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
    expect(body).toContain("Stream failed safely.");
    expect(body).toContain("stream_failed");
    expect(body).not.toContain("private_data");
    expect(body).not.toContain("42P01");
  });

  it("refuses streamed answer final events backed by danger-class source governance warnings", async () => {
    const answerQuestionWithScope = vi.fn(async () => ({
      answer: "Use the old protocol.",
      grounded: true,
      confidence: "high",
      citations: [{ chunk_id: "chunk-1", page_number: 1, quote: "old protocol", document_id: documentId }],
      smartPanel: { query: "monitoring" },
      smartApiPlan: { displayMode: "direct" },
      sources: [
        {
          id: "chunk-1",
          document_id: documentId,
          title: "Outdated guideline",
          file_name: "old.pdf",
          page_number: 1,
          chunk_index: 0,
          section_heading: null,
          content: "old protocol",
          image_ids: [],
          similarity: 0.9,
          source_metadata: {
            source_title: "Outdated guideline",
            publisher: "Local WA service",
            jurisdiction: "WA",
            version: null,
            publication_date: null,
            review_date: null,
            uploaded_at: null,
            indexed_at: null,
            uploaded_by: null,
            document_status: "outdated",
            clinical_validation_status: "approved",
            extraction_quality: "good",
          },
          images: [],
        },
      ],
    }));
    const client = createSupabaseMock();
    mockRuntime(client, { answerQuestionWithScope });
    const { POST } = await import("../src/app/api/answer/stream/route");

    const response = await POST(
      authenticatedRequest("/api/answer/stream", {
        method: "POST",
        body: JSON.stringify({ query: "monitoring", documentId }),
      }),
    );
    const finalPayload = ssePayload(await response.text(), "final");

    expect(response.status).toBe(200);
    expect(finalPayload.grounded).toBe(false);
    expect(finalPayload.confidence).toBe("unsupported");
    expect(finalPayload.citations).toEqual([]);
    expect(finalPayload.sources).toEqual([]);
    expect(finalPayload.smartPanel).toBeUndefined();
    expect(finalPayload.smartApiPlan).toBeUndefined();
    expect(String(finalPayload.answer)).toContain("cannot provide a clinical answer");
    expect(finalPayload.sourceGovernanceWarnings).toEqual([
      expect.objectContaining({ code: "outdated_source", severity: "danger" }),
    ]);
  });

  it("refuses answer responses backed by danger-class source governance warnings", async () => {
    const answerQuestionWithScope = vi.fn(async () => ({
      answer: "Use the old protocol.",
      grounded: true,
      confidence: "high",
      citations: [{ chunk_id: "chunk-1", page_number: 1, quote: "old protocol", document_id: documentId }],
      sources: [
        {
          id: "chunk-1",
          document_id: documentId,
          title: "Outdated guideline",
          file_name: "old.pdf",
          page_number: 1,
          chunk_index: 0,
          section_heading: null,
          content: "old protocol",
          image_ids: [],
          similarity: 0.9,
          source_metadata: {
            source_title: "Outdated guideline",
            publisher: "Local WA service",
            jurisdiction: "WA",
            version: null,
            publication_date: null,
            review_date: null,
            uploaded_at: null,
            indexed_at: null,
            uploaded_by: null,
            document_status: "outdated",
            clinical_validation_status: "approved",
            extraction_quality: "good",
          },
          images: [],
        },
      ],
    }));
    const client = createSupabaseMock();
    mockRuntime(client, { answerQuestionWithScope });
    const { POST } = await import("../src/app/api/answer/route");

    const response = await POST(
      authenticatedRequest("/api/answer", {
        method: "POST",
        body: JSON.stringify({ query: "monitoring", documentId }),
      }),
    );
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.grounded).toBe(false);
    expect(body.confidence).toBe("unsupported");
    expect(body.citations).toEqual([]);
    // The refused answer's sources/smartPanel/smartApiPlan must not leak through.
    expect(body.sources).toEqual([]);
    expect(body.smartPanel).toBeUndefined();
    expect(body.smartApiPlan).toBeUndefined();
    expect(String(body.answer)).toContain("cannot provide a clinical answer");
    expect(body.sourceGovernanceWarnings).toEqual([
      expect.objectContaining({ code: "outdated_source", severity: "danger" }),
    ]);
  });

  it("rate limits document summarization before OpenAI work", async () => {
    const summarizeDocument = vi.fn(async () => ({ summary: "Expensive summary" }));
    const client = createSupabaseMock();
    client.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) =>
      name === "consume_api_rate_limit" && args?.p_bucket === "document_summarize"
        ? { data: [rateLimitRow({ limited: true, limit_value: 12, remaining: 0 })], error: null }
        : name === "consume_api_rate_limit"
          ? { data: [rateLimitRow()], error: null }
          : ok([]),
    );
    mockRuntime(client, { summarizeDocument });
    const { POST } = await import("../src/app/api/documents/[id]/summarize/route");

    const response = await POST(authenticatedRequest(`/api/documents/${documentId}/summarize`, { method: "POST" }), {
      params: Promise.resolve({ id: documentId }),
    });

    expect(response.status).toBe(429);
    expect(await payload(response)).toMatchObject({
      error: "Too many document summary requests. Retry shortly.",
      retryAfterSeconds: 60,
    });
    expect(summarizeDocument).not.toHaveBeenCalled();
  });

  it("rate limits single and bulk reindex before enrichment or queue work", async () => {
    const client = createSupabaseMock();
    client.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) =>
      name === "consume_api_rate_limit" && (args?.p_bucket === "document_reindex" || args?.p_bucket === "bulk_reindex")
        ? { data: [rateLimitRow({ limited: true, limit_value: 1, remaining: 0 })], error: null }
        : name === "consume_api_rate_limit"
          ? { data: [rateLimitRow()], error: null }
          : ok([]),
    );
    const upsertDocumentEnrichment = vi.fn();
    const upsertDocumentDeepMemory = vi.fn();
    mockRuntime(client, { invalidateRagCachesForOwner: vi.fn() });
    vi.doMock("@/lib/document-enrichment", () => ({ upsertDocumentEnrichment }));
    vi.doMock("@/lib/deep-memory", () => ({ upsertDocumentDeepMemory }));
    const singleRoute = await import("../src/app/api/documents/[id]/reindex/route");
    const bulkRoute = await import("../src/app/api/documents/bulk/reindex/route");

    const singleResponse = await singleRoute.POST(
      authenticatedRequest(`/api/documents/${documentId}/reindex`, {
        method: "POST",
        body: JSON.stringify({ mode: "enrichment" }),
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const bulkResponse = await bulkRoute.POST(
      authenticatedRequest("/api/documents/bulk/reindex", {
        method: "POST",
        body: JSON.stringify({ documentIds: [documentId], mode: "enrichment" }),
      }),
    );

    expect(singleResponse.status).toBe(429);
    expect(bulkResponse.status).toBe(429);
    expect(upsertDocumentEnrichment).not.toHaveBeenCalled();
    expect(upsertDocumentDeepMemory).not.toHaveBeenCalled();
    expect(client.calls.some((call) => call.table === "documents")).toBe(false);
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

  it("source-only mode skips embeddings and never calls the vector hybrid RPC", async () => {
    const client = createSupabaseMock();
    mockRuntime(client, undefined, { providerMode: "offline" });
    const embedTextWithTelemetry = vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry,
      generateTextResponse: vi.fn(),
      generateStructuredTextResponse: vi.fn(),
      generateStructuredTextResult: vi.fn(),
    }));
    const { searchChunks } = await import("../src/lib/rag");

    await searchChunks({ query: "monitoring", documentId: otherDocumentId, ownerId: userId });

    expect(embedTextWithTelemetry).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalledWith("match_document_chunks_hybrid", expect.anything());
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
