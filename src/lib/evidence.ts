import { citationFromResult, documentCitationHref } from "@/lib/citations";
import type {
  BestSourceRecommendation,
  ConflictOrGap,
  DocumentBreakdown,
  EvidenceSummary,
  QuoteCard,
  SearchResult,
  SmartPanel,
  SourceCoverage,
  SourceStrength,
  VisualEvidenceCard,
} from "@/lib/types";

const imageTagPattern = /\[\[IMAGE_DATA_START\]\][\s\S]*?\[\[IMAGE_DATA_END\]\]/g;

export function normalizeEvidenceText(text: string) {
  return text
    .replace(imageTagPattern, (tag) => {
      const description = tag.match(/Description:\s*([\s\S]*?)\s*\[\[IMAGE_DATA_END\]\]/)?.[1];
      return description ? `Image evidence: ${description.trim()}` : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function sourceStrengthForSimilarity(similarity: number): SourceStrength {
  if (similarity >= 0.82) return "strong";
  if (similarity >= 0.64) return "moderate";
  return "limited";
}

function queryTokens(query: string) {
  const tokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3);
  const expanded = new Set(tokens);

  if (tokens.some((token) => ["toxicity", "safety", "lithium"].includes(token))) {
    ["vomiting", "diarrhoea", "dehydration", "tremor", "confusion", "ataxia"].forEach((token) => expanded.add(token));
  }
  if (tokens.some((token) => ["clozapine", "table", "image", "monitoring"].includes(token))) {
    ["fbc", "anc", "myocarditis", "metabolic", "constipation"].forEach((token) => expanded.add(token));
  }
  if (tokens.some((token) => ["risk", "escalate", "senior"].includes(token))) {
    ["intent", "attempt", "agitation", "supervision", "review"].forEach((token) => expanded.add(token));
  }

  return expanded;
}

function sentenceScore(sentence: string, tokens: Set<string>) {
  const lowered = sentence.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (lowered.includes(token)) score += 1;
  }
  return score;
}

function bestQuoteFromContent(content: string, query: string) {
  const clean = normalizeText(content);
  if (!clean) return "";

  const tokens = queryTokens(query);
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const best =
    sentences
      .map((sentence) => ({ sentence, score: sentenceScore(sentence, tokens) }))
      .sort((a, b) => b.score - a.score || b.sentence.length - a.sentence.length)[0]?.sentence ?? clean;

  if (best.length <= 340) return best;
  return `${best.slice(0, 337).trim()}...`;
}

function normalizeText(text: string) {
  return normalizeEvidenceText(text);
}

export function extractQuoteCards(results: SearchResult[], query: string, limit = 4) {
  const seen = new Set<string>();
  const quoteCards: QuoteCard[] = [];

  for (const result of results) {
    const quote = bestQuoteFromContent(result.content, query);
    if (!quote) continue;
    const key = `${result.document_id}:${result.page_number}:${quote.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    quoteCards.push({
      ...citationFromResult(result),
      quote,
      section_heading: result.section_heading,
      source_strength: result.source_strength ?? sourceStrengthForSimilarity(result.similarity),
    });
    if (quoteCards.length >= limit) break;
  }

  return quoteCards;
}

export function buildDocumentBreakdown(results: SearchResult[], quoteCards: QuoteCard[] = []) {
  const grouped = new Map<string, DocumentBreakdown>();

  for (const result of results) {
    const existing = grouped.get(result.document_id);
    const page = result.page_number ?? undefined;

    if (!existing) {
      grouped.set(result.document_id, {
        document_id: result.document_id,
        title: result.title,
        file_name: result.file_name,
        top_similarity: result.similarity,
        source_strength: sourceStrengthForSimilarity(result.similarity),
        source_count: 1,
        quote_count: 0,
        pages: page ? [page] : [],
        best_quote: quoteCards.find((quote) => quote.document_id === result.document_id)?.quote,
      });
      continue;
    }

    existing.top_similarity = Math.max(existing.top_similarity, result.similarity);
    existing.source_strength = sourceStrengthForSimilarity(existing.top_similarity);
    existing.source_count += 1;
    if (page && !existing.pages.includes(page)) existing.pages.push(page);
    existing.best_quote ??= quoteCards.find((quote) => quote.document_id === result.document_id)?.quote;
  }

  for (const quote of quoteCards) {
    const item = grouped.get(quote.document_id);
    if (item) item.quote_count += 1;
  }

  return Array.from(grouped.values()).sort((a, b) => b.top_similarity - a.top_similarity);
}

export function buildSmartPanel(query: string, results: SearchResult[]) {
  const quoteCards = extractQuoteCards(results, query);
  const documentBreakdown = buildDocumentBreakdown(results, quoteCards);
  const visualEvidence = buildVisualEvidence(results);
  const bestSource = selectBestSourceRecommendation(results, quoteCards);

  return {
    query,
    total_sources: results.length,
    documents: documentBreakdown,
    quotes: quoteCards,
    visualEvidence,
    bestSource,
    image_count: visualEvidence.length,
    evidenceSummary: buildEvidenceSummary(results, quoteCards),
    sourceCoverage: buildSourceCoverage(results),
    conflictsOrGaps: detectConflictsOrGaps(results),
  } satisfies SmartPanel;
}

export function selectBestSourceRecommendation(
  results: SearchResult[],
  quoteCards: QuoteCard[] = [],
): BestSourceRecommendation | null {
  if (results.length === 0) return null;

  let best = results[0];
  for (const result of results.slice(1)) {
    const bestScore = best.hybrid_score ?? best.similarity;
    const resultScore = result.hybrid_score ?? result.similarity;
    if (resultScore > bestScore || (resultScore === bestScore && result.similarity > best.similarity)) {
      best = result;
    }
  }

  const directQuote = quoteCards.find((quote) => quote.chunk_id === best.id);
  const documentQuote = quoteCards.find((quote) => quote.document_id === best.document_id);
  const quote = directQuote?.quote ?? documentQuote?.quote;
  const snippet = quote ?? normalizeText(best.content).slice(0, 260).trim();
  const citation = citationFromResult(best);

  return {
    ...citation,
    source_strength: best.source_strength ?? sourceStrengthForSimilarity(best.similarity),
    score: best.hybrid_score ?? best.similarity,
    snippet: snippet.length === 260 ? `${snippet.slice(0, 257).trim()}...` : snippet,
    quote,
    section_heading: best.section_heading,
    image_count: (best.images ?? []).filter((image) => image.searchable !== false).length,
    viewer_href: documentCitationHref(citation),
  };
}

export function dedupeSearchResults(results: SearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const clean = normalizeText(result.content).toLowerCase();
    const key = `${result.document_id}:${result.page_number}:${clean.slice(0, 220)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildSourceCoverage(results: SearchResult[]): SourceCoverage {
  const pages = Array.from(
    new Set(results.map((source) => source.page_number).filter((page): page is number => Boolean(page))),
  ).sort((a, b) => a - b);
  const documents = new Set(results.map((source) => source.document_id));
  const strongest = results.reduce((max, source) => Math.max(max, source.similarity), 0);

  return {
    documents_used: documents.size,
    pages,
    strongest_similarity: strongest,
    has_images: results.some((source) => source.images?.some((image) => image.searchable !== false)),
  };
}

export function buildVisualEvidence(results: SearchResult[], limit = 8) {
  const seen = new Set<string>();
  const cards: VisualEvidenceCard[] = [];

  for (const result of results) {
    for (const image of result.images ?? []) {
      if (image.searchable === false || image.image_type === "logo_decorative") continue;
      if (seen.has(image.id)) continue;
      seen.add(image.id);
      const pageNumber = image.page_number ?? result.page_number;
      cards.push({
        id: `${result.id}:${image.id}`,
        image_id: image.id,
        signed_url_endpoint: `/api/images/${image.id}/signed-url`,
        caption: image.caption,
        document_id: result.document_id,
        title: result.title,
        file_name: result.file_name,
        page_number: pageNumber,
        source_chunk_id: result.id,
        chunk_index: result.chunk_index,
        viewer_href: `/documents/${result.document_id}?page=${pageNumber ?? 1}&chunk=${result.id}`,
        image_type: image.image_type,
        clinical_relevance_score: image.clinical_relevance_score,
        labels: image.labels,
      });
      if (cards.length >= limit) return cards;
    }
  }

  return cards;
}

export function buildEvidenceSummary(results: SearchResult[], quoteCards: QuoteCard[] = []): EvidenceSummary {
  const imageCount = buildVisualEvidence(results).length;
  const coverage = buildSourceCoverage(results);
  const strength = results.length ? sourceStrengthForSimilarity(coverage.strongest_similarity) : "none";

  return {
    document_count: coverage.documents_used,
    total_sources: results.length,
    quote_count: quoteCards.length,
    image_count: imageCount,
    source_strength: strength,
    summary: results.length
      ? `Grounded in ${results.length} retrieved source${results.length === 1 ? "" : "s"} across ${coverage.documents_used} document${coverage.documents_used === 1 ? "" : "s"}.`
      : "No indexed source passages met the retrieval threshold.",
  };
}

export function detectConflictsOrGaps(results: SearchResult[]): ConflictOrGap[] {
  if (results.length === 0) {
    return [{ type: "gap", message: "No indexed passages were strong enough to support an answer." }];
  }

  const documents = new Set(results.map((source) => source.document_id));
  const gaps: ConflictOrGap[] = [];

  if (documents.size === 1) {
    gaps.push({
      type: "gap",
      message:
        "Current evidence comes from one document; broaden document scope if you need cross-document comparison.",
      source_chunk_ids: results.slice(0, 3).map((source) => source.id),
    });
  }

  if (results[0]?.similarity < 0.64) {
    gaps.push({
      type: "gap",
      message: "Top sources are limited-strength matches, so the answer should be treated as low confidence.",
      source_chunk_ids: results.slice(0, 3).map((source) => source.id),
    });
  }

  return gaps;
}

export function diversifySearchResults(results: SearchResult[], limit = 12, maxPerDocument = 4) {
  const enriched = dedupeSearchResults(results)
    .map((result) => ({
      ...result,
      source_strength: result.source_strength ?? sourceStrengthForSimilarity(result.similarity),
    }))
    .sort((a, b) => {
      const aScore = a.hybrid_score ?? a.similarity;
      const bScore = b.hybrid_score ?? b.similarity;
      return bScore - aScore || b.similarity - a.similarity;
    });

  const documentCounts = new Map<string, number>();
  const selected: SearchResult[] = [];

  for (const result of enriched) {
    const count = documentCounts.get(result.document_id) ?? 0;
    if (count >= maxPerDocument) continue;
    selected.push(result);
    documentCounts.set(result.document_id, count + 1);
    if (selected.length >= limit) return selected;
  }

  for (const result of enriched) {
    if (selected.some((source) => source.id === result.id)) continue;
    selected.push(result);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function reconcileQuoteCards(
  proposed: QuoteCard[] | undefined,
  results: SearchResult[],
  query: string,
  limit = 4,
) {
  const validated = (proposed ?? []).filter((quote) => {
    const source = results.find((result) => result.id === quote.chunk_id);
    if (!source) return false;
    return normalizeEvidenceText(source.content).includes(normalizeEvidenceText(quote.quote));
  });

  if (validated.length >= Math.min(limit, 1)) {
    return validated.slice(0, limit).map((quote) => ({
      ...quote,
      source_strength: quote.source_strength ?? sourceStrengthForSimilarity(quote.similarity ?? 0),
    }));
  }

  return extractQuoteCards(results, query, limit);
}
