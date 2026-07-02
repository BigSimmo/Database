import { afterEach, describe, expect, it, vi } from "vitest";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const batchJobId = "22222222-2222-4222-8222-222222222222";
const ingestionJobId = "33333333-3333-4333-8333-333333333333";
const documentId = "44444444-4444-4444-8444-444444444444";

type RouteJobRow = {
  id: string;
  status: string;
  documents: {
    id?: string;
    title: string;
    file_name: string;
    owner_id: string;
  };
};

type BatchRow = {
  id: string;
  status: string;
};

function createQueryMock<T>(
  result: { data: T; error: { message: string } | null },
) {
  const chain = {
    select: null as unknown as ReturnType<typeof vi.fn>,
    eq: null as unknown as ReturnType<typeof vi.fn>,
    in: null as unknown as ReturnType<typeof vi.fn>,
    order: null as unknown as ReturnType<typeof vi.fn>,
    limit: null as unknown as ReturnType<typeof vi.fn>,
    then: (resolve: (value: { data: T; error: { message: string } | null }) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  } as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: (resolve: (value: { data: T; error: { message: string } | null }) => void, reject?: (reason?: unknown) => void) => Promise<unknown>;
  };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  return chain;
}

const authenticationErrorMockClass = class AuthenticationError extends Error {};

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("/api/local-project-id", () => {
  it("returns a stable local identity payload", async () => {
    const { GET } = await import("../src/app/api/local-project-id/route");

    const response = await GET(new Request("http://localhost:3100/api/local-project-id"));
    const payload = await response.json();

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.identityPath).toBe("/api/local-project-id");
    expect(payload.projectId).toMatch(/^clinical-kb:[0-9a-f]{12}$/i);
    expect(payload.localServer.currentPort).toBe(3100);
  });
});

describe("/api/jobs", () => {
  it("returns demo jobs without calling Supabase when demo mode is enabled", async () => {
    const createAdminClient = vi.fn();
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => true }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));
    const { GET } = await import("../src/app/api/jobs/route");

    const response = await GET(new Request("http://localhost/api/jobs"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.demoMode).toBe(true);
    expect(Array.isArray(payload.jobs)).toBe(true);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns jobs with indexing-active metadata for authenticated users", async () => {
    const chain = createQueryMock({
      data: [
        {
          id: batchJobId,
          status: "pending",
          documents: {
            id: documentId,
            title: "Case guidance",
            file_name: "case.pdf",
            owner_id: ownerId,
          },
        } satisfies RouteJobRow,
      ],
      error: null,
    });
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: vi.fn(() => chain) }) }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: authenticationErrorMockClass,
      requireAuthenticatedUser: vi.fn(async () => ({ id: ownerId })),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));

    const { GET } = await import("../src/app/api/jobs/route");
    const response = await GET(new Request("http://localhost/api/jobs"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeJobCount).toBe(1);
    expect(payload.hasActiveJobs).toBe(true);
    expect(payload.pollAfterMs).toBe(5_000);
    expect(response.headers.get("x-indexing-active")).toBe("true");
    expect(Array.isArray(payload.jobs)).toBe(true);
  });
});

describe("/api/ingestion/jobs", () => {
  it("returns demo mode payload without querying Supabase", async () => {
    const createAdminClient = vi.fn();
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => true }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));
    const { GET } = await import("../src/app/api/ingestion/jobs/route");

    const response = await GET(new Request("http://localhost/api/ingestion/jobs"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      jobs: [],
      activeJobCount: 0,
      hasActiveJobs: false,
      pollAfterMs: null,
      demoMode: true,
    });
    expect(response.headers.get("x-indexing-active")).toBe("false");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns ingestion jobs for an authenticated user and marks active state", async () => {
    const chain = createQueryMock({
      data: [
        {
          id: ingestionJobId,
          status: "processing",
          documents: { title: "Case guidance", file_name: "case.pdf", owner_id: ownerId },
        },
      ] satisfies [RouteJobRow],
      error: null,
    });
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: vi.fn(() => chain) }) }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: authenticationErrorMockClass,
      requireAuthenticatedUser: vi.fn(async () => ({ id: ownerId })),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));
    const { GET } = await import("../src/app/api/ingestion/jobs/route");
    const request = new Request("http://localhost/api/ingestion/jobs?batchId=11111111-1111-4111-8111-111111111111");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeJobCount).toBe(1);
    expect(payload.hasActiveJobs).toBe(true);
    expect(payload.pollAfterMs).toBe(5_000);
    expect(payload.jobs).toHaveLength(1);
  });
});

describe("/api/ingestion/batches", () => {
  it("returns ingestion batch state with active polling headers", async () => {
    const chain = createQueryMock({
      data: [{ id: "b1", status: "queued" }, { id: "b2", status: "completed" }] satisfies BatchRow[],
      error: null,
    });
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: vi.fn(() => chain) }) }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: authenticationErrorMockClass,
      requireAuthenticatedUser: vi.fn(async () => ({ id: ownerId })),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));
    const { GET } = await import("../src/app/api/ingestion/batches/route");
    const response = await GET(new Request("http://localhost/api/ingestion/batches"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeBatchCount).toBe(1);
    expect(payload.hasActiveBatches).toBe(true);
    expect(payload.pollAfterMs).toBe(5_000);
    expect(payload.batches).toHaveLength(2);
    expect(response.headers.get("x-indexing-active")).toBe("true");
  });
});

describe("/api/documents/bulk", () => {
  it("blocks bulk edits in demo mode", async () => {
    const createAdminClient = vi.fn();
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => true }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));
    const { POST } = await import("../src/app/api/documents/bulk/route");

    const response = await POST(
      new Request("http://localhost/api/documents/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentIds: [documentId] }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Bulk edits are unavailable in demo mode.");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns unauthorized when user resolution fails", async () => {
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
    vi.doMock("@/lib/validation/body", () => ({
      parseJsonBody: vi.fn(async () => ({
        documentIds: [documentId],
        metadata: {},
        titleEdit: {},
        labels: { add: [], remove: [] },
      })),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: vi.fn() }) }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: authenticationErrorMockClass,
      requireAuthenticatedUser: vi.fn(async () => {
        throw new authenticationErrorMockClass();
      }),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));
    const { POST } = await import("../src/app/api/documents/bulk/route");

    const response = await POST(
      new Request("http://localhost/api/documents/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentIds: [documentId] }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Authentication required.");
  });
});
