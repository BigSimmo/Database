import { execFileSync } from "node:child_process";

/**
 * WHETHER THIS CHECKOUT CAN HONESTLY ANSWER "IS THE REVIEWED COMMIT AN ANCESTOR OF HEAD?"
 *
 * Both governance registers — `docs/clinical-hazard-controls.json` and
 * `docs/governance/privacy-readiness.v1.json` — pin the commit at which a human reviewed them,
 * and their validators walk history to prove that commit is an ancestor of HEAD and that the
 * evidence files existed there. That proof is only meaningful in a checkout that actually holds
 * the history it walks.
 *
 * 🔴 **THE FAILURE THIS EXISTS FOR, MEASURED ON 2026-09-07.** A cloud session clones a recent
 * slice of history (335 commits that day). Both reviewed commits predate the slice, so the
 * validators reported `reviewedCommit does not exist` and `reviewedCommit is not an ancestor of
 * HEAD` for nine entries across the two registers. That was read as nine broken clinical-safety
 * and privacy sign-off records and reported to the owner as such. **Both registers were correct.**
 * Deepening the clone to 5,214 commits made both commits reachable and both suites pass. The
 * cost of the wrong reading was an hour and a false alarm about clinical governance records —
 * exactly the kind of claim that must not be made on truncated evidence.
 *
 * The privacy suite had no guard at all. The hazard suite had one, and it still missed this:
 * it asked only whether the commit OBJECT was present, so a session that had fetched that one
 * object by SHA (as the 2026-09-07 session had, while investigating) held the object, failed the
 * ancestry walk, and skipped straight past the guard into a false failure. Presence of the object
 * is not the property under test; reachability is.
 *
 * ⚠️ **THIS DELIBERATELY WEAKENS A GOVERNANCE CHECK, SO READ THE ORDER.** Deepening is attempted
 * FIRST, and the real check is restored the moment history is complete enough to run it. The
 * check is skipped only where it is unanswerable: a still-shallow checkout that could not be
 * completed. On any complete clone — every CI run, since the `Unit coverage` job checks out with
 * `fetch-depth: 0` — `isShallowClone()` is false, so a genuinely wrong register still fails
 * exactly as before. A skip is never silent: it prints the sentinel below so a green suite that
 * skipped is distinguishable from a green suite that proved it.
 */
export type ReviewedCommitHistory = {
  /** Pass to the validator's `checkGit` option. False only when history cannot answer. */
  checkGit: boolean;
  /** Set when the check was skipped, naming why. Null when the check really ran. */
  skipReason: string | null;
};

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function isShallowClone(): boolean {
  try {
    return git(["rev-parse", "--is-shallow-repository"]) === "true";
  } catch {
    // No git, or not a repository. Nothing to deepen and nothing to excuse: the caller keeps
    // the real check, and the validator reports whatever it finds.
    return false;
  }
}

/**
 * The property the validators actually assert: the commit is present AND reachable from HEAD.
 * Checking presence alone is what let the 2026-09-07 false failure through.
 */
function reviewedCommitIsReachable(commit: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], { stdio: "ignore" });
  } catch {
    return false;
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function deepenHistory(depth: number): void {
  try {
    execFileSync("git", ["fetch", `--deepen=${depth}`], { stdio: "ignore" });
  } catch {
    // Offline, no remote, or a server refusing the deepen. The caller falls through to the
    // shallow-clone skip, which is the honest answer when history cannot be completed.
  }
}

/**
 * The git facts the decision below rests on. Injectable so the decision can be proven against
 * every combination — including the two that matter most and cannot be staged in a real
 * checkout on demand: a complete clone whose register is genuinely wrong (must stay RED), and a
 * shallow clone that holds the commit object but cannot walk to it (the 2026-09-07 false
 * failure, which the previous object-presence guard let straight through).
 */
export type ReviewedCommitProbes = {
  isShallow: () => boolean;
  isReachable: () => boolean;
  deepen: () => void;
};

/**
 * Decide whether this checkout can run a register's commit-ancestry check.
 *
 * Deepen once, re-test, and only then concede. Kept separate from the git calls so
 * `tests/reviewed-commit-history.test.ts` can hold it to its four cases.
 */
export function decideReviewedCommitHistory(commit: string, probes: ReviewedCommitProbes): ReviewedCommitHistory {
  if (probes.isReachable()) return { checkGit: true, skipReason: null };

  if (probes.isShallow()) probes.deepen();
  if (probes.isReachable()) return { checkGit: true, skipReason: null };

  // Still unreachable. Only a shallow checkout earns the skip: on a complete clone an
  // unreachable reviewed commit is a real finding about the register, and must stay red.
  if (!probes.isShallow()) return { checkGit: true, skipReason: null };

  return {
    checkGit: false,
    skipReason: `reviewedCommit ${commit} is unreachable in a shallow checkout that could not be deepened; commit-ancestry check skipped`,
  };
}

/**
 * The real-git wiring of the decision above.
 *
 * `depth` is one deepen step, not a cap on history: 2,000 commits comfortably covers the gap
 * seen on 2026-09-07 (a reviewed commit roughly 1,200 commits behind a 335-commit slice).
 */
export function resolveReviewedCommitHistory(commit: string, { depth = 2000 } = {}): ReviewedCommitHistory {
  return decideReviewedCommitHistory(commit, {
    isShallow: isShallowClone,
    isReachable: () => reviewedCommitIsReachable(commit),
    deepen: () => deepenHistory(depth),
  });
}

/** One sentinel for both suites, so a skipped run is greppable in CI logs. */
export function warnReviewedCommitSkipped(register: string, skipReason: string): void {
  console.warn(`REVIEWED_COMMIT_HISTORY_UNAVAILABLE (${register}): ${skipReason}`);
}
