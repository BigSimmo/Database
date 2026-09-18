/**
 * How the worker reads the answer from an atomic job-transition RPC.
 *
 * `complete_ingestion_job` and `fail_or_retry_ingestion_job` are the two calls
 * that move a job out of `processing`. Both are fenced on `locked_by = p_worker_id`
 * inside one transaction, and both answer with an explicit boolean:
 *
 *   {"ok": true,  "job_id": …, "document_id": …}
 *   {"ok": false, "reason": "lease_lost", …}
 *
 * There is no third answer. `ok` is written by `jsonb_build_object` on every
 * return path in supabase/schema.sql, so a payload that is null, an empty object,
 * or missing `ok` did not come from a successful call — it means the RPC was not
 * the function we think it is, or the response was truncated or rewritten in
 * transit.
 *
 * WHY THIS IS ITS OWN DECISION. The call sites used to read
 * `(data as {ok?: boolean} | null)?.ok === false`, which asks only "did it
 * explicitly say no". Everything else — including `null` and `{}` — fell through
 * as success, and the worker went on to invalidate caches and supersede sibling
 * jobs on the strength of a reply it never actually read. The same file already
 * had the safe idiom: `completeStrictEnrichmentJob` requires `ok === true` and
 * names its own failure `missing_result`. These two simply disagreed with it.
 *
 * Failing closed here is cheap. A job left in `processing` is reclaimed by the
 * documented lease-recovery path once `WORKER_STALE_AFTER_MINUTES` elapses; a job
 * wrongly marked complete is a document that silently never finishes indexing and
 * nothing ever retries.
 */
export type JobTransitionOutcome =
  { kind: "committed" } | { kind: "lease_lost" } | { kind: "undecided"; reason: "missing_result" | "malformed_result" };

export function decodeJobTransitionResult(data: unknown): JobTransitionOutcome {
  // PostgREST hands a scalar `returns jsonb` back directly, but a single-row
  // SETOF arrives as a one-element array. Accept both rather than depending on
  // which shape a given client version produced.
  const payload = Array.isArray(data) ? data[0] : data;

  if (payload === null || payload === undefined) return { kind: "undecided", reason: "missing_result" };
  if (typeof payload !== "object") return { kind: "undecided", reason: "malformed_result" };

  const ok = (payload as { ok?: unknown }).ok;
  if (ok === true) return { kind: "committed" };
  if (ok === false) return { kind: "lease_lost" };
  return { kind: "undecided", reason: "malformed_result" };
}

/**
 * Is this error "the function does not exist", as opposed to any other schema
 * cache complaint?
 *
 * The previous predicate was `/could not find the function|schema cache|PGRST20\d/i`,
 * and both halves of that were too wide to gate a write path on:
 *
 * - `schema cache` matches PostgREST's cache messages generically, including
 *   "Could not find the 'x' column ... in the schema cache" (PGRST204) and the
 *   embedding-relationship miss (PGRST200). Neither means the function is absent.
 * - `PGRST20\d` matches the whole PGRST200–PGRST209 family. PGRST202 is the
 *   function-not-found code; PGRST200, PGRST203 and PGRST204 are a missing
 *   relationship, an ambiguous overload, and a missing column.
 *
 * So a typo'd column or an ambiguous overload — both of which mean the call was
 * WRONG, not that the function is missing — selected the legacy fallback path.
 * That is the worst possible pairing: a broken call routed into an unfenced write.
 *
 * PGRST202 and its message text are the contract. Everything else is a genuine
 * error and is raised.
 */
export function isMissingFunctionError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  return /could not find the function/i.test(error.message ?? "");
}
