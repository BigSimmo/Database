import { describe, expect, it } from "vitest";

import { answerStateForAnswer, resolveAnswerSources } from "@/components/clinical-dashboard/answer-copy-payload";
import type { RagAnswer, SearchResult } from "@/lib/types";

const overdueSource: SearchResult = {
  id: "chunk-1",
  document_id: "doc-1",
  title: "Superseded WA protocol",
  file_name: "protocol.pdf",
  page_number: 3,
  chunk_index: 0,
  section_heading: "Dosing",
  content: "Legacy dose text.",
  image_ids: [],
  similarity: 0.9,
  images: [],
  source_metadata: {
    document_status: "outdated",
    review_date: "2020-01-01",
  },
};

function answerWith(sources: SearchResult[]): RagAnswer {
  return {
    answer: "Start at 12.5 mg at night.",
    grounded: true,
    confidence: "high",
    citations: [],
    sources,
  };
}

describe("resolveAnswerSources", () => {
  it("keeps a populated answer.sources set", () => {
    expect(resolveAnswerSources([overdueSource], [])).toEqual([overdueSource]);
  });

  it("falls back when answer.sources is an empty array", () => {
    // RagAnswer.sources is a required array, so "not populated" arrives as [] —
    // nullish coalescing alone would keep [] and drop the fallback.
    expect(resolveAnswerSources([], [overdueSource])).toEqual([overdueSource]);
  });

  it("falls back when answer.sources is nullish", () => {
    expect(resolveAnswerSources(undefined, [overdueSource])).toEqual([overdueSource]);
    expect(resolveAnswerSources(null, [overdueSource])).toEqual([overdueSource]);
  });
});

describe("answerStateForAnswer · empty sources fallback", () => {
  it("projects stale_evidence from the fallback when answer.sources is []", () => {
    const state = answerStateForAnswer({
      answer: answerWith([]),
      sources: [overdueSource],
    });

    expect(state.kind).toBe("stale_evidence");
    if (state.kind !== "stale_evidence") return;
    expect(state.sourceCount).toBe(1);
    expect(state.overdue[0]?.sourceId).toBe("doc-1");
  });

  it("does not invent stale_evidence when both sets are empty", () => {
    const state = answerStateForAnswer({
      answer: answerWith([]),
      sources: [],
    });

    expect(state).toEqual({ kind: "ready", sourceCount: 0 });
  });
});
