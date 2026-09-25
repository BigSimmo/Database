import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), demo: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/auth", () => ({
  requireAuthenticatedUser: mocks.auth,
  AuthenticationError: class extends Error {},
  unauthorizedResponse: () => Response.json({ error: "Sign in" }, { status: 401 }),
}));
vi.mock("@/lib/env", () => ({ isDemoMode: mocks.demo }));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: mocks.rate,
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
  rateLimitJsonResponse: () => Response.json({}, { status: 429 }),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
import { GET as list, POST as create } from "@/app/api/on-call/services/route";
import { GET as read, POST as mutate } from "@/app/api/on-call/services/[serviceId]/route";
import { POST as join } from "@/app/api/on-call/services/join/route";
import { AuthenticationError } from "@/lib/supabase/auth";
const actor = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ serviceId }) };
function request(body: unknown) {
  return new Request("https://example.org/api/on-call/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.auth.mockResolvedValue({ id: actor });
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.rpc.mockResolvedValue({ data: { services: [] }, error: null });
});
describe("service routes", () => {
  it("returns empty membership list with no-store rather than legacy entries", async () => {
    const result = await list(new Request("https://example.org/api/on-call/services"));
    expect(await result.json()).toEqual({ services: [] });
    expect(result.headers.get("cache-control")).toContain("no-store");
  });
  it("denies all operations before database use when authentication fails", async () => {
    mocks.auth.mockRejectedValue(new AuthenticationError());
    for (const operation of [
      () => list(request({})),
      () => create(request({})),
      () => read(request({}), context),
      () => mutate(request({}), context),
      () => join(request({})),
    ]) {
      expect((await operation()).status).toBe(401);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes a read to central membership authorization and does not cache denied data", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "service_access_denied" } });
    const result = await read(new Request("https://example.org/api/on-call/services/id"), context);
    expect(result.status).toBe(403);
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_actor_id: actor, p_service_id: serviceId, p_action: "read" });
  });
  it("rejects request-supplied actor and private record fields before RPC", async () => {
    const result = await mutate(request({ action: "member.revoke", memberId: actor, actorId: serviceId }), context);
    expect(result.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("never provisions real services in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    const result = await create(request({ name: "Synthetic service", siteName: "Synthetic site" }));
    expect(result.status).toBe(400);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("hashes invitation codes before the redeem RPC", async () => {
    const code = "ab".repeat(32);
    const result = await join(request({ code }));
    expect(result.status).toBe(200);
    const payload = mocks.rpc.mock.calls[0][1].p_payload;
    expect(payload.tokenHash).toHaveLength(64);
    expect(payload.tokenHash).not.toBe(code);
    expect(payload).not.toHaveProperty("code");
  });
});
