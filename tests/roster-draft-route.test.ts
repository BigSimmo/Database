import { beforeEach, expect, it, vi } from "vitest";

const TEAM = "5e000000-0000-4000-8000-000000000001";
const ACTOR = "5e000000-0000-4000-8000-000000000002";
const DRAFT = "5e000000-0000-4000-8000-000000000003";
const ROW = "5e000000-0000-4000-8000-000000000004";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), rate: vi.fn(), demo: vi.fn() }));
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
import { GET, POST } from "@/app/api/roster/team/[serviceId]/draft/route";
import { rosterDraftActionSchema, rosterDraftSchema } from "@/lib/roster/maker/model";

const context = { params: Promise.resolve({ serviceId: TEAM }) };
const snapshot = {
  draft: { id: DRAFT, periodStart: "2026-11-02", periodEnd: "2026-11-08", basedOnPublicationId: null, version: 1 },
  assignments: [],
  changes: [],
};
const post = (body: unknown) =>
  new Request(`https://example.org/api/roster/team/${TEAM}/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.auth.mockResolvedValue({ id: ACTOR });
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.rpc.mockImplementation(async (name) => ({
    data: name === "roster_command" ? { draftId: DRAFT, version: 1, created: true } : snapshot,
    error: null,
  }));
});

it("opens only a draft using the session actor and returns the authoritative version", async () => {
  const response = await POST(
    post({ action: "draft.open", periodStart: "2026-11-02", periodEnd: "2026-11-08" }),
    context,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(snapshot);
  expect(mocks.rpc).toHaveBeenNthCalledWith(1, "roster_command", {
    p_actor_id: ACTOR,
    p_service_id: TEAM,
    p_action: "draft.open",
    p_payload: { periodStart: "2026-11-02", periodEnd: "2026-11-08" },
  });
  expect(mocks.rpc).toHaveBeenNthCalledWith(2, "roster_read", {
    p_actor_id: ACTOR,
    p_service_id: TEAM,
    p_what: "draft",
    p_payload: { draftId: DRAFT },
  });
  expect(response.headers.get("Cache-Control")).toContain("private, no-store");
});

it.each([
  { action: "draft.open", periodStart: "2026-11-02", periodEnd: "2026-11-08", actorId: ACTOR },
  { action: "draft.open", periodStart: "2026-02-30", periodEnd: "2026-03-01" },
  { action: "draft.open", periodStart: "2026-11-08", periodEnd: "2026-11-02" },
  { action: "draft.open", periodStart: "2026-01-01", periodEnd: "2026-12-31" },
  { action: "draft.change", draftId: DRAFT, source: "grid", ops: [{ op: "remove", id: ROW }] },
  {
    action: "draft.change",
    draftId: DRAFT,
    expectedVersion: 1,
    source: "typed",
    text: "private words",
    ops: [{ op: "remove", id: ROW }],
  },
  { action: "draft.change", draftId: DRAFT, expectedVersion: 1, source: "grid", ops: [] },
  { action: "draft.undo", draftId: DRAFT, expectedVersion: 1, changeId: "-1" },
  { action: "publish", draftId: DRAFT },
  { action: "agreement.record", changeId: "1" },
])("refuses an unsafe or policy-dependent request before any RPC: %j", async (body) => {
  expect((await POST(post(body), context)).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("preserves the expected version and structured operation without accepting actor fields", async () => {
  mocks.rpc.mockImplementation(async (name) => ({
    data:
      name === "roster_command"
        ? { draftId: DRAFT, version: 8 }
        : { ...snapshot, draft: { ...snapshot.draft, version: 8 } },
    error: null,
  }));
  const body = {
    action: "draft.change",
    draftId: DRAFT,
    expectedVersion: 7,
    source: "grid",
    ops: [{ op: "remove", id: ROW }],
  };
  expect((await POST(post(body), context)).status).toBe(200);
  expect(mocks.rpc.mock.calls[0][1].p_payload).toEqual({
    draftId: DRAFT,
    expectedVersion: 7,
    source: "grid",
    ops: [{ op: "remove", id: ROW }],
  });
  expect(rosterDraftActionSchema.safeParse({ ...body, ops: [{ op: "remove", id: ROW, ownerId: ACTOR }] }).success).toBe(
    false,
  );
});

it("returns a conflict without retrying the mutation or reading another snapshot", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "roster_conflict" } });
  const response = await POST(
    post({ action: "draft.undo", draftId: DRAFT, expectedVersion: 1, changeId: "1" }),
    context,
  );
  expect(response.status).toBe(409);
  expect((await response.json()).code).toBe("roster_conflict");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});

it("enforces database role refusal and no-store on denied reads", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "roster_role_denied" } });
  const response = await GET(new Request(`https://example.org/draft?draftId=${DRAFT}`), context);
  expect(response.status).toBe(403);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});

it("rejects query actor injection and duplicate draft identifiers", async () => {
  for (const query of [`draftId=${DRAFT}&actorId=${ACTOR}`, `draftId=${DRAFT}&draftId=${ROW}`, "draftId=invalid"]) {
    expect((await GET(new Request(`https://example.org/draft?${query}`), context)).status).toBe(400);
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("fails closed on a response missing version or carrying the wrong draft", async () => {
  expect(rosterDraftSchema.safeParse({ ...snapshot, draft: { ...snapshot.draft, version: undefined } }).success).toBe(
    false,
  );
  mocks.rpc.mockResolvedValue({ data: { ...snapshot, draft: { ...snapshot.draft, id: ROW } }, error: null });
  expect((await GET(new Request(`https://example.org/draft?draftId=${DRAFT}`), context)).status).toBe(503);
});

it("refuses live draft actions in synthetic demo mode", async () => {
  mocks.demo.mockReturnValue(true);
  expect(
    (await POST(post({ action: "draft.open", periodStart: "2026-11-02", periodEnd: "2026-11-08" }), context)).status,
  ).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("does not acknowledge a malformed or stale mutation receipt", async () => {
  for (const receipt of [{ draftId: ROW, version: 2 }, { draftId: DRAFT, version: 1 }, { draftId: DRAFT }]) {
    mocks.rpc.mockResolvedValueOnce({ data: receipt, error: null });
    expect(
      (await POST(post({ action: "draft.undo", draftId: DRAFT, expectedVersion: 1, changeId: "1" }), context)).status,
    ).toBe(503);
  }
});

it("reads the SQL assignment shape with derived display fields", async () => {
  const assignment = {
    id: ROW,
    userId: ACTOR,
    rosterName: "Alex Example",
    name: "Alex Example",
    siteId: null,
    startsAt: "2026-11-02T00:00:00+00:00",
    endsAt: "2026-11-02T08:00:00+00:00",
    shiftCode: "D",
    kind: "day",
    grade: "registrar",
  };
  mocks.rpc.mockResolvedValue({ data: { ...snapshot, assignments: [assignment] }, error: null });
  const response = await GET(new Request(`https://example.org/draft?draftId=${DRAFT}`), context);
  expect(response.status).toBe(200);
  expect((await response.json()).assignments[0]).toMatchObject({ id: ROW, rosterName: "Alex Example" });
});
