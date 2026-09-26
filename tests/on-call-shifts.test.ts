import { beforeEach, describe, expect, it, vi } from "vitest";

import { diffRoster, rosterWindow } from "@/lib/on-call/shifts/diff";
import type { OnCallShift, OnCallShiftInput } from "@/lib/on-call/shifts/model";
import { ON_CALL_SHIFT_IMPORT_MAX, onCallShiftImportRequestSchema } from "@/lib/on-call/shifts/model";
import { describeNextShift, shiftHours } from "@/lib/on-call/shifts/next-shift";
import { parseRosterCsv } from "@/lib/on-call/shifts/parse-csv";
import { parseRosterIcs } from "@/lib/on-call/shifts/parse-ics";
import { formatPerthDay, perthWallToIso } from "@/lib/on-call/shifts/perth-time";

/*
 * My shifts: reading a roster on the device, working out what changed, the
 * next-shift wording, and the API's promise that a roster is its owner's alone.
 * Every roster here is invented.
 */

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  auth: vi.fn(),
  demo: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
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

import { DELETE, GET, POST } from "@/app/api/on-call/shifts/route";
import { PATCH } from "@/app/api/on-call/shifts/imports/[id]/route";
import { AuthenticationError } from "@/lib/supabase/auth";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherOwnerId = "22222222-2222-4222-8222-222222222222";
const importId = "33333333-3333-4333-8333-333333333333";

function shift(
  date: string,
  start: string,
  end: string,
  title = "Registrar on call",
  extra: Partial<OnCallShiftInput> = {},
) {
  const startsAt = perthWallToIso(date, start)!;
  let endsAt = perthWallToIso(date, end)!;
  if (Date.parse(endsAt) <= Date.parse(startsAt)) endsAt = new Date(Date.parse(endsAt) + 86_400_000).toISOString();
  return { startsAt, endsAt, title, location: null, sourceUid: null, ...extra } satisfies OnCallShiftInput;
}

describe("reading an .ics roster", () => {
  it("keeps times, title, site and ID, and drops descriptions and attendees", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:shift-1@example.test",
      "DTSTART;TZID=Australia/Perth:20261005T080000",
      "DTEND;TZID=Australia/Perth:20261005T170000",
      "SUMMARY:Registrar on call",
      "LOCATION:Example Hospital",
      "DESCRIPTION:Handover from Dr Example",
      "ATTENDEE;CN=Dr Example:mailto:someone@example.test",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const result = parseRosterIcs(text);
    expect(result.shifts).toEqual([
      {
        startsAt: "2026-10-05T00:00:00.000Z",
        endsAt: "2026-10-05T09:00:00.000Z",
        title: "Registrar on call",
        location: "Example Hospital",
        sourceUid: "shift-1@example.test",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("Dr Example");
    expect(JSON.stringify(result)).not.toContain("someone@example.test");
  });

  it("reads UTC times and folded lines, and skips all-day, cancelled and repeating events with a note", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20261006T130000Z",
      "DTEND:20261007T000000Z",
      "SUMMARY:Night",
      "  shift",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20261008",
      "SUMMARY:Leave",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "STATUS:CANCELLED",
      "DTSTART:20261009T000000Z",
      "DTEND:20261009T080000Z",
      "SUMMARY:Cancelled",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20261010T000000Z",
      "DTEND:20261010T080000Z",
      "RRULE:FREQ=WEEKLY",
      "SUMMARY:Clinic",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const result = parseRosterIcs(text);
    expect(result.shifts).toHaveLength(1);
    expect(result.shifts[0]).toMatchObject({ title: "Night shift", startsAt: "2026-10-06T13:00:00.000Z" });
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("reads a time with no zone as Perth time", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20261005T080000",
      "DTEND:20261005T170000",
      "SUMMARY:Day",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(parseRosterIcs(text).shifts[0]?.startsAt).toBe("2026-10-05T00:00:00.000Z");
  });
});

describe("reading a .csv roster", () => {
  it("reads named columns in either date style and rolls an overnight end to the next day", () => {
    const text = [
      "Date,Start,Finish,Role,Site",
      "2026-10-05,08:00,17:00,Registrar on call,Example Hospital",
      "06/10/2026,2100,0800,Night registrar,",
    ].join("\n");
    const result = parseRosterCsv(text);
    expect(result.shifts).toEqual([
      {
        startsAt: "2026-10-05T00:00:00.000Z",
        endsAt: "2026-10-05T09:00:00.000Z",
        title: "Registrar on call",
        location: "Example Hospital",
        sourceUid: null,
      },
      {
        startsAt: "2026-10-06T13:00:00.000Z",
        endsAt: "2026-10-07T00:00:00.000Z",
        title: "Night registrar",
        location: null,
        sourceUid: null,
      },
    ]);
  });

  it("reports rows it cannot read instead of guessing", () => {
    const result = parseRosterCsv(["date,start,end", "not a date,08:00,17:00", "2026-10-05,08:00,17:00"].join("\n"));
    expect(result.shifts).toHaveLength(1);
    expect(result.notes.join(" ")).toMatch(/1/);
  });
});

describe("what a new roster changes", () => {
  const window = { start: "2026-10-05", end: "2026-10-11" };

  it("counts added, moved and removed shifts, matching by calendar ID first", () => {
    const stored = [
      shift("2026-10-05", "08:00", "17:00", "Day", { sourceUid: "a" }),
      shift("2026-10-06", "08:00", "17:00", "Day"),
      shift("2026-10-07", "08:00", "17:00", "Day"),
    ];
    const incoming = [
      shift("2026-10-08", "08:00", "17:00", "Day", { sourceUid: "a" }),
      shift("2026-10-06", "08:00", "17:00", "Day"),
      shift("2026-10-09", "21:00", "08:00", "Night"),
    ];
    const diff = diffRoster(stored, incoming, window);
    expect(diff).toMatchObject({ added: 1, changed: 1, removed: 1 });
    expect(diff.changes.map((change) => change.kind)).toEqual(["removed", "moved", "added"]);
  });

  it("ignores stored shifts outside the new roster's dates", () => {
    const stored = [shift("2026-10-20", "08:00", "17:00")];
    expect(diffRoster(stored, [], window)).toMatchObject({ added: 0, changed: 0, removed: 0 });
  });

  it("gives the dates a roster covers", () => {
    expect(rosterWindow([shift("2026-10-07", "08:00", "17:00"), shift("2026-10-05", "21:00", "08:00")])).toEqual({
      start: "2026-10-05",
      end: "2026-10-07",
    });
    expect(rosterWindow([])).toBeNull();
  });
});

describe("the next shift", () => {
  const stored = (input: OnCallShiftInput, id: string): OnCallShift => ({ ...input, id });
  const now = new Date("2026-10-05T01:00:00.000Z"); // 09:00 Monday in Perth

  it("says a shift is on now, then counts down to one within twelve hours", () => {
    const onNow = describeNextShift([stored(shift("2026-10-05", "08:00", "17:00"), "1")], now);
    expect(onNow).toMatchObject({ onNow: true, when: "On now until 17:00" });
    const soon = describeNextShift([stored(shift("2026-10-05", "11:30", "17:00"), "1")], now);
    expect(soon?.when).toBe("Starts in 2 h 30 min");
  });

  it("names tomorrow and later days, and marks a shift that ends the next day", () => {
    const tomorrow = describeNextShift([stored(shift("2026-10-06", "21:00", "08:00"), "1")], now);
    expect(tomorrow?.when).toBe("Tomorrow at 21:00");
    expect(tomorrow?.hours).toBe("21:00 to 08:00 (next day)");
    const later = describeNextShift([stored(shift("2026-10-09", "08:00", "17:00"), "1")], now);
    expect(later?.when).toBe(`${formatPerthDay("2026-10-09")} at 08:00`);
    expect(shiftHours(shift("2026-10-09", "08:00", "17:00"))).toBe("08:00 to 17:00");
  });

  it("has nothing to say when every shift is over", () => {
    expect(describeNextShift([stored(shift("2026-10-04", "08:00", "17:00"), "1")], now)).toBeNull();
  });
});

describe("the save request", () => {
  it("refuses more shifts than one import may carry, and shifts that are too long", () => {
    const base = { format: "ics", windowStart: "2026-10-05", windowEnd: "2026-10-05" };
    const one = shift("2026-10-05", "08:00", "17:00");
    expect(onCallShiftImportRequestSchema.safeParse({ ...base, shifts: [one] }).success).toBe(true);
    const tooMany = Array.from({ length: ON_CALL_SHIFT_IMPORT_MAX + 1 }, () => one);
    expect(onCallShiftImportRequestSchema.safeParse({ ...base, shifts: tooMany }).success).toBe(false);
    const tooLong = { ...one, endsAt: new Date(Date.parse(one.startsAt) + 40 * 3_600_000).toISOString() };
    expect(onCallShiftImportRequestSchema.safeParse({ ...base, shifts: [tooLong] }).success).toBe(false);
  });
});

/**
 * A stand-in for the Supabase query builder that records every owner filter,
 * so a test can prove each query was scoped to the signed-in doctor.
 */
type Recorded = { table: string; op: string; eq: Array<[string, unknown]> };

function fakeSupabase(rows: Record<string, unknown[]>) {
  const calls: Recorded[] = [];
  mocks.from.mockImplementation((table: string) => {
    const call: Recorded = { table, op: "select", eq: [] };
    calls.push(call);
    const result = () => {
      const owner = call.eq.find(([column]) => column === "owner_id")?.[1];
      const data = (rows[table] ?? []).filter((row) => (row as { owner_id: string }).owner_id === owner);
      return { data, error: null };
    };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "gt", "gte", "lt", "order", "limit"]) builder[method] = () => builder;
    builder.update = () => ((call.op = "update"), builder);
    builder.delete = () => ((call.op = "delete"), builder);
    builder.eq = (column: string, value: unknown) => (call.eq.push([column, value]), builder);
    builder.maybeSingle = async () => ({ data: result().data[0] ?? null, error: null });
    builder.then = (resolve: (value: unknown) => unknown) => resolve(result());
    return builder;
  });
  return calls;
}

const future = "2099-01-01T00:00:00.000Z";
const futureEnd = "2099-01-01T08:00:00.000Z";
const storedRows = {
  on_call_shifts: [
    {
      id: "s1",
      owner_id: ownerId,
      starts_at: future,
      ends_at: futureEnd,
      title: "Mine",
      location: null,
      source_uid: null,
    },
    {
      id: "s2",
      owner_id: otherOwnerId,
      starts_at: future,
      ends_at: futureEnd,
      title: "Theirs",
      location: null,
      source_uid: null,
    },
  ],
  on_call_shift_imports: [],
};

function request(method: string, body?: unknown) {
  return new Request("https://psychiatry.tools/api/on-call/shifts", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.auth.mockResolvedValue({ id: ownerId });
  mocks.rpc.mockResolvedValue({ data: importId, error: null });
});

describe("the My shifts API", () => {
  it("returns only the signed-in doctor's shifts, with every query filtered by owner", async () => {
    const calls = fakeSupabase(storedRows);
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const payload = (await response.json()) as { shifts: Array<{ title: string }> };
    expect(payload.shifts.map((item) => item.title)).toEqual(["Mine"]);
    expect(JSON.stringify(payload)).not.toContain("Theirs");
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.eq).toContainEqual(["owner_id", ownerId]);
  });

  it("refuses a signed-out request", async () => {
    fakeSupabase(storedRows);
    mocks.auth.mockRejectedValue(new AuthenticationError("no session"));
    expect((await GET(request("GET"))).status).toBe(401);
    expect((await POST(request("POST", {}))).status).toBe(401);
    expect((await DELETE(request("DELETE"))).status).toBe(401);
  });

  it("saves through one database call for the signed-in owner, with the change list worked out on the server", async () => {
    fakeSupabase(storedRows);
    const body = {
      format: "csv",
      windowStart: "2026-10-05",
      windowEnd: "2026-10-05",
      shifts: [shift("2026-10-05", "08:00", "17:00")],
    };
    const response = await POST(request("POST", body));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [name, args] = mocks.rpc.mock.calls[0]!;
    expect(name).toBe("on_call_shifts_replace");
    expect(args).toMatchObject({ p_owner_id: ownerId, p_added: 1, p_changed: 0, p_removed: 0 });
  });

  it("refuses a body that names an owner, or a shift outside the roster's dates", async () => {
    fakeSupabase(storedRows);
    const shifts = [shift("2026-10-05", "08:00", "17:00")];
    const withOwner = {
      format: "csv",
      windowStart: "2026-10-05",
      windowEnd: "2026-10-05",
      shifts,
      ownerId: otherOwnerId,
    };
    expect((await POST(request("POST", withOwner))).status).toBe(400);
    const outside = { format: "csv", windowStart: "2026-10-06", windowEnd: "2026-10-07", shifts };
    expect((await POST(request("POST", outside))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("deletes only the signed-in owner's shifts and imports", async () => {
    const calls = fakeSupabase(storedRows);
    expect((await DELETE(request("DELETE"))).status).toBe(200);
    const deletes = calls.filter((call) => call.op === "delete");
    expect(deletes.map((call) => call.table).sort()).toEqual(["on_call_shift_imports", "on_call_shifts"]);
    for (const call of deletes) expect(call.eq).toContainEqual(["owner_id", ownerId]);
  });

  it("will not save or delete in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    expect((await POST(request("POST", {}))).status).toBe(400);
    expect((await DELETE(request("DELETE"))).status).toBe(400);
    const demo = (await (await GET(request("GET"))).json()) as { demoMode: boolean; shifts: unknown[] };
    expect(demo.demoMode).toBe(true);
    expect(demo.shifts.length).toBeGreaterThan(0);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("dismisses only the owner's own import, and 404s anyone else's", async () => {
    const calls = fakeSupabase({
      on_call_shift_imports: [{ id: importId, owner_id: otherOwnerId }],
    });
    const patch = (id: string) =>
      PATCH(new Request(`https://psychiatry.tools/api/on-call/shifts/imports/${id}`, { method: "PATCH" }), {
        params: Promise.resolve({ id }),
      });
    expect((await patch(importId)).status).toBe(404);
    expect(calls[0]?.eq).toContainEqual(["owner_id", ownerId]);
    expect((await patch("not-a-uuid")).status).toBe(404);
  });
});
