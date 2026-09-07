import { describe, expect, it, vi } from "vitest";

import {
  decideReviewedCommitHistory,
  resolveReviewedCommitHistory,
  type ReviewedCommitProbes,
} from "./helpers/reviewed-commit-history";

const COMMIT = "d3074946a917cac378de64284c67cbc1d4dc58fa";

function probes(overrides: Partial<ReviewedCommitProbes> & { reachableAfterDeepen?: boolean } = {}) {
  const { reachableAfterDeepen, ...rest } = overrides;
  let deepened = false;
  const base: ReviewedCommitProbes = {
    isShallow: () => false,
    isReachable: () => (deepened && reachableAfterDeepen ? true : false),
    deepen: vi.fn(() => {
      deepened = true;
    }),
    ...rest,
  };
  return base;
}

/**
 * The guard these cover skips a governance check, so it is exactly the kind that must be shown
 * not to be empty. The negative control is the third case: on a complete clone the check stays
 * on, so a register that really is wrong still goes red.
 */
describe("reviewed-commit history availability", () => {
  it("runs the real check when the reviewed commit is reachable, without deepening", () => {
    const p = probes({ isReachable: () => true });
    expect(decideReviewedCommitHistory(COMMIT, p)).toEqual({ checkGit: true, skipReason: null });
    expect(p.deepen).not.toHaveBeenCalled();
  });

  it("deepens a shallow checkout and restores the real check when that makes the commit reachable", () => {
    const p = probes({ isShallow: () => true, reachableAfterDeepen: true });
    expect(decideReviewedCommitHistory(COMMIT, p)).toEqual({ checkGit: true, skipReason: null });
    expect(p.deepen).toHaveBeenCalledOnce();
  });

  // NEGATIVE CONTROL. A complete clone that cannot reach the reviewed commit is a real finding
  // about the register — the situation the whole check exists for. If this ever returns
  // checkGit:false the guard has been widened into a blindfold.
  it("keeps the check ON when a complete clone cannot reach the commit, so a wrong register stays red", () => {
    const p = probes({ isShallow: () => false, isReachable: () => false });
    expect(decideReviewedCommitHistory(COMMIT, p)).toEqual({ checkGit: true, skipReason: null });
  });

  it("skips only when a shallow checkout could not be deepened, and names why", () => {
    const p = probes({ isShallow: () => true, isReachable: () => false });
    const result = decideReviewedCommitHistory(COMMIT, p);
    expect(result.checkGit).toBe(false);
    expect(result.skipReason).toContain(COMMIT);
    expect(result.skipReason).toContain("shallow");
  });

  /**
   * The defect the 2026-09-07 rewrite exists for. The guard it replaced asked only whether the
   * commit OBJECT was present; a session that had fetched that one object by SHA held it, could
   * still not walk to it, and so fell through the guard into a false failure against eight
   * clinical hazard sign-off records. Reachability, not presence, is the property.
   */
  it("treats a present-but-unreachable commit as unverifiable, not as a failing register", () => {
    const objectPresentButUnreachable = probes({ isShallow: () => true, isReachable: () => false });
    expect(decideReviewedCommitHistory(COMMIT, objectPresentButUnreachable).checkGit).toBe(false);
  });

  it("wires the real git probes without throwing in this checkout", () => {
    const result = resolveReviewedCommitHistory(COMMIT);
    expect(typeof result.checkGit).toBe("boolean");
    expect(result.checkGit || typeof result.skipReason === "string").toBe(true);
  });
});
