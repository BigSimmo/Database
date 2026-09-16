import { describe, expect, it, vi } from "vitest";

import {
  decideReviewedCommitHistory,
  resolveReviewedCommitHistory,
  type ReviewedCommitProbes,
} from "./helpers/reviewed-commit-history";

const COMMIT = "d3074946a917cac378de64284c67cbc1d4dc58fa";

/**
 * A complete, healthy checkout by default: the commit is here, it is an ancestor, and its tree
 * can be read. Each case turns off exactly the one fact it is about.
 */
function probes(overrides: Partial<ReviewedCommitProbes> & { reachableAfterDeepen?: boolean } = {}) {
  const { reachableAfterDeepen, ...rest } = overrides;
  let deepened = false;
  const truthyAfterDeepen = () => (deepened ? Boolean(reachableAfterDeepen) : false);
  const base: ReviewedCommitProbes = {
    isShallow: () => false,
    hasCommit: () => true,
    isAncestor: () => true,
    hasTree: () => true,
    deepen: vi.fn(() => {
      deepened = true;
    }),
    allowDeepen: false,
    ...rest,
  };
  if (reachableAfterDeepen !== undefined) {
    base.hasCommit = truthyAfterDeepen;
    base.isAncestor = truthyAfterDeepen;
    base.hasTree = truthyAfterDeepen;
  }
  return base;
}

/**
 * The guard these cover skips a governance check, so it is exactly the kind that must be shown
 * not to be empty. The negative controls are the cases that must stay ON.
 */
describe("reviewed-commit history availability", () => {
  it("runs the real check when the commit, its ancestry and its tree are all here", () => {
    const p = probes();
    expect(decideReviewedCommitHistory(COMMIT, p)).toEqual({ checkGit: true, skipReason: null });
    expect(p.deepen).not.toHaveBeenCalled();
  });

  // NEGATIVE CONTROL. A complete clone that cannot reach the reviewed commit is a real finding
  // about the register — the situation the whole check exists for. If this ever returns
  // checkGit:false the guard has been widened into a blindfold.
  it("keeps the check ON when a complete clone cannot reach the commit, so a wrong register stays red", () => {
    const p = probes({ isShallow: () => false, hasCommit: () => true, isAncestor: () => false });
    expect(decideReviewedCommitHistory(COMMIT, p)).toEqual({ checkGit: true, skipReason: null });
  });

  // NEGATIVE CONTROL. A complete clone missing the commit object entirely is likewise a real
  // finding, not a history gap to excuse.
  it("keeps the check ON when a complete clone does not hold the commit at all", () => {
    const p = probes({ isShallow: () => false, hasCommit: () => false, isAncestor: () => false });
    expect(decideReviewedCommitHistory(COMMIT, p)).toEqual({ checkGit: true, skipReason: null });
  });

  it("skips a shallow checkout that cannot answer, and names the remedy", () => {
    const p = probes({ isShallow: () => true, hasCommit: () => false, isAncestor: () => false });
    const result = decideReviewedCommitHistory(COMMIT, p);
    expect(result.checkGit).toBe(false);
    expect(result.skipReason).toContain(COMMIT);
    expect(result.skipReason).toContain("shallow");
    expect(result.skipReason).toContain("git fetch --unshallow");
  });

  /**
   * The defect the 2026-09-07 rewrite exists for. The guard it replaced asked only whether the
   * commit OBJECT was present; a session that had fetched that one object by SHA held it, could
   * still not walk to it, and so fell through the guard into a false failure.
   */
  it("treats a present-but-unreachable commit in a shallow clone as unverifiable, not as a failing register", () => {
    const p = probes({ isShallow: () => true, hasCommit: () => true, isAncestor: () => false });
    expect(decideReviewedCommitHistory(COMMIT, p).checkGit).toBe(false);
  });

  /**
   * The partial-clone case. Ancestry succeeds, so an ancestry-only probe said "go" and the
   * validators then failed on ls-tree: 28 clinical and 33 privacy false positives. The checkout
   * is not shallow, so nothing about shallowness can catch this.
   */
  it("skips when the commit is an ancestor but its tree is absent, and says the clone is partial", () => {
    const p = probes({ isShallow: () => false, hasCommit: () => true, isAncestor: () => true, hasTree: () => false });
    const result = decideReviewedCommitHistory(COMMIT, p);
    expect(result.checkGit).toBe(false);
    expect(result.skipReason).toContain("tree is not in this checkout");
    expect(result.skipReason).toContain("partial");
  });

  describe("deepening is a network fetch, so it is opt-in", () => {
    it("does not fetch on a shallow checkout by default", () => {
      const p = probes({ isShallow: () => true, hasCommit: () => false, isAncestor: () => false });
      expect(decideReviewedCommitHistory(COMMIT, p).checkGit).toBe(false);
      expect(p.deepen).not.toHaveBeenCalled();
    });

    it("deepens and restores the real check only when the run opted in", () => {
      const p = probes({ isShallow: () => true, allowDeepen: true, reachableAfterDeepen: true });
      expect(decideReviewedCommitHistory(COMMIT, p)).toEqual({ checkGit: true, skipReason: null });
      expect(p.deepen).toHaveBeenCalledOnce();
    });

    it("still concedes when an opted-in deepen does not bring the commit into reach", () => {
      const p = probes({ isShallow: () => true, allowDeepen: true, reachableAfterDeepen: false });
      expect(decideReviewedCommitHistory(COMMIT, p).checkGit).toBe(false);
      expect(p.deepen).toHaveBeenCalledOnce();
    });

    it("never deepens a checkout that is not shallow", () => {
      const p = probes({ isShallow: () => false, allowDeepen: true, hasCommit: () => false, isAncestor: () => false });
      expect(decideReviewedCommitHistory(COMMIT, p).checkGit).toBe(true);
      expect(p.deepen).not.toHaveBeenCalled();
    });
  });

  it("wires the real git probes without throwing in this checkout", () => {
    const result = resolveReviewedCommitHistory(COMMIT);
    expect(typeof result.checkGit).toBe("boolean");
    expect(result.checkGit || typeof result.skipReason === "string").toBe(true);
  });
});
