import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

import { createAdminClient } from "@/lib/supabase/admin";
import type { TeachingServiceAction } from "@/lib/teaching/model";
import {
  fetchTeachingUnloggedCount,
  readSession,
  readWeek,
  teachingCommand,
  teachingErrors,
  teachingServiceMutation,
} from "@/lib/teaching/repository";

const actor = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const occurrenceId = "33333333-3333-4333-8333-333333333333";
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const detail = {
  occurrenceId,
  serviceId,
  title: "Invented journal club",
  startsAt: "2026-09-30T04:30:00+00:00",
  endsAt: "2026-09-30T05:30:00+00:00",
  venue: "Invented room",
  hasJoinLink: true,
  status: "scheduled",
  isPresenter: false,
  source: "teaching",
  joinUrl: "https://example.org/join",
  presenterName: null,
  materials: [],
  changeReason: null,
  canShowCode: false,
  counts: null,
};

/**
 * Fails closed when the migration is absent. `TEACHING_MIGRATION_SQL` points a local run at the
 * migration file before the database PR has merged; it is never needed once it has.
 */
function teachingMigration(): string {
  const file = readdirSync("supabase/migrations").find((name) => name.endsWith("_teaching_mode.sql"));
  if (file) return readFileSync(`supabase/migrations/${file}`, "utf8");
  const local = process.env.TEACHING_MIGRATION_SQL;
  if (local) return readFileSync(local, "utf8");
  throw new Error("The Teaching migration (<stamp>_teaching_mode.sql) must be on this branch before PR A.");
}

beforeEach(() => rpc.mockReset());

describe("the Teaching command boundary", () => {
  it("passes only the session actor to the central function, with the action name kept out of the payload", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await teachingServiceMutation(createAdminClient(), actor, serviceId, {
      action: "notice.read",
      noticeId: occurrenceId,
    });
    expect(rpc).toHaveBeenCalledWith("teaching_command", {
      p_actor_id: actor,
      p_service_id: serviceId,
      p_action: "notice.read",
      p_payload: { noticeId: occurrenceId },
    });
  });

  it("refuses a missing actor before any database call", async () => {
    await expect(teachingCommand(createAdminClient(), "", serviceId, "session.read")).rejects.toMatchObject({
      status: 401,
      details: { code: "teaching_auth_required" },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["teaching_access_denied", 403],
    ["teaching_role_denied", 403],
    ["teaching_team_unverified", 403],
    ["teaching_not_found", 404],
    ["teaching_code_expired", 410],
    ["teaching_code_invalid", 400],
    ["teaching_code_other_team", 403],
    ["teaching_window_closed", 409],
    ["teaching_link_expired", 410],
    ["teaching_not_attended", 409],
    ["cme_year_missing", 409],
    ["cme_year_closed", 409],
    ["teaching_limit", 409],
  ])("maps %s to %i with a plain message", async (code, status) => {
    rpc.mockResolvedValue({ data: null, error: { message: code } });
    await expect(teachingCommand(createAdminClient(), actor, serviceId, "session.read")).rejects.toMatchObject({
      status,
      message: teachingErrors[code].message,
      details: { code },
    });
  });

  it("says the code changed when a scanned code has expired", () => {
    expect(teachingErrors.teaching_code_expired.message).toBe("The code changed. Scan the screen again.");
  });

  // Review focus 5: the app can be live before its database change is.
  it.each(["PGRST202", "42883", "42P01"])(
    "says Teaching is being set up when the database answers %s",
    async (code) => {
      rpc.mockResolvedValue({ data: null, error: { message: "Could not find the function", code } });
      await expect(teachingCommand(createAdminClient(), actor, null, "week.read")).rejects.toMatchObject({
        status: 503,
        message: "Teaching is being set up. Try again later.",
        details: { code: "teaching_setup_pending" },
      });
    },
  );

  it("never passes database error text to the browser", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'relation "teaching_secret_table" is broken', code: "XX000" },
    });
    const failure = teachingCommand(createAdminClient(), actor, serviceId, "session.read");
    await expect(failure).rejects.toMatchObject({ status: 503, details: { code: "teaching_unavailable" } });
    await expect(failure).rejects.not.toMatchObject({ message: expect.stringContaining("relation") });
  });

  it("drops fields the database should never have returned", async () => {
    rpc.mockResolvedValue({ data: { ...detail, checkin_secret: "\\x0102", checkinSecret: "leak" }, error: null });
    const session = await readSession(createAdminClient(), actor, serviceId, occurrenceId);
    expect(JSON.stringify(session)).not.toContain("leak");
    expect(session).not.toHaveProperty("checkin_secret");
  });

  it("fails closed, without the data, when a result is missing a field", async () => {
    rpc.mockResolvedValue({ data: { teams: [], sessions: [] }, error: null });
    await expect(readWeek(createAdminClient(), actor, { from: "2026-09-28", to: "2026-10-04" })).rejects.toMatchObject({
      status: 503,
      details: { code: "teaching_unavailable" },
    });
  });

  it("reads a week across teams with no team named", async () => {
    rpc.mockResolvedValue({ data: { teams: [], sessions: [], notices: [], attendance: [] }, error: null });
    await readWeek(createAdminClient(), actor, { from: "2026-09-28", to: "2026-10-04" });
    expect(rpc).toHaveBeenCalledWith("teaching_command", {
      p_actor_id: actor,
      p_service_id: null,
      p_action: "week.read",
      p_payload: { from: "2026-09-28", to: "2026-10-04" },
    });
  });

  it("returns only a count of sessions not yet logged to CPD", async () => {
    rpc.mockResolvedValue({ data: { count: 2, titles: ["Invented journal club"] }, error: null });
    await expect(fetchTeachingUnloggedCount(createAdminClient(), actor)).resolves.toBe(2);
    expect(rpc).toHaveBeenCalledWith("teaching_command", {
      p_actor_id: actor,
      p_service_id: null,
      p_action: "cpd.unlogged",
      p_payload: {},
    });
  });
});

const seriesSave: TeachingServiceAction = {
  action: "series.save",
  title: "Demo journal club",
  kind: "journal",
  groupIds: [],
  repeat: "weekly",
  firstDate: "2026-10-07",
  startTime: "12:30",
  minutes: 60,
  venue: null,
  joinUrl: null,
  skipDates: [],
  endDate: "2026-12-16",
  presenterId: null,
  materials: [],
};
const groupSave: TeachingServiceAction = { action: "group.save", name: "Demo interns" };

describe("organiser saves (master plan R6)", () => {
  it("returns the saved series and how many sessions it made", async () => {
    rpc.mockResolvedValue({ data: { seriesId: occurrenceId, occurrences: 12, extra: "dropped" }, error: null });
    const result = await teachingServiceMutation(createAdminClient(), actor, serviceId, seriesSave);
    expect(result).toEqual({ seriesId: occurrenceId, occurrences: 12 });
    expect(rpc.mock.calls[0][1].p_payload).not.toHaveProperty("action");
  });

  it("returns the saved group's id", async () => {
    rpc.mockResolvedValue({ data: { groupId: occurrenceId }, error: null });
    await expect(teachingServiceMutation(createAdminClient(), actor, serviceId, groupSave)).resolves.toEqual({
      groupId: occurrenceId,
    });
  });

  it.each([
    ["series.save", seriesSave, { seriesId: occurrenceId }],
    ["group.save", groupSave, { groupId: "not-a-uuid" }],
  ])("fails closed when %s answers in the wrong shape", async (_action, input, data) => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(teachingServiceMutation(createAdminClient(), actor, serviceId, input)).rejects.toMatchObject({
      status: 503,
      details: { code: "teaching_unavailable" },
    });
  });
});

describe("the words a doctor sees (master plan R18)", () => {
  it('says "service", never "team"', () => {
    for (const { message } of Object.values(teachingErrors)) expect(message).not.toMatch(/\bteams?\b/i);
  });
});

describe("secrets made on the server", () => {
  it("returns an invitation code once and sends the database only its hash", async () => {
    rpc.mockResolvedValue({ data: { invitationId: occurrenceId, expiresAt: "2026-10-07T00:00:00Z" }, error: null });
    const result = (await teachingServiceMutation(createAdminClient(), actor, serviceId, {
      action: "invitation.create",
      email: "doctor@example.org",
    })) as { code: string };
    const sent = rpc.mock.calls[0][1].p_payload;
    expect(result.code).toMatch(/^[0-9a-f]{64}$/);
    expect(sent).toEqual({ email: "doctor@example.org", tokenHash: sha256(result.code) });
    expect(JSON.stringify(sent)).not.toContain(result.code);
  });

  it("returns a display link's path once and sends the database only its hash", async () => {
    rpc.mockResolvedValue({ data: { expiresAt: "2026-09-30T05:45:00Z" }, error: null });
    const result = (await teachingServiceMutation(createAdminClient(), actor, serviceId, {
      action: "display.create",
      occurrenceId,
      stream: "room",
    })) as { path: string; expiresAt: string };
    const secret = result.path.replace("/teaching/display/", "");
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(rpc.mock.calls[0][1].p_payload).toEqual({ occurrenceId, stream: "room", linkHash: sha256(secret) });
  });

  it("revokes a display link by hash, never by the link itself", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    const token = "e".repeat(64);
    await teachingServiceMutation(createAdminClient(), actor, serviceId, { action: "display.revoke", token });
    expect(rpc.mock.calls[0][1].p_payload).toEqual({ linkHash: sha256(token) });
  });
});

describe("the Teaching migration and this map agree", () => {
  it("maps every error code the migration raises", () => {
    const raised = new Set(
      [...teachingMigration().matchAll(/raise exception '((?:teaching|cme)_[a-z_]+)'/g)].map((m) => m[1]),
    );
    expect(raised.size).toBeGreaterThan(5);
    expect([...raised].filter((code) => !teachingErrors[code])).toEqual([]);
  });
});
