import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import {
  catalogueDegradedNotice,
  catalogueListFallbackBudgetMs,
  catalogueListScope,
  catalogueSearchScope,
  catalogueSeedFallbackBudgetMs,
  catalogueSeedFallbackCooldownMs,
  clearCatalogueSeedFallbackCooldown,
  readCatalogueWithSeedFallback,
  withCatalogueDegradedNotice,
} from "@/lib/site-content/catalogue-seed-fallback";

type CatalogueRecord = { slug: string };

const seeds: readonly CatalogueRecord[] = [{ slug: "seed-a" }, { slug: "seed-b" }];
const canonical: CatalogueRecord[] = [{ slug: "canonical-a" }];

/** A clock the tests advance deliberately, so the cooldown is asserted rather than waited for. */
function clock(startedAt = 1_000_000) {
  let value = startedAt;
  return {
    now: () => value,
    advance: (ms: number) => {
      value += ms;
    },
  };
}

/**
 * A scope+kind that has already completed one canonical read — the steady state.
 *
 * `readCatalogueWithSeedFallback` gives the FIRST read of a scope+kind one retry, because the
 * measured failure is connection setup on a cold path (see the module header). Every case below
 * that asserts what happens when a read fails is describing the warm path, so it warms first and
 * keeps asserting exactly what it always did. The cold path has its own cases.
 */
async function warm(kind: string, scope?: string) {
  const outcome = await readCatalogueWithSeedFallback({
    kind,
    scope,
    seeds,
    read: async () => canonical,
    now: () => 0,
  });
  expect(outcome.degraded).toBe(false);
}

beforeEach(() => {
  clearCatalogueSeedFallbackCooldown();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  clearCatalogueSeedFallbackCooldown();
});

describe("readCatalogueWithSeedFallback", () => {
  it("returns the canonical records when the read succeeds", async () => {
    const time = clock();
    const read = vi.fn(async () => canonical);

    const outcome = await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });

    expect(outcome.records).toEqual(canonical);
    expect(outcome.degraded).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
  });

  // The production symptom this exists for: the read fails, and the domain returned nothing at all.
  it("serves seeds instead of failing when the read rejects", async () => {
    const time = clock();
    const read = vi.fn(async () => {
      throw new Error("Canonical site-content read failed: boom");
    });

    const outcome = await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });

    expect(outcome.records).toEqual(seeds);
    expect(outcome.degraded).toBe(true);
  });

  it("serves seeds when the read outruns its budget, and does not wait for it", async () => {
    await warm("form");
    vi.useFakeTimers();
    const time = clock();
    const read = vi.fn(() => new Promise<CatalogueRecord[]>(() => {}));

    const pending = readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    await vi.advanceTimersByTimeAsync(catalogueSeedFallbackBudgetMs);

    await expect(pending).resolves.toEqual({ records: seeds, degraded: true });
  });

  it("aborts the read it gave up on rather than leaving it running", async () => {
    await warm("form");
    vi.useFakeTimers();
    const time = clock();
    let readSignal: AbortSignal | undefined;
    const read = vi.fn((signal: AbortSignal) => {
      readSignal = signal;
      return new Promise<CatalogueRecord[]>(() => {});
    });

    const pending = readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    await vi.advanceTimersByTimeAsync(catalogueSeedFallbackBudgetMs);
    await pending;

    expect(readSignal?.aborted).toBe(true);
    expect((readSignal?.reason as DOMException).name).toBe("TimeoutError");
  });

  // Without this, every keystroke pays the budget before falling back, which is still slow search.
  it("skips the read entirely while cooling down after a failure", async () => {
    await warm("form");
    const time = clock();
    const read = vi.fn(async () => {
      throw new Error("boom");
    });

    await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    expect(read).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i += 1) {
      const outcome = await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
      expect(outcome).toEqual({ records: seeds, degraded: true });
    }
    expect(read).toHaveBeenCalledTimes(1);
  });

  // Self-healing: the moment the database is repaired this recovers with no deploy.
  it("probes again once the cooldown elapses, and recovers on success", async () => {
    await warm("form");
    const time = clock();
    const read = vi
      .fn<(signal: AbortSignal) => Promise<CatalogueRecord[]>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(canonical);

    await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    time.advance(catalogueSeedFallbackCooldownMs - 1);
    expect(await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now })).toEqual({
      records: seeds,
      degraded: true,
    });
    expect(read).toHaveBeenCalledTimes(1);

    time.advance(2);
    const recovered = await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    expect(recovered).toEqual({ records: canonical, degraded: false });

    // A success clears the cooldown, so the next read is canonical too rather than seeds.
    const next = await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    expect(next.degraded).toBe(false);
  });

  it("keeps each kind on its own cooldown", async () => {
    const time = clock();
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const healthy = vi.fn(async () => canonical);

    await readCatalogueWithSeedFallback({ kind: "form", seeds, read: failing, now: time.now });
    const other = await readCatalogueWithSeedFallback({ kind: "medication", seeds, read: healthy, now: time.now });

    expect(other.degraded).toBe(false);
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  // A caller abort means the whole search is being discarded. Treating it as a catalogue-health
  // signal would open a 30s cooldown every time a user typed another character.
  it("propagates a caller abort instead of falling back or cooling down", async () => {
    const time = clock();
    const caller = new AbortController();
    const read = vi.fn(async (signal: AbortSignal) => {
      caller.abort();
      signal.throwIfAborted();
      return canonical;
    });

    await expect(
      readCatalogueWithSeedFallback({ kind: "form", seeds, signal: caller.signal, read, now: time.now }),
    ).rejects.toThrow();

    // No cooldown was opened, so a healthy read straight afterwards still reaches the database.
    const healthy = vi.fn(async () => canonical);
    const outcome = await readCatalogueWithSeedFallback({ kind: "form", seeds, read: healthy, now: time.now });
    expect(outcome.degraded).toBe(false);
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it("rejects an already-aborted caller without reading or falling back", async () => {
    const time = clock();
    const read = vi.fn(async () => canonical);

    await expect(
      readCatalogueWithSeedFallback({ kind: "form", seeds, signal: AbortSignal.abort(), read, now: time.now }),
    ).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
});

/**
 * The seven-day outage happened because degradation was silent. A fallback that quietly absorbs a
 * broken catalogue would recreate that, so these assert the reporting rather than the records.
 */
describe("readCatalogueWithSeedFallback reports the degradation it absorbs", () => {
  it("logs an error the first time it falls back, and not again while cooling down", async () => {
    const time = clock();
    const reported = vi.spyOn(logger, "error").mockImplementation(() => {});
    const read = vi.fn(async () => {
      throw new Error("Canonical site-content read failed: boom");
    });

    for (let i = 0; i < 4; i += 1) {
      await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    }

    expect(reported).toHaveBeenCalledTimes(1);
    const [message, context] = reported.mock.calls[0]!;
    expect(message).toContain("serving in-bundle seeds");
    expect(context).toMatchObject({ catalogue_kind: "form", failure: "Error" });
  });

  it("logs the recovery so a resolved outage is visible too", async () => {
    await warm("form");
    const time = clock();
    const recovered = vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
    const read = vi
      .fn<(signal: AbortSignal) => Promise<CatalogueRecord[]>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(canonical);

    await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    expect(recovered).not.toHaveBeenCalled();

    time.advance(catalogueSeedFallbackCooldownMs + 1);
    await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    expect(recovered).toHaveBeenCalledTimes(1);
    expect(recovered.mock.calls[0]![0]).toContain("no longer degraded");

    // An ordinary healthy read is not a recovery, so it stays quiet.
    await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    expect(recovered).toHaveBeenCalledTimes(1);
  });

  // The query never reaches this module, and nothing may smuggle it into a log line.
  it("reports the catalogue kind and failure shape only", async () => {
    const time = clock();
    const reported = vi.spyOn(logger, "error").mockImplementation(() => {});
    const read = vi.fn(async () => {
      throw new Error("boom");
    });

    await readCatalogueWithSeedFallback({ kind: "medication", seeds, read, now: time.now });

    expect(Object.keys(reported.mock.calls[0]![1] ?? {}).sort()).toEqual([
      "budget_ms",
      "catalogue_kind",
      "cooldown_ms",
      "detail",
      "failure",
    ]);
  });
});

describe("the budgets the callers choose between", () => {
  // A list route has no 2500 ms domain timeout above it and legitimately reads more, so reusing
  // the search budget would abandon healthy reads and pin those routes to seeds permanently.
  it("gives a whole-catalogue list read more room than a search read", () => {
    expect(catalogueListFallbackBudgetMs).toBeGreaterThan(catalogueSeedFallbackBudgetMs);
    // Still short enough to matter to someone waiting for the page.
    expect(catalogueListFallbackBudgetMs).toBeLessThanOrEqual(10_000);
  });

  it("honours a caller-supplied budget rather than the search default", async () => {
    vi.useFakeTimers();
    const time = clock();
    const read = vi.fn(() => new Promise<CatalogueRecord[]>(() => {}));

    const pending = readCatalogueWithSeedFallback({
      kind: "medication",
      seeds,
      read,
      now: time.now,
      budgetMs: catalogueListFallbackBudgetMs,
    });

    // Past the search budget, still waiting: the list budget is what applies.
    await vi.advanceTimersByTimeAsync(catalogueSeedFallbackBudgetMs + 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(catalogueListFallbackBudgetMs);
    await expect(pending).resolves.toEqual({ records: seeds, degraded: true });
  });
});

describe("withCatalogueDegradedNotice", () => {
  it("tells the reader only when the list actually came from seeds", () => {
    expect(withCatalogueDegradedNotice("Current mode · Forms · 3", true)).toBe(
      `Current mode · Forms · 3 · ${catalogueDegradedNotice}`,
    );
    expect(withCatalogueDegradedNotice("Current mode · Forms · 3", false)).toBe("Current mode · Forms · 3");
    expect(withCatalogueDegradedNotice("Current mode · Forms · 3", undefined)).toBe("Current mode · Forms · 3");
  });

  // Plain words a clinician reads once. No jargon, no "degraded", nothing decorative.
  it("says what it means in plain language", () => {
    expect(catalogueDegradedNotice).toBe("may be out of date");
  });
});

/**
 * A cooldown records that a read failed UNDER A PARTICULAR BUDGET. Keying it on kind alone meant a
 * search giving up at 1200 ms sent every list request straight to seeds for the next thirty
 * seconds without ever attempting the 6000 ms read it was budgeted for — silently discarding the
 * longer budget and serving a stale list while the database was merely slow rather than broken.
 */
describe("cooldowns are scoped to the caller's budget", () => {
  it("does not let a search timeout send the list route to seeds", async () => {
    const time = clock();
    const searchRead = vi.fn(async () => {
      throw new Error("search budget exceeded");
    });
    const listRead = vi.fn(async () => canonical);

    const search = await readCatalogueWithSeedFallback({
      kind: "form",
      scope: catalogueSearchScope,
      seeds,
      read: searchRead,
      now: time.now,
    });
    expect(search.degraded).toBe(true);

    const list = await readCatalogueWithSeedFallback({
      kind: "form",
      scope: catalogueListScope,
      seeds,
      read: listRead,
      now: time.now,
      budgetMs: catalogueListFallbackBudgetMs,
    });

    expect(listRead).toHaveBeenCalledTimes(1);
    expect(list).toEqual({ records: canonical, degraded: false });
  });

  it("still cools down within a scope, and the other scope is unaffected", async () => {
    await warm("form", catalogueListScope);
    await warm("form", catalogueSearchScope);
    const time = clock();
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const healthy = vi.fn(async () => canonical);

    await readCatalogueWithSeedFallback({
      kind: "form",
      scope: catalogueListScope,
      seeds,
      read: failing,
      now: time.now,
    });
    await readCatalogueWithSeedFallback({
      kind: "form",
      scope: catalogueListScope,
      seeds,
      read: failing,
      now: time.now,
    });
    expect(failing).toHaveBeenCalledTimes(1);

    const search = await readCatalogueWithSeedFallback({
      kind: "form",
      scope: catalogueSearchScope,
      seeds,
      read: healthy,
      now: time.now,
    });
    expect(search.degraded).toBe(false);
  });

  it("defaults to the search scope when none is given", async () => {
    const time = clock();
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const healthy = vi.fn(async () => canonical);

    await readCatalogueWithSeedFallback({ kind: "form", seeds, read: failing, now: time.now });
    const explicit = await readCatalogueWithSeedFallback({
      kind: "form",
      scope: catalogueSearchScope,
      seeds,
      read: healthy,
      now: time.now,
    });

    expect(explicit.degraded).toBe(true);
    expect(healthy).not.toHaveBeenCalled();
  });
});

/**
 * The cold first read.
 *
 * Measured 2026-09-21 against the live project: the first catalogue read in a fresh process cost
 * 1781 ms (1599 ms of it before the first byte) and blew the 1200 ms budget on connection setup,
 * while every warm read of every kind finished inside 604 ms. The control was reversing the order
 * the kinds are read in — the penalty moved with the POSITION, not the kind (medication first
 * 1268 ms; form, read last, 213 ms). These cases pin the narrowness of the remedy: one retry, for
 * a cold scope+kind only, so the steady state is byte-for-byte what it was.
 */
describe("the one retry a cold read gets", () => {
  it("retries the first read of a scope+kind and serves canonical records when the retry succeeds", async () => {
    const time = clock();
    const read = vi
      .fn<(signal: AbortSignal) => Promise<CatalogueRecord[]>>()
      .mockRejectedValueOnce(new Error("cold connection"))
      .mockResolvedValue(canonical);

    const outcome = await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });

    expect(read).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ records: canonical, degraded: false });
  });

  it("does not open a cooldown when the retry rescues the read", async () => {
    const time = clock();
    const read = vi
      .fn<(signal: AbortSignal) => Promise<CatalogueRecord[]>>()
      .mockRejectedValueOnce(new Error("cold connection"))
      .mockResolvedValue(canonical);

    await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    // A cooldown here would send the NEXT reader to seeds for 30 s over a failure that was absorbed.
    const next = await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });

    expect(next.degraded).toBe(false);
  });

  it("offers the retry once per scope+kind, never again once warm", async () => {
    const time = clock();
    const read = vi
      .fn<(signal: AbortSignal) => Promise<CatalogueRecord[]>>()
      .mockRejectedValueOnce(new Error("cold connection"))
      .mockResolvedValueOnce(canonical)
      .mockRejectedValue(new Error("boom"));

    await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    expect(read).toHaveBeenCalledTimes(2);

    // Warm now. A retry-always would add its budget to every request of a real outage.
    const outcome = await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    expect(read).toHaveBeenCalledTimes(3);
    expect(outcome).toEqual({ records: seeds, degraded: true });
  });

  it("retries at most once, then falls back and cools down", async () => {
    const time = clock();
    const read = vi.fn(async () => {
      throw new Error("boom");
    });

    const outcome = await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });

    expect(read).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ records: seeds, degraded: true });

    // Cooling down, so the next reader pays nothing at all.
    await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps each scope+kind's warmth separate, as the cooldown already is", async () => {
    const time = clock();
    const read = vi
      .fn<(signal: AbortSignal) => Promise<CatalogueRecord[]>>()
      .mockRejectedValueOnce(new Error("cold"))
      .mockResolvedValue(canonical);

    await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    expect(read).toHaveBeenCalledTimes(2);

    // A different kind is its own cold path and gets its own single retry.
    const other = vi
      .fn<(signal: AbortSignal) => Promise<CatalogueRecord[]>>()
      .mockRejectedValueOnce(new Error("cold"))
      .mockResolvedValue(canonical);
    await readCatalogueWithSeedFallback({ kind: "service", seeds, read: other, now: time.now });
    expect(other).toHaveBeenCalledTimes(2);
  });

  it("caps the retry budget at the caller's own budget rather than exceeding it", async () => {
    vi.useFakeTimers();
    const time = clock();
    const read = vi.fn(() => new Promise<CatalogueRecord[]>(() => {}));

    const pending = readCatalogueWithSeedFallback({
      kind: "form",
      seeds,
      read,
      now: time.now,
      budgetMs: 200,
      retryBudgetMs: 5_000,
    });
    // 200 for the first attempt and 200 for the retry: the cap, not the 5000 that was asked for.
    await vi.advanceTimersByTimeAsync(400);

    await expect(pending).resolves.toEqual({ records: seeds, degraded: true });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("propagates a caller abort raised during the retry instead of serving seeds", async () => {
    const time = clock();
    const caller = new AbortController();
    const read = vi.fn(async () => {
      if (read.mock.calls.length === 1) throw new Error("cold");
      caller.abort(new Error("caller gave up"));
      throw new Error("aborted below");
    });

    await expect(
      readCatalogueWithSeedFallback({ kind: "form", seeds, read, signal: caller.signal, now: time.now }),
    ).rejects.toThrow("caller gave up");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("says out loud that a cold retry rescued the read, so the cost is not hidden", async () => {
    const time = clock();
    const info = vi.spyOn(logger, "info").mockImplementation(() => {});
    const error = vi.spyOn(logger, "error").mockImplementation(() => {});
    const read = vi
      .fn<(signal: AbortSignal) => Promise<CatalogueRecord[]>>()
      .mockRejectedValueOnce(new Error("cold connection"))
      .mockResolvedValue(canonical);

    await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });

    // Absorbed, so it is NOT a fallback — but a reader still waited, so it is not silent either.
    expect(error).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    const [message, context] = info.mock.calls[0]!;
    expect(message).toContain("cold-start retry");
    expect(context).toMatchObject({ catalogue_kind: "form", first_attempt: "Error" });
  });

  it("is not vacuous: without the retry the same cold read would degrade", async () => {
    // Every case above would also pass against a helper that simply never failed. This one fails
    // if the retry stops being offered, and it is the mirror of the first case rather than a
    // restatement of it: same mock, warmed first, opposite outcome.
    const time = clock();
    await warm("form");
    const read = vi
      .fn<(signal: AbortSignal) => Promise<CatalogueRecord[]>>()
      .mockRejectedValueOnce(new Error("cold connection"))
      .mockResolvedValue(canonical);

    const outcome = await readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });

    expect(read).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ records: seeds, degraded: true });
  });
});
