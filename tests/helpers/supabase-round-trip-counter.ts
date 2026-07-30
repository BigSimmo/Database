/**
 * Counts Supabase round trips for one scenario, so adding a round trip to a hot
 * path becomes a red gate instead of something a reviewer has to notice.
 *
 * Ledger `#098`. The latency audit's findings were argued from reading code —
 * "this awaits before that", "these two could overlap" — and the fixes were
 * verified the same way. Nothing pinned the resulting counts, so a later
 * refactor could reintroduce a round trip silently. This is the guard.
 *
 * **What counts as one round trip: execution, not construction.** A Supabase
 * builder issues its request when it is awaited, not when `.from()` creates it.
 * So the trip is recorded when the returned thenable is executed (`then` is
 * invoked), and `.from()` / `.rpc()` on their own record nothing. Builder
 * methods (`.select`, `.eq`, `.order`, …) are fluent and never counted.
 *
 * This distinction is load-bearing rather than pedantic, and the first version
 * of this helper got it wrong (Codex P2, 2026-07-30). Counting at `.from()`
 * would charge a trip for a query that was built and abandoned, and would charge
 * only one for a builder awaited twice — which really is two requests. Both
 * cases are pinned by tests.
 *
 * **Known limitation.** A promise, unlike a builder, memoises: awaiting the same
 * promise twice performs one request but invokes `then` twice, so it would be
 * counted twice. Real `from()`/`rpc()` return lazy builders where re-execution
 * genuinely re-requests, so this only misleads for code that deliberately
 * re-awaits a stored promise. Stated rather than silently assumed away.
 *
 * **What this cannot see.** Only calls made through the wrapped client. A
 * round trip issued via a different client instance, a direct `fetch`, or a
 * provider SDK is invisible here — so a budget assertion is evidence about
 * this client's traffic, not proof of total request cost. Say that rather than
 * implying the latter.
 *
 * Provider-free and DB-free: this wraps whatever stub the suite already builds.
 */

/** One recorded call. `name` is the RPC name or the table name. */
export type SupabaseRoundTrip = { readonly kind: "rpc" | "from"; readonly name: string };

export interface SupabaseRoundTripCounter {
  /** Every recorded trip, in call order. Order matters for admission-before-scope style checks. */
  readonly trips: readonly SupabaseRoundTrip[];
  /** Total round trips through this client. */
  total(): number;
  /** Trips of one kind. */
  count(kind: "rpc" | "from"): number;
  /** How many times a specific RPC or table was hit. */
  countOf(name: string): number;
  /** `{ "rpc:match_document_chunks_text_v2": 1, "from:documents": 2 }` — for a readable failure message. */
  breakdown(): Record<string, number>;
  /** Drop everything recorded so far, e.g. between phases of one scenario. */
  reset(): void;
}

// Method syntax, and `never[]` params, both deliberate: method signatures are
// bivariant and `never` is assignable to anything, so a concrete stub such as
// `(name: string) => Promise<...>` satisfies this constraint. Property syntax
// with `unknown[]` looks tidier but rejects every real stub, because a parameter
// typed `unknown` is not assignable to one typed `string`.
type MinimalSupabaseClient = {
  rpc?(...args: never[]): unknown;
  from?(...args: never[]): unknown;
};

/**
 * Wraps `client` so every `.rpc()` and `.from()` is recorded, returning the
 * wrapper and its counter. The wrapper delegates to the original, so the
 * suite's existing stub behaviour is unchanged — this only observes.
 */
export function countSupabaseRoundTrips<T extends MinimalSupabaseClient>(
  client: T,
): { client: T; counter: SupabaseRoundTripCounter } {
  const trips: SupabaseRoundTrip[] = [];
  const record = (kind: "rpc" | "from", name: unknown) => {
    trips.push({ kind, name: typeof name === "string" ? name : String(name) });
  };

  // Spread rather than mutate: the caller's stub may be reused by another
  // scenario in the same file, and silently attaching counters to it would
  // make the two scenarios share state.
  const wrapped = { ...client } as T;

  /**
   * Wraps a builder (or promise) so the trip is recorded when it executes.
   * Fluent methods return the builder, so their results are re-wrapped to keep
   * the pending trip attached however long the chain gets.
   */
  const trackExecution = (target: unknown, kind: "rpc" | "from", name: unknown): unknown => {
    if (target === null || (typeof target !== "object" && typeof target !== "function")) return target;
    return new Proxy(target as object, {
      get(obj, prop, receiver) {
        const value = Reflect.get(obj, prop, receiver);
        if (typeof value !== "function") return value;

        if (prop === "then") {
          // Execution. Record once per execution, so two awaits are two trips.
          return (...args: unknown[]) => {
            record(kind, name);
            return (value as (...a: unknown[]) => unknown).apply(obj, args);
          };
        }
        return (...args: unknown[]) => {
          const result = (value as (...a: unknown[]) => unknown).apply(obj, args);
          // Fluent link (`return this`) or a derived builder — keep tracking.
          return result === obj || (result !== null && typeof result === "object" && "then" in (result as object))
            ? trackExecution(result, kind, name)
            : result;
        };
      },
    });
  };

  for (const method of ["rpc", "from"] as const) {
    if (typeof client[method] !== "function") continue;
    const original = (client[method] as (...args: unknown[]) => unknown).bind(client);
    (wrapped as MinimalSupabaseClient)[method] = ((...args: unknown[]) =>
      trackExecution(original(...args), method, args[0])) as T[typeof method];
  }

  const counter: SupabaseRoundTripCounter = {
    trips,
    total: () => trips.length,
    count: (kind) => trips.filter((trip) => trip.kind === kind).length,
    countOf: (name) => trips.filter((trip) => trip.name === name).length,
    breakdown: () =>
      trips.reduce<Record<string, number>>((acc, trip) => {
        const key = `${trip.kind}:${trip.name}`;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    reset: () => {
      trips.length = 0;
    },
  };

  return { client: wrapped, counter };
}
