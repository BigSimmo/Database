/**
 * Shared reviewed-commit history policy (boolean facts only).
 *
 * Both the privacy CLI (`shallowSkipDecision`) and the unit-test helper
 * (`decideReviewedCommitHistory`) must agree on when history is unanswerable.
 * Keep the matrix here; release mode wraps the result with `blocked`, and the
 * TypeScript helper adds deepen + skipReason text around the same answer.
 *
 * Returns `checkGit: false` only when this checkout cannot honestly answer —
 * never when a complete clone simply disagrees with the register.
 */
export function decideReviewedCommitHistoryFromFacts({ shallow, commitPresent, ancestor, treeReadable }) {
  if (commitPresent && ancestor && treeReadable) {
    return { checkGit: true };
  }

  // Shallow: ancestry (and often the commit object) may be outside the slice.
  if (shallow) {
    return { checkGit: false };
  }

  // Not shallow. Commit + ancestry present but tree missing ⇒ partial/filtered
  // clone; unanswerable, not a failing register.
  if (commitPresent && ancestor && !treeReadable) {
    return { checkGit: false };
  }

  // Complete clone that cannot reach the reviewed commit: keep the check on.
  return { checkGit: true };
}
