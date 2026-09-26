import { describe, expect, it } from "vitest";

import {
  CROSS_TENANT_CME_YEAR,
  probeCmeWriteIsolation,
  probeOnCallServiceWriteIsolation,
  type WriteProbeCreated,
  type WriteProbeRequest,
} from "../scripts/lib/cross-tenant-write-probe";

// Audit F17: the write probe is exercised against a fake API that isolates owners correctly,
// and against variants that each break one boundary the probe must catch.
type Leaks = {
  existingYear?: boolean;
  cmeList?: boolean;
  cmePatch?: boolean;
  cmeDelete?: boolean;
  nonMemberInvite?: boolean;
  memberEscalation?: boolean;
  revokeIgnored?: boolean;
  reusableInvite?: boolean;
};

const userId: Record<string, string> = {
  a: "00000000-0000-4000-8000-00000000000a",
  b: "00000000-0000-4000-8000-00000000000b",
};

function fakeApi(leaks: Leaks = {}): WriteProbeRequest {
  const years = new Set<string>(leaks.existingYear ? ["a"] : []);
  const entries = new Map<string, { owner: string; title: string; archivedAt: string | null; transcribed: boolean }>();
  const services = new Map<string, Map<string, string>>();
  const invites = new Map<string, { serviceId: string; role: string; used: boolean }>();
  let counter = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

  return async (token, path, init, expected) => {
    const method = init.method ?? "GET";
    const body = (init.body ?? {}) as Record<string, unknown>;
    const reply = (status: number, payload: unknown = {}) => {
      if (!expected.includes(status))
        throw new Error(`${method} ${path}: status ${status}, expected ${expected.join("/")}`);
      return payload;
    };

    if (path === `/api/cme/year?year=${CROSS_TENANT_CME_YEAR}`) {
      return reply(200, { requirementSet: years.has(token) ? { year: CROSS_TENANT_CME_YEAR } : null });
    }
    if (path === "/api/cme/year" && method === "PUT") {
      years.add(token);
      return reply(200, {});
    }
    if (path === "/api/cme/entries" && method === "POST") {
      const id = nextId();
      entries.set(id, { owner: token, title: String(body.title), archivedAt: null, transcribed: false });
      return reply(201, { entry: { id } });
    }
    if (path === `/api/cme/entries?year=${CROSS_TENANT_CME_YEAR}`) {
      const visible = [...entries].filter(([, e]) => leaks.cmeList || e.owner === token);
      return reply(200, { entries: visible.map(([id, e]) => ({ id, ...e })) });
    }
    const entry = path.match(/^\/api\/cme\/entries\/([^/?]+)$/);
    if (entry) {
      const row = entries.get(entry[1]!);
      if (!row) return reply(404);
      if (method === "PATCH") {
        if (row.owner !== token && !leaks.cmePatch) return reply(404);
        if (body.archived) row.archivedAt = "now";
        else if (body.transcribed) row.transcribed = true;
        else row.title = String(body.title);
        return reply(200, { entry: { id: entry[1] } });
      }
      if (method === "DELETE") {
        if (row.owner !== token && !leaks.cmeDelete) return reply(404);
        entries.delete(entry[1]!);
        return reply(200, { ok: true });
      }
    }

    if (path === "/api/on-call/services" && method === "POST") {
      const id = nextId();
      services.set(id, new Map([[userId[token]!, "admin"]]));
      return reply(200, { serviceId: id });
    }
    if (path === "/api/on-call/services/join") {
      const invite = invites.get(String(body.code));
      if (!invite || (invite.used && !leaks.reusableInvite)) return reply(400);
      invite.used = true;
      services.get(invite.serviceId)!.set(userId[token]!, invite.role);
      return reply(200, { serviceId: invite.serviceId });
    }
    const service = path.match(/^\/api\/on-call\/services\/([^/?]+)$/);
    if (service) {
      const members = services.get(service[1]!);
      const role = members?.get(userId[token]!);
      if (method === "GET") return role ? reply(200, { service: { id: service[1] } }) : reply(403);
      const action = String(body.action);
      if (!role && !(leaks.nonMemberInvite && action === "invitation.create")) return reply(403);
      if (role !== "admin" && !(leaks.memberEscalation && action === "member.update")) {
        if (!(leaks.nonMemberInvite && action === "invitation.create")) return reply(403);
      }
      if (action === "invitation.create") {
        const code = `${nextId()}`;
        invites.set(code, { serviceId: service[1]!, role: String(body.role), used: false });
        return reply(200, { invitationId: nextId(), code });
      }
      if (action === "member.update") {
        members!.set(String(body.memberId), String(body.role));
        return reply(200, { ok: true });
      }
      if (action === "member.revoke") {
        if (!leaks.revokeIgnored) members!.delete(String(body.memberId));
        return reply(200, { ok: true });
      }
      return reply(200, { siteId: nextId() });
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
}

async function runBoth(leaks: Leaks = {}) {
  const request = fakeApi(leaks);
  const created: WriteProbeCreated[] = [];
  const register = (record: WriteProbeCreated) => created.push(record);
  const cme = await probeCmeWriteIsolation({ request, tokenA: "a", tokenB: "b", marker: "probe-marker", register });
  const onCall = await probeOnCallServiceWriteIsolation({
    request,
    tokenA: "a",
    tokenB: "b",
    userIdB: userId.b!,
    marker: "probe-marker",
    register,
  });
  return { cme, onCall, created };
}

describe("CME and On Call cross-tenant write probe", () => {
  it("passes against an API that isolates owners, and registers every record it creates", async () => {
    const { cme, onCall, created } = await runBoth();
    expect(cme).toEqual({ checkpoints: ["cme-write-isolation"], skipped: [] });
    expect(onCall.checkpoints).toEqual([
      "on-call-service-write-isolation",
      "on-call-invitation-membership",
      "on-call-revocation",
    ]);
    expect(created.map((record) => record.kind)).toEqual(["cme-year", "cme-entry", "on-call-service"]);
  });

  it("never creates or registers a CME year when user A already has one, and says so", async () => {
    const { cme, created } = await runBoth({ existingYear: true });
    expect(cme.checkpoints).toEqual([]);
    expect(cme.skipped[0]).toMatch(/already has a 2000 CPD year/);
    expect(created.map((record) => record.kind)).toEqual(["on-call-service"]);
  });

  it.each([
    ["a CME list that shows another owner's entries", { cmeList: true }, /User B listed user A's CME entry/],
    ["a cross-owner CME edit that is accepted", { cmePatch: true }, /PATCH \/api\/cme\/entries\/.*expected 404/],
    ["a cross-owner CME delete that is accepted", { cmeDelete: true }, /DELETE \/api\/cme\/entries\/.*expected 404/],
    ["a non-member minting an invitation", { nonMemberInvite: true }, /status 200, expected 403\/404/],
    ["a plain member promoting themself", { memberEscalation: true }, /status 200, expected 403$/],
    ["a revocation that leaves access in place", { revokeIgnored: true }, /GET .*status 200, expected 403\/404/],
    ["an invitation that can be used twice", { reusableInvite: true }, /join: status 200, expected 400/],
  ] satisfies [string, Leaks, RegExp][])("fails on %s", async (_label, leaks, message) => {
    await expect(runBoth(leaks)).rejects.toThrow(message);
  });
});
