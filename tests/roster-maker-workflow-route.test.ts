import { beforeEach, expect, it, vi } from "vitest";

const TEAM = "5e000000-0000-4000-8000-000000000001";
const ACTOR = "5e000000-0000-4000-8000-000000000002";
const DRAFT = "5e000000-0000-4000-8000-000000000003";
const PROPOSAL = "5e000000-0000-4000-8000-000000000004";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), rate: vi.fn(), demo: vi.fn(), alerts: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/auth", () => ({
  requireAuthenticatedUser: mocks.auth,
  AuthenticationError: class extends Error {},
  unauthorizedResponse: () => Response.json({}, { status: 401 }),
}));
vi.mock("@/lib/env", () => ({ isDemoMode: mocks.demo }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: mocks.rate,
  rateLimitJsonResponse: () => Response.json({}, { status: 429 }),
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
}));
vi.mock("@/lib/roster/maker/publication-alerts", () => ({ sendMakerPublicationAlerts: mocks.alerts }));
import { GET, POST } from "@/app/api/roster/team/[serviceId]/maker/route";
import { GET as ownGET, POST as ownPOST } from "@/app/api/roster/team/[serviceId]/agreements/route";

const context = { params: Promise.resolve({ serviceId: TEAM }) };
const state = {
  settingsToken: "current",
  needs: [],
  rules: { minBreakHours: null, maxHours7d: null, source: null, reviewedOn: null },
  proposals: [],
  reconciliation: null,
};
const post = (body: unknown) =>
  new Request("https://example.org/maker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.auth.mockResolvedValue({ id: ACTOR });
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.rpc.mockResolvedValue({ data: state, error: null });
  mocks.alerts.mockResolvedValue({ status: "processed", sent: 1, skipped: 0, failed: 0 });
});
it("reads maker data only through the current session actor", async () => {
  const response = await GET(new Request(`https://example.org/maker?draftId=${DRAFT}`), context);
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("roster_maker_read", {
    p_actor_id: ACTOR,
    p_service_id: TEAM,
    p_draft_id: DRAFT,
    p_mine: false,
  });
  expect(response.headers.get("Cache-Control")).toContain("private, no-store");
});
it.each([
  { action: "proposal.publish", proposalId: PROPOSAL, userId: ACTOR },
  { action: "proposal.create", draftId: DRAFT, expectedVersion: 2, scope: "full", assignments: [] },
  { action: "settings.save", needs: [], rules: state.rules },
  { action: "agreement.record", proposalId: PROPOSAL },
])("rejects injected authority or missing concurrency token before RPC: %j", async (body) => {
  expect((await POST(post(body), context)).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects agreement actor injection and leaks no team-wide proposal data", async () => {
  expect((await ownPOST(post({ action: "agree", proposalId: PROPOSAL, userId: ACTOR }), context)).status).toBe(400);
  expect((await ownGET(new Request(`https://example.org/agreements?userId=${ACTOR}`), context)).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({ data: { proposals: [] }, error: null });
  expect((await ownGET(new Request("https://example.org/agreements"), context)).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("roster_maker_read", {
    p_actor_id: ACTOR,
    p_service_id: TEAM,
    p_draft_id: null,
    p_mine: true,
  });
});
it("maps missing consent to a safe conflict without sending alerts", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "roster_agreement_required" } });
  const response = await POST(post({ action: "proposal.publish", proposalId: PROPOSAL }), context);
  expect(response.status).toBe(409);
  expect(mocks.alerts).not.toHaveBeenCalled();
  expect((await response.json()).code).toBe("roster_agreement_required");
});
it("reports alert failures separately from a trusted successful publication", async () => {
  const receipt = {
    publicationId: PROPOSAL,
    version: 2,
    draftVersion: 3,
    changedUserIds: [ACTOR],
    swapsCancelled: [],
    replayed: false,
  };
  mocks.rpc.mockResolvedValue({ data: receipt, error: null });
  mocks.alerts.mockResolvedValue({ status: "failed", sent: 0, skipped: 0, failed: 1 });
  const response = await POST(post({ action: "proposal.publish", proposalId: PROPOSAL }), context);
  expect(response.status).toBe(200);
  expect((await response.json()).alerts.status).toBe("failed");
  expect(mocks.alerts).toHaveBeenCalledWith(expect.anything(), ACTOR, TEAM, receipt);
});
it("never sends alerts for a malformed publication receipt", async () => {
  mocks.rpc.mockResolvedValue({ data: { publicationId: PROPOSAL }, error: null });
  expect((await POST(post({ action: "proposal.publish", proposalId: PROPOSAL }), context)).status).toBe(503);
  expect(mocks.alerts).not.toHaveBeenCalled();
});
it("verifies reviewed reconciliation receipt before returning it", async () => {
  mocks.rpc.mockResolvedValue({ data: { draftId: DRAFT, version: 3 }, error: null });
  expect(
    (
      await POST(
        post({ action: "draft.reconcile", draftId: DRAFT, expectedVersion: 2, expectedLiveToken: "current" }),
        context,
      )
    ).status,
  ).toBe(200);
  mocks.rpc.mockResolvedValue({ data: { draftId: DRAFT, version: 2 }, error: null });
  expect(
    (
      await POST(
        post({ action: "draft.reconcile", draftId: DRAFT, expectedVersion: 2, expectedLiveToken: "current" }),
        context,
      )
    ).status,
  ).toBe(503);
});
