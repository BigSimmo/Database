import { beforeEach, describe, expect, it, vi } from "vitest";

const SERVICE = "5e000000-0000-4000-8000-000000000001";
const ACTOR = "5e000000-0000-4000-8000-000000000002";
const OTHER = "5e000000-0000-4000-8000-000000000003";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), demo: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/auth", () => ({
  requireAuthenticatedUser: mocks.auth,
  AuthenticationError: class extends Error {},
  unauthorizedResponse: () => Response.json({ error: "Sign in" }, { status: 401 }),
}));
vi.mock("@/lib/env", () => ({ isDemoMode: mocks.demo }));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.log, warn: mocks.log, info: mocks.log } }));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: mocks.rate,
  rateLimitJsonResponse: () => Response.json({}, { status: 429 }),
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
}));

import { POST } from "@/app/api/roster/team/[serviceId]/invite/route";
import { hashServiceInvitation } from "@/lib/on-call/service-repository";

const context = { params: Promise.resolve({ serviceId: SERVICE }) };
const overview = {
  service: { id: SERVICE, name: "General Medicine" },
  me: { role: "manager", grade: "consultant", rotationEndsOn: null },
  latestPublication: null,
  seenLatest: false,
  settings: { swapApproval: "manager", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};
function request(body: unknown) {
  return new Request(`https://example.org/api/roster/team/${SERVICE}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: ACTOR });
  mocks.demo.mockReturnValue(false);
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "roster_read"
      ? { data: overview, error: null }
      : {
          data: { invitationId: "5e000000-0000-4000-8000-000000000004", expiresAt: "2026-10-04T00:00:00Z" },
          error: null,
        },
  );
});

describe("Roster invites", () => {
  it("reads confirmation and manager role before writing an invite", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "roster_team_not_verified" } });
    expect((await POST(request({ invitedEmail: "sam@example.org" }), context)).status).toBe(403);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    mocks.rpc.mockClear();
    mocks.rpc.mockResolvedValueOnce({ data: { ...overview, me: { ...overview.me, role: "member" } }, error: null });
    expect((await POST(request({ invitedEmail: "sam@example.org" }), context)).status).toBe(403);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("creates an email-bound member invite with the session actor and code only in a fragment", async () => {
    const result = await POST(request({ invitedEmail: "SAM@EXAMPLE.ORG" }), context);
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.path).toMatch(/^\/roster\/join#code=[a-f0-9]{64}$/);
    const code = body.path.slice(body.path.indexOf("=") + 1);
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "roster_read",
      expect.objectContaining({
        p_actor_id: ACTOR,
        p_service_id: SERVICE,
        p_what: "overview",
      }),
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "on_call_service_command", {
      p_actor_id: ACTOR,
      p_service_id: SERVICE,
      p_action: "invitation.create",
      p_payload: {
        role: "member",
        expiresInDays: 7,
        invitedEmail: "sam@example.org",
        issuedViaMode: "roster",
        tokenHash: hashServiceInvitation(code),
      },
    });
    expect(JSON.stringify(body).replace(body.path, "")).not.toContain(code);
    expect(mocks.log).not.toHaveBeenCalledWith(expect.stringContaining(code), expect.anything());
  });

  it("rejects extra actor fields and invalid expiry before a database call", async () => {
    expect((await POST(request({ invitedEmail: "sam@example.org", actorId: OTHER }), context)).status).toBe(400);
    expect((await POST(request({ invitedEmail: "sam@example.org", expiresInDays: 8 }), context)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
