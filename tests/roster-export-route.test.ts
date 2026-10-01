import { beforeEach, expect, it, vi } from "vitest";
const SERVICE = "5e000000-0000-4000-8000-000000000001";
const ACTOR = "5e000000-0000-4000-8000-000000000002";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), book: vi.fn(), auth: vi.fn(), rate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/roster/export", () => ({ buildRosterWorkbook: mocks.book }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/auth", () => ({
  requireAuthenticatedUser: mocks.auth,
  AuthenticationError: class extends Error {},
  unauthorizedResponse: () => Response.json({}, { status: 401 }),
}));
vi.mock("@/lib/env", () => ({ isDemoMode: () => false }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: mocks.rate,
  rateLimitJsonResponse: () => Response.json({}, { status: 429 }),
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
}));
import { GET } from "@/app/api/roster/team/[serviceId]/export/route";
import { POST } from "@/app/api/roster/team/[serviceId]/cutoff/route";
const context = { params: Promise.resolve({ serviceId: SERVICE }) };
const overview = {
  service: { id: SERVICE, name: "Example team" },
  me: { role: "manager", grade: null, rotationEndsOn: null },
  latestPublication: null,
  seenLatest: true,
  settings: { swapApproval: "manager", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};
const request = (query = "from=2026-10-01&to=2026-10-31") =>
  new Request(`https://example.org/api/roster/team/${SERVICE}/export?${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: ACTOR });
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.book.mockResolvedValue(new Uint8Array([80, 75]));
  mocks.rpc.mockImplementation(async (_name, args) => ({
    data: args.p_what === "overview" ? overview : args.p_what === "people" ? { people: [] } : { assignments: [] },
    error: null,
  }));
});
it("denies a member before reading shifts or constructing a workbook", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { ...overview, me: { ...overview.me, role: "member" } }, error: null });
  const response = await GET(request(), context);
  expect(response.status).toBe(403);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.book).not.toHaveBeenCalled();
});
it("returns workbook bytes with private no-store headers for a manager", async () => {
  const response = await GET(request(), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  expect(response.headers.get("Cache-Control")).toContain("private, no-store");
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([80, 75]);
  expect(mocks.rpc.mock.calls.every(([, args]) => args.p_actor_id === ACTOR)).toBe(true);
});
it("rejects an oversized or invalid date window before any roster read", async () => {
  for (const query of [
    "from=2026-01-01&to=2026-03-04",
    "from=2026-02-30&to=2026-03-01",
    "from=2026-10-01&to=2026-10-31&actorId=other",
  ])
    expect((await GET(request(query), context)).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("refuses actor injection in the cutoff body before the RPC", async () => {
  const response = await POST(
    new Request("https://example.org/cutoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cutoffOn: "2026-10-01", actorId: ACTOR }),
    }),
    context,
  );
  expect(response.status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("sets cutoff with the session actor only", async () => {
  const response = await POST(
    new Request("https://example.org/cutoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cutoffOn: null }),
    }),
    context,
  );
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("roster_set_cutoff", {
    p_actor_id: ACTOR,
    p_service_id: SERVICE,
    p_cutoff: null,
  });
});
