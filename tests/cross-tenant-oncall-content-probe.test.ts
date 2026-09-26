import { describe, expect, it } from "vitest";

import { serviceActionSchema, serviceJoinSchema, serviceQuerySchema } from "@/lib/on-call/service-model";
import { probeOnCallContentIsolation } from "../scripts/lib/cross-tenant-oncall-content-probe";
import type { WriteProbeRequest } from "../scripts/lib/cross-tenant-write-probe";

// Audit F17 follow-up: the On Call content probe runs against a fake API that follows
// `on_call_service_command` (supabase/migrations/20260922174716_on_call_service_handbooks.sql),
// and against variants that each break one boundary the probe must catch. Every request body and
// query is parsed with the route's real Zod schema, so a probe payload the live route would
// reject with 400 fails here too.
type ContentAction =
  "entry.save" | "entry.review" | "entry.withdraw" | "report.create" | "report.resolve" | "orientation.set";
type Leaks = {
  /** A non-member's request for this action (or the read) is accepted. */
  outsiderAllowed?: ContentAction | "read";
  /** A non-member's write for this action is refused with 403 but applied anyway. */
  outsiderSilent?: ContentAction;
  /** A plain member's request for this editor-only action is accepted. */
  memberAllowed?: ContentAction;
  /** A plain member's write for this editor-only action is refused with 403 but applied anyway. */
  memberSilent?: ContentAction;
  reportsToMembers?: boolean;
  memberReportsDenied?: boolean;
  publishedHidden?: boolean;
  orientationShared?: boolean;
  orientationClearAll?: boolean;
  revokeIgnored?: boolean;
};

const userId: Record<string, string> = {
  a: "00000000-0000-4000-8000-00000000000a",
  b: "00000000-0000-4000-8000-00000000000b",
};
const serviceId = "00000000-0000-4000-8000-0000000000f1";
const siteId = "00000000-0000-4000-8000-0000000000f2";

type Content = { title: string; siteId: string | null; section: string; kind: string };
type Entry = {
  revision: number;
  content: Content;
  publishedContent: Content | null;
  status: string;
};

function fakeApi(leaks: Leaks = {}) {
  const members = new Map<string, string>([[userId.a!, "admin"]]);
  const entries = new Map<string, Entry>();
  const reports = new Map<string, { entryId: string; status: string }>();
  const orientation: { user: string; entryId: string; siteId: string; rotation: string }[] = [];
  const invites = new Map<string, { role: string; used: boolean }>();
  const calls: Record<string, number> = {};
  let counter = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

  // Performs an action once authorization has been decided, following the RPC's writes.
  const apply = (actor: string, input: Record<string, unknown>): unknown => {
    const action = String(input.action);
    const entry = entries.get(String(input.entryId));
    if (action === "entry.save") {
      const { title, siteId: site, section, kind } = input as unknown as Content;
      const content = { title, siteId: site, section, kind };
      const status = input.publish ? (kind === "operational" ? "published" : "pending_review") : "draft";
      const id = entry ? String(input.entryId) : nextId();
      const revision = entry ? entry.revision + 1 : 1;
      entries.set(id, {
        revision,
        content,
        status,
        publishedContent: status === "published" ? content : (entry?.publishedContent ?? null),
      });
      return { entryId: id, revision, status };
    }
    if (action === "entry.review" && entry) {
      entry.revision += 1;
      return { ok: true };
    }
    if (action === "entry.withdraw" && entry) {
      Object.assign(entry, { status: "withdrawn", revision: entry.revision + 1, publishedContent: null });
      return { ok: true };
    }
    if (action === "report.create") {
      const id = nextId();
      reports.set(id, { entryId: String(input.entryId), status: "open" });
      return { reportId: id };
    }
    if (action === "report.resolve") {
      const report = reports.get(String(input.reportId));
      if (report) report.status = "resolved";
      return { ok: true };
    }
    if (action === "orientation.set") {
      const row = {
        user: actor,
        entryId: String(input.entryId),
        siteId: String(input.siteId),
        rotation: String(input.rotation),
      };
      const matches = (other: typeof row) =>
        (leaks.orientationClearAll || other.user === row.user) &&
        other.entryId === row.entryId &&
        other.siteId === row.siteId &&
        other.rotation === row.rotation;
      for (let i = orientation.length - 1; i >= 0; i--) if (matches(orientation[i]!)) orientation.splice(i, 1);
      if (input.completed) orientation.push(row);
      return { ok: true };
    }
    if (action === "invitation.create") {
      const code = nextId().replace(/-/g, "").padEnd(64, "0");
      invites.set(code, { role: String(input.role), used: false });
      return { invitationId: nextId(), expiresAt: "2026-09-27T00:00:00Z", code };
    }
    if (action === "member.revoke") {
      if (!leaks.revokeIgnored) members.delete(String(input.memberId));
      return { ok: true };
    }
    throw new Error(`fake API cannot apply ${action}`);
  };

  const readFor = (actor: string, role: string, query: { siteId?: string; rotation?: string }) => {
    const canDraft = role !== "member";
    const visible = [...entries].filter(
      ([, e]) => (canDraft || e.publishedContent) && !(leaks.publishedHidden && !canDraft),
    );
    return {
      service: { id: serviceId, name: "Tenancy probe" },
      membership: { role, clinicalReviewer: false },
      sites: [{ id: siteId, name: "Tenancy probe site" }],
      entries: visible.map(([id, e]) => ({
        id,
        revision: e.revision,
        content: canDraft ? e.content : e.publishedContent,
        publishedContent: e.publishedContent,
        status: canDraft ? e.status : "published",
      })),
      members: [],
      invitations: [],
      reports: role !== "member" || leaks.reportsToMembers ? [...reports].map(([id, r]) => ({ id, ...r })) : [],
      orientation: orientation
        .filter((o) => (leaks.orientationShared || o.user === actor) && o.siteId === query.siteId)
        .filter((o) => o.rotation === query.rotation)
        .map(({ entryId, siteId: site, rotation }) => ({ entryId, siteId: site, rotation, revision: 1 })),
    };
  };

  const request: WriteProbeRequest = async (token, path, init, expected) => {
    const method = init.method ?? "GET";
    const actor = userId[token]!;
    calls[token] = (calls[token] ?? 0) + 1;
    const body = (init.body ?? {}) as Record<string, unknown>;
    const label = `${method} ${path}${typeof body.action === "string" ? ` ${body.action}` : ""}`;
    const reply = (status: number, payload: unknown = {}) => {
      if (!expected.includes(status)) throw new Error(`${label}: status ${status}, expected ${expected.join("/")}`);
      return payload;
    };

    if (path === "/api/on-call/services/join" && method === "POST") {
      const parsed = serviceJoinSchema.safeParse(body);
      if (!parsed.success) return reply(400);
      const invite = invites.get(parsed.data.code);
      if (!invite || invite.used) return reply(400);
      if (members.has(actor)) return reply(409);
      invite.used = true;
      members.set(actor, invite.role);
      return reply(200, { serviceId });
    }
    const [route, search = ""] = path.split("?");
    if (route !== `/api/on-call/services/${serviceId}`) throw new Error(`unexpected ${method} ${path}`);
    const role = members.get(actor);

    if (method === "GET") {
      const query = serviceQuerySchema.safeParse(Object.fromEntries(new URLSearchParams(search)));
      if (!query.success) return reply(400);
      if (!role && leaks.outsiderAllowed !== "read") return reply(403);
      return reply(200, readFor(actor, role ?? "member", query.data));
    }

    const parsed = serviceActionSchema.safeParse(body);
    if (!parsed.success) return reply(400);
    const input = parsed.data as unknown as Record<string, unknown>;
    const action = parsed.data.action;
    const refuse = (allowed: string | undefined, silent: string | undefined) => {
      if (allowed === action) return reply(200, apply(actor, input));
      if (silent === action) apply(actor, input);
      return reply(403);
    };
    if (!role) return refuse(leaks.outsiderAllowed, leaks.outsiderSilent);
    const adminOnly = ["site.create", "invitation.create", "invitation.revoke", "member.update", "member.revoke"];
    const editorOnly = ["entry.save", "entry.withdraw", "report.resolve"];
    // entry.review needs a clinical reviewer who is not the author; nobody here is a reviewer.
    if (
      (adminOnly.includes(action) && role !== "admin") ||
      (editorOnly.includes(action) && role === "member") ||
      action === "entry.review"
    ) {
      return refuse(leaks.memberAllowed, leaks.memberSilent);
    }
    if (action === "report.create" && role === "member" && leaks.memberReportsDenied) return reply(403);
    return reply(200, apply(actor, input));
  };
  return { request, calls };
}

async function runProbe(leaks: Leaks = {}) {
  const { request, calls } = fakeApi(leaks);
  const result = await probeOnCallContentIsolation({
    request,
    tokenA: "a",
    tokenB: "b",
    userIdB: userId.b!,
    serviceId,
    siteId,
    marker: "probe-marker",
  });
  return { result, calls };
}

describe("On Call cross-tenant content probe", () => {
  it("passes against an API that isolates content, with every payload valid for the real route", async () => {
    const { result, calls } = await runProbe();
    expect(result.checkpoints).toEqual([
      "on-call-content-write-isolation",
      "on-call-member-content-roles",
      "on-call-reports-visibility",
      "on-call-orientation-isolation",
      "on-call-content-revocation",
    ]);
    // The on_call rate-limit bucket allows 60 requests a minute per user, and the service write
    // probe spends part of that budget in the same harness run.
    expect(calls.a).toBeLessThan(30);
    expect(calls.b).toBeLessThan(40);
  });

  it.each([
    [
      "a non-member creating an entry",
      { outsiderAllowed: "entry.save" },
      /entry\.save: status 200, expected 403\/404$/,
    ],
    [
      "a non-member reviewing an entry",
      { outsiderAllowed: "entry.review" },
      /entry\.review: status 200, expected 403\/404$/,
    ],
    [
      "a non-member withdrawing an entry",
      { outsiderAllowed: "entry.withdraw" },
      /entry\.withdraw: status 200, expected 403\/404$/,
    ],
    [
      "a non-member filing a report",
      { outsiderAllowed: "report.create" },
      /report\.create: status 200, expected 403\/404$/,
    ],
    [
      "a non-member resolving a report",
      { outsiderAllowed: "report.resolve" },
      /report\.resolve: status 200, expected 403\/404$/,
    ],
    [
      "a non-member ticking orientation",
      { outsiderAllowed: "orientation.set" },
      /orientation\.set: status 200, expected 403\/404$/,
    ],
    [
      "a non-member reading the service",
      { outsiderAllowed: "read" },
      /^GET .*\?siteId=.*status 200, expected 403\/404$/,
    ],
    [
      "a refused non-member entry that is saved anyway",
      { outsiderSilent: "entry.save" },
      /does not hold exactly its one probe entry/,
    ],
    ["a refused non-member withdraw that still applies", { outsiderSilent: "entry.withdraw" }, /probe entry changed/],
    ["a refused non-member review that still applies", { outsiderSilent: "entry.review" }, /probe entry changed/],
    [
      "a refused non-member report that is filed anyway",
      { outsiderSilent: "report.create" },
      /refused report writes changed user A's report queue/,
    ],
    [
      "a refused non-member resolve that still applies",
      { outsiderSilent: "report.resolve" },
      /refused report writes changed user A's report queue/,
    ],
    [
      "a refused non-member orientation tick that is recorded",
      { outsiderSilent: "orientation.set" },
      /refused orientation write as a non-member was recorded/,
    ],
    ["a member saving entries", { memberAllowed: "entry.save" }, /entry\.save: status 200, expected 403$/],
    ["a member reviewing entries", { memberAllowed: "entry.review" }, /entry\.review: status 200, expected 403$/],
    ["a member withdrawing entries", { memberAllowed: "entry.withdraw" }, /entry\.withdraw: status 200, expected 403$/],
    ["a member resolving reports", { memberAllowed: "report.resolve" }, /report\.resolve: status 200, expected 403$/],
    [
      "a refused member entry that is saved anyway",
      { memberSilent: "entry.save" },
      /does not hold exactly its one probe entry/,
    ],
    ["a refused member withdraw that still applies", { memberSilent: "entry.withdraw" }, /probe entry changed/],
    [
      "a refused member resolve that still applies",
      { memberSilent: "report.resolve" },
      /refused resolve changed a report/,
    ],
    ["a report queue shown to plain members", { reportsToMembers: true }, /was shown the service's report queue/],
    ["members unable to report content", { memberReportsDenied: true }, /report\.create: status 403, expected 200$/],
    ["published content hidden from members", { publishedHidden: true }, /could not read user A's published entry/],
    ["orientation progress shared across users", { orientationShared: true }, /User A was shown user B's orientation/],
    ["a member's orientation clear wiping other users", { orientationClearAll: true }, /cleared user A's/],
    ["a revocation that leaves content access in place", { revokeIgnored: true }, /^GET .*status 200, expected 403$/],
  ] satisfies [string, Leaks, RegExp][])("fails on %s", async (_label, leaks, message) => {
    await expect(runProbe(leaks)).rejects.toThrow(message);
  });
});
