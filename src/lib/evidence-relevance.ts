import { hasDoseEvidenceSupport, normalizedClinicalSearchTokens } from "@/lib/clinical-search";
import { sourceTextForDisplay } from "@/lib/source-text-sanitizer";
import type {
  DocumentMatch,
  EvidenceRelevance,
  EvidenceRelevanceVerdict,
  SearchResult,
  SourceEvidenceRelevance,
  SourceStrength,
} from "@/lib/types";

const genericQueryTerms = new Set([
  "answer",
  "available",
  "because",
  "before",
  "could",
  "clinical",
  "consider",
  "document",
  "does",
  "evidence",
  "for",
  "from",
  "have",
  "guideline",
  "help",
  "how",
  "indexed",
  "information",
  "issue",
  "item",
  "list",
  "management",
  "overview",
  "passage",
  "patient",
  "policy",
  "question",
  "recommendation",
  "review",
  "reviewed",
  "reviewing",
  "shown",
  "should",
  "source",
  "support",
  "table",
  "text",
  "that",
  "the",
  "these",
  "this",
  "those",
  "would",
  "what",
  "when",
  "where",
  "which",
  "with",
]);

const namedMedicationTerms = new Set([
  "amisulpride",
  "aripiprazole",
  "carbamazepine",
  "clozapine",
  "diazepam",
  "droperidol",
  "haloperidol",
  "lamotrigine",
  "lithium",
  "lorazepam",
  "olanzapine",
  "paliperidone",
  "promethazine",
  "quetiapine",
  "risperidone",
  "valproate",
  "zuclopenthixol",
]);

const verdictLabels: Record<EvidenceRelevanceVerdict, string> = {
  direct: "Direct match",
  partial: "Partial match",
  nearby: "Nearby only",
  none: "No direct indexed evidence",
};

function uniq(values: string[], limit = 8) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTerm(term: string) {
  const cleaned = term.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (cleaned.endsWith("s") && !cleaned.endsWith("ss")) return cleaned.slice(0, -1);
  return cleaned;
}

export function queryCoreTerms(query: string) {
  const normalized = normalizedClinicalSearchTokens(query).map(normalizeTerm).filter(Boolean);
  const raw = (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).map(normalizeTerm).filter(Boolean);
  const candidates = uniq([...normalized, ...raw], 14);
  const specific = candidates.filter((term) => term.length >= 3 && !genericQueryTerms.has(term));
  return specific.length ? specific.slice(0, 10) : candidates.filter((term) => term.length >= 3).slice(0, 10);
}

function textIncludesTerm(text: string, term: string) {
  if (!term) return false;
  if (term.length <= 3) return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
  return text.includes(term);
}

function normalizeSearchText(value: string) {
  return sourceTextForDisplay(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function labelsText(labels?: Array<{ label?: string | null; label_type?: string | null }>) {
  return (labels ?? []).map((label) => `${label.label_type ?? ""} ${label.label ?? ""}`).join(" ");
}

function sourceTextBlocks(source: SearchResult) {
  const title = normalizeSearchText(
    `${source.title} ${source.file_name} ${source.section_heading ?? ""} ${(source.section_path ?? []).join(" ")}`,
  );
  const content = normalizeSearchText(
    [
      source.content,
      source.adjacent_context ?? "",
      ...(source.table_facts ?? []).map((fact) =>
        [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
          .filter(Boolean)
          .join(" "),
      ),
      ...(source.memory_cards ?? []).map((card) => `${card.title} ${card.content}`),
      ...(source.images ?? []).map((image) =>
        [
          image.caption,
          image.tableLabel,
          image.tableTitle,
          image.tableTextSnippet,
          image.accessibleTableMarkdown,
          image.labels?.join(" "),
        ]
          .filter(Boolean)
          .join(" "),
      ),
    ].join(" "),
  );
  const metadata = normalizeSearchText(`${labelsText(source.document_labels)} ${source.document_summary ?? ""}`);
  return { title, content, metadata, all: `${title} ${content} ${metadata}` };
}

function baseRankScore(source: SearchResult | DocumentMatch) {
  const raw =
    "score" in source
      ? source.score
      : (source.score_explanation?.finalScore ?? source.hybrid_score ?? source.similarity ?? 0);
  return clamp(Number.isFinite(raw) ? raw : 0);
}

function sourceStrengthBonus(strength: SourceStrength | undefined) {
  if (strength === "strong") return 0.16;
  if (strength === "moderate") return 0.08;
  if (strength === "limited") return -0.05;
  return 0;
}

function directnessVerdict(args: {
  coreTerms: string[];
  medicationTerms: string[];
  matchedTerms: string[];
  contentMatchedTerms: string[];
  coverageScore: number;
  rankScore: number;
  strength?: SourceStrength;
  doseQuery: boolean;
  hasDoseEvidence: boolean;
}) {
  const medicationCovered =
    args.medicationTerms.length === 0 || args.medicationTerms.every((term) => args.matchedTerms.includes(term));
  const enoughContent = args.contentMatchedTerms.length >= Math.min(2, Math.max(1, args.coreTerms.length));
  const enoughScore = args.rankScore >= 0.5 || args.strength === "strong" || args.strength === "moderate";
  const hasDoseSupport = !args.doseQuery || args.hasDoseEvidence;

  if (
    args.coreTerms.length > 0 &&
    medicationCovered &&
    hasDoseSupport &&
    args.coverageScore >= 0.72 &&
    enoughContent &&
    enoughScore
  ) {
    return "direct" satisfies EvidenceRelevanceVerdict;
  }

  if (
    args.matchedTerms.length > 0 &&
    medicationCovered &&
    hasDoseSupport &&
    (args.coverageScore >= 0.5 ||
      (args.coverageScore >= 0.42 &&
        (args.rankScore >= 0.5 || args.strength === "strong" || args.strength === "moderate")) ||
      args.contentMatchedTerms.length >= 3)
  ) {
    return "partial" satisfies EvidenceRelevanceVerdict;
  }

  if (args.matchedTerms.length > 0 || args.rankScore > 0) return "nearby" satisfies EvidenceRelevanceVerdict;
  return "none" satisfies EvidenceRelevanceVerdict;
}

function supportReason(
  relevance: Pick<SourceEvidenceRelevance, "verdict" | "matchedTerms" | "missingTerms" | "rankScore">,
) {
  if (relevance.verdict === "direct") {
    return `Matched core concepts: ${relevance.matchedTerms.slice(0, 4).join(", ")}.`;
  }
  if (relevance.verdict === "partial") {
    return relevance.missingTerms.length
      ? `Some query concepts are supported, but missing: ${relevance.missingTerms.slice(0, 4).join(", ")}.`
      : "Some query concepts are supported by retrieved source text.";
  }
  if (relevance.verdict === "nearby") {
    return relevance.matchedTerms.length
      ? `Only adjacent concepts matched: ${relevance.matchedTerms.slice(0, 4).join(", ")}.`
      : "Retrieved passages scored as nearby neighbors without direct concept coverage.";
  }
  return "No retrieved indexed passage covered the query concepts.";
}

function relevanceChips(relevance: Pick<SourceEvidenceRelevance, "verdict" | "matchedTerms" | "missingTerms">) {
  const chips: string[] = [];
  if (relevance.matchedTerms.length) chips.push(`matched: ${relevance.matchedTerms.slice(0, 3).join(", ")}`);
  if (relevance.missingTerms.length) chips.push(`missing: ${relevance.missingTerms.slice(0, 3).join(", ")}`);
  if (relevance.verdict === "direct") chips.push("direct evidence");
  if (relevance.verdict === "partial") chips.push("partial support");
  if (relevance.verdict === "nearby") chips.push("nearby only");
  if (relevance.verdict === "none") chips.push("no direct support");
  if (relevance.verdict === "nearby" || relevance.verdict === "none") chips.push("limited support");
  return chips.slice(0, 4);
}

export function buildSourceRelevance(query: string, source: SearchResult): SourceEvidenceRelevance {
  const coreTerms = queryCoreTerms(query);
  const medicationTerms = coreTerms.filter((term) => namedMedicationTerms.has(term));
  const blocks = sourceTextBlocks(source);
  const titleMatchedTerms = coreTerms.filter((term) => textIncludesTerm(blocks.title, term));
  const contentMatchedTerms = coreTerms.filter((term) => textIncludesTerm(blocks.content, term));
  const metadataMatchedTerms = coreTerms.filter((term) => textIncludesTerm(blocks.metadata, term));
  const matchedTerms = uniq([...contentMatchedTerms, ...titleMatchedTerms, ...metadataMatchedTerms], 10);
  const missingTerms = coreTerms.filter((term) => !matchedTerms.includes(term));
  const coverageScore = coreTerms.length ? matchedTerms.length / coreTerms.length : 0;
  const contentCoverage = coreTerms.length ? contentMatchedTerms.length / coreTerms.length : 0;
  const rankScore = baseRankScore(source);
  const doseQuery =
    /\b(?:dose|dosing|dosage|mg|mcg|microgram|route|oral|intramuscular|\bim\b|\bpo\b|\bprn\b|titrate|titration|maximum)\b/i.test(
      query,
    );
  const verdict = directnessVerdict({
    coreTerms,
    medicationTerms,
    matchedTerms,
    contentMatchedTerms,
    coverageScore,
    rankScore,
    strength: source.source_strength,
    doseQuery,
    hasDoseEvidence: hasDoseEvidenceSupport(source),
  });
  const score = clamp(
    coverageScore * 0.52 + contentCoverage * 0.23 + rankScore * 0.2 + sourceStrengthBonus(source.source_strength),
  );
  const partial: SourceEvidenceRelevance = {
    verdict,
    label: verdictLabels[verdict],
    matchedTerms,
    missingTerms,
    directSourceCount: verdict === "direct" ? 1 : 0,
    weakSourceCount: verdict === "nearby" || verdict === "none" ? 1 : 0,
    score: Number(score.toFixed(3)),
    supportReason: "",
    isSourceBacked: verdict === "direct" || verdict === "partial",
    coverageScore: Number(coverageScore.toFixed(3)),
    rankScore: Number(rankScore.toFixed(3)),
    titleMatchedTerms,
    contentMatchedTerms,
    metadataMatchedTerms,
    chips: [],
  };
  partial.supportReason = supportReason(partial);
  partial.chips = relevanceChips(partial);
  return partial;
}

export function annotateSearchResults(query: string, results: SearchResult[]) {
  return results.map((result) => ({
    ...result,
    relevance: result.relevance ?? buildSourceRelevance(query, result),
  }));
}

export function buildEvidenceRelevance(query: string, results: SearchResult[]): EvidenceRelevance {
  if (results.length === 0) {
    return {
      verdict: "none",
      label: verdictLabels.none,
      matchedTerms: [],
      missingTerms: queryCoreTerms(query),
      directSourceCount: 0,
      weakSourceCount: 0,
      score: 0,
      supportReason: "No indexed passages were retrieved for the query.",
      isSourceBacked: false,
    };
  }

  const annotated = results.map((result) => result.relevance ?? buildSourceRelevance(query, result));
  const directSourceCount = annotated.filter((item) => item.verdict === "direct").length;
  const partialSourceCount = annotated.filter((item) => item.verdict === "partial").length;
  const weakSourceCount = annotated.filter((item) => item.verdict === "nearby" || item.verdict === "none").length;
  const matchedTerms = uniq(
    annotated.flatMap((item) => item.matchedTerms),
    10,
  );
  const coreTerms = queryCoreTerms(query);
  const missingTerms = coreTerms.filter((term) => !matchedTerms.includes(term));
  const topScore = Math.max(0, ...annotated.map((item) => item.score));
  const avgTopScore =
    annotated
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .reduce((sum, item) => sum + item.score, 0) / Math.min(3, annotated.length);
  const score = Number(Math.max(topScore, avgTopScore).toFixed(3));
  const verdict: EvidenceRelevanceVerdict =
    directSourceCount > 0 && missingTerms.length === 0
      ? "direct"
      : directSourceCount > 0 || partialSourceCount > 0
        ? "partial"
        : matchedTerms.length > 0 || results.length > 0
          ? "nearby"
          : "none";
  const relevance: EvidenceRelevance = {
    verdict,
    label: verdictLabels[verdict],
    matchedTerms,
    missingTerms,
    directSourceCount,
    weakSourceCount,
    score,
    supportReason: "",
    isSourceBacked: verdict === "direct" || verdict === "partial",
  };
  relevance.supportReason =
    verdict === "direct"
      ? `Direct indexed support found in ${directSourceCount} source${directSourceCount === 1 ? "" : "s"}.`
      : verdict === "partial"
        ? missingTerms.length
          ? `Partial indexed support found; missing: ${missingTerms.slice(0, 4).join(", ")}.`
          : "Partial indexed support found across retrieved sources."
        : verdict === "nearby"
          ? "Retrieved sources are weak or adjacent; treat them as nearby evidence only."
          : "No direct indexed evidence was found.";
  return relevance;
}

function buildDocumentText(document: DocumentMatch) {
  return normalizeSearchText(
    [
      document.title,
      document.file_name,
      document.summarySnippet ?? "",
      document.matchReason,
      labelsText(document.labels),
    ].join(" "),
  );
}

function documentFallbackRelevance(query: string, document: DocumentMatch): SourceEvidenceRelevance {
  const coreTerms = queryCoreTerms(query);
  const haystack = buildDocumentText(document);
  const matchedTerms = coreTerms.filter((term) => textIncludesTerm(haystack, term));
  const missingTerms = coreTerms.filter((term) => !matchedTerms.includes(term));
  const coverageScore = coreTerms.length ? matchedTerms.length / coreTerms.length : 0;
  const rankScore = baseRankScore(document);
  const verdict: EvidenceRelevanceVerdict =
    coverageScore >= 0.75 && rankScore >= 0.5
      ? "direct"
      : coverageScore >= 0.38
        ? "partial"
        : matchedTerms.length || rankScore > 0
          ? "nearby"
          : "none";
  const score = clamp(coverageScore * 0.65 + rankScore * 0.25);
  const relevance: SourceEvidenceRelevance = {
    verdict,
    label: verdictLabels[verdict],
    matchedTerms,
    missingTerms,
    directSourceCount: verdict === "direct" ? 1 : 0,
    weakSourceCount: verdict === "nearby" || verdict === "none" ? 1 : 0,
    score: Number(score.toFixed(3)),
    supportReason: "",
    isSourceBacked: verdict === "direct" || verdict === "partial",
    coverageScore: Number(coverageScore.toFixed(3)),
    rankScore: Number(rankScore.toFixed(3)),
    titleMatchedTerms: matchedTerms,
    contentMatchedTerms: [],
    metadataMatchedTerms: matchedTerms,
    chips: [],
  };
  relevance.supportReason = supportReason(relevance);
  relevance.chips = relevanceChips(relevance);
  return relevance;
}

function combineDocumentSourceRelevance(query: string, document: DocumentMatch, sources: SearchResult[]) {
  if (sources.length === 0) return documentFallbackRelevance(query, document);
  const sourceRelevances = sources.map((source) => source.relevance ?? buildSourceRelevance(query, source));
  const directSourceCount = sourceRelevances.filter((item) => item.verdict === "direct").length;
  const partialSourceCount = sourceRelevances.filter((item) => item.verdict === "partial").length;
  const weakSourceCount = sourceRelevances.filter(
    (item) => item.verdict === "nearby" || item.verdict === "none",
  ).length;
  const coreTerms = queryCoreTerms(query);
  const matchedTerms = uniq(
    sourceRelevances.flatMap((item) => item.matchedTerms),
    10,
  );
  const missingTerms = coreTerms.filter((term) => !matchedTerms.includes(term));
  const score = Number(Math.max(document.score, ...sourceRelevances.map((item) => item.score)).toFixed(3));
  const verdict: EvidenceRelevanceVerdict =
    directSourceCount > 0 && missingTerms.length === 0
      ? "direct"
      : directSourceCount > 0 || partialSourceCount > 0
        ? "partial"
        : matchedTerms.length || document.score > 0
          ? "nearby"
          : "none";
  const relevance: SourceEvidenceRelevance = {
    verdict,
    label: verdictLabels[verdict],
    matchedTerms,
    missingTerms,
    directSourceCount,
    weakSourceCount,
    score,
    supportReason: "",
    isSourceBacked: verdict === "direct" || verdict === "partial",
    coverageScore: coreTerms.length ? Number((matchedTerms.length / coreTerms.length).toFixed(3)) : 0,
    rankScore: Number(document.score.toFixed(3)),
    titleMatchedTerms: uniq(
      sourceRelevances.flatMap((item) => item.titleMatchedTerms),
      6,
    ),
    contentMatchedTerms: uniq(
      sourceRelevances.flatMap((item) => item.contentMatchedTerms),
      6,
    ),
    metadataMatchedTerms: uniq(
      sourceRelevances.flatMap((item) => item.metadataMatchedTerms),
      6,
    ),
    chips: [],
  };
  relevance.supportReason = supportReason(relevance);
  relevance.chips = relevanceChips(relevance);
  return relevance;
}

export function annotateDocumentMatches(query: string, matches: DocumentMatch[], results: SearchResult[] = []) {
  const annotatedResults = annotateSearchResults(query, results);
  const byDocument = new Map<string, SearchResult[]>();
  for (const result of annotatedResults) {
    const list = byDocument.get(result.document_id) ?? [];
    list.push(result);
    byDocument.set(result.document_id, list);
  }
  return matches.map((match) => ({
    ...match,
    relevance: match.relevance ?? combineDocumentSourceRelevance(query, match, byDocument.get(match.document_id) ?? []),
  }));
}

export function weakEvidence(relevance: EvidenceRelevance | null | undefined) {
  return !relevance?.isSourceBacked || relevance.verdict === "nearby" || relevance.verdict === "none";
}
