import { isClinicalImageEvidence } from "@/lib/image-filtering";
import type { RagQueryClass, SearchResult } from "@/lib/types";

type SearchIntent = "definition" | "protocol" | "drug_dosing" | "escalation_risk" | "document_lookup" | "general";

type IntentSignals = {
  intent: SearchIntent;
  imageEvidenceFocus: boolean;
  sectionedLookup: boolean;
  hasDosingSignals: boolean;
};

export type RagQueryClassification = {
  queryClass: RagQueryClass;
  reasons: string[];
  needsVisualEvidence: boolean;
  needsSynthesis: boolean;
};

export const intentSignalWords = {
  dosing: [
    "dose",
    "dosage",
    "titrate",
    "titration",
    "mg",
    "mcg",
    "frequency",
    "route",
    "tablet",
    "start",
    "increase",
    "cease",
  ],
  protocol: ["protocol", "procedure", "process", "workflow", "pathway", "step", "algorithm", "document", "guideline"],
  escalation: ["escalat", "red flag", "urgent", "risk", "senior", "specialist", "review", "crisis", "rapid"],
  visuals: ["table", "chart", "figure", "graph", "diagram", "flow", "matrix", "image"],
  definitions: ["what is", "define", "definition", "describe", "meaning", "term", "short summary"],
  lookup: ["document", "lookup", "find", "where", "chapter", "section", "title", "page"],
} as const;

const textSearchStopWords = new Set([
  "what",
  "when",
  "where",
  "which",
  "how",
  "the",
  "and",
  "with",
  "from",
  "into",
  "for",
  "that",
  "this",
  "are",
  "was",
  "were",
  "been",
  "being",
  "cover",
  "covers",
  "covered",
  "managed",
  "management",
  "process",
  "procedure",
  "should",
  "does",
  "include",
  "includes",
  "identified",
  "identify",
  "identifies",
  "required",
  "require",
  "requires",
  "requirement",
  "requirements",
  "guideline",
  "document",
  "documents",
  "information",
  "patient",
  "patients",
  "pts",
  "clinical",
]);

const synonymGroups = [
  ["monitor", "monitoring", "baseline", "review", "follow-up", "blood test", "level"],
  ["contraindication", "avoid", "do not use", "caution", "exclusion"],
  ["escalation", "urgent", "senior review", "specialist review", "red flag"],
  ["adverse effect", "side effect", "toxicity", "safety-net", "warning"],
  ["dose", "dose limit", "maximum dose", "frequency", "route"],
];

const intentPatterns: Array<{
  intent: SearchIntent;
  pattern: RegExp;
  imageEvidenceFocus: boolean;
  sectionedLookup: boolean;
}> = [
  {
    intent: "definition",
    pattern: /what\s+is|define|definition|meaning|term|describe|terminology/i,
    imageEvidenceFocus: false,
    sectionedLookup: false,
  },
  {
    intent: "protocol",
    pattern: /protocol|procedure|process|pathway|workflow|algorithm|guideline/i,
    imageEvidenceFocus: false,
    sectionedLookup: true,
  },
  {
    intent: "drug_dosing",
    pattern: /dose|dosage|titrate|mg|mcg|frequency|route|oral|intramuscular|table|chart|monitor/i,
    imageEvidenceFocus: true,
    sectionedLookup: false,
  },
  {
    intent: "escalation_risk",
    pattern: /escalat|urgent|red\s*flag|risk|senior|rapid|immediate|crisis/i,
    imageEvidenceFocus: false,
    sectionedLookup: true,
  },
  {
    intent: "document_lookup",
    pattern: /search|lookup|find|where|section|page|document title|document id/i,
    imageEvidenceFocus: false,
    sectionedLookup: true,
  },
];

const comparisonPattern = /\b(compare|compared|versus|vs|between|across|difference\w*|conflict\w*)\b/i;
const tableThresholdPattern =
  /\b(table|chart|matrix|threshold|cut[\s-]?off|cutoff|level|range|score|scale|criteria|criterion|anc|fbc|neutrophil|white cell|when to withhold|withhold|cease|stop|maximum|minimum|baseline)\b/i;
const medicationDoseRiskPattern =
  /\b(medication|medicine|pharmacolog\w*|prescrib\w*|dose|dosage|mg|mcg|titrate|route|clozapine|lithium|neuroleptic|antipsychotic|injectable|agitation|arousal|side effect\w*|adverse|toxicity|contraindicat\w*|monitor\w*|risk|urgent|escalat\w*)\b/i;
const documentLookupPattern =
  /\b(search|lookup|find|where|which document|documents?|document title|document id|file|pdf|page|section|guideline|procedure|protocol|form)\b/i;
const broadSummaryPattern = /\b(summary|summarise|summarize|overview|explain|outline|tell me about|what should be considered)\b/i;

function tokens(text: string) {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 2);
}

function parseDateAsYearsAgo(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365));
}

function clamp(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function containsAny(value: string, values: readonly string[]) {
  return values.some((item) => value.includes(item));
}

function normalizeQueryTokenForLookups(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w]+/g, " ")
    .replace(/\b(\d+)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedClinicalQueryTokens(query: string) {
  return normalizedClinicalSearchTokens(query)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 2);
}

function hasImageEvidenceNeed(query: string) {
  return /table|chart|diagram|flowchart|figure|image|visual|dose card|medication chart/i.test(query);
}

function extractionQualityScore(result: SearchResult) {
  const quality = result.source_metadata?.extraction_quality;
  if (quality === "good") return 0.03;
  if (quality === "partial") return -0.01;
  if (quality === "poor") return -0.04;
  return 0;
}

function evidenceDensityBoost(result: SearchResult, tokens: string[]) {
  if (!tokens.length) return 0;
  const haystack = normalizeQueryTokenForLookups(`${result.section_heading ?? ""} ${result.content}`).split(" ");
  if (!haystack.length) return 0;
  const lookup = new Set(haystack);
  const hits = tokens.filter((token) => lookup.has(token)).length;
  return Math.min(0.1, hits * 0.028);
}

function sectionDepthSignal(querySignal: IntentSignals, sectionHeading: string | null) {
  if (!sectionHeading || !querySignal.sectionedLookup) return 0;
  if (/(protocol|procedure|pathway|workflow|algorithm|escalat|risk|monitor)/i.test(sectionHeading)) return 0.035;
  return 0;
}

export function classifyQueryIntent(query: string): IntentSignals {
  const lowered = query.toLowerCase();
  const match = intentPatterns.find((entry) => entry.pattern.test(query));
  const hasDosingSignals = containsAny(lowered, intentSignalWords.dosing);
  const hasEscalationSignals = containsAny(lowered, intentSignalWords.escalation);
  const hasImageSignals = containsAny(lowered, intentSignalWords.visuals);

  return {
    intent: match?.intent ?? "general",
    imageEvidenceFocus: Boolean(match?.imageEvidenceFocus) || hasImageSignals,
    sectionedLookup: Boolean(match?.sectionedLookup),
    hasDosingSignals: hasDosingSignals && !hasEscalationSignals,
  };
}

export function classifyRagQuery(query: string): RagQueryClassification {
  const reasons: string[] = [];
  const normalized = query.trim();

  if (comparisonPattern.test(normalized)) {
    reasons.push("comparison_terms");
    return {
      queryClass: "comparison",
      reasons,
      needsVisualEvidence: tableThresholdPattern.test(normalized),
      needsSynthesis: true,
    };
  }

  if (tableThresholdPattern.test(normalized)) {
    reasons.push("table_or_threshold_terms");
    return {
      queryClass: "table_threshold",
      reasons,
      needsVisualEvidence: true,
      needsSynthesis: false,
    };
  }

  if (medicationDoseRiskPattern.test(normalized)) {
    reasons.push("medication_dose_or_risk_terms");
    return {
      queryClass: "medication_dose_risk",
      reasons,
      needsVisualEvidence: /table|chart|matrix|dose card/i.test(normalized),
      needsSynthesis: /recommend|decide|should|manage|consider|contraindicat|interaction|risk/i.test(normalized),
    };
  }

  if (documentLookupPattern.test(normalized)) {
    reasons.push("document_lookup_terms");
    return {
      queryClass: "document_lookup",
      reasons,
      needsVisualEvidence: /page|table|chart|figure|image/i.test(normalized),
      needsSynthesis: false,
    };
  }

  if (broadSummaryPattern.test(normalized)) {
    reasons.push("broad_summary_terms");
    return {
      queryClass: "broad_summary",
      reasons,
      needsVisualEvidence: /table|chart|figure|image/i.test(normalized),
      needsSynthesis: true,
    };
  }

  reasons.push("no_specific_rag_class_terms");
  return {
    queryClass: "unsupported_or_general",
    reasons,
    needsVisualEvidence: false,
    needsSynthesis: true,
  };
}

function imageEvidenceSignal(query: string, result: SearchResult) {
  const queryTokens = normalizedClinicalSearchTokens(query).join(" ");
  const hasImageQuery = /table|chart|flowchart|diagram|graph|appendix|figure|matrix/.test(queryTokens);
  const images = result.images ?? [];
  const hasClinicalImageEvidence = images.some(
    (image) =>
      isClinicalImageEvidence(image) &&
      (image.image_type === "clinical_table" ||
        image.image_type === "flowchart_algorithm" ||
        image.image_type === "medication_chart" ||
        image.sourceKind === "table_crop" ||
        image.sourceKind === "diagram_crop"),
  );
  const hasPotentialImageEvidence = images.some(
    (image) =>
      isClinicalImageEvidence(image) &&
      (image.sourceKind === "page_region" || image.sourceKind === "cover_page" || image.sourceKind === "embedded"),
  );
  if (hasClinicalImageEvidence && hasImageQuery) return 0.24;
  if (hasClinicalImageEvidence) return 0.1;
  if (hasPotentialImageEvidence && hasImageQuery) return 0.16;
  return 0;
}

function sectionMatchBoost(query: string, result: SearchResult) {
  const loweredQuery = query.toLowerCase();
  if (!result.section_heading) return 0;
  const sectionTokens = result.section_heading
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 2);
  const matches = sectionTokens.filter((token) => loweredQuery.includes(token));
  return Math.min(0.12, matches.length * 0.03);
}

function documentMetadataBoost(query: string, result: SearchResult, normalizedTokens: string[]) {
  if (!normalizedTokens.length) return 0;
  const queryClass = classifyRagQuery(query).queryClass;
  const labels = result.document_labels ?? [];
  const summary = result.document_summary ?? "";
  const labelText = labels
    .map((label) => `${label.label} ${label.label_type}`)
    .join(" ")
    .toLowerCase();
  const summaryText = summary.toLowerCase();
  const titleText = `${result.title} ${result.file_name}`.toLowerCase();

  const tokenHits = normalizedTokens.filter((token) => {
    const singular = token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token;
    return labelText.includes(token) || labelText.includes(singular) || summaryText.includes(token);
  }).length;
  const highConfidenceLabelHits = labels.filter((label) => {
    const labelNormalized = normalizeQueryTokenForLookups(label.label);
    return label.confidence >= 0.6 && normalizedTokens.some((token) => labelNormalized.includes(token));
  }).length;
  const exactMetadataPhrase =
    normalizedTokens.length >= 2 &&
    (labelText.includes(normalizedTokens.join(" ")) ||
      summaryText.includes(normalizedTokens.join(" ")) ||
      titleText.includes(normalizedTokens.join(" ")));
  const classBoost =
    queryClass === "document_lookup" && (highConfidenceLabelHits > 0 || exactMetadataPhrase)
      ? 0.045
      : queryClass === "table_threshold" && /threshold|table|chart|monitor|level|anc|fbc/.test(summaryText)
        ? 0.04
        : queryClass === "medication_dose_risk" &&
            /medicat|dose|monitor|risk|toxicity|side effect|clozapine|lithium|neuroleptic/.test(summaryText)
          ? 0.035
          : 0;

  return Math.min(0.18, tokenHits * 0.018 + highConfidenceLabelHits * 0.035 + (exactMetadataPhrase ? 0.05 : 0)) + classBoost;
}

export function normalizedClinicalSearchTokens(query: string) {
  return tokens(query)
    .filter((token) => token.length > 2 && !textSearchStopWords.has(token))
    .map((token) => (token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token))
    .filter((token) => token.length > 2 && !textSearchStopWords.has(token));
}

export function buildClinicalTextSearchQuery(query: string) {
  const normalizedTokens = normalizedClinicalSearchTokens(query);

  if (/\bactive community patients?\b/i.test(query) && /\bed\b/i.test(query) && normalizedTokens.includes("active")) {
    normalizedTokens.push("pt", "ed");
  } else if (/\bcommunity patients?\b/i.test(query) && normalizedTokens.includes("community")) {
    normalizedTokens.push("pts");
  }

  const uniqueTokens = Array.from(new Set(normalizedTokens)).slice(0, 10);
  return uniqueTokens.length >= 1 ? uniqueTokens.join(" ") : query;
}

export function expandClinicalQuery(query: string) {
  const lowered = query.toLowerCase();
  const additions = new Set<string>();

  for (const group of synonymGroups) {
    if (group.some((term) => lowered.includes(term))) {
      group.forEach((term) => additions.add(term));
    }
  }

  if (additions.size === 0) return query;
  return `${query} ${Array.from(additions).join(" ")}`;
}

export function clinicalRankScore(query: string, result: SearchResult) {
  const queryTokens = tokens(query);
  const querySignal = classifyQueryIntent(query);
  const queryClass = classifyRagQuery(query).queryClass;
  const normalizedTokens = normalizedClinicalQueryTokens(query);
  const haystack =
    `${result.title} ${result.file_name} ${result.section_heading ?? ""} ${result.content}`.toLowerCase();
  const base = result.hybrid_score ?? result.similarity;
  const title = `${result.title} ${result.file_name}`.toLowerCase();
  const titleTokenText = tokens(`${result.title} ${result.file_name}`).join(" ");
  const titleTokens = new Set(tokens(`${result.title} ${result.file_name}`));
  const normalizedQueryTokens = normalizedClinicalSearchTokens(query);
  const exactTitleBoost = queryTokens.some((token) => title.includes(token)) ? 0.08 : 0;
  const titleTokenMatches = normalizedQueryTokens.filter(
    (token) => titleTokens.has(token) || titleTokenText.includes(token),
  ).length;
  const titleCoverageBoost = Math.min(0.18, titleTokenMatches * 0.045);
  const titlePhraseBoost =
    /\btreatment\s+team\b/i.test(query) && /\btreatment\s+team\s+process\b/.test(titleTokenText) ? 0.18 : 0;
  const safetyQuery = /\b(urgent|red flag|contraindicat|avoid|escalat|toxicity|dose|monitor)\b/i.test(query);
  const safetyContentBoost =
    safetyQuery && /\b(urgent|red flag|contraindicat|avoid|escalat|toxicity|maximum|monitor)\b/.test(haystack)
      ? 0.08
      : 0;
  const status = result.source_metadata?.document_status;
  const validation = result.source_metadata?.clinical_validation_status;
  const statusBoost = status === "current" ? 0.04 : status === "outdated" ? -0.08 : 0;
  const validationBoost = validation === "approved" ? 0.04 : validation === "locally_reviewed" ? 0.025 : 0;
  const publicationYearsAgo = parseDateAsYearsAgo(result.source_metadata?.publication_date);
  const reviewYearsAgo = parseDateAsYearsAgo(result.source_metadata?.review_date);
  const freshnessBoost =
    publicationYearsAgo === null
      ? 0
      : publicationYearsAgo <= 1
        ? 0.06
        : publicationYearsAgo <= 3
          ? 0.03
          : publicationYearsAgo >= 8
            ? -0.03
            : 0;
  const reviewBoost = reviewYearsAgo === null ? 0 : reviewYearsAgo <= 1 ? 0.03 : reviewYearsAgo >= 5 ? -0.02 : 0;
  const imageBoost = imageEvidenceSignal(query, result);
  const sectionBoost = sectionMatchBoost(query, result);
  const sectionedLookupBoost = querySignal.sectionedLookup ? 0.02 : 0;
  const extractionBoost = extractionQualityScore(result);
  const dosingBoost =
    querySignal.hasDosingSignals &&
    /(dose|dose|dosage|mg|mcg|increase|decrease|route|frequency|medication|start|taper)/i.test(
      `${result.section_heading ?? ""} ${haystack}`,
    )
      ? 0.05
      : 0;
  const protocolBoost =
    querySignal.intent === "protocol" && /(protocol|process|procedure|workflow|pathway|algorithm)/i.test(haystack)
      ? 0.06
      : 0;
  const escalationBoost =
    querySignal.intent === "escalation_risk" && /(urgent|escalat|risk|red flag|senior|specialist|admit)/i.test(haystack)
      ? 0.05
      : 0;
  const definitionBoost =
    querySignal.intent === "definition" && /(definition|meaning|term|describe|what is)/i.test(haystack) ? 0.05 : 0;
  const evidenceBoost = evidenceDensityBoost(result, normalizedTokens);
  const sectionDepth = sectionDepthSignal(querySignal, result.section_heading);
  const metadataBoost = documentMetadataBoost(query, result, normalizedTokens);
  const tableThresholdBoost =
    queryClass === "table_threshold" &&
    /(threshold|cut[\s-]?off|withhold|cease|stop|anc|fbc|table|chart|criteria|level|range|monitor)/i.test(haystack)
      ? 0.06
      : 0;
  const comparisonCoverageBoost =
    queryClass === "comparison" && titleCoverageBoost > 0 && evidenceBoost > 0.02 ? 0.025 : 0;
  const routeSignal = (() => {
    if (result.source_metadata?.document_status === "review_due") return -0.01;
    if (result.source_metadata?.document_status === "outdated") return -0.04;
    return 0;
  })();

  return (
    clamp(base) +
    exactTitleBoost +
    titleCoverageBoost +
    titlePhraseBoost +
    safetyContentBoost +
    statusBoost +
    validationBoost +
    freshnessBoost +
    reviewBoost +
    imageBoost +
    sectionBoost +
    sectionedLookupBoost +
    dosingBoost +
    protocolBoost +
    escalationBoost +
    definitionBoost +
    extractionBoost +
    evidenceBoost +
    metadataBoost +
    tableThresholdBoost +
    comparisonCoverageBoost +
    sectionDepth +
    routeSignal
  );
}

export function rankClinicalResults(query: string, results: SearchResult[]) {
  const intent = classifyQueryIntent(query);
  const wantsImageEvidence = hasImageEvidenceNeed(query) || intent.imageEvidenceFocus;
  const ranked = [...results]
    .map((result) => {
      const score = clinicalRankScore(query, result);
      const hasImageEvidence = (result.images ?? []).some((image) => isClinicalImageEvidence(image));
      return {
        result,
        score: score + (wantsImageEvidence && !hasImageEvidence ? -0.04 : 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.result);

  return ranked;
}
