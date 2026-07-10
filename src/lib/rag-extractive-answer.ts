import { boldHighYieldClinicalText } from "@/lib/answer-ranking";
import { applyNumericVerification } from "@/lib/answer-verification";
import { citationFromResult as resultCitation, compactCitations } from "@/lib/citations";
import { classifyRagQuery } from "@/lib/clinical-search";
import { ragDeepMemoryVersion } from "@/lib/deep-memory";
import { buildDocumentBreakdown, extractQuoteCards } from "@/lib/evidence";
import type { OpenAIReasoningEffort } from "@/lib/openai";
import {
  buildAnswerScoreExplanations,
  buildIndexingQuality,
  collectMemoryCards,
  deriveConfidence,
  evidenceTextForGate,
  fallbackReasonFromRouting,
  machineReadableFallbackAnswer,
  rankMemoryCardsForAnswer,
  scoreValue,
} from "@/lib/rag-answer-support";
import {
  hasClinicalAnswerQualityIssue,
  looksLikeJsonArtifact,
  normalizeSectionText,
  sanitizeAnswerText,
  splitBalancedWords,
} from "@/lib/rag-answer-text";
import { ragProviderMode } from "@/lib/rag-provider";
import {
  isLowYieldClinicalText,
  normalizeInlineBulletGlyphs,
  sourceTextForClinicalProse,
} from "@/lib/source-text-sanitizer";
import type {
  AnswerSection,
  AnswerSectionKind,
  ConflictOrGap,
  QuoteCard,
  RagAnswer,
  RagQueryClass,
  SearchResult,
} from "@/lib/types";

type AnswerIntent =
  | "dose"
  | "contraindication"
  | "monitoring_schedule"
  | "red_result_action"
  | "document_lookup"
  | "pathway_referral"
  | "unsupported"
  | "general";

type ExtractedClinicalFactKind =
  | "bottom_line"
  | "dose"
  | "renal_limit"
  | "monitoring"
  | "threshold_action"
  | "contraindication"
  | "pathway_referral"
  | "caveat";

type ExtractedClinicalFact = {
  kind: ExtractedClinicalFactKind;
  text: string;
  citationChunkIds: string[];
  priority: number;
};

const extractiveLabelPattern =
  /\b(?:Medication point|Table evidence|Threshold\/action|Risk\/escalation|Workflow step|Section summary|Source point|Dose detail|Monitoring)\s*:\s*/gi;

// Section labels that read as boilerplate rather than clinical context — never
// rewritten into "For <label>, …" and never merged into a following fragment.
const headingContextStoplistPattern =
  /\b(?:note|warning|caution|important|nb|source|section|table|figure|page|summary|example|appendix|reference|contents|do|does|is|are|was|were|not)\b/i;

// A leading section heading carried into a fact ("Acute Mania: 750mg…")
// becomes readable context ("For acute mania, 750mg…") instead of a colon
// fragment glued mid-sentence. All-caps tokens (acronyms like "IR") keep
// their casing, so labels containing one are left for the dose rewrite below.
const leadingHeadingContextPattern = /^([A-Z][A-Za-z]+(?:[ /-][A-Za-z()]+){0,3}):\s+(?=\S)/;

// "Label: <dose>" reads as "Label is <dose>" only when the colon is directly
// followed by a numeric dose ("IR product: 750 to 1000mg" → "IR product is
// 750 to 1000mg"); prose labels without a dose keep their colon.
const doseLabelColonPattern =
  /([A-Za-z][\w-]*(?:\s+[\w-]+){0,3}):\s+(?=\d[^:]{0,24}?(?:mg|mcg|microg|m[lL]|units?|mmol|g)\b)/g;

function rewriteLeadingHeadingContext(value: string) {
  return value.replace(leadingHeadingContextPattern, (match, label: string) => {
    if (headingContextStoplistPattern.test(label)) return match;
    if (/\b[A-Z]{2,}\b/.test(label)) return match;
    return `For ${label.toLowerCase()}, `;
  });
}

/** Clean extractive point text. */
function cleanExtractivePointText(value: string) {
  const rewritten = normalizeInlineBulletGlyphs(sourceTextForClinicalProse(value))
    .replace(/\b(?:clinical_table|table_crop|diagram_crop)\b/gi, " ")
    .replace(
      /^(?:clinical\s+)?table\s+(?:showing|detailing|listing|outlining|describing)\b.*?:\s*(?=\b(?:if|when|for|cease|stop|withhold|contact|repeat|monitor|clozapine)\b)/i,
      "",
    )
    .replace(
      /^[A-Z][A-Za-z /-]{3,80}:\s*(?=\b(?:if|when|for|cease|stop|withhold|contact|repeat|monitor|clozapine)\b)/,
      "",
    )
    .replace(extractiveLabelPattern, " ")
    .replace(/^[\s\-•:]+/, "")
    .replace(/^(?:monitoring|dose|dosing|source|section|table|guideline)\s*[.;:,-]\s*/i, "")
    .replace(/([A-Za-z)])(\d{1,2})(?=(?:[,.;]|\s|$))/g, "$1")
    .replace(/\s+[•]\s+/g, ". ")
    .replace(
      /\s+-\s+(?=[A-Z][a-z])|(?:\s+-\s*)?(?:Medication point|Table evidence|Threshold\/action|Risk\/escalation|Workflow step|Section summary|Source point)\s*:\s*/gi,
      ". ",
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/(?:\.\s*){2,}/g, ". ")
    .trim();
  return rewriteLeadingHeadingContext(rewritten).replace(doseLabelColonPattern, "$1 is ");
}

const extractiveClinicalDirectivePattern =
  /\b(?:arrange|assess|cease|check|complete|contact|continue|discontinue|discontinued|escalate|notify|prescribe|record|refer|report|review|stop|withhold|must|required|requires?|should)\b/i;
const extractiveQueryStopwords = new Set([
  "a",
  "an",
  "and",
  "after",
  "are",
  "about",
  "be",
  "before",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "post",
  "prior",
  "the",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "should",
  "dose",
  "dosing",
  "dosage",
  "medication",
  "medicine",
  "monitoring",
  "monitor",
  "baseline",
  "tests",
  "result",
  "results",
  "pathway",
  "referral",
  "patient",
  "patients",
  "required",
  "requires",
  "clinical",
  "advice",
  "contraindication",
  "contraindications",
  "documents",
  "document",
  "support",
  "supports",
  "supported",
  "sources",
  "source",
  "guidance",
  "guideline",
  "guidelines",
  "please",
]);

const answerIntentTerms = new Set([
  "action",
  "actions",
  "avoid",
  "contraindicated",
  "contraindication",
  "contraindications",
  "criteria",
  "dose",
  "doses",
  "dosing",
  "dosage",
  "maximum",
  "max",
  "monitor",
  "monitors",
  "monitoring",
  "pathway",
  "refer",
  "referral",
  "renal",
  "result",
  "results",
  "required",
  "requires",
  "schedule",
  "threshold",
  "thresholds",
  "what",
]);

/** Classify answer intent. */
export function classifyAnswerIntent(query: string, queryClass: RagQueryClass): AnswerIntent {
  const normalized = normalizeSectionText(query).toLowerCase();
  if (!normalized) return "unsupported";
  if (
    /\b(?:what|which|list|show|find)\s+(?:documents?|sources?|guidelines?|files?)\b.*\b(?:support|cover|contain|for|about)\b/.test(
      normalized,
    ) ||
    /\b(?:documents?|sources?|guidelines?|files?)\s+(?:support|cover|contain|for|about)\b/.test(normalized)
  ) {
    return "document_lookup";
  }
  if (/\b(?:contraindicat\w*|avoid|do not use|must not|should not|not use|opioid[-\s]?free)\b/.test(normalized)) {
    return "contraindication";
  }
  const hasResultActionSignal =
    /\b(?:red|amber|green|anc|fbc|wbc|result|results|threshold|withhold|cease|stop|stopped|toxicity)\b/.test(
      normalized,
    ) || /\b(?:what\s+action|action\s+is\s+required|required\s+action|suspected\s+\w+\s+toxicity)\b/.test(normalized);
  const hasScheduleSignal = /\b(?:monitor|monitoring|schedule|baseline|follow[-\s]?up|level|levels|test|tests)\b/.test(
    normalized,
  );
  // Toxicity and explicit action queries take priority over monitoring even if schedule/baseline/follow-up terms appear.
  const hasStrongResultSignal =
    /\b(?:toxicity|what\s+action|action\s+is\s+required|required\s+action|suspected\s+\w+\s+toxicity)\b/.test(
      normalized,
    );
  if (
    hasResultActionSignal &&
    (!/\b(?:schedule|baseline|follow[-\s]?up)\b/.test(normalized) || hasStrongResultSignal)
  ) {
    return "red_result_action";
  }
  if (hasScheduleSignal) {
    return "monitoring_schedule";
  }
  if (hasResultActionSignal) return "red_result_action";
  if (/\b(?:dose|dosing|dosage|max(?:imum)?|mg|mcg|renal|eGFR|creatinine)\b/i.test(query)) return "dose";
  if (/\b(?:pathway|refer|referral|criteria|ect|electroconvulsive)\b/.test(normalized)) return "pathway_referral";
  if (
    queryClass === "document_lookup" ||
    /\b(?:find|show|open|which)\b.*\b(?:document|guideline|procedure|policy|protocol|form|source|file)\b/.test(
      normalized,
    ) ||
    /\b(?:documentation|forms?|documents?|sources?|guidelines?|procedure|policy|protocol)\b/.test(normalized)
  ) {
    return "document_lookup";
  }
  if (queryClass === "unsupported_or_general" && !clinicalQuerySignalPattern.test(query)) return "unsupported";
  return "general";
}

/** Query entity tokens. */
function queryEntityTokens(query: string, intent: AnswerIntent) {
  const tokens = extractiveQueryTokens(query).filter((token) => !answerIntentTerms.has(token));
  if (intent === "document_lookup") return tokens.filter((token) => token.length > 3);
  return tokens;
}

/** Unique answer tokens. */
function uniqueAnswerTokens(tokens: string[]) {
  return Array.from(new Set(tokens.filter(Boolean)));
}

/** Query intent tokens. */
function queryIntentTokens(query: string, intent: AnswerIntent) {
  const tokens = extractiveQueryTokens(query).filter((token) => answerIntentTerms.has(token));
  if (intent === "dose" && /\b(?:renal|egfr|creatinine|kidney)\b/i.test(query))
    return uniqueAnswerTokens(["renal", ...tokens]);
  if (intent === "dose" && /\bmax(?:imum)?\b/i.test(query)) return uniqueAnswerTokens(["maximum", ...tokens]);
  if (intent === "monitoring_schedule") return uniqueAnswerTokens(["monitoring", ...tokens]);
  if (intent === "red_result_action")
    return uniqueAnswerTokens(["red", "range", "blood", "result", "results", "threshold", "action", ...tokens]);
  if (intent === "contraindication") return uniqueAnswerTokens(["contraindication", ...tokens]);
  if (intent === "pathway_referral") return uniqueAnswerTokens(["referral", "criteria", ...tokens]);
  return tokens;
}

/** Answer intent evidence pattern. */
function answerIntentEvidencePattern(intent: AnswerIntent) {
  switch (intent) {
    case "dose":
      return /\b(?:doses?|dosing|dosage|max(?:imum)?|mg|mcg|microgram|micrograms|mmol\/l|eGFR|renal|creatinine|daily|bd|tds|mane|nocte)\b/i;
    case "contraindication":
      return /\b(?:contraindicat\w*|avoid|must not|do not|should not|not use|opioid[-\s]?free|withdrawal|precipitat\w*)\b/i;
    case "monitoring_schedule":
      return /\b(?:monitor|monitoring|baseline|weekly|monthly|annual|every|level|levels|blood test|fbc|anc|ecg|lft|renal|review)\b/i;
    case "red_result_action":
      return /\b(?:red|amber|green|threshold|withhold|cease|stop|discontinue|discontinued|urgent|contact|repeat|review|anc|fbc|wbc|neutrophil|toxic\w*|action|patholog\w*|haematolog\w*|hematolog\w*)\b/i;
    case "pathway_referral":
      return /\b(?:pathway|refer|referral|criteria|indicat\w*|ect|electroconvulsive|specialist|psychiat\w*)\b/i;
    case "document_lookup":
      return /\b(?:document|guideline|procedure|policy|protocol|form|source|file|support|supports|covers|contains)\b/i;
    default:
      return /\b(?:assess|arrange|check|continue|review|treat|manage|monitor|refer|dose|risk|therapy|diagnos\w*)\b/i;
  }
}

/** Requires blood count evidence. */
function requiresBloodCountEvidence(query: string) {
  return /\b(?:anc|fbc|full blood count|blood count|wbc|wcc|white blood cells?|white cells?|neutrophils?)\b/i.test(
    query,
  );
}

/** Asks for withhold action. */
function asksForWithholdAction(query: string) {
  return /\b(?:withhold|withheld|withholding|hold|held|cease|stop|stopped|discontinue|discontinued)\b/i.test(query);
}

/** Has blood count evidence. */
function hasBloodCountEvidence(text: string) {
  return /\b(?:anc|fbc|full blood count|wbc|wcc|white blood cell|white cell|neutrophil|neutrophils|blood count)\b/i.test(
    text,
  );
}

/** Has withhold action evidence. */
function hasWithholdActionEvidence(text: string) {
  return /\b(?:withhold|withheld|withholding|hold|held|cease|stop|stopped|discontinue|discontinued|red range|amber range)\b/i.test(
    text,
  );
}

/** Result covers answer intent. */
function resultCoversAnswerIntent(result: SearchResult, query: string, intent: AnswerIntent) {
  if (intent === "unsupported") return false;
  const text = evidenceTextForGate(result);
  const entityTokens = queryEntityTokens(query, intent);
  const intentTokens = queryIntentTokens(query, intent);
  const entityCoverage =
    entityTokens.length === 0 ||
    entityTokens.some((token) => queryTokenMatchesText(token, text)) ||
    (/\bect\b/i.test(query) && /\b(?:ect|electroconvulsive)\b/i.test(text));
  if (!entityCoverage) return false;
  if (intent === "general") return true;
  const intentCoverage = answerIntentEvidencePattern(intent).test(text);
  if (!intentCoverage) return false;
  if (intentTokens.length > 0 && !intentTokens.some((token) => queryTokenMatchesText(token, text))) return false;
  if (intent === "red_result_action" && requiresBloodCountEvidence(query) && !hasBloodCountEvidence(text)) return false;
  if (intent === "red_result_action" && asksForWithholdAction(query) && !hasWithholdActionEvidence(text)) return false;
  if (/\brenal\b/i.test(query) && !/\b(?:renal|kidney|eGFR|creatinine)\b/i.test(text)) return false;
  if (/\bmax(?:imum)?\b/i.test(query) && !/\b(?:max(?:imum)?|\d+(?:\.\d+)?\s?(?:mg|mcg))\b/i.test(text)) {
    return false;
  }
  return true;
}
const extractiveTruncationPattern =
  /\b(?:stabili[sz]e\s+the\s+do|the\s+do\b|liver\s+functi\b|respiratio\b|if\s+a\s+60%\s+decrease\s+in\s+b\b)\b/i;
const extractiveProductCataloguePattern =
  /\b(?:Lithicarb|Quilonum\s+SR|Campral|imprest\s+location|formulary\s+one)\b|[®™]/i;
const extractiveStructuralArtifactPattern =
  /\b(?:for\s+required,|monitoringup|prnselection|druguse|anddoses|reviewresponse|maximumrecommendeddoses|recommendeddoses|information:\s*review|links\s+to\s+relevant\s+documents\/resources|pharmacy\s+services\s+and\s+dispensing\s+protocol|role\s+responsibilities|document\s+control|straight\s+to\s+the\s+point\s+of\s+care|full\s+text|pubmed|randomi[sz]ed\s+clinical\s+trial|j\s+psychiatry|ann\s+emerg\s+med|site\s+map|gpo,\s+perth|tel:\s*\(|fax:\s*\()\b/i;
const extractiveHeadingOnlyPattern =
  /^(?:dosage?|dosing|monitoring|baseline tests?|therapy|source|section|table|guideline|referral criteria|criteria)(?:\s*\([^)]{1,80}\))?\.?$/i;
const extractiveAllowedLowercaseStarterPattern =
  /^(?:if|when|for|in|avoid|do|must|withhold|cease|stop|monitor|check|reduce|increase|adjust|start|commence|begin|use|target|baseline|serum|therapy|dosing|titrate|arrange|refer|review|prescribe|record|complete|continue|discontinue|escalate)\b/i;
const extractiveConcreteDosePattern =
  /\b(?:\d+(?:\.\d+)?\s?(?:mg|mcg|microgram|micrograms|mmol\/?l)|mmol\/l|daily|bd|tds|mane|nocte|target|range|serum|levels?|titration|titrate|titrated|adjust(?:ed|ment)?|dose\s+(?:adjust|reduc|increas)|reduce(?:d)?\s+doses?|doses?\s+(?:in|for|when|with|based|according)|max(?:imum)?|renal|eGFR|CrCl|creatinine|elderly|impairment|conventional tablets?)\b/i;
const extractiveMedicationEntityPattern =
  /\b(?:acamprosate|aripiprazole|baclofen|citalopram|clozapine|diazepam|disulfiram|droperidol|escitalopram|fluoxetine|haloperidol|lithium|lorazepam|naltrexone|olanzapine|promethazine|quetiapine|risperidone|sertraline|valproate)\b/gi;

/** Extractive query tokens. */
function extractiveQueryTokens(query: string) {
  return splitBalancedWords(query).filter((token) => token.length > 2 && !extractiveQueryStopwords.has(token));
}

/** Escape query token. */
function escapeQueryToken(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Query token variants. */
function queryTokenVariants(token: string) {
  const variants = new Set([token]);
  if (token.length > 5 && token.endsWith("ing")) variants.add(token.slice(0, -3));
  if (token.length > 4 && token.endsWith("ies")) variants.add(`${token.slice(0, -3)}y`);
  if (token.length > 4 && token.endsWith("es")) variants.add(token.slice(0, -2));
  if (token.length > 4 && token.endsWith("s")) variants.add(token.slice(0, -1));
  return [...variants].filter((variant) => variant.length > 2);
}

/** Query token matches text. */
function queryTokenMatchesText(token: string, text: string) {
  if (token === "ect") return /\b(?:ect|electroconvulsive)\b/i.test(text);
  for (const variant of queryTokenVariants(token)) {
    const pattern =
      variant.length <= 3
        ? new RegExp(`\\b${escapeQueryToken(variant)}\\b`, "i")
        : new RegExp(`\\b${escapeQueryToken(variant)}\\w*\\b`, "i");
    if (pattern.test(text)) return true;
  }
  return false;
}

/** Medication entities in text. */
function medicationEntitiesInText(text: string) {
  extractiveMedicationEntityPattern.lastIndex = 0;
  return Array.from(new Set((text.match(extractiveMedicationEntityPattern) ?? []).map((match) => match.toLowerCase())));
}

/** Mentions different medication entity. */
function mentionsDifferentMedicationEntity(sentence: string, query: string) {
  const queryMedicationEntities = medicationEntitiesInText(query);
  if (!queryMedicationEntities.length) return false;
  return medicationEntitiesInText(sentence).some((entity) => !queryMedicationEntities.includes(entity));
}

/** Has relevant query overlap. */
function hasRelevantQueryOverlap(
  text: string,
  query: string,
  intent: AnswerIntent = classifyAnswerIntent(query, classifyRagQuery(query).queryClass),
) {
  const tokens = extractiveQueryTokens(query);
  if (!tokens.length) return true;
  const normalized = normalizeSectionText(text).toLowerCase();
  const entityTokens = queryEntityTokens(query, intent);
  const intentTokens = queryIntentTokens(query, intent);
  const entityCovered =
    entityTokens.length === 0 ||
    entityTokens.some((token) => queryTokenMatchesText(token, normalized)) ||
    (/\bect\b/i.test(query) && /\b(?:ect|electroconvulsive)\b/i.test(normalized));
  if (!entityCovered && intent !== "general") return false;
  if (intent === "general" || intent === "unsupported")
    return tokens.some((token) => queryTokenMatchesText(token, text));
  return (
    answerIntentEvidencePattern(intent).test(normalized) &&
    (intentTokens.length === 0 || intentTokens.some((token) => queryTokenMatchesText(token, normalized)))
  );
}

/** Has bad extractive quality. */
function hasBadExtractiveQuality(text: string) {
  const normalized = normalizeSectionText(text);
  if (!normalized) return true;
  if (extractiveTruncationPattern.test(normalized)) return true;
  if (extractiveProductCataloguePattern.test(normalized)) return true;
  if (extractiveStructuralArtifactPattern.test(normalized)) return true;
  if (extractiveHeadingOnlyPattern.test(normalized.replace(/[.;]+$/, ""))) return true;
  if (/^([A-Za-z][A-Za-z /-]{3,60})\s+\1\.?$/i.test(normalized)) return true;
  const firstToken = normalized.split(/\s+/, 1)[0] ?? "";
  if (
    /^[a-z][a-z -]{2,}\b/.test(normalized) &&
    !extractiveAllowedLowercaseStarterPattern.test(normalized) &&
    !medicationEntitiesInText(firstToken).length
  ) {
    return true;
  }
  if (/\b[A-Za-z]{4,}[A-Z]{2,}[A-Za-z]{2,}\b/.test(normalized)) return true;
  // Narrow consecutive-arrow check: only flag '>>' that is NOT a clinical comparator like 'QTc >500 ms'.
  // Two adjacent > with only whitespace between them (not digits/letters) signals markup artifacts.
  if (/>[\s]*>/.test(normalized) && !/\w\s*>\s*\d/.test(normalized)) return true; // consecutive >> arrows
  if (/\w+\s*>\s*\w+\s*>\s*\w+/g.test(normalized) && !/\d\s*>\s*\d/.test(normalized)) return true; // breadcrumb trails like A > B > C (not numeric ranges)
  if (
    /^\s*(?:references?(?!\s+(?:range|interval|value|level|limit|coordinate|check|system|dosing|monitoring|guideline))|bibliography)\b/i.test(
      normalized,
    )
  )
    return true;
  if (hasClinicalAnswerQualityIssue(normalized)) return true;
  if (/\btable\s+\d+\b/i.test(normalized) && normalized.length > 180) return true;
  return false;
}

/**
 * Quality gate for *completed* answers at the final validation step.
 *
 * Unlike `hasBadExtractiveQuality`, this version skips `extractiveProductCataloguePattern`
 * because final answers to brand, PBS/access, or product-form questions legitimately contain
 * medication brand names (Campral, Lithicarb, Quilonum SR) and ®/™ symbols.
 * Applying the catalogue filter here would incorrectly replace valid answers with source-gap
 * responses for those question types.
 */
function hasBadFinalAnswerQuality(text: string) {
  const normalized = normalizeSectionText(text);
  if (!normalized) return true;
  if (extractiveTruncationPattern.test(normalized)) return true;
  // Note: extractiveProductCataloguePattern is intentionally excluded here — see JSDoc above.
  if (extractiveStructuralArtifactPattern.test(normalized)) return true;
  if (extractiveHeadingOnlyPattern.test(normalized.replace(/[.;]+$/, ""))) return true;
  if (/^([A-Za-z][A-Za-z /-]{3,60})\s+\1\.?$/i.test(normalized)) return true;
  const firstToken = normalized.split(/\s+/, 1)[0] ?? "";
  if (
    /^[a-z][a-z -]{2,}\b/.test(normalized) &&
    !extractiveAllowedLowercaseStarterPattern.test(normalized) &&
    !medicationEntitiesInText(firstToken).length
  ) {
    return true;
  }
  if (/\b[A-Za-z]{4,}[A-Z]{2,}[A-Za-z]{2,}\b/.test(normalized)) return true;
  if (/>[\s]*>/.test(normalized) && !/\w\s*>\s*\d/.test(normalized)) return true;
  if (/\w+\s*>\s*\w+\s*>\s*\w+/g.test(normalized) && !/\d\s*>\s*\d/.test(normalized)) return true;
  if (
    /^\s*(?:references?(?!\s+(?:range|interval|value|level|limit|coordinate|check|system|dosing|monitoring|guideline))|bibliography)\b/i.test(
      normalized,
    )
  )
    return true;
  if (hasClinicalAnswerQualityIssue(normalized)) return true;
  if (/\btable\s+\d+\b/i.test(normalized) && normalized.length > 180) return true;
  return false;
}

/** Is low value extractive caption. */
function isLowValueExtractiveCaption(clause: string) {
  const descriptor =
    /^(?:clinical\s+table|table|figure|image)\s+(?:showing|detailing|listing|outlining|describing|with|of)\b/i.test(
      clause,
    ) || /\btable\s+(?:showing|detailing|listing|outlining|describing)\b/i.test(clause);
  if (!descriptor) return false;
  return !extractiveClinicalDirectivePattern.test(clause);
}

// A short digit-free section heading ("Acute Mania:") left standing alone by
// the bullet split. Merged into the fragment that follows it so the indication
// context survives the minimum-length filter instead of being dropped.
const shortHeadingFragmentPattern = /^[A-Z][A-Za-z][A-Za-z /()-]{0,38}:$/;

function isShortHeadingFragment(fragment: string) {
  return (
    shortHeadingFragmentPattern.test(fragment) &&
    fragment.split(/\s+/).length <= 4 &&
    !headingContextStoplistPattern.test(fragment)
  );
}

/** Split clinical evidence sentences. */
export function splitClinicalEvidenceSentences(value: string) {
  const fragments = normalizeInlineBulletGlyphs(sourceTextForClinicalProse(value), { joiner: "\n" })
    .split(/\r?\n+|(?<=[.!?])\s+|\s+[•]\s+|\s+\|\s+/)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
  const merged: string[] = [];
  let pendingHeading = "";
  for (const fragment of fragments) {
    if (isShortHeadingFragment(fragment)) {
      pendingHeading = pendingHeading ? `${pendingHeading} ${fragment}` : fragment;
      continue;
    }
    merged.push(pendingHeading ? `${pendingHeading} ${fragment}` : fragment);
    pendingHeading = "";
  }
  return merged
    .map(cleanExtractivePointText)
    .filter(
      (sentence) =>
        sentence.length >= 18 &&
        !looksLikeJsonArtifact(sentence) &&
        !isLowValueExtractiveCaption(sentence) &&
        !hasBadExtractiveQuality(sentence),
    );
}

/** Fact kind for sentence. */
function factKindForSentence(sentence: string, query: string, intent: AnswerIntent): ExtractedClinicalFactKind | null {
  const text = normalizeSectionText(sentence);
  if (!text) return null;
  if (
    /\b(?:contraindicat\w*|avoid|must not|do not|should not|not use|opioid[-\s]?free|withdrawal|precipitat\w*)\b/i.test(
      text,
    )
  ) {
    return "contraindication";
  }
  if (/\b(?:renal|kidney|eGFR|creatinine|CrCl)\b/i.test(text)) return "renal_limit";
  if (
    /\b(?:red|amber|green|threshold|withhold|cease|stop|discontinue|discontinued|urgent|contact|repeat|anc|fbc|wbc|neutrophil|toxic\w*|action)\b/i.test(
      text,
    )
  ) {
    return "threshold_action";
  }
  if (/\b(?:pathway|refer|referral|criteria|indicat\w*|ect|electroconvulsive|specialist|psychiat\w*)\b/i.test(text)) {
    return "pathway_referral";
  }
  if (
    /\b(?:monitor|monitoring|baseline|weekly|monthly|annual|every|level|levels|blood test|ecg|lft|review)\b/i.test(text)
  ) {
    return "monitoring";
  }
  if (
    /\b(?:doses?|dosing|dosage|max(?:imum)?|\d+(?:\.\d+)?\s?(?:mg|mcg)|daily|bd|tds|mane|nocte|mmol\/l)\b/i.test(text)
  ) {
    return "dose";
  }
  if (/\b(?:caution|risk|adverse|side effect|limited|not enough|insufficient)\b/i.test(text)) return "caveat";
  if (intent === "general" && hasRelevantQueryOverlap(text, query, intent)) return "bottom_line";
  return null;
}

/** Fact supports answer intent. */
function factSupportsAnswerIntent(
  kind: ExtractedClinicalFactKind,
  sentence: string,
  query: string,
  intent: AnswerIntent,
) {
  const text = normalizeSectionText(sentence);
  const normalizedQuery = normalizeSectionText(query).toLowerCase();
  if (!text || hasBadExtractiveQuality(text)) return false;

  switch (intent) {
    case "dose":
      if (kind !== "dose" && kind !== "renal_limit") {
        // Allow contraindication facts when the query explicitly asks for renal information,
        // since renal contraindications (e.g. creatinine >120 micromol/L: contraindicated) are
        // essential dose safety facts for renal-dose queries.
        if (
          kind === "contraindication" &&
          /\brenal\b/i.test(query) &&
          /\b(?:renal|kidney|eGFR|creatinine|CrCl)\b/i.test(text)
        ) {
          // fall through to dose text check below
        } else {
          return false;
        }
      }
      if (/\brenal\b/i.test(query) && !/\b(?:renal|kidney|eGFR|creatinine|CrCl)\b/i.test(text)) return false;
      if (/\bmax(?:imum)?\b/i.test(query) && !/\b(?:max(?:imum)?|\d+(?:\.\d+)?\s?(?:mg|mcg))\b/i.test(text)) {
        return false;
      }
      return extractiveConcreteDosePattern.test(text);
    case "contraindication":
      return (
        kind === "contraindication" &&
        /\b(?:contraindicat\w*|avoid|must not|do not|should not|not use|opioid[-\s]?free|withdrawal|precipitat\w*)\b/i.test(
          text,
        )
      );
    case "monitoring_schedule":
      // Also allow renal_limit facts — sentences like 'baseline renal function then repeat periodically'
      // are classified as renal_limit (renal check triggers before monitoring), but are directly relevant
      // to monitoring schedule answers.
      if (kind !== "monitoring" && kind !== "dose" && kind !== "renal_limit") return false;
      return /\b(?:monitor|monitoring|follow[-\s]?up|baseline|weekly|monthly|annual|every|several\s+times\s+a\s+year|level|levels|blood test|fbc|anc|wbc|ecg|lft|renal|thyroid|metabolic|glucose|bsl|lipids|cholesterol|triglycerides|blood pressure|bp|pulse|weight|bmi|mmol\/l|range)\b/i.test(
        text,
      );
    case "red_result_action":
      if (kind !== "threshold_action" && kind !== "caveat") return false;
      if (requiresBloodCountEvidence(query) && !hasBloodCountEvidence(text)) return false;
      if (asksForWithholdAction(query) && !hasWithholdActionEvidence(text)) return false;
      return (
        /\b(?:withhold|cease|stop|discontinue|discontinued|contact|urgent|repeat|review|call for help|escalat\w*|monitor|toxicity|rash)\b/i.test(
          text,
        ) &&
        // Include green/neutrophil: valid clozapine result-action vocabulary the classifier accepts
        /\b(?:red|amber|green|threshold|result|results|anc|fbc|wbc|neutrophil|toxicity|rash|reaction|blood|patholog\w*|haematolog\w*|hematolog\w*)\b/i.test(
          text,
        )
      );
    case "pathway_referral":
      if (kind !== "pathway_referral") return false;
      if (/\breferr?al|refer\b/i.test(query) && !/\b(?:refer|referral|form\s*1a)\b/i.test(text)) return false;
      if (/\bdischarge\s+criteria\b/i.test(text) && !/\bdischarge\b/.test(normalizedQuery)) return false;
      return /\b(?:pathway|procedure|refer|referral|criteria|indicat\w*|ect|electroconvulsive|specialist|psychiat\w*|step)\b/i.test(
        text,
      );
    case "document_lookup":
      return /\b(?:document|guideline|procedure|policy|protocol|form|source|file|support|supports|covers|contains)\b/i.test(
        text,
      );
    case "unsupported":
      return false;
    case "general":
    default:
      if (/\b(?:references?|bibliography|full\s+text|pubmed|randomi[sz]ed\s+clinical\s+trial)\b/i.test(text)) {
        return false;
      }
      if (/^what\s+is\b/i.test(query)) {
        return /\b(?:is|are|means|defined|characteri[sz]ed|involves|refers\s+to)\b/i.test(text);
      }
      return /\b(?:assess|arrange|check|continue|review|treat|manage|monitor|refer|dose|risk|therapy|diagnos\w*)\b/i.test(
        text,
      );
  }
}

/** Fact sentence matches query from result. */
function factSentenceMatchesQueryFromResult(
  sentence: string,
  result: SearchResult,
  query: string,
  intent: AnswerIntent,
) {
  if (mentionsDifferentMedicationEntity(sentence, query)) return false;
  if (hasRelevantQueryOverlap(sentence, query, intent)) return true;
  if (intent === "general" || intent === "unsupported") return false;

  const resultText = evidenceTextForGate(result);
  const entityTokens = queryEntityTokens(query, intent);
  const entityCoveredByResult =
    entityTokens.length === 0 || entityTokens.some((token) => queryTokenMatchesText(token, resultText));
  if (!entityCoveredByResult) return false;

  const normalized = normalizeSectionText(sentence).toLowerCase();
  const intentTokens = queryIntentTokens(query, intent);
  const intentCovered =
    intentTokens.length === 0 ||
    intentTokens.some((token) => queryTokenMatchesText(token, normalized)) ||
    (intent === "dose" && extractiveConcreteDosePattern.test(normalized));
  return answerIntentEvidencePattern(intent).test(normalized) && intentCovered;
}

/** Fact priority. */
function factPriority(kind: ExtractedClinicalFactKind, intent: AnswerIntent) {
  if (intent === "contraindication" && kind === "contraindication") return 9;
  if (intent === "red_result_action" && kind === "threshold_action") return 9;
  if (intent === "monitoring_schedule" && kind === "monitoring") return 9;
  if (intent === "pathway_referral" && kind === "pathway_referral") return 9;
  if (intent === "dose" && kind === "dose") return 9;
  if (intent === "dose" && kind === "renal_limit") return 8;
  if (kind === "bottom_line") return 5;
  if (kind === "caveat") return 3;
  return 6;
}

/** Table facts to clinical facts. */
function tableFactsToClinicalFacts(result: SearchResult, query: string, intent: AnswerIntent): ExtractedClinicalFact[] {
  return (result.table_facts ?? [])
    .map((fact) => {
      const text = cleanExtractivePointText(
        [fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action].filter(Boolean).join(": "),
      );
      const kind = factKindForSentence(text, query, intent);
      if (!text || !kind || !factSentenceMatchesQueryFromResult(text, result, query, intent)) return null;
      if (!factSupportsAnswerIntent(kind, text, query, intent)) return null;
      return {
        kind,
        text,
        citationChunkIds: [result.id],
        priority: factPriority(kind, intent) + 1,
      } satisfies ExtractedClinicalFact;
    })
    .filter((fact): fact is ExtractedClinicalFact => Boolean(fact));
}

function withTerminalPunctuation(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /[.:;!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Extract clinical facts from results. */
function extractClinicalFactsFromResults(results: SearchResult[], query: string, intent: AnswerIntent, limit = 8) {
  const seen = new Set<string>();
  const facts: ExtractedClinicalFact[] = [];
  const usableResults = results.filter((result) => resultCoversAnswerIntent(result, query, intent));

  for (const result of usableResults) {
    for (const fact of tableFactsToClinicalFacts(result, query, intent)) {
      const key = `${fact.kind}:${normalizeSectionText(fact.text).toLowerCase().slice(0, 160)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push(fact);
    }

    // Each evidence segment gets terminal punctuation before joining: the
    // prose cleaner collapses the newlines, and without it a bare section
    // heading or synopsis tail glues onto the next segment's first sentence
    // ("Dosing Twice daily dosing should…"). The heading gets a colon so it
    // reads as a label for the content that follows it — unless the content
    // already opens with the heading text, where prepending it would only
    // fabricate a contentless "Label: Label." fact.
    const sectionHeading = result.section_heading?.trim();
    const contentLeadsWithHeading = Boolean(
      sectionHeading && (result.content ?? "").trim().toLowerCase().startsWith(sectionHeading.toLowerCase()),
    );
    const text = [
      withTerminalPunctuation(result.retrieval_synopsis),
      sectionHeading && !contentLeadsWithHeading
        ? /[.:;!?]$/.test(sectionHeading)
          ? sectionHeading
          : `${sectionHeading}:`
        : null,
      withTerminalPunctuation(result.content),
      withTerminalPunctuation(result.adjacent_context),
      ...(result.memory_cards ?? []).map((card) => withTerminalPunctuation(card.content)),
    ]
      .filter(Boolean)
      .join("\n");
    for (const sentence of splitClinicalEvidenceSentences(text)) {
      if (!factSentenceMatchesQueryFromResult(sentence, result, query, intent)) continue;
      const kind = factKindForSentence(sentence, query, intent);
      if (!kind) continue;
      if (!factSupportsAnswerIntent(kind, sentence, query, intent)) continue;
      const cleaned = sentence.length <= 280 ? sentence : `${sentence.slice(0, 277).trim()}...`;
      const key = `${kind}:${normalizeSectionText(cleaned).toLowerCase().slice(0, 160)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push({
        kind,
        text: cleaned,
        citationChunkIds: [result.id],
        priority: factPriority(kind, intent) + Math.min(scoreValue(result), 1),
      });
      if (facts.length >= limit) break;
    }
    if (facts.length >= limit) break;
  }

  return facts.sort((a, b) => b.priority - a.priority || a.text.length - b.text.length).slice(0, limit);
}

/** Sentence from fact. */
export function sentenceFromFact(
  fact: ExtractedClinicalFact,
  query: string,
  options: { suppressEntityPrefix?: boolean } = {},
) {
  const text = sanitizeAnswerText(cleanExtractivePointText(fact.text)).replace(/[.;,\s]+$/, "");
  if (!text) return "";
  const entity = queryEntityTokens(query, classifyAnswerIntent(query, classifyRagQuery(query).queryClass))[0];
  const needsEntityPrefix =
    !options.suppressEntityPrefix &&
    entity &&
    fact.kind !== "bottom_line" &&
    !queryTokenMatchesText(entity, text) &&
    !/^(?:for|in|when|if|avoid|do not|must not|withhold|cease|stop|monitor|check|refer|arrange)\b/i.test(text);
  // Complete the bare fact first, then attach the entity once. Prefixing
  // before completion let the "The guidance is that…" wrapper swallow the
  // prefix and duplicate the entity ("For lithium, … that for lithium, …").
  const completed = completeExtractiveSentence(text, query);
  if (!completed || !needsEntityPrefix) return completed;
  if (!/^The guidance\b/.test(completed)) return `For ${entity}, ${lowerFirst(completed)}`;
  return completed.replace(/^The guidance/, `The guidance for ${entity}`);
}

/** Lower first. */
function lowerFirst(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

/** Upper first. */
function upperFirst(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

// A clinical action clause: an imperative/directive verb that turns a bare conditional
// ("if INR is high") into a complete, self-contained sentence ("if INR is high, withhold warfarin").
const extractiveActionClausePattern =
  /\b(?:withhold|cease|stop|discontinue|hold|monitor|check|repeat|review|refer|arrange|contact|escalate|seek|avoid|continue|commence|start|initiate|titrate|prescribe|administer|give|reduce|increase|document|consider|recheck|admit|transfer)\b/i;

/** Complete extractive sentence. */
export function completeExtractiveSentence(value: string, query: string) {
  const cleaned = sanitizeAnswerText(value)
    .replace(/[.;,\s]+$/, "")
    .trim();
  if (!cleaned) return "";

  const sentence = `${cleaned}.`;
  if (hasCompleteOpeningSentence(sentence) && !isFragmentLikeClinicalAnswer(sentence, query)) return sentence;

  if (/^(?:when|if|where|after|before|during)\b/i.test(cleaned)) {
    // A conditional clause that already carries its own action ("if INR is high, withhold warfarin")
    // is a complete, natural sentence — present it directly instead of the stock "The guidance is
    // that…" lead-in. Only when the condition has no action of its own do we add the wrapper so the
    // fragment reads as a full sentence.
    const conditionalAsSentence = `${upperFirst(cleaned)}.`;
    if (
      /,\s*\S/.test(cleaned) &&
      extractiveActionClausePattern.test(cleaned) &&
      !isFragmentLikeClinicalAnswer(conditionalAsSentence, query)
    ) {
      return conditionalAsSentence;
    }
    return `The guidance is that ${lowerFirst(cleaned)}.`;
  }

  const withoutLeadingFragment = cleaned.replace(/^(?:and|or|but|with|without|including|such as|then)\s+/i, "");
  if (/^to\b/i.test(cleaned)) {
    return `The guidance is ${lowerFirst(cleaned)}.`;
  }
  if (withoutLeadingFragment !== cleaned) {
    return `The guidance includes ${lowerFirst(withoutLeadingFragment)}.`;
  }

  return `The guidance is that ${lowerFirst(cleaned)}.`;
}

/** Section for fact kind. */
function sectionForFactKind(kind: ExtractedClinicalFactKind): Pick<AnswerSection, "heading" | "kind"> {
  switch (kind) {
    case "dose":
      return { heading: "Dose", kind: "medication_dose" };
    case "renal_limit":
      return { heading: "Renal limits", kind: "contraindications_cautions" };
    case "monitoring":
      return { heading: "Monitoring", kind: "monitoring_timing" };
    case "threshold_action":
      return { heading: "Result action", kind: "thresholds" };
    case "contraindication":
      return { heading: "Contraindications", kind: "contraindications_cautions" };
    case "pathway_referral":
      return { heading: "Pathway/referral", kind: "required_actions" };
    case "caveat":
      return { heading: "Caveat", kind: "source_gap" };
    default:
      return { heading: "Bottom line", kind: "bottom_line" };
  }
}

/** Build fact sections. */
function buildFactSections(facts: ExtractedClinicalFact[], query: string) {
  const grouped = new Map<ExtractedClinicalFactKind, ExtractedClinicalFact[]>();
  for (const fact of facts) grouped.set(fact.kind, [...(grouped.get(fact.kind) ?? []), fact]);
  return Array.from(grouped.entries())
    .slice(0, 4)
    .map(([kind, group]) => {
      const section = sectionForFactKind(kind);
      const body = group
        .slice(0, 2)
        .map((fact) => sentenceFromFact(fact, query))
        .filter(Boolean)
        .join(" ");
      return {
        heading: section.heading,
        kind: section.kind,
        supportLevel: "direct",
        body: boldHighYieldClinicalText(body, query),
        citation_chunk_ids: Array.from(new Set(group.flatMap((fact) => fact.citationChunkIds))),
      } satisfies AnswerSection;
    })
    .filter((section) => section.body && section.citation_chunk_ids.length > 0);
}

/** Build fact synthesized answer. */
function buildFactSynthesizedAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  intent: AnswerIntent;
  results: SearchResult[];
}) {
  const facts = extractClinicalFactsFromResults(args.results, args.query, args.intent);
  if (!facts.length) {
    if (sourceBackedDocumentFallbackIntent(args.query, args.queryClass, args.intent, args.results)) {
      return buildDocumentSupportListAnswer({ query: args.query, results: args.results });
    }
    const gapAnswer = finalQualityGapAnswer(args.query, args.queryClass, args.intent);
    return {
      answer: gapAnswer,
      body: gapAnswer,
      citationChunkIds: [] as string[],
      answerSections: [] as AnswerSection[],
    };
  }

  const leadFacts = facts.slice(0, args.intent === "dose" ? 2 : 1);
  // Once the lead answer names the query entity, later lead sentences skip
  // their own entity prefix so the entity is not repeated in every sentence.
  const entity = queryEntityTokens(args.query, args.intent)[0];
  let accumulated = "";
  const leadSentences: string[] = [];
  for (const fact of leadFacts) {
    const suppressEntityPrefix = Boolean(entity && accumulated && queryTokenMatchesText(entity, accumulated));
    const sentence = sentenceFromFact(fact, args.query, { suppressEntityPrefix });
    if (!sentence) continue;
    leadSentences.push(sentence);
    accumulated = `${accumulated} ${sentence}`.trim();
  }
  const answer = sanitizeAnswerText(leadSentences.join(" "));
  const answerSections = buildFactSections(facts, args.query);
  return {
    answer: boldHighYieldClinicalText(answer, args.query),
    body: boldHighYieldClinicalText(answer, args.query),
    citationChunkIds: Array.from(new Set(facts.flatMap((fact) => fact.citationChunkIds))),
    answerSections,
  };
}

/** Source backed document fallback intent. */
function sourceBackedDocumentFallbackIntent(
  query: string,
  queryClass: RagQueryClass,
  intent: AnswerIntent,
  results: SearchResult[],
) {
  if (results.length === 0) return false;
  const strongestScore = Math.max(...results.map(scoreValue));
  if (strongestScore < 0.45) return false;
  const normalized = normalizeSectionText(query).toLowerCase();
  const sourceBackedProcedureQuery =
    /\b(?:process|procedure|protocol|pathway|workflow|steps?|requirements?|criteria|guidance|document)\b/.test(
      normalized,
    );
  if (!sourceBackedProcedureQuery) return false;
  return (
    intent === "document_lookup" ||
    intent === "pathway_referral" ||
    queryClass === "document_lookup" ||
    queryClass === "broad_summary"
  );
}

/** Document support list intent. */
function documentSupportListIntent(query: string, queryClass: RagQueryClass) {
  return (
    classifyAnswerIntent(query, queryClass) === "document_lookup" &&
    /\b(?:support|supports|supporting|sources?|documents?|guidelines?)\b/i.test(query)
  );
}

/** Table or visual source lookup intent. */
function tableOrVisualSourceLookupIntent(query: string, queryClass: RagQueryClass, answerIntent: AnswerIntent) {
  if (queryClass === "table_threshold" || answerIntent === "dose" || answerIntent === "monitoring_schedule")
    return false;
  return (
    /\b(?:which|where|find|open|locate)\b.{0,120}\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b/i.test(
      query,
    ) ||
    /\b(?:show|display)\s+(?:me\s+)?(?:the\s+)?(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b/i.test(
      query,
    ) ||
    /\b(?:which|what)\b.{0,80}\b(?:source|document|guideline|file|pdf)\b.{0,80}\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b/i.test(
      query,
    ) ||
    /\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b.{0,80}\b(?:cover|covers|contain|contains|list|lists|guidance)\b/i.test(
      query,
    )
  );
}

/** Source lookup label. */
function sourceLookupLabel(result: SearchResult) {
  const tableTitle = (result.table_facts ?? [])
    .map((fact) => fact.table_title || fact.row_label)
    .find((value): value is string => Boolean(value?.trim()));
  const imageTitle = (result.images ?? [])
    .map((image) => image.tableTitle || image.caption)
    .find((value): value is string => Boolean(value?.trim()));
  const rawLabel = tableTitle || imageTitle || result.section_heading || result.title || result.file_name;
  return normalizeSectionText(rawLabel)
    .replace(/([a-zA-Z])\(/g, "$1 (")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Has table or visual lookup evidence. */
function hasTableOrVisualLookupEvidence(result: SearchResult) {
  return (
    (result.table_facts?.length ?? 0) > 0 ||
    (result.images ?? []).some((image) =>
      /\b(?:clinical_table|flowchart_algorithm|medication_chart|risk_matrix|table_crop|diagram_crop|page_region|embedded)\b/i.test(
        `${image.image_type ?? ""} ${image.sourceKind ?? ""} ${image.source_kind ?? ""}`,
      ),
    ) ||
    /\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b/i.test(
      `${result.section_heading ?? ""} ${result.title ?? ""} ${result.file_name ?? ""}`,
    )
  );
}

/** Build table or visual source lookup answer. */
function buildTableOrVisualSourceLookupAnswer(args: { query: string; results: SearchResult[] }) {
  const source = args.results.find(hasTableOrVisualLookupEvidence) ?? args.results[0];
  if (!source) {
    const gapAnswer = finalQualityGapAnswer(args.query, "document_lookup", "document_lookup");
    return { answer: gapAnswer, citationChunkIds: [] as string[], answerSections: [] as AnswerSection[] };
  }

  const label = sourceLookupLabel(source) || "the top matched source";
  const answer = `The relevant source is ${label}, which covers the requested table or visual guidance.`;

  return {
    answer,
    citationChunkIds: [source.id],
    preformatted: true,
    answerSections: [
      {
        heading: "Source match",
        kind: "documentation",
        supportLevel: "direct",
        body: `The source match is ${label}.`,
        citation_chunk_ids: [source.id],
      },
    ] satisfies AnswerSection[],
  };
}

/** Build document support list answer. */
function buildDocumentSupportListAnswer(args: { query: string; results: SearchResult[] }) {
  const documents = buildDocumentBreakdown(args.results, extractQuoteCards(args.results, args.query)).slice(0, 5);
  if (!documents.length) {
    const gapAnswer = finalQualityGapAnswer(args.query, "document_lookup", "document_lookup");
    return { answer: gapAnswer, citationChunkIds: [] as string[], answerSections: [] as AnswerSection[] };
  }
  const names = documents
    .map((document) =>
      normalizeSectionText(document.title || document.file_name)
        .replace(/([a-zA-Z])\(/g, "$1 (")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const answer =
    names.length === 1
      ? `I found one indexed document that supports this query: ${names[0]}.`
      : `I found ${names.length} indexed documents that support this query: ${names.slice(0, -1).join("; ")}; and ${names.at(-1)}.`;
  return {
    answer,
    preformatted: true,
    citationChunkIds: Array.from(
      new Set(
        documents.flatMap((document) =>
          args.results
            .filter((result) => result.document_id === document.document_id)
            .slice(0, 1)
            .map((result) => result.id),
        ),
      ),
    ),
    answerSections: [
      {
        heading: "Document matches",
        kind: "documentation",
        supportLevel: "direct",
        body: names.join("; "),
        citation_chunk_ids: Array.from(
          new Set(
            documents.flatMap((document) =>
              args.results
                .filter((result) => result.document_id === document.document_id)
                .slice(0, 1)
                .map((result) => result.id),
            ),
          ),
        ),
      },
    ] satisfies AnswerSection[],
  };
}

/** Build extractive answer. */
export function buildExtractiveAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  results: SearchResult[];
  quoteCards: QuoteCard[];
  documentBreakdown: RagAnswer["documentBreakdown"];
  evidenceSummary: RagAnswer["evidenceSummary"];
  sourceCoverage: RagAnswer["sourceCoverage"];
  conflictsOrGaps: ConflictOrGap[];
  visualEvidence: RagAnswer["visualEvidence"];
  bestSource: RagAnswer["bestSource"];
  smartPanel: RagAnswer["smartPanel"];
  relatedDocuments: RagAnswer["relatedDocuments"];
  routeReason: string;
  timings: RagAnswer["latencyTimings"];
}) {
  const quoteCards = args.quoteCards.length
    ? args.quoteCards.slice(0, 5)
    : extractQuoteCards(args.results, args.query, 5);
  const memoryCards = rankMemoryCardsForAnswer(collectMemoryCards(args.results, 16), args.query, args.queryClass).slice(
    0,
    10,
  );
  const citations = compactCitations(args.results).slice(0, Math.max(quoteCards.length, 1));
  const citationIds = new Set(citations.map((citation) => citation.chunk_id));
  const resultById = new Map(args.results.map((result) => [result.id, result]));
  for (const card of memoryCards) {
    for (const chunkId of card.source_chunk_ids ?? []) {
      if (citationIds.has(chunkId)) continue;
      const source = resultById.get(chunkId);
      if (!source) continue;
      citations.push(resultCitation(source));
      citationIds.add(chunkId);
    }
  }
  for (const quote of quoteCards) {
    if (!citationIds.has(quote.chunk_id)) {
      // Guard the lookup: a quote card whose chunk_id was filtered out of results
      // would make find() return undefined and resultCitation(undefined) throw.
      const source = args.results.find((result) => result.id === quote.chunk_id);
      if (source) citations.push(resultCitation(source));
    }
    citationIds.add(quote.chunk_id);
  }

  const answerIntent = classifyAnswerIntent(args.query, args.queryClass);
  const naturalAnswer = documentSupportListIntent(args.query, args.queryClass)
    ? buildDocumentSupportListAnswer({ query: args.query, results: args.results })
    : tableOrVisualSourceLookupIntent(args.query, args.queryClass, answerIntent)
      ? buildTableOrVisualSourceLookupAnswer({ query: args.query, results: args.results })
      : buildFactSynthesizedAnswer({
          query: args.query,
          queryClass: args.queryClass,
          intent: answerIntent,
          results: args.results,
        });

  // Fact synthesis is the production extractive path. If no clean fact survives
  // coverage and artifact gates, fail closed instead of stitching snippets.
  const hasExtractedAnswer = naturalAnswer.citationChunkIds.length > 0;

  // Ensure any chunk IDs referenced by the synthesized answer are present in citations,
  // even if they were not in the top-ranked compactCitations slice.
  for (const chunkId of naturalAnswer.citationChunkIds) {
    if (!citationIds.has(chunkId)) {
      const source = args.results.find((result) => result.id === chunkId);
      if (source) {
        citations.push(resultCitation(source));
        citationIds.add(chunkId);
      }
    }
  }

  return {
    answer: naturalAnswer.answer,
    grounded: hasExtractedAnswer && citations.length > 0,
    confidence: hasExtractedAnswer ? deriveConfidence(args.results, citations) : "unsupported",
    citations: citations.slice(0, 5),
    sources: args.results,
    modelUsed: null,
    routingMode: "extractive",
    preformatted: hasExtractedAnswer && Boolean((naturalAnswer as { preformatted?: boolean }).preformatted),
    routingReason: args.routeReason,
    queryClass: args.queryClass,
    latencyTimings: args.timings,
    answerSections: naturalAnswer.answerSections ?? [],
    quoteCards,
    visualEvidence: args.visualEvidence,
    bestSource: args.bestSource,
    documentBreakdown: args.documentBreakdown,
    evidenceSummary: args.evidenceSummary,
    sourceCoverage: args.sourceCoverage,
    conflictsOrGaps: args.conflictsOrGaps,
    smartPanel: args.smartPanel,
    relatedDocuments: args.relatedDocuments,
    memoryCardsUsed: memoryCards,
    indexingVersion: ragDeepMemoryVersion,
    indexingQuality: buildIndexingQuality(args.results, memoryCards),
    scoreExplanations: buildAnswerScoreExplanations(args.results),
  } satisfies RagAnswer;
}

/** Source backed fallback subject. */
function sourceBackedFallbackSubject(query: string) {
  const normalized = normalizeSectionText(query)
    .replace(/[?!.]+$/, "")
    .trim();
  const subject = normalized
    .replace(/^summari[sz]e\s+(?:the\s+)?/i, "")
    .replace(/^what\s+(?:is|are)\s+(?:the\s+)?(?:process|requirements?)\s+for\s+/i, "")
    .replace(/^what\s+(?:is|are)\s+required\s+(?:for|when)\s+/i, "")
    .replace(/^what\s+(.+?)\s+is\s+required$/i, "$1")
    .replace(/^what\s+does\s+(?:the\s+)?/i, "")
    .replace(/\s+(?:document|procedure|guideline)\s+require$/i, "")
    .replace(/^how\s+(?:is|are)\s+/i, "")
    .replace(/\s+managed$/i, " management")
    .trim();

  if (subject.length < 4) return "this clinical question";
  return subject.length > 90 ? `${subject.slice(0, 87).trim()}...` : lowerFirst(subject);
}

/** Source backed generation timeout answer. */
export function sourceBackedGenerationTimeoutAnswer(query: string) {
  const subject = sourceBackedFallbackSubject(query);
  return `The uploaded documents contain relevant guidance on ${subject}, but a full written answer could not be completed just now. The key source passages are cited below — please review them directly.`;
}

const reasoningEffortRank: Record<OpenAIReasoningEffort, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 4,
};

// Strong-route reasoning effort by query class (P6). Safety-critical numeric/threshold classes keep
// the full configured effort; routine retrieval classes are capped at "medium" so high-effort
// reasoning over verbose context does not overrun the answer timeout and fail-closed on queries that
// actually have good sources. Never raises effort above the configured value.
/** Strong reasoning effort for query class. */
export function strongReasoningEffortForQueryClass(
  queryClass: RagQueryClass,
  configured: OpenAIReasoningEffort,
): OpenAIReasoningEffort {
  const safetyCritical = queryClass === "medication_dose_risk" || queryClass === "table_threshold";
  if (safetyCritical) return configured;
  return reasoningEffortRank[configured] > reasoningEffortRank.medium ? "medium" : configured;
}

/** Is unusable generated answer. */
export function isUnusableGeneratedAnswer(answer: Pick<RagAnswer, "answer" | "citations" | "routingReason">) {
  const normalized = normalizeSectionText(answer.answer ?? "");
  if (!normalized) return true;
  if (normalized === machineReadableFallbackAnswer) return true;
  if (answer.routingReason === "structured_parse_fallback") return true;
  return looksLikeJsonArtifact(normalized);
}

const templateLikeGeneratedTextPattern =
  /\b(?:the\s+(?:strongest\s+)?retrieved\s+(?:source|sources|passages|excerpts)\s+(?:support|supports|show|shows|indicate|indicates)|retrieved\s+(?:source|sources|passages|excerpts)|source-backed|based\s+on\s+(?:the\s+)?(?:provided\s+)?(?:sources|excerpts|passages|retrieved\s+sources)|the\s+(?:cited\s+)?source\s+(?:states|supports|says|indicates)|provided\s+excerpts)\b/i;
const templateLikeGeneratedPrefixPattern = /^(?:answer|summary|bottom line|required actions|direct answer)\s*[:.-]\s+/i;
const templateLikeGeneratedSectionHeadingPattern =
  /^(?:direct answer|bottom line|high-yield summary|source-backed answer|direct source-backed answer)$/i;
const simpleDirectQuestionPattern =
  /^(?:what\s+(?:is|are)|what's|define|who\s+(?:is|are)|when\s+(?:is|are)|where\s+(?:is|are)|is\s+|are\s+|does\s+|do\s+)/i;
const simpleQuestionExpansionPattern =
  /\b(?:management|manage|managed|treatment|treat|therapy|care|approach|pathway|dose|dosing|threshold|compare|versus|vs|monitoring|required|requirements|risk|side effect|contraindicat\w*|urgent|escalat\w*)\b/i;

/** Is template like generated answer. */
export function isTemplateLikeGeneratedAnswer(answer: Pick<RagAnswer, "answer" | "answerSections">) {
  const answerText = normalizeSectionText(answer.answer ?? "");
  if (
    answerText &&
    (templateLikeGeneratedTextPattern.test(answerText) || templateLikeGeneratedPrefixPattern.test(answerText))
  ) {
    return true;
  }

  return (answer.answerSections ?? []).some((section) => {
    const heading = normalizeSectionText(section.heading ?? "");
    const body = normalizeSectionText(section.body ?? "");
    return (
      (heading && templateLikeGeneratedSectionHeadingPattern.test(heading)) ||
      (body && (templateLikeGeneratedTextPattern.test(body) || templateLikeGeneratedPrefixPattern.test(body)))
    );
  });
}

/** Is simple direct question. */
export function isSimpleDirectQuestion(query: string, queryClass: RagQueryClass) {
  const normalized = normalizeSectionText(query);
  if (!normalized || normalized.length > 100) return false;
  if (queryClass === "comparison" || queryClass === "table_threshold" || queryClass === "medication_dose_risk") {
    return false;
  }
  if (queryClass === "broad_summary" || queryClass === "document_lookup") return false;
  return simpleDirectQuestionPattern.test(normalized) && !simpleQuestionExpansionPattern.test(normalized);
}

// Bare definitional questions ("what is X", "define X", "who is X") legitimately get short answers
// that refer back to the subject with anaphora ("It is …") without repeating the entity term, so
// the lexical entity-overlap responsiveness check would false-fire on them. Detect and exempt them
// when extending the overlap gate to synthesized model answers.
/** Is bare definition question. */
export function isBareDefinitionQuestion(query: string) {
  return /^(?:what(?:'s| is| are)|define|who\s+(?:is|are))\b/i.test(normalizeSectionText(query));
}

/** Word count. */
function wordCount(value: string) {
  return normalizeSectionText(value).split(/\s+/).filter(Boolean).length;
}

/** Is over expanded simple generated answer. */
export function isOverExpandedSimpleGeneratedAnswer(
  query: string,
  queryClass: RagQueryClass,
  answer: Pick<RagAnswer, "answer" | "answerSections">,
) {
  if (!isSimpleDirectQuestion(query, queryClass)) return false;
  const sections = answer.answerSections ?? [];
  const nonEssentialSectionCount = sections.filter((section) => !isEssentialSimpleQuestionSection(section)).length;
  return nonEssentialSectionCount > 0 || sections.length > 1 || wordCount(answer.answer ?? "") > 95;
}

/** Is essential simple question section. */
function isEssentialSimpleQuestionSection(section: Pick<AnswerSection, "heading" | "body">) {
  return /\b(?:gap|not enough|insufficient|unsupported|urgent|escalat\w*|risk|safety)\b/i.test(
    `${section.heading} ${section.body}`,
  );
}

const clinicalQuerySignalPattern =
  /\b(?:lithium|clozapine|acamprosate|naltrexone|sertraline|valproate|antipsychotic|ect|bulimia|anorexia|eating disorder|dose|renal|pregnan|monitor|fbc|anc|qtc|opioid|contraindicat|referral|pathway|patient|clinical|guideline|medication|medicine|prescrib|therapy|treatment)\b/i;

/** Is clearly non clinical unsupported query. */
function isClearlyNonClinicalUnsupportedQuery(query: string) {
  return (
    /\b(?:coffee|machine|parking|payroll|roster|leave|wifi|printer|canteen|expense|timesheet|room\s+booking|building|staff\s+room)\b/i.test(
      query,
    ) && !clinicalQuerySignalPattern.test(query)
  );
}

/** Final quality gap answer. */
export function finalQualityGapAnswer(
  query: string,
  queryClass: RagQueryClass,
  intent: AnswerIntent = classifyAnswerIntent(query, queryClass),
) {
  if (
    isClearlyNonClinicalUnsupportedQuery(query) ||
    (queryClass === "unsupported_or_general" && !clinicalQuerySignalPattern.test(query))
  ) {
    return "No relevant clinical source was found for this query.";
  }
  if (intent === "document_lookup") return "No current indexed document directly supporting this request was found.";
  if (intent === "pathway_referral" && /\bect\b/i.test(query)) {
    return "No current source with ECT referral criteria was found.";
  }
  if (intent === "pathway_referral") return "No current source with referral or pathway criteria was found.";
  if (intent === "contraindication") return "No current source with contraindication or avoid-use guidance was found.";
  if (intent === "monitoring_schedule")
    return "No current source with monitoring timing or schedule guidance was found.";
  if (intent === "red_result_action") {
    if (/\bqtc\b/i.test(query)) return "No current source with QTc threshold or ECG action guidance was found.";
    if (/\btoxicity\b/i.test(query)) return "No current source with toxicity action guidance was found.";
    if (/\brash\b/i.test(query)) return "No current source with rash action guidance was found.";
    return "No current source with threshold-specific action guidance was found.";
  }
  if (intent === "dose") {
    if (/\brenal\b/i.test(query)) return "No current source with renal dosing limits for this query was found.";
    return "No current source with dose guidance for this query was found.";
  }
  return "No current source with directly relevant clinical guidance was found.";
}

/** Is fragment like clinical answer. */
function isFragmentLikeClinicalAnswer(text: string, query: string) {
  const normalized = normalizeSectionText(text);
  const lower = normalized.toLowerCase();
  if (
    /\b(?:dosing\s+frequencies\s+outside|prn\s+dose\s+daily\s+dose|table\s+summari[sz]ing|includes\s+risk\s+monitoring\s+form|recommended\s+over\s+>\d+\s*kg)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/^for\s+(?:after|before|prior|post),/i.test(normalized)) return true;
  if (/\bis\s+to:\.?$/i.test(normalized)) return true;
  if (
    /^what\s+is\b/i.test(query) &&
    // Only apply this fragment gate for general/definition questions, not for clinical intent
    // queries like "What is the maximum dose?" or "What is the QTc threshold?" which produce
    // valid concise fact answers that don't contain definition-style phrasing.
    !/\b(?:required|requirements?|dose|dosage|dosing|max(?:imum)?|mg|mcg|threshold|monitor|renal|contraindicat|referral|pathway|procedure|process|protocol|workflow|steps?|ect|electroconvulsive|qtc|fbc|anc|wbc|level|levels)\b/i.test(
      query,
    ) &&
    // "What is required/needed/involved/included…" and "what is the process/procedure/protocol…"
    // are procedural questions, not definitions — their answers (and the source-pointer fallback)
    // legitimately lack "X is a/an…" definition phrasing, so the definition-fragment gate must not
    // fire for them (it otherwise fails good answers closed on a false positive — see P6).
    !/^what\s+is\s+(?:required|needed|involved|included|expected|recommended|considered|the\s+(?:process|procedure|protocol|criteria|requirement|approach|guidance|recommendation|role|purpose|aim))\b/i.test(
      query,
    ) &&
    !/\b(?:is|are)\s+(?:a|an|the)\b|\b(?:defined\s+as|characteri[sz]ed\s+by|involves|refers\s+to|is\s+an?\s+eating\s+disorder)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/\bbaby\s+whilst\b.*\bpost\s+anaesthetic\b/i.test(normalized)) return true;
  if (/^(\*{0,2}[a-z][a-z0-9 -]{2,}\*{0,2})\s*:\s*\1\b/i.test(normalized)) return true;
  if (/\?\s+(?:monitoring|adverse effects|when prescribed|prescribed for)\b/i.test(normalized)) return true;
  if (/\bmonitoring adverse effects when prescribed\b/i.test(normalized)) return true;
  if (/\b(?:after starting|ongoing)\s+\*{0,2}[a-z]+\*{0,2}\.?$/i.test(normalized) && normalized.length < 90) {
    return true;
  }
  if (/\bect\b/i.test(query) && !/\b(?:ect|electroconvulsive|refer|referral)\b/i.test(lower)) return true;
  return false;
}

/** Is missing critical query intent. */
function isMissingCriticalQueryIntent(query: string, text: string) {
  const normalizedQuery = normalizeSectionText(query).toLowerCase();
  const normalizedText = normalizeSectionText(text).toLowerCase();
  if (/\bcontraindicat\w*\b/.test(normalizedQuery)) {
    return !/\b(?:contraindicat\w*|avoid|must not|do not|should not|not use|opioid[-\s]?free|withdrawal|precipitat\w*)\b/.test(
      normalizedText,
    );
  }
  if (/\b(?:what to do|red|amber|anc|result|results)\b/.test(normalizedQuery)) {
    return !/\b(?:withhold|cease|stop|discontinue|discontinued|contact|urgent|repeat|review|monitor|range|threshold|blood|patholog\w*|haematolog\w*|hematolog\w*|anc)\b/.test(
      normalizedText,
    );
  }
  if (/\b(?:referral|refer|pathway)\b/.test(normalizedQuery) && /\bect\b/.test(normalizedQuery)) {
    return !/\b(?:ect|electroconvulsive|refer|referral|criteria|indicat\w*|psychiat\w*)\b/.test(normalizedText);
  }
  if (/\b(?:monitor|monitoring|schedule|baseline|follow[-\s]?up)\b/.test(normalizedQuery)) {
    if (/\bfbc\b/.test(normalizedQuery) && !/\bfbc\b/.test(normalizedText)) return true;
    if (/\banc\b/.test(normalizedQuery) && !/\banc\b/.test(normalizedText)) return true;
    if (
      /\bschedule\b/.test(normalizedQuery) &&
      !/\b(?:schedule|baseline|weekly|monthly|annual|every|first\s+\d+\s+weeks|then|ongoing)\b/.test(normalizedText)
    ) {
      return true;
    }
    return !/\b(?:monitor|monitoring|follow[-\s]?up|baseline|weekly|monthly|annual|every|level|levels|blood test|fbc|anc|wbc|ecg|lft|renal|thyroid|metabolic|glucose|bsl|lipids|cholesterol|triglycerides|blood pressure|bp|pulse|weight|bmi)\b/.test(
      normalizedText,
    );
  }
  return false;
}

const openingSentenceTerminatorPattern = /[.!?]["')\]]*(?:\s|$)/;
const incompleteOpeningSentencePattern =
  /^(?:and|or|but|because|although|while|when|where|after|before|during|with|without|including|such as|then|to|recommended\s+over|alternative\s+agent|chart\s+reference|table\s+summari[sz]ing)\b/i;
const sourceHeadingOpeningPattern =
  /^(?:appendix\s+\d+|dosage|dose|dosing|dosage and monitoring|dose table|monitoring|referral criteria|contraindications?|adverse effects?|required actions?|thresholds?|summary|overview|formulations?|available products?|product information|table|figure)\.?$/i;
const openingSentenceActionPattern =
  /\b(?:avoid|arrange|be|can|cannot|cease|check|continue|could|discontinue|document|give|include|includes|included|increase|involves|is|list|lists|may|might|monitor|must|need|needed|needs|provide|provides|recommend|recommends|reduce|refer|repeat|report|required|requires|review|should|start|starts|stop|support|supports|use|uses|was|were|will|withhold|would)\b/i;

/** First sentence. */
function firstSentence(value: string) {
  const normalized = normalizeSectionText(value);
  const terminatorMatch = normalized.match(openingSentenceTerminatorPattern);
  if (!terminatorMatch || terminatorMatch.index === undefined) return normalized;
  return normalized.slice(0, terminatorMatch.index + terminatorMatch[0].trimEnd().length).trim();
}

/** Has complete opening sentence. */
function hasCompleteOpeningSentence(value: string) {
  const normalized = normalizeSectionText(value);
  if (!normalized || !openingSentenceTerminatorPattern.test(normalized)) return false;
  const opening = firstSentence(normalized).replace(/\*\*/g, "").trim();
  const openingWithoutTerminal = opening.replace(/[.!?]["')\]]*$/, "").trim();
  if (opening.length < 18 || openingWithoutTerminal.length < 12) return false;
  if (templateLikeGeneratedPrefixPattern.test(opening)) return false;
  if (incompleteOpeningSentencePattern.test(opening)) return false;
  if (sourceHeadingOpeningPattern.test(openingWithoutTerminal)) return false;
  return openingSentenceActionPattern.test(opening);
}

/** Has invalid model evidence ids. */
export function hasInvalidModelEvidenceIds(answer: Pick<RagAnswer, "routingReason">) {
  return /\binvalid_model_citation_ids\b/.test(answer.routingReason ?? "");
}

/** Generated answer quality failure reason. */
export function generatedAnswerQualityFailureReason(answer: RagAnswer, query: string, queryClass: RagQueryClass) {
  const cleanedAnswer = sanitizeAnswerText(answer.answer);
  if (!cleanedAnswer) return "empty_after_sanitize";
  if (!hasCompleteOpeningSentence(cleanedAnswer)) return "incomplete_opening_sentence";
  if (hasBadFinalAnswerQuality(cleanedAnswer)) return "bad_final_answer_quality";
  if (hasClinicalAnswerQualityIssue(cleanedAnswer)) return "clinical_answer_quality_issue";
  if (isLowYieldClinicalText(cleanedAnswer)) return "low_yield_answer";
  if (isFragmentLikeClinicalAnswer(cleanedAnswer, query)) return "fragment_like_answer";
  if (isMissingCriticalQueryIntent(query, cleanedAnswer)) return "missing_query_intent";
  // Core-term (entity/intent) overlap responsiveness check. For extractive/low-confidence answers
  // it always applies. For synthesized model answers it is only safe on narrow simple direct
  // questions that are not bare definitions (yes/no, when/where, "does X…") — there a well-targeted
  // answer genuinely should carry the query entity terms, and anaphora is rare. Broad/comparison/
  // summary answers legitimately paraphrase, so enforcing overlap there would reject good answers.
  // A model-answer failure here only escalates fast→strong and is recovered for strongly
  // source-backed answers, so the downside of enforcing it is a retry, not a wrongful gap.
  const enforceModelAnswerOverlap = isSimpleDirectQuestion(query, queryClass) && !isBareDefinitionQuestion(query);
  if (
    (answer.routingMode === "extractive" || answer.confidence === "low" || enforceModelAnswerOverlap) &&
    !hasRelevantQueryOverlap(cleanedAnswer, query)
  ) {
    return "missing_query_overlap";
  }
  if (hasInvalidModelEvidenceIds(answer)) return "invalid_model_evidence_ids";
  if (isUnusableGeneratedAnswer(answer)) return "unusable_generated_answer";
  if (isTemplateLikeGeneratedAnswer(answer)) return "template_like_answer";
  if (isOverExpandedSimpleGeneratedAnswer(query, queryClass, answer)) return "overexpanded_simple_answer";
  return null;
}

/** Final quality failure. */
function finalQualityFailure(answer: RagAnswer, query: string, queryClass: RagQueryClass, reason: string): RagAnswer {
  return {
    ...answer,
    answer: finalQualityGapAnswer(query, queryClass),
    grounded: false,
    confidence: "unsupported",
    answerSections: [],
    responseMode: "evidence_gap",
    routingReason: [answer.routingReason, `final_quality_gate:${reason}`].filter(Boolean).join("; "),
  };
}

/** Should preserve source backed generated answer. */
function shouldPreserveSourceBackedGeneratedAnswer(answer: RagAnswer, reason: string) {
  if (reason !== "missing_query_intent" && reason !== "missing_query_overlap") return false;
  if (!answer.grounded || answer.confidence === "unsupported" || answer.citations.length === 0) return false;
  if (hasInvalidModelEvidenceIds(answer)) return false;

  const sourceSelection = answer.smartApiPlan?.answerPlan.sourceSelection;
  if (!sourceSelection?.selectedCount || !sourceSelection.requiredSignalsSatisfied) return false;
  if (sourceSelection.missingRequiredSignals.length > 0) return false;

  const matchedSignals = sourceSelection.matchedSignals;
  const hasSpecificSourceSignal = matchedSignals.some(
    (signal) =>
      signal.startsWith("index_unit:") ||
      [
        "document_title",
        "document_label",
        "table_fact",
        "source_image",
        "visual_table",
        "direct_relevance",
        "active_community",
        "ed",
        "agitation",
        "dose_amount",
        "route",
        "flowchart_or_pathway",
      ].includes(signal),
  );
  const hasStructuredChunk =
    sourceSelection.topChunkTypes.table > 0 ||
    sourceSelection.topChunkTypes.flowchart > 0 ||
    sourceSelection.topChunkTypes.medication_chart > 0 ||
    sourceSelection.topChunkTypes.patient_education > 0;

  return hasSpecificSourceSignal || hasStructuredChunk;
}

/** Section heading kind. */
function sectionHeadingKind(heading: string): AnswerSectionKind {
  if (/\b(?:dose|dosing|medication)\b/i.test(heading)) return "medication_dose";
  if (/\b(?:monitor|timing|baseline|follow)\b/i.test(heading)) return "monitoring_timing";
  if (/\b(?:threshold|red|amber|withhold|stop|cease)\b/i.test(heading)) return "thresholds";
  if (/\b(?:gap|unsupported|source)\b/i.test(heading)) return "source_gap";
  if (/\b(?:contraindicat|caution|avoid|risk)\b/i.test(heading)) return "contraindications_cautions";
  return "required_actions";
}

/** Clean answer section heading. */
export function cleanAnswerSectionHeading(heading: string, body: string) {
  const normalized = normalizeSectionText(heading);
  if (
    !normalized ||
    /^(?:direct answer|bottom line|high-yield summary|source-backed answer|direct source-backed answer)$/i.test(
      normalized,
    )
  ) {
    if (/\b(?:dose|mg|daily|tds|bd)\b/i.test(body)) return "Dose";
    if (/\b(?:monitor|baseline|fbc|anc|ecg|level)\b/i.test(body)) return "Monitoring";
    if (/\b(?:withhold|stop|cease|threshold|red|amber)\b/i.test(body)) return "Thresholds";
    if (/\b(?:gap|not enough|unsupported|insufficient)\b/i.test(body)) return "Source gap";
    return "Key point";
  }
  return normalized;
}

/** Apply provider labels. */
function applyProviderLabels(answer: RagAnswer): RagAnswer {
  const inferredSourceOnlyFallback =
    answer.routingMode === "extractive" || /(?:^|;\s*)generation_fallback(?::|$)/i.test(answer.routingReason ?? "");
  const answerQualityTier: RagAnswer["answerQualityTier"] =
    answer.answerQualityTier ??
    (answer.modelUsed ? "model_synthesis" : inferredSourceOnlyFallback ? "source_only" : undefined);
  const fallbackReason =
    answer.fallbackReason ??
    (answerQualityTier === "source_only" ? (fallbackReasonFromRouting(answer.routingReason) ?? "source_only") : null);
  const degradedActive = answerQualityTier === "source_only";
  return {
    ...answer,
    providerMode: answer.providerMode ?? ragProviderMode(),
    answerQualityTier,
    fallbackReason,
    degradedMode: answer.degradedMode ?? {
      active: degradedActive,
      reason: degradedActive ? fallbackReason : null,
    },
  };
}

// Public wrapper: runs quality finalization, then stamps provider/quality labels so the UI can
// disclose source-only (lower-quality) answers and verify-against-sources guidance.
/** Finalize rag answer quality. */
export function finalizeRagAnswerQuality(answer: RagAnswer, query: string, queryClass: RagQueryClass): RagAnswer {
  return applyProviderLabels(finalizeRagAnswerQualityCore(answer, query, queryClass));
}

/** Finalize rag answer quality core. */
function finalizeRagAnswerQualityCore(answer: RagAnswer, query: string, queryClass: RagQueryClass): RagAnswer {
  // Deterministic, template-built answers (document-support lists, table/visual source
  // references) are well-formed by construction and carry no free-text clinical claims.
  // The clinical-prose sanitizer/quality gate below is designed for model prose and would
  // strip their document names (facility codes like "(NOCC)(AKG)" read as non-prose),
  // turning a valid answer into garble that then fails the gate. Return them untouched.
  if (answer.preformatted && answer.grounded) {
    return answer;
  }
  const cleanedAnswer = sanitizeAnswerText(answer.answer);
  const gapLikeAnswer =
    /could not find enough clean|no relevant clinical source|no current source|cannot provide a clinical answer|cannot provide a source-backed clinical answer|nearby indexed passages|not strong enough to support a reliable answer|no specific\b.*\bcan be confirmed|do not contain indexed guidance|do not contain (?:specific\s+)?information|do not provide specific|no\b.*\bguidance\b.*\bincluded|defer to other sources/i.test(
      cleanedAnswer,
    );
  const existingGapAnswer =
    gapLikeAnswer && (!answer.grounded || answer.routingMode === "strong" || answer.confidence === "low");
  if (existingGapAnswer) {
    const gapAnswer = finalQualityGapAnswer(query, queryClass);
    return {
      ...answer,
      answer: gapAnswer,
      grounded: false,
      confidence: "unsupported",
      answerSections: [],
      responseMode: "evidence_gap",
    };
  }

  if (!answer.grounded && answer.confidence === "unsupported") {
    return finalQualityFailure(answer, query, queryClass, "ungrounded_unsupported_answer");
  }

  let qualityFailureReason = !cleanedAnswer
    ? "empty_after_sanitize"
    : cleanedAnswer.length < 18
      ? "answer_too_short"
      : generatedAnswerQualityFailureReason(answer, query, queryClass);

  if (qualityFailureReason) {
    if (shouldPreserveSourceBackedGeneratedAnswer(answer, qualityFailureReason)) {
      answer = {
        ...answer,
        confidence: answer.confidence === "low" ? "medium" : answer.confidence,
        routingReason: [answer.routingReason, `final_quality_gate_source_backed_recovery:${qualityFailureReason}`]
          .filter(Boolean)
          .join("; "),
      };
      qualityFailureReason = null;
    } else {
      return finalQualityFailure(answer, query, queryClass, qualityFailureReason);
    }
  }

  const answerKey = normalizeSectionText(cleanedAnswer).toLowerCase();
  const answerSections = (answer.answerSections ?? [])
    .map((section) => {
      const body = sanitizeAnswerText(section.body);
      if (!body || hasClinicalAnswerQualityIssue(body) || isLowYieldClinicalText(body)) return null;
      const bodyKey = normalizeSectionText(body).toLowerCase();
      const isDocumentListSection = section.kind === "documentation" || /\bdocument matches\b/i.test(section.heading);
      if (
        !isDocumentListSection &&
        (bodyKey === answerKey || answerKey.includes(bodyKey) || bodyKey.includes(answerKey))
      ) {
        return null;
      }
      const heading = cleanAnswerSectionHeading(section.heading, body);
      return {
        ...section,
        heading,
        body: boldHighYieldClinicalText(body, query),
        kind: section.kind ?? sectionHeadingKind(heading),
        supportLevel: section.supportLevel ?? "direct",
      } satisfies AnswerSection;
    })
    .filter((section): section is Exclude<typeof section, null> => Boolean(section));

  return applyNumericVerification({
    ...answer,
    answer: boldHighYieldClinicalText(cleanedAnswer, query),
    answerSections,
  });
}
