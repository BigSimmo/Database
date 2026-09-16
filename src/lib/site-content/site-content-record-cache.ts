/**
 * Short-lived process cache for the canonical site-content catalogue read.
 *
 * WHY THIS EXISTS: `read_site_content_public_records(kind, slug)` is on the search request
 * path. `src/lib/universal-search.ts` calls it once per registry domain per search with no
 * reuse between calls, so a single federated search issues three separate PostgREST round
 * trips (medications, services, forms) for a catalogue that changes only when an operator
 * publishes. Typeahead multiplies that again across a debounced keystroke sequence.
 *
 * The rows are a pure function of (kind, slug) plus the control plane's served state, and the
 * function is the PUBLIC projection, so nothing here is owner-scoped or per-request and one
 * process-wide cache is safe. That is not incidental: never widen this to a read that takes an
 * owner, a session or any caller identity.
 *
 * CONSERVATIVE BY CONSTRUCTION. Three rules keep a cache from prolonging a degraded or
 * mid-publication state, which on clinical content matters more than the latency it buys:
 *
 *   1. Only a `current` snapshot is stored. `updating` (a publication is outstanding) and
 *      `unavailable` (no valid release) are re-read every time, so a degraded catalogue is
 *      re-checked on each request rather than pinned for the whole TTL.
 *   2. Failures are never stored and never served. There is no stale-while-error path: an
 *      error reaches the caller, which already falls back to the in-bundle seed catalogue.
 *   3. The TTL is a ceiling on how long a freshly published record can stay invisible to
 *      search. Keep it short enough that an operator publishing a change does not think the
 *      publication failed, which is what `siteContentRecordCacheTtlMs` is sized against.
 */

/** Ceiling on how long a published catalogue change can stay invisible to search. */
export const siteContentRecordCacheTtlMs = 15_000;

/**
 * Hard cap on retained keys. Search caches five list reads at most (one per kind), so this is
 * never reached today. It exists because the key includes a caller-supplied slug: the day a
 * per-slug read opts in, an unbounded map keyed by slug becomes a memory-growth path in a
 * long-lived container, and a cap is a cheaper guarantee than remembering not to do that.
 */
export const siteContentRecordCacheMaxEntries = 32;

export type SiteContentRecordRows = Array<Record<string, unknown>>;

type CacheEntry = { rows: SiteContentRecordRows; expiresAt: number };

type Inflight = {
  promise: Promise<SiteContentRecordRows>;
  controller: AbortController;
  waiters: number;
  settled: boolean;
};

const entries = new Map<string, CacheEntry>();
const inflight = new Map<string, Inflight>();

/** `kind` is a fixed control-plane enum, so a literal separator cannot collide with a slug. */
function cacheKey(kind: string, slug: string | null) {
  return `${kind}::${slug ?? ""}`;
}

/**
 * The snapshot the RPC returns alongside every row. Only `current` is cacheable; see rule 1.
 * A payload we cannot read is treated as not cacheable rather than assumed healthy.
 */
function rowsAreCacheable(rows: SiteContentRecordRows) {
  const snapshot = rows.find((row) => row.snapshot != null)?.snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
  return (snapshot as Record<string, unknown>).state === "current";
}

/**
 * Retain `rows` under `key`, dropping anything already expired and then, if the cap is still
 * exceeded, the least recently stored key. `Map` iterates in insertion order and every store
 * re-inserts, so the first key is the oldest.
 */
function retain(key: string, rows: SiteContentRecordRows, now: () => number) {
  const at = now();
  for (const [candidate, entry] of entries) if (entry.expiresAt <= at) entries.delete(candidate);
  entries.delete(key);
  entries.set(key, { rows, expiresAt: at + siteContentRecordCacheTtlMs });
  while (entries.size > siteContentRecordCacheMaxEntries) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

function callerAbortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError");
}

function awaitWithCallerSignal<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(callerAbortReason(signal));
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(callerAbortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

/**
 * Serve `kind`/`slug` from cache when a `current` snapshot is still fresh, otherwise run
 * `read` once and share that single flight with every concurrent caller for the same key.
 *
 * Sharing the flight matters on a cold cache: without it the first search of a session still
 * issues one query per domain, and a burst of users on a cold container stampedes the same
 * expensive read. The shared query is cancelled only when its LAST waiter aborts, so one
 * abandoned typeahead request cannot cancel the query another caller is still waiting on.
 */
export async function readSiteContentRecordsCached(input: {
  kind: string;
  slug: string | null;
  signal?: AbortSignal;
  read: (signal?: AbortSignal) => Promise<SiteContentRecordRows>;
  now?: () => number;
}): Promise<{ rows: SiteContentRecordRows; hit: boolean }> {
  const now = input.now ?? Date.now;
  const key = cacheKey(input.kind, input.slug);

  const cached = entries.get(key);
  if (cached && cached.expiresAt > now()) {
    input.signal?.throwIfAborted();
    return { rows: cached.rows, hit: true };
  }
  if (cached) entries.delete(key);

  let entry = inflight.get(key);
  // Never join a flight whose last waiter already cancelled it.
  if (entry?.controller.signal.aborted) {
    if (inflight.get(key) === entry) inflight.delete(key);
    entry = undefined;
  }
  const hit = Boolean(entry);
  if (!entry) {
    const controller = new AbortController();
    const created: Inflight = { promise: Promise.resolve([]), controller, waiters: 0, settled: false };
    created.promise = (async () => {
      const rows = await input.read(controller.signal);
      // Rule 1 and rule 2: only a healthy, readable, `current` snapshot is retained, and a
      // rejection propagates without ever reaching this line.
      if (rowsAreCacheable(rows)) retain(key, rows, now);
      return rows;
    })().finally(() => {
      created.settled = true;
      if (inflight.get(key) === created) inflight.delete(key);
    });
    inflight.set(key, created);
    entry = created;
  }

  entry.waiters += 1;
  try {
    return { rows: await awaitWithCallerSignal(entry.promise, input.signal), hit };
  } finally {
    entry.waiters -= 1;
    // Drop the entry before aborting so a fresh caller cannot join a dying flight.
    if (entry.waiters === 0 && !entry.settled) {
      if (inflight.get(key) === entry) inflight.delete(key);
      entry.controller.abort();
    }
  }
}

/** Test seam, and the hook an explicit publication-time invalidation would use. */
export function clearSiteContentRecordCache() {
  entries.clear();
  inflight.clear();
}
