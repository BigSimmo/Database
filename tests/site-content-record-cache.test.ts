import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearSiteContentRecordCache,
  readSiteContentRecordsCached,
  siteContentRecordCacheMaxEntries,
  siteContentRecordCacheTtlMs,
  type SiteContentRecordRows,
} from "@/lib/site-content/site-content-record-cache";

function rows(state: "current" | "updating" | "unavailable", records = 1): SiteContentRecordRows {
  return Array.from({ length: records }, (_unused, index) => ({
    initialized: true,
    record: { slug: `record-${index}` },
    render_payload: { slug: `record-${index}` },
    snapshot: { state, changeEpoch: "7" },
  }));
}

/** A clock the tests advance deliberately, so TTL expiry is asserted rather than waited for. */
function clock(startedAt = 1_000_000) {
  let value = startedAt;
  return {
    now: () => value,
    advance: (ms: number) => {
      value += ms;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  clearSiteContentRecordCache();
});

describe("readSiteContentRecordsCached", () => {
  it("serves a second read of the same kind from cache instead of querying again", async () => {
    const time = clock();
    const read = vi.fn(async () => rows("current"));

    const first = await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    const second = await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });

    expect(read).toHaveBeenCalledTimes(1);
    expect(first.hit).toBe(false);
    expect(second.hit).toBe(true);
    expect(second.rows).toEqual(first.rows);
  });

  it("queries again once the TTL has elapsed", async () => {
    const time = clock();
    const read = vi.fn(async () => rows("current"));

    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    time.advance(siteContentRecordCacheTtlMs - 1);
    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    expect(read).toHaveBeenCalledTimes(1);

    time.advance(2);
    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps each kind on its own entry", async () => {
    const time = clock();
    const read = vi.fn(async () => rows("current"));

    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    await readSiteContentRecordsCached({ kind: "service", slug: null, read, now: time.now });
    await readSiteContentRecordsCached({ kind: "medication", slug: null, read, now: time.now });

    expect(read).toHaveBeenCalledTimes(3);
  });

  it("keeps a slug read separate from the list read for the same kind", async () => {
    const time = clock();
    const read = vi.fn(async () => rows("current"));

    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    await readSiteContentRecordsCached({ kind: "form", slug: "mha-form-1", read, now: time.now });

    expect(read).toHaveBeenCalledTimes(2);
  });

  // Rule 1: a degraded control plane is re-read every request, never pinned for the TTL.
  it.each(["updating", "unavailable"] as const)("does not cache a %s snapshot", async (state) => {
    const time = clock();
    const read = vi.fn(async () => rows(state));

    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });

    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not cache rows whose snapshot is missing or unreadable", async () => {
    const time = clock();
    const read = vi.fn(async () => [{ initialized: true, record: {}, render_payload: {}, snapshot: null }]);

    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });

    expect(read).toHaveBeenCalledTimes(2);
  });

  // Rule 2: no stale-while-error path. The caller's seed fallback must stay reachable.
  it("propagates a failure and caches nothing", async () => {
    const time = clock();
    const read = vi.fn(async () => {
      throw new Error("Canonical site-content read failed: boom");
    });

    await expect(readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now })).rejects.toThrow(
      /boom/,
    );
    await expect(readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now })).rejects.toThrow(
      /boom/,
    );
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not serve a cached entry after a later failure evicts nothing", async () => {
    const time = clock();
    const read = vi
      .fn<(signal?: AbortSignal) => Promise<SiteContentRecordRows>>()
      .mockResolvedValueOnce(rows("current"))
      .mockRejectedValueOnce(new Error("boom"));

    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    time.advance(siteContentRecordCacheTtlMs + 1);

    // The stale entry is dropped on expiry, so the failing refresh surfaces rather than
    // silently serving content that is no longer known to be current.
    await expect(readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now })).rejects.toThrow(
      /boom/,
    );
  });

  it("keeps the retained set bounded and evicts the oldest key first", async () => {
    const time = clock();
    const read = vi.fn(async () => rows("current"));
    const keys = siteContentRecordCacheMaxEntries + 4;

    for (let index = 0; index < keys; index += 1) {
      await readSiteContentRecordsCached({ kind: "form", slug: `slug-${index}`, read, now: time.now });
    }
    expect(read).toHaveBeenCalledTimes(keys);

    // The four oldest keys were evicted, so re-reading the very first one queries again while
    // the most recent one is still served from cache.
    await readSiteContentRecordsCached({ kind: "form", slug: "slug-0", read, now: time.now });
    expect(read).toHaveBeenCalledTimes(keys + 1);

    await readSiteContentRecordsCached({ kind: "form", slug: `slug-${keys - 1}`, read, now: time.now });
    expect(read).toHaveBeenCalledTimes(keys + 1);
  });

  it("prunes an expired key on the next store without disturbing the fresh one", async () => {
    const time = clock();
    const read = vi.fn(async () => rows("current"));

    await readSiteContentRecordsCached({ kind: "form", slug: "stale", read, now: time.now });
    time.advance(siteContentRecordCacheTtlMs + 1);
    await readSiteContentRecordsCached({ kind: "service", slug: null, read, now: time.now });

    // Pruning the expired key must not evict or invalidate the entry just stored beside it.
    await readSiteContentRecordsCached({ kind: "service", slug: null, read, now: time.now });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("shares one flight between concurrent callers for the same key", async () => {
    const time = clock();
    const gate = deferred<SiteContentRecordRows>();
    const read = vi.fn(() => gate.promise);

    const a = readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    const b = readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    gate.resolve(rows("current"));

    const [first, second] = await Promise.all([a, b]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(first.rows).toEqual(second.rows);
    expect(second.hit).toBe(true);
  });

  it("keeps the shared query running when one of several waiters aborts", async () => {
    const time = clock();
    const gate = deferred<SiteContentRecordRows>();
    let readSignal: AbortSignal | undefined;
    const read = vi.fn((signal?: AbortSignal) => {
      readSignal = signal;
      return gate.promise;
    });

    const abandoned = new AbortController();
    const abandonedRead = readSiteContentRecordsCached({
      kind: "form",
      slug: null,
      signal: abandoned.signal,
      read,
      now: time.now,
    });
    const survivor = readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });

    abandoned.abort();
    await expect(abandonedRead).rejects.toThrow();
    expect(readSignal?.aborted).toBe(false);

    gate.resolve(rows("current"));
    await expect(survivor).resolves.toMatchObject({ rows: rows("current") });
  });

  it("cancels the underlying query when its last waiter aborts", async () => {
    const time = clock();
    const gate = deferred<SiteContentRecordRows>();
    let readSignal: AbortSignal | undefined;
    const read = vi.fn((signal?: AbortSignal) => {
      readSignal = signal;
      return gate.promise;
    });

    const caller = new AbortController();
    const pending = readSiteContentRecordsCached({
      kind: "form",
      slug: null,
      signal: caller.signal,
      read,
      now: time.now,
    });

    caller.abort();
    await expect(pending).rejects.toThrow();
    expect(readSignal?.aborted).toBe(true);
  });

  it("starts a fresh flight rather than joining one that was already cancelled", async () => {
    const time = clock();
    const first = deferred<SiteContentRecordRows>();
    const second = deferred<SiteContentRecordRows>();
    const read = vi.fn<(signal?: AbortSignal) => Promise<SiteContentRecordRows>>();
    read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const caller = new AbortController();
    const cancelled = readSiteContentRecordsCached({
      kind: "form",
      slug: null,
      signal: caller.signal,
      read,
      now: time.now,
    });
    caller.abort();
    await expect(cancelled).rejects.toThrow();

    const healthy = readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    second.resolve(rows("current"));
    await expect(healthy).resolves.toMatchObject({ hit: false });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("rejects an already-aborted caller without serving the cache", async () => {
    const time = clock();
    const read = vi.fn(async () => rows("current"));
    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });

    const aborted = AbortSignal.abort();
    await expect(
      readSiteContentRecordsCached({ kind: "form", slug: null, signal: aborted, read, now: time.now }),
    ).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
