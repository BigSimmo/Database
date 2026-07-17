export type OwnerCatalogueKind = "medication" | "service" | "form";

type OwnerCatalogueEntry = {
  ownerId: string;
  kind: OwnerCatalogueKind;
  limit: number;
  expiresAt: number;
  value: unknown[];
};

type OwnerCatalogueFlight = {
  ownerId: string;
  kind: OwnerCatalogueKind;
  limit: number;
  controller: AbortController;
  callers: number;
  settled: boolean;
  promise: Promise<unknown[]>;
};

const ownerCatalogueTtlMs = 5_000;
const ownerCatalogueMaxEntries = 128;
const ownerCatalogueCache = new Map<string, OwnerCatalogueEntry>();
const ownerCatalogueFlights = new Map<string, OwnerCatalogueFlight>();

function ownerCatalogueKey(ownerId: string, kind: OwnerCatalogueKind, limit: number) {
  return JSON.stringify([ownerId, kind, limit]);
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortReason(signal);
}

function readOwnerCatalogue<T>(key: string, now: number): T[] | undefined {
  const entry = ownerCatalogueCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    ownerCatalogueCache.delete(key);
    return undefined;
  }

  // LRU recency bump. The cached catalogue is independent of the search query, so every
  // typeahead prefix for the same owner/kind/limit can reuse this successful snapshot.
  ownerCatalogueCache.delete(key);
  ownerCatalogueCache.set(key, entry);
  return entry.value as T[];
}

function writeOwnerCatalogue<T>(args: {
  key: string;
  ownerId: string;
  kind: OwnerCatalogueKind;
  limit: number;
  value: T[];
  now: number;
}) {
  ownerCatalogueCache.delete(args.key);
  ownerCatalogueCache.set(args.key, {
    ownerId: args.ownerId,
    kind: args.kind,
    limit: args.limit,
    value: args.value,
    expiresAt: args.now + ownerCatalogueTtlMs,
  });
  while (ownerCatalogueCache.size > ownerCatalogueMaxEntries) {
    const oldest = ownerCatalogueCache.keys().next().value;
    if (oldest === undefined) break;
    ownerCatalogueCache.delete(oldest);
  }
}

function startOwnerCatalogueFlight<T>(args: {
  key: string;
  ownerId: string;
  kind: OwnerCatalogueKind;
  limit: number;
  load: (signal: AbortSignal) => Promise<T[]>;
}) {
  const controller = new AbortController();
  let removeAbortListener: () => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    const onAbort = () => reject(abortReason(controller.signal));
    controller.signal.addEventListener("abort", onAbort, { once: true });
    removeAbortListener = () => controller.signal.removeEventListener("abort", onAbort);
  });
  const load = Promise.resolve().then(() => args.load(controller.signal));
  const flight: OwnerCatalogueFlight = {
    ownerId: args.ownerId,
    kind: args.kind,
    limit: args.limit,
    controller,
    callers: 0,
    settled: false,
    // Replaced synchronously below before the flight is published.
    promise: Promise.resolve([]),
  };
  flight.promise = Promise.race([load, aborted])
    .then((value) => {
      // A successful load is cacheable only while at least one non-aborted
      // caller still wants it. If every caller left, the shared controller is
      // aborted and even a loader that ignored its signal cannot populate the cache.
      if (controller.signal.aborted || flight.callers === 0) throw abortReason(controller.signal);
      writeOwnerCatalogue({ ...args, value, now: Date.now() });
      return value;
    })
    .finally(() => {
      removeAbortListener();
      flight.settled = true;
      if (ownerCatalogueFlights.get(args.key) === flight) ownerCatalogueFlights.delete(args.key);
    });
  ownerCatalogueFlights.set(args.key, flight);
  return flight;
}

function joinOwnerCatalogueFlight<T>(flight: OwnerCatalogueFlight, signal?: AbortSignal): Promise<T[]> {
  throwIfAborted(signal);
  flight.callers += 1;

  return new Promise<T[]>((resolve, reject) => {
    let callerSettled = false;
    const finish = (complete: () => void) => {
      if (callerSettled) return;
      callerSettled = true;
      signal?.removeEventListener("abort", onAbort);
      flight.callers = Math.max(0, flight.callers - 1);
      if (flight.callers === 0 && !flight.settled) {
        flight.controller.abort(new DOMException("No active catalogue callers.", "AbortError"));
      }
      complete();
    };
    const onAbort = () =>
      finish(() => reject(signal ? abortReason(signal) : new DOMException("Aborted", "AbortError")));

    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }

    flight.promise.then(
      (value) => {
        if (signal?.aborted) {
          onAbort();
          return;
        }
        finish(() => resolve(value as T[]));
      },
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

/**
 * Cache only completed owner-catalogue values. Pending promises, rejected loads, and values
 * produced after cancellation are deliberately never inserted.
 */
export async function loadOwnerCatalogue<T>(args: {
  ownerId: string;
  kind: OwnerCatalogueKind;
  limit: number;
  signal?: AbortSignal;
  load: (signal: AbortSignal) => Promise<T[]>;
}): Promise<T[]> {
  throwIfAborted(args.signal);
  const key = ownerCatalogueKey(args.ownerId, args.kind, args.limit);
  const cached = readOwnerCatalogue<T>(key, Date.now());
  if (cached) return cached;

  let flight = ownerCatalogueFlights.get(key);
  if (flight?.controller.signal.aborted) {
    if (ownerCatalogueFlights.get(key) === flight) ownerCatalogueFlights.delete(key);
    flight = undefined;
  }
  flight ??= startOwnerCatalogueFlight({ ...args, key });
  return joinOwnerCatalogueFlight<T>(flight, args.signal);
}

/** Remove every cached limit for the catalogue that was mutated. */
export function invalidateOwnerCatalogueCache(args: { ownerId: string; kind?: OwnerCatalogueKind }) {
  for (const [key, entry] of ownerCatalogueCache) {
    if (entry.ownerId === args.ownerId && (!args.kind || entry.kind === args.kind)) {
      ownerCatalogueCache.delete(key);
    }
  }
  for (const [key, flight] of ownerCatalogueFlights) {
    if (flight.ownerId === args.ownerId && (!args.kind || flight.kind === args.kind)) {
      ownerCatalogueFlights.delete(key);
      flight.controller.abort(new DOMException("Owner catalogue invalidated.", "AbortError"));
    }
  }
}

/** Test/process-lifecycle helper; production invalidation should stay owner/kind scoped. */
export function clearOwnerCatalogueCache() {
  ownerCatalogueCache.clear();
  for (const flight of ownerCatalogueFlights.values()) {
    flight.controller.abort(new DOMException("Owner catalogue cache cleared.", "AbortError"));
  }
  ownerCatalogueFlights.clear();
}
