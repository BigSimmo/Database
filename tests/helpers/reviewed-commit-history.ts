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
 * The cost of the wrong reading was an hour and a false alarm about clinical governance records —
 * exactly the kind of claim that must not be made on truncated evidence.
 *
 * The privacy suite had no guard at all. The hazard suite had one, and it still missed this:
 * it asked only whether the commit OBJECT was present, so a session that had fetched that one
 * object by SHA (as the 2026-09-07 session had, while investigating) held the object, failed the
 * ancestry walk, and skipped straight past the guard into a false failure.
 *
 * 🔴 **AND ANCESTRY ALONE IS NOT ENOUGH EITHER.** A checkout can hold the commit graph while
 * omitting the historical trees — a treeless or blobless partial clone, or a filtered fetch. There
 * the commit is present and is an ancestor of HEAD, so an ancestry-only probe says "go", and the
 * validators then fail on `ls-tree` because the snapshot they want to read is not there. Measured:
 * 28 clinical and 33 privacy false positives from exactly that state. The probe therefore asks for
 * the property the validators actually consume — the reviewed commit's tree is readable — not the
 * weaker property that it is reachable.
 *
 * ⚠️ **THIS DELIBERATELY WEAKENS A GOVERNANCE CHECK, SO READ THE ORDER.** The check is skipped
 * only where it is unanswerable: history this checkout does not hold. Where the checkout is
 * complete and the commit still does not check out, that is a real finding about the register and
 * stays RED. On any complete clone — every CI run, since the `Unit coverage` job checks out with
 * `fetch-depth: 0` — a genuinely wrong register still fails exactly as before. A skip is never
 * silent: it prints the sentinel below so a green suite that skipped is distinguishable from a
 * green suite that proved it.
 *
 * ⚠️ **THESE PROBES DO NO NETWORK I/O.** Running a unit test must not contact a remote. Every git
 * call below runs with lazy fetching and terminal prompts disabled, so a partial clone cannot turn
 * a probe into a silent fetch and nothing can block on credentials. Deepening a shallow clone is a
 * fetch, so it is opt-in through `REVIEWED_COMMIT_ALLOW_DEEPEN=1` and never happens by default;
 * the offline answer is to skip and say so.
 */
export type ReviewedCommitHistory = {
  /** Pass to the validator's `checkGit` option. False only when history cannot answer. */
  checkGit: boolean;
  /** Set when the check was skipped, naming why. Null when the check really ran. */
  skipReason: string | null;
};

/**
 * No lazy fetch, no credential prompt. A probe that reaches the network is a probe that can hang
 * a unit run or perform an unconfirmed provider operation.
 */
const OFFLINE_GIT_ENV = { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" };

function gitSucceeds(args: string[]): boolean {
  try {
    execFileSync("git", args, { stdio: "ignore", env: OFFLINE_GIT_ENV });
    return true;
  } catch {
    return false;
  }
}

function isShallowClone(): boolean {
  try {
    const out = execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: OFFLINE_GIT_ENV,
    }).trim();
    return out === "true";
  } catch {
    // No git, or not a repository. Nothing to complete and nothing to excuse: the caller keeps
    // the real check, and the validator reports whatever it finds.
    return false;
  }
}

/** Is the commit object itself here? */
function hasCommitObject(commit: string): boolean {
  return gitSucceeds(["cat-file", "-e", `${commit}^{commit}`]);
}

/** Can history be walked from HEAD back to it? Presence alone is not this property. */
function isAncestorOfHead(commit: string): boolean {
  return gitSucceeds(["merge-base", "--is-ancestor", commit, "HEAD"]);
}

/**
 * Can the reviewed snapshot actually be read? This is what the validators do with the commit,
 * and it is the part a treeless or blobless clone silently lacks.
 */
function hasReadableTree(commit: string): boolean {
  return gitSucceeds(["ls-tree", "--name-only", `${commit}^{tree}`]);
}

function deepenHistory(depth: number): void {
  try {
    execFileSync("git", ["fetch", `--deepen=${depth}`], { stdio: "ignore", env: OFFLINE_GIT_ENV });
  } catch {
    // Offline, no remote, or a server refusing the deepen. The caller falls through to the
    // skip, which is the honest answer when history cannot be completed.
  }
}

/**
 * The git facts the decision below rests on. Injectable so the decision can be proven against
 * every combination — including the ones that matter most and cannot be staged in a real checkout
 * on demand: a complete clone whose register is genuinely wrong (must stay RED), a shallow clone
 * holding the commit object but unable to walk to it (the 2026-09-07 false failure), and a
 * complete clone whose historical trees are absent (the partial-clone false failure).
 */
export type ReviewedCommitProbes = {
  isShallow: () => boolean;
  hasCommit: () => boolean;
  isAncestor: () => boolean;
  hasTree: () => boolean;
  deepen: () => void;
  /** Deepening is a network fetch. Off unless a human turned it on for this run. */
  allowDeepen: boolean;
};

function canAnswer(probes: ReviewedCommitProbes): boolean {
  return probes.hasCommit() && probes.isAncestor() && probes.hasTree();
}

/**
 * Decide whether this checkout can run a register's commit-ancestry check.
 *
 * Kept separate from the git calls so `tests/reviewed-commit-history.test.ts` can hold it to
 * every case, including the two that must never become skips.
 */
export function decideReviewedCommitHistory(commit: string, probes: ReviewedCommitProbes): ReviewedCommitHistory {
  if (canAnswer(probes)) return { checkGit: true, skipReason: null };

  // A shallow clone may be completable, but only when a human has asked for the fetch.
  if (probes.isShallow() && probes.allowDeepen) {
    probes.deepen();
    if (canAnswer(probes)) return { checkGit: true, skipReason: null };
  }

  if (probes.isShallow()) {
    return {
      checkGit: false,
      skipReason:
        `reviewedCommit ${commit} is unreachable in a shallow checkout; commit-ancestry check skipped. ` +
        `Run git fetch --unshallow, or set REVIEWED_COMMIT_ALLOW_DEEPEN=1 to let this run deepen it.`,
    };
  }

  // Not shallow. If the commit and its ancestry are both here, the only missing piece is the
  // historical tree — a partial clone. That is unanswerable, not a failing register.
  if (probes.hasCommit() && probes.isAncestor() && !probes.hasTree()) {
    return {
      checkGit: false,
      skipReason:
        `reviewedCommit ${commit} is an ancestor of HEAD but its tree is not in this checkout, ` +
        `so the reviewed snapshot cannot be read; commit-ancestry check skipped. ` +
        `This is a partial (treeless or blobless) clone: refetch without a filter to restore the check.`,
    };
  }

  // A complete clone that cannot reach the reviewed commit is a real finding about the register.
  return { checkGit: true, skipReason: null };
}

/**
 * The real-git wiring of the decision above.
 *
 * `depth` is one deepen step, not a cap on history: 2,000 commits comfortably covers the gap
 * seen on 2026-09-07 (a reviewed commit roughly 1,200 commits behind a 335-commit slice). It is
 * only ever used when `REVIEWED_COMMIT_ALLOW_DEEPEN=1` opts this run into the fetch.
 */
export function resolveReviewedCommitHistory(commit: string, { depth = 2000 } = {}): ReviewedCommitHistory {
  return decideReviewedCommitHistory(commit, {
    isShallow: isShallowClone,
    hasCommit: () => hasCommitObject(commit),
    isAncestor: () => isAncestorOfHead(commit),
    hasTree: () => hasReadableTree(commit),
    deepen: () => deepenHistory(depth),
    allowDeepen: process.env.REVIEWED_COMMIT_ALLOW_DEEPEN === "1",
  });
}

/** One sentinel for both suites, so a skipped run is greppable in CI logs. */
export function warnReviewedCommitSkipped(register: string, skipReason: string): void {
  console.warn(`REVIEWED_COMMIT_HISTORY_UNAVAILABLE (${register}): ${skipReason}`);
}
