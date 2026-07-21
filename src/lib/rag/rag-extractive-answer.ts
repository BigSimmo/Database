import { boldHighYieldClinicalText } from "@/lib/answer-ranking";
import { applyNumericVerification, extractClinicalValueAtoms } from "@/lib/answer-verification";
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
} from "@/lib/rag/rag-answer-support";
import {
  hasClinicalAnswerQualityIssue,
  looksLikeJsonArtifact,
  normalizeSectionText,
  sanitizeAnswerText,
  splitBalancedWords,
} from "@/lib/rag/rag-answer-text";
import { cloneAnswer } from "@/lib/rag/rag-cache";
import { ragProviderMode } from "@/lib/rag/rag-provider";
import {
  isLowYieldClinicalText,
  normalizeInlineBulletGlyphs,
  sourceTextForClinicalProse,
  sourceTextForClinicalProsePreservingBreaks,
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
import { assessAndEnforceClaimSupport, clinicalValueAtomKey, sourceEvidenceText } from "@/lib/rag/rag-claim-support";

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

// Structural labels that are pure boilerplate — never merged into a
// following fragment and never rewritten into "For <label>, …". Clinical
// headings that happen to share a word are exempt: "Source control"
// (infection-source management) and "Reference range/interval" (lab values)
// are evidence, not provenance or bibliography labels.
// "section" is anchored to the label start so structural "Section 2:" is
// excluded while clinical phrases like "Caesarean section:" merge normally.
const structuralHeadingStoplistPattern =
  /\b(?:source(?!\s+control\b)|table|figure|page|summary|example|appendix|reference(?!\s+(?:range|interval)s?\b)|contents)\b|^\s*section\b/i;

// Advisory labels ("Caution:", "Warning:") classify the fact that follows as
// a caveat — they merge with their bullet items like directive headings do,
// but keep their colon form instead of becoming "For caution, …".
const advisoryHeadingPattern = /\b(?:note|warning|caution|important|nb)\b/i;

// Headings that carry the clinical action themselves ("Do not use:",
// "Avoid:"). These must merge with their bullet items — the item alone often
// lacks the verb ("Pregnancy") — but must keep their colon form instead of
// being rewritten into noun context ("For avoid, pregnancy").
const directiveHeadingPattern =
  /\b(?:avoid|do|does|not|use|stop|cease|withhold|hold|discontinue|monitor|check|give|administer|contraindicat\w*|must|should|review|refer|contact|seek|consider|is|are|was|were)\b/i;

// A leading section heading carried into a fact ("Acute Mania: 750mg…")
// becomes readable context ("For acute mania, 750mg…") instead of a colon
// fragment glued mid-sentence. All-caps tokens (acronyms like "IR") keep
// their casing, so labels containing one are left for the dose rewrite below.
const leadingHeadingContextPattern = /^([A-Z][A-Za-z]+(?:[ /-][A-Za-z()]+){0,3}):\s+(?=\S)/;

// "Label: <dose>" reads as "Label is <dose>" only when the colon is directly
// followed by a numeric dose ("IR product: 750 to 1000mg" → "IR product is
// 750 to 1000mg"); prose labels without a dose keep their colon. A label
// ending in a preposition/verb particle is not a heading — "reduce dose to:
// 500mg" must not become "reduce dose to is 500mg".
const doseLabelColonPattern =
  /([A-Za-z][\w-]*(?:\s+[\w-]+){0,3})(?<!\b(?:to|by|at|of|in|on|with|into|onto|towards|per|over|under|from)):\s+(?=\d[^:]{0,24}?(?:mg|mcg|microg|m[lL]|units?|mmol|g)\b)/g;

function rewriteLeadingHeadingContext(value: string) {
  return value.replace(leadingHeadingContextPattern, (match, label: string) => {
    if (structuralHeadingStoplistPattern.test(label)) return match;
    if (advisoryHeadingPattern.test(label)) return match;
    if (directiveHeadingPattern.test(label)) return match;
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
  // Directive/advisory labels keep their colon — "Avoid: 12.5 mg…" must not
  // become the noun-label sentence "Avoid is 12.5 mg…".
  return rewriteLeadingHeadingContext(rewritten).replace(doseLabelColonPattern, (match, label: string) =>
    directiveHeadingPattern.test(label) || advisoryHeadingPattern.test(label) ? match : `${label} is `,
  );
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
  // Retrieval classification and answer intent are different concerns. A
  // document_lookup route can still ask for the document's clinical content
  // (for example, "What should a safety plan include?"). Treat it as a source
  // lookup only when the wording explicitly asks to find/open/select a source;
  // otherwise the extractive path must select responsive clinical facts rather
  // than reference-list lines that merely mention a guideline or procedure.
  if (
    /\b(?:find|show|open|which)\b.*\b(?:document|guideline|procedure|policy|protocol|form|source|file)\b/.test(
      normalized,
    )
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

// Shared monitoring-schedule evidence vocabulary. The answer-intent gate
// (answerIntentEvidencePattern) and the fact filter (factSupportsAnswerIntent)
// must accept the same schedule/parameter language: the run-#60 targeting
// misses came from range, metabolic-panel, and inflected-schedule sentences
// ("reviewed annually", "monitored for 3 hours", "Maintenance range
// 0.6-0.8 mmol/L") passing the filter but dying at the narrower gate.
// Inflections match by prefix (monitor\w*), acronyms accept plurals, and bare
// digit durations ("at 12 weeks") count as schedule evidence.
const monitoringScheduleEvidenceSource = String.raw`monitor\w*|follow[-\s]?up|baseline|weekly|monthly|annual(?:ly)?|yearly|every|several\s+times\s+a\s+year|screen(?:ing|ed)?|levels?|blood tests?|bloods|fbcs?|ancs?|wbcs?|ecgs?|lfts?|renal|thyroid|metabolic|glucose|bsl|lipids|cholesterol|triglycerides|blood pressure|bp|pulse|weight|bmi|mmol\/l|mcg\/l|ng\/ml|range|target|therapeutic|maintenance|review\w*|\d+\s*(?:week|month|day|hour|year)s?`;
const monitoringScheduleEvidencePattern = new RegExp(String.raw`\b(?:${monitoringScheduleEvidenceSource})\b`, "i");

/** Answer intent evidence pattern. */
function answerIntentEvidencePattern(intent: AnswerIntent) {
  switch (intent) {
    case "dose":
      return doseIntentEvidencePattern;
    case "contraindication":
      return /\b(?:contraindicat\w*|avoid|must not|do not|should not|not use|opioid[-\s]?free|withdrawal|precipitat\w*)\b/i;
    case "monitoring_schedule":
      return monitoringScheduleEvidencePattern;
    case "red_result_action":
      return /\b(?:red|amber|green|threshold|withhold|cease|stop|discontinue|discontinued|urgent|contact|repeat|review|anc|fbc|wbc|neutrophil|toxic\w*|action|patholog\w*|haematolog\w*|hematolog\w*)\b/i;
    case "pathway_referral":
      return /\b(?:pathway|refer|referral|criteria|indicat\w*|ect|electroconvulsive|specialist|psychiat\w*)\b/i;
    case "document_lookup":
      return /\b(?:document|guideline|procedure|policy|protocol|form|source|file|support|supports|covers|contains)\b/i;
    default:
      return /\b(?:assess|arrange|check|collaborat\w*|complete|conduct|continue|develop|diagnos\w*|document|dose|ensure|identify|include|incorporate|involve|link|manage|monitor|provide|record|refer|revise|review\w*|risk|share|therapy|treat|update)\b/i;
  }
}

const clinicalDoseUnitSource = String.raw`(?:mg|milligrams?|mcg|micrograms?|g|grams?|kg|kilograms?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|international\s+units?|units?|iu|mmol(?:\/l)?|millimoles?(?:\s+per\s+lit(?:er|re))?|meq|milliequivalents?|tablets?|capsules?|puffs?|drops?|sprays?|patch(?:es)?)`;
const clinicalDoseValueSource = String.raw`\d+(?:\.\d+)?\s*${clinicalDoseUnitSource}`;
const clinicalDoseValuePattern = new RegExp(String.raw`\b${clinicalDoseValueSource}\b`, "i");
const maximumDoseEquivalentPattern = new RegExp(
  String.raw`\b(?:up\s+to|(?:do\s+)?not\s+exceed|not\s+to\s+exceed|(?:no|not)\s+more\s+than|at\s+most|limit(?:ed)?(?:\s+the\s+dose)?\s+to)\s+${clinicalDoseValueSource}\b`,
  "i",
);
const explicitMaximumDosePattern = new RegExp(
  String.raw`(?:\bmax(?:imum)?(?:\s+\w+){0,3}\s+doses?\b|\bdoses?(?:\s+\w+){0,3}\s+max(?:imum)?\b|\bmax(?:imum)?(?:\s+\w+){0,3}\s+${clinicalDoseValueSource}\b|\b${clinicalDoseValueSource}(?:\s+\w+){0,3}\s+max(?:imum)?\b)`,
  "i",
);
const doseIntentEvidencePattern = new RegExp(
  String.raw`\b(?:doses?|dosing|dosage|${clinicalDoseUnitSource}|eGFR|renal|creatinine|daily|bd|tds|mane|nocte)\b`,
  "i",
);

// Interval/schedule tokens that make a monitoring fact carry its asked-for
// schedule ("baseline", "annually", "every 3", "6 months"), plus unit-bearing
// level ranges ("0.6-0.8 mmol/L") for target-level monitoring answers.
// Alternation order is load-bearing: "every N unit" must precede bare
// "every N" so exec() returns the full schedule, not a truncated "every 6".
// Digit+unit intervals also yield value atoms, so atom identity catches
// unit mismatches today — the full match keeps the promotion guard's
// verbatim-corpus fallback equally honest if that coverage ever drifts.
const monitoringIntervalFigurePattern =
  /\b(?:baseline|weekly|monthly|annual(?:ly)?|every\s+\d+\s*(?:week|month|day|hour|year)s?|every\s+\d+|\d+\s*(?:week|month|day|hour|year)s?)\b/i;
const monitoringUnitRangeFigurePattern =
  /\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?\s*(?:mmol\/L|mg|micrograms?|nmol\/L|mcg)/i;

/**
 * Whether extracted fact text carries the figure/schedule the intent asks for:
 * a concrete dose value (or equivalent maximum-dose wording) for dose intent,
 * an interval/schedule token or unit-bearing level range for monitoring intent.
 * Other intents have no figure requirement and always return false.
 */
function factCarriesIntentFigure(intent: AnswerIntent, text: string) {
  return intentFigureMatchText(intent, text) !== null;
}

/** The matched figure substring for the intent, or null — lets the promotion
 * guard verify a zero-atom figure (e.g. "every 6 weeks") verbatim in the
 * claim-support corpus rather than trusting it atom-free. */
function intentFigureMatchText(intent: AnswerIntent, text: string) {
  if (intent === "dose") {
    return clinicalDoseValuePattern.exec(text)?.[0] ?? maximumDoseEquivalentPattern.exec(text)?.[0] ?? null;
  }
  if (intent === "monitoring_schedule") {
    return monitoringIntervalFigurePattern.exec(text)?.[0] ?? monitoringUnitRangeFigurePattern.exec(text)?.[0] ?? null;
  }
  return null;
}

/**
 * Whether an extractive answer's text carries the asked-for figure for a
 * figure-seeking query (dose or monitoring-schedule intent). Used by the
 * generation-fallback candidate preference in rag.ts so a safe single-chunk
 * candidate that states the requested figure wins over an equally safe
 * figure-less candidate. Non-figure intents return false, leaving the
 * existing first-safe-candidate behaviour untouched.
 */
export function extractiveAnswerCarriesIntentFigure(answerText: string, query: string, queryClass: RagQueryClass) {
  const intent = classifyAnswerIntent(query, queryClass);
  if (intent !== "dose" && intent !== "monitoring_schedule") return false;
  return factCarriesIntentFigure(intent, answerText.replace(/\*\*/g, ""));
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

/** Has explicit or equivalent maximum-dose evidence. */
export function hasMaximumDoseEvidence(text: string) {
  return explicitMaximumDosePattern.test(text) || maximumDoseEquivalentPattern.test(text);
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
  const asksForMaximumDose = intent === "dose" && /\bmax(?:imum)?\b/i.test(query);
  const maximumDoseCoverage = asksForMaximumDose && hasMaximumDoseEvidence(text);
  // Result-level twin of the sentence-level figure escape: a chunk that carries
  // the asked-for schedule/interval or unit range (a bare range table, "reviewed
  // annually" prose) is monitoring evidence even when it never says
  // monitor/level — the run-#60 miss class rejected such chunks wholesale here.
  const monitoringFigureCoverage =
    intent === "monitoring_schedule" &&
    (monitoringIntervalFigurePattern.test(text) || monitoringUnitRangeFigurePattern.test(text));
  const intentCoverage =
    answerIntentEvidencePattern(intent).test(text) || maximumDoseCoverage || monitoringFigureCoverage;
  if (!intentCoverage) return false;
  if (
    intentTokens.length > 0 &&
    !intentTokens.some((token) => queryTokenMatchesText(token, text)) &&
    !maximumDoseCoverage &&
    !monitoringFigureCoverage
  ) {
    return false;
  }
  if (intent === "red_result_action" && requiresBloodCountEvidence(query) && !hasBloodCountEvidence(text)) return false;
  if (intent === "red_result_action" && asksForWithholdAction(query) && !hasWithholdActionEvidence(text)) return false;
  if (/\brenal\b/i.test(query) && !/\b(?:renal|kidney|eGFR|creatinine)\b/i.test(text)) return false;
  if (asksForMaximumDose && !maximumDoseCoverage) {
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
const extractiveConcreteDosePattern = new RegExp(
  String.raw`\b(?:${clinicalDoseValueSource}|mmol\/l|daily|bd|tds|mane|nocte|target|range|serum|levels?|titration|titrate|titrated|adjust(?:ed|ment)?|dose\s+(?:adjust|reduc|increas)|reduce(?:d)?\s+doses?|doses?\s+(?:in|for|when|with|based|according)|max(?:imum)?|renal|eGFR|CrCl|creatinine|elderly|impairment|conventional tablets?)\b`,
  "i",
);
const extractiveMedicationEntityPattern =
  /\b(?:acamprosate|aripiprazole|baclofen|benzodiazepine|citalopram|clozapine|diazepam|disulfiram|droperidol|escitalopram|fluoxetine|haloperidol|lithium|lorazepam|naltrexone|olanzapine|promethazine|quetiapine|risperidone|sertraline|valproate)\b/gi;

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

// A short section heading ("Acute Mania:", "Day 1:", "do not use:",
// "eGFR <30:", "K+ >5.5 mmol/L:", "48-72 hours:") left standing alone by the
// bullet split. Merged into the fragment that follows it so the indication,
// schedule, or threshold context survives the minimum-length filter instead
// of being dropped — a dose or action without its day/step/threshold/time
// window is unsafe. Clinical threshold notation is too varied to enumerate
// character-by-character (comparators, electrolyte "+", degrees, micro
// signs), so any short colon-terminated fragment with alphanumeric content
// and no sentence punctuation qualifies (internal periods are decimals —
// the sentence split has already happened); structural labels ("Page 4:",
// "Table 2:") stay excluded by the stoplist and the word cap bounds it.
const shortHeadingFragmentPattern = /^[^!?;:]{2,40}:$/;

function isShortHeadingFragment(fragment: string) {
  return (
    shortHeadingFragmentPattern.test(fragment) &&
    /[A-Za-z0-9]/.test(fragment) &&
    fragment.split(/\s+/).length <= 4 &&
    !structuralHeadingStoplistPattern.test(fragment)
  );
}

/** Split clinical evidence sentences. */
export function splitClinicalEvidenceSentences(value: string) {
  const fragments = normalizeInlineBulletGlyphs(sourceTextForClinicalProsePreservingBreaks(value), { joiner: "\n" })
    .split(/\r?\n+|(?<=[.!?])\s+|\s+[•]\s+|\s+\|\s+/)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
  const merged: string[] = [];
  let pendingHeading = "";
  for (const fragment of fragments) {
    if (isShortHeadingFragment(fragment)) {
      // Sentence-case an OCR-lowercased heading ("day 1:" → "Day 1:") so the
      // merged fact reads as a sentence start rather than being discarded as
      // a mid-sentence fragment by the lowercase-start quality gate. Mixed-
      // case clinical tokens ("eGFR <30:") keep their casing — they already
      // pass that gate, and "EGFR" would corrupt the abbreviation.
      const cased = /^[a-z][a-z]/.test(fragment) ? upperFirst(fragment) : fragment;
      pendingHeading = pendingHeading ? `${pendingHeading} ${cased}` : cased;
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
  // Inflection-tolerant only (monitored/annually/LFTs): the wider panel/range
  // vocabulary must NOT move here — it would steal sentences like "Maintenance
  // range 0.6-0.8 mmol/L" from the dose arm below and change fact priorities
  // for non-monitoring intents. "review" stays exact for the same reason:
  // review\w* would reclassify dose-review sentences ("doses should be
  // reviewed daily") away from the dose arm.
  if (
    /\b(?:monitor\w*|baseline|weekly|monthly|annual(?:ly)?|every|levels?|blood tests?|ecgs?|lfts?|review)\b/i.test(text)
  ) {
    return "monitoring";
  }
  if (
    /\b(?:doses?|dosing|dosage|daily|bd|tds|mane|nocte|mmol\/l)\b/i.test(text) ||
    clinicalDoseValuePattern.test(text)
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
      if (/\bmax(?:imum)?\b/i.test(query) && !hasMaximumDoseEvidence(text)) {
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
      return monitoringScheduleEvidencePattern.test(text);
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
      return /\b(?:assess|arrange|check|collaborat\w*|complete|conduct|continue|develop|diagnos\w*|document|dose|ensure|identify|include|incorporate|involve|link|manage|monitor|provide|record|refer|revise|review\w*|risk|share|therapy|treat|update)\b/i.test(
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
  const queryMedicationEntities = medicationEntitiesInText(query);
  const sentenceMedicationEntities = medicationEntitiesInText(sentence);
  const resultMedicationEntities = medicationEntitiesInText(resultText);
  if (
    intent === "dose" &&
    queryMedicationEntities.length > 0 &&
    sentenceMedicationEntities.length === 0 &&
    resultMedicationEntities.length > 1
  ) {
    // A bare dose row from a multi-drug table cannot safely inherit the query's
    // medication/class label. Require the row itself to name its medication.
    return false;
  }
  const entityCoveredByResult =
    entityTokens.length === 0 || entityTokens.some((token) => queryTokenMatchesText(token, resultText));
  if (!entityCoveredByResult) return false;

  const normalized = normalizeSectionText(sentence).toLowerCase();
  const intentTokens = queryIntentTokens(query, intent);
  // Mirrors the dose escape below: a sentence that carries the asked-for
  // schedule/interval or unit range itself ("reviewed annually", "monitored
  // for 3 hours", "Maintenance range 0.6-0.8 mmol/L") is monitoring evidence
  // even when it names no query token — the run-#60 miss class. Figure-bearing
  // sentences only, so plain schedule-free prose still needs token coverage.
  const intentCovered =
    intentTokens.length === 0 ||
    intentTokens.some((token) => queryTokenMatchesText(token, normalized)) ||
    (intent === "dose" && extractiveConcreteDosePattern.test(normalized)) ||
    (intent === "monitoring_schedule" &&
      (monitoringIntervalFigurePattern.test(normalized) || monitoringUnitRangeFigurePattern.test(normalized)));
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
  if (/^[A-Z][A-Z0-9&+-]{1,}\b/.test(value)) return value;
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
      // "Bottom line" is intentionally rejected by the generated-answer
      // template detector. Use the neutral display heading while preserving
      // the semantic kind so deterministic facts do not fail their own gate.
      return { heading: "Key point", kind: "bottom_line" };
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

/**
 * Nuke-proofing guard for lead-slot figure promotion: only promote a fact whose
 * clinical value atoms ALL appear in the claim-support evidence corpus
 * (sourceEvidenceText) of its citing chunk(s). Fact extraction reads
 * adjacent_context and numeric verification accepts it too, but claim support
 * does not — so a figure that lives only in adjacent context would pass numeric
 * verification and then trip claim_support_high_risk_gap, nuking the whole
 * answer. Facts with no value atoms instead require their figure tokens
 * verbatim in the same corpus: schedule tokens like "baseline" or "annually"
 * match the monitoring figure pattern yet yield no atom (reviewer P2), so the
 * atom check alone would pass a figure that lives only in adjacent context and
 * claim support would then nuke.
 */
function promotedFactFigureIsClaimSupportable(
  fact: ExtractedClinicalFact,
  results: SearchResult[],
  intent: AnswerIntent,
) {
  const citingResults = results.filter((result) => fact.citationChunkIds.includes(result.id));
  if (citingResults.length === 0) return false;
  const factAtoms = extractClinicalValueAtoms(fact.text);
  if (factAtoms.length === 0) {
    const figureMatch = intentFigureMatchText(intent, fact.text);
    if (!figureMatch) return false;
    const normalizedFigure = figureMatch.toLowerCase().replace(/\s+/g, " ").trim();
    return citingResults.some((result) =>
      sourceEvidenceText(result).toLowerCase().replace(/\s+/g, " ").includes(normalizedFigure),
    );
  }
  const corpusAtomKeys = new Set(
    citingResults.flatMap((result) => extractClinicalValueAtoms(sourceEvidenceText(result)).map(clinicalValueAtomKey)),
  );
  return factAtoms.every((atom) => corpusAtomKeys.has(clinicalValueAtomKey(atom)));
}

/**
 * Lead-slot figure guarantee for dose and monitoring-schedule answers: when no
 * lead fact carries the asked-for figure/schedule but a later extracted fact
 * does (and its figure survives the claim-support guard), surface that fact in
 * the lead — dose swaps it into the last of its two lead slots; monitoring
 * appends it as a second lead sentence. A lead that already carries a figure is
 * returned unchanged, and other intents never reach this function.
 */
function promoteIntentFigureLeadFacts(
  leadFacts: ExtractedClinicalFact[],
  facts: ExtractedClinicalFact[],
  intent: AnswerIntent,
  results: SearchResult[],
) {
  if (leadFacts.some((fact) => factCarriesIntentFigure(intent, fact.text))) return leadFacts;
  const promoted = facts
    .slice(leadFacts.length)
    .find(
      (fact) =>
        factCarriesIntentFigure(intent, fact.text) && promotedFactFigureIsClaimSupportable(fact, results, intent),
    );
  if (!promoted) return leadFacts;
  return intent === "dose" ? [...leadFacts.slice(0, -1), promoted] : [...leadFacts, promoted];
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
    if (
      sourceBackedDocumentFallbackIntent(args.query, args.queryClass, args.intent, args.results) ||
      sourceBackedManagementReviewIntent(args.query, args.queryClass, args.intent, args.results)
    ) {
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

  let leadFacts = facts.slice(0, args.intent === "dose" ? 2 : 1);
  if (args.intent === "dose" || args.intent === "monitoring_schedule") {
    leadFacts = promoteIntentFigureLeadFacts(leadFacts, facts, args.intent, args.results);
  }
  // Once the lead answer names the query entity, later lead sentences skip
  // their own entity prefix so the entity is not repeated in every sentence.
  // Derived exactly the way sentenceFromFact derives its prefix entity (from
  // the query's own classification, not the routed intent) so the suppression
  // gate can never disagree with the prefix it is gating.
  const entity = queryEntityTokens(
    args.query,
    classifyAnswerIntent(args.query, classifyRagQuery(args.query).queryClass),
  )[0];
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

/** Source-backed review intent for broad medication-management evidence that cannot be safely collapsed into facts. */
function sourceBackedManagementReviewIntent(
  query: string,
  queryClass: RagQueryClass,
  intent: AnswerIntent,
  results: SearchResult[],
) {
  if (queryClass !== "medication_dose_risk" || intent !== "general" || results.length === 0) return false;
  if (!/\bpharmacological management\b/i.test(query)) return false;
  if (/\b(?:compare|contraindicat\w*|dose|dosing|frequency|monitor\w*|route|threshold|withhold)\b/i.test(query)) {
    return false;
  }
  return (
    Math.max(...results.map(scoreValue)) >= 0.45 &&
    results.some((result) => hasRelevantQueryOverlap(evidenceTextForGate(result), query, intent))
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
  const citations = compactCitations(args.results, 6, "deterministic_support").slice(0, Math.max(quoteCards.length, 1));
  const citationIds = new Set(citations.map((citation) => citation.chunk_id));
  const resultById = new Map(args.results.map((result) => [result.id, result]));
  for (const card of memoryCards) {
    for (const chunkId of card.source_chunk_ids ?? []) {
      if (citationIds.has(chunkId)) continue;
      const source = resultById.get(chunkId);
      if (!source) continue;
      citations.push(resultCitation(source, "deterministic_support"));
      citationIds.add(chunkId);
    }
  }
  for (const quote of quoteCards) {
    if (!citationIds.has(quote.chunk_id)) {
      // Guard the lookup: a quote card whose chunk_id was filtered out of results
      // would make find() return undefined and resultCitation(undefined) throw.
      const source = args.results.find((result) => result.id === quote.chunk_id);
      if (source) citations.push(resultCitation(source, "exact_quote"));
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
        citations.push(resultCitation(source, "deterministic_support"));
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
    .replace(/^what\s+(.+?)\s+should\s+((?:withhold|cease|stop)\s+.+)$/i, "$1 for the decision to $2")
    .replace(/^what\s+(.+?)\s+(?:is|are)\s+(?:used|required|recommended|needed)\s+for\s+(.+)$/i, "$1 for $2")
    .replace(/^what\s+(.+?)\s+(?:apply|applies)$/i, "$1")
    .replace(/^what\s+(.+?)\s+is\s+required$/i, "$1")
    .replace(/^what\s+does\s+(?:the\s+)?/i, "")
    .replace(/^what\s+(?:is|are)\s+(?:the\s+)?/i, "")
    .replace(/^what\s+/i, "")
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
  return `The uploaded documents contain relevant guidance on ${subject}, but a full written answer could not be completed just now. Relevant document passages are cited below — please review them directly.`;
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
  const broadDocumentCoverageRequested =
    queryClass === "document_lookup" &&
    /(?:\b(?:what|which)\b.{0,100}\b(?:include|included|require|required|requirements?)\b|\b(?:process|procedure)\b|\bhow\b.{0,80}\b(?:handled|managed|performed|completed)\b)/i.test(
      query,
    );
  const distinctAvailableSources = new Set((answer.sources ?? []).map((source) => source.id)).size;
  if (broadDocumentCoverageRequested && distinctAvailableSources >= 2 && answer.citations.length < 2) {
    return "insufficient_broad_citation_coverage";
  }
  if (isUnusableGeneratedAnswer(answer)) return "unusable_generated_answer";
  if (isTemplateLikeGeneratedAnswer(answer)) return "template_like_answer";
  if (isOverExpandedSimpleGeneratedAnswer(query, queryClass, answer)) return "overexpanded_simple_answer";
  return null;
}

/**
 * Whether an extractive fallback candidate is safe to ship in place of a failed
 * generation: grounded and supported, clean of every final answer-quality gate,
 * and numerically verified with zero unverified tokens. Pure — extracted from
 * the rag.ts generation-fallback path so candidate selection stays testable in
 * isolation.
 */
export function isSafeExtractiveFallbackCandidate(candidate: RagAnswer, query: string, queryClass: RagQueryClass) {
  if (!candidate.grounded || candidate.confidence === "unsupported") return false;
  if (generatedAnswerQualityFailureReason(candidate, query, queryClass)) return false;
  const verified = applyNumericVerification(cloneAnswer(candidate));
  return (
    verified.grounded && verified.confidence !== "unsupported" && (verified.unverifiedNumericTokens?.length ?? 0) === 0
  );
}

/**
 * Narrows a fallback candidate's sources to the chunks its citations actually
 * reference, so downstream claim support and numeric verification judge the
 * candidate on exactly the evidence it cites. Pure — extracted from the rag.ts
 * generation-fallback path.
 */
export function retainCitedExtractiveFallbackEvidence<T extends RagAnswer>(candidate: T): T {
  const citedChunkIds = new Set(candidate.citations.map((citation) => citation.chunk_id));
  return {
    ...candidate,
    sources: candidate.sources.filter((source) => citedChunkIds.has(source.id)),
  };
}

/**
 * Replaces an answer that fails final quality checks with an evidence-gap response.
 *
 * @param answer - The answer to replace.
 * @param query - The original user query.
 * @param queryClass - The classified query type.
 * @param reason - The quality gate failure reason.
 * @returns The answer marked as unsupported and requiring an evidence gap response.
 */
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

// A "bare cross-reference" answer redirects the reader to another named document for the real
// content — e.g. "Refer to the RKPG Guidelines to Writing for Clinical Policy for further
// information about Scope of Practice." It answers nothing itself, so it must never be rescued by
// the source-backed recovery gate on the strength of structured-chunk signals in the *cited*
// sources. The guard is deliberately narrow — it fires only when the lead sentence is a pointer
// (directive) AND a "for further information"-style redirect AND names a document-style object — so
// it leaves untouched both the terse paraphrases the recovery gate legitimately exists for (e.g.
// "Depot antipsychotic follow-up is covered by the cited local pathway.", no redirect clause) and
// passive clinical referral facts (e.g. "Patients are referred to the community team for further
// information and support.", which point at a service, not a document).
const crossReferenceDirectivePattern =
  /\b(?:refer(?:red|s|ring)?\s+to|(?:please\s+)?see|consult|as\s+(?:per|outlined|described|detailed|set\s+out))\b/i;
const crossReferenceRedirectPattern =
  /\bfor\s+(?:further|more|additional|detailed|complete|full)\s+(?:information|detail|details|guidance|advice|reading|instruction|instructions)\b/i;
const crossReferenceDocumentObjectPattern =
  /\b(?:guidance|guidelines?|policy|policies|procedures?|protocols?|appendix|appendices|manuals?|documents?|documentation|frameworks?|standards?|sops?|handbooks?|factsheets?|leaflets?|booklets?|templates?|checklists?|forms?|sections?|chapters?)\b/i;

/**
 * Determines whether text consists of a bare redirect to another source for additional information.
 *
 * @param text - The answer text to evaluate
 * @returns `true` if the lead sentence directs the reader to another document or source for further information, `false` otherwise.
 */
export function isBareCrossReferenceAnswer(text: string) {
  const lead = firstSentence(text).replace(/\*\*/g, "");
  if (!lead) return false;
  return (
    crossReferenceDirectivePattern.test(lead) &&
    crossReferenceRedirectPattern.test(lead) &&
    crossReferenceDocumentObjectPattern.test(lead)
  );
}

/**
 * Determines whether a source-backed generated answer may bypass a quality-gate failure.
 *
 * @param answer - The generated answer and its source-selection metadata
 * @param reason - The quality-gate failure reason
 * @param cleanedAnswer - The sanitized answer text used for cross-reference detection
 * @returns `true` if the answer is grounded and supported by relevant source-selection signals, `false` otherwise
 */
function shouldPreserveSourceBackedGeneratedAnswer(answer: RagAnswer, reason: string, cleanedAnswer: string) {
  if (reason !== "missing_query_intent" && reason !== "missing_query_overlap") return false;
  // Never rescue a bare cross-reference / "refer elsewhere for more information" pointer: it carries
  // no responsive content, and (being here) already shares no query terms, so preserving it would
  // ship an off-topic redirect as a grounded clinical answer. Evaluate the same sanitized text the
  // quality gate judged, so a stripped leading noise fragment can't hide the redirect lead.
  if (isBareCrossReferenceAnswer(cleanedAnswer)) return false;
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
export function finalizeRagAnswerQuality(
  answer: RagAnswer,
  query: string,
  queryClass: RagQueryClass,
  verificationSources?: SearchResult[],
): RagAnswer {
  const qualityChecked = finalizeRagAnswerQualityCore(answer, query, queryClass);
  return applyProviderLabels(
    applyNumericVerification(assessAndEnforceClaimSupport(qualityChecked), verificationSources),
  );
}

/**
 * Finalizes answer prose by applying textual quality gates and sanitizing content.
 *
 * @param answer - The answer to validate and finalize
 * @param query - The user query used to assess relevance and highlight clinical terms
 * @param queryClass - The classification of the user query
 * @returns The finalized RAG answer with validated content, sections, and confidence metadata
 */
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
    if (shouldPreserveSourceBackedGeneratedAnswer(answer, qualityFailureReason, cleanedAnswer)) {
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

  return {
    ...answer,
    answer: boldHighYieldClinicalText(cleanedAnswer, query),
    answerSections,
  };
}
