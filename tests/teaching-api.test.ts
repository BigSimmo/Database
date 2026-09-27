import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), demo: vi.fn(), rate: vi.fn(), onCall: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/auth", () => {
  class AuthenticationError extends Error {}
  return {
    requireAuthenticatedUser: mocks.auth,
    resolveOptionalAuthentication: vi.fn(),
    AuthenticationError,
    unauthorizedResponse: () => Response.json({ message: "Sign in" }, { status: 401 }),
  };
});
vi.mock("@/lib/env", () => ({ isDemoMode: mocks.demo }));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: mocks.rate,
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
  rateLimitJsonResponse: (message: string) => Response.json({ message, code: "rate_limited" }, { status: 429 }),
}));
vi.mock("@/lib/on-call/repository", () => ({ fetchVisibleOnCallEntries: mocks.onCall }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { GET as overview } from "@/app/api/teaching/route";
import { GET as serviceRead, POST as serviceWrite } from "@/app/api/teaching/services/[serviceId]/route";
import { addDays } from "@/lib/calendar/calendar-event";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { AuthenticationError } from "@/lib/supabase/auth";
import { DEMO_TEACHING_SERVICE_ID, demoTeachingSessions } from "@/lib/teaching/demo-programme";
import { plainTeachingIssue } from "@/lib/teaching/request";
import { perthToday } from "@/lib/teaching/time";

const actor = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const occurrenceId = "33333333-3333-4333-8333-333333333333";
const entryId = "44444444-4444-4444-8444-444444444444";
const context = { params: Promise.resolve({ serviceId }) };
const emptyWeek = { teams: [], sessions: [], notices: [], attendance: [] };
const detail = {
  occurrenceId,
  serviceId,
  title: "Invented journal club",
  startsAt: "2026-09-30T04:30:00+00:00",
  endsAt: "2026-09-30T05:30:00+00:00",
  venue: "Invented room",
  hasJoinLink: false,
  status: "scheduled",
  isPresenter: false,
  source: "teaching",
  joinUrl: null,
  presenterName: null,
  materials: [],
  changeReason: null,
  canShowCode: false,
  counts: null,
};
const series = {
  action: "series.save",
  title: "Invented journal club",
  kind: "journal",
  repeat: "weekly",
  firstDate: "2026-10-07",
  startTime: "12:30",
  minutes: 60,
  endDate: "2026-12-16",
};

function get(path: string) {
  return new Request(`https://psychiatry.example${path}`);
}

function post(path: string, body: unknown) {
  return new Request(`https://psychiatry.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function onCallEducation(): OnCallEntry {
  return {
    id: entryId,
    section: "education",
    slug: "invented-weekly-teaching",
    title: "Invented weekly teaching",
    subtitle: null,
    body: null,
    details: { nextOccurrenceDate: "2026-09-03", nextOccurrence: "12:30", recurrenceRule: { frequency: "weekly" } },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.auth.mockResolvedValue({ id: actor });
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.onCall.mockResolvedValue([]);
  mocks.rpc.mockResolvedValue({ data: emptyWeek, error: null });
});

describe("GET /api/teaching", () => {
  it("reads the week for the signed-in doctor only, with their On Call list beside it", async () => {
    mocks.onCall.mockResolvedValue([onCallEducation()]);
    const response = await overview(get(`/api/teaching?view=week&from=2026-09-28&to=2026-10-04&actorId=${serviceId}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("teaching_command", {
      p_actor_id: actor,
      p_service_id: null,
      p_action: "week.read",
      p_payload: { from: "2026-09-28", to: "2026-10-04" },
    });
    expect(mocks.onCall).toHaveBeenCalledWith(expect.anything(), actor, { section: "education" });
    const body = await response.json();
    expect(body.relocatedUnavailable).toBe(false);
    expect(body.relocated.map((session: { occurrenceId: string }) => session.occurrenceId)).toEqual([
      `${entryId}@2026-10-01`,
    ]);
  });

  it("still shows the week when the On Call list cannot be read", async () => {
    mocks.onCall.mockRejectedValue(new Error("on_call_entries unavailable"));
    const response = await overview(get("/api/teaching?view=week&from=2026-09-28&to=2026-10-04"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ relocated: [], relocatedUnavailable: true });
  });

  it("refuses a week view longer than six weeks before the database", async () => {
    const response = await overview(get("/api/teaching?view=week&from=2026-09-28&to=2026-11-09"));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns only a count for CPD's Today", async () => {
    mocks.rpc.mockResolvedValue({ data: { count: 3, titles: ["Invented journal club"] }, error: null });
    const response = await overview(get("/api/teaching?view=unlogged-count"));
    expect(await response.json()).toEqual({ count: 3 });
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_service_id: null, p_action: "cpd.unlogged" });
  });

  it("reads one session from a calendar link that knows only the occurrence", async () => {
    mocks.rpc.mockResolvedValue({ data: detail, error: null });
    const response = await overview(get(`/api/teaching?view=session&occurrenceId=${occurrenceId}`));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("teaching_command", {
      p_actor_id: actor,
      p_service_id: null,
      p_action: "session.read",
      p_payload: { occurrenceId },
    });
  });

  it("refuses a signed-out caller before any database call", async () => {
    mocks.auth.mockRejectedValue(new AuthenticationError());
    const response = await overview(get("/api/teaching"));
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.onCall).not.toHaveBeenCalled();
  });

  // Review focus 5, at the route.
  it("says Teaching is being set up when the database change is not live", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Could not find the function", code: "PGRST202" } });
    const response = await overview(get("/api/teaching"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      message: "Teaching is being set up. Try again later.",
      code: "teaching_setup_pending",
    });
  });

  it("serves the quiet-day hero and the supervision count from GET /api/teaching", async () => {
    mocks.rpc.mockResolvedValue({ data: { session: null }, error: null });
    let response = await overview(get("/api/teaching?view=next-session"));
    expect(await response.json()).toEqual({ session: null });
    mocks.rpc.mockResolvedValue({ data: { count: 3 }, error: null });
    response = await overview(get("/api/teaching?view=supervision-pending"));
    expect(await response.json()).toEqual({ count: 3 });
  });

  it("serves the made-up programme in demo mode without signing in", async () => {
    mocks.demo.mockReturnValue(true);
    const response = await overview(get("/api/teaching?view=week"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.teams[0].id).toBe(DEMO_TEACHING_SERVICE_ID);
    expect(body.relocated).toEqual([]);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("/api/teaching/services/[serviceId]", () => {
  it("passes a read with the session actor and no action name in the payload", async () => {
    mocks.rpc.mockResolvedValue({ data: { rows: [], visitors: 0 }, error: null });
    const response = await serviceRead(
      get(`/api/teaching/services/${serviceId}?action=register.read&occurrenceId=${occurrenceId}`),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("teaching_command", {
      p_actor_id: actor,
      p_service_id: serviceId,
      p_action: "register.read",
      p_payload: { occurrenceId },
    });
  });

  it("does not cache a refusal", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "teaching_role_denied" } });
    const response = await serviceRead(get(`/api/teaching/services/${serviceId}?action=members.read`), context);
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("refuses a body that names its own actor", async () => {
    const response = await serviceWrite(
      post(`/api/teaching/services/${serviceId}`, { action: "attendance.self", occurrenceId, actorId: serviceId }),
      context,
    );
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  // Review focus 3, at the route: the doctor is told why, in words.
  it.each(["https://teams.microsoft.com/meet/123456789?p=AbCdEf", "https://zoom.us/j/123456789?pwd=AbCdEf"])(
    "refuses a join link that carries its passcode (%s) and says why",
    async (joinUrl) => {
      const response = await serviceWrite(post(`/api/teaching/services/${serviceId}`, { ...series, joinUrl }), context);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: "Remove the passcode from this link. Share passcodes another way.",
        code: "teaching_invalid_request",
      });
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("replaces Zod's own wording with a plain line", async () => {
    const response = await serviceWrite(
      post(`/api/teaching/services/${serviceId}`, { ...series, title: "ab" }),
      context,
    );
    expect(await response.json()).toMatchObject({ message: "Check the details and try again." });
    expect(plainTeachingIssue([{ message: "Too small: expected string to have >=3 characters" }])).toBe(
      "Check the details and try again.",
    );
  });

  it("saves a clean series without the action name in the payload", async () => {
    mocks.rpc.mockResolvedValue({ data: { seriesId: occurrenceId, occurrences: 11 }, error: null });
    const response = await serviceWrite(post(`/api/teaching/services/${serviceId}`, series), context);
    expect(response.status).toBe(200);
    const payload = mocks.rpc.mock.calls[0][1].p_payload;
    expect(payload).toMatchObject({ title: "Invented journal club", joinUrl: null, groupIds: [] });
    expect(payload).not.toHaveProperty("action");
  });

  // Review focus 4: typed codes can be guessed, so they spend a small allowance of their own.
  it("spends the typed-code allowance before checking a typed code", async () => {
    mocks.rate.mockImplementation(async ({ bucket }: { bucket: string }) => ({
      limited: bucket === "teaching_code",
      retryAfterSeconds: 60,
    }));
    const response = await serviceWrite(
      post(`/api/teaching/services/${serviceId}`, {
        action: "checkin.typed",
        occurrenceId,
        stream: "room",
        code: "123456",
      }),
      context,
    );
    expect(response.status).toBe(429);
    expect(mocks.rate).toHaveBeenCalledWith(
      expect.objectContaining({ subject: { kind: "owner", ownerId: actor }, bucket: "teaching_code" }),
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  // Master plan R2: the display link comes back once as `{ token, path, expiresAt }`; the database sees only its hash.
  it("returns a new display link once, with its token, path and expiry", async () => {
    const expiresAt = "2026-09-30T06:00:00+00:00";
    mocks.rpc.mockResolvedValue({ data: { expiresAt, linkHash: "never-leaves" }, error: null });
    const response = await serviceWrite(
      post(`/api/teaching/services/${serviceId}`, { action: "display.create", occurrenceId, stream: "room" }),
      context,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["expiresAt", "path", "token"]);
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(body).toMatchObject({ expiresAt, path: `/teaching/display/${body.token}` });
    const payload = mocks.rpc.mock.calls[0][1].p_payload;
    expect(payload).toEqual({
      occurrenceId,
      stream: "room",
      linkHash: createHash("sha256").update(body.token, "utf8").digest("hex"),
    });
  });

  it("never writes in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    const response = await serviceWrite(
      post(`/api/teaching/services/${serviceId}`, { action: "attendance.self", occurrenceId }),
      context,
    );
    expect(response.status).toBe(400);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("shows a demo session in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    const today = perthToday();
    const [first] = demoTeachingSessions({ from: today, to: addDays(today, 13) });
    const response = await serviceRead(
      get(`/api/teaching/services/${DEMO_TEACHING_SERVICE_ID}?action=session.read&occurrenceId=${first.occurrenceId}`),
      { params: Promise.resolve({ serviceId: DEMO_TEACHING_SERVICE_ID }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).title).toBe(first.title);
  });
});
