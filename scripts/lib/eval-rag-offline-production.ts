import { readFile } from "node:fs/promises";

import type { CorpusTopicTermStats } from "@/lib/corpus-grounding";
import type { RagQueryClass, SearchResult } from "@/lib/types";

type ContentTerm = string | string[];
type GoldenCase = {
  id: string;
  query: string;
  expectedQueryClass: RagQueryClass;
  expectedDocumentSubstrings: string[];
  expectedContentTerms: ContentTerm[];
  topK: number;
  expectTableEvidence: boolean;
};

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validateFixtures(value: unknown): GoldenCase[] {
  invariant(Array.isArray(value), "Golden retrieval fixture must be an array.");
  invariant(value.length === 36, `Expected 36 golden cases, received ${value.length}.`);
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    invariant(item && typeof item === "object", `Golden case ${index + 1} must be an object.`);
    const row = item as Record<string, unknown>;
    invariant(typeof row.id === "string" && row.id.length > 0, `Golden case ${index + 1} has no id.`);
    invariant(!ids.has(row.id), `Duplicate golden case id: ${row.id}.`);
    ids.add(row.id);
    invariant(typeof row.query === "string" && row.query.length > 0, `${row.id}: query is required.`);
    invariant(typeof row.expectedQueryClass === "string", `${row.id}: expectedQueryClass is required.`);
    invariant(Array.isArray(row.expectedDocumentSubstrings), `${row.id}: document expectations must be an array.`);
    invariant(Array.isArray(row.expectedContentTerms), `${row.id}: content expectations must be an array.`);
    invariant(Number.isInteger(row.topK) && Number(row.topK) > 0, `${row.id}: topK must be positive.`);
    invariant(typeof row.expectTableEvidence === "boolean", `${row.id}: expectTableEvidence must be boolean.`);
  }
  return value as GoldenCase[];
}

function term(value: ContentTerm | undefined) {
  if (!value) return "clinical";
  return Array.isArray(value) ? (value[0] ?? "clinical") : value;
}

function sourceMetadata(): NonNullable<SearchResult["source_metadata"]> {
  return {
    source_title: "Offline golden source",
    publisher: "Clinical KB offline preflight",
    jurisdiction: "Australia/WA",
    version: "offline",
    publication_date: null,
    review_date: null,
    uploaded_at: null,
    indexed_at: null,
    uploaded_by: null,
    document_status: "current",
    clinical_validation_status: "approved",
    extraction_quality: "good",
  };
}

function syntheticEvidence(testCase: GoldenCase): SearchResult[] {
  const titles = testCase.expectedDocumentSubstrings.length
    ? testCase.expectedDocumentSubstrings
    : [`${testCase.id} clinical source`];
  const content = testCase.expectedContentTerms.map(term).join(" ");
  return titles.map((title, index) => ({
    id: `${testCase.id}-chunk-${index + 1}`,
    document_id: `${testCase.id}-document-${index + 1}`,
    title,
    file_name: `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`,
    page_number: index + 1,
    chunk_index: 0,
    section_heading: testCase.expectTableEvidence ? "Clinical threshold table" : "Clinical guidance",
    content: `${testCase.query}. ${content}. Current source-backed clinical guidance.`,
    image_ids: [],
    similarity: 0.86 - index * 0.02,
    hybrid_score: 0.88 - index * 0.02,
    source_strength: "strong",
    source_metadata: sourceMetadata(),
    table_facts: testCase.expectTableEvidence
      ? [
          {
            id: `${testCase.id}-fact-${index + 1}`,
            document_id: `${testCase.id}-document-${index + 1}`,
            source_chunk_id: `${testCase.id}-chunk-${index + 1}`,
            source_image_id: null,
            page_number: index + 1,
            table_title: "Clinical threshold table",
            row_label: "Offline test row",
            clinical_parameter: term(testCase.expectedContentTerms[0]),
            threshold_value: "Source-defined threshold",
            action: "Follow the cited source.",
          },
        ]
      : [],
    images: [],
  }));
}

function corpusStats(terms: string[]): CorpusTopicTermStats[] {
  const titleCounts: Record<string, number> = { anorexia: 1, bipolar: 1, disorder: 33, management: 375 };
  return terms.map((termValue) => ({
    term: termValue,
    has_ts_signal: true,
    title_doc_count: titleCounts[termValue] ?? 0,
    chunk_present: true,
    total_doc_count: 2000,
  }));
}

export async function runOfflineRagPreflight() {
  const fixtures = validateFixtures(
    JSON.parse(await readFile(new URL("../fixtures/rag-retrieval-golden.json", import.meta.url), "utf8")),
  );
  const [clinicalSearch, corpusGrounding, rag, retrieval, renderPolicy] = await Promise.all([
    import("@/lib/clinical-search"),
    import("@/lib/corpus-grounding"),
    import("@/lib/rag"),
    import("@/lib/retrieval-selection"),
    import("@/lib/answer-render-policy"),
  ]);

  for (const testCase of fixtures) {
    let analysis = clinicalSearch.analyzeClinicalQuery(testCase.query);
    if (testCase.id === "bare-topic-bipolar" || testCase.id === "bare-topic-anorexia") {
      corpusGrounding.resetCorpusGroundingCacheForTests();
      const rpc = async (_name: string, args: { terms: string[] }) => ({ data: corpusStats(args.terms), error: null });
      analysis = await rag.analyzeQueryWithClassifierFallback(testCase.query, analysis, {
        corpusGrounding: { supabase: { rpc } as never, ownerFilter: null },
      });
      invariant(analysis.corpusGrounding === "in_corpus_topic", `${testCase.id}: corpus fallback did not run.`);
    }
    invariant(
      analysis.queryClass === testCase.expectedQueryClass,
      `${testCase.id}: expected ${testCase.expectedQueryClass}, received ${analysis.queryClass}.`,
    );

    const selected = retrieval.selectRetrievalEvidence({
      query: testCase.query,
      queryClass: analysis.queryClass,
      results: syntheticEvidence(testCase),
      topK: testCase.topK,
      maxResultsPerDocument: 2,
    });
    invariant(selected.results.length > 0, `${testCase.id}: evidence selection returned no rows.`);
    for (const title of testCase.expectedDocumentSubstrings) {
      invariant(
        selected.results.some((result) => result.title.includes(title)),
        `${testCase.id}: lost source ${title}.`,
      );
    }
    if (testCase.expectTableEvidence) {
      invariant(
        selected.results.some((result) => (result.table_facts?.length ?? 0) > 0),
        `${testCase.id}: table evidence was lost.`,
      );
    }

    const citedSource = selected.results[0]!;
    const answer = rag.parseAnswerJson(
      JSON.stringify({
        answer: "Follow the current cited source for the requested clinical guidance.",
        grounded: true,
        confidence: "high",
        citations: [{ chunk_id: citedSource.id }],
        answerSections: [
          {
            heading: "Source-backed guidance",
            body: "Use the current source and verify patient-specific decisions.",
            citation_chunk_ids: [citedSource.id],
          },
        ],
      }),
      selected.results,
      testCase.query,
    );
    invariant(answer.grounded, `${testCase.id}: valid citation was not grounded.`);
    invariant(
      answer.citations.some(
        (citation) => citation.chunk_id === citedSource.id && citation.document_id === citedSource.document_id,
      ),
      `${testCase.id}: citation mapping lost source identity.`,
    );
    const render = renderPolicy.buildAnswerRenderModel(answer, { sources: selected.results });
    invariant(render.trust !== "unsupported", `${testCase.id}: grounded answer rendered unsupported.`);
    invariant(render.primarySources.length > 0, `${testCase.id}: render policy dropped cited sources.`);
  }

  const weakSource = syntheticEvidence(fixtures[0]!)[0]!;
  const weakAnswer = rag.parseAnswerJson(
    JSON.stringify({
      answer: "Uncited clinical assertion.",
      grounded: true,
      confidence: "high",
      citations: [{ chunk_id: "not-retrieved" }],
    }),
    [weakSource],
  );
  invariant(!weakAnswer.grounded && weakAnswer.confidence === "unsupported", "Weak evidence did not fail closed.");
  invariant(
    renderPolicy.buildAnswerRenderModel(weakAnswer, { sources: [weakSource] }).trust === "unsupported",
    "Weak evidence did not render as unsupported.",
  );

  console.log(
    `Offline RAG preflight passed (${fixtures.length}/36 golden classifications; production selection, citation mapping, fail-closed, and render policy exercised).`,
  );
}
