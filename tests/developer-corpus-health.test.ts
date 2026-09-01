import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `resolveCorpusHealth()` answers one question the developer hub could not
 * answer before it: which of the signed-in owner's documents are broken. Three
 * of its rules are the reason it exists as a module rather than as queries
 * inlined into the page, and each is pinned below:
 *
 *  1. Both tables are read through the cookie-bound user client, so row-level
 *     security scopes every count to the caller's own documents.
 *  2. Every failure — a returned `{ error }` and a rejected promise alike —
 *     reports as `null` and never as `0`. On this panel `0` is the reassuring
 *     answer ("nothing failed"), so a read that did not happen must not be able
 *     to impersonate it.
 *  3. The reads are guarded one at a time, so one unreadable count degrades one
 *     line instead of failing the page.
 */

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

type Call = {
  table: string;
  columns: string;
  options: { count?: string; head?: boolean } | undefined;
  filters: [string, unknown][];
  order: { column: string; ascending?: boolean } | null;
  limit: number | null;
};

const calls: Call[] = [];

/** The name this test file knows each of the module's reads by. */
function keyOf(call: Call): string {
  const filter = (column: string) => call.filters.find(([name]) => name === column)?.[1];
  if (call.table === "documents") {
    if (filter("chunk_count") === 0) return "unsearchable";
    if (filter("status") === "failed") return "failures";
    return String(filter("status"));
  }
  if (call.columns === "quality_score") return "highest";
  if (call.options?.head) return `quality:${String(filter("extraction_quality"))}`;
  return "lowest";
}

type Reply = { data?: unknown[] | null; count?: number | null; error?: { message: string } | null };
type Plan = Record<string, Reply | "reject">;

const HAPPY: Plan = {
  queued: { count: 2 },
  processing: { count: 1 },
  indexed: { count: 40 },
  unsearchable: {
    count: 3,
    data: [{ id: "doc-a", title: "Empty guideline", page_count: 12, image_count: 0 }],
  },
  failures: {
    count: 2,
    data: [
      { id: "doc-b", title: "Broken scan", error_message: "OCR timed out" },
      { id: "doc-c", title: "Silent failure", error_message: null },
    ],
  },
  "quality:good": { count: 20 },
  "quality:partial": { count: 8 },
  "quality:poor": { count: 5 },
  "quality:unknown": { count: 4 },
  lowest: {
    count: 37,
    data: [
      { document_id: "doc-a", quality_score: 0.1, extraction_quality: "poor", issues: ["no_text"] },
      { document_id: "doc-d", quality_score: 0.4, extraction_quality: "partial", issues: [] },
    ],
  },
  highest: { data: [{ quality_score: 0.9 }] },
};

async function load({
  user = { id: "user-1" } as { id: string } | null,
  plan = {} as Plan,
  configured = true,
  rejectAuth = false,
}) {
  calls.length = 0;
  const merged: Plan = { ...HAPPY, ...plan };

  function builder(call: Call) {
    const chain = {
      eq(column: string, value: unknown) {
        call.filters.push([column, value]);
        return chain;
      },
      order(column: string, options?: { ascending?: boolean }) {
        call.order = { column, ascending: options?.ascending };
        return chain;
      },
      limit(count: number) {
        call.limit = count;
        return chain;
      },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve()
          .then(() => {
            calls.push(call);
            const reply = merged[keyOf(call)];
            // The client rejects rather than resolving when a request is
            // aborted or exhausts its network retries.
            if (reply === "reject") throw new Error("fetch failed");
            return { data: reply?.data ?? null, count: reply?.count ?? null, error: reply?.error ?? null };
          })
          .then(resolve, reject);
      },
    };
    return chain;
  }

  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () =>
      configured
        ? {
            auth: {
              getUser: vi.fn(async () => {
                if (rejectAuth) throw new Error("fetch failed");
                return { data: { user } };
              }),
            },
            from: (table: string) => ({
              select: (columns: string, options?: { count?: string; head?: boolean }) =>
                builder({ table, columns, options, filters: [], order: null, limit: null }),
            }),
          }
        : null,
    ),
  }));

  return import("../src/lib/developer-area/corpus-health");
}

describe("resolveCorpusHealth", () => {
  it("reads nothing when Supabase is not configured", async () => {
    const { resolveCorpusHealth } = await load({ configured: false });
    const health = await resolveCorpusHealth();

    expect(health.read).toBe(false);
    expect(health.statuses).toEqual({ queued: null, processing: null, indexed: null, failed: null });
    expect(health.quality.scored).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("issues no query at all for a request with no signed-in user", async () => {
    const { resolveCorpusHealth } = await load({ user: null });
    const health = await resolveCorpusHealth();

    // Not merely "returns nulls". Row-level security would correctly answer an
    // anonymous caller with `0` for every count, and rendering that would state
    // that the library is empty when the true statement is about the session.
    expect(calls).toHaveLength(0);
    expect(health.read).toBe(false);
  });

  it("degrades to an unread reading when the auth call itself rejects", async () => {
    const { resolveCorpusHealth } = await load({ rejectAuth: true });

    await expect(resolveCorpusHealth()).resolves.toMatchObject({ read: false });
  });

  it("reports the owner's status counts, broken documents and failures", async () => {
    const { resolveCorpusHealth } = await load({});
    const health = await resolveCorpusHealth();

    expect(health.read).toBe(true);
    expect(health.statuses).toEqual({ queued: 2, processing: 1, indexed: 40, failed: 2 });
    expect(health.unsearchable).toEqual({
      count: 3,
      sample: [{ id: "doc-a", title: "Empty guideline", pageCount: 12, imageCount: 0 }],
    });
    expect(health.failures.sample).toEqual([
      { id: "doc-b", title: "Broken scan", errorMessage: "OCR timed out" },
      { id: "doc-c", title: "Silent failure", errorMessage: null },
    ]);
    expect(health.quality.extraction).toEqual({ good: 20, partial: 8, poor: 5, unknown: 4 });
    expect(health.quality.scored).toBe(37);
    expect(health.quality.lowestScore).toBe(0.1);
    expect(health.quality.highestScore).toBe(0.9);
    expect(health.quality.lowest[0]).toEqual({
      documentId: "doc-a",
      score: 0.1,
      extractionQuality: "poor",
      issues: ["no_text"],
    });
  });

  it("takes the failed count from the failed list rather than reading the same predicate twice", async () => {
    // Two independent reads of one predicate can disagree across a concurrent
    // write, and a heading of "3 failed" above a list of four is worse than a
    // single number. The list's own exact count is the only one.
    const { resolveCorpusHealth } = await load({});
    const health = await resolveCorpusHealth();

    expect(health.statuses.failed).toBe(health.failures.count);
    expect(calls.filter((call) => keyOf(call) === "failures")).toHaveLength(1);
  });

  it("counts in Postgres rather than counting fetched rows", async () => {
    // PostgREST caps the rows it returns, so a total derived from
    // `data.length` would silently under-report — the one direction a panel
    // about breakage must never fail in.
    const { resolveCorpusHealth } = await load({});
    await resolveCorpusHealth();

    for (const call of calls) {
      if (keyOf(call) === "highest") continue;
      expect(call.options?.count, `${keyOf(call)} must ask Postgres for an exact count`).toBe("exact");
    }
    // The lists are capped, and the count beside each is the true total.
    for (const key of ["unsearchable", "failures", "lowest"]) {
      expect(calls.find((call) => keyOf(call) === key)?.limit).toBe(20);
    }
  });

  it("keeps an empty library distinct from a count it could not read", async () => {
    const { resolveCorpusHealth } = await load({
      plan: { unsearchable: { count: 0, data: [] }, failures: { count: 0, data: [] } },
    });
    const empty = await resolveCorpusHealth();
    expect(empty.unsearchable.count).toBe(0);
    expect(empty.statuses.failed).toBe(0);

    vi.resetModules();
    const { resolveCorpusHealth: second } = await load({
      plan: {
        unsearchable: { count: 0, data: [], error: { message: "permission denied" } },
        failures: { count: 0, data: [], error: { message: "permission denied" } },
      },
    });
    const failed = await second();
    expect(failed.unsearchable.count).toBeNull();
    expect(failed.statuses.failed).toBeNull();
  });

  it("reports a missing count as unavailable rather than as zero", async () => {
    const { resolveCorpusHealth } = await load({ plan: { indexed: { count: null } } });

    await expect(resolveCorpusHealth()).resolves.toMatchObject({ statuses: { indexed: null } });
  });

  /**
   * The guard is per read, not per page. An unhandled rejection here would fail
   * the whole developer hub panel rather than degrade one line of it — during
   * exactly the Supabase trouble that makes this page worth opening.
   */
  it("degrades one unreadable line and keeps every other reading when a query rejects", async () => {
    const { resolveCorpusHealth } = await load({ plan: { unsearchable: "reject", "quality:poor": "reject" } });
    const health = await resolveCorpusHealth();

    expect(health.unsearchable).toEqual({ count: null, sample: [] });
    expect(health.quality.extraction.poor).toBeNull();
    // Everything the outage did not touch must survive.
    expect(health.statuses.indexed).toBe(40);
    expect(health.failures.count).toBe(2);
    expect(health.quality.extraction.good).toBe(20);
  });

  it("reports the score range as unread when either end of it rejects", async () => {
    const { resolveCorpusHealth, resolveQualitySpread } = await load({ plan: { highest: "reject" } });
    const health = await resolveCorpusHealth();

    expect(health.quality.highestScore).toBeNull();
    // Half a range cannot characterise a distribution, and reporting the half
    // that was read would state more than the data supports.
    expect(resolveQualitySpread(health.quality)).toEqual({ kind: "unreadable" });
  });

  /**
   * The owner-scoping guarantee is structural, not behavioural: it holds because
   * this module uses the cookie-bound user client, which row-level security
   * scopes to `owner_id = auth.uid()` on both tables. The service-role admin
   * client bypasses RLS entirely, so importing it here would silently turn one
   * account's library into every account's — with no failing assertion anywhere,
   * because the mock above would answer either client identically. A source
   * assertion is the only thing that can catch that substitution.
   */
  it("reads through the user-session client and never the service-role client", () => {
    const source = readFileSync(new URL("../src/lib/developer-area/corpus-health.ts", import.meta.url), "utf8");
    // Import statements only: the module's own comment names `createAdminClient`
    // to explain why it is wrong here, so a whole-file substring search for that
    // identifier would fail on the documentation rather than on the code.
    const imports = source.split("\n").filter((line) => line.startsWith("import "));

    expect(imports.some((line) => line.includes('"@/lib/supabase/server"'))).toBe(true);
    expect(imports.some((line) => line.includes("supabase/admin"))).toBe(false);
    // Catches a dynamic import or a re-export that no import line would show.
    expect(source).not.toContain("supabase/admin");
  });
});

describe("resolveQualitySpread", () => {
  const base = { extraction: { good: 0, partial: 0, poor: 0, unknown: 0 }, lowest: [] };

  it("keeps a score it could not read apart from a library with no scores", async () => {
    const { resolveQualitySpread } = await load({});

    expect(resolveQualitySpread({ ...base, scored: null, lowestScore: null, highestScore: null })).toEqual({
      kind: "unreadable",
    });
    expect(resolveQualitySpread({ ...base, scored: 0, lowestScore: null, highestScore: null })).toEqual({
      kind: "none",
    });
  });

  it("does not call a single row a distribution", async () => {
    const { resolveQualitySpread } = await load({});

    expect(resolveQualitySpread({ ...base, scored: 1, lowestScore: 0.5, highestScore: 0.5 })).toEqual({
      kind: "single",
      score: 0.5,
    });
  });

  /**
   * The reading this panel most needs to name out loud. A quality column that
   * defaults to `0` and a scorer that never ran produce a tidy-looking
   * distribution, and a page that renders it as a measurement is worse than a
   * page with no quality section at all.
   */
  it("names a corpus whose every document carries the identical score", async () => {
    const { resolveQualitySpread } = await load({});

    expect(resolveQualitySpread({ ...base, scored: 2851, lowestScore: 0.5, highestScore: 0.5 })).toEqual({
      kind: "uniform",
      score: 0.5,
      documents: 2851,
    });
  });

  it("reports both ends when the scores actually vary", async () => {
    const { resolveQualitySpread } = await load({});

    expect(resolveQualitySpread({ ...base, scored: 40, lowestScore: 0.1, highestScore: 0.9 })).toEqual({
      kind: "varied",
      lowest: 0.1,
      highest: 0.9,
      documents: 40,
    });
  });
});
