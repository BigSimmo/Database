import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import ts from "typescript";

import {
  runSiteContentSync,
  type SiteContentSyncPlan,
  type SiteContentSyncPlanItem,
} from "@/lib/site-content/site-content-sync";
import {
  hasServiceRoleAuthorization,
  withServiceRoleAuthorization,
} from "../supabase/functions/site-content-sync/auth";

function tokenForRole(role: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.offline-signature`;
}

function plan(): SiteContentSyncPlan {
  return {
    version: "site-content-sync-plan-v1",
    releaseId: "11111111-1111-5111-8111-111111111111",
    planDigest: "a".repeat(64),
    releaseDigest: "b".repeat(64),
    dynamicStateDigest: "c".repeat(64),
    targetChangeEpoch: "4",
    generationId: "generation-4",
    registryVersion: "site-content-registry-v1",
    staticManifestDigest: "d".repeat(64),
    reconciliationPlanDigest: null,
    embedding: { model: "model", dimensions: 2, fingerprint: "model-v1" },
    added: [{ logicalId: "medications:added", normalizedText: "Added", reuseEmbedding: false }],
    changed: [
      { logicalId: "medications:changed", normalizedText: "Changed", reuseEmbedding: false },
      { logicalId: "medications:metadata", normalizedText: "Same", reuseEmbedding: true, embedding: [0.1, 0.2] },
    ],
    unchanged: [
      { logicalId: "medications:unchanged", normalizedText: "Same", reuseEmbedding: true, embedding: [0.5, 0.6] },
    ],
    tombstones: [{ logicalId: "medications:retired", normalizedText: "", reuseEmbedding: false, tombstone: true }],
    counts: { added: 1, changed: 2, unchanged: 1, tombstones: 1, total: 5 },
  };
}

async function loadRecordInvocation() {
  const source = readFileSync("supabase/functions/site-content-sync/index.ts", "utf8");
  const start = source.indexOf("async function recordInvocation(");
  const end = source.indexOf("\n}\n", start) + 2;
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const moduleSource = `${source.slice(start, end)}\nexport { recordInvocation };`;
  const compiled = ts.transpileModule(moduleSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`) as Promise<{
    recordInvocation: (
      supabase: { rpc: ReturnType<typeof vi.fn> },
      workerId: string,
      invocationId: string,
      phase: string,
      outcome: string,
    ) => Promise<boolean>;
  }>;
}

describe("site-content synchronization worker", () => {
  it("admits only a gateway-verified service-role JWT before any downstream worker work", async () => {
    expect(hasServiceRoleAuthorization(null)).toBe(false);
    expect(hasServiceRoleAuthorization(`Bearer ${tokenForRole("anon")}`)).toBe(false);
    expect(hasServiceRoleAuthorization(`Bearer ${tokenForRole("authenticated")}`)).toBe(false);
    expect(hasServiceRoleAuthorization(`Bearer ${tokenForRole("service_role")}`)).toBe(true);

    for (const authorization of [null, `Bearer ${tokenForRole("anon")}`, `Bearer ${tokenForRole("authenticated")}`]) {
      const downstream = vi.fn(() => Response.json({ ok: true }));
      const response = await withServiceRoleAuthorization(authorization, downstream);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ ok: false, error: "Unauthorized" });
      expect(downstream).not.toHaveBeenCalled();
    }

    const downstream = vi.fn(() => Response.json({ ok: true }));
    const response = await withServiceRoleAuthorization(`Bearer ${tokenForRole("service_role")}`, downstream);
    expect(response.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it("records one admitted invocation and one fixed terminal outcome around the existing one-event worker", () => {
    const source = readFileSync("supabase/functions/site-content-sync/index.ts", "utf8");
    expect(source).toContain("record_site_content_sync_worker_invocation");
    expect(source).toContain("p_phase: phase");
    expect(source).toContain('recordInvocation(supabase, workerId, invocationId, "started", null)');
    expect(source).toContain(
      'const terminalPhase = counts.failed > 0 || counts.leaseLost > 0 ? "failed" : "succeeded"',
    );
    for (const outcome of ["idle", "ready", "claim_failed", "event_failed", "lease_lost", "worker_failed"]) {
      expect(source).toContain(`| "${outcome}"`);
    }
    expect(source).toContain("crypto.randomUUID()");
  });

  it("makes one terminal RPC attempt and returns the fixed failure when transport throws", async () => {
    const { recordInvocation } = await loadRecordInvocation();
    const rpc = vi.fn(async () => {
      throw new Error("ambiguous transport result");
    });

    const response = await (async () => {
      const terminalRecorded = await recordInvocation(
        { rpc },
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "failed",
        "worker_failed",
      );
      if (!terminalRecorded) {
        return Response.json({ ok: false, error: "SITE_CONTENT_WORKER_FAILED" }, { status: 500 });
      }
      return Response.json({ ok: true });
    })();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "SITE_CONTENT_WORKER_FAILED" });
  });

  it("keeps the automatic Edge executor JWT-protected, bounded, fenced, and changed-only", () => {
    const source = readFileSync("supabase/functions/site-content-sync/index.ts", "utf8");
    const config = readFileSync("supabase/config.toml", "utf8");
    const handler = source.slice(source.indexOf("Deno.serve(async (request: Request) =>"));
    expect(config).toMatch(/\[functions\.site-content-sync\]\s+verify_jwt = true/);
    expect(handler.indexOf('withServiceRoleAuthorization(request.headers.get("authorization")')).toBeGreaterThanOrEqual(
      0,
    );
    expect(handler.indexOf('withServiceRoleAuthorization(request.headers.get("authorization")')).toBeLessThan(
      handler.indexOf('requiredEnvironment("SUPABASE_URL")'),
    );
    expect(handler.indexOf('withServiceRoleAuthorization(request.headers.get("authorization")')).toBeLessThan(
      handler.indexOf("recordInvocation(supabase"),
    );
    expect(source).toContain("const MAX_BATCH = 1");
    expect(source).toContain("read_site_content_sync_event_plan");
    expect(source).toContain("record.reuseEmbedding");
    expect(source).toContain("heartbeat_site_content_sync_event");
    expect(source).toContain("setInterval");
    expect(source).toContain("releaseId: plan.releaseId");
    expect(source).not.toContain("mustPassChecks: true");
    expect(source).toContain("p_lease_generation");
    expect(source).toContain("dimensions: plan.embedding.dimensions");
    expect(source).toMatch(/plan\.embedding\.dimensions\s*!==\s*1536/);
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:normalizedText|embedding|actor|owner)/);
    expect(source).not.toContain("cron.schedule");
  });

  it("embeds only added/text-changed rows, heartbeats during provider work, and stages the complete population", async () => {
    const embed = vi.fn(
      async () =>
        new Map([
          ["medications:added", [1, 2]],
          ["medications:changed", [3, 4]],
        ]),
    );
    const heartbeat = vi.fn(async () => true);
    const stage = vi.fn(async (_syncPlan: SiteContentSyncPlan, _records: SiteContentSyncPlanItem[]) => {
      void _syncPlan;
      void _records;
      return true;
    });
    const fail = vi.fn(async () => true);

    const result = await runSiteContentSync(
      plan(),
      { eventId: "event-1", workerId: "worker-1", leaseToken: "token-1", leaseGeneration: 3 },
      { embed, heartbeat, stage, fail },
    );

    expect(embed).toHaveBeenCalledWith([
      { logicalId: "medications:added", text: "Added" },
      { logicalId: "medications:changed", text: "Changed" },
    ]);
    expect(heartbeat.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(stage).toHaveBeenCalledTimes(1);
    const staged = stage.mock.calls[0]?.[1] as Array<{ logicalId: string }> | undefined;
    expect(staged?.map((record) => record.logicalId)).toEqual([
      "medications:added",
      "medications:changed",
      "medications:metadata",
      "medications:unchanged",
      "medications:retired",
    ]);
    expect(fail).not.toHaveBeenCalled();
    expect(result).toEqual({ embeddedCount: 2, stagedCount: 5, tombstoneCount: 1 });
  });

  it("records a fixed provider failure code without logging content or actor identity", async () => {
    const stage = vi.fn(async () => true);
    const fail = vi.fn(async () => true);
    const log = vi.fn();
    const secret = "private poison payload actor@example.test";

    await expect(
      runSiteContentSync(
        { ...plan(), added: [{ logicalId: "medications:added", normalizedText: secret, reuseEmbedding: false }] },
        { eventId: "event-1", workerId: "worker-1", leaseToken: "token-1", leaseGeneration: 3 },
        {
          embed: async () => {
            throw new Error(secret);
          },
          heartbeat: async () => true,
          stage,
          fail,
          log,
        },
      ),
    ).rejects.toThrow("SITE_CONTENT_EMBEDDING_FAILED");

    expect(fail).toHaveBeenCalledWith(expect.anything(), "provider_failure");
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    expect(stage).not.toHaveBeenCalled();
  });
});
