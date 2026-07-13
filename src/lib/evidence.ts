import { citationFromResult, documentCitationHref } from "@/lib/citations";
import { buildEvidenceRelevance } from "@/lib/evidence-relevance";
import { isClinicalImageEvidence } from "@/lib/image-filtering";
import { sourceTextForDisplay, sourceTextForModel } from "@/lib/source-text-sanitizer";
import type {
  BestSourceRecommendation,
  ConflictOrGap,
  DocumentBreakdown,
  EvidenceSummary,
  ImageEvidenceCategory,
  QuoteCard,
  SearchResult,
  SmartPanel,
  SourceCoverage,
  SourceStrength,
  VisualEvidenceCard,
} from "@/lib/types";
import type { ClinicalImageUseClass } from "@/lib/types";

export function normalizeEvidenceText(text: string) {
  return sourceTextForModel(text);
}

function imageMetadata(image: { metadata?: Record<string, unknown> | null }) {
  return image.metadata && typeof image.metadata === "object" ? image.metadata : {};
}

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compactText(value: string | null, limit = 500) {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return compact.length > limit ? `${compact.slice(0, limit - 3).trim()}...` : compact;
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
    ["fbc", "wbc", "anc", "neutrophil", "myocarditis", "metabolic", "constipation"].forEach((token) =>
      expanded.add(token),
    );
  }
  if (tokens.some((token) => ["dose", "dosing", "dosage", "titrate", "titration", "mg", "route"].includes(token))) {
    [
      "dose",
      "doses",
      "dosing",
      "medication",
      "oral",
      "intramuscular",
      "im",
      "po",
      "prn",
      "maximum",
      "repeat",
      "frequency",
      "benzodiazepine",
      "antipsychotic",
      "olanzapine",
      "lorazepam",
      "haloperidol",
      "droperidol",
      "promethazine",
      "diazepam",
    ].forEach((token) => expanded.add(token));
  }
  if (tokens.some((token) => ["withhold", "withholding", "cease", "stop", "stopping"].includes(token))) {
    ["cease", "ceased", "discontinue", "discontinued", "interrupt", "interruption", "red"].forEach((token) =>
      expanded.add(token),
    );
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

function hasDoseSentenceEvidence(sentence: string) {
  return /\b(?:dose|doses|dosage|dosing|mg|mcg|microgram|oral|intramuscular|\bim\b|\bpo\b|\bprn\b|route|frequency|repeat|maximum|benzodiazepine|antipsychotic|olanzapine|lorazepam|haloperidol|droperidol|promethazine|diazepam|administer)\b/i.test(
    sentence,
  );
}

function lowValueSentencePenalty(sentence: string, query: string) {
  const isDoseQuery =
    /\b(?:dose|doses|dosage|dosing|mg|mcg|route|oral|intramuscular|\bim\b|\bpo\b|\bprn\b|titrate|titration)\b/i.test(
      query,
    );
  let penalty = 0;
  if (
    isDoseQuery &&
    /\b(?:supporting information|relevant standards|references|document owner|authorisation|authorised by|published date|effective from|amendment|polypharmacy and high dose antipsychotic prescribing procedure)\b/i.test(
      sentence,
    ) &&
    !/\b(?:mg|mcg|oral|intramuscular|\bim\b|\bpo\b|\bprn\b|repeat|maximum|administer|monitoring:)\b/i.test(sentence)
  ) {
    penalty += 5;
  }
  if (isDoseQuery && !hasDoseSentenceEvidence(sentence)) penalty += 2;
  if (
    /^agitation and arousal:?\s+pharmacological management guideline\b/i.test(sentence) &&
    !hasDoseSentenceEvidence(sentence)
  ) {
    penalty += 3;
  }
  return penalty;
}

function tableRowQuoteCandidates(content: string) {
  const lines = content
    .split(/\r?\n+/)
    .map((line) => normalizeText(line))
    .filter((line) => line.split(/\s+/).length >= 2);
  const candidates: string[] = [];
  let activeHeader: string | null = null;

  for (const line of lines) {
    if (/\bwbc\b/i.test(line) && /\bneutrophil\b/i.test(line) && /\boutcome\b/i.test(line)) {
      activeHeader = line;
      continue;
    }
    if (
      activeHeader &&
      /\b(?:green|amber|red)\b/i.test(line) &&
      /\b(?:continue|cease|required|blood tests?)\b/i.test(line)
    ) {
      candidates.push(`${activeHeader} ${line}`);
    }
  }

  return candidates;
}

// Returns the best-matching quote plus whether it was cut at the 340-char cap. Truncation is
// surfaced on the card (isTruncated) so a dose/threshold that fell past the cut is never presented
// as if it were the complete passage — the reader is told to open the source.
function bestQuoteFromContent(content: string, query: string): { quote: string; truncated: boolean } {
  const clean = normalizeText(content);
  if (!clean) return { quote: "", truncated: false };

  const tokens = queryTokens(query);
  const displayContent = sourceTextForDisplay(content) || clean;
  const rawLineCandidates = displayContent
    .split(/\r?\n+/)
    .map((line) => normalizeText(line))
    .filter((line) => line.split(/\s+/).length >= 3);
  const sentenceCandidates = clean
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const sentences = Array.from(
    new Set([...tableRowQuoteCandidates(content), ...rawLineCandidates, ...sentenceCandidates]),
  );

  const best =
    sentences
      .map((sentence) => {
        const score = sentenceScore(sentence, tokens);
        const lengthPenalty = sentence.length > 340 ? 6 : sentence.length > 260 ? 1.2 : sentence.length > 180 ? 0.4 : 0;
        return { sentence, score, adjustedScore: score - lengthPenalty - lowValueSentencePenalty(sentence, query) };
      })
      .sort(
        (a, b) => b.adjustedScore - a.adjustedScore || b.score - a.score || a.sentence.length - b.sentence.length,
      )[0]?.sentence ?? clean;

  if (best.length <= 340) return { quote: best, truncated: false };
  return { quote: `${best.slice(0, 337).trim()}...`, truncated: true };
}

function normalizeText(text: string) {
  return normalizeEvidenceText(text);
}

export function extractQuoteCards(results: SearchResult[], query: string, limit = 4) {
  const seen = new Set<string>();
  const quoteCards: QuoteCard[] = [];

  for (const result of results) {
    const { quote, truncated } = bestQuoteFromContent(result.content, query);
    if (!quote) continue;
    const key = `${result.document_id}:${result.page_number}:${quote.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    quoteCards.push({
      ...citationFromResult(result),
      quote,
      isTruncated: truncated,
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

// Audit L10: callers that already computed relevance/visual evidence for the
// same query+results (the hot search route does) can pass them in instead of
// paying for a recomputation whose smart-panel copy was then overwritten.
export function buildSmartPanel(
  query: string,
  results: SearchResult[],
  precomputed?: {
    relevance?: ReturnType<typeof buildEvidenceRelevance>;
    visualEvidence?: ReturnType<typeof buildVisualEvidence>;
  },
) {
  const quoteCards = extractQuoteCards(results, query);
  const documentBreakdown = buildDocumentBreakdown(results, quoteCards);
  const visualEvidence = precomputed?.visualEvidence ?? buildVisualEvidence(results);
  const bestSource = selectBestSourceRecommendation(results, quoteCards);
  const relevance = precomputed?.relevance ?? buildEvidenceRelevance(query, results);

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
    relevance,
  } satisfies SmartPanel;
}

export function selectBestSourceRecommendation(
  results: SearchResult[],
  quoteCards?: QuoteCard[],
): BestSourceRecommendation | null {
  if (results.length === 0) return null;

  const quotedChunkIds = new Set((quoteCards ?? []).map((quote) => quote.chunk_id));
  if (quoteCards && quotedChunkIds.size === 0) return null;

  const quoteSupportedResults = quoteCards ? results.filter((result) => quotedChunkIds.has(result.id)) : results;
  const candidates = quoteSupportedResults.some((result) => result.relevance?.isSourceBacked)
    ? quoteSupportedResults.filter((result) => result.relevance?.isSourceBacked)
    : quoteSupportedResults;
  let best = candidates[0];
  for (const result of candidates.slice(1)) {
    const bestScore = best.hybrid_score ?? best.similarity;
    const resultScore = result.hybrid_score ?? result.similarity;
    if (resultScore > bestScore || (resultScore === bestScore && result.similarity > best.similarity)) {
      best = result;
    }
  }

  const directQuote = quoteCards?.find((quote) => quote.chunk_id === best.id);
  const documentQuote = quoteCards?.find((quote) => quote.document_id === best.document_id);
  const quote = directQuote?.quote ?? documentQuote?.quote;
  // Track truncation by the pre-slice length rather than guessing from the
  // post-trim snippet length (=== 260 dropped the ellipsis when trim shortened a
  // truncated slice, and appended a spurious "..." to a complete 260-char quote).
  const fullContent = normalizeText(best.content).trim();
  const snippet = quote ?? (fullContent.length > 260 ? `${fullContent.slice(0, 257).trimEnd()}...` : fullContent);
  const citation = citationFromResult(best);

  return {
    ...citation,
    source_strength: best.source_strength ?? sourceStrengthForSimilarity(best.similarity),
    score: best.hybrid_score ?? best.similarity,
    snippet,
    quote,
    section_heading: best.section_heading,
    image_count: (best.images ?? []).filter((image) => isClinicalImageEvidence(image)).length,
    viewer_href: documentCitationHref(citation),
    relevance: best.relevance,
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
    has_images: results.some((source) => source.images?.some((image) => isClinicalImageEvidence(image))),
  };
}

export function buildVisualEvidence(results: SearchResult[], limit = 8) {
  const seen = new Set<string>();
  const cards: Array<VisualEvidenceCard & { priority: number }> = [];

  for (const result of results) {
    for (const image of result.images ?? []) {
      if (!isClinicalImageEvidence(image)) continue;
      if (seen.has(image.id)) continue;
      seen.add(image.id);
      const pageNumber = image.page_number ?? result.page_number;
      const metadata = imageMetadata(image);
      const rawTableText = metadataText(metadata, "table_text") ?? image.accessibleTableMarkdown ?? null;
      const tableText = image.tableTextSnippet ?? rawTableText ?? metadataText(metadata, "table_text_snippet");
      const sourceKind = image.sourceKind ?? image.source_kind ?? metadataText(metadata, "source_kind");
      const tableRole = image.tableRole ?? metadataText(metadata, "table_role");
      const priority =
        (sourceKind === "table_crop" ? 40 : 0) +
        (tableRole === "clinical" ? 30 : tableRole === "admin" || tableRole === "reference" ? 8 : 0) +
        (result.relevance?.verdict === "direct"
          ? 36
          : result.relevance?.verdict === "partial"
            ? 18
            : result.relevance?.verdict === "nearby"
              ? -10
              : 0) +
        (image.clinical_relevance_score ?? 0) * 20;
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
        image_type: image.image_type as ImageEvidenceCategory | undefined,
        clinical_relevance_score: image.clinical_relevance_score,
        source_kind: sourceKind,
        tableLabel: image.tableLabel ?? metadataText(metadata, "table_label"),
        tableTitle: image.tableTitle ?? metadataText(metadata, "table_title"),
        tableRole,
        clinicalUseClass:
          typeof metadata.clinical_use_class === "string"
            ? (metadata.clinical_use_class as ClinicalImageUseClass)
            : (image.clinicalUseClass ?? null),
        clinicalUseReason:
          typeof metadata.clinical_use_reason === "string"
            ? metadata.clinical_use_reason
            : (image.clinicalUseReason ?? null),
        accessibleTableMarkdown:
          typeof metadata.accessible_table_markdown === "string"
            ? metadata.accessible_table_markdown
            : (image.accessibleTableMarkdown ?? rawTableText),
        tableRows: Array.isArray(metadata.table_rows) ? (metadata.table_rows as string[][]) : (image.tableRows ?? null),
        tableColumns: Array.isArray(metadata.table_columns)
          ? (metadata.table_columns as string[])
          : (image.tableColumns ?? null),
        tableTextSnippet: compactText(tableText),
        labels: image.labels,
        relevance: result.relevance,
        priority,
      });
    }
  }

  return cards
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((card) => {
      const { priority, ...publicCard } = card;
      void priority;
      return publicCard;
    });
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

// Cross-source safety-threshold disagreement (threat-model #10 / INJ-10).
//
// detectConflictsOrGaps previously compared only document count and top
// similarity, so a poisoned or OCR-corrupted upload that faithfully STATES a
// wrong withholding threshold (e.g. "withhold clozapine if ANC < 0.2 ×10⁹/L"
// against the corpus-standard "< 1.5") passed every gate — the number is in a
// cited chunk, so numeric verification "confirms" it. This surfaces the
// disagreement as a {type:"conflict"} so the clinician sees it.
//
// It is deliberately narrow to keep false positives near zero on real clinical
// prose: it only compares values that are (a) tied to a WITHHOLDING action
// (cease/withhold/stop) — so legitimate red/amber monitoring bands and titration
// schedules never trip it — (b) for a small set of haematological threshold
// parameters, and (c) contradicting ACROSS two different documents. A single
// document listing several zone cutoffs is not a cross-source conflict.
const WITHHOLD_ACTION_PATTERN =
  /\b(?:withhold|withheld|withholding|cease|ceased|ceasing|stop(?:ped|ping)?|discontinue|discontinued|suspend(?:ed)?|do not (?:give|administer|prescribe)|hold\b)\b/i;

type ThresholdParameter = { key: string; label: string; pattern: RegExp };
const THRESHOLD_PARAMETERS: ThresholdParameter[] = [
  {
    key: "anc",
    label: "ANC (absolute neutrophil count)",
    pattern: /\b(?:anc|absolute neutrophil count|neutrophils?)\b/i,
  },
  {
    key: "wbc",
    label: "white cell count (WBC)",
    pattern: /\b(?:wbc|white (?:blood )?cell(?: count)?|leu[ck]ocytes?)\b/i,
  },
  { key: "platelet", label: "platelet count", pattern: /\bplatelets?\b/i },
];

// A threshold parameter within a short window of a "below" comparator and a
// numeric value. Only "below"-type comparators (a floor for stopping therapy)
// are matched — an upper ceiling is a different clinical statement.
const THRESHOLD_SPAN_PATTERN =
  /\b(anc|absolute neutrophil count|neutrophils?|wbc|white (?:blood )?cell(?: count)?|leu[ck]ocytes?|platelets?)\b[^.\n;]{0,32}?(?:<|≤|<=|less than|below|under|lower than|fall(?:s|ing)? below|drops? below)\s*(\d+(?:\.\d+)?)/gi;

function thresholdParameterFor(raw: string): ThresholdParameter | undefined {
  return THRESHOLD_PARAMETERS.find((parameter) => parameter.pattern.test(raw));
}

// Canonicalize "1.50" / "1.5" / "01.5" to one key so cosmetic formatting is not
// mistaken for disagreement; invalid/zero-length values are dropped.
function canonicalThresholdValue(raw: string): string | null {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? String(value) : null;
}

type ThresholdObservation = { value: string; documentId: string; chunkId: string };

function collectWithholdThresholds(results: SearchResult[]): Map<string, ThresholdObservation[]> {
  const byParameter = new Map<string, ThresholdObservation[]>();
  const record = (parameterKey: string, value: string | null, documentId: string, chunkId: string) => {
    if (!value) return;
    const list = byParameter.get(parameterKey) ?? [];
    list.push({ value, documentId, chunkId });
    byParameter.set(parameterKey, list);
  };

  for (const result of results) {
    // Prose: only sentences that express a withholding action contribute, so a
    // "continue monitoring if ANC 0.5–1.5" band in the same chunk is ignored.
    const prose = [result.content ?? "", result.adjacent_context ?? ""].filter(Boolean).join(" ");
    for (const sentence of prose.split(/(?<=[.;:\n])\s+|\n+/)) {
      if (!WITHHOLD_ACTION_PATTERN.test(sentence)) continue;
      for (const match of sentence.matchAll(THRESHOLD_SPAN_PATTERN)) {
        const parameter = thresholdParameterFor(match[1]);
        if (parameter) record(parameter.key, canonicalThresholdValue(match[2]), result.document_id, result.id);
      }
    }

    // Structured table facts carry the action and threshold in separate columns
    // (no comparator), so extract them directly rather than via the prose regex.
    for (const fact of result.table_facts ?? []) {
      if (!fact.action || !fact.clinical_parameter || !fact.threshold_value) continue;
      if (!WITHHOLD_ACTION_PATTERN.test(fact.action)) continue;
      const parameter = thresholdParameterFor(fact.clinical_parameter);
      if (parameter) {
        record(
          parameter.key,
          canonicalThresholdValue(fact.threshold_value),
          result.document_id,
          fact.source_chunk_id ?? result.id,
        );
      }
    }
  }

  return byParameter;
}

function detectThresholdDisagreements(results: SearchResult[]): ConflictOrGap[] {
  const conflicts: ConflictOrGap[] = [];
  for (const [parameterKey, observations] of collectWithholdThresholds(results)) {
    const distinctValues = new Set(observations.map((observation) => observation.value));
    const distinctDocuments = new Set(observations.map((observation) => observation.documentId));
    // A cross-source conflict needs two different values reported by two
    // different documents; one document that contradicts itself, or agreeing
    // sources, are not flagged here.
    if (distinctValues.size < 2 || distinctDocuments.size < 2) continue;
    const label =
      THRESHOLD_PARAMETERS.find((candidate) => candidate.key === parameterKey)?.label ?? "clinical threshold";
    const values = [...distinctValues].sort((a, b) => Number(a) - Number(b));
    conflicts.push({
      type: "conflict",
      message: `Sources disagree on the ${label} withholding threshold (${values.join(
        " vs ",
      )}). Confirm the correct cut-off against the primary guideline before acting on any single source.`,
      source_chunk_ids: [...new Set(observations.map((observation) => observation.chunkId))].slice(0, 4),
    });
  }
  return conflicts;
}

export function detectConflictsOrGaps(results: SearchResult[]): ConflictOrGap[] {
  if (results.length === 0) {
    return [{ type: "gap", message: "No indexed passages were strong enough to support an answer." }];
  }

  const documents = new Set(results.map((source) => source.document_id));
  const gaps: ConflictOrGap[] = [...detectThresholdDisagreements(results)];

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

export function diversifySearchResults(results: SearchResult[], limit = 12, maxPerDocument = 4, preserveOrder = false) {
  const enriched = dedupeSearchResults(results).map((result) => ({
    ...result,
    source_strength: result.source_strength ?? sourceStrengthForSimilarity(result.similarity),
  }));

  if (!preserveOrder) {
    enriched.sort((a, b) => {
      const aScore = a.hybrid_score ?? a.similarity;
      const bScore = b.hybrid_score ?? b.similarity;
      return (
        bScore - aScore ||
        b.similarity - a.similarity ||
        a.document_id.localeCompare(b.document_id) ||
        a.id.localeCompare(b.id)
      );
    });
  }

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
