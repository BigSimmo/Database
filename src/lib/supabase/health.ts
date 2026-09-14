type ProbeError = { message?: string; code?: string; details?: string; hint?: string } | null;
type ProbeResult = PromiseLike<{ error: ProbeError }> & {
  // PostgREST's builder carries this; the structural type keeps it optional so a hand-rolled
  // test double is not forced to implement cancellation it never needs.
  abortSignal?: (signal: AbortSignal) => PromiseLike<{ error: ProbeError }>;
};

type SupabaseProbeClient = {
  from(table: string): {
    select(
      columns: string,
      options?: Record<string, unknown>,
    ): {
      limit(count: number): ProbeResult;
    };
  };
};

export type SupabaseHealthResult =
  | { ok: true; checkedAt: string }
  | {
      ok: false;
      checkedAt: string;
      failureKind: "unavailable" | "query";
      message: string;
      rawMessage: string;
    };

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

/**
 * An expired `AbortSignal` deadline, as distinct from a provider fault. `AbortSignal.timeout()`
 * rejects with a `TimeoutError` DOMException whose message ("The operation was aborted due to
 * timeout") matches none of the provider patterns below, so it needs its own test.
 */
function isAbortError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}

export function isSupabaseUnavailableError(error: unknown) {
  const message = errorMessage(error);
  return /<!doctype html|<html[\s>]|522|544|504|520|connection terminated|connection timeout|statement timeout|fetch failed|network|ECONNRESET|ETIMEDOUT/i.test(
    message,
  );
}

export function formatSupabaseUnavailableError(error: unknown) {
  const message = errorMessage(error);
  const title = message
    .match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
  if (title) return `Supabase is temporarily unavailable (${title}).`;
  if (/connection terminated/i.test(message)) return "Supabase SQL connection was terminated due to a timeout.";
  if (/statement timeout/i.test(message)) return "Supabase cancelled the query due to statement timeout.";
  if (/544/.test(message)) return "Supabase Storage is timing out with a 544 response.";
  if (/522/.test(message)) return "Supabase API is timing out with a 522 response.";
  if (/504/.test(message)) return "Supabase API is timing out with a 504 response.";
  return message
    ? `Supabase is temporarily unavailable: ${message.slice(0, 240)}`
    : "Supabase is temporarily unavailable.";
}

/**
 * `signal` bounds the probe. It is optional because most callers are scripts and workers with no
 * deadline to keep, but `/api/health/ready` must always pass one: it is Railway's healthcheck
 * target, Railway allows each attempt ten seconds, and an unbounded call cannot answer before
 * that window closes. A deployment that cannot answer is discarded and rolled back, which is how
 * this project lost three days of releases (`docs/deployment-architecture.md` § Readiness).
 *
 * An expired deadline is reported as an ordinary unhealthy result rather than thrown, so every
 * caller's existing failure handling is unchanged. It is classified explicitly below rather than
 * left to the string matching in `isSupabaseUnavailableError`, whose patterns are provider error
 * text and do not match an abort — silently mislabelling a deadline as a query fault is the sort
 * of thing that sends the next investigation to the wrong place.
 */
export async function probeSupabaseHealth(
  supabase: SupabaseProbeClient,
  signal?: AbortSignal,
): Promise<SupabaseHealthResult> {
  const checkedAt = new Date().toISOString();
  try {
    signal?.throwIfAborted();
    const request = supabase.from("import_batches").select("id").limit(1);
    // Cancel the in-flight PostgREST request where the client supports it, rather than
    // abandoning the promise and leaving the query running against the database.
    const { error } = await (signal && request.abortSignal ? request.abortSignal(signal) : request);
    signal?.throwIfAborted();
    if (!error) return { ok: true, checkedAt };
    return {
      ok: false,
      checkedAt,
      failureKind: isSupabaseUnavailableError(error) ? "unavailable" : "query",
      message: isSupabaseUnavailableError(error)
        ? formatSupabaseUnavailableError(error)
        : "Supabase health check failed.",
      rawMessage: errorMessage(error),
    };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        ok: false,
        checkedAt,
        failureKind: "unavailable",
        message: "Supabase did not answer the health probe within its deadline.",
        rawMessage: errorMessage(error),
      };
    }
    return {
      ok: false,
      checkedAt,
      failureKind: isSupabaseUnavailableError(error) ? "unavailable" : "query",
      message: isSupabaseUnavailableError(error)
        ? formatSupabaseUnavailableError(error)
        : "Supabase health check failed.",
      rawMessage: errorMessage(error),
    };
  }
}

export function assertSupabaseHealthy(result: SupabaseHealthResult, action: string) {
  if (result.ok) return;
  throw new Error(`${action} is paused because ${result.message}`);
}
