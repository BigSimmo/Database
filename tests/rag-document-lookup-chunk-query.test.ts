import { describe, expect, it, vi } from "vitest";

import { searchDocumentLookupFastPath } from "../src/lib/rag/rag-candidate-sources";

function retrievalRpcBaseName(name: string) {
  return name.replace(/_v[23]$/, "");
}

class EmptyQuery implements PromiseLike<{ data: unknown[]; error: null }> {
  select() {
    return this;
  }

  or() {
    return this;
  }

  eq() {
    return this;
  }

  is() {
    return this;
  }

  in() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
  }
}

describe("document lookup chunk query", () => {
  it("uses the primary expanded clinical variant to choose chunks inside title-matched documents", async () => {
    const rawQuery = "What ANC or FBC cut off means clozapin should be withheld?";
    const primaryVariant = "clozapine wbc neutrophils red range stop";
    const document = {
      id: "clozapine-document",
      title: "Clozapine Prescribing(NMHS)",
      file_name: "Clozapine Prescribing (NMHS).pdf",
      metadata: {},
      text_rank: 0.34,
    };
    const thresholdChunk = {
      id: "clozapine-red-range",
      document_id: document.id,
      page_number: 7,
      chunk_index: 19,
      section_heading: "Monitoring for agranulocytosis and neutropenia",
      section_path: [],
      heading_level: 2,
      parent_heading: null,
      anchor_id: null,
      content: "WBC <3.0 x 109/L and neutrophils <1.5 x 109/L. Stop clozapine therapy immediately in the red range.",
      retrieval_synopsis: null,
      image_ids: [],
      text_rank: 0.8,
    };
    const rpc = vi.fn(async (name: string, _params?: Record<string, unknown>) => {
      void _params;
      if (retrievalRpcBaseName(name) === "match_documents_for_query") return { data: [document], error: null };
      if (retrievalRpcBaseName(name) === "match_document_lookup_chunks_text") {
        return { data: [thresholdChunk], error: null };
      }
      return { data: [], error: null };
    });

    const results = await searchDocumentLookupFastPath({
      supabase: { rpc, from: vi.fn(() => new EmptyQuery()) } as never,
      query: rawQuery,
      queryVariants: [primaryVariant, "clozapine anc fbc"],
      ownerId: "owner-1",
      matchCount: 8,
    });

    const chunkLookupCall = rpc.mock.calls.find(
      ([name]) => retrievalRpcBaseName(name) === "match_document_lookup_chunks_text",
    );
    expect(chunkLookupCall?.[1]).toMatchObject({ query_text: primaryVariant });
    expect(results.map((result) => result.id)).toEqual([thresholdChunk.id]);
  });

  it("uses the derived clinical text query when no explicit retrieval variant is supplied", async () => {
    const rawQuery = "Find the patient safety planning procedure";
    const document = {
      id: "safety-document",
      title: "Patient Safety Planning Procedure",
      file_name: "patient-safety-planning.pdf",
      metadata: {},
      text_rank: 0.34,
    };
    const rpc = vi.fn(async (name: string, _params?: Record<string, unknown>) => {
      void _params;
      if (retrievalRpcBaseName(name) === "match_documents_for_query") return { data: [document], error: null };
      if (retrievalRpcBaseName(name) === "match_document_lookup_chunks_text") return { data: [], error: null };
      return { data: [], error: null };
    });

    await searchDocumentLookupFastPath({
      supabase: { rpc, from: vi.fn(() => new EmptyQuery()) } as never,
      query: rawQuery,
      queryVariants: [],
      ownerId: "owner-1",
      matchCount: 8,
    });

    const chunkLookupCall = rpc.mock.calls.find(
      ([name]) => retrievalRpcBaseName(name) === "match_document_lookup_chunks_text",
    );
    expect(chunkLookupCall?.[1]).toMatchObject({ query_text: "safety planning" });
  });

  it("preserves raw intent terms when a broad document variant drops the requested requirement", async () => {
    const rawQuery = "What discharge documentation is required?";
    const broadVariant = "mental health discharge";
    const document = {
      id: "discharge-document",
      title: "Discharge from Mental Health Services",
      file_name: "MHSP.Discharge.pdf",
      metadata: {},
      text_rank: 0.34,
    };
    const rpc = vi.fn(async (name: string, _params?: Record<string, unknown>) => {
      void _params;
      if (retrievalRpcBaseName(name) === "match_documents_for_query") return { data: [document], error: null };
      if (retrievalRpcBaseName(name) === "match_document_lookup_chunks_text") return { data: [], error: null };
      return { data: [], error: null };
    });

    await searchDocumentLookupFastPath({
      supabase: { rpc, from: vi.fn(() => new EmptyQuery()) } as never,
      query: rawQuery,
      queryVariants: [broadVariant],
      ownerId: "owner-1",
      matchCount: 8,
    });

    const chunkLookupCall = rpc.mock.calls.find(
      ([name]) => retrievalRpcBaseName(name) === "match_document_lookup_chunks_text",
    );
    expect(chunkLookupCall?.[1]).toMatchObject({ query_text: rawQuery });
  });

  it("does not treat a red-section lookup as the measured blood-count action shape", async () => {
    const rawQuery = "Show the red blood count monitoring section for clozapine";
    const broadVariant = "clozapine monitoring";
    const document = {
      id: "clozapine-monitoring-document",
      title: "Clozapine Prescribing(NMHS)",
      file_name: "Clozapine Prescribing (NMHS).pdf",
      metadata: {},
      text_rank: 0.34,
    };
    const rpc = vi.fn(async (name: string, _params?: Record<string, unknown>) => {
      void _params;
      if (retrievalRpcBaseName(name) === "match_documents_for_query") return { data: [document], error: null };
      if (retrievalRpcBaseName(name) === "match_document_lookup_chunks_text") return { data: [], error: null };
      return { data: [], error: null };
    });

    await searchDocumentLookupFastPath({
      supabase: { rpc, from: vi.fn(() => new EmptyQuery()) } as never,
      query: rawQuery,
      queryVariants: [broadVariant],
      ownerId: "owner-1",
      matchCount: 8,
    });

    const chunkLookupCall = rpc.mock.calls.find(
      ([name]) => retrievalRpcBaseName(name) === "match_document_lookup_chunks_text",
    );
    expect(chunkLookupCall?.[1]).toMatchObject({ query_text: rawQuery });
  });
});
