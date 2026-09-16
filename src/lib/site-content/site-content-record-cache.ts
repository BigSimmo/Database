/**
 * Short-lived process cache for the canonical site-content catalogue read.
 *
 * WHY THIS EXISTS. Until 2026-09-09 the registry domains of universal search read their
 * catalogue through `owner-catalogue-cache` (5 s TTL, single flight, LRU) and asked Postgres for
 * roughly twenty named ranking columns, and only for a signed-in owner. Commit b753ed2b1
 * replaced all of that with `read_site_content_public_records`, which is the right source of
 * truth but arrived with no cache, the full `record` and `render_payload` JSON per row, and
 * every caller rather than owners alone. `src/lib/universal-search.ts` calls it once per registry
 * domain per search, so one federated search became three uncached round trips for a catalogue
 * that changes only when an operator publishes, and a debounced typeahead multiplied that again.
 * Search went from effectively instant to visibly slow across every catalogue mode at once.
 *
 * This restores the cache half. The wide payload is a property of the SQL function and cannot be
 * narrowed from here without a migration, which reaches the live clinical database on merge.
 *
 * The rows are a pure function of (kind, slug) plus the control plane's served state, and the
 * function is the PUBLIC projection, so nothing here is owner-scoped or per-request and one
 * process-wide cache is safe. That is not incidental: never widen this to a read that takes an
 * owner, a session or any caller identity.
 *
 * HOW STALENESS IS BOUNDED. A plain TTL still makes one unlucky reader per window wait for the
 * whole query, which is the symptom this exists to remove. So a cached entry has two ages:
 *
 *   * Within `siteContentRecordCacheTtlMs` it is fresh and served as is.
 *   * Between that and `siteContentRecordCacheStaleMs` it is served IMMEDIATELY and a refresh
 *     runs in the background. Nobody waits, and under any continued use the served catalogue is
 *     never more than the fresh window plus one query behind the database.
 *   * Beyond `siteContentRecordCacheStaleMs` it is discarded and the caller waits for a real
 *     read, so an idle process cannot serve something genuinely old.
 *
 * CONSERVATIVE BY CONSTRUCTION. Three rules keep a cache from prolonging a degraded or
 * mid-publication state, which on clinical content matters more than the latency it buys:
 *
 *   1. Only a `current` snapshot is stored. `updating` (a publication is outstanding) and
 *      `unavailable` (no valid release) are re-read every time, so a degraded catalogue is
 *      re-checked on each request rather than pinned for the whole window.
 *   2. A failed blocking read is never stored and never served. The caller's existing fallback
 *      to the in-bundle seed catalogue stays reachable. A failed BACKGROUND refresh is
 *      different and deliberately does not evict: the last known-good canonical rows keep
 *      serving until their stale ceiling, because they are a better answer than seeds and the
 *      ceiling still bounds how long that can last.
 *   3. The windows are a ceiling on how long a freshly published record can stay invisible to
 *      search. Keep them short enough that an operator publishing a change does not think the
 *      publication failed.
 */

/** How long a cached catalogue is served without any refresh at all. */
export const siteContentRecordCacheTtlMs = 15_000;

/**
 * How long a cached catalogue may still be served while a refresh runs behind it. Past this it
 * is discarded rather than served, so an idle container cannot answer from something old.
 */
export const siteContentRecordCacheStaleMs = 10 * 60_000;

/**
 * Hard cap on retained keys. Search caches five list reads at most (one per kind), so this is
 * never reached today. It exists because the key includes a caller-supplied slug: the day a
 * per-slug read opts in, an unbounded map keyed by slug becomes a memory-growth path in a
 * long-lived container, and a cap is a cheaper guarantee than remembering not to do that.
 */
export const siteContentRecordCacheMaxEntries = 32;

/**
 * Deadline on a background refresh. A blocking read is bounded by its caller's own abort signal,
 * but a refresh has no caller, so this is what stops one hung query from becoming a permanently
 * hung flight that every later reader joins.
 */
export const siteContentRecordCacheRefreshTimeoutMs = 10_000;

export type SiteContentRecordRows = Array<Record<string, unknown>>;

/** Which of the three ages answered this call. Reported for tests and telemetry, not policy. */
export type SiteContentRecordCacheAge = "fresh" | "stale" | "miss";

type CacheEntry = { rows: SiteContentRecordRows; storedAt: number };

type Inflight = {
  promise: Promise<SiteContentRecordRows>;
  controller: AbortController;
  waiters: number;
  settled: boolean;
  /** A background refresh has no waiters by design, so last-waiter cancellation must skip it. */
  background: boolean;
};

const entries = new Map<string, CacheEntry>();
const inflight = new Map<string, Inflight>();

/** `kind` is a fixed control-plane enum, so a literal separator cannot collide with a slug. */
function cacheKey(kind: string, slug: string | null) {
  return `${kind}::${slug ?? ""}`;
}

/**
 * The snapshot the RPC returns alongside every row. A payload we cannot read is treated as not
 * cacheable rather than assumed healthy.
 *
 * `current` is cacheable by rule 1. So is a valid retained epoch-zero bootstrap, which needs its
 * own paragraph because reading rule 1 literally is what made this whole cache inert.
 *
 * `read_site_content_public_records` collapses three different situations into the single state
 * `unavailable`: no valid release, not initialized, and an active release that is one of the
 * retained bootstraps. The first is genuinely degraded. The third is not — it is the frozen
 * epoch-zero catalogue, it is what production has served since 2026-08-24, and it cannot change
 * without a migration or a publication. Refusing to cache it meant the live site never cached
 * anything at all, and paid the full canonical read on every request.
 *
 * `releaseId` is the discriminator, and it is exact rather than a heuristic: SQL emits it as
 * `case when s.valid then s.active_release_id else null end`, and for a bootstrap `s.valid`
 * is only true once the stored release digest matches a freshly computed one. So a non-null
 * `releaseId` means the release passed that check on this very read.
 *
 * A record row must also be present. While a publication is outstanding a list read returns no
 * records at all, and caching that would pin an empty catalogue for the fresh window — exactly
 * the mid-publication pinning rule 1 exists to prevent. An empty answer is therefore never
 * stored, so it is re-read every time.
 */
function rowsAreCacheable(rows: SiteContentRecordRows) {
  const snapshot = rows.find((row) => row.snapshot != null)?.snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
  const state = (snapshot as Record<string, unknown>).state;
  if (state === "current") return true;
  if (state !== "unavailable") return false;
  const releaseId = (snapshot as Record<string, unknown>).releaseId;
  if (typeof releaseId !== "string" || releaseId.length === 0) return false;
  return rows.some((row) => row.record != null);
}

/**
 * Retain `rows` under `key`, dropping anything past its stale ceiling and then, if the cap is
 * still exceeded, the least recently stored key. `Map` iterates in insertion order and every
 * store re-inserts, so the first key is the oldest.
 */
function retain(key: string, rows: SiteContentRecordRows, now: () => number) {
  const at = now();
  for (const [candidate, entry] of entries) {
    if (at - entry.storedAt >= siteContentRecordCacheStaleMs) entries.delete(candidate);
  }
  entries.delete(key);
  entries.set(key, { rows, storedAt: at });
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

type Read = (signal?: AbortSignal) => Promise<SiteContentRecordRows>;

/**
 * Start a read for `key`, or return the one already running. A background refresh and a
 * blocking read share the same flight, so a reader arriving mid-refresh waits for that refresh
 * rather than starting a second identical query.
 */
function startFlight(key: string, read: Read, now: () => number, background: boolean): Inflight {
  const existing = inflight.get(key);
  // Never join a flight whose last waiter already cancelled it. Otherwise join it as it is:
  // a blocking flight stays cancellable by its last waiter, and a background refresh stays
  // exempt, so a reader who joins a refresh and then walks away cannot cancel it.
  if (existing && !existing.controller.signal.aborted) return existing;
  if (existing && inflight.get(key) === existing) inflight.delete(key);

  const controller = new AbortController();
  const created: Inflight = {
    promise: Promise.resolve([]),
    controller,
    waiters: 0,
    settled: false,
    background,
  };
  // A background refresh has no waiter to cancel it, so without its own deadline a refresh that
  // never settles is held in `inflight` forever: past the stale ceiling every later caller joins
  // that hung flight and waits on it, and nothing recovers until the process restarts.
  const refreshDeadline = background
    ? setTimeout(() => {
        controller.abort(new DOMException("Site-content catalogue refresh timed out.", "TimeoutError"));
      }, siteContentRecordCacheRefreshTimeoutMs)
    : undefined;
  (refreshDeadline as { unref?: () => void } | undefined)?.unref?.();

  created.promise = (async () => {
    const rows = await read(controller.signal);
    // Rule 1: a snapshot that is no longer `current` must EVICT, not merely decline to store.
    // Leaving the previous rows in place would keep serving a catalogue the control plane is
    // deliberately suppressing mid-publication, for the rest of the stale window.
    if (rowsAreCacheable(rows)) retain(key, rows, now);
    else entries.delete(key);
    return rows;
  })().finally(() => {
    created.settled = true;
    if (refreshDeadline !== undefined) clearTimeout(refreshDeadline);
    if (inflight.get(key) === created) inflight.delete(key);
  });
  inflight.set(key, created);
  return created;
}

/**
 * Serve `kind`/`slug` from cache where possible, refreshing behind the reader when the entry is
 * merely stale, and otherwise running `read` once and sharing that flight with every concurrent
 * caller for the same key.
 *
 * Sharing the flight matters on a cold cache: without it the first search of a session still
 * issues one query per domain, and a burst of users on a cold container stampedes the same
 * expensive read. A blocking flight is cancelled only when its LAST waiter aborts, so one
 * abandoned typeahead request cannot cancel the query another caller is still waiting on.
 */
export async function readSiteContentRecordsCached(input: {
  kind: string;
  slug: string | null;
  signal?: AbortSignal;
  read: Read;
  now?: () => number;
}): Promise<{ rows: SiteContentRecordRows; age: SiteContentRecordCacheAge }> {
  const now = input.now ?? Date.now;
  const key = cacheKey(input.kind, input.slug);

  const cached = entries.get(key);
  if (cached) {
    const age = now() - cached.storedAt;
    if (age < siteContentRecordCacheTtlMs) {
      input.signal?.throwIfAborted();
      return { rows: cached.rows, age: "fresh" };
    }
    if (age < siteContentRecordCacheStaleMs) {
      input.signal?.throwIfAborted();
      // Refresh behind the reader. A failure here deliberately leaves the entry in place: see
      // rule 2. The rejection is consumed so it cannot surface as an unhandled rejection.
      void startFlight(key, input.read, now, true).promise.catch(() => {});
      return { rows: cached.rows, age: "stale" };
    }
    entries.delete(key);
  }

  const entry = startFlight(key, input.read, now, false);
  entry.waiters += 1;
  try {
    return { rows: await awaitWithCallerSignal(entry.promise, input.signal), age: "miss" };
  } finally {
    entry.waiters -= 1;
    // Drop the entry before aborting so a fresh caller cannot join a dying flight. A background
    // refresh is exempt: it has no waiters by design and must be allowed to finish.
    if (entry.waiters === 0 && !entry.settled && !entry.background) {
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
