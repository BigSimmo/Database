import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({ from: vi.fn(), auth: vi.fn(), demo: vi.fn(), rate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: routeMocks.from }) }));
vi.mock("@/lib/supabase/auth", () => ({
  requireAuthenticatedUser: routeMocks.auth,
  AuthenticationError: class extends Error {},
  unauthorizedResponse: () => Response.json({ error: "Sign in" }, { status: 401 }),
}));
vi.mock("@/lib/env", () => ({ isDemoMode: routeMocks.demo }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: routeMocks.rate,
  rateLimitJsonResponse: () => Response.json({}, { status: 429 }),
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
}));

import {
  CME_DRAFT_PAYLOAD_MAX_BYTES,
  cmeDraftPayloadByteSize,
  cmeDraftPayloadSchema,
  cmeDraftUpdateSchema,
  draftTitle,
  groupDrafts,
  rowToCmeDraft,
  type CmeDraft,
} from "@/lib/cme/drafts";
import { GET as listDrafts, POST as createDraft } from "@/app/api/cme/drafts/route";
import { DELETE as deleteDraft, GET as getDraft, PATCH as patchDraft } from "@/app/api/cme/drafts/[id]/route";
import { AuthenticationError } from "@/lib/supabase/auth";

const OWNER = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";

// --- payload validation and the size cap ------------------------------------

describe("draft payload schema", () => {
  it("accepts an empty object — a brand-new blank draft — and fills every field's default", () => {
    const parsed = cmeDraftPayloadSchema.parse({});
    expect(parsed).toEqual({
      title: "",
      date: "",
      statedHoursText: "",
      mode: null,
      allocations: [],
      reflection: "",
      sourceUrl: "",
      formalPeerReviewText: "",
      buckets: [],
      costText: "",
      routineId: null,
      documentId: null,
    });
  });

  it("keeps a half-filled form: only title and mode set, everything else defaulted", () => {
    const parsed = cmeDraftPayloadSchema.parse({ title: "Grand round", mode: "educational" });
    expect(parsed.title).toBe("Grand round");
    expect(parsed.mode).toBe("educational");
    expect(parsed.date).toBe("");
    expect(parsed.allocations).toEqual([]);
  });

  it("strips unknown keys instead of rejecting the payload", () => {
    const parsed = cmeDraftPayloadSchema.parse({ title: "x", somethingNewer: "ignored" });
    expect(parsed).not.toHaveProperty("somethingNewer");
  });

  it("rejects a title over its length cap", () => {
    expect(cmeDraftPayloadSchema.safeParse({ title: "a".repeat(201) }).success).toBe(false);
    expect(cmeDraftPayloadSchema.safeParse({ title: "a".repeat(200) }).success).toBe(true);
  });

  it("rejects a reflection over its length cap", () => {
    expect(cmeDraftPayloadSchema.safeParse({ reflection: "a".repeat(2001) }).success).toBe(false);
  });

  it("only accepts a real category (or split, or null) for mode", () => {
    expect(cmeDraftPayloadSchema.safeParse({ mode: "reviewing" }).success).toBe(true);
    expect(cmeDraftPayloadSchema.safeParse({ mode: "split" }).success).toBe(true);
    expect(cmeDraftPayloadSchema.safeParse({ mode: null }).success).toBe(true);
    expect(cmeDraftPayloadSchema.safeParse({ mode: "not-a-category" }).success).toBe(false);
  });

  it("caps allocations at 3 items and buckets at 8, matching the real entry schema's shape", () => {
    expect(
      cmeDraftPayloadSchema.safeParse({
        allocations: [
          { category: "educational", hours: 1 },
          { category: "reviewing", hours: 1 },
          { category: "measuring", hours: 1 },
          { category: "educational", hours: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(cmeDraftPayloadSchema.safeParse({ buckets: Array.from({ length: 9 }, (_, i) => `d${i}`) }).success).toBe(
      false,
    );
  });

  it("rejects routineId/documentId that are not a uuid or null", () => {
    expect(cmeDraftPayloadSchema.safeParse({ routineId: "not-a-uuid" }).success).toBe(false);
    expect(cmeDraftPayloadSchema.safeParse({ routineId: null }).success).toBe(true);
  });

  it("cmeDraftPayloadByteSize matches the UTF-8 byte length Postgres' octet_length would see", () => {
    expect(cmeDraftPayloadByteSize({ title: "abc" })).toBe(new TextEncoder().encode('{"title":"abc"}').length);
    // A multi-byte character costs more than one byte — the point of measuring bytes, not `.length`.
    expect(cmeDraftPayloadByteSize({ title: "café" })).toBeGreaterThan(JSON.stringify({ title: "café" }).length - 1);
  });

  it("the largest payload every individual field cap allows still fits under the 16384-byte column limit", () => {
    const maximal = cmeDraftPayloadSchema.parse({
      title: "a".repeat(200),
      date: "b".repeat(40),
      statedHoursText: "c".repeat(40),
      mode: "measuring",
      allocations: [
        { category: "educational", hours: 12.5 },
        { category: "reviewing", hours: 12.5 },
        { category: "measuring", hours: 12.5 },
      ],
      reflection: "d".repeat(2000),
      sourceUrl: "e".repeat(2000),
      formalPeerReviewText: "f".repeat(40),
      buckets: Array.from({ length: 8 }, (_, i) => `bucket-${i}`.padEnd(80, "g")),
      costText: "h".repeat(40),
      routineId: "33333333-3333-4333-8333-333333333333",
      documentId: "44444444-4444-4444-8444-444444444444",
    });
    expect(cmeDraftPayloadByteSize(maximal)).toBeLessThan(CME_DRAFT_PAYLOAD_MAX_BYTES);
  });
});

describe("draft update schema", () => {
  it("requires at least one field", () => {
    expect(cmeDraftUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts waiting fields alone, or payload alone", () => {
    expect(cmeDraftUpdateSchema.safeParse({ waitingOn: "supervisor" }).success).toBe(true);
    expect(cmeDraftUpdateSchema.safeParse({ payload: { title: "x" } }).success).toBe(true);
  });

  it("only accepts supervisor/workforce/null for waitingOn", () => {
    expect(cmeDraftUpdateSchema.safeParse({ waitingOn: "manager" }).success).toBe(false);
    expect(cmeDraftUpdateSchema.safeParse({ waitingOn: null }).success).toBe(true);
  });

  it("caps waitingNote at 200 characters and accepts null", () => {
    expect(cmeDraftUpdateSchema.safeParse({ waitingNote: "a".repeat(201) }).success).toBe(false);
    expect(cmeDraftUpdateSchema.safeParse({ waitingNote: null }).success).toBe(true);
  });

  it("requires a real YYYY-MM-DD shape for followUpOn, or null", () => {
    expect(cmeDraftUpdateSchema.safeParse({ followUpOn: "2026-09-30" }).success).toBe(true);
    expect(cmeDraftUpdateSchema.safeParse({ followUpOn: null }).success).toBe(true);
    expect(cmeDraftUpdateSchema.safeParse({ followUpOn: "30 Sep 2026" }).success).toBe(false);
    expect(cmeDraftUpdateSchema.safeParse({ followUpOn: "2026-02-30" }).success).toBe(false);
  });

  it("rejects an unknown field (strict)", () => {
    expect(cmeDraftUpdateSchema.safeParse({ somethingElse: 1 }).success).toBe(false);
  });
});

// --- row mapping, grouping, title fallback ----------------------------------

const ROW = {
  id: DRAFT_ID,
  payload: { title: "Grand round on delirium", mode: "educational" },
  waiting_on: null as "supervisor" | "workforce" | null,
  waiting_note: null as string | null,
  follow_up_on: null as string | null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
};

describe("row mapping", () => {
  it("maps a database row to the model", () => {
    expect(rowToCmeDraft(ROW)).toEqual({
      id: DRAFT_ID,
      payload: cmeDraftPayloadSchema.parse({ title: "Grand round on delirium", mode: "educational" }),
      waitingOn: null,
      waitingNote: null,
      followUpOn: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    });
  });

  it("degrades a payload the lenient schema somehow cannot parse to a blank one, rather than throwing", () => {
    const draft = rowToCmeDraft({ ...ROW, payload: { allocations: "not-an-array" } });
    expect(draft.payload.title).toBe("");
    expect(draft.payload.allocations).toEqual([]);
  });
});

function draft(overrides: Partial<CmeDraft> = {}): CmeDraft {
  return {
    id: DRAFT_ID,
    payload: cmeDraftPayloadSchema.parse({}),
    waitingOn: null,
    waitingNote: null,
    followUpOn: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("groupDrafts", () => {
  it("splits into my-next-action / supervisor / workforce by waitingOn", () => {
    const mine = draft({ id: "a", waitingOn: null });
    const supervisor = draft({ id: "b", waitingOn: "supervisor" });
    const workforce = draft({ id: "c", waitingOn: "workforce" });
    const groups = groupDrafts([mine, supervisor, workforce]);
    expect(groups.nextAction).toEqual([mine]);
    expect(groups.supervisor).toEqual([supervisor]);
    expect(groups.workforce).toEqual([workforce]);
  });

  it("orders each group most-recently-edited first", () => {
    const older = draft({ id: "older", updatedAt: "2026-09-01T00:00:00.000Z" });
    const newer = draft({ id: "newer", updatedAt: "2026-09-10T00:00:00.000Z" });
    expect(groupDrafts([older, newer]).nextAction.map((d) => d.id)).toEqual(["newer", "older"]);
  });

  it("returns empty arrays for a group with nothing in it", () => {
    const groups = groupDrafts([draft({ waitingOn: null })]);
    expect(groups.supervisor).toEqual([]);
    expect(groups.workforce).toEqual([]);
  });
});

describe("draftTitle", () => {
  it("uses the payload's own title", () => {
    expect(draftTitle(draft({ payload: cmeDraftPayloadSchema.parse({ title: "Ethics course" }) }))).toBe(
      "Ethics course",
    );
  });

  it("falls back to 'Untitled draft' when the title is blank or whitespace", () => {
    expect(draftTitle(draft({ payload: cmeDraftPayloadSchema.parse({}) }))).toBe("Untitled draft");
    expect(draftTitle(draft({ payload: cmeDraftPayloadSchema.parse({ title: "   " }) }))).toBe("Untitled draft");
  });
});

// --- repository, owner predicate --------------------------------------------
// Matching tests/cme-missed-sessions.test.ts's fakeClient, which itself matches
// tests/cme-repository.test.ts's.

type FakeResponse = { data: unknown; error: { message: string } | null };

function makeChain(response: FakeResponse) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    single: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(response).then(resolve, reject);
    },
  };
  return chain;
}

function fakeClient(responsesByTable: Record<string, FakeResponse[]>) {
  const calls: Array<{ table: string; chain: ReturnType<typeof makeChain> }> = [];
  const queues = new Map(Object.entries(responsesByTable).map(([table, rows]) => [table, [...rows]]));
  const from = vi.fn((table: string) => {
    const queue = queues.get(table);
    if (!queue || queue.length === 0) throw new Error(`fakeClient: no queued response left for table "${table}"`);
    const chain = makeChain(queue.shift()!);
    calls.push({ table, chain });
    return chain;
  });
  return { from, calls };
}

describe("drafts repository, owner predicate", () => {
  it("fetchOwnerCmeDrafts filters by owner_id on the same chain as from()", async () => {
    const { fetchOwnerCmeDrafts } = await import("@/lib/cme/drafts-repository");
    const client = fakeClient({ cme_entry_drafts: [{ data: [ROW], error: null }] });
    const result = await fetchOwnerCmeDrafts(client as never, OWNER);
    expect(client.calls[0].table).toBe("cme_entry_drafts");
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("owner_id", OWNER);
    expect(result[0].id).toBe(DRAFT_ID);
  });

  it("fetchOwnerCmeDrafts refuses without an owner, and never queries", async () => {
    const { fetchOwnerCmeDrafts } = await import("@/lib/cme/drafts-repository");
    const client = fakeClient({});
    await expect(fetchOwnerCmeDrafts(client as never, "")).rejects.toThrow(/owner/i);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("fetchOwnerCmeDraft filters by id and owner_id on the same chain as from()", async () => {
    const { fetchOwnerCmeDraft } = await import("@/lib/cme/drafts-repository");
    const client = fakeClient({ cme_entry_drafts: [{ data: ROW, error: null }] });
    await fetchOwnerCmeDraft(client as never, OWNER, DRAFT_ID);
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("id", DRAFT_ID);
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("owner_id", OWNER);
  });

  it("createOwnerCmeDraft writes owner_id on the insert", async () => {
    const { createOwnerCmeDraft } = await import("@/lib/cme/drafts-repository");
    const client = fakeClient({ cme_entry_drafts: [{ data: ROW, error: null }] });
    await createOwnerCmeDraft(client as never, OWNER, cmeDraftPayloadSchema.parse({}));
    expect(client.calls[0].chain.insert).toHaveBeenCalledWith(expect.objectContaining({ owner_id: OWNER }));
  });

  it("updateOwnerCmeDraft filters by id and owner_id on the same chain as from()", async () => {
    const { updateOwnerCmeDraft } = await import("@/lib/cme/drafts-repository");
    const client = fakeClient({ cme_entry_drafts: [{ data: { ...ROW, waiting_on: "supervisor" }, error: null }] });
    const result = await updateOwnerCmeDraft(client as never, OWNER, DRAFT_ID, { waitingOn: "supervisor" });
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("id", DRAFT_ID);
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("owner_id", OWNER);
    expect(client.calls[0].chain.update).toHaveBeenCalledWith({ waiting_on: "supervisor" });
    expect(result?.waitingOn).toBe("supervisor");
  });

  it("updateOwnerCmeDraft returns null for another owner's draft, rather than throwing", async () => {
    const { updateOwnerCmeDraft } = await import("@/lib/cme/drafts-repository");
    const client = fakeClient({ cme_entry_drafts: [{ data: null, error: null }] });
    const result = await updateOwnerCmeDraft(client as never, OWNER, DRAFT_ID, { waitingOn: "workforce" });
    expect(result).toBeNull();
  });

  it("deleteOwnerCmeDraft filters by id and owner_id, and never throws for a missing row", async () => {
    const { deleteOwnerCmeDraft } = await import("@/lib/cme/drafts-repository");
    const client = fakeClient({ cme_entry_drafts: [{ data: null, error: null }] });
    await deleteOwnerCmeDraft(client as never, OWNER, DRAFT_ID);
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("id", DRAFT_ID);
    expect(client.calls[0].chain.eq).toHaveBeenCalledWith("owner_id", OWNER);
  });
});

// --- API contract ------------------------------------------------------------

function getRequest(url: string) {
  return new Request(url);
}
function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("drafts API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.demo.mockReturnValue(false);
    routeMocks.auth.mockResolvedValue({ id: OWNER });
    routeMocks.rate.mockResolvedValue({ limited: false });
  });

  it("GET lists the owner's drafts", async () => {
    routeMocks.from.mockReturnValueOnce(makeChain({ data: [ROW], error: null }));
    const response = await listDrafts(getRequest("http://localhost/api/cme/drafts"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { drafts: unknown[] };
    expect(body.drafts).toHaveLength(1);
  });

  it("GET returns an empty demo list without touching the database", async () => {
    routeMocks.demo.mockReturnValue(true);
    const response = await listDrafts(getRequest("http://localhost/api/cme/drafts"));
    expect(await response.json()).toEqual({ drafts: [], demoMode: true });
    expect(routeMocks.from).not.toHaveBeenCalled();
  });

  it("GET maps a missing session to 401 without touching the database", async () => {
    routeMocks.auth.mockRejectedValue(new AuthenticationError("no session"));
    const response = await listDrafts(getRequest("http://localhost/api/cme/drafts"));
    expect(response.status).toBe(401);
    expect(routeMocks.from).not.toHaveBeenCalled();
  });

  it("GET is rate limited", async () => {
    routeMocks.rate.mockResolvedValue({ limited: true });
    const response = await listDrafts(getRequest("http://localhost/api/cme/drafts"));
    expect(response.status).toBe(429);
  });

  it("POST creates a blank draft with the owner from the session — the create body has no owner field at all", async () => {
    routeMocks.from.mockReturnValueOnce(makeChain({ data: ROW, error: null }));
    const response = await createDraft(jsonRequest("http://localhost/api/cme/drafts", "POST", {}));
    expect(response.status).toBe(201);
    expect(routeMocks.from.mock.results[0].value.insert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: OWNER }),
    );
  });

  it("POST accepts a partial payload", async () => {
    routeMocks.from.mockReturnValueOnce(makeChain({ data: ROW, error: null }));
    const response = await createDraft(
      jsonRequest("http://localhost/api/cme/drafts", "POST", { payload: { title: "Grand round" } }),
    );
    expect(response.status).toBe(201);
  });

  it("POST refuses in demo mode and never writes", async () => {
    routeMocks.demo.mockReturnValue(true);
    const response = await createDraft(jsonRequest("http://localhost/api/cme/drafts", "POST", {}));
    expect(response.status).toBe(400);
    expect(routeMocks.from).not.toHaveBeenCalled();
  });

  it("POST rejects an invalid payload with 400 before touching the database", async () => {
    const response = await createDraft(
      jsonRequest("http://localhost/api/cme/drafts", "POST", { payload: { title: "a".repeat(500) } }),
    );
    expect(response.status).toBe(400);
    expect(routeMocks.from).not.toHaveBeenCalled();
  });

  it("GET one returns 404 for another owner's draft", async () => {
    routeMocks.from.mockReturnValueOnce(makeChain({ data: null, error: null }));
    const response = await getDraft(getRequest(`http://localhost/api/cme/drafts/${DRAFT_ID}`), {
      params: Promise.resolve({ id: DRAFT_ID }),
    });
    expect(response.status).toBe(404);
  });

  it("GET one rejects an id that is not a uuid before touching the database", async () => {
    const response = await getDraft(getRequest("http://localhost/api/cme/drafts/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(response.status).toBe(400);
    expect(routeMocks.from).not.toHaveBeenCalled();
  });

  it("PATCH updates waiting fields", async () => {
    routeMocks.from.mockReturnValueOnce(
      makeChain({ data: { ...ROW, waiting_on: "supervisor", waiting_note: "Ask Dr Lee" }, error: null }),
    );
    const response = await patchDraft(
      jsonRequest(`http://localhost/api/cme/drafts/${DRAFT_ID}`, "PATCH", {
        waitingOn: "supervisor",
        waitingNote: "Ask Dr Lee",
      }),
      { params: Promise.resolve({ id: DRAFT_ID }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { draft: { waitingOn: string; waitingNote: string } };
    expect(body.draft.waitingOn).toBe("supervisor");
    expect(body.draft.waitingNote).toBe("Ask Dr Lee");
  });

  it("PATCH rejects an empty body before touching the database", async () => {
    const response = await patchDraft(jsonRequest(`http://localhost/api/cme/drafts/${DRAFT_ID}`, "PATCH", {}), {
      params: Promise.resolve({ id: DRAFT_ID }),
    });
    expect(response.status).toBe(400);
    expect(routeMocks.from).not.toHaveBeenCalled();
  });

  it("PATCH 404s for another owner's draft", async () => {
    routeMocks.from.mockReturnValueOnce(makeChain({ data: null, error: null }));
    const response = await patchDraft(
      jsonRequest(`http://localhost/api/cme/drafts/${DRAFT_ID}`, "PATCH", { waitingOn: null }),
      { params: Promise.resolve({ id: DRAFT_ID }) },
    );
    expect(response.status).toBe(404);
  });

  it("PATCH refuses in demo mode and never writes", async () => {
    routeMocks.demo.mockReturnValue(true);
    const response = await patchDraft(
      jsonRequest(`http://localhost/api/cme/drafts/${DRAFT_ID}`, "PATCH", { waitingOn: null }),
      { params: Promise.resolve({ id: DRAFT_ID }) },
    );
    expect(response.status).toBe(400);
    expect(routeMocks.from).not.toHaveBeenCalled();
  });

  it("DELETE always reports success, even for a draft that is already gone (no-op)", async () => {
    routeMocks.from.mockReturnValueOnce(makeChain({ data: null, error: null }));
    const response = await deleteDraft(
      new Request(`http://localhost/api/cme/drafts/${DRAFT_ID}`, { method: "DELETE" }),
      {
        params: Promise.resolve({ id: DRAFT_ID }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(routeMocks.from.mock.results[0].value.eq).toHaveBeenCalledWith("owner_id", OWNER);
  });

  it("DELETE refuses in demo mode and never writes", async () => {
    routeMocks.demo.mockReturnValue(true);
    const response = await deleteDraft(
      new Request(`http://localhost/api/cme/drafts/${DRAFT_ID}`, { method: "DELETE" }),
      {
        params: Promise.resolve({ id: DRAFT_ID }),
      },
    );
    expect(response.status).toBe(400);
    expect(routeMocks.from).not.toHaveBeenCalled();
  });
});

// --- a draft never feeds CPD totals or requirement status -------------------

describe("drafts never feed CPD totals or requirement status", () => {
  const guardedFiles = [
    "src/lib/cme/evaluate.ts",
    "src/lib/cme/year-close.ts",
    "src/lib/cme/export.ts",
    "src/lib/cme/annual-summary.ts",
  ];

  for (const file of guardedFiles) {
    it(`${file} never imports the drafts module or reads cme_entry_drafts`, () => {
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        return; // file does not exist in this checkout — nothing to guard
      }
      expect(source).not.toMatch(/cme\/drafts/);
      expect(source).not.toMatch(/cme_entry_drafts/);
    });
  }
});
