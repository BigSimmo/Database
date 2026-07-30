/**
 * Pins Supabase round-trip counts for the offline answer path (ledger `#098`).
 *
 * The 2026-07-28 latency audit argued every finding from reading code, and the
 * fixes that landed in PR #1377 were verified the same way. Nothing pinned the
 * resulting counts, so a later refactor could add a round trip to a hot path and
 * no gate would notice. These budgets exist to make that a red gate.
 *
 * **The numbers here are measured, not derived.** They record what the path
 * currently does. A failure therefore means "the traffic changed" — which is
 * information, not automatically a defect. The correct response is to look at
 * the printed breakdown and decide whether the change is intended, then update
 * the budget in the same commit as the change that moved it. Do not relax a
 * budget to make an unexplained failure pass; that converts this guard back into
 * the inference it replaced.
 *
 * Scope: what travels through the mocked `@/lib/supabase/admin` client. Traffic
 * via another client, a direct `fetch`, or a provider SDK is invisible here — so
 * these are claims about this client's round trips, not total request cost.
 *
 * Provider-free and DB-free.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { countSupabaseRoundTrips } from "./helpers/supabase-round-trip-counter";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "clozapine-chunk-1",
    document_id: "clozapine-doc",
    title: "Clozapine Prescribing Administration Monitoring",
    file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf",
    page_number: 11,
    chunk_index: 0,
    section_heading: "Monitoring",
    content:
      "Withhold clozapine if the absolute neutrophil count (ANC) falls below 1.5 x10^9/L. Mandatory FBC monitoring is weekly for the first 18 weeks of clozapine treatment, then reduces in frequency.",
    image_ids: [],
    similarity: 0.95,
    hybrid_score: 0.95,
    text_rank: 1.2,
    table_facts: [],
    source_metadata: {
      source_title: "Clozapine source",
      publisher: "Local service",
      jurisdiction: "Australia/WA",
      version: "1",
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
    },
    images: [],
    ...overrides,
  };
}

/** Mirrors tests/rag-offline-answer.test.ts's harness, with the client counted. */
async function answerWithCountedClient(query: string, textSources: SearchResult[]) {
  vi.stubEnv("RAG_PROVIDER_MODE", "offline");
  vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
  vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

  class EmptyQuery implements PromiseLike<{ data: unknown[]; error: null }> {
    select() {
      return this;
    }
    in() {
      return this;
    }
    eq() {
      return this;
    }
    neq() {
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    is() {
      return this;
    }
    or() {
      return this;
    }
    abortSignal() {
      return this;
    }
    maybeSingle() {
      return this;
    }
    then<TResult1 = { data: unknown[]; error: null }>(
      onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    ): PromiseLike<TResult1> {
      return Promise.resolve({ data: [], error: null }).then(onfulfilled);
    }
  }

  const rpc = vi.fn(async (name: string) => {
    if (name === "match_document_chunks_text_v2" || name === "match_document_chunks_text") {
      return { data: textSources, error: null };
    }
    return { data: [], error: null };
  });

  const { client, counter } = countSupabaseRoundTrips({ rpc, from: vi.fn(() => new EmptyQuery()) });
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
  vi.doMock("@/lib/openai", () => ({
    embedTextWithTelemetry: vi.fn(),
    generateStructuredTextResult: vi.fn(),
  }));

  const { answerQuestionWithScope } = await import("../src/lib/rag/rag");
  const answer = await answerQuestionWithScope({
    query,
    ownerId: undefined,
    logQuery: false,
    skipCache: true,
  });
  return { answer, counter };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("the counter itself", () => {
  // A budget guard is only worth having if an added round trip moves it. Proving
  // that on the real path would mean editing src/lib/rag/** to inject a call, so
  // this pins the mechanism instead: one extra `.from()` must show up as one
  // extra trip, and the original client must be left unwrapped.
  it("counts an added round trip and does not mutate the client it wraps", async () => {
    const original = { rpc: vi.fn(async () => ({ data: [], error: null })), from: vi.fn(() => ({})) };
    const { client, counter } = countSupabaseRoundTrips(original);

    await client.rpc();
    client.from();
    expect(counter.total()).toBe(2);

    client.from();
    expect(counter.total(), "an extra round trip must move the count").toBe(3);
    expect(counter.breakdown()).toEqual({ "rpc:undefined": 1, "from:undefined": 2 });

    // Spread-not-mutate: a suite reusing the same stub for a second scenario
    // must not inherit the first scenario's counting.
    expect(original.from, "wrapping must not replace the original's methods").not.toBe(client.from);
  });
});

describe("Supabase round-trip budgets on the offline answer path", () => {
  it("pins the round-trip count for a single-source source-only answer", async () => {
    const { answer, counter } = await answerWithCountedClient("What ANC threshold should withhold clozapine?", [
      source(),
    ]);

    // Non-vacuity first. A budget of "0 observed, 0 expected" would pass while
    // proving the path never ran — the failure mode that makes a guard useless.
    // Assert the scenario actually produced a grounded answer and actually
    // talked to the client before trusting any count.
    expect(answer.grounded, "scenario must produce a grounded answer, or the budget measures nothing").toBe(true);
    expect(counter.total(), "scenario must issue at least one round trip").toBeGreaterThan(0);
    expect(counter.countOf("match_document_chunks_text_v2"), "text retrieval RPC must have run").toBeGreaterThan(0);

    // Measured budget. Update deliberately, in the same commit as any change
    // that moves it, and say why in that commit.
    expect(counter.total(), `round-trip budget exceeded — breakdown: ${JSON.stringify(counter.breakdown())}`).toBe(
      OFFLINE_SINGLE_SOURCE_ROUND_TRIPS,
    );
  });

  it("does not scale round trips with the number of retrieved sources", async () => {
    // The property worth guarding is shape, not magnitude: hydration and
    // metadata lookups must stay batched. A per-source round trip is the
    // regression this catches, and it is invisible to a single-source budget.
    const many = Array.from({ length: 5 }, (_, index) =>
      source({ id: `clozapine-chunk-${index + 1}`, chunk_index: index }),
    );
    const { answer, counter } = await answerWithCountedClient("What ANC threshold should withhold clozapine?", many);

    expect(answer.grounded, "scenario must produce a grounded answer").toBe(true);
    expect(counter.total(), "scenario must issue at least one round trip").toBeGreaterThan(0);
    expect(
      counter.total(),
      `five sources must not cost more round trips than one — breakdown: ${JSON.stringify(counter.breakdown())}`,
    ).toBe(OFFLINE_SINGLE_SOURCE_ROUND_TRIPS);
  });
});

/**
 * Measured on 2026-07-30 against the offline source-only path. Not a target and
 * not derived from first principles — it is what the path does today. See the
 * file header before changing it.
 *
 * The 14 break down as:
 *
 *   from:rag_aliases                        1
 *   rpc:match_document_chunks_text_v2       3
 *   rpc:get_related_document_metadata_v2    2
 *   from:document_index_quality             1
 *   from:document_memory_cards              1
 *   from:document_images                    3
 *   rpc:match_document_table_facts_text_v2  3
 *
 * Two things in that breakdown are worth a reader's attention rather than being
 * silently encoded as "correct". Three calls to each of the text-chunk,
 * table-fact and image lookups for a single query is a repeated-triple shape,
 * and `#101` records exactly that pattern — metadata/memory/visual hydration
 * repeated across branches while `rag.ts` already parallelises three RPCs
 * elsewhere. This budget does not endorse the count; it stops it growing
 * unnoticed and gives `#101` a number to improve against.
 */
const OFFLINE_SINGLE_SOURCE_ROUND_TRIPS = 14;
