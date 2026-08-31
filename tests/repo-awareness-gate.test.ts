import { describe, expect, it } from "vitest";

import { checkRepoAwarenessSnapshot, compareSnapshots } from "../scripts/check-repo-awareness-snapshot";
import { generate } from "../scripts/generate-repo-awareness-snapshot";

const regenerated = generate();

describe("compareSnapshots", () => {
  it("reports no differences for the snapshot it was generated from", () => {
    expect(compareSnapshots(structuredClone(regenerated), regenerated)).toEqual([]);
  });

  it("ignores captured_revision, which changes as a side effect of committing", () => {
    const committed = structuredClone(regenerated);
    committed.captured_revision = { sha: "0".repeat(40), committed_at: "2020-01-01T00:00:00Z" };
    expect(compareSnapshots(committed, regenerated)).toEqual([]);
  });

  it("catches a version mismatch", () => {
    const committed = structuredClone(regenerated);
    committed.version = "repo-awareness-snapshot-v0";
    expect(compareSnapshots(committed, regenerated).join(" ")).toMatch(/version/);
  });

  it("catches a content difference in every section", () => {
    // A small change *inside* each section, so this proves the gate looks
    // within a section rather than merely comparing the top-level key set.
    const mutations: Record<string, (snapshot: typeof regenerated) => void> = {
      routes: (snapshot) => void (snapshot.routes.counts.pages += 1),
      documentation: (snapshot) => void (snapshot.documentation.counts.documents += 1),
      test_health: (snapshot) => void (snapshot.test_health.note = "changed"),
      review_state: (snapshot) => void (snapshot.review_state.counts.records += 1),
    };

    for (const [section, mutate] of Object.entries(mutations)) {
      const committed = structuredClone(regenerated);
      mutate(committed);
      expect(compareSnapshots(committed, regenerated).join(" ")).toMatch(section);
    }
  });

  it("catches a missing snapshot rather than treating it as in step", () => {
    expect(compareSnapshots(null, regenerated).join(" ")).toMatch(/missing|version/);
  });

  it("reports a scalar committed snapshot as stale instead of throwing", () => {
    expect(compareSnapshots("not-a-snapshot", regenerated).join(" ")).toMatch(/version|missing/);
  });

  it("catches a key the generator no longer emits", () => {
    const committed = { ...structuredClone(regenerated), legacy_section: {} };
    expect(compareSnapshots(committed, regenerated).join(" ")).toMatch(/legacy_section/);
  });
});

describe("checkRepoAwarenessSnapshot", () => {
  it("skips gracefully with exit 0 when git is missing or fails in the environment", () => {
    const logs: string[] = [];
    const errors: string[] = [];
    let exitCode: number | null = null;

    const code = checkRepoAwarenessSnapshot({
      generateImpl: () => {
        throw new Error("spawnSync git ENOENT");
      },
      log: (msg) => logs.push(msg),
      error: (msg) => errors.push(msg),
      exit: (c) => {
        exitCode = c;
      },
    });

    expect(code).toBe(0);
    expect(exitCode).toBeNull();
    expect(logs.join(" ")).toContain("git is not available");
    expect(errors).toHaveLength(0);
  });

  it("passes with exit 0 when committed snapshot matches generated snapshot", () => {
    const logs: string[] = [];
    const errors: string[] = [];

    const code = checkRepoAwarenessSnapshot({
      generateImpl: () => regenerated,
      readCommittedImpl: () => structuredClone(regenerated),
      log: (msg) => logs.push(msg),
      error: (msg) => errors.push(msg),
    });

    expect(code).toBe(0);
    expect(logs.join(" ")).toContain("in step with");
    expect(errors).toHaveLength(0);
  });
});
