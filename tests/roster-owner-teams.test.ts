import { beforeEach, describe, expect, it, vi } from "vitest";

const SERVICE = "5e000000-0000-4000-8000-000000000001";
const PERSON = "5e000000-0000-4000-8000-000000000002";
const ADMIN = "5e000000-0000-4000-8000-000000000003";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  getUserById: vi.fn(),
  auth: vi.fn(),
  demo: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from, auth: { admin: { getUserById: mocks.getUserById } } }),
}));
vi.mock("@/lib/supabase/auth", () => ({
  requireAuthenticatedUser: mocks.auth,
  AuthenticationError: class extends Error {},
  unauthorizedResponse: () => Response.json({ error: "Sign in" }, { status: 401 }),
}));
vi.mock("@/lib/env", () => ({ isDemoMode: mocks.demo }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: mocks.rate,
  rateLimitJsonResponse: () => Response.json({}, { status: 429 }),
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
}));

import { GET as GET_LIST } from "@/app/api/roster/owner/teams/route";
import { GET, POST } from "@/app/api/roster/owner/teams/[serviceId]/route";
import { PublicApiError } from "@/lib/http";

const context = { params: Promise.resolve({ serviceId: SERVICE }) };
function request(body: unknown) {
  return new Request(`https://example.org/api/roster/owner/teams/${SERVICE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function query(table: string) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => {
      if (table === "on_call_services") return { data: { id: SERVICE }, error: null };
      if (table === "on_call_service_members") return { data: { user_id: PERSON }, error: null };
      return { data: null, error: null };
    }),
    then: (resolve: (value: unknown) => unknown) => {
      if (table === "on_call_services")
        return resolve({
          data: [
            { id: SERVICE, name: "General Medicine", created_at: "2026-09-01", verified_at: null, is_demo: false },
          ],
          error: null,
        });
      if (table === "on_call_service_members")
        return resolve({
          data: [{ user_id: PERSON, display_name: "Dr Sam Example", role: "member", joined_at: "2026-09-02" }],
          count: 1,
          error: null,
        });
      return resolve({
        data: [{ user_id: PERSON, role: "manager", grade: "registrar", roster_name: "Sam Example" }],
        count: 1,
        error: null,
      });
    },
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.auth.mockResolvedValue({ id: ADMIN });
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
  mocks.from.mockImplementation(query);
  mocks.getUserById.mockResolvedValue({ data: { user: { email: "sam@example.org" } }, error: null });
});

describe("Roster owner teams", () => {
  it("requires the administrator session before any database call", async () => {
    mocks.auth.mockRejectedValue(
      new PublicApiError("Administrator access required.", 403, { code: "administrator_required" }),
    );
    expect((await GET_LIST(new Request("https://example.org/api/roster/owner/teams"))).status).toBe(403);
    expect((await POST(request({ action: "verify", verified: true, isDemo: false }), context)).status).toBe(403);
    expect(mocks.auth).toHaveBeenCalledWith(expect.any(Request), expect.anything(), { administrator: true });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("confirms a team as the administrator from the session and rejects an injected actor", async () => {
    expect(
      (await POST(request({ action: "verify", verified: true, isDemo: false, actorId: PERSON }), context)).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    const result = await POST(request({ action: "verify", verified: true, isDemo: false }), context);
    expect(result.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("on_call_service_set_verified", {
      p_service_id: SERVICE,
      p_actor_id: ADMIN,
      p_verified: true,
      p_is_demo: false,
    });
    expect(result.headers.get("Cache-Control")).toContain("no-store");
  });

  it("maps a departed person to a plain 404 and never echoes SQL text", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "roster_not_found", code: "P0001" } });
    const result = await POST(request({ action: "manager", userId: PERSON, manager: true }), context);
    expect(mocks.rpc).toHaveBeenCalledWith("roster_set_manager", {
      p_service_id: SERVICE,
      p_user_id: PERSON,
      p_actor_id: ADMIN,
      p_manager: true,
    });
    expect(result.status).toBe(404);
    expect((await result.json()).message).toBe("That person isn't an active member of this team.");
  });

  it("keeps email out of the list and checks membership before looking it up", async () => {
    const list = await GET(new Request(`https://example.org/api/roster/owner/teams/${SERVICE}`), context);
    const body = await list.json();
    expect(JSON.stringify(body)).not.toContain("sam@example.org");
    expect(body.members[0]).toMatchObject({ userId: PERSON, rosterRole: "manager" });
    const memberChain = query("on_call_service_members");
    memberChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mocks.from.mockImplementation((table: string) =>
      table === "on_call_service_members" ? memberChain : query(table),
    );
    const missing = await GET(
      new Request(`https://example.org/api/roster/owner/teams/${SERVICE}?member=${PERSON}`),
      context,
    );
    expect(missing.status).toBe(404);
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("returns exact team counts and refuses demo mode", async () => {
    const result = await GET_LIST(new Request("https://example.org/api/roster/owner/teams"));
    expect((await result.json()).teams[0]).toMatchObject({ activeMembers: 1, managers: 1 });
    mocks.demo.mockReturnValue(true);
    expect((await GET_LIST(new Request("https://example.org/api/roster/owner/teams"))).status).toBe(400);
  });
});
