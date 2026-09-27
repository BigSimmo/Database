import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  auth: vi.fn(),
  rate: vi.fn(),
  insertionError: null as null | { message: string },
  owned: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  isDemoMode: () => false,
  env: {
    WEB_PUSH_PUBLIC_KEY: "public-key",
    WEB_PUSH_PRIVATE_KEY: "private-key",
    WEB_PUSH_SUBJECT: "mailto:operator@example.org",
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase/auth", () => ({
  requireAuthenticatedUser: mocks.auth,
  AuthenticationError: class extends Error {},
  unauthorizedResponse: () => Response.json({ error: "Sign in" }, { status: 401 }),
}));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: mocks.rate,
  rateLimitJsonResponse: () => Response.json({}, { status: 429 }),
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { DELETE, GET, POST } from "@/app/api/roster/alerts/route";
import { POST as CHECK } from "@/app/api/roster/alerts/check/route";

const ME = "5e000000-0000-4000-8000-000000000001";
const OTHER = "5e000000-0000-4000-8000-000000000002";
const valid = {
  endpoint: "https://fcm.googleapis.com/fcm/send/example",
  keys: { p256dh: "abcdefghij", auth: "abcdefghij" },
};
const queries: { op: string; filters: [string, unknown][]; inserted?: unknown }[] = [];

function from() {
  const q = {
    op: "read",
    filters: [] as [string, unknown][],
    inserted: undefined as unknown,
    delete() {
      this.op = "delete";
      return this;
    },
    select() {
      this.op = "select";
      return this;
    },
    insert(value: unknown) {
      this.op = "insert";
      this.inserted = value;
      return this;
    },
    eq(name: string, value: unknown) {
      this.filters.push([name, value]);
      return this;
    },
    limit() {
      return this;
    },
    then(resolve: (value: { error: { message: string } | null; data: { id: string }[] }) => void) {
      resolve({
        error: this.op === "insert" ? mocks.insertionError : null,
        data: this.op === "select" && mocks.owned ? [{ id: "owned" }] : [],
      });
    },
  };
  queries.push(q);
  return q;
}

function req(method: string, body?: unknown) {
  return new Request("http://x/api/roster/alerts", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  mocks.insertionError = null;
  mocks.owned = false;
  mocks.from.mockImplementation(from);
  mocks.auth.mockResolvedValue({ id: ME });
  mocks.rate.mockResolvedValue({ limited: false });
});

describe("phone alert subscription API", () => {
  it("exposes the public key without private material", async () => {
    const response = await GET(req("GET"));
    expect(await response.json()).toEqual({ configured: true, publicKey: "public-key" });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/example",
    "https://example.org/collect",
    "https://fcm.googleapis.com.evil.example/fcm/send/example",
    `https://fcm.googleapis.com/${"x".repeat(1000)}`,
  ])("refuses an unsafe endpoint: %s", async (endpoint) => {
    expect((await POST(req("POST", { ...valid, endpoint }))).status).toBe(400);
    expect(queries).toHaveLength(0);
  });

  it("refuses an owner in the body", async () => {
    expect((await POST(req("POST", { ...valid, ownerId: OTHER }))).status).toBe(400);
    expect(queries).toHaveLength(0);
  });

  it("moves a shared phone endpoint to the signed-in owner", async () => {
    expect((await POST(req("POST", valid))).status).toBe(200);
    expect(queries[0]).toMatchObject({ op: "delete", filters: [["endpoint", valid.endpoint]] });
    expect(queries[1]?.inserted).toMatchObject({ owner_id: ME, endpoint: valid.endpoint });
  });

  it("checks endpoint ownership for the signed-in account without transferring it", async () => {
    expect(await (await CHECK(req("POST", { endpoint: valid.endpoint }))).json()).toEqual({ owned: false });
    expect(queries[0]).toMatchObject({
      op: "select",
      filters: [
        ["owner_id", ME],
        ["endpoint", valid.endpoint],
      ],
    });
    expect(queries).toHaveLength(1);
    mocks.owned = true;
    expect(await (await CHECK(req("POST", { endpoint: valid.endpoint }))).json()).toEqual({ owned: true });
  });

  it("rejects owner spoofing during the read-only ownership check", async () => {
    expect((await CHECK(req("POST", { endpoint: valid.endpoint, ownerId: OTHER }))).status).toBe(400);
    expect(queries).toHaveLength(0);
  });

  it("maps the ten-phone cap to 409 and deletes only my row", async () => {
    mocks.insertionError = { message: "roster_limit" };
    expect((await POST(req("POST", valid))).status).toBe(409);
    queries.length = 0;
    expect((await DELETE(req("DELETE", { endpoint: valid.endpoint }))).status).toBe(200);
    expect(queries[0]?.filters).toContainEqual(["owner_id", ME]);
  });
});
