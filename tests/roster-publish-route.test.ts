import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SERVICE = "5e000000-0000-4000-8000-000000000001";
const ACTOR = "5e000000-0000-4000-8000-000000000002";
const PUBLICATION = "5e000000-0000-4000-8000-000000000003";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), demo: vi.fn(), rate: vi.fn(), alerts: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
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
vi.mock("@/lib/roster/alerts/dispatch", () => ({ dispatchRosterAlerts: mocks.alerts }));

import { GET, POST } from "@/app/api/roster/team/[serviceId]/publish/route";

const context = { params: Promise.resolve({ serviceId: SERVICE }) };
const overview = {
  service: { id: SERVICE, name: "Example Health Service · General Medicine" },
  me: { role: "manager", grade: "consultant", rotationEndsOn: null },
  latestPublication: null,
  seenLatest: false,
  settings: { swapApproval: "manager", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};
const preview = {
  freshnessToken: "snapshot-opaque-token",
  assignments: [],
  changes: { swaps: [], openShifts: [] },
  people: [],
  codes: [],
};
const body = {
  expectedToken: preview.freshnessToken,
  roles: [],
  codes: [],
  publication: {
    kind: "full",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    sourceName: "oct.xlsx",
    assignments: [],
  },
  openShifts: [],
  overrideChanges: [],
};
const receipt = {
  publicationId: PUBLICATION,
  version: 5,
  swapsCancelled: [],
  changedUserIds: [ACTOR],
  openShiftIds: [],
  overridesRecorded: [],
};
function request(payload: unknown) {
  return new Request(`https://example.org/api/roster/team/${SERVICE}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
function previewRequest(query = "from=2026-10-01&to=2026-10-31") {
  return new Request(`https://example.org/api/roster/team/${SERVICE}/publish?${query}`);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: ACTOR });
  mocks.demo.mockReturnValue(false);
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.alerts.mockResolvedValue(undefined);
  mocks.rpc.mockResolvedValue({ data: overview, error: null });
});

describe("atomic roster publication", () => {
  it("requires a manager session before a preview and returns one locked snapshot", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...overview, me: { ...overview.me, role: "member" } }, error: null });
    expect((await GET(previewRequest(), context)).status).toBe(403);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["roster_read"]);

    mocks.rpc.mockClear();
    mocks.rpc
      .mockResolvedValueOnce({ data: overview, error: null })
      .mockResolvedValueOnce({ data: preview, error: null });
    const response = await GET(previewRequest(), context);
    expect(response.status).toBe(200);
    expect((await response.json()).freshnessToken).toBe(preview.freshnessToken);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["roster_read", "roster_publish_preview"]);
    expect(mocks.rpc).toHaveBeenCalledWith("roster_publish_preview", {
      p_actor_id: ACTOR,
      p_service_id: SERVICE,
      p_from: "2026-10-01",
      p_to: "2026-10-31",
    });
  });

  it("keeps the preview gated until the new RPC is deployed", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: overview, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "function missing" } });
    const response = await GET(previewRequest(), context);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("roster_publish_requires_update");
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["roster_read", "roster_publish_preview"]);
  });

  it("refuses extra or excessive preview dates before any RPC", async () => {
    expect((await GET(previewRequest("from=2026-10-01&to=2026-10-31&actorId=x"), context)).status).toBe(400);
    expect((await GET(previewRequest("from=2026-10-01&to=2027-05-01"), context)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("sends only one atomic RPC with session actor, token and reviewed payload", async () => {
    mocks.rpc.mockResolvedValue({ data: receipt, error: null });
    const response = await POST(request(body), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(receipt);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["roster_publish"]);
    expect(mocks.rpc).toHaveBeenCalledWith("roster_publish", {
      p_actor_id: ACTOR,
      p_service_id: SERVICE,
      p_expected_token: preview.freshnessToken,
      p_payload: { roles: [], codes: [], publication: body.publication, openShifts: [], overrideChanges: [] },
    });
  });

  it("accepts a valid roster above the ordinary 256 KiB JSON limit within its 2 MiB bound", async () => {
    const assignment = {
      userId: null,
      rosterName: "Locum 1",
      siteId: null,
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: "2026-10-01T08:00:00.000Z",
      shiftCode: "D",
      kind: "day",
      grade: null,
    };
    const large = { ...body, publication: { ...body.publication, assignments: Array(2000).fill(assignment) } };
    expect(JSON.stringify(large).length).toBeGreaterThan(256 * 1024);
    mocks.rpc.mockResolvedValue({ data: receipt, error: null });
    expect((await POST(request(large), context)).status).toBe(200);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["roster_publish"]);
  });

  it("rejects a declared body beyond 2 MiB before any RPC", async () => {
    const oversized = new Request(`https://example.org/api/roster/team/${SERVICE}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": String(2 * 1024 * 1024 + 1) },
      body: JSON.stringify(body),
    });
    expect((await POST(oversized, context)).status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns stale-token conflict without sequential writes or alerts", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "roster_conflict", code: "P0001" } });
    const response = await POST(request(body), context);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("roster_conflict");
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["roster_publish"]);
    expect(mocks.alerts).not.toHaveBeenCalled();
  });

  it("keeps missing publish RPC fail-closed and denies members in SQL", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "function missing" } });
    const missing = await POST(request(body), context);
    expect(missing.status).toBe(409);
    expect((await missing.json()).code).toBe("roster_publish_requires_update");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "roster_role_denied" } });
    expect((await POST(request(body), context)).status).toBe(403);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["roster_publish", "roster_publish"]);
  });

  it("rejects request-supplied actor and impossible period before any RPC", async () => {
    expect((await POST(request({ ...body, actorId: ACTOR }), context)).status).toBe(400);
    expect(
      (await POST(request({ ...body, publication: { ...body.publication, periodEnd: "2027-05-01" } }), context)).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("passes future open offers and explicit reviewed overrides in the one atomic call", async () => {
    const future = new Date(Date.now() + 31 * 86_400_000);
    const day = future.toISOString().slice(0, 10);
    const opens = [
      {
        startsAt: `${day}T00:00:00.000Z`,
        endsAt: `${day}T08:00:00.000Z`,
        shiftCode: "D",
        kind: "day",
        siteId: null,
        minGrade: null,
        urgent: false,
      },
    ];
    const openShiftId = "5e000000-0000-4000-8000-000000000009";
    const payload = {
      ...body,
      publication: { ...body.publication, periodStart: day, periodEnd: day },
      openShifts: opens,
      overrideChanges: [{ kind: "open", id: openShiftId }],
    };
    const result = { ...receipt, openShiftIds: [openShiftId], overridesRecorded: payload.overrideChanges };
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    const response = await POST(request(payload), context);
    expect(response.status).toBe(200);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["roster_publish"]);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "roster_publish",
      expect.objectContaining({
        p_payload: expect.objectContaining({ openShifts: opens, overrideChanges: payload.overrideChanges }),
      }),
    );
  });

  it("rejects past and leave open offers before the RPC", async () => {
    const pastOpen = {
      startsAt: "2020-10-01T00:00:00Z",
      endsAt: "2020-10-01T08:00:00Z",
      shiftCode: "D",
      kind: "day",
      siteId: null,
      minGrade: null,
      urgent: false,
    };
    expect((await POST(request({ ...body, openShifts: [pastOpen] }), context)).status).toBe(400);
    expect((await POST(request({ ...body, openShifts: [{ ...pastOpen, kind: "leave" }] }), context)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("accepts a remembered day-off code only with null times", async () => {
    const code = { code: "OFFX", kind: "off", starts: null, ends: null, label: null };
    mocks.rpc.mockResolvedValue({ data: receipt, error: null });
    expect((await POST(request({ ...body, codes: [code] }), context)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "roster_publish",
      expect.objectContaining({
        p_payload: expect.objectContaining({ codes: [code] }),
      }),
    );
    mocks.rpc.mockClear();
    expect((await POST(request({ ...body, codes: [{ ...code, starts: "08:00" }] }), context)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("example publishing while team rosters are held", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("previews the sample team and answers a checked publish with an example receipt, saving nothing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const shown = await GET(previewRequest(), context);
    expect(shown.status).toBe(200);
    const snapshot = await shown.json();
    expect(snapshot.freshnessToken).toBe("sample");
    expect(snapshot.people.length).toBeGreaterThan(0);

    const published = await POST(request(body), context);
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ version: 2, changedUserIds: [], openShiftIds: [] });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.alerts).not.toHaveBeenCalled();

    expect((await POST(request({ ...body, actorId: ACTOR }), context)).status).toBe(400);
  });
});
