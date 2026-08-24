import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
  activateSiteContentRelease,
  readCanonicalSiteContentRecords,
} from "@/lib/site-content/site-content-publication";
import type { RecoveryReadinessEvidence } from "@/lib/recovery-readiness-evidence";

const seed = { slug: "seed", title: "Seed" };
const canonical = { slug: "canonical", title: "Canonical", ownerId: "must-not-leak", publishedBy: "must-not-leak" };

describe("canonical site-content publication reads", () => {
  it("routes all seven public GET owners through the canonical publication reader", () => {
    const routes = [
      "src/app/api/registry/records/route.ts",
      "src/app/api/registry/records/[slug]/route.ts",
      "src/app/api/medications/route.ts",
      "src/app/api/medications/[slug]/route.ts",
      "src/app/api/differentials/route.ts",
      "src/app/api/differentials/[slug]/route.ts",
      "src/app/api/differentials/presentations/[slug]/route.ts",
    ];
    for (const route of routes) {
      const source = readFileSync(route, "utf8");
      expect(source).toContain("readCanonicalSiteContentRecords");
      expect(source).not.toMatch(
        /\.from\(["'](?:clinical_registry_records|medication_records|differential_records)["']\)/,
      );
    }
  });

  it("returns the same ownerless public body for anonymous, user, and administrator callers", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ initialized: true, record: canonical, snapshot: { state: "current", releaseId: "release-1" } }],
      error: null,
    }));

    const bodies = await Promise.all(
      [null, "user", "administrator"].map(() =>
        readCanonicalSiteContentRecords({ supabase: { rpc }, kind: "medication", slug: null, seeds: [seed] }),
      ),
    );

    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
    expect(JSON.stringify(bodies[0])).not.toMatch(/owner|publishedBy|must-not-leak/i);
    expect(bodies[0].records).toEqual([{ slug: "canonical", title: "Canonical" }]);
  });

  it("uses seeds only before initialization and fails closed for pending initialized records", async () => {
    const uninitialized = await readCanonicalSiteContentRecords({
      supabase: { rpc: vi.fn(async () => ({ data: [{ initialized: false, record: null }], error: null })) },
      kind: "medication",
      slug: null,
      seeds: [seed],
    });
    const pending = await readCanonicalSiteContentRecords({
      supabase: {
        rpc: vi.fn(async () => ({
          data: [{ initialized: true, record: null, snapshot: { state: "updating", releaseId: "release-1" } }],
          error: null,
        })),
      },
      kind: "medication",
      slug: "seed",
      seeds: [seed],
    });

    expect(uninitialized.records).toEqual([seed]);
    expect(uninitialized.source).toBe("seed_uninitialized");
    expect(pending.records).toEqual([]);
    expect(pending.source).toBe("canonical_public");
  });

  it("never silently falls back after an RPC failure", async () => {
    await expect(
      readCanonicalSiteContentRecords({
        supabase: { rpc: vi.fn(async () => ({ data: null, error: { message: "unavailable" } })) },
        kind: "medication",
        slug: null,
        seeds: [seed],
      }),
    ).rejects.toThrow("Canonical site-content read failed");
  });

  it("rejects activation before RPC when P05 recovery evidence is not exact and current", async () => {
    const rpc = vi.fn();
    await expect(
      activateSiteContentRelease({
        supabase: { rpc },
        projectRef: "project-ref",
        releaseId: "release-2",
        releaseDigest: "a".repeat(64),
        expectedChangeEpoch: "2",
        recoveryEvidence: {} as RecoveryReadinessEvidence,
        activationReceipt: {},
      }),
    ).rejects.toThrow(/recovery readiness evidence/i);
    expect(rpc).not.toHaveBeenCalled();
  });
});
