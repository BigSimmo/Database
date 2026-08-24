import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { runSiteContentSync, type SiteContentSyncPlan } from "@/lib/site-content/site-content-sync";

function plan(): SiteContentSyncPlan {
  return {
    version: "site-content-sync-plan-v1",
    planDigest: "a".repeat(64),
    releaseDigest: "b".repeat(64),
    dynamicStateDigest: "c".repeat(64),
    targetChangeEpoch: "4",
    generationId: "generation-4",
    registryVersion: "site-content-registry-v1",
    staticManifestDigest: "d".repeat(64),
    embedding: { model: "model", dimensions: 2, fingerprint: "model-v1" },
    added: [{ logicalId: "medications:added", normalizedText: "Added", reuseEmbedding: false }],
    changed: [
      { logicalId: "medications:changed", normalizedText: "Changed", reuseEmbedding: false },
      { logicalId: "medications:metadata", normalizedText: "Same", reuseEmbedding: true, embedding: [0.1, 0.2] },
    ],
    unchanged: [{ logicalId: "medications:unchanged", normalizedText: "Same", reuseEmbedding: true }],
    tombstones: [{ logicalId: "medications:retired", normalizedText: "", reuseEmbedding: false, tombstone: true }],
    counts: { added: 1, changed: 2, unchanged: 1, tombstones: 1, total: 5 },
  };
}

describe("site-content synchronization worker", () => {
  it("keeps the automatic Edge executor JWT-protected, bounded, fenced, and changed-only", () => {
    const source = readFileSync("supabase/functions/site-content-sync/index.ts", "utf8");
    const config = readFileSync("supabase/config.toml", "utf8");
    expect(config).toMatch(/\[functions\.site-content-sync\]\s+verify_jwt = true/);
    expect(source).toContain("const MAX_BATCH = 20");
    expect(source).toContain("read_site_content_sync_event_plan");
    expect(source).toContain("record.reuseEmbedding");
    expect(source).toContain("heartbeat_site_content_sync_event");
    expect(source).toContain("p_lease_generation");
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:normalizedText|embedding|actor|owner)/);
    expect(source).not.toContain("cron.schedule");
  });

  it("embeds only added/text-changed rows, heartbeats, and stages one idempotent batch", async () => {
    const embed = vi.fn(
      async () =>
        new Map([
          ["medications:added", [1, 2]],
          ["medications:changed", [3, 4]],
        ]),
    );
    const heartbeat = vi.fn(async () => true);
    const stage = vi.fn(async () => true);
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
    expect(heartbeat).toHaveBeenCalledTimes(1);
    expect(stage).toHaveBeenCalledTimes(1);
    expect(fail).not.toHaveBeenCalled();
    expect(result).toEqual({ embeddedCount: 2, stagedCount: 4, tombstoneCount: 1 });
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
