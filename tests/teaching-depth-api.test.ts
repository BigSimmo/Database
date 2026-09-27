import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  auth: vi.fn(),
  demo: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
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
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { POST as reviewPost } from "@/app/api/teaching/cpd/review/route";
import { GET as depthViews } from "@/app/api/teaching/depth/route";
import { GET as depthRead, POST as depthWrite } from "@/app/api/teaching/services/[serviceId]/depth/route";
import { IMPORT_TEMPLATE_HEADERS } from "@/lib/teaching/depth-model";
import { parseCsv } from "@/lib/teaching/import-sheet-reader";

import { ENTRY, ENTRY_2, NOTE, PAIRING, SERVICE, entry, pairing } from "./helpers/teaching-depth-fixtures";

const actor = "11111111-1111-4111-8111-111111111111";
const occurrenceId = "33333333-3333-4333-8333-333333333333";
const LEFT_SERVICE = "44444444-4444-4444-8444-444444444444";
const context = { params: Promise.resolve({ serviceId: SERVICE }) };
const path = `/api/teaching/services/${SERVICE}/depth`;
const get = (url: string) => new Request(`https://psychiatry.example${url}`);
const post = (url: string, body: unknown) =>
  new Request(`https://psychiatry.example${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const ok = (data: unknown) => ({ data, error: null });
const sqlError = (message: string) => ({ data: null, error: { message } });
const depthCall = (action: string, payload: object) => [
  "teaching_depth_command",
  { p_actor_id: actor, p_service_id: SERVICE, p_action: action, p_payload: payload },
];
const team = { id: SERVICE, name: "Demo service", role: "organiser", acceptsRealData: true, isDemo: true };
const logRow = {
  occurrenceId,
  method: "self",
  recordedAt: "2026-09-01T04:30:00Z",
  title: "Demo",
  startsAt: "2026-09-01T04:30:00Z",
  endsAt: "2026-09-01T05:30:00Z",
  serviceId: SERVICE,
  serviceName: "Demo service",
  readOnlyUntil: null,
  cpdEntryId: null,
};

function serveTeamsThen(pairings: unknown[], leftServices: unknown[] = []) {
  mocks.rpc.mockImplementation(async (fn: string, args: { p_action: string }) => {
    if (fn === "teaching_command" && args.p_action === "week.read")
      return ok({ teams: [team], sessions: [], notices: [], attendance: [] });
    if (fn === "teaching_command" && args.p_action === "supervision.left_services")
      return ok({ services: leftServices });
    return ok({ pairings });
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.auth.mockResolvedValue({ id: actor });
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ in: mocks.in });
  mocks.in.mockResolvedValue(ok([]));
});

describe("supervision", () => {
  it("logs with the session actor only, and keeps the action name out of the payload", async () => {
    mocks.rpc.mockResolvedValue(ok({ entryId: ENTRY }));
    const fields = { pairingId: PAIRING, date: "2026-09-30", minutes: 60, type: "individual", topics: ["risk"] };
    const response = await depthWrite(post(path, { action: "supervision.log", ...fields }), context);
    expect(await response.json()).toEqual({ entryId: ENTRY });
    expect(mocks.rpc).toHaveBeenCalledWith(...depthCall("supervision.log", fields));
  });

  it("a doctor can't read another doctor's supervision", async () => {
    let response = await depthRead(
      get(`${path}?action=supervision.read&pairingId=${PAIRING}&registrarId=${actor}`),
      context,
    );
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue(sqlError("teaching_not_found"));
    response = await depthRead(get(`${path}?action=supervision.read&pairingId=${PAIRING}`), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      message: "This pairing isn't available.",
      code: "teaching_not_found",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("a supervisor confirms only their own pairings, and a batch is one all-or-nothing call", async () => {
    let response = await depthWrite(
      post(path, { action: "supervision.confirm", entryIds: [ENTRY], supervisorId: actor }),
      context,
    );
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue(sqlError("teaching_not_found"));
    response = await depthWrite(post(path, { action: "supervision.confirm", entryIds: [ENTRY, ENTRY_2] }), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      message: "These sessions aren't waiting for you any more. Reload to see the latest.",
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(...depthCall("supervision.confirm", { entryIds: [ENTRY, ENTRY_2] }));
  });

  it("organisers see totals and status across their services, never topics or the registrar's target", async () => {
    serveTeamsThen([pairing({ access: "organiser", targetHours: 20 })]);
    const response = await depthViews(get("/api/teaching/depth?view=supervision"));
    const [row] = (await response.json()).pairings;
    expect(row).toMatchObject({
      access: "organiser",
      confirmedMinutes: 60,
      pendingCount: 1,
      entries: null,
      targetHours: null,
      serviceId: SERVICE,
      serviceName: "Demo service",
      readOnlyUntil: null,
    });
    expect(JSON.stringify(row)).not.toMatch(/case_review|psychotherapy/);
    expect(mocks.from).toHaveBeenCalledWith("teaching_calendar_optins");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", actor);
    expect(mocks.in).toHaveBeenCalledWith("service_id", [SERVICE]);
  });

  // Master plan R28 / S11b: a leaver reads their own supervision, read-only, for 90 days.
  it("reads a service the reader left as read-only, from supervision.left_services", async () => {
    const until = "2026-12-01T00:00:00Z";
    serveTeamsThen(
      [pairing()],
      [
        {
          serviceId: LEFT_SERVICE,
          serviceName: "Demo former service",
          leftAt: "2026-09-02T00:00:00Z",
          readableUntil: until,
        },
      ],
    );
    const { pairings } = await (await depthViews(get("/api/teaching/depth?view=supervision"))).json();
    expect(
      pairings.map((row: { serviceId: string; readOnlyUntil: string | null }) => [row.serviceId, row.readOnlyUntil]),
    ).toEqual([
      [SERVICE, null],
      [LEFT_SERVICE, until],
    ]);
    const depthServices = mocks.rpc.mock.calls
      .filter(([fn]) => fn === "teaching_depth_command")
      .map(([, args]) => [args.p_service_id, args.p_action]);
    expect(depthServices).toEqual([
      [SERVICE, "supervision.read"],
      [LEFT_SERVICE, "supervision.read"],
    ]);
  });

  it("drops a left service whose 90 days ran out between the two reads", async () => {
    mocks.rpc.mockImplementation(async (fn: string, args: { p_action: string; p_service_id: string }) => {
      if (args.p_action === "week.read") return ok({ teams: [], sessions: [], notices: [], attendance: [] });
      if (args.p_action === "supervision.left_services")
        return ok({
          services: [
            {
              serviceId: LEFT_SERVICE,
              serviceName: "Demo former service",
              leftAt: "2026-07-02T00:00:00Z",
              readableUntil: "2026-09-30T00:00:00Z",
            },
          ],
        });
      return sqlError("teaching_access_denied");
    });
    const response = await depthViews(get("/api/teaching/depth?view=supervision"));
    expect(await response.json()).toEqual({ pairings: [] });
  });

  it("lists only what waits for the reader as supervisor, and never reads left services for it", async () => {
    const note = {
      noteId: NOTE,
      reason: "wrong_length" as const,
      correctedValue: { minutes: 45 },
      createdAt: "2026-09-29T02:00:00.000Z",
      confirmedAt: null,
    };
    serveTeamsThen([pairing({ access: "supervisor", entries: [entry({ notes: [note] })] }), pairing()]);
    const { items } = await (await depthViews(get("/api/teaching/depth?view=pending"))).json();
    expect(items.map((item: { id: string }) => item.id)).toEqual([ENTRY, NOTE]);
    expect(mocks.rpc.mock.calls.map(([, args]) => args.p_action)).not.toContain("supervision.left_services");
  });
});

describe("feedback", () => {
  it("a presenter gets counts only, and nothing before the release", async () => {
    const url = `${path}?action=feedback.totals&occurrenceId=${occurrenceId}`;
    mocks.rpc.mockResolvedValueOnce(ok({ released: false }));
    expect(await (await depthRead(get(url), context)).json()).toEqual({ released: false });
    mocks.rpc.mockResolvedValueOnce(
      ok({
        released: true,
        replies: 3,
        useful: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 },
        pace: { slow: 0, right: 3, fast: 0 },
        responders: ["x"],
      }),
    );
    const body = await (await depthRead(get(url), context)).json();
    expect(Object.keys(body).sort()).toEqual(["pace", "released", "replies", "useful"]);
  });

  it("sends two taps and no name, and says plainly when the reader already answered", async () => {
    mocks.rpc.mockResolvedValueOnce(ok({ marker: "should-not-leave" }));
    const sent = await depthWrite(
      post(path, { action: "feedback.submit", occurrenceId, useful: 4, pace: "right" }),
      context,
    );
    expect(await sent.json()).toEqual({});
    expect(mocks.rpc).toHaveBeenCalledWith(...depthCall("feedback.submit", { occurrenceId, useful: 4, pace: "right" }));
    mocks.rpc.mockResolvedValueOnce(sqlError("teaching_limit"));
    const response = await depthWrite(
      post(path, { action: "feedback.submit", occurrenceId, useful: 4, pace: "right" }),
      context,
    );
    expect(await response.json()).toMatchObject({ message: "You've already answered for this session." });
  });
});

describe("import", () => {
  const csv = [
    IMPORT_TEMPLATE_HEADERS.join(","),
    "Demo journal club,journal,weekly,2026-10-07,2026-12-16,12:30,60,Demo library,,Interns",
  ].join("\n");

  it("previews the rows the browser read, reads only the organiser's programme, and saves nothing", async () => {
    mocks.rpc.mockResolvedValue(ok({ series: [], groups: [], members: [] }));
    const body = await (
      await depthWrite(post(path, { action: "import.preview", rows: parseCsv(csv) }), context)
    ).json();
    expect(body.ready).toBeNull();
    expect(body.rows[0].errors).toEqual(['groups: No group called "Interns". Add it in Organise first.']);
    expect(mocks.rpc.mock.calls.map(([fn, args]) => [fn, args.p_action])).toEqual([
      ["teaching_command", "organise.read"],
    ]);
  });

  it("never takes a file (R25)", async () => {
    const response = await depthWrite(post(path, { action: "import.preview", format: "csv", content: csv }), context);
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("commits every row in one call, and says nothing was saved when one is refused", async () => {
    const row = {
      title: "Demo journal club",
      kind: "journal",
      repeat: "weekly",
      firstDate: "2026-10-07",
      startTime: "12:30",
      minutes: 60,
      endDate: "2026-12-16",
    };
    mocks.rpc.mockResolvedValueOnce(ok({ series: 2, occurrences: 22 }));
    const response = await depthWrite(
      post(path, { action: "import.commit", rows: [row, { ...row, title: "Demo grand round" }] }),
      context,
    );
    expect(await response.json()).toEqual({ series: 2, occurrences: 22 });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][1].p_payload.rows).toHaveLength(2);
    expect(mocks.rpc.mock.calls[0][1].p_action).toBe("import.commit");
    mocks.rpc.mockResolvedValueOnce(sqlError("teaching_invalid_request"));
    const refused = await depthWrite(post(path, { action: "import.commit", rows: [row] }), context);
    expect(await refused.json()).toMatchObject({
      message: "A row was refused, so nothing was saved. Preview the file again.",
    });
    expect(
      (await depthWrite(post(path, { action: "import.commit", rows: [{ ...row, seriesId: ENTRY }] }), context)).status,
    ).toBe(400);
  });
});

describe("the weekly CPD review", () => {
  it("offers only attended, ended sessions not yet in CPD", async () => {
    mocks.rpc.mockResolvedValue(ok({ attendance: [logRow, { ...logRow, occurrenceId: ENTRY, cpdEntryId: ENTRY_2 }] }));
    const { rows } = await (await depthViews(get("/api/teaching/depth?view=cpd-review"))).json();
    expect(rows).toEqual([
      {
        occurrenceId,
        serviceName: "Demo service",
        title: "Demo",
        startsAt: logRow.startsAt,
        endsAt: logRow.endsAt,
        hours: 1,
      },
    ]);
  });

  it("saves each row through the CPD save function and reports each row, so one refusal stops nothing", async () => {
    mocks.rpc
      .mockResolvedValueOnce(ok({ entryId: ENTRY, created: true }))
      .mockResolvedValueOnce(sqlError("cme_year_closed"));
    const rows = [
      { occurrenceId, hours: 1, requestId: NOTE },
      { occurrenceId: ENTRY_2, hours: 1.5, requestId: PAIRING },
    ];
    const { results } = await (await reviewPost(post("/api/teaching/cpd/review", { rows }))).json();
    expect(results).toEqual([
      { occurrenceId, entryId: ENTRY, code: null, message: null },
      {
        occurrenceId: ENTRY_2,
        entryId: null,
        code: "cme_year_closed",
        message: "The CPD year for this session is closed. Add it as an amendment in CPD.",
      },
    ]);
    expect(mocks.rpc.mock.calls.map(([fn]) => fn)).toEqual(["cme_save_teaching_entry", "cme_save_teaching_entry"]);
  });

  it("calls nothing in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    expect((await depthViews(get("/api/teaching/depth?view=teach"))).status).toBe(400);
    expect(
      (await depthWrite(post(path, { action: "feedback.submit", occurrenceId, useful: 4, pace: "right" }), context))
        .status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("the presenter's Teach page", () => {
  it("reads the presenter's own talks across services, with no service named", async () => {
    mocks.rpc.mockResolvedValue(ok({ upcoming: [], taught: [] }));
    expect(await (await depthViews(get("/api/teaching/depth?view=teach"))).json()).toEqual({
      upcoming: [],
      taught: [],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("teaching_command", {
      p_actor_id: actor,
      p_service_id: null,
      p_action: "teach.read",
      p_payload: {},
    });
  });

  it("refuses an unknown view before any call", async () => {
    expect((await depthViews(get("/api/teaching/depth?view=everyone"))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
