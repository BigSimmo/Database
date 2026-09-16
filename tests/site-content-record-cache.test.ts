import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearSiteContentRecordCache,
  readSiteContentRecordsCached,
  siteContentRecordCacheMaxEntries,
  siteContentRecordCacheRefreshTimeoutMs,
  siteContentRecordCacheStaleMs,
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
    expect(first.age).toBe("miss");
    expect(second.age).toBe("fresh");
    expect(second.rows).toEqual(first.rows);
  });

  it("holds the fresh window, then refreshes once past it", async () => {
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

  // The point of the stale window: past the fresh TTL the reader is served immediately and the
  // refresh happens behind them. Nobody waits for the query, which is the whole regression.
  it("serves a stale entry at once and refreshes behind the reader", async () => {
    const time = clock();
    const gate = deferred<SiteContentRecordRows>();
    const read = vi
      .fn<(signal?: AbortSignal) => Promise<SiteContentRecordRows>>()
      .mockResolvedValueOnce(rows("current", 1))
      .mockImplementationOnce(() => gate.promise);

    const first = await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    time.advance(siteContentRecordCacheTtlMs + 1);

    // Resolves while the refresh is still in flight, and returns the previous rows.
    const second = await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    expect(second.age).toBe("stale");
    expect(second.rows).toEqual(first.rows);
    expect(read).toHaveBeenCalledTimes(2);

    gate.resolve(rows("current", 2));
    await gate.promise;
    const third = await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    expect(third.age).toBe("fresh");
    expect(third.rows).toHaveLength(2);
  });

  // Rule 2, second half. A failed BACKGROUND refresh must not evict: the last known-good
  // canonical rows are a better answer than the seed catalogue, and the ceiling still bounds it.
  it("keeps serving the last good rows when a background refresh fails", async () => {
    const time = clock();
    const read = vi
      .fn<(signal?: AbortSignal) => Promise<SiteContentRecordRows>>()
      .mockResolvedValueOnce(rows("current"))
      .mockRejectedValue(new Error("boom"));

    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    time.advance(siteContentRecordCacheTtlMs + 1);

    const served = await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    expect(served.age).toBe("stale");
    expect(served.rows).toEqual(rows("current"));
  });

  // Review finding #2805 (P1). Declining to STORE a degraded snapshot is not enough: the prior
  // `current` entry has to go, or search keeps serving a catalogue the control plane is
  // deliberately suppressing mid-publication for the rest of the stale window.
  it.each(["updating", "unavailable"] as const)(
    "evicts the cached rows when a background refresh reports %s",
    async (state) => {
      const time = clock();
      const read = vi
        .fn<(signal?: AbortSignal) => Promise<SiteContentRecordRows>>()
        .mockResolvedValueOnce(rows("current"))
        .mockResolvedValue(rows(state));

      await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
      time.advance(siteContentRecordCacheTtlMs + 1);

      // Serves the stale rows once while the refresh runs, which is the contract.
      const duringRefresh = await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
      expect(duringRefresh.age).toBe("stale");
      await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));

      // Once that refresh lands degraded the entry is gone, so the next read is a real one.
      const afterRefresh = await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
      expect(afterRefresh.age).toBe("miss");
    },
  );

  // Review finding #2805 (P2). A background refresh has no waiter to cancel it, so a hung query
  // would otherwise stay in the flight map and every later caller would join it forever.
  it("gives a background refresh its own deadline so a hung one cannot trap later callers", async () => {
    vi.useFakeTimers();
    try {
      const time = clock();
      const hung = deferred<SiteContentRecordRows>();
      let refreshSignal: AbortSignal | undefined;
      const read = vi
        .fn<(signal?: AbortSignal) => Promise<SiteContentRecordRows>>()
        .mockResolvedValueOnce(rows("current"))
        .mockImplementationOnce((signal) => {
          refreshSignal = signal;
          return hung.promise;
        });

      await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
      time.advance(siteContentRecordCacheTtlMs + 1);
      await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
      expect(refreshSignal?.aborted).toBe(false);

      vi.advanceTimersByTime(siteContentRecordCacheRefreshTimeoutMs);
      expect(refreshSignal?.aborted).toBe(true);
      expect((refreshSignal?.reason as DOMException).name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });

  // Rule 2, first half, and the ceiling that stops "stale" becoming "indefinite".
  it("stops serving past the stale ceiling and surfaces the failure instead", async () => {
    const time = clock();
    const read = vi
      .fn<(signal?: AbortSignal) => Promise<SiteContentRecordRows>>()
      .mockResolvedValueOnce(rows("current"))
      .mockRejectedValue(new Error("boom"));

    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    time.advance(siteContentRecordCacheStaleMs);

    await expect(readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now })).rejects.toThrow(
      /boom/,
    );
  });

  it("does not let a reader who joins a background refresh cancel it", async () => {
    const time = clock();
    const gate = deferred<SiteContentRecordRows>();
    let refreshSignal: AbortSignal | undefined;
    const read = vi
      .fn<(signal?: AbortSignal) => Promise<SiteContentRecordRows>>()
      .mockResolvedValueOnce(rows("current"))
      .mockImplementationOnce((signal) => {
        refreshSignal = signal;
        return gate.promise;
      });

    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });
    time.advance(siteContentRecordCacheStaleMs - 1);
    await readSiteContentRecordsCached({ kind: "form", slug: null, read, now: time.now });

    // Past the ceiling this caller must block, so it joins the refresh already running.
    time.advance(2);
    const caller = new AbortController();
    const blocked = readSiteContentRecordsCached({
      kind: "form",
      slug: null,
      signal: caller.signal,
      read,
      now: time.now,
    });
    caller.abort();
    await expect(blocked).rejects.toThrow();

    expect(refreshSignal?.aborted).toBe(false);
    gate.resolve(rows("current", 3));
    await expect(gate.promise).resolves.toHaveLength(3);
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

  it("prunes a key past its stale ceiling on the next store, leaving the fresh one alone", async () => {
    const time = clock();
    const read = vi.fn(async () => rows("current"));

    await readSiteContentRecordsCached({ kind: "form", slug: "abandoned", read, now: time.now });
    time.advance(siteContentRecordCacheStaleMs);
    // Storing this key runs the prune, which must drop the abandoned one and keep this one.
    await readSiteContentRecordsCached({ kind: "service", slug: null, read, now: time.now });

    await readSiteContentRecordsCached({ kind: "service", slug: null, read, now: time.now });
    expect(read).toHaveBeenCalledTimes(2);

    // The abandoned key is gone rather than merely stale, so it blocks on a real read.
    const revisited = await readSiteContentRecordsCached({ kind: "form", slug: "abandoned", read, now: time.now });
    expect(revisited.age).toBe("miss");
    expect(read).toHaveBeenCalledTimes(3);
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
    expect(second.age).toBe("miss");
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
    await expect(healthy).resolves.toMatchObject({ age: "miss" });
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
