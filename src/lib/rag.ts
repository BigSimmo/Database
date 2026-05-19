import { createAdminClient } from "@/lib/supabase/admin";
import { embedText, generateTextResponse } from "@/lib/openai";
import { compactCitations } from "@/lib/citations";
import {
  buildDocumentBreakdown,
  buildEvidenceSummary,
  buildSmartPanel,
  buildSourceCoverage,
  buildVisualEvidence,
  detectConflictsOrGaps,
  diversifySearchResults,
  extractQuoteCards,
  reconcileQuoteCards,
  selectBestSourceRecommendation,
} from "@/lib/evidence";
import type { RagAnswer, SearchResult } from "@/lib/types";

export async function searchChunks(args: {
  query: string;
  topK?: number;
  minSimilarity?: number;
  documentId?: string;
  documentIds?: string[];
}) {
  const embedding = await embedText(args.query);
  const supabase = createAdminClient();
  const documentFilterList = args.documentIds?.length
    ? args.documentIds
    : args.documentId
      ? [args.documentId]
      : undefined;
  const candidateCount = Math.max((args.topK ?? 8) * 3, 24);
  const minSimilarity = args.minSimilarity ?? 0.15;

  const { data: hybridData, error: hybridError } = await supabase.rpc("match_document_chunks_hybrid", {
    query_embedding: embedding,
    query_text: args.query,
    match_count: candidateCount,
    min_similarity: minSimilarity,
    document_filters: documentFilterList ?? null,
  });

  if (!hybridError) {
    return diversifySearchResults((hybridData ?? []) as SearchResult[], args.topK ?? 8);
  }

  const vectorFilters = documentFilterList?.length ? documentFilterList : [null];

  const resultSets = await Promise.all(
    vectorFilters.map(async (documentFilter) => {
      const { data, error } = await supabase.rpc("match_document_chunks", {
        query_embedding: embedding,
        match_count: candidateCount,
        min_similarity: minSimilarity,
        document_filter: documentFilter,
      });

      if (error) throw new Error(error.message);
      return (data ?? []) as SearchResult[];
    }),
  );

  return diversifySearchResults(resultSets.flat(), args.topK ?? 8);
}

function sourceBlock(results: SearchResult[]) {
  return results
    .map((result, index) => {
      const page = result.page_number ? `page ${result.page_number}` : "page unavailable";
      const images = result.images?.length
        ? `\nImages: ${result.images.map((image) => image.caption).join(" | ")}`
        : "";
      return [
        `[${index + 1}] ${result.title} (${result.file_name}, ${page}, chunk ${result.chunk_index}, similarity ${result.similarity.toFixed(3)})`,
        result.content,
        images,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function parseAnswerJson(raw: string, results: SearchResult[]): RagAnswer {
  try {
    const parsed = JSON.parse(raw) as Partial<RagAnswer>;
    return {
      answer: parsed.answer ?? raw,
      grounded: Boolean(parsed.grounded),
      confidence: parsed.confidence ?? "low",
      citations: parsed.citations?.length ? parsed.citations : compactCitations(results),
      sources: results,
      answerSections: parsed.answerSections ?? [],
      evidenceSummary: parsed.evidenceSummary,
      conflictsOrGaps: parsed.conflictsOrGaps ?? [],
      sourceCoverage: parsed.sourceCoverage,
      quoteCards: parsed.quoteCards ?? [],
      visualEvidence: parsed.visualEvidence ?? [],
      bestSource: parsed.bestSource,
      documentBreakdown: parsed.documentBreakdown ?? [],
      smartPanel: parsed.smartPanel,
    };
  } catch {
    return {
      answer: raw,
      grounded: results.length > 0,
      confidence: results.length > 0 ? "medium" : "unsupported",
      citations: compactCitations(results),
      sources: results,
      answerSections: [],
      conflictsOrGaps: detectConflictsOrGaps(results),
      visualEvidence: buildVisualEvidence(results),
      bestSource: selectBestSourceRecommendation(results),
    };
  }
}

export async function answerQuestion(query: string, documentId?: string) {
  return answerQuestionWithScope({ query, documentId });
}

export async function answerQuestionWithScope(args: {
  query: string;
  documentId?: string;
  documentIds?: string[];
}) {
  const results = await searchChunks({
    query: args.query,
    documentId: args.documentId,
    documentIds: args.documentIds,
    topK: 12,
    minSimilarity: 0.12,
  });
  const quoteCards = extractQuoteCards(results, args.query);
  const documentBreakdown = buildDocumentBreakdown(results, quoteCards);
  const smartPanel = buildSmartPanel(args.query, results);
  const evidenceSummary = buildEvidenceSummary(results, quoteCards);
  const sourceCoverage = buildSourceCoverage(results);
  const conflictsOrGaps = detectConflictsOrGaps(results);
  const visualEvidence = buildVisualEvidence(results);
  const bestSource = selectBestSourceRecommendation(results, quoteCards);

  if (results.length === 0) {
    const emptyPanel = buildSmartPanel(args.query, []);
    return {
      answer:
        "I could not find enough support in the indexed documents to answer this question. Upload or index a relevant guideline, then search again.",
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
      answerSections: [],
      quoteCards: [],
      visualEvidence: [],
      bestSource: null,
      documentBreakdown: [],
      evidenceSummary: emptyPanel.evidenceSummary,
      sourceCoverage: emptyPanel.sourceCoverage,
      conflictsOrGaps: emptyPanel.conflictsOrGaps,
      smartPanel: emptyPanel,
    } satisfies RagAnswer;
  }

  const prompt = `You are answering for a psychiatrist in Perth, Australia using only the uploaded clinical document excerpts below.

Rules:
- Answer directly and concisely from the provided excerpts only.
- Prefer Australian or WA-specific guidance when present in the sources.
- Do not provide patient-specific medical advice.
- If the excerpts do not support a direct answer, say that the uploaded documents do not contain enough information.
- Use wording close to the retrieved source text.
- Put the grounded synthesis first. Then include supported detail sections only if useful.
- Compare sources when several documents are relevant. Mention gaps or weak support when the evidence is narrow.
- Include clinically practical details and caveats only when supported.
- Include short exact quotes in quoteCards; quotes must be copied from the retrieved source excerpts.
- Return strict JSON only with this shape:
{"answer":"...","grounded":true,"confidence":"high|medium|low|unsupported","answerSections":[{"heading":"...","body":"...","citation_chunk_ids":["..."]}],"citations":[{"chunk_id":"...","document_id":"...","title":"...","file_name":"...","page_number":1,"chunk_index":0}],"quoteCards":[{"chunk_id":"...","document_id":"...","title":"...","file_name":"...","page_number":1,"chunk_index":0,"quote":"exact source quote","section_heading":"..."}],"conflictsOrGaps":[{"type":"gap","message":"...","source_chunk_ids":["..."]}]}

Question: ${args.query}

Sources:
${sourceBlock(results)}`;

  const raw = await generateTextResponse(prompt);
  const answer = parseAnswerJson(raw, results);
  answer.quoteCards = reconcileQuoteCards(answer.quoteCards, results, args.query);
  answer.documentBreakdown = documentBreakdown;
  answer.evidenceSummary = evidenceSummary;
  answer.sourceCoverage = sourceCoverage;
  answer.conflictsOrGaps = answer.conflictsOrGaps?.length ? answer.conflictsOrGaps : conflictsOrGaps;
  answer.visualEvidence = visualEvidence;
  answer.bestSource = selectBestSourceRecommendation(results, answer.quoteCards) ?? bestSource;
  answer.smartPanel = { ...smartPanel, bestSource: answer.bestSource };

  const supabase = createAdminClient();
  await supabase.from("rag_queries").insert({
    query: args.query,
    answer: answer.answer,
    source_chunk_ids: results.map((result) => result.id),
    model: process.env.OPENAI_ANSWER_MODEL ?? "gpt-4.1",
    metadata: {
      document_id: args.documentId ?? null,
      document_ids: args.documentIds ?? null,
      grounded: answer.grounded,
      quote_count: answer.quoteCards?.length ?? 0,
      visual_evidence_count: answer.visualEvidence?.length ?? 0,
      evidence_summary: answer.evidenceSummary,
    },
  });

  return answer;
}

export async function summarizeDocument(documentId: string) {
  const supabase = createAdminClient();
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id,title,file_name")
    .eq("id", documentId)
    .single();

  if (documentError) throw new Error(documentError.message);

  const { data: chunks, error } = await supabase
    .from("document_chunks")
    .select("id,document_id,page_number,chunk_index,section_heading,content,image_ids")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true })
    .limit(40);

  if (error) throw new Error(error.message);
  if (!chunks?.length) {
    return {
      answer: "This document has not been indexed yet, so no summary can be generated.",
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
    } satisfies RagAnswer;
  }

  const results = chunks.map((chunk) => ({
    ...chunk,
    title: document.title,
    file_name: document.file_name,
    similarity: 1,
    images: [],
  })) as SearchResult[];

  const prompt = `Summarize this clinical document for practical psychiatric use in Perth, Australia.
Use only the excerpts provided. Focus on high-yield actions, thresholds, medication/risk monitoring, exceptions, and citations.
Return strict JSON only with this shape:
{"answer":"...","grounded":true,"confidence":"high|medium|low|unsupported","citations":[{"chunk_id":"...","document_id":"...","title":"...","file_name":"...","page_number":1,"chunk_index":0}]}

Document: ${document.title}
Sources:
${sourceBlock(results)}`;

  const answer = parseAnswerJson(await generateTextResponse(prompt), results);
  answer.quoteCards = reconcileQuoteCards(answer.quoteCards, results, "summary");
  answer.documentBreakdown = buildDocumentBreakdown(results, answer.quoteCards);
  answer.evidenceSummary = buildEvidenceSummary(results, answer.quoteCards);
  answer.sourceCoverage = buildSourceCoverage(results);
  answer.conflictsOrGaps = detectConflictsOrGaps(results);
  answer.visualEvidence = buildVisualEvidence(results);
  answer.bestSource = selectBestSourceRecommendation(results, answer.quoteCards);
  answer.smartPanel = { ...buildSmartPanel("summary", results), bestSource: answer.bestSource };
  return answer;
}
