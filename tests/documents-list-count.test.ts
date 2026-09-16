import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `GET /api/documents` used to ask PostgREST for `count: "exact"` on the page read itself, so
 * every list request paid for a full aggregate over the owner-scoped set — including the common
 * request whose whole result already fits in one page. The total is now derived from a short
 * page and only asked for when the page comes back full.
 *
 * These tests pin what the client reads: `pagination.total`, `hasMore` and `nextOffset` for every
 * shape of page, and that the count, when it runs, counts exactly the rows the page was drawn
 * from — same owner scope, same filters.
 *
 * Two of them exist because dropping the count changed how PostgREST answers an over-range
 * `Range` header. It rejects a range with PGRST103 only when it has a total to compare against,
 * and it has one only when a count was requested, so an offset past the end now arrives as a
 * plain 200 with an empty array. The page read is mocked here, so a test may only inject a result
 * the real route could receive: an empty 200 for the over-range page, and a PGRST103 error only
 * where the route still treats one defensively.
 */

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type SelectOptions = { count?: string; head?: boolean };
type QueryCall = {
  table: string;
  selected?: string;
  selectOptions?: SelectOptions;
  filters: Array<{ column: string; value: unknown }>;
  orFilters: string[];
  range?: { from: number; to: number };
};
type QueryResult = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

function documentRow(index: number) {
  return {
    id: `1111111${index}-1111-4111-8111-11111111111${index}`,
    owner_id: userId,
    title: `Guideline ${index}`,
    status: "indexed",
  };
}

function createSupabaseMock(resolve: (call: QueryCall) => QueryResult) {
  const calls: QueryCall[] = [];
  const client = {
    calls,
    from(table: string) {
      const call: QueryCall = { table, filters: [], orFilters: [] };
      calls.push(call);
      const builder = {
        select(selected: string, options?: SelectOptions) {
          call.selected = selected;
          call.selectOptions = options;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push({ column, value });
          return builder;
        },
        is(column: string, value: unknown) {
          call.filters.push({ column, value });
          return builder;
        },
        in() {
          return builder;
        },
        or(filter: string) {
          call.orFilters.push(filter);
          return builder;
        },
        order() {
          return builder;
        },
        range(from: number, to: number) {
          call.range = { from, to };
          return builder;
        },
        then(onfulfilled: (value: QueryResult) => unknown) {
          return Promise.resolve(resolve(call)).then(onfulfilled);
        },
      };
      return builder;
    },
    rpc: async () => ({
      data: [
        {
          limited: false,
          limit_value: 100,
          remaining: 99,
          retry_after_seconds: 60,
          reset_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
      error: null,
    }),
  };
  return client;
}

function mockRuntime(client: ReturnType<typeof createSupabaseMock>) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: {},
    isDemoMode: () => false,
    isLocalNoAuthMode: () => false,
    requireServerEnv: () => undefined,
    requireOpenAIEnv: () => undefined,
  }));
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
  vi.doMock("@/lib/supabase/auth", () => ({
    AuthenticationError: class AuthenticationError extends Error {},
    requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
    getOptionalAuthenticatedUser: vi.fn(async () => ({ id: userId })),
    unauthorizedResponse: () => new Response(null, { status: 401 }),
  }));
}

async function listDocuments(query: string) {
  const { GET } = await import("@/app/api/documents/route");
  const response = await GET(
    new Request(`http://localhost/api/documents${query}`, { headers: { authorization: "Bearer valid-token" } }),
  );
  return { response, body: (await response.json()) as Record<string, never> };
}

function documentQueries(client: ReturnType<typeof createSupabaseMock>) {
  return client.calls.filter((call) => call.table === "documents");
}

afterEach(() => {
  vi.resetModules();
});

describe("GET /api/documents pagination total", () => {
  it("derives the total from a short page instead of paying for an aggregate", async () => {
    const client = createSupabaseMock(() => ({ data: [documentRow(1), documentRow(2)], error: null }));
    mockRuntime(client);

    const { response, body } = await listDocuments("?limit=50&includeMeta=false");

    expect(response.status).toBe(200);
    expect(body.pagination).toEqual({ limit: 50, offset: 0, total: 2, nextOffset: 2, hasMore: false });
    expect(documentQueries(client)).toHaveLength(1);
    expect(documentQueries(client)[0].selectOptions).toBeUndefined();
  });

  it("counts the pages already skipped when a short page ends a deeper offset", async () => {
    const client = createSupabaseMock(() => ({ data: [documentRow(1)], error: null }));
    mockRuntime(client);

    const { body } = await listDocuments("?limit=50&offset=100&includeMeta=false");

    expect(body.pagination).toEqual({ limit: 50, offset: 100, total: 101, nextOffset: 101, hasMore: false });
    expect(documentQueries(client)).toHaveLength(1);
  });

  it("asks for the exact count only when the page comes back full", async () => {
    const client = createSupabaseMock((call) =>
      call.selectOptions?.head
        ? { data: null, error: null, count: 137 }
        : { data: [documentRow(1), documentRow(2)], error: null },
    );
    mockRuntime(client);

    const { body } = await listDocuments("?limit=2&includeMeta=false");

    expect(body.pagination).toEqual({ limit: 2, offset: 0, total: 137, nextOffset: 2, hasMore: true });
    const [page, total] = documentQueries(client);
    expect(page.selectOptions).toBeUndefined();
    expect(total.selectOptions).toEqual({ count: "exact", head: true });
    expect(total.range).toBeUndefined();
  });

  it("counts the same rows the page was drawn from — same owner scope, same filters", async () => {
    const client = createSupabaseMock((call) =>
      call.selectOptions?.head ? { data: null, error: null, count: 9 } : { data: [documentRow(1)], error: null },
    );
    mockRuntime(client);

    await listDocuments("?limit=1&status=indexed&q=clozapine&includeMeta=false");

    const [page, total] = documentQueries(client);
    expect(total.orFilters).toEqual(page.orFilters);
    expect(total.orFilters[0]).toContain(`owner_id.eq.${userId}`);
    expect(total.filters).toEqual(page.filters);
    expect(total.filters).toContainEqual({ column: "status", value: "indexed" });
    expect(total.orFilters.join()).toContain("title.ilike.%clozapine%");
  });

  it("serves the page with a null total rather than a plausible one when the count read fails", async () => {
    const client = createSupabaseMock((call) =>
      call.selectOptions?.head
        ? { data: null, error: { message: "count unavailable" }, count: null }
        : { data: [documentRow(1)], error: null },
    );
    mockRuntime(client);

    const { response, body } = await listDocuments("?limit=1&includeMeta=false");

    expect(response.status).toBe(200);
    // Unknown means unknown. Reporting the page length instead would tell a reader with a
    // 5000-document corpus that they are seeing "1 of 1"; `hasMore` still says there is more.
    expect(body.pagination).toEqual({ limit: 1, offset: 0, total: null, nextOffset: 1, hasMore: true });
  });

  it("reports the real total for an offset past the end, not the offset itself", async () => {
    // What PostgREST actually sends for an over-range `Range` with no count requested: 200, and
    // an empty array. Answering `offset + 0` here is what turned a 320-document corpus read at
    // offset 1000 into "total: 1000".
    const client = createSupabaseMock((call) =>
      call.selectOptions?.head ? { data: null, error: null, count: 320 } : { data: [], error: null },
    );
    mockRuntime(client);

    const { response, body } = await listDocuments("?limit=50&offset=1000&includeMeta=false");

    expect(response.status).toBe(200);
    expect(body.pagination).toEqual({ limit: 50, offset: 1000, total: 320, nextOffset: 1000, hasMore: false });
    expect(documentQueries(client)).toHaveLength(2);
  });

  it("does not pay for a count when an empty first page already is the whole answer", async () => {
    const client = createSupabaseMock(() => ({ data: [], error: null }));
    mockRuntime(client);

    const { body } = await listDocuments("?limit=50&includeMeta=false");

    expect(body.pagination).toEqual({ limit: 50, offset: 0, total: 0, nextOffset: 0, hasMore: false });
    expect(documentQueries(client)).toHaveLength(1);
  });

  it("still answers an empty page, total unknown, if PostgREST ever rejects the range outright", async () => {
    // The defensive branch. The route cannot produce PGRST103 while its page read asks for no
    // count, but a range rejection is an empty page rather than a 500 whenever it does arrive —
    // and with no total behind it, the honest total is `null`.
    const client = createSupabaseMock(() => ({
      data: null,
      error: { message: "Requested range not satisfiable", code: "PGRST103" },
    }));
    mockRuntime(client);

    const { response, body } = await listDocuments("?limit=50&offset=500&includeMeta=false");

    expect(response.status).toBe(200);
    expect(body.pagination).toEqual({ limit: 50, offset: 500, total: null, nextOffset: 500, hasMore: false });
    expect(documentQueries(client)).toHaveLength(1);
  });
});
