/**
 * Whether a rejection is an expired deadline rather than a fault in the thing being called.
 *
 * This lives in its own module, away from the clients that use it, for a reason worth keeping:
 * it is a pure predicate that several request paths need, and reaching it through
 * `@/lib/supabase/health` coupled it to a module that tests routinely replace wholesale. A test
 * that mocks that module for its own reasons would silently take this rule with it, and the
 * failure mode is indirect — the mocked namespace has no such export, the destructure throws, and
 * the caller's outer handler reports a database fault that never happened.
 *
 * `AbortSignal.timeout()` rejects with a `TimeoutError` DOMException and `AbortController.abort()`
 * with an `AbortError`; neither message matches the provider error patterns those callers test
 * for, so without this an expired deadline is misfiled as a query fault and points the next
 * investigation at the wrong system.
 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}
