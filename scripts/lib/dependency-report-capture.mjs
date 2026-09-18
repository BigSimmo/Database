/**
 * dependency-report-capture — turn a raw `npm outdated` / `npm audit` invocation
 * into a result that can say "I do not know".
 *
 * WHY THIS EXISTS. The report used to collapse three different situations into
 * one rendered sentence:
 *
 *   1. npm ran, and found nothing        → "none 🎉"
 *   2. npm ran, and printed nothing      → "none 🎉"
 *   3. npm failed, or printed garbage    → "none 🎉"
 *
 * Only the first is an observation. The other two are the absence of one, and a
 * fortnightly report that answers "are we carrying vulnerabilities?" with a
 * confident "no" when it never found out is worse than no report: it is a report
 * that is believed. `{"metadata":{"vulnerabilities":{}}}` was the sharpest case —
 * every count defaulted to zero, so a payload carrying no counts at all rendered
 * as "0 total — critical 0, high 0, moderate 0, low 0, info 0".
 *
 * So every check now lands in one of three states, and "unavailable" is a first
 * class one that survives all the way to the workflow output. `severity=none` is
 * reserved for a validated empty result; an unmeasured audit emits
 * `severity=unknown`, which the workflow treats as missing evidence rather than
 * as good news.
 *
 * A non-zero exit is NOT by itself unavailability: `npm outdated` and `npm audit`
 * both exit non-zero merely because findings exist (npm CLI v11 documents this for
 * audit). What matters is whether the payload validates, so the exit status is
 * only consulted to tell an empty SUCCESSFUL run from an empty FAILED one.
 */

/** @typedef {"process_failed"|"timeout"|"malformed_json"|"invalid_shape"|"npm_error_payload"} ReasonCode */

/**
 * @typedef {object} CaptureInput
 * @property {string} stdout   what the command wrote to stdout (possibly empty)
 * @property {number|null} [status]  exit status, or null when it never exited
 * @property {string|null} [signal]  terminating signal, when killed
 * @property {boolean} [failed]      true when the spawn itself threw
 */

const SEVERITY_KEYS = ["info", "low", "moderate", "high", "critical"];

function nowIso() {
  return new Date().toISOString();
}

/** @returns {{state: "unavailable", value: null, reasonCode: ReasonCode, observedAt: string}} */
function unavailable(reasonCode) {
  return { state: "unavailable", value: null, reasonCode, observedAt: nowIso() };
}

function available(state, value) {
  return { state, value, observedAt: nowIso() };
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse stdout, distinguishing "nothing to parse" from "could not parse".
 * Returns `{ ok: true, value }`, or `{ ok: false, reasonCode }`, or
 * `{ ok: true, empty: true }` when stdout held no JSON at all.
 */
function parsePayload(stdout) {
  const text = typeof stdout === "string" ? stdout.trim() : "";
  if (!text) return { ok: true, empty: true };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reasonCode: "malformed_json" };
  }
}

/** Did the command itself fail, as opposed to merely reporting findings? */
function processFailureReason(capture) {
  if (capture?.signal) return "timeout";
  if (capture?.failed && capture?.status == null) return "process_failed";
  return null;
}

/**
 * Validate `npm outdated --json` output: a map of package name → version record.
 *
 * Rejected: arrays, strings, an `{ error: … }` payload npm emits on registry or
 * auth failure, and rows that are not objects or carry no usable version string.
 * A row with none of current/wanted/latest cannot be rendered or acted on, so
 * counting it as a finding would overstate what was measured.
 */
export function classifyOutdatedCapture(capture) {
  const processFailure = processFailureReason(capture);
  const parsed = parsePayload(capture?.stdout);

  if (!parsed.ok) return unavailable(parsed.reasonCode);
  if (parsed.empty) {
    // `npm outdated` prints nothing at all in some versions when everything is
    // current. That is a real empty observation — but ONLY if it exited cleanly.
    if (processFailure) return unavailable(processFailure);
    if (typeof capture?.status === "number" && capture.status !== 0) return unavailable("process_failed");
    return available("ok", {});
  }

  const value = parsed.value;
  if (!isPlainObject(value)) return unavailable("invalid_shape");
  if ("error" in value) return unavailable("npm_error_payload");
  if (processFailure) return unavailable(processFailure);

  for (const row of Object.values(value)) {
    if (!isPlainObject(row)) return unavailable("invalid_shape");
    const usable = ["current", "wanted", "latest"].some(
      (key) => typeof row[key] === "string" && row[key].trim().length > 0,
    );
    if (!usable) return unavailable("invalid_shape");
  }

  return available(Object.keys(value).length === 0 ? "ok" : "findings", value);
}

/**
 * Validate `npm audit --json` output against its metadata schema.
 *
 * All six counts must be present, finite, non-negative integers, and `total` must
 * equal their sum. An empty `vulnerabilities` object is NOT a valid zero-finding
 * observation — it is a payload that never reported counts, and it was the source
 * of the false "0 total" line this module replaces.
 */
export function classifyAuditCapture(capture) {
  const processFailure = processFailureReason(capture);
  const parsed = parsePayload(capture?.stdout);

  if (!parsed.ok) return unavailable(parsed.reasonCode);
  if (parsed.empty) return unavailable(processFailure ?? "process_failed");

  const value = parsed.value;
  if (!isPlainObject(value)) return unavailable("invalid_shape");
  if ("error" in value) return unavailable("npm_error_payload");
  if (processFailure) return unavailable(processFailure);

  const vulnerabilities = value?.metadata?.vulnerabilities;
  if (!isPlainObject(vulnerabilities)) return unavailable("invalid_shape");

  const counts = {};
  for (const key of [...SEVERITY_KEYS, "total"]) {
    const count = vulnerabilities[key];
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return unavailable("invalid_shape");
    counts[key] = count;
  }

  const sum = SEVERITY_KEYS.reduce((running, key) => running + counts[key], 0);
  if (sum !== counts.total) return unavailable("invalid_shape");

  return available(counts.total === 0 ? "ok" : "findings", value);
}

/**
 * Validate a `--input` fixture exactly as npm output is validated.
 *
 * A fixture must not receive a more permissive path than the real command, or the
 * tests prove something the production path does not do. A fixture that omits a
 * key is an unavailable measurement, not an empty one — the file simply never
 * said what was observed.
 */
export function classifyFixturePayload(text) {
  const parsed = parsePayload(text);
  if (!parsed.ok) {
    return { outdated: unavailable("malformed_json"), audit: unavailable("malformed_json") };
  }
  if (parsed.empty || !isPlainObject(parsed.value)) {
    return { outdated: unavailable("invalid_shape"), audit: unavailable("invalid_shape") };
  }

  const payload = parsed.value;
  const asCapture = (key) =>
    key in payload ? { stdout: JSON.stringify(payload[key]), status: 0 } : { stdout: "", status: 0, failed: true };

  return {
    outdated: "outdated" in payload ? classifyOutdatedCapture(asCapture("outdated")) : unavailable("invalid_shape"),
    audit: "audit" in payload ? classifyAuditCapture(asCapture("audit")) : unavailable("invalid_shape"),
  };
}

export const DEPENDENCY_REPORT_SEVERITY_KEYS = SEVERITY_KEYS;
