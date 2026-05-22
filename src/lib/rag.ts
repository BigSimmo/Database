import { createAdminClient } from "@/lib/supabase/admin";
import { embedText, generateTextResponse } from "@/lib/openai";
import { compactCitations } from "@/lib/citations";
import { expandClinicalQuery, rankClinicalResults } from "@/lib/clinical-search";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import { z } from "zod";
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
import type { AnswerSection, Citation, ConflictOrGap, QuoteCard, RagAnswer, SearchResult } from "@/lib/types";

type OwnerScopedArgs = {
  ownerId?: string;
  documentId?: string;
  documentIds?: string[];
};

const confidenceOrder = {
  unsupported: 0,
  low: 1,
  medium: 2,
  high: 3,
} as const;

const citationSchema = z.object({
  chunk_id: z.string(),
  document_id: z.string().optional(),
  title: z.string().optional(),
  file_name: z.string().optional(),
  page_number: z.number().nullable().optional(),
  chunk_index: z.number().optional(),
});

const answerJsonSchema = z.object({
  answer: z.string().min(1).optional(),
  grounded: z.boolean().optional(),
  confidence: z.enum(["high", "medium", "low", "unsupported"]).optional(),
  answerSections: z
    .array(
      z.object({
        heading: z.string().min(1),
        body: z.string().min(1),
        citation_chunk_ids: z.array(z.string()).optional().default([]),
      }),
    )
    .optional()
    .default([]),
  citations: z.array(citationSchema).optional().default([]),
  quoteCards: z
    .array(
      citationSchema.extend({
        quote: z.string().min(1),
        section_heading: z.string().nullable().optional(),
      }),
    )
    .optional()
    .default([]),
  conflictsOrGaps: z
    .array(
      z.object({
        type: z.enum(["gap", "conflict"]).catch("gap"),
        message: z.string().min(1),
        source_chunk_ids: z.array(z.string()).optional(),
      }),
    )
    .optional()
    .default([]),
});

function resultCitation(result: SearchResult): Citation {
  return {
    chunk_id: result.id,
    document_id: result.document_id,
    title: result.title,
    file_name: result.file_name,
    page_number: result.page_number,
    chunk_index: result.chunk_index,
    similarity: result.similarity,
    source_metadata: result.source_metadata,
  };
}

function allowedChunkMap(results: SearchResult[]) {
  return new Map(results.map((result) => [result.id, result]));
}

function deriveConfidence(results: SearchResult[], acceptedCitationCount: number): RagAnswer["confidence"] {
  if (acceptedCitationCount === 0 || results.length === 0) return "unsupported";
  const strongest = results.reduce((max, result) => Math.max(max, result.similarity), 0);
  if (strongest >= 0.82 && acceptedCitationCount >= 2) return "high";
  if (strongest >= 0.64) return "medium";
  return "low";
}

function clampConfidence(
  proposed: RagAnswer["confidence"] | undefined,
  derived: RagAnswer["confidence"],
): RagAnswer["confidence"] {
  if (!proposed) return derived;
  return confidenceOrder[proposed] < confidenceOrder[derived] ? proposed : derived;
}

function sanitizeCitations(proposed: Array<{ chunk_id: string }> | undefined, results: SearchResult[]) {
  const chunks = allowedChunkMap(results);
  const citations: Citation[] = [];
  const seen = new Set<string>();

  for (const citation of proposed ?? []) {
    const source = chunks.get(citation.chunk_id);
    if (!source || seen.has(source.id)) continue;
    seen.add(source.id);
    citations.push(resultCitation(source));
  }

  if (proposed && proposed.length > 0) return citations;
  return compactCitations(results);
}

function sanitizeAnswerSections(sections: AnswerSection[] | undefined, results: SearchResult[]): AnswerSection[] {
  const allowed = new Set(results.map((result) => result.id));
  return (sections ?? [])
    .map((section) => ({
      heading: section.heading,
      body: section.body,
      citation_chunk_ids: section.citation_chunk_ids.filter((id) => allowed.has(id)),
    }))
    .filter((section) => section.citation_chunk_ids.length > 0);
}

function sanitizeQuoteCards(
  cards: Array<{ chunk_id: string; quote: string; section_heading?: string | null }> | undefined,
  results: SearchResult[],
): QuoteCard[] {
  const chunks = allowedChunkMap(results);
  return (cards ?? [])
    .map((card) => {
      const source = chunks.get(card.chunk_id);
      if (!source) return null;
      return {
        ...resultCitation(source),
        quote: card.quote,
        section_heading: card.section_heading ?? source.section_heading,
      } satisfies QuoteCard;
    })
    .filter((card): card is QuoteCard => Boolean(card));
}

function sanitizeConflictsOrGaps(items: ConflictOrGap[] | undefined, results: SearchResult[]): ConflictOrGap[] {
  const allowed = new Set(results.map((result) => result.id));
  return (items ?? [])
    .map((item) => ({
      type: item.type,
      message: item.message,
      source_chunk_ids: item.source_chunk_ids?.filter((id) => allowed.has(id)),
    }))
    .filter((item) => !item.source_chunk_ids || item.source_chunk_ids.length > 0);
}

function normalizeSearchResults(results: SearchResult[]) {
  return results.map((result) => ({
    ...result,
    source_metadata: normalizeSourceMetadata(result.source_metadata),
  }));
}

function safeFallbackAnswer(raw: string, results: SearchResult[]): RagAnswer {
  const citations = compactCitations(results);
  const confidence = deriveConfidence(results, citations.length);
  return {
    answer: raw || "The model returned an invalid response. Verify the retrieved sources before using this answer.",
    grounded: citations.length > 0 && confidence !== "unsupported",
    confidence,
    citations,
    sources: results,
    answerSections: [],
    conflictsOrGaps: detectConflictsOrGaps(results),
    visualEvidence: buildVisualEvidence(results),
    bestSource: selectBestSourceRecommendation(results),
  };
}

async function resolveDocumentFilterList(
  supabase: ReturnType<typeof createAdminClient>,
  args: OwnerScopedArgs,
): Promise<string[] | undefined> {
  const requestedDocumentIds = args.documentIds?.length
    ? args.documentIds
    : args.documentId
      ? [args.documentId]
      : undefined;

  if (!args.ownerId) {
    return requestedDocumentIds;
  }

  let query = supabase.from("documents").select("id").eq("owner_id", args.ownerId);
  if (requestedDocumentIds?.length) {
    query = query.in("id", requestedDocumentIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((document: { id: string }) => document.id);
}

export async function searchChunks(args: {
  query: string;
  topK?: number;
  minSimilarity?: number;
  documentId?: string;
  documentIds?: string[];
  ownerId?: string;
}) {
  const supabase = createAdminClient();
  const documentFilterList = await resolveDocumentFilterList(supabase, args);
  if (args.ownerId && documentFilterList?.length === 0) {
    return [];
  }

  const expandedQuery = expandClinicalQuery(args.query);
  const embedding = await embedText(expandedQuery);
  const candidateCount = Math.max((args.topK ?? 8) * 3, 24);
  const minSimilarity = args.minSimilarity ?? 0.15;

  const { data: hybridData, error: hybridError } = await supabase.rpc("match_document_chunks_hybrid", {
    query_embedding: embedding,
    query_text: expandedQuery,
    match_count: candidateCount,
    min_similarity: minSimilarity,
    document_filters: documentFilterList ?? null,
  });

  if (!hybridError) {
    return diversifySearchResults(
      rankClinicalResults(args.query, (hybridData ?? []) as SearchResult[]),
      args.topK ?? 8,
    );
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

  return diversifySearchResults(rankClinicalResults(args.query, resultSets.flat()), args.topK ?? 8);
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

export function parseAnswerJson(raw: string, results: SearchResult[]): RagAnswer {
  try {
    const parsed = answerJsonSchema.parse(JSON.parse(raw));
    const citations = sanitizeCitations(parsed.citations, results);
    const derivedConfidence = parsed.citations.length
      ? deriveConfidence(results, citations.length)
      : clampConfidence("low", deriveConfidence(results, citations.length));
    const confidence = clampConfidence(parsed.confidence, derivedConfidence);
    return {
      answer: parsed.answer ?? raw,
      grounded: citations.length > 0 && confidence !== "unsupported",
      confidence,
      citations,
      sources: results,
      answerSections: sanitizeAnswerSections(parsed.answerSections, results),
      conflictsOrGaps: sanitizeConflictsOrGaps(parsed.conflictsOrGaps, results),
      quoteCards: sanitizeQuoteCards(parsed.quoteCards, results),
      visualEvidence: [],
      bestSource: null,
      documentBreakdown: [],
    };
  } catch {
    return safeFallbackAnswer(raw, results);
  }
}

export async function answerQuestion(query: string, documentId?: string) {
  return answerQuestionWithScope({ query, documentId });
}

export async function answerQuestionWithScope(args: {
  query: string;
  documentId?: string;
  documentIds?: string[];
  ownerId?: string;
}) {
  const results = normalizeSearchResults(
    await searchChunks({
      query: args.query,
      documentId: args.documentId,
      documentIds: args.documentIds,
      ownerId: args.ownerId,
      topK: 12,
      minSimilarity: 0.12,
    }),
  );
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
    owner_id: args.ownerId ?? null,
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

export async function summarizeDocument(documentId: string, ownerId?: string) {
  const supabase = createAdminClient();
  let documentQuery = supabase.from("documents").select("id,title,file_name,metadata").eq("id", documentId);

  if (ownerId) {
    documentQuery = documentQuery.eq("owner_id", ownerId);
  }

  const { data: document, error: documentError } = await documentQuery.maybeSingle();

  if (documentError) throw new Error(documentError.message);
  if (!document) throw new Error("Document not found.");

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
    source_metadata: normalizeSourceMetadata((document as { metadata?: unknown }).metadata),
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
