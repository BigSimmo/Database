/**
 * lighthouse-measurement-outcome — decide whether a Lighthouse cell produced
 * gradeable evidence at all, and therefore whether one retry is warranted.
 *
 * Why this is its own module: `run-lighthouse-budget.mjs` executes its whole pipeline
 * at import time (it builds, serves and measures at the top level), so it cannot be
 * imported by a test. Putting the decision here keeps it unit-testable without the
 * source-text assertions this repo has been retiring.
 *
 * The distinction that matters:
 *
 *   - A measurement that never STARTED is not evidence of a regression. Lighthouse's
 *     own `NO_NAVSTART` runtime error means the navigation never began, and its own
 *     advice is to run again; ledger #147 recorded `/forms` doing exactly this while
 *     the live dispatch measured it fine.
 *   - A measurement that DID start and produced bad numbers is a real measurement.
 *     It is never retried — that would be the gate re-rolling the dice until green.
 *
 * This only decides whether to retry. It never decides whether a run passes: the
 * grader's `incompleteBudgetEvidence` still fails closed on a missing or unusable
 * report regardless of `enforce`, before and after any retry.
 *
 * Note the second failure shape, which the runner previously missed entirely:
 * Lighthouse exits 0 and writes a perfectly well-formed report whose only content is
 * a `runtimeError`. That file satisfies "a report exists" while carrying no metrics,
 * so an exit-code check alone leaves it unretried.
 */

/**
 * Why this cell produced no gradeable evidence, or `null` when it did.
 *
 * @param {number | null | undefined} exitCode Lighthouse's process exit code.
 * @param {string | null | undefined} reportText Raw contents of the report file, or
 *   `null`/`undefined` when no file was written.
 * @returns {string | null} A short human-readable reason, or `null` when the cell
 *   measured something real (including something real and slow).
 */
export function measurementFailureReason(exitCode, reportText) {
  if (reportText === null || reportText === undefined || reportText === "") {
    return typeof exitCode !== "number" || exitCode !== 0
      ? `lighthouse exited ${exitCode ?? "without a status"}`
      : "no report file was written";
  }

  let parsed;
  try {
    parsed = JSON.parse(reportText);
  } catch {
    return "report is not valid JSON";
  }

  const code = parsed?.runtimeError?.code;
  // Any runtimeError, not just NO_NAVSTART: `measuredRequestedPage` in
  // summarise-web-vitals.mjs already rejects every report carrying one, so each is a
  // cell that produced no comparable numbers.
  if (typeof code === "string" && code.length > 0) return `lighthouse runtimeError ${code}`;

  // Chrome can finish the audit, write a complete report, then fail to remove its
  // temporary profile on Windows with EPERM. The report is still the evidence: the
  // grader independently rejects missing metrics, runtime errors, wrong pages and
  // unverified browser identities. Do not discard that evidence based only on the
  // wrapper's cleanup exit status.
  return null;
}
