import { describe, expect, it } from "vitest";

import {
  diffManifests,
  formatDiff,
  IGNORED_MANIFEST_KEYS,
  STALE_MANIFEST_INSTRUCTION,
} from "../scripts/check-drift-manifest-freshness";

/**
 * The CI step "Regenerate and verify drift manifest freshness" used to compare
 * only `schema_sha256` between the committed manifest and a freshly generated
 * one. An agent could hand-set that hash correctly while leaving a stale
 * nested `snapshot.functions[].def_hash`, and the old check would pass — the
 * exact shape that let `correct_clinical_query_terms(text,real)` reach `main`
 * red (2026-09-01), caught only by the post-merge `live-drift` workflow.
 *
 * These tests pin the replacement: a deep compare of the whole manifest
 * except the two fields expected to change on every regeneration.
 */
describe("check:drift-manifest-freshness", () => {
  const base = {
    generated_at: "2026-09-16T13:04:14.958Z",
    generator: "scripts/generate-drift-manifest.ts",
    postgres_image: "supabase/postgres:17.6.1.127@sha256:aaa",
    schema_sha256: "sha-1",
    replay_seconds: 20,
    snapshot: {
      functions: [{ signature: "public.f()", def_hash: "hash-a" }],
      views: [{ name: "v", def_hash: "hash-b" }],
    },
  };

  it("reports no diff for an identical manifest", () => {
    expect(diffManifests(base, { ...base })).toEqual([]);
  });

  it("ignores generated_at and replay_seconds", () => {
    expect(IGNORED_MANIFEST_KEYS.has("generated_at")).toBe(true);
    expect(IGNORED_MANIFEST_KEYS.has("replay_seconds")).toBe(true);
    const volatileOnly = { ...base, generated_at: "2026-09-17T00:00:00.000Z", replay_seconds: 999 };
    expect(diffManifests(base, volatileOnly)).toEqual([]);
  });

  it("catches a stale nested function def_hash even when schema_sha256 matches (the 2026-09-01 regression shape)", () => {
    const staleFunctionBody = {
      ...base,
      snapshot: { ...base.snapshot, functions: [{ signature: "public.f()", def_hash: "hash-STALE" }] },
    };
    const diffs = diffManifests(base, staleFunctionBody);
    expect(diffs).toEqual([{ path: "snapshot.functions[0].def_hash", committed: "hash-a", generated: "hash-STALE" }]);
  });

  it("still catches a changed schema_sha256", () => {
    const staleHash = { ...base, schema_sha256: "sha-DIFFERENT" };
    expect(diffManifests(base, staleHash)).toEqual([
      { path: "schema_sha256", committed: "sha-1", generated: "sha-DIFFERENT" },
    ]);
  });

  it("catches postgres_image and generator drift", () => {
    const staleImage = { ...base, postgres_image: "supabase/postgres:17.6.1.127@sha256:bbb" };
    expect(diffManifests(base, staleImage)).toHaveLength(1);

    const staleGenerator = { ...base, generator: "scripts/other-generator.ts" };
    expect(diffManifests(base, staleGenerator)).toHaveLength(1);
  });

  it("catches an added or removed snapshot entry", () => {
    const withExtraView = {
      ...base,
      snapshot: { ...base.snapshot, views: [...base.snapshot.views, { name: "v2", def_hash: "hash-c" }] },
    };
    expect(diffManifests(base, withExtraView).length).toBeGreaterThan(0);
    expect(diffManifests(withExtraView, base).length).toBeGreaterThan(0);
  });

  it("caps rendered output at the given limit and reports the remainder", () => {
    const manyDiffs = Array.from({ length: 25 }, (_, index) => ({
      path: `snapshot.functions[${index}].def_hash`,
      committed: "a",
      generated: "b",
    }));
    const rendered = formatDiff(manyDiffs, 20);
    const lines = rendered.split("\n");
    expect(lines).toHaveLength(21);
    expect(lines.at(-1)).toBe("  ...and 5 more");
  });

  it("keeps the download-and-commit remediation instruction", () => {
    expect(STALE_MANIFEST_INSTRUCTION).toContain("Download the drift-manifest artifact from this job and commit it.");
  });
});
