import { afterEach, describe, expect, it, vi } from "vitest";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const token = "valid-token";
const recordId = "11111111-1111-4111-8111-111111111111";

type QueryError = { message: string };
type QueryResult = { data: unknown; error: QueryError | null };
type QueryFilter = { column: string; value: unknown };
type QueryCall = {
  table: string;
  filters: QueryFilter[];
  inFilters: Array<{ column: string; values: unknown[] }>;
  maybeSingle: boolean;
  head?: boolean;
  count?: string;
};
type QueryResolver = (call: QueryCall) => QueryResult;

function ok(data: unknown): QueryResult {
  return { data, error: null };
}

function medicationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: recordId,
    owner_id: userId,
    slug: "acamprosate",
    name: "Acamprosate",
    class: "Addiction medicine",
    subclass: "",
    category: "",
    accent: "#0f766e",
    tag: "",
    schedule: "",
    stats: [],
    sections: [],
    quick: [],
    source_status: "current",
    validation_status: "locally_reviewed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

class QueryBuilder implements PromiseLike<QueryResult> {
  constructor(
    private readonly call: QueryCall,
    private readonly resolver: QueryResolver,
  ) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (options?.head) this.call.head = true;
    if (options?.count) this.call.count = options.count;
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

  limit() {
    return this;
  }

  maybeSingle() {
    this.call.maybeSingle = true;
    return Promise.resolve(this.resolver(this.call));
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolver(this.call)).then(onfulfilled, onrejected);
  }
}

function createSupabaseMock(resolve: QueryResolver = () => ok([]), options: { limited?: boolean } = {}) {
  const calls: QueryCall[] = [];
  const getUser = vi.fn(async (receivedToken?: string) =>
    receivedToken === token
      ? { data: { user: { id: userId } }, error: null }
      : { data: { user: null }, error: { message: "Invalid token" } },
  );
  const rpc = vi.fn(async (name: string) =>
    name === "consume_api_rate_limit" || name === "consume_api_subject_rate_limit"
      ? {
          data: [
            {
              limited: Boolean(options.limited),
              limit_value: 120,
              remaining: options.limited ? 0 : 119,
              retry_after_seconds: 60,
              reset_at: new Date(Date.now() + 60_000).toISOString(),
            },
          ],
          error: null,
        }
      : ok([]),
  );
  return {
    calls,
    auth: { getUser },
    rpc,
    from: vi.fn((table: string) => {
      const call: QueryCall = { table, filters: [], inFilters: [], maybeSingle: false };
      calls.push(call);
      return new QueryBuilder(call, resolve);
    }),
  };
}

function mockRuntime(client: ReturnType<typeof createSupabaseMock>, options: { demoMode?: boolean } = {}) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: {},
    isDemoMode: () => Boolean(options.demoMode),
    isLocalNoAuthMode: () => false,
    requireOpenAIEnv: () => undefined,
    requireServerEnv: () => undefined,
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => client,
  }));
}

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

function authedRequest(path: string) {
  return request(path, { headers: { Authorization: `Bearer ${token}` } });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("medications API", () => {
  it("serves mock records in demo mode without touching Supabase", async () => {
    const client = createSupabaseMock();
    mockRuntime(client, { demoMode: true });
    const { GET } = await import("../src/app/api/medications/route");

    const response = await GET(request("/api/medications"));
    const payload = (await response.json()) as { records: Array<{ slug: string }>; demoMode?: boolean };

    expect(response.status).toBe(200);
    expect(payload.demoMode).toBe(true);
    expect(payload.records.some((record) => record.slug === "acamprosate")).toBe(true);
    expect(client.from).not.toHaveBeenCalled();
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it("serves curated public records for unauthenticated list requests outside demo mode", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { GET } = await import("../src/app/api/medications/route");

    const response = await GET(request("/api/medications?q=acamprosate"));
    const payload = (await response.json()) as {
      records: Array<{ slug: string }>;
      matches?: Array<{ medication: { slug: string } }>;
      publicAccess?: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.publicAccess).toBe(true);
    expect(payload.records.some((record) => record.slug === "acamprosate")).toBe(true);
    expect(payload.matches?.[0]?.medication.slug).toBe("acamprosate");
    expect(client.from).not.toHaveBeenCalled();
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it("scopes medication queries to the authenticated owner", async () => {
    const client = createSupabaseMock((call) =>
      call.table === "medication_records" ? ok([medicationRow()]) : ok([]),
    );
    mockRuntime(client);
    const { GET } = await import("../src/app/api/medications/route");

    const response = await GET(authedRequest("/api/medications?q=acamprosate"));
    const payload = (await response.json()) as {
      records: Array<{ slug: string }>;
      matches?: Array<{ medication: { slug: string } }>;
    };

    expect(response.status).toBe(200);
    expect(payload.records[0]?.slug).toBe("acamprosate");
    expect(payload.matches?.[0]?.medication.slug).toBe("acamprosate");
    expect(client.calls.some((call) => call.table === "medication_records")).toBe(true);
    expect(client.calls.some((call) => call.filters.some((filter) => filter.column === "owner_id"))).toBe(true);
  });

  it("serves curated public detail for unauthenticated slug requests", async () => {
    const client = createSupabaseMock();
    mockRuntime(client);
    const { GET } = await import("../src/app/api/medications/[slug]/route");

    const response = await GET(request("/api/medications/acamprosate"), {
      params: Promise.resolve({ slug: "acamprosate" }),
    });
    const payload = (await response.json()) as {
      record: { slug: string; name: string };
      publicAccess?: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.publicAccess).toBe(true);
    expect(payload.record.slug).toBe("acamprosate");
    expect(payload.record.name).toBe("Acamprosate");
    expect(client.from).not.toHaveBeenCalled();
  });
});
