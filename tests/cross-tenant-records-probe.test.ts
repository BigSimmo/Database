import { describe, expect, it } from "vitest";

import { probeCmeAndOnCallIsolation, type ProbeRequest } from "../scripts/lib/cross-tenant-records-probe";

// Audit F17: the two-user staging harness covered documents, search and answers but not CME or
// On Call. The probe is read-only and is exercised here against fake servers: one that isolates
// owners correctly and several that leak in the ways the probe must catch.
type World = {
  cme: Record<string, string[]>;
  evidence: Record<string, { owner: string }[]>;
  services: Record<string, string[]>;
  leakEvidence?: boolean;
  leakServiceDetail?: boolean;
  leakCmeList?: boolean;
};

function server(world: World): ProbeRequest {
  return async (token, path, expected) => {
    const respond = (status: number, body: unknown) => {
      if (!expected.includes(status)) throw new Error(`${path}: status ${status}, expected ${expected.join("/")}`);
      return body;
    };
    if (path === "/api/cme/entries") {
      const own = world.cme[token] ?? [];
      const leaked = world.leakCmeList ? Object.values(world.cme).flat() : own;
      return respond(200, { entries: leaked.map((id) => ({ id })) });
    }
    const evidence = path.match(/^\/api\/cme\/entries\/([^/]+)\/evidence$/);
    if (evidence) {
      const rows = world.evidence[evidence[1]!] ?? [];
      return respond(200, { evidence: world.leakEvidence ? rows : rows.filter((row) => row.owner === token) });
    }
    if (path === "/api/on-call/services") {
      return respond(200, { services: (world.services[token] ?? []).map((id) => ({ id })) });
    }
    const service = path.match(/^\/api\/on-call\/services\/([^/?]+)$/);
    if (service) {
      const member = (world.services[token] ?? []).includes(service[1]!);
      return member || world.leakServiceDetail ? respond(200, { service: { id: service[1] } }) : respond(403, {});
    }
    throw new Error(`unexpected path ${path}`);
  };
}

const base: World = {
  cme: { a: ["cme-a1", "cme-a2"], b: ["cme-b1"] },
  evidence: { "cme-a1": [{ owner: "a" }] },
  services: { a: ["svc-shared", "svc-a"], b: ["svc-shared"] },
};

describe("CME and On Call cross-tenant probe", () => {
  it("passes against a server that isolates owners, and records what it exercised", async () => {
    const result = await probeCmeAndOnCallIsolation({ request: server(base), tokenA: "a", tokenB: "b" });
    expect(result.checkpoints).toEqual(["cme-list", "cme-evidence", "on-call-service-detail"]);
    expect(result.skipped).toEqual([]);
  });

  it.each([
    ["a CME list that returns another owner's entries", { leakCmeList: true }, /listed user A's CME entry/],
    ["evidence readable across owners", { leakEvidence: true }, /read evidence on user A's CME entry/],
    ["a service readable by a non-member", { leakServiceDetail: true }, /status 200/],
  ])("fails on %s", async (_label, leak, message) => {
    await expect(
      probeCmeAndOnCallIsolation({ request: server({ ...base, ...leak }), tokenA: "a", tokenB: "b" }),
    ).rejects.toThrow(message);
  });

  it("reports, rather than silently passes, when user A has nothing to probe", async () => {
    const result = await probeCmeAndOnCallIsolation({
      request: server({ cme: {}, evidence: {}, services: { a: ["svc-shared"], b: ["svc-shared"] } }),
      tokenA: "a",
      tokenB: "b",
    });
    expect(result.checkpoints).toEqual([]);
    expect(result.skipped.join(" ")).toContain("user A has no CME entries");
    expect(result.skipped.join(" ")).toContain("no On Call service that user B is not a member of");
  });
});
