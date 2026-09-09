import { describe, expect, it } from "vitest";
import type { ClinicalQueryMode } from "../src/lib/clinical-query-mode";
import { sharedAnswerNormalizedQuery } from "../src/lib/rag/rag-cache";

/**
 * The shared answer cache is keyed on the question, so its key must preserve the
 * identity of that question.
 *
 * `buildClinicalTextSearchQuery` — which the search-plan cache correctly uses — is a
 * retrieval-plan builder, not a normaliser: several of its branches replace the whole
 * token list with a fixed topic label (clozapine monitoring, missed dose, agitation,
 * discharge). Two clinically distinct questions then share one plan, which is exactly
 * what makes it a good *search* key and a dangerous *answer* key: the second asker gets
 * the first asker's answer, grounded and correctly cited, with no warning anywhere.
 *
 * These cases are the collapse branches, not hypotheticals. Anything that reintroduces a
 * lossy transform into the answer key turns them red.
 */
describe("shared answer cache key identity", () => {
  const key = (query: string, queryMode?: ClinicalQueryMode) => sharedAnswerNormalizedQuery({ query, queryMode });

  it("separates distinct clinical questions that share a retrieval plan", () => {
    const cases: Array<[string, string, string]> = [
      [
        "clozapine monitoring",
        "What clozapine blood monitoring is required at baseline?",
        "Who must be notified of an abnormal clozapine full blood count result?",
      ],
      [
        "clozapine missed dose",
        "How long can a clozapine dose be missed before retitration?",
        "Who authorises restarting clozapine after a missed dose?",
      ],
      [
        "agitation",
        "What is the first line pharmacological management of acute agitation?",
        "Which staff member documents the arousal score after agitation management?",
      ],
      [
        "discharge",
        "Summarise the mental health discharge documentation requirements.",
        "Who signs off the mental health discharge summary?",
      ],
    ];

    for (const [label, first, second] of cases) {
      expect(key(first), `${label}: distinct questions must not share an answer cache key`).not.toBe(key(second));
    }
  });

  it("keeps the query mode part of the key", () => {
    // The mode used to be folded into the collapsible plan text, so the splice branches
    // erased it too and an `auto` answer could be served to a mode-specific request.
    const query = "What clozapine blood monitoring is required at baseline?";
    expect(key(query, "auto")).not.toBe(key(query, "monitoring_schedule"));
    expect(key(query, "monitoring_schedule")).not.toBe(key(query, "dose_threshold_lookup"));
  });

  it("still reuses the cache for the same question asked with different spacing or case", () => {
    expect(key("What clozapine blood monitoring is required at baseline?")).toBe(
      key("  what   CLOZAPINE blood monitoring is required at baseline?  "),
    );
  });
});
