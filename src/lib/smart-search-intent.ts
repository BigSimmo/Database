import type { AppModeId } from "@/lib/app-modes";
import { normalizeSearchText } from "@/lib/catalog-search";

export const smartNaturalSearchModeIds = [
  "services",
  "forms",
  "differentials",
  "formulation",
  "dsm",
  "specifiers",
  "therapy-compass",
] as const satisfies readonly AppModeId[];

export type SmartNaturalSearchModeId = (typeof smartNaturalSearchModeIds)[number];

export type SmartSearchInterpretation = {
  modeId: AppModeId;
  originalQuery: string;
  naturalLanguage: boolean;
  expansions: string[];
};

type ExpansionRule = { pattern: RegExp; terms: readonly string[] };

const modeExpansionRules: Record<SmartNaturalSearchModeId, readonly ExpansionRule[]> = {
  services: [
    { pattern: /\b(?:young person|young people|teen(?:ager)?s?)\b/i, terms: ["youth", "child", "adolescent"] },
    { pattern: /\b(?:after hours|out of hours|overnight)\b/i, terms: ["after hours", "24/7", "crisis"] },
    {
      pattern: /\b(?:after discharge|follow[ -]?up|ongoing support|community care)\b/i,
      terms: ["community", "follow-up", "post-discharge"],
    },
    { pattern: /\b(?:urgent|immediate|in crisis|crisis support)\b/i, terms: ["crisis", "emergency", "urgent"] },
    { pattern: /\b(?:older adult|older person|older people|elderly)\b/i, terms: ["older adult", "older people"] },
  ],
  forms: [
    {
      pattern: /\b(?:involuntary admission|detain|detention|compulsory admission)\b/i,
      terms: ["involuntary", "admission", "detention", "assessment"],
    },
    { pattern: /\b(?:move|moving)\b/i, terms: ["transfer", "transport", "movement"] },
    { pattern: /\b(?:extend(?:s|ed|ing)?|extension|continue detention)\b/i, terms: ["extension", "detention"] },
    { pattern: /\b(?:revoke|revocation|cancel an order)\b/i, terms: ["revocation", "order"] },
  ],
  differentials: [
    { pattern: /\b(?:hearing voices|hear voices|seeing things)\b/i, terms: ["hallucinations", "psychosis"] },
    { pattern: /\b(?:memory loss|memory problems?|forgetful)\b/i, terms: ["cognitive", "dementia", "memory"] },
    { pattern: /\b(?:low mood|feeling low)\b/i, terms: ["depression", "depressive"] },
    { pattern: /\b(?:high mood|elevated mood|little need for sleep)\b/i, terms: ["mania", "hypomania"] },
    { pattern: /\b(?:confused|confusion|disorientated|disoriented)\b/i, terms: ["delirium", "cognitive"] },
  ],
  formulation: [
    { pattern: /\b(?:keep going over|going over it|cannot stop thinking)\b/i, terms: ["rumination"] },
    { pattern: /\b(?:what if|constant worry|keeps worrying)\b/i, terms: ["worry"] },
    { pattern: /\b(?:not perfect|must be perfect|a failure)\b/i, terms: ["perfectionism"] },
    { pattern: /\b(?:not really there|disconnected|outside myself)\b/i, terms: ["dissociation"] },
    { pattern: /\b(?:avoid|avoiding|stays away from)\b/i, terms: ["avoidance"] },
  ],
  dsm: [
    { pattern: /\b(?:low mood|feeling low)\b/i, terms: ["depressive", "depression"] },
    { pattern: /\b(?:high mood|elevated mood|little need for sleep)\b/i, terms: ["mania", "hypomania", "bipolar"] },
    { pattern: /\b(?:hearing voices|hear voices|seeing things)\b/i, terms: ["psychosis", "schizophrenia"] },
    { pattern: /\b(?:flashbacks?|after trauma|traumatic event)\b/i, terms: ["trauma", "ptsd"] },
    { pattern: /\b(?:attention problems?|hyperactive|cannot concentrate)\b/i, terms: ["adhd", "attention"] },
  ],
  specifiers: [
    { pattern: /\b(?:anxious|anxiety symptoms?)\b/i, terms: ["anxious distress"] },
    { pattern: /\b(?:getting better|partly recovered|fully recovered)\b/i, terms: ["remission"] },
    { pattern: /\b(?:psychotic|with psychosis)\b/i, terms: ["psychotic features"] },
    { pattern: /\b(?:seasonal|time of year)\b/i, terms: ["seasonal pattern"] },
    { pattern: /\b(?:after birth|postpartum|during pregnancy)\b/i, terms: ["peripartum onset"] },
  ],
  "therapy-compass": [
    { pattern: /\b(?:after trauma|traumatic event|flashbacks?)\b/i, terms: ["trauma-focused", "ptsd"] },
    { pattern: /\b(?:young person|young people|teen(?:ager)?s?)\b/i, terms: ["youth", "child", "adolescent"] },
    { pattern: /\b(?:constant worry|worrying|anxiety symptoms?)\b/i, terms: ["anxiety", "worry"] },
    { pattern: /\b(?:low mood|feeling low)\b/i, terms: ["depression", "behavioural activation"] },
    { pattern: /\b(?:couple|relationship problems?)\b/i, terms: ["couples", "relationship"] },
    { pattern: /\b(?:emotion regulation|intense emotions?)\b/i, terms: ["dbt", "dialectical behaviour therapy"] },
  ],
};

const conversationalLeadPattern =
  /^(?:(?:please\s+)?(?:show|find|search(?:\s+for)?|look\s+up|help\s+me\s+find)|what|which|where|when|how|can|could|would|is|are|do|does)\b/i;
const compactCodePattern = /^(?:form\s+)?[a-z]{0,5}\s*\d{1,3}(?:\.\d+)?[a-z]?$/i;
const embeddedIdentifierPattern = /\b(?=[a-z0-9.]*[a-z])(?=[a-z0-9.]*\d)[a-z0-9.]{3,}\b/i;

function lexicalTokens(value: string): string[] {
  return value.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
}

export function isSmartNaturalSearchMode(modeId: AppModeId): modeId is SmartNaturalSearchModeId {
  return smartNaturalSearchModeIds.includes(modeId as SmartNaturalSearchModeId);
}

/**
 * Interprets a selected mode's query without a provider call.
 *
 * The original query remains the URL and user-visible value. Expansions are
 * low-weight catalogue vocabulary only: they broaden deterministic ranking and
 * never generate an answer, infer a diagnosis, or leave the selected mode.
 */
export function interpretSmartSearch(modeId: AppModeId, query: string): SmartSearchInterpretation {
  const originalQuery = query.trim();
  if (!originalQuery || !isSmartNaturalSearchMode(modeId)) {
    return { modeId, originalQuery, naturalLanguage: false, expansions: [] };
  }

  const withoutTerminalPunctuation = originalQuery.replace(/[?!.,;:]+$/u, "").trim();
  if (compactCodePattern.test(withoutTerminalPunctuation) || embeddedIdentifierPattern.test(originalQuery)) {
    return { modeId, originalQuery, naturalLanguage: false, expansions: [] };
  }

  const expansions = modeExpansionRules[modeId]
    .filter((rule) => rule.pattern.test(originalQuery))
    .flatMap((rule) => rule.terms)
    .map(normalizeSearchText)
    .filter(Boolean)
    .flatMap((term) => [term, ...term.split(" ").filter((token) => token.length > 1)]);
  const uniqueExpansions = Array.from(new Set(expansions)).slice(0, 16);
  const tokenCount = lexicalTokens(originalQuery).length;
  const naturalLanguage =
    uniqueExpansions.length > 0 ||
    originalQuery.endsWith("?") ||
    conversationalLeadPattern.test(originalQuery) ||
    tokenCount >= 4;

  return { modeId, originalQuery, naturalLanguage, expansions: uniqueExpansions };
}

export function smartSearchExpansions(modeId: AppModeId, query: string): string[] {
  return interpretSmartSearch(modeId, query).expansions;
}

export function expandedSmartSearchQuery(modeId: AppModeId, query: string): string {
  const interpretation = interpretSmartSearch(modeId, query);
  return [interpretation.originalQuery, ...interpretation.expansions].filter(Boolean).join(" ");
}
