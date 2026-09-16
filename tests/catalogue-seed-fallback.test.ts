import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import {
  catalogueDegradedNotice,
  catalogueDetailScope,
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
    vi.useFakeTimers();
    const time = clock();
    const read = vi.fn(() => new Promise<CatalogueRecord[]>(() => {}));

    const pending = readCatalogueWithSeedFallback({ kind: "form", seeds, read, now: time.now });
    await vi.advanceTimersByTimeAsync(catalogueSeedFallbackBudgetMs);

    await expect(pending).resolves.toEqual({ records: seeds, degraded: true });
  });

  it("aborts the read it gave up on rather than leaving it running", async () => {
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

  /**
   * Not a defect being fixed here, a decision being pinned. The detail cooldown is keyed on
   * (scope, kind), so one slow read of one record sends every other slug of that kind to the
   * in-bundle catalogue for the whole cooldown — which is how a detail route comes to answer 503
   * for a slug that is merely absent, or for one published with no bundled copy. The alternative,
   * a per-slug key, lets every distinct slug pay the full budget while the database is unwell.
   * The radius is asserted so that it cannot widen or narrow unnoticed; the reasoning lives beside
   * `catalogueDetailScope`.
   */
  it("cools down every slug of a kind on the strength of one slow record read", async () => {
    const time = clock();
    const slowSlug = vi.fn(async () => {
      throw new Error("detail read exceeded its budget");
    });
    const otherSlug = vi.fn(async () => canonical);

    const first = await readCatalogueWithSeedFallback({
      kind: "medication",
      scope: catalogueDetailScope,
      seeds,
      read: slowSlug,
      now: time.now,
      budgetMs: catalogueListFallbackBudgetMs,
    });
    expect(first.degraded).toBe(true);

    // A different slug entirely, and a read that would have succeeded. It is never attempted.
    const second = await readCatalogueWithSeedFallback({
      kind: "medication",
      scope: catalogueDetailScope,
      seeds,
      read: otherSlug,
      now: time.now,
      budgetMs: catalogueListFallbackBudgetMs,
    });
    expect(second).toEqual({ records: seeds, degraded: true });
    expect(otherSlug).not.toHaveBeenCalled();

    // Bounded, and that bound is the whole defence: the next read past the cooldown is canonical.
    time.advance(catalogueSeedFallbackCooldownMs + 1);
    const third = await readCatalogueWithSeedFallback({
      kind: "medication",
      scope: catalogueDetailScope,
      seeds,
      read: otherSlug,
      now: time.now,
      budgetMs: catalogueListFallbackBudgetMs,
    });
    expect(third).toEqual({ records: canonical, degraded: false });
  });

  it("does not spread a detail cooldown to another kind, or to that kind's list route", async () => {
    const time = clock();
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const healthy = vi.fn(async () => canonical);

    await readCatalogueWithSeedFallback({
      kind: "medication",
      scope: catalogueDetailScope,
      seeds,
      read: failing,
      now: time.now,
    });

    const otherKind = await readCatalogueWithSeedFallback({
      kind: "differential",
      scope: catalogueDetailScope,
      seeds,
      read: healthy,
      now: time.now,
    });
    const listRoute = await readCatalogueWithSeedFallback({
      kind: "medication",
      scope: catalogueListScope,
      seeds,
      read: healthy,
      now: time.now,
      budgetMs: catalogueListFallbackBudgetMs,
    });

    expect(otherKind.degraded).toBe(false);
    expect(listRoute.degraded).toBe(false);
    expect(healthy).toHaveBeenCalledTimes(2);
  });

  it("still cools down within a scope, and the other scope is unaffected", async () => {
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
