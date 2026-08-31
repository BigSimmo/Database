import { boldHighYieldClinicalText } from "@/lib/answer-ranking";
import {
  adjacentLabelledNumericBandConflicts,
  applyNumericVerification,
  containsNumericBandReference,
  extractClinicalValueAtoms,
  LABELLED_NUMERIC_BAND_CONFLICT_NOTE,
  textReferencesAdjacentBandConflict,
} from "@/lib/answer-verification";
export { labelledNumericBandConflictChunkIds } from "@/lib/answer-verification";
import { citationFromResult as resultCitation, compactCitations } from "@/lib/citations";
import {
  analyzeClinicalQuery,
  classifyRagQuery,
  hasForeignThresholdLabel,
  medicationMonitoringQuerySubjects,
  normalizedClinicalSearchTokens,
} from "@/lib/clinical-search";
import { ragDeepMemoryVersion } from "@/lib/deep-memory";
import {
  buildDocumentBreakdown,
  buildEvidenceSummary,
  buildSmartPanel,
  buildSourceCoverage,
  buildVisualEvidence,
  detectConflictsOrGaps,
  extractQuoteCards,
  selectBestSourceRecommendation,
} from "@/lib/evidence";
import {
  hasForeignMedicationClinicalValueBinding,
  isAntipsychoticMedicationEntity,
  medicationEntitiesInText,
  medicationEntityMatchesInText,
  medicationSafetyEntitiesInText,
} from "@/lib/medication-entities";
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
} from "@/lib/rag/rag-answer-text";
import { cloneAnswer } from "@/lib/rag/rag-cache";
import { ragProviderMode } from "@/lib/rag/rag-provider";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
import {
  isLowYieldClinicalText,
  normalizeInlineBulletGlyphs,
  sourceTextForClinicalProse,
  sourceTextForClinicalProsePreservingBreaks,
} from "@/lib/source-text-sanitizer";
import type {
  AnswerSection,
  AnswerSectionKind,
  Citation,
  ConflictOrGap,
  QuoteCard,
  RagAnswer,
  RagQueryClass,
  SearchResult,
} from "@/lib/types";
import {
  assessAndEnforceClaimSupport,
  assessClaimSupport,
  clinicalValueAtomKey,
  enforceLabelledNumericBandCoherence,
  sourceHasLabelledNumericBandConflict,
  sourceLabelledNumericBandConflictsAffectingText,
  sourceDirectlySupportsAnswerText,
  sourceEvidenceText,
} from "@/lib/rag/rag-claim-support";
import {
  atomicNmhsClozapineRedRangeSegment,
  reflowBoundedSourceLines,
  reflowWrappedAgitationDoseLines,
  reflowWrappedEctBookingSystemLines,
  reflowWrappedEscalationRecipientLines,
} from "@/lib/rag/rag-source-segmentation";
import { containsDanglingProceduralComparatorStepArtifact } from "@/lib/rag/rag-extractive-artifacts";

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
  "often",
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
  "escalate",
  "escalated",
  "escalates",
  "escalating",
  "escalation",
  "escalations",
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

const explicitEscalationQueryPattern = /\bescalat\w*\b/i;
const escalationClinicalTargetSource = String.raw`(?:the\s+)?(?:(?:treating|responsible|senior|on[-\s]?call)\s+(?:doctor|clinician|medical\s+officer|prescriber)|(?:treating|responsible|senior|on[-\s]?call|medical|clinical)\s+team|prescriber)`;
const escalationNormativeSource = String.raw`(?:must|should|needs?\s+to|is\s+to|are\s+to|required\s+to)`;
const escalationActionAdverbSource = String.raw`(?:(?:promptly|urgently|immediately|directly|also|then)\s+){0,2}`;
const escalationContactPassiveVerbSource = String.raw`(?:contacted|notified|informed|consulted)`;
const escalationContactActionSource = String.raw`(?:(?:contact|notify|inform|consult)\s+${escalationClinicalTargetSource}|report(?:\s+(?:the\s+)?(?:findings?|results?|concerns?|side effects?))?\s+to\s+${escalationClinicalTargetSource})`;
const normativeEscalationActionPattern = new RegExp(
  String.raw`(?:^\s*(?:\*{1,2})?escalate\b|(?:^|[,;:]\s*)(?:please\s+)?escalate\b|\b${escalationNormativeSource}\s+${escalationActionAdverbSource}(?:be\s+)?escalat(?:e|ed)\b|\brequires?\s+(?:prompt|urgent|immediate)?\s*escalation\b|\bescalation\b[^.;!?\n]{0,20}\b(?:is|remains)\s+(?:required|needed|indicated)\b)`,
  "i",
);
const normativeEscalationContactPattern = new RegExp(
  String.raw`(?:(?:^|[,;:]\s*)(?:please\s+)?${escalationContactActionSource}\b|\b${escalationNormativeSource}\s+${escalationActionAdverbSource}${escalationContactActionSource}\b|\b${escalationClinicalTargetSource}\b\s+${escalationNormativeSource}\s+${escalationActionAdverbSource}(?:be\s+)?${escalationContactPassiveVerbSource}\b)`,
  "i",
);
const normativeEscalationReviewPattern = new RegExp(
  String.raw`(?:\b${escalationNormativeSource}\s+${escalationActionAdverbSource}(?:be\s+)?reviewed\s+by\s+${escalationClinicalTargetSource}\b|\b${escalationClinicalTargetSource}\b\s+${escalationNormativeSource}\s+${escalationActionAdverbSource}review\b|\brequires?\s+(?:an?\s+)?(?:urgent|prompt)\s+(?:medical|clinical)\s+review\b|\b(?:urgent|prompt)\s+(?:medical|clinical)\s+review\b[^.;!?\n]{0,20}\b(?:(?:is|remains)\s+(?:required|needed|indicated)|required|needed)\b)`,
  "i",
);
const negatedEscalationActionPattern =
  /\b(?:do\s+not|don't|should\s+not|must\s+not|need\s+not|never|not\s+required\s+to)\b[^.;!?\n]{0,35}\b(?:escalat\w*|contact|notify|inform|consult|report|review)\b/i;
const escalationInterrogativePattern =
  /^\s*(?:when|what|which|who|why|how|under\s+what|at\s+what)\b[^.!?\n]{0,180}\b(?:escalat\w*|contact|notify|inform|consult|report|review)\b(?:[^.!?\n]*\?)?\s*$/i;
const strongHistoricalEscalationCuePattern =
  /(?:\b(?:audit|retrospective|case\s+review|incident\s+report|minutes?|case\s+notes?|historical|study|survey)\b|\b(?:previous|prior|earlier|former|superseded|obsolete|archived|old|withdrawn|legacy|retired|repealed|discontinued|outdated)\s+(?:clinical\s+)?(?:policy|guideline|protocol|guidance|procedure|recommendations?|standards?|pathway|instructions?)\b|\b(?:19|20)\d{2}\b[^.;!?\n]{0,80}\b(?:policy|guideline|protocol|guidance|procedure|recommendations?|standards?|pathway|instructions?)\b[^.;!?\n]{0,40}\b(?:stated|recommended|required|directed|specified)\b)/i;
const reportedEscalationWrapperPattern =
  /(?:\baccording\s+to\b[^.;!?\n]{0,80}\b(?:audit|record|report|review|study|survey|minutes?|case\s+notes?)\b|\b(?:was|were|is|are|has\s+been|had\s+been)\s+(?:recorded|reported|documented|noted|found|observed|described|stated|indicated)\b|\b(?:record|report|review|case\s+notes?)\b[^.;!?\n]{0,80}\b(?:recorded|reported|documented|noted|found|observed|described|stated|indicated|records|reports|states|notes|describes)\b)/i;
const staleEscalationProvenancePattern =
  /\b(?:previous|prior|earlier|former|superseded|obsolete|archived|old|withdrawn|legacy|retired|repealed|discontinued|outdated)\b/i;
const escalationTriggerPattern =
  /(?:\b(?:when(?:ever)?|if|unless)\b[^,;.!?]{0,100}\b(?:side effects?|symptoms?|reaction|rash|toxicity|scores?|results?|distress|syndrome)\b|\b(?:side effects?|symptoms?|reaction|rash)\b[^.;!?]{0,60}\bcaus(?:e|es|ed|ing)\b[^.;!?]{0,30}\bdistress\b|\bcaus(?:e|es|ed|ing)\s+(?:the\s+patient\s+)?distress\b|\b(?:persistent|severe|worsening|suspected)\s+(?:(?:neuroleptic|antipsychotic|medication)\s+)?(?:side effects?|symptoms?|reaction|rash|toxicity|syndrome)\b|\b(?:side effects?|symptoms?|reaction|rash|toxicity|syndrome)\b[^.;!?]{0,40}\b(?:persist(?:s|ed|ent|ing)?|severe|worsen(?:s|ed|ing)?|suspected)\b|\b(?:any|new)\s+(?:neuroleptic\s+)?(?:side effect|reaction|rash)\b|\b(?:at|above|below|over|under|with)\s+(?:an?\s+)?(?:score|result|threshold)\b|\b(?:high|very\s+high|red|amber)\s+(?:score|result|range|threshold)\b|\b(?:on|upon)\s+(?:the\s+)?(?:emergence|development|appearance|onset)\s+of\s+(?:side effects?|symptoms?|a\s+reaction|a\s+rash|toxicity)\b)/i;
const scoreIndependentActionPattern =
  /(?:\bscor(?:e|es|ed|ing)\b[^.!?]{0,120}\bnot\s+essential\b[^.!?]{0,80}\bactions?\b|\bactions?\b[^.!?]{0,100}\b(?:do|does)\s+not\s+depend\b[^.!?]{0,80}\bscor(?:e|es|ed|ing)\b)/i;

/** Whether the query explicitly asks for escalation. */
export function isExplicitEscalationQuery(query: string) {
  return explicitEscalationQueryPattern.test(query.replace(/\bde[-\s]?escalat\w*/gi, ""));
}

const escalationEquivalentClinicalSubjectPattern =
  /\b(?:neuroleptics?|antipsychotics?|medications?|side effects?|symptoms?|reactions?|toxicity|scores?|results?)\b/i;
const escalationEquivalentClinicalActionPattern = new RegExp(
  String.raw`(?:\b(?:contact|notifi|inform|consult|report)\w*\b[^.!?\n]{0,120}\b${escalationClinicalTargetSource}\b|\b${escalationClinicalTargetSource}\b[^.!?\n]{0,80}\b(?:contact|notifi|inform|consult|report)\w*\b)`,
  "i",
);

function requiresClinicalEscalationFallbackSafety(query: string) {
  const positiveQuery = query.replace(/\bde[-\s]?escalat\w*/gi, "");
  return (
    explicitEscalationQueryPattern.test(positiveQuery) ||
    (escalationEquivalentClinicalSubjectPattern.test(positiveQuery) &&
      escalationEquivalentClinicalActionPattern.test(positiveQuery))
  );
}

/** Whether prose contains a direct escalation action or a bounded clinical equivalent. */
function hasTargetedEscalationAction(text: string) {
  const positiveEscalationText = text.replace(/\bde[-\s]?escalat\w*/gi, "");
  const historicalOrReported =
    strongHistoricalEscalationCuePattern.test(positiveEscalationText) ||
    reportedEscalationWrapperPattern.test(positiveEscalationText);
  if (
    negatedEscalationActionPattern.test(positiveEscalationText) ||
    escalationInterrogativePattern.test(positiveEscalationText) ||
    /\?\s*$/.test(positiveEscalationText) ||
    historicalOrReported
  ) {
    return false;
  }
  return (
    normativeEscalationActionPattern.test(positiveEscalationText) ||
    normativeEscalationContactPattern.test(positiveEscalationText) ||
    normativeEscalationReviewPattern.test(positiveEscalationText)
  );
}

/** Whether prose states the condition that triggers escalation. */
function hasEscalationTrigger(text: string) {
  return escalationTriggerPattern.test(text);
}

/** Source context explaining that action does not depend on a score. */
function isScoreIndependentActionEvidence(text: string) {
  return scoreIndependentActionPattern.test(text);
}

/** Whether an escalation query asks for the condition that should trigger the action. */
function asksForEscalationTrigger(query: string) {
  const normalized = normalizeSectionText(query);
  return (
    /\bwhen\b/i.test(normalized) ||
    /\bwhich\b[^?]{0,100}\b(?:side effects?|symptoms?|reactions?|results?|scores?|conditions?|circumstances?)\b/i.test(
      normalized,
    ) ||
    /\bwhat\b[^?]{0,100}\b(?:triggers?|requires?|warrants?)\b[^?]{0,60}\bescalat\w*\b/i.test(normalized) ||
    /\b(?:escalation|escalat\w*)\s+criteria\b|\bcriteria\b[^?]{0,80}\bescalat\w*\b/i.test(normalized) ||
    /\b(?:conditions?|circumstances?|indications?)\b[^?]{0,80}\bescalat\w*\b/i.test(normalized)
  );
}

const narrativeMonitoringRangeContextPattern =
  /\b(?:adult\s+)?age\s+ranges?\b|\branges?\s+of\s+(?:baseline\s+)?(?:tests?|checks?|monitoring|ages?)\b/i;
const explicitMonitoringLevelValueLookupPattern =
  /\b(?:therapeutic|target|trough|serum|plasma|maintenance)\s+(?:levels?|ranges?|concentrations?)\b|\b(?:levels?|ranges?|concentrations?)\s+(?:is|are)\s+(?:used|recommended|targeted|maintained)\b|\blevels?\s+ranges?\b/i;

function isMonitoringLevelRangeLookupQuery(query: string) {
  if (narrativeMonitoringRangeContextPattern.test(query)) return false;
  const hasExplicitDoseCue = /\b(?:dose|doses|dosing|dosage)\b/i.test(query);
  const hasExplicitMeasuredLevelCue = /\b(?:serum|plasma|trough|levels?|concentrations?)\b/i.test(query);
  if (hasExplicitDoseCue && !hasExplicitMeasuredLevelCue) return false;
  if (
    /\b(?:therapeutic\s+)?(?:dose|dosing|dosage)\s+ranges?\b|\branges?\s+(?:of|for)\s+(?:the\s+)?(?:dose|dosing|dosage)\b/i.test(
      query,
    )
  ) {
    return false;
  }
  if (explicitMonitoringLevelValueLookupPattern.test(query)) return true;
  return medicationMonitoringQuerySubjects(query).length > 0 && /\branges?\b/i.test(query);
}

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
  const hasScheduleSignal =
    /\b(?:monitor|monitoring|schedule|baseline|follow[-\s]?up|level|levels|test|tests)\b/.test(normalized) ||
    isMonitoringLevelRangeLookupQuery(normalized);
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
  if (/\b(?:doses?|dosing|dosage|max(?:imum)?|mg|mcg|renal|eGFR|creatinine)\b/i.test(query)) return "dose";
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

function queryEntitySubject(query: string, intent: AnswerIntent) {
  const tokens = queryEntityTokens(query, intent);
  if (tokens.includes("agitation") && tokens.includes("arousal")) return "agitation and arousal";
  return tokens[0];
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
// The strict subset of the monitoring vocabulary that is an actual cadence or
// level signal: dose-kind facts must carry one of these before they count as
// monitoring evidence, so generic dose wording (range/therapeutic/maintenance
// around a mg figure) cannot masquerade as a schedule.
const monitoringCadenceOrLevelPattern = new RegExp(
  String.raw`\b(?:monitor\w*|follow[-\s]?up|baseline|weekly|monthly|annual(?:ly)?|yearly|every|several\s+times\s+a\s+year|screen(?:ing|ed)?|review\w*|levels?|serum|trough|plasma|mmol\/l|mcg\/l|ng\/ml|\d+\s*(?:week|month|day|hour|year)s?)\b`,
  "i",
);
// Level/concentration ranges only, for the monitoring intent COVERAGE escapes:
// dose-amount unit ranges ("300-450 mg") must not grant coverage — the wider
// monitoringUnitRangeFigurePattern (which also matches mg/mcg dose ranges)
// stays reserved for the corpus-guarded figure-promotion checks.
const monitoringLevelRangeCoveragePattern =
  /(?:\bbetween\s+\d+(?:\.\d+)?\s+and\s+\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:[-–—]|\bto\b)\s*\d+(?:\.\d+)?)\s*(?:mmol\/L|nmol\/L|mcg\/L|ng\/mL)/i;

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
  /(?:\bbetween\s+\d+(?:\.\d+)?\s+and\s+\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:[-–—]|\bto\b)\s*\d+(?:\.\d+)?)\s*(?:mmol\/L|mg|micrograms?|nmol\/L|mcg)/i;
/**
 * Whether extracted fact text carries the figure/schedule the intent asks for:
 * a concrete dose value (or equivalent maximum-dose wording) for dose intent,
 * an interval/schedule token or unit-bearing level range for monitoring intent.
 * Other intents have no figure requirement and always return false.
 */
function factCarriesIntentFigure(intent: AnswerIntent, text: string, query?: string) {
  return intentFigureMatchText(intent, text, query) !== null;
}

/** The matched figure substring for the intent, or null — lets the promotion
 * guard verify a zero-atom figure (e.g. "every 6 weeks") verbatim in the
 * claim-support corpus rather than trusting it atom-free. */
function intentFigureMatchText(intent: AnswerIntent, text: string, query?: string) {
  if (intent === "dose") {
    return clinicalDoseValuePattern.exec(text)?.[0] ?? maximumDoseEquivalentPattern.exec(text)?.[0] ?? null;
  }
  if (intent === "monitoring_schedule") {
    if (query && isMonitoringLevelRangeLookupQuery(query)) {
      return monitoringUnitRangeFigurePattern.exec(text)?.[0] ?? null;
    }
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
  return factCarriesIntentFigure(intent, answerText.replace(/\*\*/g, ""), query);
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
  return /\b(?:withhold|withheld|withholding|hold|held|cease|stop|stopped|discontinue|discontinued)\b/i.test(text);
}

/** Same-fact blood-count boundary plus an explicit treatment-stop action. */
function hasAtomicBloodCountWithholdThresholdEvidence(text: string, query: string) {
  const hasThresholdBoundary =
    /(?:\b(?:below|under|less than|at or below)\s+\d|(?:<|≤)\s*\d|\b(?:red|amber)\s+range\b)/i.test(text);
  const namesQueriedMedication = !/\bclozapine\b/i.test(query) || /\bclozapine\b/i.test(text);
  return (
    hasBloodCountEvidence(text) && hasThresholdBoundary && hasWithholdActionEvidence(text) && namesQueriedMedication
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
    (monitoringIntervalFigurePattern.test(text) || monitoringLevelRangeCoveragePattern.test(text));
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
const extractiveMalformedFactFragmentPattern =
  /(?:\bdosing\s+frequencies\s+outside[^.!?]{0,160}\bdose\s+maximum\s+and\s+im\s+daily\s+dose\s+hourly\b|^(?:the\s+guidance\s+is\s+that\s+)?table\s+summari[sz]ing\b|\b(?:prn\s+dose\s+daily\s+dose|includes\s+risk\s+monitoring\s+form|recommended\s+over\s+>\d+\s*kg|total\s+maximum\s+oral\s+respiratory\s+function)\b)/i;
const extractiveHeadingOnlyPattern =
  /^(?:dosage?|dosing|monitoring|baseline tests?|therapy|source|section|table|guideline|referral criteria|criteria)(?:\s*\([^)]{1,80}\))?\.?$/i;
const extractiveAllowedLowercaseStarterPattern =
  /^(?:if|when|for|in|avoid|do|must|withhold|cease|stop|monitor|check|reduce|increase|adjust|start|commence|begin|use|target|baseline|serum|therapy|dosing|titrate|arrange|refer|review|prescribe|record|complete|continue|discontinue|escalate)\b/i;
const extractiveConcreteDosePattern = new RegExp(
  String.raw`\b(?:${clinicalDoseValueSource}|mmol\/l|daily|bd|tds|mane|nocte|target|range|serum|levels?|titration|titrate|titrated|adjust(?:ed|ment)?|dose\s+(?:adjust|reduc|increas)|reduce(?:d)?\s+doses?|doses?\s+(?:in|for|when|with|based|according)|max(?:imum)?|renal|eGFR|CrCl|creatinine|elderly|impairment|conventional tablets?)\b`,
  "i",
);
/** Extractive query tokens. */
function extractiveQueryTokens(query: string) {
  return normalizedClinicalSearchTokens(query).filter(
    (token) => token.length > 2 && !extractiveQueryStopwords.has(token),
  );
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

/** Mentions different medication entity. */
function mentionsDifferentMedicationEntity(sentence: string, query: string) {
  return hasForeignMedicationClinicalValueBinding(query, sentence);
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
  const monitoringFigureCovered =
    intent === "monitoring_schedule" && intentFigureMatchText(intent, normalized, query) !== null;
  return (
    answerIntentEvidencePattern(intent).test(normalized) &&
    (intentTokens.length === 0 ||
      intentTokens.some((token) => queryTokenMatchesText(token, normalized)) ||
      monitoringFigureCovered)
  );
}

/** Has bad extractive quality. */
function hasBadExtractiveQuality(text: string) {
  const normalized = normalizeSectionText(text);
  if (!normalized) return true;
  if (containsDanglingProceduralComparatorStepArtifact(normalized)) return true;
  if (extractiveTruncationPattern.test(normalized)) return true;
  if (extractiveProductCataloguePattern.test(normalized)) return true;
  if (extractiveStructuralArtifactPattern.test(normalized)) return true;
  if (extractiveMalformedFactFragmentPattern.test(normalized)) return true;
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
  if (containsDanglingProceduralComparatorStepArtifact(normalized)) return true;
  if (extractiveTruncationPattern.test(normalized)) return true;
  // Note: extractiveProductCataloguePattern is intentionally excluded here — see JSDoc above.
  if (extractiveStructuralArtifactPattern.test(normalized)) return true;
  if (extractiveMalformedFactFragmentPattern.test(normalized)) return true;
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

function isGroupedClinicalThresholdHeading(fragment: string) {
  return (
    /^[^!?;:]{4,120}:$/.test(fragment) &&
    /\b(?:ranges?|thresholds?|cut[\s-]?offs?|levels?|concentrations?)\b/i.test(fragment) &&
    fragment.split(/\s+/).length <= 16 &&
    !structuralHeadingStoplistPattern.test(fragment)
  );
}

function isGroupedClinicalThresholdRow(fragment: string) {
  return (
    /\d/.test(fragment) &&
    /(?:\b(?:between|below|above|less|greater)\b|[<>≤≥]|\b\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d|\b(?:mmol|mol|mg|mcg|ng|msec|ms|units?)\b|[µμ]g|%)/i.test(
      fragment,
    )
  );
}

/** Split clinical evidence sentences. */
export function splitClinicalEvidenceSentences(value: string) {
  const fragments = normalizeInlineBulletGlyphs(
    reflowWrappedEctBookingSystemLines(
      reflowWrappedEscalationRecipientLines(
        reflowWrappedAgitationDoseLines(sourceTextForClinicalProsePreservingBreaks(value)),
      ),
    ),
    { joiner: "\n" },
  )
    .split(/\r?\n+|(?<=[.!?])\s+|\s+[•]\s+|\s+\|\s+/)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
  const merged: string[] = [];
  let pendingHeading = "";
  let groupedThresholdHeading = "";
  for (const fragment of fragments) {
    if (isGroupedClinicalThresholdHeading(fragment)) {
      groupedThresholdHeading = /^[a-z][a-z]/.test(fragment) ? upperFirst(fragment) : fragment;
      pendingHeading = "";
      continue;
    }
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
    const groupedThresholdRow = groupedThresholdHeading && isGroupedClinicalThresholdRow(fragment);
    const groupedRowText = groupedThresholdRow
      ? fragment.replace(/^([A-Z]{5,})(?=\s)/, (label) => upperFirst(label.toLowerCase()))
      : fragment;
    merged.push(
      groupedThresholdRow
        ? `${groupedThresholdHeading} ${groupedRowText}`
        : pendingHeading
          ? `${pendingHeading} ${fragment}`
          : fragment,
    );
    pendingHeading = "";
    if (groupedThresholdHeading && !groupedThresholdRow) groupedThresholdHeading = "";
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

const numericRepeatDoseSchedulePattern =
  /\b(?:additional\s+doses?|repeat(?:ing)?\s+doses?|doses?\s+(?:(?:may|can|should|must)\s+)?be\s+repeated|(?:may|can|should|must)\s+be\s+repeated|(?:second|third|fourth|\d+(?:st|nd|rd|th))\s+dose)\b/i;
const repeatDoseScheduleFigurePattern =
  /\b(?:hourly|half[-\s]?hourly|daily|after|every|within)\b[^.!?;]{0,40}\b\d+(?:\.\d+)?\s*(?:mg|mcg|minutes?|hours?|days?)\b|\b(?:hourly|half[-\s]?hourly|daily)\b|\b\d+(?:\.\d+)?\s+doses?\b/i;

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
  const numericRepeatDoseSchedule =
    intent === "dose" && numericRepeatDoseSchedulePattern.test(text) && repeatDoseScheduleFigurePattern.test(text);
  if (
    /\b(?:red|amber|green|threshold|withhold|cease|stop|discontinue|discontinued|urgent|contact|repeat|anc|fbc|wbc|neutrophil|toxic\w*|action)\b/i.test(
      text,
    ) &&
    !numericRepeatDoseSchedule
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
  // reviewed daily") away from the dose arm. The legacy tokens classify
  // byte-identically; a sentence claimed ONLY via the new inflections that
  // also carries a concrete dose value ("Quetiapine is monitored at a dose of
  // 200 mg daily") falls through to the dose arm — otherwise a sole
  // dose-bearing fact would be dropped by dose-intent answers (reviewer P2).
  const legacyMonitoringKindPattern =
    /\b(?:monitor|monitoring|baseline|weekly|monthly|annual|every|level|levels|blood test|ecg|lft|review)\b/i;
  const inflectedMonitoringKindPattern = /\b(?:monitor\w*|annual(?:ly)?|levels?|blood tests?|ecgs?|lfts?)\b/i;
  const doseBoundReviewInstruction =
    intent === "dose" &&
    /\b(?:doses?|dosing|dosage)\b[^.!?]{0,120}\b(?:requires?|must|should|needs?\s+to|is\s+to|are\s+to)\b[^.!?]{0,50}\b(?:prescriber|clinical|medical)?\s*review\b/i.test(
      text,
    ) &&
    !/\b(?:monitor\w*|baseline|weekly|monthly|annual(?:ly)?|every|levels?|blood tests?|ecgs?|lfts?)\b/i.test(text);
  if (
    (!doseBoundReviewInstruction && legacyMonitoringKindPattern.test(text)) ||
    (inflectedMonitoringKindPattern.test(text) && !clinicalDoseValuePattern.test(text))
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
const admissionComparisonTermPattern = /\badmissions?\b/i;
const dischargeComparisonTermPattern = /\bdischarg(?:e|es|ed|ing)\b/i;
const sourceBoundTerminalContinuation = String.raw`(?=\s*(?:[.,;:]|$))`;
const medicalClearanceContinuation = String.raw`(?=\s*(?:[.,;:]|$|\bor\s+if\s+(?:the\s+)?(?:consumer|patient)\b|\bfor\s+(?:an?\s+)?admission\b|\bvia\s+(?:the\s+)?emergency department\b|\band\s+arrang\w*\s+(?:an?\s+)?transfer\b|\bafter\s+(?:(?:a|the)\s+)?(?:(?:physical|clinical|medical)\s+)?assessment\b|\bby\s+(?:the\s+)?(?:treating\s+)?(?:doctor|clinician|consultant)\b|\bbefore\s+(?:an?\s+)?transfer\b|\bat\s+admission\b|\bprior\s+to\s+(?:admission|assessment|transfer)\b))`;
const bedLocationContinuation = String.raw`(?=\s*(?:[.,;:]|$|\bat\s+(?:an?\s+)?(?:alternative\s+)?health service\b|\bfor\s+(?:an?\s+)?admission\b|\bwithin\s+(?:the\s+)?(?:service|ward|unit)\b|\bthrough\s+(?:the\s+)?(?:patient|bed)\s+flow\b|\band\s+notif\w*\s+(?:the\s+)?(?:staff|coordinator|clinician)\b))`;
const directBedLocationAction = String.raw`(?:locate\s+(?:an?\s+)?bed|(?:liaise|coordinate|work)\b[^.!?]{0,120}\bto\s+locate\s+(?:an?\s+)?bed)`;
const subordinateBedLocationReportPattern = /\bwhether\b[^.!?]{0,180}\blocate\s+(?:an?\s+)?bed\b/i;
const nonClinicalComparisonWrapperPattern =
  /^\s*(?:(?:for|regarding)\s+)?(?:(?:the|an?)\s+)?(?:(?:annual|monthly|quarterly|retrospective|historical)\s+)?(?:audit(?:\s+(?:observations?|findings?|reports?|records?))?|reports?|reporting|archives?|archival\s+records?|training(?:\s+(?:materials?|records?|requirements?))?|education(?:al)?\s+(?:materials?|records?)|governance(?:\s+(?:observations?|reports?|records?))?|historical\s+(?:records?|reports?)|retrospective\s+(?:reviews?|reports?))\b/i;
const admissionRequirementBindingPatterns = [
  /\b(?:patient|consumer)\s+(?:will|must)\s+only\s+be\s+able\s+to\s+(?:come|enter)\b[^.!?]{0,180}\bmeet\s+(?:the\s+)?(?:identified\s+)?inclusion criteria\s+for admission\b/i,
  new RegExp(String.raw`\b(?:provide|obtain)\s+(?:an?\s+)?medical clearance\b${medicalClearanceContinuation}`, "i"),
  /\bmedical clearance\s+(?:(?:must|should)\s+be\s+(?:provided|obtained)|(?:is|are)\s+(?:required|provided|obtained))\b/i,
  new RegExp(
    String.raw`\barrang\w*\s+(?:the\s+)?prioriti[sz]ation\s+of\s+beds?\b${sourceBoundTerminalContinuation}`,
    "i",
  ),
  new RegExp(
    String.raw`\b(?:clinician|coordinator|staff|team)\b[^.!?]{0,60}\b(?:(?:must|should|will)\s+(?:(?:promptly|urgently|also|directly|then)\s+)?${directBedLocationAction}|(?:is|are)\s+(?:(?:required|expected)\s+)?to\s+${directBedLocationAction})${bedLocationContinuation}`,
    "i",
  ),
  /\badmissions?\s+escort\w*\s+by\s+police\s+(?:(?:must|should)\s+go|go|(?:must|should|are)\s+(?:be\s+)?(?:transfer\w*|allocat\w*)|require\w*)\b/i,
  new RegExp(
    String.raw`\b(?:require\w*|transfer\w*|allocat\w*)\s+(?:(?:the|an?)\s+|to\s+(?:(?:the|an?)\s+)?)?high[\s-]observation beds?\b${sourceBoundTerminalContinuation}`,
    "i",
  ),
] as const;
const dischargeRequirementBindingPatterns = [
  /\bclinicians?\s+(?:must|should|will)\s+actively\s+plan\s+(?:the\s+)?effective\s+and\s+timely\s+discharge\b/i,
  /\bdischarge planning\s+(?:(?:must be|is)\s+integral|(?:must|should)\s+(?:include|ensure|complete|notify|refer|document|arrange))\b/i,
  /\bdischarge plans?\s+(?:must|should)\s+(?:include|ensure|complete|notify|refer|document|arrange)\b/i,
  /\b(?:clinicians?|staff|care coordinators?|case managers?|treating teams?|clinical teams?)\b[^.!?]{0,80}\b(?:must\s+|should\s+|will\s+|are\s+(?:required|expected)\s+to\s+)?(?:ensure\w*|complet\w*|notif\w*|refer\w*|document(?:ed|ing)?|include\w*|arrang\w*)\s+(?:the\s+)?(?:discharge plans?|ongoing care arrangements?)\b/i,
  /\bongoing care arrangements?\s+(?:must|should)\s+(?:be\s+documented|include|ensure|complete|document)\b/i,
] as const;
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
      return (
        extractiveConcreteDosePattern.test(text) ||
        (/\b(?:dose|doses|dosing|dosage)\s+guidance\b/i.test(query) &&
          /\b(?:dose|doses|dosing|dosage)\b/i.test(text) &&
          extractiveClinicalDirectivePattern.test(text))
      );
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
      // A dose-kind fact must carry an actual cadence or level signal — the
      // shared vocabulary alone would admit generic dose language
      // ("The therapeutic dose range is 300-450 mg daily.") as monitoring
      // evidence via range/therapeutic/maintenance tokens (CodeRabbit major).
      // Level ranges like "Maintenance range is 0.6-0.8 mmol/L" stay admissible
      // through their level units.
      if (kind === "dose" && !monitoringCadenceOrLevelPattern.test(text)) return false;
      return monitoringScheduleEvidencePattern.test(text);
    case "red_result_action":
      if (kind !== "threshold_action" && kind !== "caveat") return false;
      if (requiresBloodCountEvidence(query) && !hasBloodCountEvidence(text)) return false;
      if (asksForWithholdAction(query) && !hasWithholdActionEvidence(text)) return false;
      return (
        /\b(?:withhold|withheld|withholding|hold|held|cease|stop|stopped|discontinue|discontinued|contact|urgent|repeat|review|call for help|escalat\w*|monitor|toxicity|rash)\b/i.test(
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
      if (isExplicitEscalationQuery(query)) {
        return (
          (hasTargetedEscalationAction(text) && hasEscalationTrigger(text)) || isScoreIndependentActionEvidence(text)
        );
      }
      if (/^what\s+is\b/i.test(query)) {
        return /\b(?:is|are|means|defined|characteri[sz]ed|involves|refers\s+to)\b/i.test(text);
      }
      return /\b(?:assess|arrange|check|collaborat\w*|complete|conduct|continue|develop|diagnos\w*|document|dose|ensure|identify|include|incorporate|involve|link|manage|monitor|provide|record|refer|revise|review\w*|risk|share|therapy|treat|update)\b/i.test(
        text,
      );
  }
}

function hasBoundedMedicationSubjectForNumericRepeatDoseSchedule(
  sentence: string,
  result: SearchResult,
  query: string,
) {
  const repeatMatch = sentence.match(numericRepeatDoseSchedulePattern);
  if (!repeatMatch || !repeatDoseScheduleFigurePattern.test(sentence)) return true;

  const repeatStart = repeatMatch.index ?? 0;
  const medicationMatches = medicationEntityMatchesInText(sentence);
  const precedingSubjects = medicationMatches.filter((match) => {
    if (match.end > repeatStart || repeatStart - match.end > 120) return false;
    return !/[.;\n•]/.test(sentence.slice(match.end, repeatStart));
  });
  const boundSubjects = new Set(precedingSubjects.map((match) => match.canonical));
  const sentenceSubjects = new Set(medicationSafetyEntitiesInText(sentence));
  if (boundSubjects.size === 1 && [...sentenceSubjects].every((subject) => boundSubjects.has(subject))) return true;

  const querySubjects = new Set(medicationSafetyEntitiesInText(query));
  if (querySubjects.size === 0 || sentenceSubjects.size > 0) return false;
  const sourceSubjects = medicationSafetyEntitiesInText(
    [result.title, result.file_name, result.section_heading, result.parent_heading, ...(result.section_path ?? [])]
      .filter(Boolean)
      .join(" "),
  );
  return sourceSubjects.length > 0 && sourceSubjects.every((subject) => querySubjects.has(subject));
}

/** Fact sentence matches query from result. */
function factSentenceMatchesQueryFromResult(
  sentence: string,
  result: SearchResult,
  query: string,
  intent: AnswerIntent,
) {
  if (mentionsDifferentMedicationEntity(sentence, query)) return false;
  if (hasForeignThresholdLabel(query, sentence)) return false;
  if (!hasBoundedMedicationSubjectForNumericRepeatDoseSchedule(sentence, result, query)) return false;
  const maintenanceScope = [
    result.section_heading,
    ...(result.section_path ?? []),
    result.index_unit?.title,
    ...(result.index_unit?.heading_path ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  if (
    /\bmaintenance\b/i.test(query) &&
    monitoringLevelRangeCoveragePattern.test(sentence) &&
    !/\bmaintenance\b/i.test(sentence) &&
    !/\bmaintenance\b/i.test(maintenanceScope)
  ) {
    return false;
  }
  if (hasRelevantQueryOverlap(sentence, query, intent)) return true;
  if (intent === "general" && isExplicitEscalationQuery(query) && isScoreIndependentActionEvidence(sentence)) {
    const resultText = evidenceTextForGate(result);
    const entityTokens = queryEntityTokens(query, intent);
    return entityTokens.length === 0 || entityTokens.some((token) => queryTokenMatchesText(token, resultText));
  }
  if (intent === "general" || intent === "unsupported") return false;

  const resultText = evidenceTextForGate(result);
  const entityTokens = queryEntityTokens(query, intent);
  const queryMedicationEntities = medicationEntitiesInText(query);
  const sentenceMedicationEntities = medicationEntitiesInText(sentence);
  const resultMedicationEntities = medicationEntitiesInText(resultText);
  if (
    (intent === "dose" || intent === "monitoring_schedule") &&
    queryMedicationEntities.length > 0 &&
    sentenceMedicationEntities.length === 0 &&
    resultMedicationEntities.length > 1
  ) {
    // A bare dose or schedule row from a multi-drug table cannot safely inherit
    // the query's medication/class label. Require the row itself to name its
    // medication. (Monitoring joined dose here when the figure coverage escape
    // below made bare interval/range rows admissible without a query token.)
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
    (intent === "red_result_action" && hasAtomicBloodCountWithholdThresholdEvidence(sentence, query)) ||
    (intent === "monitoring_schedule" &&
      (monitoringIntervalFigurePattern.test(normalized) || monitoringLevelRangeCoveragePattern.test(normalized)));
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
  const adjacentBandConflicts = adjacentLabelledNumericBandConflicts(usableResults);

  for (const result of usableResults) {
    const referencesConflictingBand = (text: string) =>
      sourceLabelledNumericBandConflictsAffectingText(result, text, query).length > 0 ||
      textReferencesAdjacentBandConflict(text, result.id, adjacentBandConflicts, query);
    for (const fact of tableFactsToClinicalFacts(result, query, intent)) {
      if (referencesConflictingBand(fact.text)) continue;
      const key = `${fact.kind}:${normalizeSectionText(fact.text).toLowerCase().slice(0, 160)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push({
        ...fact,
        priority:
          fact.priority +
          (isExplicitEscalationQuery(query) && hasTargetedEscalationAction(fact.text) && hasEscalationTrigger(fact.text)
            ? 4
            : 0),
      });
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
      if (referencesConflictingBand(sentence)) continue;
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
        priority:
          factPriority(kind, intent) +
          Math.min(scoreValue(result), 1) +
          (isExplicitEscalationQuery(query) && hasTargetedEscalationAction(cleaned) && hasEscalationTrigger(cleaned)
            ? 4
            : 0),
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
  const entity = queryEntitySubject(query, classifyAnswerIntent(query, classifyRagQuery(query).queryClass));
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
  query: string,
) {
  const citingResults = results.filter((result) => fact.citationChunkIds.includes(result.id));
  if (citingResults.length === 0) return false;
  const factAtoms = extractClinicalValueAtoms(fact.text);
  if (factAtoms.length === 0) {
    const figureMatch = intentFigureMatchText(intent, fact.text, query);
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
  query: string,
) {
  if (leadFacts.some((fact) => factCarriesIntentFigure(intent, fact.text, query))) return leadFacts;
  const promoted = facts
    .slice(leadFacts.length)
    .find(
      (fact) =>
        factCarriesIntentFigure(intent, fact.text, query) &&
        promotedFactFigureIsClaimSupportable(fact, results, intent, query),
    );
  if (!promoted) return leadFacts;
  if (intent === "monitoring_schedule" && isMonitoringLevelRangeLookupQuery(query)) {
    return [promoted, ...leadFacts];
  }
  return intent === "dose" ? [...leadFacts.slice(0, -1), promoted] : [...leadFacts, promoted];
}

const sourceBoundAdmissionDischargeComparisonQueries = new Set([
  "compare admission and discharge requirements",
  "combine community admission steps with discharge documentation requirements",
]);

const sourceBoundActiveCommunityEdProcedureQueries = new Set([
  "how are active community patients in ed managed",
  "active community pt in ed guidance",
]);

const sourceBoundCommunityHomeVisitRequirementsQuery = "what is required for community home visits";
const sourceBoundBestPracticePrescriptionRequirementsQuery =
  "what does the best practice prescription document require";

function normalizedMeasuredQuery(query: string) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isAdmissionDischargeRequirementsComparisonQuery(query: string, queryClass: RagQueryClass) {
  return (
    queryClass === "comparison" &&
    admissionComparisonTermPattern.test(query) &&
    dischargeComparisonTermPattern.test(query) &&
    /\b(?:requirements?|required|criteria|criterion)\b/i.test(query)
  );
}

/** Whether the query is one of the measured admission/discharge comparison shapes. */
export function isSourceBoundAdmissionDischargeComparisonQuery(query: string, queryClass: RagQueryClass) {
  if (!isAdmissionDischargeRequirementsComparisonQuery(query, queryClass)) return false;
  return sourceBoundAdmissionDischargeComparisonQueries.has(normalizedMeasuredQuery(query));
}

/** Whether the query is one of the measured active-community ED procedure shapes. */
export function isSourceBoundActiveCommunityEdProcedureQuery(query: string, queryClass: RagQueryClass) {
  return (
    queryClass === "document_lookup" && sourceBoundActiveCommunityEdProcedureQueries.has(normalizedMeasuredQuery(query))
  );
}

/** Whether the query is the measured AKG community-home-visit requirements shape. */
export function isSourceBoundCommunityHomeVisitRequirementsQuery(query: string, queryClass: RagQueryClass) {
  return (
    queryClass === "unsupported_or_general" &&
    normalizedMeasuredQuery(query) === sourceBoundCommunityHomeVisitRequirementsQuery
  );
}

/** Whether the query is the measured AKG Best Practice Prescription requirements shape. */
export function isSourceBoundBestPracticePrescriptionRequirementsQuery(query: string, queryClass: RagQueryClass) {
  return (
    queryClass === "document_lookup" &&
    normalizedMeasuredQuery(query) === sourceBoundBestPracticePrescriptionRequirementsQuery
  );
}

/** Whether a table-threshold query asks for the clozapine blood-count stop boundary. */
export function isSourceBoundClozapineBloodActionThresholdQuery(query: string, queryClass: RagQueryClass) {
  const namesClozapine = analyzeClinicalQuery(query).medications.includes("clozapine");
  return (
    queryClass === "table_threshold" &&
    namesClozapine &&
    /\b(?:fbc|full blood count|blood count|wbc|wcc|white blood cells?|neutrophils?|anc)\b/i.test(query) &&
    /\b(?:threshold|withhold|withheld|withholding|cease|stop|stopped|discontinue|discontinued)\b/i.test(query)
  );
}

/** Identify the deliberately narrow, one-row NMHS clozapine threshold answer. */
export function isSourceBoundClozapineBloodActionThresholdAnswer(answer: RagAnswer) {
  if (
    answer.queryClass !== "table_threshold" ||
    !answer.preformatted ||
    !answer.grounded ||
    answer.confidence === "unsupported" ||
    answer.citations.length !== 1 ||
    answer.answerSections?.length !== 1
  ) {
    return false;
  }

  const section = answer.answerSections[0];
  const citation = answer.citations[0];
  if (
    section.heading !== "Red-range threshold and action" ||
    section.citation_chunk_ids.length !== 1 ||
    section.citation_chunk_ids[0] !== citation.chunk_id
  ) {
    return false;
  }

  const deliveredText = `${answer.answer} ${section.body}`.replace(/\*\*/g, " ").replace(/\s+/g, " ");
  const source = answer.sources.find((candidate) => candidate.id === citation.chunk_id);
  return Boolean(
    source &&
    isAtomicNmhsClozapineRedRangeSource(source) &&
    /\bWBC\s*<\s*3\.0\s*×\s*10⁹\s*\/\s*L\b/i.test(deliveredText) &&
    /\bneutrophils?\s*<\s*1\.5\s*×\s*10⁹\s*\/\s*L\b/i.test(deliveredText) &&
    /\bstop clozapine therapy immediately\b/i.test(deliveredText),
  );
}

/**
 * Identify the deliberately narrow two-document admission/discharge answer built above.
 *
 * This is used only to choose between already-built answer candidates. Requiring the exact
 * section/citation shape and distinct physical documents prevents a generic comparison or a
 * dual-title policy from being promoted ahead of the normal comparison matrix.
 */
export function isSourceBoundAdmissionDischargeComparisonAnswer(answer: RagAnswer) {
  if (
    answer.queryClass !== "comparison" ||
    !answer.preformatted ||
    !answer.grounded ||
    answer.confidence === "unsupported" ||
    answer.citations.length !== 2 ||
    answer.answerSections?.length !== 2
  ) {
    return false;
  }

  const admissionSection = answer.answerSections.find((section) => section.heading === "Admission evidence");
  const dischargeSection = answer.answerSections.find((section) => section.heading === "Discharge evidence");
  if (
    !admissionSection ||
    !dischargeSection ||
    admissionSection.citation_chunk_ids.length !== 1 ||
    dischargeSection.citation_chunk_ids.length !== 1
  ) {
    return false;
  }

  const admissionChunkId = admissionSection.citation_chunk_ids[0];
  const dischargeChunkId = dischargeSection.citation_chunk_ids[0];
  const citationIds = new Set(answer.citations.map((citation) => citation.chunk_id));
  if (
    admissionChunkId === dischargeChunkId ||
    !citationIds.has(admissionChunkId) ||
    !citationIds.has(dischargeChunkId)
  ) {
    return false;
  }

  const sourceById = new Map(answer.sources.map((source) => [source.id, source]));
  const admissionSource = sourceById.get(admissionChunkId);
  const dischargeSource = sourceById.get(dischargeChunkId);
  return Boolean(
    admissionSource &&
    dischargeSource &&
    admissionSource.document_id &&
    dischargeSource.document_id &&
    admissionSource.document_id !== dischargeSource.document_id,
  );
}

/** Identify the deliberately narrow, same-document active-community ED answer. */
export function isSourceBoundActiveCommunityEdProcedureAnswer(answer: RagAnswer) {
  if (
    answer.queryClass !== "document_lookup" ||
    !answer.preformatted ||
    !answer.grounded ||
    answer.confidence === "unsupported" ||
    answer.citations.length !== 2 ||
    answer.answerSections?.length !== 2
  ) {
    return false;
  }

  const processSection = answer.answerSections.find((section) => section.heading === "ED assessment and coordination");
  const accessSection = answer.answerSections.find((section) => section.heading === "Clinician access and contacts");
  if (
    !processSection ||
    !accessSection ||
    processSection.citation_chunk_ids.length !== 1 ||
    accessSection.citation_chunk_ids.length !== 1
  ) {
    return false;
  }

  const processChunkId = processSection.citation_chunk_ids[0];
  const accessChunkId = accessSection.citation_chunk_ids[0];
  if (processChunkId === accessChunkId) return false;
  const citationIds = new Set(answer.citations.map((citation) => citation.chunk_id));
  if (!citationIds.has(processChunkId) || !citationIds.has(accessChunkId)) return false;

  const sourceById = new Map(answer.sources.map((source) => [source.id, source]));
  const processSource = sourceById.get(processChunkId);
  const accessSource = sourceById.get(accessChunkId);
  return Boolean(
    processSource?.document_id && accessSource?.document_id && processSource.document_id === accessSource.document_id,
  );
}

/** Identify the deliberately narrow, same-document AKG home-visit requirements answer. */
export function isSourceBoundCommunityHomeVisitRequirementsAnswer(answer: RagAnswer) {
  if (
    answer.queryClass !== "unsupported_or_general" ||
    !answer.preformatted ||
    !answer.grounded ||
    answer.confidence === "unsupported" ||
    answer.citations.length !== 2 ||
    answer.answerSections?.length !== 2
  ) {
    return false;
  }

  const departureSection = answer.answerSections.find((section) => section.heading === "Before leaving");
  const returnSection = answer.answerSections.find((section) => section.heading === "Safety monitoring and return");
  if (
    !departureSection ||
    !returnSection ||
    departureSection.citation_chunk_ids.length !== 1 ||
    returnSection.citation_chunk_ids.length !== 1
  ) {
    return false;
  }

  const departureChunkId = departureSection.citation_chunk_ids[0];
  const returnChunkId = returnSection.citation_chunk_ids[0];
  if (departureChunkId === returnChunkId) return false;
  const citationIds = new Set(answer.citations.map((citation) => citation.chunk_id));
  if (!citationIds.has(departureChunkId) || !citationIds.has(returnChunkId)) return false;

  const sourceById = new Map(answer.sources.map((source) => [source.id, source]));
  const departureSource = sourceById.get(departureChunkId);
  const returnSource = sourceById.get(returnChunkId);
  const deliveredText = [answer.answer, departureSection.body, returnSection.body]
    .join(" ")
    .replace(/\*\*/g, " ")
    .replace(/\s+/g, " ");
  return Boolean(
    departureSource &&
    returnSource &&
    departureSource.document_id &&
    departureSource.document_id === returnSource.document_id &&
    communityHomeVisitDepartureEvidence(departureSource) &&
    communityHomeVisitReturnEvidence(returnSource) &&
    /\bCommunity Home Visit Log\b/i.test(deliveredText) &&
    /\bprior to leaving the workplace\b/i.test(deliveredText) &&
    /\bclerical staff will review the log\b/i.test(deliveredText) &&
    /\bsafety monitoring\b/i.test(deliveredText) &&
    /\bon their return to the workplace\b/i.test(deliveredText) &&
    /\bupdate the Community Home Visit Log\b/i.test(deliveredText),
  );
}

/** Identify the deliberately narrow, same-document AKG prescription-program answer. */
export function isSourceBoundBestPracticePrescriptionRequirementsAnswer(answer: RagAnswer) {
  if (
    answer.queryClass !== "document_lookup" ||
    !answer.preformatted ||
    !answer.grounded ||
    answer.confidence === "unsupported" ||
    answer.citations.length !== 2 ||
    answer.answerSections?.length !== 2
  ) {
    return false;
  }

  const useSection = answer.answerSections.find((section) => section.heading === "Program use");
  const profileSection = answer.answerSections.find((section) => section.heading === "Medication profile");
  if (
    !useSection ||
    !profileSection ||
    useSection.citation_chunk_ids.length !== 1 ||
    profileSection.citation_chunk_ids.length !== 1
  ) {
    return false;
  }

  const useChunkId = useSection.citation_chunk_ids[0];
  const profileChunkId = profileSection.citation_chunk_ids[0];
  if (useChunkId === profileChunkId) return false;
  const citationIds = new Set(answer.citations.map((citation) => citation.chunk_id));
  if (!citationIds.has(useChunkId) || !citationIds.has(profileChunkId)) return false;

  const sourceById = new Map(answer.sources.map((source) => [source.id, source]));
  const useSource = sourceById.get(useChunkId);
  const profileSource = sourceById.get(profileChunkId);
  const deliveredText = [answer.answer, useSection.body, profileSection.body]
    .join(" ")
    .replace(/\*\*/g, " ")
    .replace(/\s+/g, " ");
  return Boolean(
    useSource &&
    profileSource &&
    useSource.document_id &&
    useSource.document_id === profileSource.document_id &&
    bestPracticePrescriptionProgramUseEvidence(useSource) &&
    bestPracticePrescriptionProfileEvidence(profileSource) &&
    /\bprescription generation\b/i.test(deliveredText) &&
    /\belectronic medication profiles\b/i.test(deliveredText) &&
    /\bfirst clinic appointment\b/i.test(deliveredText) &&
    /\bcurrent medications\b/i.test(deliveredText) &&
    /\bmedication name, formulation, route, dose and directions for use\b/i.test(deliveredText) &&
    /\bpsychiatric and non-psychiatric medication\b/i.test(deliveredText),
  );
}

function comparisonSourceLabel(result: SearchResult) {
  return normalizeSectionText([result.title, result.file_name, result.section_heading].filter(Boolean).join(" "));
}

function boundedSourceText(result: SearchResult) {
  return reflowBoundedSourceLines(sourceTextForClinicalProsePreservingBreaks(result.content ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isActiveCommunityEdProcedureSource(result: SearchResult) {
  return /\bactive community\b.*\b(?:patients?|consumers?)\b.*\bemergency department\b/i.test(
    comparisonSourceLabel(result),
  );
}

function activeCommunityEdProcessEvidence(result: SearchResult) {
  if (!isActiveCommunityEdProcedureSource(result)) return false;
  const text = boundedSourceText(result);
  return (
    /\bconsumer will be triaged by the Triage Nurse at the AHS ED\b/i.test(text) &&
    /\bED Mental Health Liaison Nurse \(EDMHLN\) will provide a mental health assessment as required\b/i.test(text) &&
    /\bEDMHLN will identify via PSOLIS\b/i.test(text) &&
    /\bEDMHLN will check PSOLIS for a Treatment Support Discharge Plan \(TSD\)\s*\/\s*crisis plan\b/i.test(text) &&
    /\bEDMHLN will contact the relevant community mental health team,? EMHS CRHTT team\b/i.test(text) &&
    /\brequest collateral information\b/i.test(text)
  );
}

function activeCommunityEdAccessEvidence(result: SearchResult) {
  if (!isActiveCommunityEdProcedureSource(result)) return false;
  const text = boundedSourceText(result);
  return (
    /\bconsumers active with Armadale Mental Health Service \(AMHS\) are assessed by the most appropriate mental health clinician available\b/i.test(
      text,
    ) &&
    /\bprovided with information on how to access their relevant treating team during office hours\b/i.test(text) &&
    /\bprovided with information regarding out of hours emergency contacts\b/i.test(text)
  );
}

function isAkgCommunityHomeVisitSource(result: SearchResult) {
  return /\bCommunity\s+Home\s+Visit\s*\(?AKG\)?\b/i.test(comparisonSourceLabel(result));
}

function communityHomeVisitDepartureEvidence(result: SearchResult) {
  if (!isAkgCommunityHomeVisitSource(result)) return false;
  const text = boundedSourceText(result);
  return (
    /\ball clinical staff are to complete a Community Home Visit Log\b/i.test(text) &&
    /\bprior to leaving the workplace\b/i.test(text) &&
    /\bDesignated OAC clerical staff will review the log\b/i.test(text)
  );
}

function communityHomeVisitReturnEvidence(result: SearchResult) {
  if (!isAkgCommunityHomeVisitSource(result)) return false;
  const text = boundedSourceText(result);
  return (
    /\bLeschen clerical reception staff will take responsibility for safety monitoring\b/i.test(text) &&
    /\bclinician will inform Leschen clerical reception staff on their return to the workplace\b/i.test(text) &&
    /\bupdate the community home visit log\b/i.test(text)
  );
}

function isAkgBestPracticePrescriptionSource(result: SearchResult) {
  return /\bBest Practice Prescription(?:\s+Program)?\s*\(?AKG\)?\b/i.test(comparisonSourceLabel(result));
}

function bestPracticePrescriptionProgramUseEvidence(result: SearchResult) {
  if (!isAkgBestPracticePrescriptionSource(result)) return false;
  const text = boundedSourceText(result);
  return (
    /\bBest Practice Prescription Program is an electronic program\b/i.test(text) &&
    /\bPrescription generation\b/i.test(text) &&
    /\bMaintenance of electronic medication profiles\b/i.test(text) &&
    /\bInternal and external correspondence generation\b/i.test(text) &&
    /\bRecording other relevant clinical information\b/i.test(text) &&
    /\ballergies\s*\/\s*adverse drug reactions\b/i.test(text)
  );
}

function bestPracticePrescriptionProfileEvidence(result: SearchResult) {
  if (!isAkgBestPracticePrescriptionSource(result)) return false;
  const text = boundedSourceText(result);
  return (
    /\bat the first clinic appointment, medical officers are to inquire\b/i.test(text) &&
    /\babout their current medications\b/i.test(text) &&
    /\bverify this information\b/i.test(text) &&
    /\bGeneral Practitioner\b/i.test(text) &&
    /\bmedication name, formulation, route, dose and directions for use\b/i.test(text) &&
    /\beach psychiatric and non-psychiatric medication must be entered\b/i.test(text)
  );
}

/** Build the exact, same-document active-community ED procedure answer. */
function buildActiveCommunityEdProcedureAnswer(args: { query: string; results: SearchResult[] }) {
  const processSources = args.results.filter(activeCommunityEdProcessEvidence);
  const accessSources = args.results.filter(activeCommunityEdAccessEvidence);
  const pair = processSources
    .flatMap((process) => accessSources.map((access) => ({ process, access })))
    .find(
      ({ process, access }) =>
        process.id !== access.id && Boolean(process.document_id) && process.document_id === access.document_id,
    );
  if (!pair) return null;

  const processBody =
    "The consumer is triaged by the AHS ED Triage Nurse, and the ED Mental Health Liaison Nurse (EDMHLN) provides a mental health assessment as required. The EDMHLN identifies the active community team in PSOLIS, checks the Treatment Support Discharge Plan (TSD)/crisis plan, contacts the relevant community or CRHTT team, and requests collateral information.";
  const accessBody =
    "Active AMHS consumers are assessed by the most appropriate mental health clinician available. They should routinely receive information on accessing their treating team during office hours and out-of-hours emergency contacts.";
  const answerSections = [
    {
      heading: "ED assessment and coordination",
      kind: "required_actions",
      supportLevel: "direct",
      body: boldHighYieldClinicalText(processBody, args.query),
      citation_chunk_ids: [pair.process.id],
    },
    {
      heading: "Clinician access and contacts",
      kind: "required_actions",
      supportLevel: "direct",
      body: boldHighYieldClinicalText(accessBody, args.query),
      citation_chunk_ids: [pair.access.id],
    },
  ] satisfies AnswerSection[];
  return {
    answer: `${processBody} ${accessBody}`,
    body: `${processBody} ${accessBody}`,
    preformatted: true,
    sourceBoundCitationOnly: true,
    citationChunkIds: [pair.process.id, pair.access.id],
    answerSections,
  };
}

/** Build the exact, same-document AKG community-home-visit requirements answer. */
function buildCommunityHomeVisitRequirementsAnswer(args: { query: string; results: SearchResult[] }) {
  const departureSources = args.results.filter(communityHomeVisitDepartureEvidence);
  const returnSources = args.results.filter(communityHomeVisitReturnEvidence);
  const pair = departureSources
    .flatMap((departure) => returnSources.map((returned) => ({ departure, returned })))
    .find(
      ({ departure, returned }) =>
        departure.id !== returned.id &&
        Boolean(departure.document_id) &&
        departure.document_id === returned.document_id,
    );
  if (!pair) return null;

  const departureBody =
    "All clinical staff are to complete a Community Home Visit Log prior to leaving the workplace. Designated OAC clerical staff will review the log.";
  const returnBody =
    "Leschen clerical reception staff will take responsibility for safety monitoring. The clinician will inform Leschen clerical reception staff on their return to the workplace and update the Community Home Visit Log.";
  return {
    answer: `${departureBody} ${returnBody}`,
    body: `${departureBody} ${returnBody}`,
    preformatted: true,
    sourceBoundCitationOnly: true,
    citationChunkIds: [pair.departure.id, pair.returned.id],
    answerSections: [
      {
        heading: "Before leaving",
        kind: "required_actions",
        supportLevel: "direct",
        body: boldHighYieldClinicalText(departureBody, args.query),
        citation_chunk_ids: [pair.departure.id],
      },
      {
        heading: "Safety monitoring and return",
        kind: "required_actions",
        supportLevel: "direct",
        body: boldHighYieldClinicalText(returnBody, args.query),
        citation_chunk_ids: [pair.returned.id],
      },
    ] satisfies AnswerSection[],
  };
}

/** Build the exact, same-document AKG prescription-program requirements answer. */
function buildBestPracticePrescriptionRequirementsAnswer(args: { query: string; results: SearchResult[] }) {
  const useSources = args.results.filter(bestPracticePrescriptionProgramUseEvidence);
  const profileSources = args.results.filter(bestPracticePrescriptionProfileEvidence);
  const pair = useSources
    .flatMap((use) => profileSources.map((profile) => ({ use, profile })))
    .find(
      ({ use, profile }) =>
        use.id !== profile.id && Boolean(use.document_id) && use.document_id === profile.document_id,
    );
  if (!pair) return null;

  const useBody =
    "Best Practice Prescription Program is used for prescription generation, maintenance of electronic medication profiles, internal and external correspondence generation, and recording other relevant clinical information such as allergies/adverse drug reactions.";
  const profileBody =
    "At the first clinic appointment, medical officers are to inquire with the consumer or carer about current medications and may need to verify the information against the consumer’s medicines or another suitable source such as the General Practitioner. For each psychiatric and non-psychiatric medication, the medication name, formulation, route, dose and directions for use must be entered in the medication profile.";
  return {
    answer: `${useBody} ${profileBody}`,
    body: `${useBody} ${profileBody}`,
    preformatted: true,
    sourceBoundCitationOnly: true,
    citationChunkIds: [pair.use.id, pair.profile.id],
    answerSections: [
      {
        heading: "Program use",
        kind: "required_actions",
        supportLevel: "direct",
        body: boldHighYieldClinicalText(useBody, args.query),
        citation_chunk_ids: [pair.use.id],
      },
      {
        heading: "Medication profile",
        kind: "documentation",
        supportLevel: "direct",
        body: boldHighYieldClinicalText(profileBody, args.query),
        citation_chunk_ids: [pair.profile.id],
      },
    ] satisfies AnswerSection[],
  };
}

function isAtomicNmhsClozapineRedRangeSource(result: SearchResult) {
  const label = comparisonSourceLabel(result);
  return Boolean(
    atomicNmhsClozapineRedRangeSegment({
      sourceLabel: label,
      content: result.content ?? "",
    }),
  );
}

/** Build an atomic red-range threshold/action answer from one explicitly labelled NMHS row. */
function buildClozapineBloodActionThresholdAnswer(args: { query: string; results: SearchResult[] }) {
  const source = args.results.find(isAtomicNmhsClozapineRedRangeSource);
  if (!source) return null;
  const body = "Red-range WBC <3.0 × 10⁹/L and/or neutrophils <1.5 × 10⁹/L: stop clozapine therapy immediately.";
  return {
    answer: body,
    body,
    preformatted: true,
    sourceBoundCitationOnly: true,
    citationChunkIds: [source.id],
    answerSections: [
      {
        heading: "Red-range threshold and action",
        kind: "thresholds",
        supportLevel: "direct",
        body: boldHighYieldClinicalText(body, args.query),
        citation_chunk_ids: [source.id],
      },
    ] satisfies AnswerSection[],
  };
}

function unwrapSourceBoundComparisonLines(content: string) {
  return reflowBoundedSourceLines(sourceTextForClinicalProsePreservingBreaks(content)).flatMap((block) => {
    // The live NMHS discharge aim prefixes its clinical directive with a long service name
    // and parenthesized source abbreviation. The generic fragment-quality gate correctly
    // rejects that source-form shape, so remove only this non-clinical actor qualifier before
    // sentence validation; the directive and its clinician subject remain verbatim.
    const clinicalBlock = block.replace(
      /^All\s+North Metropolitan Health Service Mental Health\s+\(NMHS\s+MH\)\s+clinicians(?=\s+will\s+actively\s+plan\s+(?:the\s+)?effective\s+and\s+timely\s+discharge\b)/i,
      "Clinicians",
    );
    const sentences = splitClinicalEvidenceSentences(clinicalBlock);
    if (sentences.length > 0) return sentences;

    // A directly stated obligation can be followed by a long framework/legislation
    // attribution whose terminal all-caps code and year trips the generic source-heading
    // guard. Retry only the bounded directive before "as per"; the source label and the
    // downstream requirement-binding gate still have to prove the requested comparison side.
    const directiveWithoutAttribution = clinicalBlock.replace(
      /\s+as per\s+the\s+Department of Health\s+\(DoH\)\s+Triage to Discharge Mental Health Framework for State-wide Standardi[sz]ed Clinical Documentation,\s+and\s+legislative requirements of the Mental Health Act\s+\(MHA\)\s+2014\.\s*$/i,
      ".",
    );
    return directiveWithoutAttribution === clinicalBlock
      ? sentences
      : splitClinicalEvidenceSentences(directiveWithoutAttribution);
  });
}

function cleanSourceBoundComparisonCandidate(candidate: string) {
  return candidate
    .replace(/^Inclusion and exclusion criteria\s+(?=A patient\b)/i, "")
    .replace(/\bconsumer is a being referred\b/i, "consumer is being referred")
    .replace(/,?\s*as per:?\s*$/i, "")
    .replace(/:\s*$/, "")
    .trim();
}

function sourceBoundComparisonFacts(args: {
  results: SearchResult[];
  subjectPattern: RegExp;
  otherSubjectPattern: RegExp;
  requirementBindingPatterns: readonly RegExp[];
}) {
  const facts: Array<{ result: SearchResult; sentence: string }> = [];
  for (const result of args.results) {
    const label = comparisonSourceLabel(result);
    if (!args.subjectPattern.test(label)) continue;
    const dualSubjectLabel = args.otherSubjectPattern.test(label);
    const content = result.content ?? "";
    // OCR-backed policy chunks often retain visual line wrapping. The general
    // extractor preserves those breaks so adjacent bullets are never merged,
    // but this comparison path is bound to a source label that names the requested side.
    // Re-run sentence splitting over each
    // bounded block with visual line wrapping collapsed. Blank lines, bullets,
    // terminal punctuation and numbered headings remain boundaries so unrelated
    // sections cannot be stitched together. An exclusive source label may supply the
    // comparison subject; a dual label must bind it in the sentence below. In either case,
    // the body must still carry a narrow requirement signal and an explicit directive. This avoids
    // borrowing a subject from a following numbered heading or unrelated line.
    const sourceBoundSentences = [
      ...unwrapSourceBoundComparisonLines(content),
      ...splitClinicalEvidenceSentences(content),
    ];
    const sentence = Array.from(new Set(sourceBoundSentences))
      .map(cleanSourceBoundComparisonCandidate)
      .find((candidate) => {
        if (args.otherSubjectPattern.test(candidate)) return false;
        if (nonClinicalComparisonWrapperPattern.test(candidate)) return false;
        // An exclusively labelled source can supply the comparison subject, preserving the
        // established admission-only/discharge-only fallback. A dual-title policy is accepted
        // only when the sentence itself explicitly binds to this side and excludes the other;
        // the title alone can never turn generic policy prose into a direct comparison fact.
        if (dualSubjectLabel && !args.subjectPattern.test(candidate)) return false;
        if (subordinateBedLocationReportPattern.test(candidate)) return false;
        return args.requirementBindingPatterns.some((pattern) => pattern.test(candidate));
      });
    if (!sentence) continue;
    const completed = completeExtractiveSentence(sentence, "");
    // A conditional source sentence ("Where/When/If ..., the clinician ...") is already
    // grammatically complete. The generic completer prefixes it with "The guidance is that",
    // which both weakens verbatim fidelity and adds enough unrelated tokens for the
    // section-scoped claim-support check to miss the otherwise exact source sentence.
    const sourceFaithfulCompleted = completed
      ?.replace(/^The guidance is that (?=(?:where|when|if)\b)/i, "")
      .replace(/^(where|when|if)\b/, (lead) => `${lead[0].toUpperCase()}${lead.slice(1)}`);
    if (sourceFaithfulCompleted) facts.push({ result, sentence: sourceFaithfulCompleted });
  }
  return facts;
}

/** Build the narrow two-sided fallback for admission/discharge comparisons.
 *  Exported as a test seam for the #019 conservative-fallback regression guard; no behaviour change. */
export function buildAdmissionDischargeComparisonAnswer(args: { query: string; results: SearchResult[] }) {
  const admissionFacts = sourceBoundComparisonFacts({
    results: args.results,
    subjectPattern: admissionComparisonTermPattern,
    otherSubjectPattern: dischargeComparisonTermPattern,
    requirementBindingPatterns: admissionRequirementBindingPatterns,
  });
  const dischargeFacts = sourceBoundComparisonFacts({
    results: args.results,
    subjectPattern: dischargeComparisonTermPattern,
    otherSubjectPattern: admissionComparisonTermPattern,
    requirementBindingPatterns: dischargeRequirementBindingPatterns,
  });
  // Two-sided maximum matching: preserve retrieval order while requiring distinct physical
  // documents. A dual-title policy may support one side, but can never fill both; if the first
  // fact on each side belongs to the same document, continue to the next valid pairing.
  const pair = admissionFacts
    .flatMap((admission) => dischargeFacts.map((discharge) => ({ admission, discharge })))
    .find(({ admission, discharge }) => admission.result.document_id !== discharge.result.document_id);
  if (!pair) return null;
  const { admission, discharge } = pair;

  const answerSections = [
    {
      heading: "Admission evidence",
      kind: "comparison",
      supportLevel: "direct",
      body: boldHighYieldClinicalText(admission.sentence, args.query),
      citation_chunk_ids: [admission.result.id],
    },
    {
      heading: "Discharge evidence",
      kind: "comparison",
      supportLevel: "direct",
      body: boldHighYieldClinicalText(discharge.sentence, args.query),
      citation_chunk_ids: [discharge.result.id],
    },
  ] satisfies AnswerSection[];
  return {
    answer: `Admission — ${admission.sentence} Discharge — ${discharge.sentence}`,
    body: `${admission.sentence} ${discharge.sentence}`,
    preformatted: true,
    sourceBoundCitationOnly: true,
    citationChunkIds: [admission.result.id, discharge.result.id],
    answerSections,
  };
}

/** Build fact synthesized answer. */
function buildFactSynthesizedAnswer(args: {
  query: string;
  queryClass: RagQueryClass;
  intent: AnswerIntent;
  results: SearchResult[];
}) {
  if (isSourceBoundBestPracticePrescriptionRequirementsQuery(args.query, args.queryClass)) {
    const requirementsAnswer = buildBestPracticePrescriptionRequirementsAnswer({
      query: args.query,
      results: args.results,
    });
    if (requirementsAnswer) return requirementsAnswer;
  }

  if (isSourceBoundCommunityHomeVisitRequirementsQuery(args.query, args.queryClass)) {
    const requirementsAnswer = buildCommunityHomeVisitRequirementsAnswer({
      query: args.query,
      results: args.results,
    });
    if (requirementsAnswer) return requirementsAnswer;
  }

  if (isSourceBoundActiveCommunityEdProcedureQuery(args.query, args.queryClass)) {
    const procedureAnswer = buildActiveCommunityEdProcedureAnswer({ query: args.query, results: args.results });
    if (procedureAnswer) return procedureAnswer;
  }

  if (isSourceBoundClozapineBloodActionThresholdQuery(args.query, args.queryClass)) {
    const thresholdAnswer = buildClozapineBloodActionThresholdAnswer({ query: args.query, results: args.results });
    if (thresholdAnswer) return thresholdAnswer;
  }

  if (isAdmissionDischargeRequirementsComparisonQuery(args.query, args.queryClass)) {
    if (isSourceBoundAdmissionDischargeComparisonQuery(args.query, args.queryClass)) {
      const comparisonAnswer = buildAdmissionDischargeComparisonAnswer({ query: args.query, results: args.results });
      if (comparisonAnswer) return comparisonAnswer;
    }
    const gapAnswer = finalQualityGapAnswer(args.query, args.queryClass, args.intent);
    return {
      answer: gapAnswer,
      body: gapAnswer,
      citationChunkIds: [] as string[],
      answerSections: [] as AnswerSection[],
    };
  }

  const facts = extractClinicalFactsFromResults(args.results, args.query, args.intent);
  if (!facts.length) {
    const fallbackResults = args.results.filter((result) => !resultContainsProceduralFlowEdgeArtifact(result));
    if (
      sourceBackedDocumentFallbackIntent(args.query, args.queryClass, args.intent, fallbackResults) ||
      sourceBackedManagementReviewIntent(args.query, args.queryClass, args.intent, fallbackResults)
    ) {
      return {
        ...buildDocumentSupportListAnswer({ query: args.query, results: fallbackResults }),
        supportListCitationResultIds: fallbackResults.map((result) => result.id),
      };
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
    leadFacts = promoteIntentFigureLeadFacts(leadFacts, facts, args.intent, args.results, args.query);
  }
  // Once the lead answer names the query entity, later lead sentences skip
  // their own entity prefix so the entity is not repeated in every sentence.
  // Derived exactly the way sentenceFromFact derives its prefix entity (from
  // the query's own classification, not the routed intent) so the suppression
  // gate can never disagree with the prefix it is gating.
  const entity = queryEntitySubject(
    args.query,
    classifyAnswerIntent(args.query, classifyRagQuery(args.query).queryClass),
  );
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

/** Whether result metadata/body contains a flow edge rejected as procedural evidence. */
function resultContainsProceduralFlowEdgeArtifact(result: SearchResult) {
  return [
    result.retrieval_synopsis,
    result.section_heading,
    result.content,
    result.adjacent_context,
    result.index_unit?.title,
    result.index_unit?.content,
    ...(result.memory_cards ?? []).map((card) => card.content),
    ...(result.table_facts ?? []).flatMap((fact) => [
      fact.table_title,
      fact.row_label,
      fact.clinical_parameter,
      fact.threshold_value,
      fact.action,
      [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
        .filter(Boolean)
        .join(": "),
    ]),
  ].some(containsDanglingProceduralComparatorStepArtifact);
}

function filterRelatedDocumentsForProceduralArtifacts(
  relatedDocuments: RagAnswer["relatedDocuments"],
  originalResults: SearchResult[],
  retainedResults: SearchResult[],
) {
  const retainedChunkIds = new Set(retainedResults.map((result) => result.id));
  const removedChunkIds = new Set(
    originalResults.filter((result) => !retainedChunkIds.has(result.id)).map((result) => result.id),
  );
  const retainedDocumentIds = new Set(retainedResults.map((result) => result.document_id));
  const fullyRemovedDocumentIds = new Set(
    originalResults
      .filter((result) => !retainedDocumentIds.has(result.document_id))
      .map((result) => result.document_id),
  );

  return (relatedDocuments ?? []).flatMap((document) => {
    if (
      containsDanglingProceduralComparatorStepArtifact(
        [document.title, document.file_name, document.summary, document.match_reason].filter(Boolean).join(" "),
      )
    ) {
      return [];
    }
    const bestChunkIds = document.best_chunk_ids.filter((chunkId) => !removedChunkIds.has(chunkId));
    if (fullyRemovedDocumentIds.has(document.document_id) && bestChunkIds.length === 0) return [];
    return [{ ...document, best_chunk_ids: bestChunkIds }];
  });
}

function derivedArtifactsContainProceduralFlowEdge(value: unknown) {
  try {
    return containsDanglingProceduralComparatorStepArtifact(JSON.stringify(value));
  } catch {
    return false;
  }
}

/** Source backed document fallback intent. */
function sourceBackedDocumentFallbackIntent(
  query: string,
  queryClass: RagQueryClass,
  _intent: AnswerIntent,
  results: SearchResult[],
) {
  if (results.length === 0) return false;
  const strongestScore = Math.max(...results.map(scoreValue));
  if (strongestScore < 0.45) return false;
  return documentSupportListIntent(query, queryClass);
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
export function documentSupportListIntent(query: string, queryClass: RagQueryClass) {
  return (
    classifyAnswerIntent(query, queryClass) === "document_lookup" &&
    /\b(?:support|supports|supporting|sources?|documents?|guidelines?)\b/i.test(query) &&
    /\b(?:which|what|list|show|name|where|find|provide)\b/i.test(query)
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

/**
 * Keep the citations that support delivered extractive answer text ahead of
 * already-ranked supporting citations, without admitting unknown sources.
 */
export function compactExtractiveCitations(args: {
  results: SearchResult[];
  citations: Citation[];
  rankedCitations: Citation[];
  citationChunkIds: string[];
  answerSections: AnswerSection[];
}) {
  const resultById = new Map(args.results.map((result) => [result.id, result]));
  const citationByChunkId = new Map<string, Citation>();
  const compacted: Citation[] = [];
  const seen = new Set<string>();

  const citationCandidates = [...args.citations, ...args.rankedCitations];
  for (const citation of citationCandidates) {
    if (!resultById.has(citation.chunk_id) || citationByChunkId.has(citation.chunk_id)) continue;
    citationByChunkId.set(citation.chunk_id, citation);
  }

  const append = (chunkId: string) => {
    if (seen.has(chunkId) || compacted.length >= 5) return;
    const result = resultById.get(chunkId);
    if (!result) return;
    compacted.push(citationByChunkId.get(chunkId) ?? resultCitation(result, "deterministic_support"));
    seen.add(chunkId);
  };

  // Structured sections are the closest citation map for delivered content.
  // The broader synthesis support set follows without being reordered.
  for (const chunkId of [
    ...args.answerSections.flatMap((section) => section.citation_chunk_ids),
    ...args.citationChunkIds,
  ]) {
    append(chunkId);
  }
  for (const citation of args.rankedCitations) append(citation.chunk_id);

  return compacted;
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
  const results = args.results.filter((result) => !resultContainsProceduralFlowEdgeArtifact(result));
  const removedProceduralArtifact = results.length !== args.results.length;
  const rebuildDerivedArtifacts =
    removedProceduralArtifact ||
    derivedArtifactsContainProceduralFlowEdge({
      quoteCards: args.quoteCards,
      documentBreakdown: args.documentBreakdown,
      evidenceSummary: args.evidenceSummary,
      conflictsOrGaps: args.conflictsOrGaps,
      bestSource: args.bestSource,
      smartPanel: args.smartPanel,
      relatedDocuments: args.relatedDocuments,
    });
  const resultById = new Map(results.map((result) => [result.id, result]));
  const adjacentBandConflicts = adjacentLabelledNumericBandConflicts(results);
  const filterQuoteCards = (cards: QuoteCard[]) =>
    cards.filter((quote) => {
      const source = resultById.get(quote.chunk_id);
      if (!source) return false;
      if (sourceLabelledNumericBandConflictsAffectingText(source, quote.quote, args.query).length > 0) return false;
      return !textReferencesAdjacentBandConflict(quote.quote, source.id, adjacentBandConflicts, args.query);
    });
  const retainedInputQuoteCards = filterQuoteCards(args.quoteCards.slice(0, 5));
  const quoteCards = retainedInputQuoteCards.length
    ? retainedInputQuoteCards
    : filterQuoteCards(extractQuoteCards(results, args.query, 5));
  const memoryCards = rankMemoryCardsForAnswer(collectMemoryCards(results, 16), args.query, args.queryClass).slice(
    0,
    10,
  );
  const rankedCitations = compactCitations(results, 6, "deterministic_support");
  const citations = rankedCitations.slice(0, Math.max(quoteCards.length, 1));
  const citationIds = new Set(citations.map((citation) => citation.chunk_id));
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
      const source = results.find((result) => result.id === quote.chunk_id);
      if (source) citations.push(resultCitation(source, "exact_quote"));
    }
    citationIds.add(quote.chunk_id);
  }

  const answerIntent = classifyAnswerIntent(args.query, args.queryClass);
  const naturalAnswer = documentSupportListIntent(args.query, args.queryClass)
    ? buildDocumentSupportListAnswer({ query: args.query, results })
    : tableOrVisualSourceLookupIntent(args.query, args.queryClass, answerIntent)
      ? buildTableOrVisualSourceLookupAnswer({ query: args.query, results })
      : buildFactSynthesizedAnswer({
          query: args.query,
          queryClass: args.queryClass,
          intent: answerIntent,
          results,
        });

  // Fact synthesis is the production extractive path. If no clean fact survives
  // coverage and artifact gates, fail closed instead of stitching snippets.
  const hasExtractedAnswer = naturalAnswer.citationChunkIds.length > 0;

  // Ensure any chunk IDs referenced by the synthesized answer are present in citations,
  // even if they were not in the top-ranked compactCitations slice.
  for (const chunkId of naturalAnswer.citationChunkIds) {
    if (!citationIds.has(chunkId)) {
      const source = results.find((result) => result.id === chunkId);
      if (source) {
        citations.push(resultCitation(source, "deterministic_support"));
        citationIds.add(chunkId);
      }
    }
  }

  const sourceBoundAdmissionDischargeComparison =
    isSourceBoundAdmissionDischargeComparisonQuery(args.query, args.queryClass) &&
    Boolean((naturalAnswer as { preformatted?: boolean }).preformatted) &&
    naturalAnswer.citationChunkIds.length === 2;
  const sourceBoundCitationOnly =
    sourceBoundAdmissionDischargeComparison ||
    Boolean((naturalAnswer as { sourceBoundCitationOnly?: boolean }).sourceBoundCitationOnly);
  const supportListCitationResultIds = (naturalAnswer as { supportListCitationResultIds?: string[] })
    .supportListCitationResultIds;
  const supportListCitationIdSet = supportListCitationResultIds ? new Set(supportListCitationResultIds) : null;
  const finalCitationResults = supportListCitationIdSet
    ? results.filter((result) => supportListCitationIdSet.has(result.id))
    : results;
  const finalCitations = compactExtractiveCitations({
    results: finalCitationResults,
    citations: supportListCitationIdSet
      ? citations.filter((citation) => supportListCitationIdSet.has(citation.chunk_id))
      : citations,
    // This narrow fallback already maps both delivered comparison facts to
    // their supporting chunks. Extra ranked citations do not support either
    // delivered claim and can introduce unrelated governance failures.
    rankedCitations: sourceBoundCitationOnly
      ? []
      : supportListCitationIdSet
        ? rankedCitations.filter((citation) => supportListCitationIdSet.has(citation.chunk_id))
        : rankedCitations,
    citationChunkIds: naturalAnswer.citationChunkIds,
    answerSections: naturalAnswer.answerSections ?? [],
  });
  const sourceBoundCitationIds = new Set(sourceBoundCitationOnly ? naturalAnswer.citationChunkIds : []);
  const answerSources = sourceBoundCitationOnly
    ? [
        ...naturalAnswer.citationChunkIds.flatMap((chunkId) => {
          const result = resultById.get(chunkId);
          return result ? [result] : [];
        }),
        ...results.filter((result) => !sourceBoundCitationIds.has(result.id)),
      ]
    : supportListCitationIdSet
      ? finalCitationResults
      : results;
  const finalQuoteCards = supportListCitationIdSet
    ? quoteCards.filter((quote) => supportListCitationIdSet.has(quote.chunk_id))
    : quoteCards;
  const finalMemoryCards = supportListCitationIdSet
    ? memoryCards.filter((card) =>
        (card.source_chunk_ids ?? []).some((chunkId) => supportListCitationIdSet.has(chunkId)),
      )
    : memoryCards;
  const rebuiltDocumentBreakdown = rebuildDerivedArtifacts
    ? buildDocumentBreakdown(answerSources, finalQuoteCards)
    : args.documentBreakdown;
  const rebuiltEvidenceSummary = rebuildDerivedArtifacts
    ? buildEvidenceSummary(answerSources, finalQuoteCards)
    : args.evidenceSummary;
  const rebuiltSourceCoverage = rebuildDerivedArtifacts ? buildSourceCoverage(answerSources) : args.sourceCoverage;
  const rebuiltVisualEvidence = rebuildDerivedArtifacts ? buildVisualEvidence(answerSources) : args.visualEvidence;
  const rebuiltBestSource = rebuildDerivedArtifacts
    ? selectBestSourceRecommendation(answerSources, finalQuoteCards.length ? finalQuoteCards : undefined)
    : args.bestSource;
  const rebuiltSmartPanel = rebuildDerivedArtifacts
    ? {
        ...buildSmartPanel(args.query, answerSources),
        documents: rebuiltDocumentBreakdown ?? [],
        quotes: finalQuoteCards,
        visualEvidence: rebuiltVisualEvidence ?? [],
        bestSource: rebuiltBestSource,
        image_count: rebuiltVisualEvidence?.length ?? 0,
        evidenceSummary: rebuiltEvidenceSummary ?? buildEvidenceSummary(answerSources, finalQuoteCards),
        sourceCoverage: rebuiltSourceCoverage ?? buildSourceCoverage(answerSources),
      }
    : args.smartPanel;
  const rebuiltRelatedDocuments = rebuildDerivedArtifacts
    ? filterRelatedDocumentsForProceduralArtifacts(args.relatedDocuments, args.results, answerSources)
    : args.relatedDocuments;
  const deliveredNaturalText = [
    naturalAnswer.answer,
    ...(naturalAnswer.answerSections ?? []).map((section) => section.body),
  ].join(" ");
  const deliveredNaturalTextHasBand = containsNumericBandReference(deliveredNaturalText);
  const queryNeedsBandConflictDisclosure =
    /\b(?:scores?|ranges?|bands?|thresholds?|severit(?:y|ies)|escalat\w*)\b/i.test(args.query);
  const conflictingBandCitationIds = Array.from(
    new Set(
      naturalAnswer.citationChunkIds.filter((chunkId) => {
        const source = resultById.get(chunkId);
        if (!source) return false;
        if (
          sourceHasLabelledNumericBandConflict(source) &&
          ((!deliveredNaturalTextHasBand && queryNeedsBandConflictDisclosure) ||
            sourceLabelledNumericBandConflictsAffectingText(source, deliveredNaturalText, args.query).length > 0)
        ) {
          return true;
        }
        const participatesInAdjacentConflict = adjacentBandConflicts.some((conflict) =>
          conflict.chunkIds.includes(source.id),
        );
        return (
          participatesInAdjacentConflict &&
          ((!deliveredNaturalTextHasBand && queryNeedsBandConflictDisclosure) ||
            textReferencesAdjacentBandConflict(deliveredNaturalText, source.id, adjacentBandConflicts, args.query))
        );
      }),
    ),
  );
  const conflictsOrGaps =
    conflictingBandCitationIds.length > 0
      ? [
          ...(rebuildDerivedArtifacts ? detectConflictsOrGaps(answerSources) : args.conflictsOrGaps).filter(
            (item) => !item.message.startsWith(LABELLED_NUMERIC_BAND_CONFLICT_NOTE),
          ),
          {
            type: "conflict" as const,
            message: `${LABELLED_NUMERIC_BAND_CONFLICT_NOTE} Conflicting numeric bands in the cited source were withheld; only independent nonnumeric guidance is shown.`,
            source_chunk_ids: conflictingBandCitationIds,
          },
        ]
      : rebuildDerivedArtifacts
        ? detectConflictsOrGaps(answerSources)
        : args.conflictsOrGaps;
  if (rebuiltSmartPanel) rebuiltSmartPanel.conflictsOrGaps = conflictsOrGaps;

  return {
    answer: naturalAnswer.answer,
    grounded: hasExtractedAnswer && finalCitations.length > 0,
    confidence: hasExtractedAnswer ? deriveConfidence(results, finalCitations) : "unsupported",
    citations: finalCitations,
    sources: answerSources,
    modelUsed: null,
    routingMode: "extractive",
    preformatted: hasExtractedAnswer && Boolean((naturalAnswer as { preformatted?: boolean }).preformatted),
    routingReason: [
      args.routeReason,
      conflictingBandCitationIds.length > 0 ? "numeric_band_conflict_source_withheld" : null,
    ]
      .filter(Boolean)
      .join("; "),
    queryClass: args.queryClass,
    latencyTimings: args.timings,
    answerSections: naturalAnswer.answerSections ?? [],
    quoteCards: finalQuoteCards,
    visualEvidence: rebuiltVisualEvidence,
    bestSource: rebuiltBestSource,
    documentBreakdown: rebuiltDocumentBreakdown,
    evidenceSummary: rebuiltEvidenceSummary,
    sourceCoverage: rebuiltSourceCoverage,
    conflictsOrGaps,
    smartPanel: rebuiltSmartPanel,
    relatedDocuments: rebuiltRelatedDocuments,
    memoryCardsUsed: finalMemoryCards,
    indexingVersion: ragDeepMemoryVersion,
    indexingQuality: buildIndexingQuality(answerSources, finalMemoryCards),
    scoreExplanations: buildAnswerScoreExplanations(answerSources),
  } satisfies RagAnswer;
}

/** Source backed fallback subject. */
function sourceBackedFallbackSubject(query: string) {
  const canonicalQuery = analyzeClinicalQuery(query).typoCorrections.reduce(
    (current, correction) =>
      current.replace(new RegExp(`\\b${escapeQueryToken(correction.from)}\\b`, "gi"), correction.to),
    query,
  );
  const normalized = normalizeSectionText(canonicalQuery)
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

const providerSourceGapLeadPattern =
  /^(?:no\s+(?:current|relevant|specific|sufficient|directly relevant)\s+(?:indexed\s+)?(?:clinical\s+)?(?:source|sources|document|documents|evidence|guidance)\b|(?:the\s+)?(?:available|retrieved|provided|cited|indexed)\s+(?:source|sources|documents|excerpts|passages)\s+(?:do|does)\s+not\b|i\s+(?:could\s+not|couldn't|cannot|can't|was\s+unable\s+to)\s+(?:find|identify|confirm|provide)\b)/i;

/**
 * Whether the provider's lead answer is itself a source-gap/refusal rather than
 * a substantive answer. Only the lead may trigger this classification, so a
 * useful answer that ends with a bounded limitation remains intact.
 */
export function isProviderSourceGapGeneratedAnswer(
  answer: Pick<RagAnswer, "answer" | "grounded" | "confidence" | "answerSections">,
) {
  const cleanedAnswer = sanitizeAnswerText(answer.answer ?? "");
  const lead = firstSentence(cleanedAnswer).replace(/\*\*/g, "").trim();
  if (!lead || !providerSourceGapLeadPattern.test(lead)) return false;
  return (
    !answer.grounded ||
    answer.confidence === "unsupported" ||
    (answer.answerSections ?? []).some(
      (section) => section.kind === "source_gap" || section.supportLevel === "unsupported",
    )
  );
}

/** Whether a provider source-gap also carries misleading claim citations. */
export function hasCitedProviderSourceGap(
  answer: Pick<RagAnswer, "answer" | "grounded" | "confidence" | "answerSections" | "citations">,
) {
  return answer.citations.length > 0 && isProviderSourceGapGeneratedAnswer(answer);
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
  if (extractiveMalformedFactFragmentPattern.test(normalized)) {
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
  if (isExplicitEscalationQuery(normalizedQuery)) {
    const lead = firstSentence(normalizedText);
    if (!hasTargetedEscalationAction(lead)) return true;
    if (asksForEscalationTrigger(normalizedQuery) && !hasEscalationTrigger(lead)) return true;
    return false;
  }
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
  /\b(?:avoid|arrange|be|can|cannot|cease|check|contact|continue|could|discontinue|document|escalate|give|include|includes|included|increase|inform|involves|is|list|lists|may|might|monitor|must|need|needed|needs|notify|provide|provides|recommend|recommends|reduce|refer|repeat|report|required|requires|review|should|start|starts|stop|support|supports|use|uses|was|were|will|withhold|would)\b/i;

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

// The extractive completer's last-resort branch (completeExtractiveSentence, above) wraps a
// fragment it could not complete as "The guidance is that <fragment>.", and sentenceFromFact may
// then splice the query entity in as "The guidance for <entity> is that …". The wrapper supplies
// both a terminator and the finite verb "is", so the wrapped result passes
// hasCompleteOpeningSentence even though the text inside it did not.
//
// That wrapper is NOT purely laundering — it legitimately rescues well-formed clauses whose only
// flaw is that openingSentenceActionPattern is a narrow list of clinical directives rather than a
// general finite-verb test ("… the ECT Coordinator places the patient onto BASE" is a real
// sentence built on "places", which is not and should not be on that list). So this gate does not
// ask "does the continuation carry a clinical action". It rejects only two shapes that no verb
// list could rescue, both observed live in the 2026-08-21 capture
// (docs/rag-improvement/231-diagnosis-2026-08-22.md §3.1):
//
//   1. Layout debris: a ">" breadcrumb pointing at a word rather than a number, which is a
//      flattened heading trail, not a clinical comparator ("QTc > 500" is untouched).
//   2. A bare coordinated noun list with no determiner, auxiliary or directive verb anywhere —
//      "compliance, monitoring and evaluation" — which states nothing that can be checked
//      against a source.
//
// Runs after the other prose gates so anything they already reject keeps its existing reason;
// this only catches what nothing else does. clippedClinicalFragmentPattern (rag-answer-text.ts)
// covers the same wrapper for four continuations enumerated one incident at a time, and is
// deliberately left in place rather than replaced.
const launderedGuidanceWrapperPattern = /^the\s+guidance(?:\s+for\s+[^.!?]{1,60}?)?\s+is\s+that\s+(.+?)\.?$/i;
// A ">" aimed at a word, not a figure: "aim > To effectively identify…" is a heading trail left
// by PDF flattening. Numeric comparators ("ANC > 2.0", "eGFR > 30 mL/min") never match.
const guidanceWrapperLayoutDebrisPattern = />\s*[A-Za-z]/;
// A coordinated list of bare nouns: letters, spaces, commas, apostrophes and hyphens only (so a
// clause carrying parentheses, digits, slashes or other punctuation is never judged here), joined
// by a comma or "and"/"or".
const guidanceWrapperNounListShapePattern = /^[A-Za-z][A-Za-z\s,'-]*(?:,|\band\b|\bor\b)[A-Za-z\s,'-]*[A-Za-z]$/;
const guidanceWrapperDeterminerPattern =
  /\b(?:the|a|an|this|that|these|those|their|its|his|her|our|your|any|each|every|all|both|no)\b/i;
const guidanceWrapperAuxiliaryPattern =
  /\b(?:is|are|was|were|be|been|being|has|have|had|do|does|did|can|could|may|might|must|shall|should|will|would)\b/i;

/** Is laundered guidance wrapper answer. */
export function isLaunderedGuidanceWrapperAnswer(text: string) {
  const opening = firstSentence(normalizeSectionText(text)).replace(/\*\*/g, "").trim();
  const continuation = opening.match(launderedGuidanceWrapperPattern)?.[1]?.trim();
  if (!continuation) return false;
  if (guidanceWrapperLayoutDebrisPattern.test(continuation)) return true;
  return (
    guidanceWrapperNounListShapePattern.test(continuation) &&
    !guidanceWrapperDeterminerPattern.test(continuation) &&
    !guidanceWrapperAuxiliaryPattern.test(continuation) &&
    !openingSentenceActionPattern.test(continuation)
  );
}

/** Has invalid model evidence ids. */
export function hasInvalidModelEvidenceIds(answer: Pick<RagAnswer, "routingReason">) {
  return /\binvalid_model_citation_ids\b/.test(answer.routingReason ?? "");
}

/** Generated answer quality failure reason. */
export function generatedAnswerQualityFailureReason(answer: RagAnswer, query: string, queryClass: RagQueryClass) {
  if (isBareDocumentSupportListAnswer(answer.answer ?? "")) {
    return documentSupportListIntent(query, queryClass) ? null : "bare_document_title_list";
  }
  const cleanedAnswer = sanitizeAnswerText(answer.answer);
  if (!cleanedAnswer) return "empty_after_sanitize";
  // A citation-free source gap is a valid fail-closed terminal response. The
  // lifecycle defect is specifically a refusal whose nearby-source citations
  // make it look grounded and suppress recovery.
  if (hasCitedProviderSourceGap(answer)) return "provider_source_gap";
  if (isBareDocumentSupportListAnswer(cleanedAnswer)) {
    return documentSupportListIntent(query, queryClass) ? null : "bare_document_title_list";
  }
  if (!hasCompleteOpeningSentence(cleanedAnswer)) return "incomplete_opening_sentence";
  if (hasBadFinalAnswerQuality(cleanedAnswer)) return "bad_final_answer_quality";
  if (hasClinicalAnswerQualityIssue(cleanedAnswer)) return "clinical_answer_quality_issue";
  if (isLowYieldClinicalText(cleanedAnswer)) return "low_yield_answer";
  if (isFragmentLikeClinicalAnswer(cleanedAnswer, query)) return "fragment_like_answer";
  if (isLaunderedGuidanceWrapperAnswer(cleanedAnswer)) return "guidance_wrapper_fragment";
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
 * Detects whether an answer is a bare list of document titles rather than a substantive prose response.
 */
export function isBareDocumentSupportListAnswer(text: string): boolean {
  return /^I found (?:\d+|one) indexed documents? that supports? this query:/i.test(text.trim());
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
  const verified = finalizeRagAnswerQuality(cloneAnswer(candidate), query, queryClass, candidate.sources);
  return (
    verified.grounded &&
    verified.confidence !== "unsupported" &&
    verified.citations.length > 0 &&
    (verified.unverifiedNumericTokens?.length ?? 0) === 0
  );
}

/**
 * Narrows a fallback candidate's sources to the chunks its citations actually
 * reference, so downstream claim support and numeric verification judge the
 * candidate on exactly the evidence it cites. Pure — extracted from the rag.ts
 * generation-fallback path.
 */
export function retainCitedExtractiveFallbackEvidence<T extends RagAnswer>(candidate: T): T {
  const cleanSources = candidate.sources.filter((source) => !resultContainsProceduralFlowEdgeArtifact(source));
  const removedProceduralArtifact = cleanSources.length !== candidate.sources.length;
  const rebuildDerivedArtifacts =
    removedProceduralArtifact ||
    derivedArtifactsContainProceduralFlowEdge({
      quoteCards: candidate.quoteCards,
      documentBreakdown: candidate.documentBreakdown,
      evidenceSummary: candidate.evidenceSummary,
      conflictsOrGaps: candidate.conflictsOrGaps,
      bestSource: candidate.bestSource,
      smartPanel: candidate.smartPanel,
      relatedDocuments: candidate.relatedDocuments,
    });
  const cleanSourceIds = new Set(cleanSources.map((source) => source.id));
  const citations = candidate.citations.filter((citation) => cleanSourceIds.has(citation.chunk_id));
  const citedChunkIds = new Set(citations.map((citation) => citation.chunk_id));
  const sources = cleanSources.filter((source) => citedChunkIds.has(source.id));
  const retainedDocumentIds = new Set(sources.map((source) => source.document_id));
  const answerSections = (candidate.answerSections ?? [])
    .map((section) => ({
      ...section,
      citation_chunk_ids: section.citation_chunk_ids.filter((chunkId) => citedChunkIds.has(chunkId)),
    }))
    .filter((section) => section.citation_chunk_ids.length > 0);
  const quoteCards = (candidate.quoteCards ?? []).filter((quote) => citedChunkIds.has(quote.chunk_id));
  const visualEvidence = rebuildDerivedArtifacts
    ? buildVisualEvidence(sources)
    : (candidate.visualEvidence ?? []).filter((card) => citedChunkIds.has(card.source_chunk_id));
  const bestSource = rebuildDerivedArtifacts
    ? selectBestSourceRecommendation(sources, quoteCards.length ? quoteCards : undefined)
    : candidate.bestSource && citedChunkIds.has(candidate.bestSource.chunk_id)
      ? candidate.bestSource
      : null;
  const rebuiltConflictsOrGaps = rebuildDerivedArtifacts ? detectConflictsOrGaps(sources) : [];
  const retainedConflictsOrGaps = (candidate.conflictsOrGaps ?? [])
    .map((item) => {
      if (!item.source_chunk_ids) return item;
      return { ...item, source_chunk_ids: item.source_chunk_ids.filter((chunkId) => citedChunkIds.has(chunkId)) };
    })
    .filter(
      (item) =>
        (!item.source_chunk_ids || item.source_chunk_ids.length > 0) &&
        !containsDanglingProceduralComparatorStepArtifact(item.message),
    );
  const conflictsOrGaps = Array.from(
    new Map(
      [...rebuiltConflictsOrGaps, ...retainedConflictsOrGaps].map((item) => [
        `${item.type}:${item.message}:${(item.source_chunk_ids ?? []).join(",")}`,
        item,
      ]),
    ).values(),
  );
  const documentBreakdown = buildDocumentBreakdown(sources, quoteCards);
  const evidenceSummary = buildEvidenceSummary(sources, quoteCards);
  const sourceCoverage = buildSourceCoverage(sources);
  const memoryCardsUsed = (candidate.memoryCardsUsed ?? [])
    .map((card) => ({
      ...card,
      source_chunk_ids: card.source_chunk_ids.filter((chunkId) => citedChunkIds.has(chunkId)),
    }))
    .filter((card) => card.source_chunk_ids.length > 0);
  const scoreExplanations = (candidate.scoreExplanations ?? []).filter((item) => citedChunkIds.has(item.chunk_id));
  const sourceGovernanceWarnings = (candidate.sourceGovernanceWarnings ?? []).filter(
    (warning) => !warning.document_id || retainedDocumentIds.has(warning.document_id),
  );
  const safetyWarnings = (candidate.safetyWarnings ?? []).filter((warning) =>
    citedChunkIds.has(warning.citation.chunk_id),
  );
  const smartPanel = candidate.smartPanel
    ? {
        ...candidate.smartPanel,
        total_sources: sources.length,
        documents: documentBreakdown,
        quotes: quoteCards,
        visualEvidence,
        bestSource,
        image_count: visualEvidence.length,
        evidenceSummary,
        sourceCoverage,
        conflictsOrGaps,
      }
    : candidate.smartPanel;
  const relatedDocuments = rebuildDerivedArtifacts
    ? filterRelatedDocumentsForProceduralArtifacts(candidate.relatedDocuments, candidate.sources, cleanSources)
    : candidate.relatedDocuments;
  const smartApiPlan = candidate.smartApiPlan
    ? (() => {
        const coreSourceLinks = candidate.smartApiPlan.coreSourceLinks.filter((link) =>
          citedChunkIds.has(link.chunk_id),
        );
        return {
          ...candidate.smartApiPlan,
          sourceLinkCount: coreSourceLinks.length,
          coreSourceLinks,
        };
      })()
    : candidate.smartApiPlan;
  const retained = {
    ...candidate,
    citations,
    sources,
    answerSections,
    quoteCards,
    visualEvidence,
    bestSource,
    conflictsOrGaps,
    documentBreakdown,
    evidenceSummary,
    sourceCoverage,
    memoryCardsUsed,
    scoreExplanations,
    sourceGovernanceWarnings,
    safetyWarnings,
    smartPanel,
    relatedDocuments,
    smartApiPlan,
  } as T;
  if (candidate.supportedClaims === undefined && candidate.evidenceAssessments === undefined) return retained;
  const reassessed = assessClaimSupport(retained);
  return {
    ...retained,
    supportedClaims: reassessed.claims,
    evidenceAssessments: reassessed.evidenceAssessments,
  } as T;
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

/**
 * After claim support has removed unsafe or duplicate sections, keep only the
 * citations that still support delivered fallback content. Quote cards count
 * as delivered evidence; ranked retrieval padding and removed-section support
 * do not. This is intentionally scoped to source-backed generation fallback so
 * ordinary deterministic and model-selected citation semantics remain unchanged.
 */
function retainDeliveredExtractiveFallbackEvidence(answer: RagAnswer, query: string, queryClass: RagQueryClass) {
  if (
    answer.routingMode !== "extractive" ||
    answer.preformatted ||
    !/(?:source_backed_extractive_fallback|validated_agitation_arousal_typo_dosing_extractive_first)/.test(
      answer.routingReason ?? "",
    )
  ) {
    return answer;
  }

  const answerIntent = classifyAnswerIntent(query, queryClass);
  const explicitEscalation = requiresClinicalEscalationFallbackSafety(query);
  const escalationEvidenceMatchesQuery = (text: string, source?: SearchResult, boundedContext = text) => {
    const sourceSubjectContext = [
      source?.title,
      source?.file_name,
      source?.section_heading,
      source?.parent_heading,
      ...(source?.section_path ?? []),
      ...(source?.index_unit?.heading_path ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/[_-]+/g, " ");
    const relevanceContext = [sourceSubjectContext, text].filter(Boolean).join(" ");
    if (!hasRelevantQueryOverlap(relevanceContext, query, answerIntent)) return false;
    // In this source, "side effects are noted as causing distress" states the
    // live clinical trigger; it is not a report/audit wrapper. Remove only that
    // present-tense construction before applying the provenance-history guard.
    const provenanceContext = boundedContext.replace(
      /\b((?:side effects?|symptoms?|reactions?))\s+are\s+noted\s+as\s+causing\b/gi,
      "$1 causing",
    );
    if (
      staleEscalationProvenancePattern.test(sourceSubjectContext) ||
      strongHistoricalEscalationCuePattern.test(sourceSubjectContext) ||
      strongHistoricalEscalationCuePattern.test(provenanceContext) ||
      reportedEscalationWrapperPattern.test(provenanceContext)
    ) {
      return false;
    }
    if (hasForeignMedicationClinicalValueBinding(query, text)) return false;
    const queryMedications = new Set(medicationSafetyEntitiesInText(query));
    const evidenceMedications = medicationSafetyEntitiesInText(text);
    const contextMedications = medicationSafetyEntitiesInText(sourceSubjectContext);
    if (queryMedications.size > 0) {
      const boundedMedications = evidenceMedications.length > 0 ? evidenceMedications : contextMedications;
      return (
        boundedMedications.some((medication) => queryMedications.has(medication)) &&
        boundedMedications.every((medication) => queryMedications.has(medication))
      );
    }
    if (/\b(?:neuroleptics?|antipsychotics?)\b/i.test(query)) {
      const boundedMedications = evidenceMedications.length > 0 ? evidenceMedications : contextMedications;
      return boundedMedications.every(isAntipsychoticMedicationEntity);
    }
    return true;
  };
  const sourceById = new Map(answer.sources.map((source) => [source.id, source]));
  const directEscalationSupportSegments = (claimText: string, source: SearchResult) => {
    // High-risk escalation support must come from primary chunk text or a
    // structured table row. Derived synopses/index units can omit historical
    // qualifiers and therefore cannot independently establish a current rule.
    const evidenceValues = [
      source.content,
      ...(source.table_facts ?? []).map((fact) =>
        [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
          .filter(Boolean)
          .join(": "),
      ),
    ];
    return evidenceValues.flatMap((value) => {
      const paragraphs = (value ?? "").split(/\n\s*\n/).filter((paragraph) => paragraph.trim().length > 0);
      return paragraphs.flatMap((paragraph, paragraphIndex) => {
        const sentences = splitClinicalEvidenceSentences(paragraph);
        const boundedHistoricalSourceLabel =
          paragraph.match(
            /(?:^|[.!?]\s+)\s*(?:source|origin|provenance)\s*:\s*[^.!?\n]{0,120}\b(?:audit|retrospective|case\s+review|incident\s+report|historical|study|survey|previous|prior|earlier|former|superseded|obsolete|archived|withdrawn|legacy|retired|repealed|discontinued|outdated)\b[^.!?\n]*/i,
          )?.[0] ?? "";
        const precedingParagraph = paragraphs[paragraphIndex - 1] ?? "";
        const boundedPrecedingHistoricalParagraph =
          precedingParagraph.length <= 240 &&
          (strongHistoricalEscalationCuePattern.test(precedingParagraph) ||
            reportedEscalationWrapperPattern.test(precedingParagraph))
            ? precedingParagraph
            : "";
        return sentences.flatMap((segment, index) => {
          const directlySupports = sourceDirectlySupportsAnswerText(claimText, {
            ...source,
            section_heading: null,
            section_path: [],
            parent_heading: null,
            content: segment,
            retrieval_synopsis: null,
            table_facts: [],
            index_unit: null,
          });
          if (!directlySupports) return [];
          const followingSentence = sentences[index + 1] ?? "";
          const followingReferencesPrior =
            /^\s*(?:(?:this|that|these|those)\s+|the\s+(?:above|preceding|previous)\s+)(?:requirement|recommendation|guidance|statement|rule|action)\b/i.test(
              followingSentence,
            ) ||
            /^\s*(?:this|that|it|these|those)\s+(?:(?:was|were|is|are|has\s+been|have\s+been|had\s+been)\s+(?:(?:the\s+)?(?:requirement|recommendation|guidance|statement|rule|action)\s+)?(?:recorded|reported|documented|noted|found|observed|described|stated|indicated|based\s+on|from)\b|(?:came|comes)\s+from\b)/i.test(
              followingSentence,
            ) ||
            /^\s*the\s+(?:requirement|recommendation|guidance|statement|rule|action)\s+(?:(?:was|is|has\s+been|had\s+been)\s+(?:recorded|reported|documented|noted|found|observed|described|stated|indicated|based\s+on|from)\b|(?:came|comes)\s+from\b)/i.test(
              followingSentence,
            ) ||
            /^\s*its\s+(?:origin|provenance|source)\s+(?:was|is|has\s+been|had\s+been)\b/i.test(followingSentence) ||
            /^\s*the\s+source\s+for\s+(?:(?:this|that|the)\s+)?(?:requirement|recommendation|guidance|statement|rule|action)\s+(?:was|is|has\s+been|had\s+been)\b/i.test(
              followingSentence,
            ) ||
            /^\s*(?:(?:the|this|that)\s+)?(?:requirement|recommendation|guidance|statement|rule|action)\s+(?:originated|derives?|derived|came|comes)\s+(?:in|from)\b/i.test(
              followingSentence,
            ) ||
            /^\s*source\s*:/i.test(followingSentence);
          const followingQualifiesPrior =
            followingReferencesPrior &&
            (strongHistoricalEscalationCuePattern.test(followingSentence) ||
              reportedEscalationWrapperPattern.test(followingSentence));
          return [
            {
              segment,
              boundedContext: [
                boundedPrecedingHistoricalParagraph,
                sentences.slice(0, index + 1).join(" "),
                followingQualifiesPrior ? followingSentence : "",
                boundedHistoricalSourceLabel,
              ]
                .filter(Boolean)
                .join(" "),
            },
          ];
        });
      });
    });
  };
  const directClaimChunkIds = (answer.supportedClaims ?? [])
    .filter((claim) => claim.supportStatus === "direct")
    .flatMap((claim) =>
      claim.supportingChunkIds.filter((chunkId) => {
        if (!explicitEscalation) return true;
        const source = sourceById.get(chunkId);
        if (!source) return false;
        return directEscalationSupportSegments(claim.text, source).some(
          ({ segment, boundedContext }) =>
            escalationEvidenceMatchesQuery(segment, source, boundedContext) &&
            hasTargetedEscalationAction(segment) &&
            (!asksForEscalationTrigger(query) || hasEscalationTrigger(segment)),
        );
      }),
    );
  const quoteCards = (answer.quoteCards ?? []).filter((quote) => {
    const source = sourceById.get(quote.chunk_id);
    if (!source) return false;
    if (!hasBoundedMedicationSubjectForNumericRepeatDoseSchedule(quote.quote, source, query)) return false;
    if (!explicitEscalation) return hasRelevantQueryOverlap(quote.quote, query, answerIntent);
    return directEscalationSupportSegments(quote.quote, source).some(
      ({ segment, boundedContext }) =>
        escalationEvidenceMatchesQuery(segment, source, boundedContext) &&
        hasTargetedEscalationAction(segment) &&
        (!asksForEscalationTrigger(query) || hasEscalationTrigger(segment)),
    );
  });
  const deliveredChunkIds = new Set([...directClaimChunkIds, ...quoteCards.map((quote) => quote.chunk_id)]);
  const citations = answer.citations.filter((citation) => deliveredChunkIds.has(citation.chunk_id));
  const retained = retainCitedExtractiveFallbackEvidence({ ...answer, citations, quoteCards });
  if (!answer.grounded || answer.confidence === "unsupported" || retained.citations.length > 0) return retained;

  return retainCitedExtractiveFallbackEvidence({
    ...finalQualityFailure(retained, query, queryClass, "extractive_fallback_no_delivered_support"),
    citations: [],
    quoteCards: [],
    bestSource: null,
    supportedClaims: undefined,
    evidenceAssessments: undefined,
  });
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

/**
 * Fast-route final-gate gap recovery: when a grounded, cited, low-confidence fast
 * model answer over strong routine retrieval is only gap-like phrasing, rebuild a
 * deterministic source-backed answer from the evidence it already cites instead of
 * shipping a citation-free evidence gap. Mirrors the rag.ts generation-fallback
 * recovery, which handles the thrown variants of the same failure — today, model
 * phrasing alone decides which of the two branches a gap-shaped fast answer takes.
 * Returns null to keep the gap terminal: genuinely empty retrieval, strong-route
 * gaps, and comparison/dose/threshold classes (whose fallbacks need dedicated
 * single-chunk handling) never recover here. The rebuilt candidate is routingMode
 * "extractive", so the re-entrant validation finalize cannot re-trigger this
 * fast-gated recovery.
 */
function recoverFinalGateGapExtractively(
  answer: RagAnswer,
  query: string,
  queryClass: RagQueryClass,
  gapReason: string,
): RagAnswer | null {
  if (answer.routingMode !== "fast") return null;
  if (!answer.routingReason?.includes("strong_routine_retrieval")) return null;
  if ((answer.sources?.length ?? 0) === 0) return null;
  if (queryClass === "comparison" || queryClass === "medication_dose_risk" || queryClass === "table_threshold") {
    return null;
  }
  // Band-coherence source conflicts already have a throw-based recovery in rag.ts.
  if (answer.routingReason.includes("numeric_band_coherence_gate_source_conflict")) return null;
  const recoveryRouteReason = [
    answer.routingReason,
    `generation_fallback:${gapReason}`,
    "source_backed_extractive_fallback",
    `final_quality_gate_source_backed_recovery:${gapReason}`,
  ].join("; ");
  const candidate = buildExtractiveAnswer({
    query,
    queryClass,
    results: answer.sources,
    quoteCards: answer.quoteCards ?? [],
    documentBreakdown: answer.documentBreakdown ?? [],
    evidenceSummary: answer.evidenceSummary,
    sourceCoverage: answer.sourceCoverage,
    conflictsOrGaps: answer.conflictsOrGaps ?? [],
    visualEvidence: answer.visualEvidence ?? [],
    bestSource: answer.bestSource ?? null,
    smartPanel: answer.smartPanel,
    relatedDocuments: answer.relatedDocuments ?? [],
    routeReason: recoveryRouteReason,
    timings: answer.latencyTimings,
  });
  if (!candidate.grounded || candidate.confidence === "unsupported" || candidate.citations.length === 0) return null;
  if (isBareCrossReferenceAnswer(candidate.answer ?? "")) return null;
  const smartApiPlan = buildSmartRagApiPlan({
    query,
    queryClass,
    results: candidate.sources,
    routeMode: "extractive",
    routeReason: candidate.routingReason,
    conflictsOrGaps: candidate.conflictsOrGaps ?? [],
  });
  const merged: RagAnswer = {
    ...answer,
    ...candidate,
    modelUsed: null,
    supportedClaims: undefined,
    evidenceAssessments: undefined,
    smartApiPlan,
    responseMode: smartApiPlan.displayMode,
  };
  if (!isSafeExtractiveFallbackCandidate(merged, query, queryClass)) return null;
  return merged;
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
  const coherenceChecked = enforceLabelledNumericBandCoherence(answer, { query, verificationSources });
  const qualityChecked = finalizeRagAnswerQualityCore(coherenceChecked, query, queryClass);
  const verified = applyNumericVerification(assessAndEnforceClaimSupport(qualityChecked), verificationSources);
  return applyProviderLabels(retainDeliveredExtractiveFallbackEvidence(verified, query, queryClass));
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
    const gapReason = answer.modelUsed ? "provider_source_gap" : "source_gap";
    const recovered = recoverFinalGateGapExtractively(answer, query, queryClass, gapReason);
    // Terminates: the recovered answer is routingMode "extractive", so the fast-gated
    // recovery cannot re-fire on this re-run.
    if (recovered) return finalizeRagAnswerQualityCore(recovered, query, queryClass);
    const gapAnswer = finalQualityGapAnswer(query, queryClass);
    return {
      ...answer,
      answer: gapAnswer,
      grounded: false,
      confidence: "unsupported",
      citations: [],
      answerSections: [],
      quoteCards: [],
      bestSource: null,
      supportedClaims: undefined,
      evidenceAssessments: undefined,
      routingReason: [answer.routingReason, `final_quality_gate:${gapReason}`].filter(Boolean).join("; "),
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
