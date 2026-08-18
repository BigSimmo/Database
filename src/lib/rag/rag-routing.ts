import {
  classifyRagQuery,
  hasForeignThresholdLabel,
  hasMedicationMonitoringSubjectText,
  medicationMonitoringSubjectAliases,
  medicationMonitoringQuerySubjects,
  medicationMonitoringQuerySubjectTokens,
} from "@/lib/clinical-search";
import { explicitlyBindsEntityToClinicalValue } from "@/lib/clinical-value-binding";
import { hasForeignMedicationClinicalValueBinding } from "@/lib/medication-entities";
import { canBuildDeterministicComparison } from "@/lib/rag/rag-comparison";
import type { ConflictOrGap, RagAnswer, RagQueryClass, SearchResult } from "@/lib/types";

export type AnswerRouteMode = "unsupported" | "extractive" | "fast" | "strong";

export type AnswerRoute = {
  mode: AnswerRouteMode;
  model: string | null;
  reason: string;
  strongestScore: number;
  documentCount: number;
};

export const SOURCE_BACKED_REVIEW_FALLBACK_REASON = "source_backed_review_fallback";

// Dosing-class queries that reach the routed-generation fallthrough go to the strong
// route up front, so the 35s strong budget exists before the deadline is created.
// On the fast route their failed attempts retried strong inside the fast route's
// leftover budget (fast_unsupported_retry_strong) and died as provider_timeout —
// the dominant "Lithium dosing?" fallback mode after S1 (issue #231 residual R1).
export const MEDICATION_DOSE_RISK_STRONG_ROUTE_REASON = "medication_dose_risk_strong_route";

const unsupportedSimilarityThreshold = 0.32;
const strongRetrievalThreshold = 0.64;
const extractiveRetrievalThreshold = 0.76;
// Gates weak-search telemetry (rag_query_misses logging + retrieval diagnostics), not answer
// routing. It deliberately sits between unsupportedSimilarityThreshold (0.32) and
// strongRetrievalThreshold (0.64): a top score below it means retrieval "worked" but was too
// weak to trust, which is the miss signal alias curation feeds on.
export const weakRetrievalTopScoreThreshold = 0.48;
const complexClinicalQueryPattern =
  /\b(compare|compared|versus|vs|conflict|gap|contraindicat\w*|interaction\w*|side effect\w*|adverse|suicid\w*|toxicity|myocarditis|neutropenia|anc|fbc|urgent|escalat\w*|withhold|cease|stop|dose|dosing|prescrib\w*)\b/i;
const strongClinicalEscalationPattern =
  /\b(compare|compared|versus|vs|conflict|gap|contraindicat\w*|interaction\w*|side effect\w*|adverse|suicid\w*|toxicity|myocarditis|neutropenia|anc|fbc|red range|amber range|urgent|escalat\w*|withhold|cease|stop|discontinue|recommend\w*|decide|decision|pregnan\w*|renal impairment)\b/i;
const comparisonQueryPattern = /\b(compare|compared|versus|vs|between|difference\w*|conflict\w*)\b/i;
const complexComparisonPattern =
  /\b(?:reconcile|implications?|recommend\w*|prioriti[sz]e|management|clinical approach|why|how should|trade-?offs?)\b/i;
const routineCrossDocumentPattern =
  /\b(?:across|combine|combined|synthesi[sz]e|together|overall|all documents|these documents|different documents|multiple documents|several documents|from the documents)\b/i;
const extractiveQuestionPattern =
  /\b(what|when|where|which|who|list|include|includes|required|requirements|process|procedure|steps|monitoring|summary|summarise|summarize|show|tell)\b/i;
const extractiveBlockPattern =
  /\b(compare|compared|versus|vs|conflict|gap|contraindicat\w*|interaction\w*|side effect\w*|adverse|risk\w*|suicid\w*|toxicity|myocarditis|neutropenia|urgent|escalat\w*|withhold|cease|stop|dose|dosing|prescrib\w*|recommend\w*|decide|decision)\b/i;
const broadManagementSynthesisPattern =
  /\b(?:management|manage|managed|treatment|treat|therapy|care|approach|pathway)\s+(?:of|for|in)\b|\bhow\s+(?:is|are|should)\b.{0,80}\b(?:managed|treated)\b/i;
const clinicalPathwaySynthesisPattern = /\b(?:referral criteria|referral pathway|refer\b|pathway|what to do)\b/i;
const medicationExtractiveLookupPattern =
  /\b(?:listed|list|options?|monitoring|observations?|needed|required|dosing guidance|dose|route|pharmacological management|\bim\b|\bpo\b)\b/i;
const medicationSafetyCriticalPattern =
  /\b(?:anc|fbc|wbc|wcc|neutrophil|neutrophils|threshold|cut ?off|withhold|withheld|withholding|cease|stop|stopped|red range|amber range)\b/i;
const clozapineBloodWithholdThresholdPattern = /\bclozapine\b/i;
const bloodCountTermPattern = /\b(?:anc|fbc|wbc|wcc|white cell|white blood cell|neutrophil|neutrophils)\b/i;
const withholdThresholdIntentPattern =
  /\b(?:threshold|cut ?off|cutoff|withhold|withheld|withholding|cease|stop|stopped|discontinue|discontinued)\b/i;
const numericMedicationThresholdLookupPattern =
  /\b(?:cut[\s-]?offs?|minimum|maximum)\b|\b(?:therapeutic|target|toxic|trough)\s+(?:levels?|ranges?|concentrations?)\b/i;
const explicitNumericClinicalParameterPattern = /\b(?:anc|wbc|wcc|white (?:blood )?cells?|neutrophils?|qtc)\b/i;
const explicitNumericThresholdRequestPattern =
  /\b(?:numeric|numerical|numbers?|values?|exact value|measured value|units?)\b|[<>≤≥]|\d+(?:\.\d+)?|(?:[x×]\s*)?10(?:\^?\s*(?:9|12)|⁹|¹²)\s*\/\s*l|\b(?:msec|ms|mmol|mol|mg|mcg|ng|cells?)\s*\/\s*(?:ml|l)\b/i;
const narrativeRangeContextPattern =
  /\b(?:adult\s+)?age\s+ranges?\b|\branges?\s+of\s+(?:baseline\s+)?(?:tests?|checks?|monitoring|ages?)\b/i;
const naturalMedicationLevelValueLookupPattern =
  /\b(?:levels?|concentrations?)\s+(?:is|are)\s+(?:used|recommended|targeted|maintained)\b|\blevels?\s+ranges?\b/i;
const thresholdAtomClinicalFigurePattern =
  /\d+(?:\.\d+)?(?:\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?)?\s*(?:msec|ms|ng\s*\/\s*ml|(?:mcg|[µμ]g|ug|mg|meq|mmol|mol|units?)\s*\/\s*l|mcg|[µμ]g|ug|mg|micrograms?|milligrams?|[x×]\s*10(?:\^?\s*9|⁹)\s*\/\s*l|10(?:\^?\s*9|⁹)\s*\/\s*l|cells?\s*\/\s*l|mmhg|bpm|%)\b/i;
const thresholdAtomBetweenClinicalFigurePattern =
  /\bbetween\s+\d+(?:\.\d+)?\s+and\s+\d+(?:\.\d+)?\s*(?:msec|ms|ng\s*\/\s*ml|(?:mcg|[µμ]g|ug|mg|meq|mmol|mol|units?)\s*\/\s*l|mcg|[µμ]g|ug|mg|micrograms?|milligrams?|[x×]\s*10(?:\^?\s*9|⁹)\s*\/\s*l|10(?:\^?\s*9|⁹)\s*\/\s*l|cells?\s*\/\s*l|mmhg|bpm|%)\b/i;
const thresholdAtomComparatorOrRangePattern =
  /(?:[<>≤≥]=?\s*\d+(?:\.\d+)?|\b(?:less|greater)\s+than\s+\d+(?:\.\d+)?|\b(?:below|above)\s+\d+(?:\.\d+)?|\bbetween\s+\d+(?:\.\d+)?\s+and\s+\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?)/i;
const calendarYearRangePattern = /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:19|20)\d{2}\b/gi;
const administrativePageRangePattern = /\b(?:pages?|pp?\.?)\s+\d+\s*(?:-|–|—|to)\s*\d+\b/gi;
const concentrationLookupQueryPattern = /\b(?:levels?|ranges?|therapeutic|target|trough|concentrations?)\b/i;
const concentrationThresholdValuePattern =
  /\b(?:ng|mcg|[µμ]g|ug|mg|g|meq|mmol|[µμ]mol|umol|mol|miu|iu|u|units?)\s*\/\s*(?:ml|l)\b/i;
const qtcThresholdValuePattern = /\b(?:msec|ms)\b/i;
const bloodCountThresholdValuePattern =
  /(?:[x×]\s*10(?:\^?\s*(?:9|12)|⁹|¹²)\s*\/\s*l|10(?:\^?\s*(?:9|12)|⁹|¹²)\s*\/\s*l|cells?\s*\/\s*l)/i;
const genericThresholdAnchorTokens = new Set([
  "what",
  "which",
  "when",
  "used",
  "use",
  "for",
  "the",
  "should",
  "does",
  "monitor",
  "monitoring",
  "medication",
  "therapy",
  "treatment",
  "level",
  "range",
  "threshold",
  "cutoff",
  "withhold",
  "stop",
  "cease",
  "minimum",
  "maximum",
  "required",
  "require",
]);
const localThresholdScopePattern =
  /\b(?:maintenance|therapeutic|target|reference|trough|red range|amber range|anc|fbc|wbc|wcc|neutrophils?|qtc)\b/i;
const thresholdAnalyteGroups = [
  { id: "lithium", pattern: /\blithium\b/i },
  { id: "blood_count", pattern: /\b(?:anc|fbc|wbc|wcc|white blood cells?|neutrophils?)\b/i },
  { id: "blood_glucose", pattern: /\b(?:blood glucose|bgl|glucose|hba1c)\b/i },
  { id: "qtc", pattern: /\bqtc\b/i },
  { id: "sodium", pattern: /\bsodium\b/i },
  { id: "potassium", pattern: /\bpotassium\b/i },
  { id: "calcium", pattern: /\bcalcium\b/i },
  { id: "renal", pattern: /\b(?:creatinine|egfr|renal function)\b/i },
  { id: "blood_pressure", pattern: /\b(?:blood pressure|systolic|diastolic)\b/i },
  { id: "temperature", pattern: /\btemperature\b/i },
  { id: "oxygen", pattern: /\b(?:oxygen saturation|spo2)\b/i },
  { id: "prolactin", pattern: /\bprolactin\b/i },
  { id: "thyroid", pattern: /\b(?:thyroid|tsh|thyroid stimulating hormone)\b/i },
] as const;
const genericScopedThresholdTokens = new Set([
  "a",
  "above",
  "amber",
  "and",
  "anc",
  "are",
  "at",
  "below",
  "between",
  "blood",
  "bpm",
  "cell",
  "cells",
  "cease",
  "concentration",
  "continue",
  "count",
  "cutoff",
  "fbc",
  "for",
  "from",
  "greater",
  "is",
  "l",
  "less",
  "level",
  "maintenance",
  "maintain",
  "maximum",
  "mcg",
  "meq",
  "mg",
  "microgram",
  "micrograms",
  "milligram",
  "milligrams",
  "minimum",
  "miu",
  "mmhg",
  "mmol",
  "monitor",
  "monitoring",
  "must",
  "neutrophil",
  "neutrophils",
  "ng",
  "of",
  "or",
  "plasma",
  "range",
  "reaches",
  "red",
  "reference",
  "result",
  "results",
  "serum",
  "should",
  "stop",
  "target",
  "than",
  "the",
  "therapeutic",
  "threshold",
  "to",
  "toxic",
  "treatment",
  "trough",
  "ug",
  "unit",
  "units",
  "value",
  "was",
  "wbc",
  "wcc",
  "when",
  "white",
]);
const queryStopWords = new Set([
  "what",
  "when",
  "where",
  "which",
  "should",
  "does",
  "include",
  "require",
  "requires",
  "required",
  "requirement",
  "requirements",
  "procedure",
  "process",
  "document",
  "managed",
  "management",
  "guideline",
  "find",
  "search",
  "lookup",
  "open",
  "show",
  "tell",
  "give",
]);
const specificTitleStopWords = new Set([
  "what",
  "when",
  "where",
  "which",
  "should",
  "does",
  "do",
  "is",
  "are",
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "for",
  "with",
  "and",
  "include",
  "require",
  "requires",
  "required",
  "requirement",
  "requirements",
  "find",
  "search",
  "lookup",
  "open",
  "show",
  "tell",
  "give",
]);

// Query-side adversarial-manipulation guard. Neutralizing injected instructions
// embedded in retrieved *source* text is handled separately (neutralizeInstructions
// in rag.ts); this catches manipulation intent in the *user query* itself — asking
// the model to ignore its instructions, fabricate citations/evidence, pretend the
// evidence supports a claim, or exfiltrate a system prompt / secrets. Such a query
// often mentions a real clinical term (e.g. "clozapine protocol"), so it retrieves
// genuine sources and would otherwise be answered.
//
// The patterns are deliberately tight to avoid refusing legitimate clinical
// wording: each requires an explicit manipulation verb next to a manipulation
// object. In particular they distinguish fabricated-*evidence* framing ("as if the
// protocol supports this request") from patient-state hypotheticals ("as if the
// symptoms support toxicity"), a jailbreak persona ("you are now an unrestricted
// assistant") from a training scenario ("you are now an inpatient..."), and
// fabrication verbs from clinical nouns like "manufacturer"/"inventory" and
// composition wording like "documents that make up the evidence base". Validated
// against the golden eval set and a corpus of trigger-adjacent legitimate probes.
//
// This is a best-effort defense-in-depth *first line*, not a complete boundary: a
// pattern list cannot be exhaustive against paraphrase, and adding ever-looser
// patterns trades injection recall for clinical false-positives (wrongly refusing
// real questions), which is the worse failure here. The durable injection defenses
// remain the source-text neutralization above and the answer-generation prompt,
// which is instructed not to follow injected instructions. Extend these patterns
// for *common* phrasings; do not chase every possible variant into false-positive
// territory.
const adversarialManipulationPatterns: RegExp[] = [
  // Instruction override / jailbreak
  /\b(?:ignore|disregard|override|forget|bypass)\s+(?:all\s+|any\s+)?(?:(?:previous|prior|above|earlier|these|those|the|your)\s+)?(?:instructions?|messages?|prompts?|rules?|guardrails?)\b/i,
  // Negated-follow overrides ("do not follow prior instructions", "stop following your
  // guardrails"). The instruction object must be privileged (prior/system-scoped) or a
  // rule/guardrail/prompt — never a bare "instructions", so clinical wording like "do not
  // follow discharge/medication instructions" and "not follow the standard protocol" is
  // unaffected.
  /\b(?:do\s+not|don't|stop|cease|quit|no\s+longer)\s+(?:follow(?:ing)?|obey(?:ing)?|adher(?:e|ing))\b[^.?!]{0,25}\b(?:(?:your|prior|previous|above|these|those|system)\s+instructions?|rules?|guardrails?|prompts?)\b/i,
  // Persona jailbreak — requires a jailbreak object, not a bare "you are now a ..."
  /\b(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be|roleplay\s+as)\s+(?:a\s+|an\s+|the\s+)?(?:unrestricted|unfiltered|uncensored|jailbroken|jailbreak|developer[-\s]?mode|do[-\s]?anything|dan\b|god[-\s]?mode|sudo|root)\b/i,
  // Fabricate evidence/citations — fabrication verbs incl. gerunds ("forging") and
  // "invent" as a whole word (so "inventory" is unaffected); not "forgot"/"manufacture".
  /\b(?:fabricat\w*|forg(?:e|ed|es|ing|ery)|falsif\w*|counterfeit\w*|invent(?:ed|ing|s)?)\b[^.?!]{0,40}\b(?:citations?|chunks?|references?|sources?|evidence|quotes?|values?|data)\b/i,
  // "make up" fabrication — the object must immediately follow, so composition wording
  // like "documents that make up the evidence base / reference list" is not matched.
  /\bmake\s+up\s+(?:some\s+|a\s+|fake\s+|false\s+)?(?:citations?|references?|quotes?)\b/i,
  // Explicit fake/forged citations (plural-aware). Deliberately not bare "id"/"ids":
  // "a patient gives a false ID" is an identity document, not citation fraud.
  /\b(?:fake|bogus|false|forged|fabricated|made[-\s]?up|placeholder|dummy)\s+(?:citations?|chunks?|references?|sources?|evidence|quotes?)\b/i,
  /\bcitation_chunk_id\b/i,
  // pretend / assume / treat-as the evidence is complete/sufficient/supports. Objects are
  // evidence/sources/citations only — "data" is excluded because clinical scenarios say
  // "assume the ANC data confirms..." / "treat the lab data as...".
  /\b(?:pretend|assume|treat)\b[^.?!]{0,30}\b(?:evidence|sources?|citations?)\b[^.?!]{0,25}\b(?:complete|sufficient|conclusive|enough|available|supports?|proves?|confirms?)\b/i,
  // Answer "as if" the evidence/source/protocol supports *this request/claim*
  /\bas\s+if\b[^.?!]{0,40}\b(?:evidence|sources?|protocol|guideline|documents?|citations?)\b[^.?!]{0,30}\b(?:support|prove|confirm|allow|approve|establish)\w*\b[^.?!]{0,25}\b(?:this|the)\s+(?:request|claim|answer|query|response|prompt)\b/i,
  // Secret exfiltration by verb (incl. provide/list/output/dump; system message/
  // instructions and access tokens). "credentials" is intentionally excluded — clinical
  // "prescriber credentials" means professional qualifications, not secrets.
  /\b(?:reveal|expose|print|show|leak|return|disclose|tell|give|send|share|provide|list|output|dump|divulge|repeat)\b[^.?!]{0,50}\b(?:system\s+(?:prompt|message|instructions?)|hidden\s+(?:system\s+)?prompt|developer\s+(?:prompt|message|instructions?)|api\s+keys?|access\s+tokens?|secret\s+(?:keys?|tokens?))\b/i,
  // Direct interrogative / possessive requests (no verb) — only *inherently* privileged
  // objects. "system message"/"system instructions" are intentionally excluded here (they
  // appear in clinical/operational noun phrases like "patient monitoring system
  // instructions"); those are still caught by the verb-based exfiltration rule above.
  /\b(?:what(?:'s|\s+is|\s+are)?|your|any|the)\b[^.?!]{0,20}\b(?:hidden\s+)?(?:system\s+prompt|developer\s+(?:prompt|message|instructions?)|api\s+keys?|access\s+tokens?)\b/i,
];

/** Has adversarial manipulation intent. */
export function hasAdversarialManipulationIntent(query: string): boolean {
  return adversarialManipulationPatterns.some((pattern) => pattern.test(query));
}

/** Strongest retrieval score. */
export function strongestRetrievalScore(results: SearchResult[]) {
  return results.reduce((max, result) => Math.max(max, result.hybrid_score ?? result.similarity), 0);
}

/** Document count. */
function documentCount(results: SearchResult[]) {
  return new Set(results.map((result) => result.document_id)).size;
}

/** Has text support. */
function hasTextSupport(results: SearchResult[]) {
  return results.some((result) => (result.text_rank ?? 0) > 0.05 || (result.hybrid_score ?? 0) >= 0.32);
}

/** Has actionable conflict or gap. */
function hasActionableConflictOrGap(conflictsOrGaps: ConflictOrGap[] = []) {
  return conflictsOrGaps.some(
    (item) =>
      item.type === "conflict" || /limited-strength|not enough|no indexed|weak support|unsupported/i.test(item.message),
  );
}

/** Has conflict intent. */
function hasConflictIntent(query: string) {
  return /\b(?:conflict|gap|contradict|disagree|inconsisten|versus|vs)\b/i.test(query);
}

/** Has explicit document lookup intent. */
function hasExplicitDocumentLookupIntent(query: string) {
  return (
    /\b(?:find|search|lookup|open|show)\b.{0,80}\b(?:document|file|pdf|protocol|guideline|procedure)\b/i.test(query) ||
    /\bnewly uploaded\b/i.test(query)
  );
}

/** Has source support lookup intent. */
function hasSourceSupportLookupIntent(query: string) {
  return (
    /\b(?:what|which)\s+(?:documents?|sources?|files?|guidelines?)\b.{0,120}\b(?:support|supports|supporting|cover|covers|contain|contains|mention|mentions)\b/i.test(
      query,
    ) || /\b(?:documents?|sources?|files?|guidelines?)\s+(?:supporting|for)\b/i.test(query)
  );
}

/** Has quote or source location intent. */
function hasQuoteOrSourceLocationIntent(query: string) {
  return /\b(?:quote|quotes|quoted|exact wording|source location|where in|which page|page number|open source|show source|source link|citation|citations)\b/i.test(
    query,
  );
}

/** Has explicit table or visual lookup intent. */
function hasExplicitTableOrVisualLookupIntent(query: string) {
  return (
    /\b(?:which|what|show|find|open|where)\b.{0,120}\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b/i.test(
      query,
    ) ||
    /\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|form)\b.{0,80}\b(?:cover|covers|contain|contains|list|lists|show|shows|guidance)\b/i.test(
      query,
    )
  );
}

/** Normalize lookup text. */
function normalizeLookupText(text: string) {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Query topic tokens. */
function queryTopicTokens(query: string) {
  return normalizeLookupText(query)
    .split(/\s+/)
    .map((token) => token.replace(/s$/, ""))
    .filter((token) => token.length > 2 && !queryStopWords.has(token));
}

/** Query specific title tokens. */
function querySpecificTitleTokens(query: string) {
  return normalizeLookupText(query)
    .split(/\s+/)
    .map((token) => token.replace(/s$/, ""))
    .filter((token) => token.length > 2 && !specificTitleStopWords.has(token));
}

type ThresholdEvidenceAtom = {
  body: string;
  scope: string;
  localScope: string;
};

function splitThresholdEvidenceBody(value: string | null | undefined) {
  return (value ?? "")
    .split(/(?<=[.!?;])\s+|\r?\n+|,\s*(?=(?:but|however|while|whereas)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function thresholdEvidenceAtoms(result: SearchResult): ThresholdEvidenceAtom[] {
  const documentScope = [result.title, result.file_name, result.section_heading, ...(result.section_path ?? [])]
    .filter(Boolean)
    .join(" ");
  const atoms: ThresholdEvidenceAtom[] = [];
  const addBodies = (bodies: Array<string | null | undefined>, scope: string, localScope = "") => {
    for (const body of bodies.flatMap((value) => splitThresholdEvidenceBody(value))) {
      atoms.push({ body, scope, localScope });
    }
  };
  const addSequentialBody = (value: string | null | undefined, scope: string) => {
    let localThresholdScope = "";
    for (const body of splitThresholdEvidenceBody(value)) {
      const isBullet = /^[•*-]\s*/.test(body);
      atoms.push({
        body,
        scope: [isBullet ? localThresholdScope : "", scope].filter(Boolean).join(" "),
        localScope: isBullet ? localThresholdScope : "",
      });
      if (/\b(?:ranges?|thresholds?|cut[\s-]?offs?|levels?|concentrations?)\b.{0,60}:\s*$/i.test(body)) {
        localThresholdScope = body;
      } else if (!isBullet) {
        localThresholdScope = "";
      }
    }
  };
  addSequentialBody(result.content, documentScope);
  addSequentialBody(result.retrieval_synopsis, documentScope);
  for (const fact of result.table_facts ?? []) {
    atoms.push({
      body: [fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action].filter(Boolean).join(" "),
      scope: [fact.table_title, documentScope].filter(Boolean).join(" "),
      localScope: fact.table_title ?? "",
    });
  }
  if (result.index_unit) {
    const indexUnitScope = [
      result.index_unit.title,
      ...(result.index_unit.heading_path ?? []),
      ...(result.index_unit.normalized_terms ?? []),
    ]
      .filter(Boolean)
      .join(" ");
    addBodies([result.index_unit.content], [indexUnitScope, documentScope].filter(Boolean).join(" "), indexUnitScope);
  }
  for (const sourceImage of result.images ?? []) {
    const imageScope = [sourceImage.caption, sourceImage.tableTitle, sourceImage.tableLabel, documentScope]
      .filter(Boolean)
      .join(" ");
    const localImageScope = [sourceImage.caption, sourceImage.tableTitle, sourceImage.tableLabel]
      .filter(Boolean)
      .join(" ");
    addBodies([sourceImage.accessibleTableMarkdown, sourceImage.tableTextSnippet], imageScope, localImageScope);
    for (const row of sourceImage.tableRows ?? []) {
      addBodies([[...(sourceImage.tableColumns ?? []), ...row].join(" ")], imageScope, localImageScope);
    }
  }
  return atoms.filter((atom) => atom.body.trim().length > 0);
}

type EvidenceSpan = { start: number; end: number };

function thresholdValueSpans(body: string): EvidenceSpan[] {
  const withoutAdministrativeRanges = body
    .replace(calendarYearRangePattern, (match) => " ".repeat(match.length))
    .replace(administrativePageRangePattern, (match) => " ".repeat(match.length));
  const valuePattern = new RegExp(
    `(?:${thresholdAtomBetweenClinicalFigurePattern.source})|(?:${thresholdAtomClinicalFigurePattern.source})|(?:${thresholdAtomComparatorOrRangePattern.source})`,
    "gi",
  );
  return Array.from(withoutAdministrativeRanges.matchAll(valuePattern), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function atomHasThresholdValue(atom: ThresholdEvidenceAtom) {
  return thresholdValueSpans(atom.body).length > 0;
}

function atomHasQueryAnchor(query: string, body: string) {
  if (bloodCountTermPattern.test(query) && bloodCountTermPattern.test(body)) return true;

  const subjectTokens = new Set(medicationMonitoringQuerySubjectTokens(query));
  const queryAnchors = normalizeLookupText(query)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !subjectTokens.has(token) && !genericThresholdAnchorTokens.has(token));
  const bodyTokens = new Set(normalizeLookupText(body).split(/\s+/));
  return queryAnchors.some((token) => bodyTokens.has(token));
}

function atomHasIncompatibleAnalyte(query: string, body: string) {
  const queryAnalyteText = `${query} ${medicationMonitoringQuerySubjects(query).join(" ")}`;
  const queryAnalytes = new Set(
    thresholdAnalyteGroups.filter((group) => group.pattern.test(queryAnalyteText)).map((group) => group.id),
  );
  return thresholdAnalyteGroups.some((group) => group.pattern.test(body) && !queryAnalytes.has(group.id));
}

function escapedPhrasePattern(phrases: string[]) {
  const alternatives = phrases
    .sort((left, right) => right.length - left.length)
    .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
  return alternatives.length > 0 ? new RegExp(`\\b(?:${alternatives.join("|")})\\b`, "gi") : null;
}

function matchingSpans(pattern: RegExp | null, text: string): EvidenceSpan[] {
  if (!pattern) return [];
  return Array.from(text.matchAll(pattern), (match) => ({ start: match.index, end: match.index + match[0].length }));
}

function hasForeignAnalyteValueBinding(query: string, body: string, value: EvidenceSpan) {
  const queryAnalyteText = `${query} ${medicationMonitoringQuerySubjects(query).join(" ")}`;
  const queryAnalytes = new Set(
    thresholdAnalyteGroups.filter((group) => group.pattern.test(queryAnalyteText)).map((group) => group.id),
  );
  return thresholdAnalyteGroups
    .filter((group) => !queryAnalytes.has(group.id))
    .flatMap((group) => matchingSpans(new RegExp(group.pattern.source, "gi"), body))
    .some((analyte) => explicitlyBindsEntityToClinicalValue(analyte, value, body));
}

function atomHasQueryParameterValueBinding(query: string, atom: ThresholdEvidenceAtom, value: EvidenceSpan) {
  const valueText = atom.body.slice(value.start, value.end);
  const nearbyText = atom.body.slice(Math.max(0, value.start - 96), Math.min(atom.body.length, value.end + 48));

  if (/\bqtc\b/i.test(query)) {
    return /\bqtc\b/i.test(`${nearbyText} ${atom.scope}`) && qtcThresholdValuePattern.test(valueText);
  }

  if (bloodCountTermPattern.test(query)) {
    return (
      bloodCountTermPattern.test(nearbyText) ||
      (bloodCountTermPattern.test(atom.scope) && bloodCountThresholdValuePattern.test(nearbyText))
    );
  }

  const queryParameterGroups = thresholdAnalyteGroups.filter(
    (group) => group.id !== "lithium" && group.pattern.test(query),
  );
  if (queryParameterGroups.length > 0) {
    return queryParameterGroups.some(
      (group) =>
        group.pattern.test(nearbyText) ||
        (group.pattern.test(atom.scope) && concentrationThresholdValuePattern.test(valueText)),
    );
  }

  if (concentrationLookupQueryPattern.test(query)) {
    return (
      concentrationThresholdValuePattern.test(valueText) &&
      !/\b(?:dose|dosage|daily|weekly|monthly)\b/i.test(nearbyText)
    );
  }

  return (
    atomHasQueryAnchor(query, nearbyText) ||
    localThresholdScopePattern.test(atom.scope) ||
    /\b(?:threshold|cut[\s-]?off|withhold|stop|cease|minimum|maximum)\b/i.test(nearbyText)
  );
}

function atomHasDirectMedicationValueBinding(query: string, subject: string, atom: ThresholdEvidenceAtom) {
  const subjectSpans = matchingSpans(escapedPhrasePattern(medicationMonitoringSubjectAliases(subject)), atom.body);
  if (subjectSpans.length === 0) return false;

  return thresholdValueSpans(atom.body).some(
    (value) =>
      atomHasQueryParameterValueBinding(query, atom, value) && !hasForeignAnalyteValueBinding(query, atom.body, value),
  );
}

function atomHasOnlyScopedQueryLabels(query: string, body: string) {
  const queryTokens = new Set(normalizeLookupText(query).split(/\s+/));
  return normalizeLookupText(body)
    .split(/\s+/)
    .filter(Boolean)
    .every(
      (token) =>
        /^\d+$/.test(token) || token.length <= 2 || queryTokens.has(token) || genericScopedThresholdTokens.has(token),
    );
}

function atomSupportsMedicationSubject(query: string, subject: string, atom: ThresholdEvidenceAtom) {
  if (hasForeignMedicationClinicalValueBinding(query, `${atom.body} ${atom.localScope}`)) return false;
  if (hasForeignThresholdLabel(query, `${atom.body} ${atom.localScope}`)) return false;
  if (atomHasDirectMedicationValueBinding(query, subject, atom)) return true;
  if (hasMedicationMonitoringSubjectText(subject, atom.body)) return false;
  if (!hasMedicationMonitoringSubjectText(subject, atom.scope)) return false;

  const bodySubjects = medicationMonitoringQuerySubjects(atom.body);
  if (bodySubjects.length > 0 && !bodySubjects.includes(subject)) return false;
  if (atomHasIncompatibleAnalyte(query, atom.body)) return false;
  if (!thresholdValueSpans(atom.body).some((value) => atomHasQueryParameterValueBinding(query, atom, value)))
    return false;
  if (!atomHasOnlyScopedQueryLabels(query, atom.body)) return false;
  return atomHasQueryAnchor(query, atom.body) || localThresholdScopePattern.test(atom.scope);
}

function hasAtomicMedicationThresholdEvidence(query: string, results: SearchResult[]) {
  const subjects = medicationMonitoringQuerySubjects(query);
  return subjects.every((subject) =>
    results.some((result) =>
      thresholdEvidenceAtoms(result).some(
        (atom) => atomHasThresholdValue(atom) && atomSupportsMedicationSubject(query, subject, atom),
      ),
    ),
  );
}

function requiresAtomicMedicationThresholdEvidence(query: string) {
  // Coloured blood-result ranges are categorical action bands, not requests for
  // a numeric value. Preserve those established extractive paths while making
  // level/range lookups (and explicitly numeric ANC/QTc threshold lookups) prove
  // that the value and medication subject occur in the same evidence atom.
  const withoutColourRanges = query.replace(/\b(?:red|amber|green)\s+range\b/gi, "");
  if (numericMedicationThresholdLookupPattern.test(withoutColourRanges)) return true;
  if (naturalMedicationLevelValueLookupPattern.test(withoutColourRanges)) return true;
  if (
    /\branges?\b/i.test(withoutColourRanges) &&
    medicationMonitoringQuerySubjects(withoutColourRanges).length > 0 &&
    !narrativeRangeContextPattern.test(withoutColourRanges)
  ) {
    return true;
  }
  if (/\bthresholds?\b/i.test(withoutColourRanges)) {
    return (
      !/\b(?:fbc|full blood count|blood count)\b/i.test(withoutColourRanges) ||
      explicitNumericClinicalParameterPattern.test(withoutColourRanges) ||
      explicitNumericThresholdRequestPattern.test(withoutColourRanges)
    );
  }
  return false;
}

/** Has direct title support. */
export function hasDirectTitleSupport(query: string, results: SearchResult[]) {
  const tokens = queryTopicTokens(query);
  if (tokens.length === 0) return false;

  return results.slice(0, 4).some((result) => {
    const title = normalizeLookupText(`${result.title} ${result.file_name}`).replace(/s\b/g, "");
    return tokens.some((token) => title.includes(token));
  });
}

/** Best title token match. */
function bestTitleTokenMatch(query: string, results: SearchResult[]) {
  const tokens = querySpecificTitleTokens(query);
  let matchedCount = 0;

  for (const result of results.slice(0, 4)) {
    const title = normalizeLookupText(`${result.title} ${result.file_name}`).replace(/s\b/g, "");
    const count = tokens.filter((token) => title.includes(token)).length;
    matchedCount = Math.max(matchedCount, count);
  }

  return { tokenCount: tokens.length, matchedCount };
}

/** Has specific title support. */
export function hasSpecificTitleSupport(query: string, results: SearchResult[]) {
  const { tokenCount, matchedCount } = bestTitleTokenMatch(query, results);
  if (tokenCount === 0) return false;
  if (tokenCount <= 2) return matchedCount > 0;
  return matchedCount >= 2 || matchedCount / tokenCount >= 0.5;
}

/** Has admission community lookup intent. */
function hasAdmissionCommunityLookupIntent(query: string) {
  const normalized = normalizeLookupText(query);
  return /\badmission\b/.test(normalized) && /\bcommunity\b/.test(normalized);
}

/** Is complex clinical query. */
export function isComplexClinicalQuery(query: string) {
  return complexClinicalQueryPattern.test(query);
}

/** Has table or visual source support. */
function hasTableOrVisualSourceSupport(results: SearchResult[]) {
  return results.slice(0, 8).some((result) => {
    const reasonText = (result.match_explanation?.reasons ?? []).join(" ");
    const sourceText = [
      result.title,
      result.file_name,
      result.section_heading,
      result.content.slice(0, 300),
      reasonText,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      Boolean(result.table_facts?.length) ||
      Boolean(result.images?.length) ||
      /\b(?:table|chart|flow\s*chart|flowchart|figure|appendix|image|visual|medication_chart)\b/i.test(sourceText)
    );
  });
}

/** Is clozapine blood withhold threshold query. */
function isClozapineBloodWithholdThresholdQuery(query: string) {
  return (
    clozapineBloodWithholdThresholdPattern.test(query) &&
    bloodCountTermPattern.test(query) &&
    withholdThresholdIntentPattern.test(query)
  );
}

const explicitWithholdActionPattern =
  /\b(?:withhold|withheld|withholding|hold|held|cease|stop|stopped|discontinue|discontinued)\b/i;

/** Snippet has co occurring blood withhold evidence. */
function snippetHasCoOccurringBloodWithholdEvidence(snippet: string) {
  const sentences = snippet
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const candidates = sentences.length > 0 ? sentences : [snippet];
  return candidates.some(
    (sentence) => bloodCountTermPattern.test(sentence) && explicitWithholdActionPattern.test(sentence),
  );
}

/** Blood withhold evidence snippets. */
function bloodWithholdEvidenceSnippets(result: SearchResult) {
  const tableFactSnippets = (result.table_facts ?? []).map((fact) =>
    [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
      .filter(Boolean)
      .join(" "),
  );
  return [
    result.title,
    result.file_name,
    result.section_heading,
    result.retrieval_synopsis,
    result.content,
    result.adjacent_context,
    result.index_unit?.title,
    result.index_unit?.content,
    ...tableFactSnippets,
  ].filter((value): value is string => Boolean(value));
}

/** Has explicit blood withhold action evidence. */
function hasExplicitBloodWithholdActionEvidence(results: SearchResult[]) {
  return results
    .slice(0, 8)
    .some((result) =>
      bloodWithholdEvidenceSnippets(result).some((snippet) => snippetHasCoOccurringBloodWithholdEvidence(snippet)),
    );
}

/** Should prefer model synthesis. */
function shouldPreferModelSynthesis(query: string, queryClass: RagQueryClass) {
  return (
    queryClass === "medication_dose_risk" ||
    queryClass === "table_threshold" ||
    queryClass === "comparison" ||
    /\b(?:dose|dosing|monitoring|threshold|risk|compare|comparison|pathway|referral|refer|managed|management|treatment|escalat\w*)\b/i.test(
      query,
    ) ||
    clinicalPathwaySynthesisPattern.test(query)
  );
}

/** Should use extractive medication lookup. */
function shouldUseExtractiveMedicationLookup(args: {
  query: string;
  results: SearchResult[];
  strongestScore: number;
  topTextRank: number;
  directTitleSupport: boolean;
}) {
  if (!medicationExtractiveLookupPattern.test(args.query)) return false;
  if (medicationSafetyCriticalPattern.test(args.query)) return false;
  if (/\b(?:dose|dosing|maximum|max|action)\b/i.test(args.query)) return false;
  return args.directTitleSupport || args.topTextRank >= 0.08 || hasTableOrVisualSourceSupport(args.results);
}

/** Should use strong clinical route. */
function shouldUseStrongClinicalRoute(args: {
  query: string;
  queryClass: RagQueryClass;
  strongestScore: number;
  topTextRank: number;
  directTitleSupport: boolean;
  actionableConflictOrGap: boolean;
}) {
  if (args.actionableConflictOrGap && !args.directTitleSupport) return true;
  if (strongClinicalEscalationPattern.test(args.query)) return true;
  if (args.strongestScore < strongRetrievalThreshold && !args.directTitleSupport) return true;
  if (args.queryClass === "table_threshold" && args.topTextRank < 0.035 && !args.directTitleSupport) return true;
  return false;
}

/** Should use extractive answer. */
export function shouldUseExtractiveAnswer(args: {
  query: string;
  results: SearchResult[];
  queryClass?: RagQueryClass;
  conflictsOrGaps?: ConflictOrGap[];
}) {
  if (args.results.length === 0) return false;
  const directTitleSupport = hasDirectTitleSupport(args.query, args.results);
  const strongestScore = strongestRetrievalScore(args.results);
  const topTextRank = Math.max(...args.results.map((result) => result.text_rank ?? 0));
  const documents = documentCount(args.results);
  const queryClass = args.queryClass ?? classifyRagQuery(args.query).queryClass;

  if (shouldPreferModelSynthesis(args.query, queryClass)) return false;
  if (queryClass === "broad_summary" || broadManagementSynthesisPattern.test(args.query)) return false;
  if (documents > 1 && comparisonQueryPattern.test(args.query)) return false;
  if (queryClass === "comparison") return false;
  if (extractiveBlockPattern.test(args.query) && !directTitleSupport) return false;
  if (!extractiveQuestionPattern.test(args.query) && !directTitleSupport) return false;

  if (hasActionableConflictOrGap(args.conflictsOrGaps) && !directTitleSupport && strongestScore < 0.82) return false;

  if (
    queryClass === "document_lookup" &&
    (hasExplicitDocumentLookupIntent(args.query) ||
      hasSourceSupportLookupIntent(args.query) ||
      hasQuoteOrSourceLocationIntent(args.query)) &&
    (directTitleSupport || strongestScore >= 0.72)
  ) {
    return true;
  }

  if (hasSourceSupportLookupIntent(args.query) || hasQuoteOrSourceLocationIntent(args.query)) {
    return directTitleSupport || strongestScore >= 0.4 || topTextRank >= 0.04;
  }

  if (
    hasExplicitTableOrVisualLookupIntent(args.query) &&
    hasTableOrVisualSourceSupport(args.results) &&
    (directTitleSupport || strongestScore >= extractiveRetrievalThreshold || topTextRank >= 0.08)
  ) {
    return true;
  }

  return false;
}

/** Choose answer route. */
export function chooseAnswerRoute(args: {
  query: string;
  results: SearchResult[];
  queryClass?: RagQueryClass;
  conflictsOrGaps?: ConflictOrGap[];
  fastModel: string;
  strongModel: string;
}): AnswerRoute {
  const strongestScore = strongestRetrievalScore(args.results);
  const documents = documentCount(args.results);
  const directTitleSupport = hasDirectTitleSupport(args.query, args.results);
  const specificTitleSupport = hasSpecificTitleSupport(args.query, args.results);
  const queryClass = args.queryClass ?? classifyRagQuery(args.query).queryClass;
  const topTextRank = Math.max(0, ...args.results.map((result) => result.text_rank ?? 0));

  // Refuse queries whose intent is to manipulate the model (fabricate citations,
  // pretend the evidence supports a claim, override instructions, exfiltrate
  // secrets). This fires before any retrieval-score routing so a query that
  // happens to surface real sources still fails closed.
  if (hasAdversarialManipulationIntent(args.query)) {
    return {
      mode: "unsupported",
      model: null,
      reason: "adversarial_manipulation_refused",
      strongestScore,
      documentCount: documents,
    };
  }

  if (args.results.length === 0) {
    return {
      mode: "unsupported",
      model: null,
      reason: "no_retrieved_sources",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    queryClass === "table_threshold" &&
    requiresAtomicMedicationThresholdEvidence(args.query) &&
    medicationMonitoringQuerySubjectTokens(args.query).length > 0 &&
    !hasAtomicMedicationThresholdEvidence(args.query, args.results)
  ) {
    return {
      mode: "unsupported",
      model: null,
      reason: "missing_structured_threshold_subject_evidence",
      strongestScore,
      documentCount: documents,
    };
  }

  if (strongestScore < unsupportedSimilarityThreshold && !hasTextSupport(args.results) && !directTitleSupport) {
    return {
      mode: "unsupported",
      model: null,
      reason: "no_plausible_source_support",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    queryClass === "document_lookup" &&
    ((!directTitleSupport && hasExplicitDocumentLookupIntent(args.query) && topTextRank < 0.08) ||
      (directTitleSupport &&
        (hasExplicitDocumentLookupIntent(args.query) || /\bchecklist\b/i.test(args.query)) &&
        !specificTitleSupport &&
        !hasAdmissionCommunityLookupIntent(args.query)))
  ) {
    return {
      mode: "unsupported",
      model: null,
      reason: "document_lookup_without_title_support",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    (queryClass === "medication_dose_risk" || queryClass === "table_threshold") &&
    strongestScore < 0.46 &&
    topTextRank < 0.02 &&
    !directTitleSupport
  ) {
    return {
      mode: "unsupported",
      model: null,
      reason: "weak_complex_query_support",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    queryClass === "unsupported_or_general" &&
    isComplexClinicalQuery(args.query) &&
    strongestScore < 0.46 &&
    topTextRank < 0.02 &&
    !directTitleSupport
  ) {
    return {
      mode: "unsupported",
      model: null,
      reason: "weak_complex_query_support",
      strongestScore,
      documentCount: documents,
    };
  }

  const crossDocumentIntent = routineCrossDocumentPattern.test(args.query) || queryClass === "broad_summary";
  const actionableConflictOrGap = hasActionableConflictOrGap(args.conflictsOrGaps);

  if (
    hasSourceSupportLookupIntent(args.query) &&
    (directTitleSupport || strongestScore >= 0.4 || topTextRank >= 0.04)
  ) {
    return {
      mode: "extractive",
      model: null,
      reason: "source_support_document_lookup",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    hasExplicitTableOrVisualLookupIntent(args.query) &&
    hasTableOrVisualSourceSupport(args.results) &&
    (directTitleSupport || strongestScore >= extractiveRetrievalThreshold || topTextRank >= 0.08)
  ) {
    return {
      mode: "extractive",
      model: null,
      reason: "explicit_table_or_source_lookup",
      strongestScore,
      documentCount: documents,
    };
  }

  if (queryClass === "broad_summary" && broadManagementSynthesisPattern.test(args.query)) {
    return {
      mode: "strong",
      model: args.strongModel,
      reason: "broad_clinical_management_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    documents > 1 &&
    crossDocumentIntent &&
    strongestScore >= strongRetrievalThreshold &&
    !hasConflictIntent(args.query) &&
    !actionableConflictOrGap
  ) {
    return {
      mode: "fast",
      model: args.fastModel,
      reason: "balanced_multi_document_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    queryClass === "comparison" ||
    (documents > 1 && comparisonQueryPattern.test(args.query) && !directTitleSupport)
  ) {
    if (
      documents > 1 &&
      strongestScore >= strongRetrievalThreshold &&
      !complexComparisonPattern.test(args.query) &&
      canBuildDeterministicComparison({ query: args.query, results: args.results })
    ) {
      return {
        mode: "extractive",
        model: null,
        reason: "structured_comparison_matrix",
        strongestScore,
        documentCount: documents,
      };
    }

    return {
      mode: "strong",
      model: args.strongModel,
      reason: "multi_document_comparison_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (queryClass === "medication_dose_risk" || queryClass === "table_threshold") {
    if (
      queryClass === "table_threshold" &&
      isClozapineBloodWithholdThresholdQuery(args.query) &&
      !hasExplicitBloodWithholdActionEvidence(args.results)
    ) {
      return {
        mode: "strong",
        model: args.strongModel,
        reason: "clinical_risk_or_complex_query",
        strongestScore,
        documentCount: documents,
      };
    }

    // A top-ranked atom that binds the queried medication, parameter and value
    // is stronger evidence than the result's blended retrieval score alone.
    // Keep this provider-free route tightly scoped to the first result and its
    // title so a lower-ranked match cannot rescue a foreign top result.
    if (
      queryClass === "table_threshold" &&
      requiresAtomicMedicationThresholdEvidence(args.query) &&
      hasDirectTitleSupport(args.query, args.results.slice(0, 1)) &&
      hasAtomicMedicationThresholdEvidence(args.query, args.results.slice(0, 1)) &&
      !actionableConflictOrGap
    ) {
      return {
        mode: "extractive",
        model: null,
        reason: "high_confidence_extractive_retrieval",
        strongestScore,
        documentCount: documents,
      };
    }

    if (
      queryClass === "table_threshold" &&
      directTitleSupport &&
      strongestScore >= strongRetrievalThreshold &&
      !actionableConflictOrGap
    ) {
      return {
        mode: "extractive",
        model: null,
        reason: "high_confidence_extractive_retrieval",
        strongestScore,
        documentCount: documents,
      };
    }

    if (
      queryClass === "medication_dose_risk" &&
      shouldUseExtractiveMedicationLookup({
        query: args.query,
        results: args.results,
        strongestScore,
        topTextRank,
        directTitleSupport,
      })
    ) {
      return {
        mode: "extractive",
        model: null,
        reason: "high_confidence_extractive_retrieval",
        strongestScore,
        documentCount: documents,
      };
    }

    if (
      shouldUseStrongClinicalRoute({
        query: args.query,
        queryClass,
        strongestScore,
        topTextRank,
        directTitleSupport,
        actionableConflictOrGap,
      })
    ) {
      return {
        mode: "strong",
        model: args.strongModel,
        reason:
          actionableConflictOrGap && !directTitleSupport
            ? "retrieval_gap_or_conflict"
            : "clinical_risk_or_complex_query",
        strongestScore,
        documentCount: documents,
      };
    }

    if (queryClass === "medication_dose_risk") {
      return {
        mode: "strong",
        model: args.strongModel,
        reason: MEDICATION_DOSE_RISK_STRONG_ROUTE_REASON,
        strongestScore,
        documentCount: documents,
      };
    }

    return {
      mode: "fast",
      model: args.fastModel,
      reason: "clinical_fast_grounded_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (clinicalPathwaySynthesisPattern.test(args.query) && queryClass !== "document_lookup") {
    if (
      shouldUseStrongClinicalRoute({
        query: args.query,
        queryClass,
        strongestScore,
        topTextRank,
        directTitleSupport,
        actionableConflictOrGap,
      })
    ) {
      return {
        mode: "strong",
        model: args.strongModel,
        reason:
          actionableConflictOrGap && !directTitleSupport
            ? "retrieval_gap_or_conflict"
            : "clinical_risk_or_complex_query",
        strongestScore,
        documentCount: documents,
      };
    }

    return {
      mode: "fast",
      model: args.fastModel,
      reason: "clinical_fast_grounded_synthesis",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    shouldUseExtractiveAnswer({
      query: args.query,
      results: args.results,
      queryClass,
      conflictsOrGaps: args.conflictsOrGaps,
    })
  ) {
    return {
      mode: "extractive",
      model: null,
      reason: "high_confidence_extractive_retrieval",
      strongestScore,
      documentCount: documents,
    };
  }

  if (
    queryClass === "document_lookup" &&
    directTitleSupport &&
    strongestScore >= strongRetrievalThreshold &&
    /\b(?:documentation|procedure|process|requirements?|required|include|includes)\b/i.test(args.query)
  ) {
    return {
      mode: "extractive",
      model: null,
      reason: "high_confidence_extractive_retrieval",
      strongestScore,
      documentCount: documents,
    };
  }

  if (isComplexClinicalQuery(args.query)) {
    return {
      mode: "strong",
      model: args.strongModel,
      reason: "clinical_risk_or_complex_query",
      strongestScore,
      documentCount: documents,
    };
  }

  if (strongestScore < strongRetrievalThreshold && !directTitleSupport) {
    return {
      mode: "strong",
      model: args.strongModel,
      reason: "limited_retrieval_strength",
      strongestScore,
      documentCount: documents,
    };
  }

  if (actionableConflictOrGap && !directTitleSupport) {
    return {
      mode: "strong",
      model: args.strongModel,
      reason: "retrieval_gap_or_conflict",
      strongestScore,
      documentCount: documents,
    };
  }

  return {
    mode: "fast",
    model: args.fastModel,
    reason: "strong_routine_retrieval",
    strongestScore,
    documentCount: documents,
  };
}

/** Should retry with strong after fast. */
export function shouldRetryWithStrongAfterFast(args: {
  route: AnswerRoute;
  answer: Pick<RagAnswer, "grounded" | "confidence" | "citations" | "routingReason">;
  results: SearchResult[];
}) {
  if (args.route.mode !== "fast") return false;
  if (args.answer.grounded && args.answer.confidence !== "unsupported" && args.answer.citations.length > 0) {
    return false;
  }

  const solidSourceSupport =
    strongestRetrievalScore(args.results) >= strongRetrievalThreshold && args.results.length > 0;
  if (args.answer.routingReason === "structured_parse_fallback") return solidSourceSupport;
  if (args.route.reason === "clinical_fast_grounded_synthesis") return solidSourceSupport;
  return solidSourceSupport && args.results.length >= 2;
}

/** Append routing reason. */
export function appendRoutingReason(reason: string | undefined, addition: string) {
  return reason ? `${reason}; ${addition}` : addition;
}
