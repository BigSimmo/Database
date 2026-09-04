import { describe, expect, expectTypeOf, it } from "vitest";

import { toClientAnswerPayload, type ClientRagAnswerPayload } from "@/lib/answer-client-payload";
import { buildGovernedAnswerClientResponse, buildGovernedDemoAnswerClientResponse } from "@/lib/answer-response";
import { buildAnswerRenderModel } from "@/lib/answer-render-policy";
import { extractSafetyFindings } from "@/lib/clinical-safety";
import { issueContextPackAdmissionReceipt } from "@/lib/rag/rag-context-admission";
import type { RagAnswer, SearchResult } from "@/lib/types";

function fullSource(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Clozapine monitoring guideline",
    file_name: "clozapine.pdf",
    page_number: 4,
    chunk_index: 7,
    section_heading: "Monitoring",
    content: "Full blood count weekly for 18 weeks. ".repeat(60),
    retrieval_synopsis: "FBC weekly for 18 weeks, then monthly.",
    image_ids: [],
    similarity: 0.82,
    corpus_scope: "clinical_kb_site",
    site_content_domain: "medications",
    context_pack_admission: issueContextPackAdmissionReceipt({
      ownerId: null,
      sourcePolicyVersion: "source-policy-v1",
      indexGeneration: null,
      document: null,
      siteContent: {
        releaseId: "12345678-1234-5678-9234-123456789abc",
        releaseDigest: "a".repeat(64),
        changeEpoch: "7",
      },
    }),
    source_metadata: { document_status: "current" } as SearchResult["source_metadata"],
    adjacent_context: "Preceding paragraph context. ".repeat(20),
    document_summary: "A long document summary. ".repeat(30),
    memory_cards: [{ id: "m1" } as never],
    table_facts: [{ id: "t1" } as never],
    index_unit: { unit_type: "table" } as never,
    ...overrides,
  } as SearchResult;
}

function answerWith(sources: SearchResult[]): RagAnswer {
  return {
    answer: "Use the cited source.",
    grounded: true,
    confidence: "high",
    citations: [],
    sources,
  };
}

describe("toClientAnswerPayload", () => {
  it("governs empty-source real and demo answers without requiring source fields", () => {
    const answer = {
      answer: "No source details.",
      grounded: true,
      confidence: "high",
      citations: [],
      sources: [],
    } as RagAnswer;

    expect(buildGovernedAnswerClientResponse(answer).payload).toMatchObject({ sources: [], safetyWarnings: [] });
    expect(buildGovernedDemoAnswerClientResponse(answer)).toMatchObject({
      sources: [],
      safetyWarnings: [],
      demoMode: true,
    });
  });

  it("drops server-only per-source fields the client never renders", () => {
    const trimmed = toClientAnswerPayload(answerWith([fullSource()])).sources![0];
    expect(trimmed).not.toHaveProperty("adjacent_context");
    expect(trimmed).not.toHaveProperty("memory_cards");
    expect(trimmed).not.toHaveProperty("table_facts");
    expect(trimmed).not.toHaveProperty("index_unit");
    expect(trimmed).not.toHaveProperty("document_summary");
    expect(trimmed).not.toHaveProperty("corpus_scope");
    expect(trimmed).not.toHaveProperty("site_content_domain");
    expect(trimmed).not.toHaveProperty("context_pack_admission");
    expect(trimmed).not.toHaveProperty("images");
  });

  it("does not serialize bulky source image objects", () => {
    const image = {
      id: "image-1",
      storage_path: "private/source/page-4.png",
      metadata: { raw: "x".repeat(8_000) },
      table_markdown: `| heading |\n| --- |\n| ${"cell ".repeat(1_000)} |`,
    } as never;
    const source = fullSource({ image_ids: ["image-1"], images: [image] });
    const trimmed = toClientAnswerPayload(answerWith([source])).sources![0];

    expect(trimmed.image_ids).toEqual(["image-1"]);
    expect(trimmed).not.toHaveProperty("images");
    expect(JSON.stringify(trimmed)).not.toContain("private/source/page-4.png");
  });

  it("does not pass unclassified runtime fields through the route boundary", () => {
    const source = { ...fullSource(), future_server_secret: "private" } as SearchResult;
    const trimmed = toClientAnswerPayload(answerWith([source])).sources![0] as SearchResult & {
      future_server_secret?: string;
    };
    expect(trimmed.future_server_secret).toBeUndefined();
  });

  it("keeps identity, snippet, scoring, and governance fields intact", () => {
    const trimmed = toClientAnswerPayload(answerWith([fullSource()])).sources![0];
    expect(trimmed.id).toBe("chunk-1");
    expect(trimmed.title).toBe("Clozapine monitoring guideline");
    expect(trimmed.retrieval_synopsis).toBe("FBC weekly for 18 weeks, then monthly.");
    expect(trimmed.content).toBe("FBC weekly for 18 weeks, then monthly.");
    expect(trimmed.similarity).toBe(0.82);
    expect(trimmed.source_metadata).toEqual({ document_status: "current" });
    expect(trimmed.page_number).toBe(4);
  });

  it("derives safety warnings before replacing full source content with the rendered snippet", () => {
    const source = fullSource({ content: `${"Routine context. ".repeat(60)}Contraindicated in severe disease.` });
    const response = buildGovernedAnswerClientResponse({
      answer: "Review the source.",
      grounded: true,
      confidence: "medium",
      citations: [],
      sources: [source],
    } as RagAnswer);
    const payload = response.payload;

    expect(payload.sources![0].content).toBe(source.retrieval_synopsis);
    expect(payload.sources![0].content.length).toBeLessThan(source.content.length);
    expect(payload.safetyWarnings).toHaveLength(1);
    // Issue 9: governance provenance is retained on safety-finding citations so the
    // safety panel can badge outdated / review-due / unverified sources, consistent
    // with regular source citations (which already keep source_metadata).
    expect(payload.safetyWarnings![0].citation).toHaveProperty("source_metadata", { document_status: "current" });
    expect(extractSafetyFindings(payload)).toHaveLength(1);
  });

  it("leaves short content untouched", () => {
    const short = fullSource({ content: "Short snippet.", retrieval_synopsis: undefined });
    expect(toClientAnswerPayload(answerWith([short])).sources![0].content).toBe("Short snippet.");
  });

  it("does not mutate the original answer (caches keep the full sources)", () => {
    const source = fullSource();
    const answer = answerWith([source]);
    toClientAnswerPayload(answer);
    expect(answer.sources![0].adjacent_context).toBeTruthy();
    expect(answer.sources![0].content.length).toBeGreaterThan(700);
  });

  it("projects answers without sources instead of returning the server object", () => {
    const empty = {
      ...answerWith([]),
      routingReason: "server-only-routing",
      futureServerSecret: "must-not-cross-boundary",
    } as RagAnswer & { futureServerSecret: string };
    expect(toClientAnswerPayload(empty)).toEqual({
      answer: "Use the cited source.",
      grounded: true,
      confidence: "high",
      citations: [],
      sources: [],
      retrievalGateBlocked: false,
      authorityTrustCapRequired: false,
    });
    expect(toClientAnswerPayload(empty)).not.toBe(empty);
  });

  it("returns an explicit allowlisted client type without private answer fields", () => {
    const payload = toClientAnswerPayload(answerWith([]));

    expectTypeOf(payload).toEqualTypeOf<ClientRagAnswerPayload>();
    expectTypeOf(payload).not.toHaveProperty("routingReason");
    expectTypeOf(payload).not.toHaveProperty("fallbackReason");
    expectTypeOf(payload).not.toHaveProperty("retrievalDiagnostics");
    expectTypeOf(payload).not.toHaveProperty("supportedClaims");
    expectTypeOf(payload).not.toHaveProperty("evidenceAssessments");
    expectTypeOf(payload).not.toHaveProperty("smartPanel");
    expectTypeOf(payload).not.toHaveProperty("smartApiPlan");

    type ClientSource = ClientRagAnswerPayload["sources"][number];
    type ClientScope = NonNullable<ClientRagAnswerPayload["scope"]>;
    expectTypeOf<ClientSource>().not.toHaveProperty("adjacent_context");
    expectTypeOf<ClientSource>().not.toHaveProperty("context_pack_admission");
    expectTypeOf<ClientSource>().not.toHaveProperty("document_summary");
    expectTypeOf<ClientSource>().not.toHaveProperty("memory_cards");
    expectTypeOf<ClientSource>().not.toHaveProperty("table_facts");
    expectTypeOf<ClientSource>().not.toHaveProperty("index_unit");
    expectTypeOf<ClientSource>().not.toHaveProperty("corpus_scope");
    expectTypeOf<ClientSource>().not.toHaveProperty("site_content_domain");
    expectTypeOf<ClientSource>().not.toHaveProperty("images");
    expectTypeOf<ClientScope>().not.toHaveProperty("retrieval");
    expectTypeOf(payload.degradedMode).toEqualTypeOf<{ active: boolean; reason?: string | null } | undefined>();
  });

  it("preserves the server-derived high-risk authority cap through projection and rendering", () => {
    const source = fullSource({
      relevance: {
        verdict: "direct",
        label: "Direct",
        matchedTerms: ["monitoring"],
        missingTerms: [],
        directSourceCount: 1,
        weakSourceCount: 0,
        score: 1,
        supportReason: "Direct support",
        isSourceBacked: true,
        coverageScore: 1,
        rankScore: 1,
        titleMatchedTerms: ["monitoring"],
        contentMatchedTerms: ["monitoring"],
        metadataMatchedTerms: [],
        chips: [],
      },
    });
    const response = buildGovernedAnswerClientResponse({
      ...answerWith([source]),
      relevance: source.relevance,
      supportedClaims: [
        {
          claimId: "claim-1",
          text: "High-risk monitoring claim",
          riskClass: "high_risk",
          supportingChunkIds: [source.id],
          supportStatus: "direct",
        },
      ],
      evidenceAssessments: {
        [source.id]: {
          relevance: "direct",
          claimSupport: "direct",
          authority: "unverified",
          currency: "current",
          extractionQuality: "good",
        },
      },
      quoteCards: [
        {
          chunk_id: source.id,
          document_id: source.document_id,
          title: source.title,
          file_name: source.file_name,
          page_number: source.page_number,
          chunk_index: source.chunk_index,
          quote: "High-risk monitoring claim",
          section_heading: source.section_heading,
        },
      ],
    });

    expect(response.payload.authorityTrustCapRequired).toBe(true);
    expect(response.payload).not.toHaveProperty("supportedClaims");
    expect(response.payload).not.toHaveProperty("evidenceAssessments");

    const renderModel = buildAnswerRenderModel(response.payload);
    expect(renderModel.trust).toBe("medium");
    expect(renderModel.quoteCards).toEqual([]);
  });

  it("materially shrinks a representative payload", () => {
    const answer = answerWith(Array.from({ length: 8 }, (_, index) => fullSource({ id: `chunk-${index}` })));
    const fullBytes = JSON.stringify(answer).length;
    const trimmedBytes = JSON.stringify(toClientAnswerPayload(answer)).length;
    expect(trimmedBytes).toBeLessThan(fullBytes * 0.8);
  });
});
