/**
 * What a weekly canary run is allowed to claim about itself.
 *
 * The canary answers three separate questions and the workflow used to collapse
 * them into one:
 *
 *   1. Did the intended scope actually run?
 *   2. Did anything block?
 *   3. Is anything still unexplained?
 *
 * A green Actions job answers only "the process exited 0". `.github/workflows/
 * eval-canary.yml` publishes an issue on failure and NOTHING on success, so the
 * only way a canary incident ever closed was somebody reading a green tick and
 * deciding it meant the case was fixed. Run 34122919100 is the example: its
 * aggregate thresholds passed while `discharge-documentation` still reported
 * `unexpected route strong`, a per-case diagnostic that no threshold reads
 * (`qualityFailureCategory` has no route branch, so it falls through to "other"
 * and nothing counts "other").
 *
 * SCOPE IS THE SHARPER HALF. `--limit` takes a PREFIX of the case list
 * (`eval-quality.ts`: `allCases.slice(0, args.limit)`), and captured miss-rows are
 * PREPENDED to the registry cases (`rag-eval-cases.ts`: `[...capturedCases,
 * ...baseCases]`). So a limited run can push registry cases off the end
 * entirely, and the report records only `case_count` — the same number whether it
 * ran the 44 intended cases or 44 promoted misses. A run that never executed the
 * case an incident is about cannot close that incident, however green it looks.
 *
 * This module is pure and takes a receipt, so every branch is testable without a
 * provider call.
 */

/**
 * @typedef {object} CanaryReceipt
 * @property {boolean} intendedScopeComplete  every case the default scope names actually ran
 * @property {string[]} blockingFailures      failures that gate the run
 * @property {string[]} diagnostics           per-case findings that gate nothing
 * @property {string[]} unaccountedDiagnostics diagnostics with no recorded disposition
 * @property {string[]} [skippedComponents]   gates that did not run at all
 * @property {string|null} [evaluatedSha]     the commit the run evaluated
 * @property {boolean} [configurationOverridden] a ranking or fixture override was in force
 */

/** @typedef {"failed"|"incomplete"|"passed_with_diagnostics"|"clean_recovery"} CanaryDisposition */

const DISPOSITIONS = Object.freeze({
  failed: "failed",
  incomplete: "incomplete",
  passedWithDiagnostics: "passed_with_diagnostics",
  cleanRecovery: "clean_recovery",
});

function asArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()) : [];
}

/**
 * Classify a receipt.
 *
 * Order matters and is deliberate:
 *
 * - `failed` first. A blocking failure is a blocking failure whatever else is
 *   true of the run.
 * - `incomplete` next, and it OUTRANKS a clean result. A run that did not cover
 *   its intended scope has not established anything about the cases it skipped,
 *   so "no failures" is not a finding — it is an absence of one. This is the
 *   branch that stops a `--limit`ed or override-configured run from closing a
 *   default-scope incident.
 * - `passed_with_diagnostics` when something is still unexplained. Keeping this
 *   distinct from `clean_recovery` is the whole point: the diagnostic is visible,
 *   nothing is auto-closed, and a human decides.
 * - `clean_recovery` only when the scope is complete, nothing blocked, and every
 *   diagnostic is accounted for.
 *
 * A malformed receipt is `incomplete`, never clean. Absence of evidence is not
 * evidence of a clean run.
 *
 * Takes `unknown` on purpose. This runs against a JSON receipt produced by another
 * process, so "the caller passed something that is not a receipt" is one of the
 * cases it exists to classify, not a case it may assume away.
 *
 * @param {unknown} receipt
 * @returns {CanaryDisposition}
 */
export function classifyCanaryReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") return DISPOSITIONS.incomplete;
  /** @type {CanaryReceipt} */
  const candidate = /** @type {any} */ (receipt);

  const blockingFailures = asArray(candidate.blockingFailures);
  if (blockingFailures.length > 0) return DISPOSITIONS.failed;

  // Everything that means "this run did not measure what it was supposed to".
  if (candidate.intendedScopeComplete !== true) return DISPOSITIONS.incomplete;
  if (asArray(candidate.skippedComponents).length > 0) return DISPOSITIONS.incomplete;
  if (candidate.configurationOverridden === true) return DISPOSITIONS.incomplete;
  if (typeof candidate.evaluatedSha !== "undefined" && !candidate.evaluatedSha) return DISPOSITIONS.incomplete;

  if (asArray(candidate.unaccountedDiagnostics).length > 0) return DISPOSITIONS.passedWithDiagnostics;
  if (asArray(candidate.diagnostics).length > 0) return DISPOSITIONS.passedWithDiagnostics;

  return DISPOSITIONS.cleanRecovery;
}

/**
 * May this run close the incident it was dispatched for?
 *
 * Only a clean recovery. `passed_with_diagnostics` deliberately does not qualify:
 * an aggregate that passes while a case still reports an unexplained route is the
 * exact state run 34122919100 was in, and reading it as resolved is how the
 * residual survived.
 *
 * @param {CanaryDisposition} disposition
 */
export function mayCloseCanaryIncident(disposition) {
  return disposition === DISPOSITIONS.cleanRecovery;
}

/**
 * A stable marker so repeated publication updates one comment rather than
 * stacking another. The workflow's existing dedupe is "reuse the first open issue
 * carrying the label", which dedupes the ISSUE but not the comments on it.
 *
 * @param {{runId?: string|number, runAttempt?: string|number, evaluatedSha?: string|null, scope?: string}} identity
 */
export function canaryPublicationMarker(identity = {}) {
  const runId = String(identity.runId ?? "unknown");
  const attempt = String(identity.runAttempt ?? "1");
  const sha = String(identity.evaluatedSha ?? "unknown").slice(0, 12);
  const scope = String(identity.scope ?? "default");
  return `<!-- eval-canary:run=${runId}:attempt=${attempt}:sha=${sha}:scope=${scope} -->`;
}

export { DISPOSITIONS as CANARY_DISPOSITIONS };
