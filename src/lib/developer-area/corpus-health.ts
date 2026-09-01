import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The resting state of the signed-in owner's document library: what finished,
 * what finished badly, and what the indexer thought of the result.
 *
 * The developer hub's ingestion panel already shows documents *moving* — queued,
 * processing, stuck. Nothing showed the library at rest, so a document that
 * completed and produced nothing usable was invisible: it is not in the queue,
 * it is not an error, and its row says `indexed`.
 *
 * **The user-session client, never the service-role admin client.** Both tables
 * read here have row-level security enabled with a single owner-read select
 * policy — `documents owner read` and `index quality owner read`, each
 * `owner_id = auth.uid()` — so the database itself scopes every count below to
 * the caller's own documents. `createAdminClient` bypasses RLS and would report
 * every owner's library to whoever happened to be signed in. This mirrors
 * `environment-facts.ts`, and `tests/developer-corpus-health.test.ts` carries the
 * same source assertion, because no behavioural test can catch that
 * substitution: the mocks would answer either client identically.
 *
 * **Every failure returns `null`, never `0`, and every read is guarded
 * separately.** Zero is a true and load-bearing answer on this panel — "nothing
 * failed", "nothing is unsearchable" — so a read that did not happen must never
 * be able to impersonate it. The reads are also guarded one at a time rather
 * than as a block: the client *rejects* rather than resolving with an `{ error }`
 * when a request is aborted or exhausts its network retries, and an unhandled
 * rejection would fail the whole page instead of degrading the one line that
 * could not be read.
 *
 * **Exact counts, not counted rows.** Every total here is a `head: true` count
 * computed in Postgres. Fetching the rows and counting them in JavaScript would
 * be silently capped by PostgREST's row limit, and on this panel a truncated
 * fetch under-reports breakage — the one direction an honest health panel must
 * not fail in.
 */

/** The four values `documents.status` is constrained to by its check constraint. */
export const DOCUMENT_STATUSES = ["queued", "processing", "indexed", "failed"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** The four values `document_index_quality.extraction_quality` is constrained to. */
export const EXTRACTION_QUALITIES = ["good", "partial", "poor", "unknown"] as const;
export type ExtractionQuality = (typeof EXTRACTION_QUALITIES)[number];

/**
 * How many rows each list on the panel shows. The count beside it is the true
 * total, so a list that is cut off must say so — see `CountedList.count`.
 */
export const SAMPLE_LIMIT = 20;

export type UnsearchableDocument = {
  id: string;
  title: string;
  pageCount: number;
  imageCount: number;
};

export type FailedDocument = {
  id: string;
  title: string;
  errorMessage: string | null;
};

export type ScoredDocument = {
  documentId: string;
  score: number;
  extractionQuality: string;
  issues: string[];
};

/**
 * A total with a sample of the rows behind it. `count` is the exact total and is
 * `null` when the read failed; `sample` holds at most `SAMPLE_LIMIT` rows and is
 * empty both when there is nothing to show and when the read failed — which is
 * exactly why the count is separate and nullable rather than inferred from the
 * sample's length.
 */
export type CountedList<T> = { count: number | null; sample: T[] };

export type CorpusHealth = {
  /**
   * Whether a read was attempted at all. False for an unconfigured Supabase env
   * or a request with no signed-in user; the panel says "not read" rather than
   * rendering a page of nulls that look like failures.
   */
  read: boolean;
  statuses: Record<DocumentStatus, number | null>;
  /** Finished, but produced no text chunk. */
  unsearchable: CountedList<UnsearchableDocument>;
  /** Failed, with whatever the worker recorded as the reason. */
  failures: CountedList<FailedDocument>;
  quality: {
    extraction: Record<ExtractionQuality, number | null>;
    /** Rows in `document_index_quality` the database attributes to this owner. */
    scored: number | null;
    /** The lowest-scoring rows, worst first, with the issues each recorded. */
    lowest: ScoredDocument[];
    lowestScore: number | null;
    highestScore: number | null;
  };
};

/**
 * What the quality scores add up to, as one of four distinguishable readings.
 *
 * The `uniform` case is the reason this is a named derivation rather than two
 * numbers on the page. `document_index_quality.quality_score` defaults to `0`,
 * so a corpus in which nothing was ever scored and a corpus in which everything
 * scored identically produce the same pair of numbers — and in both, the quality
 * half of this panel is telling the reader nothing. It must say so out loud
 * rather than render a distribution that looks like a measurement.
 *
 * `unreadable` and `none` are kept apart for the same reason the counts are
 * nullable: "we could not read this" and "there is nothing here" are different
 * facts, and only one of them is reassuring.
 */
export type QualitySpread =
  | { kind: "unreadable" }
  | { kind: "none" }
  | { kind: "single"; score: number }
  | { kind: "uniform"; score: number; documents: number }
  | { kind: "varied"; lowest: number; highest: number; documents: number };

export function resolveQualitySpread(quality: CorpusHealth["quality"]): QualitySpread {
  const { scored, lowestScore, highestScore } = quality;
  if (scored === null) return { kind: "unreadable" };
  if (scored === 0) return { kind: "none" };
  // A count without both ends of the range cannot be characterised, and
  // reporting one end as though it were the distribution would overstate it.
  if (lowestScore === null || highestScore === null) return { kind: "unreadable" };
  if (scored === 1) return { kind: "single", score: lowestScore };
  if (lowestScore === highestScore) return { kind: "uniform", score: lowestScore, documents: scored };
  return { kind: "varied", lowest: lowestScore, highest: highestScore, documents: scored };
}

function unreadCorpusHealth(): CorpusHealth {
  return {
    read: false,
    statuses: { queued: null, processing: null, indexed: null, failed: null },
    unsearchable: { count: null, sample: [] },
    failures: { count: null, sample: [] },
    quality: {
      extraction: { good: null, partial: null, poor: null, unknown: null },
      scored: null,
      lowest: [],
      lowestScore: null,
      highestScore: null,
    },
  };
}

type CountResult = { count: number | null; error: unknown };
type RowsResult<Row> = { data: Row[] | null; count?: number | null; error: unknown };

/**
 * One guarded count. Both halves of "it did not work" — a returned `{ error }`
 * and a rejected promise — collapse to `null`, never to `0`.
 */
async function countOf(run: () => PromiseLike<CountResult>): Promise<number | null> {
  try {
    const { count, error } = await run();
    return error ? null : (count ?? null);
  } catch {
    return null;
  }
}

/** One guarded list-with-total. A failure yields `{ count: null, sample: [] }`. */
async function listOf<Row, Item>(
  run: () => PromiseLike<RowsResult<Row>>,
  map: (row: Row) => Item,
): Promise<CountedList<Item>> {
  try {
    const { data, count, error } = await run();
    if (error) return { count: null, sample: [] };
    return { count: count ?? null, sample: (data ?? []).map(map) };
  } catch {
    return { count: null, sample: [] };
  }
}

/** One guarded single-value read, used for the two ends of the score range. */
async function scoreOf(run: () => PromiseLike<RowsResult<{ quality_score: number }>>): Promise<number | null> {
  try {
    const { data, error } = await run();
    if (error) return null;
    return data?.[0]?.quality_score ?? null;
  } catch {
    return null;
  }
}

export async function resolveCorpusHealth(): Promise<CorpusHealth> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return unreadCorpusHealth();

  // Guarded like every read below it: an auth call that rejects during a
  // Supabase outage is exactly when this page gets opened.
  let signedIn = false;
  try {
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } catch {
    return unreadCorpusHealth();
  }
  // No user means row-level security would correctly answer every count below
  // with `0`. Rendering that would describe the corpus as empty when the true
  // statement is about the session, so the reads do not run at all.
  if (!signedIn) return unreadCorpusHealth();

  const [queued, processing, indexed, unsearchable, failures, good, partial, poor, unknown, lowest, highest] =
    await Promise.all([
      countOf(() => supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "queued")),
      countOf(() => supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "processing")),
      countOf(() => supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "indexed")),

      // The cut this panel exists for: finished, and yet holds not one text
      // chunk. One query rather than a count plus a list, so the total and the
      // sample can never disagree with each other.
      listOf(
        () =>
          supabase
            .from("documents")
            .select("id, title, page_count, image_count", { count: "exact" })
            .eq("status", "indexed")
            .eq("chunk_count", 0)
            .order("updated_at", { ascending: false })
            .limit(SAMPLE_LIMIT),
        (row): UnsearchableDocument => ({
          id: row.id,
          title: row.title,
          pageCount: row.page_count,
          imageCount: row.image_count,
        }),
      ),

      // Doubles as the `failed` status count, which is why there is no separate
      // head request for it: two independent reads of the same predicate can
      // disagree across a concurrent write, and a panel that shows "3 failed"
      // above a list of four is worse than one that shows a single number.
      listOf(
        () =>
          supabase
            .from("documents")
            .select("id, title, error_message", { count: "exact" })
            .eq("status", "failed")
            .order("updated_at", { ascending: false })
            .limit(SAMPLE_LIMIT),
        (row): FailedDocument => ({ id: row.id, title: row.title, errorMessage: row.error_message }),
      ),

      countOf(() =>
        supabase
          .from("document_index_quality")
          .select("document_id", { count: "exact", head: true })
          .eq("extraction_quality", "good"),
      ),
      countOf(() =>
        supabase
          .from("document_index_quality")
          .select("document_id", { count: "exact", head: true })
          .eq("extraction_quality", "partial"),
      ),
      countOf(() =>
        supabase
          .from("document_index_quality")
          .select("document_id", { count: "exact", head: true })
          .eq("extraction_quality", "poor"),
      ),
      countOf(() =>
        supabase
          .from("document_index_quality")
          .select("document_id", { count: "exact", head: true })
          .eq("extraction_quality", "unknown"),
      ),

      // Worst first. This one read carries three things at once: the exact
      // number of quality rows this owner can see, the bottom of the score
      // range, and the documents a reader would actually go and look at.
      listOf(
        () =>
          supabase
            .from("document_index_quality")
            .select("document_id, quality_score, extraction_quality, issues", { count: "exact" })
            .order("quality_score", { ascending: true })
            .limit(SAMPLE_LIMIT),
        (row): ScoredDocument => ({
          documentId: row.document_id,
          score: row.quality_score,
          extractionQuality: row.extraction_quality,
          issues: row.issues,
        }),
      ),

      // The top of the range, and the only thing that can tell a real
      // distribution apart from every document carrying the same placeholder.
      scoreOf(() =>
        supabase
          .from("document_index_quality")
          .select("quality_score")
          .order("quality_score", { ascending: false })
          .limit(1),
      ),
    ]);

  return {
    read: true,
    statuses: { queued, processing, indexed, failed: failures.count },
    unsearchable,
    failures,
    quality: {
      extraction: { good, partial, poor, unknown },
      scored: lowest.count,
      lowest: lowest.sample,
      lowestScore: lowest.sample[0]?.score ?? null,
      highestScore: highest,
    },
  };
}
