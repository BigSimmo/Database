/**
 * Counts Supabase round trips for one scenario, so adding a round trip to a hot
 * path becomes a red gate instead of something a reviewer has to notice.
 *
 * Ledger `#098`. The latency audit's findings were argued from reading code —
 * "this awaits before that", "these two could overlap" — and the fixes were
 * verified the same way. Nothing pinned the resulting counts, so a later
 * refactor could reintroduce a round trip silently. This is the guard.
 *
 * **What counts as one round trip.** One `.rpc(name)` call, or one `.from(table)`
 * chain. Builder methods (`.select`, `.eq`, `.order`, `.limit`, …) are
 * deliberately NOT counted: they are fluent and issue nothing on their own, so
 * counting them would measure query *style* rather than network cost, and would
 * change every time someone added a filter. One chain is one trip regardless of
 * how many links it has.
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

type MinimalSupabaseClient = {
  rpc?: (...args: never[]) => unknown;
  from?: (...args: never[]) => unknown;
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

  if (typeof client.rpc === "function") {
    const original = client.rpc.bind(client) as (...args: unknown[]) => unknown;
    (wrapped as MinimalSupabaseClient).rpc = ((...args: unknown[]) => {
      record("rpc", args[0]);
      return original(...args);
    }) as T["rpc"];
  }
  if (typeof client.from === "function") {
    const original = client.from.bind(client) as (...args: unknown[]) => unknown;
    (wrapped as MinimalSupabaseClient).from = ((...args: unknown[]) => {
      record("from", args[0]);
      return original(...args);
    }) as T["from"];
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
