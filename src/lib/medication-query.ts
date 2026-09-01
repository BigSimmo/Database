// Medications-catalog query understanding: typo correction, brand↔generic
// expansion, and conservative near-miss matching for /api/medications and the
// medications universal-search domain. Kept separate from clinical-search /
// RAG so catalog recall can grow without changing retrieval analysis.

import { medicationAliasesForEntity, medicationEntitiesInText } from "@/lib/medication-entities";
import {
  medicationBrandNames,
  normalizeSearchText,
  rankMedicationRecords,
  type MedicationRecord,
  type MedicationSearchMatch,
} from "@/lib/medications";

export type MedicationCatalogCorrection = {
  from: string;
  to: string;
};

export type MedicationCatalogQueryAnalysis = {
  originalQuery: string;
  correctedQuery: string;
  corrections: MedicationCatalogCorrection[];
  expansions: string[];
};

// Curated psychotropic / common prescribing typos. Local to the catalog path so
// expanding this map cannot change RAG query analysis in clinical-search.
const medicationTypoCorrections = new Map<string, string>([
  ["sertaline", "sertraline"],
  ["sertralne", "sertraline"],
  ["sertralin", "sertraline"],
  ["olanzpine", "olanzapine"],
  ["olanzapin", "olanzapine"],
  ["quietapine", "quetiapine"],
  ["quetiapin", "quetiapine"],
  ["quetiapne", "quetiapine"],
  ["risperdone", "risperidone"],
  ["risperidon", "risperidone"],
  ["aripiprazol", "aripiprazole"],
  ["aripiprazloe", "aripiprazole"],
  ["clozapin", "clozapine"],
  ["clozapene", "clozapine"],
  ["clozapinw", "clozapine"],
  ["mirtazpine", "mirtazapine"],
  ["mirtazapin", "mirtazapine"],
  ["venlafaxne", "venlafaxine"],
  ["duloxetin", "duloxetine"],
  ["escitaloprame", "escitalopram"],
  ["fluoxetin", "fluoxetine"],
  ["paroxetin", "paroxetine"],
  ["haloperidl", "haloperidol"],
  ["lorazapam", "lorazepam"],
  ["diazapam", "diazepam"],
  ["valporate", "valproate"],
  ["valproat", "valproate"],
  ["lithum", "lithium"],
  ["acamprosat", "acamprosate"],
  ["camprl", "campral"],
  ["zolof", "zoloft"],
  ["zyprex", "zyprexa"],
  ["seroqel", "seroquel"],
]);

const fuzzyMinTokenLength = 6;
const maxExpansions = 16;

function queryTokens(query: string): string[] {
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function addNormalizedTokens(target: Set<string>, value: string) {
  for (const token of queryTokens(value)) {
    if (token.length > 1) target.add(token);
  }
}

/** Vocabulary of generic names, slugs, brand tokens, and safety-identity aliases. */
export function buildMedicationCatalogVocabulary(records: MedicationRecord[]): Set<string> {
  const vocab = new Set<string>();
  for (const record of records) {
    addNormalizedTokens(vocab, record.name);
    addNormalizedTokens(vocab, record.slug.replace(/-/g, " "));
    for (const brand of medicationBrandNames(record)) {
      addNormalizedTokens(vocab, brand);
    }
    for (const alias of medicationAliasesForEntity(record.name)) {
      addNormalizedTokens(vocab, alias);
    }
  }
  // Also index identity aliases that may not share a catalog name token
  // (e.g. "zyprexa" when only formulation-named records exist).
  for (const record of records) {
    for (const brand of medicationBrandNames(record)) {
      for (const alias of medicationAliasesForEntity(brand)) {
        addNormalizedTokens(vocab, alias);
      }
    }
  }
  return vocab;
}

/** True when Levenshtein distance is exactly 1 (substitution, insertion, or deletion). */
export function isEditDistanceOne(left: string, right: string): boolean {
  if (left === right) return false;
  const a = left;
  const b = right;
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < lenA && j < lenB) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (lenA > lenB) i += 1;
    else if (lenB > lenA) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  if (i < lenA || j < lenB) edits += 1;
  return edits === 1;
}

function uniqueEditDistanceOneMatch(token: string, vocabulary: Set<string>): string | undefined {
  if (token.length < fuzzyMinTokenLength || vocabulary.has(token)) return undefined;
  let match: string | undefined;
  for (const candidate of vocabulary) {
    if (Math.abs(candidate.length - token.length) > 1) continue;
    if (!isEditDistanceOne(token, candidate)) continue;
    if (match && match !== candidate) return undefined;
    match = candidate;
  }
  return match;
}

function brandOrNameExpansions(token: string, records: MedicationRecord[]): string[] {
  const expansions: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const normalized = normalizeSearchText(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    expansions.push(normalized);
  };

  for (const entity of medicationEntitiesInText(token)) {
    push(entity);
    for (const alias of medicationAliasesForEntity(entity)) push(alias);
  }

  const needle = normalizeSearchText(token);
  if (!needle) return expansions;

  for (const record of records) {
    const name = normalizeSearchText(record.name);
    const slug = normalizeSearchText(record.slug.replace(/-/g, " "));
    const brands = medicationBrandNames(record).map((brand) => normalizeSearchText(brand));
    const hitsName = name === needle || name.split(/\s+/).includes(needle) || slug.split(/\s+/).includes(needle);
    const hitsBrand = brands.some((brand) => brand === needle || brand.split(/\s+/).includes(needle));
    if (!hitsName && !hitsBrand) continue;
    // Expand to the canonical identity only. Sibling brands must not enter the
    // expanded content lane — substring includes() would let "eleva" match
    // "elevated" and pull unrelated records into brand queries like "zoloft".
    push(record.name);
    push(record.slug.replace(/-/g, " "));
    for (const alias of medicationAliasesForEntity(record.name)) push(alias);
  }

  return expansions;
}

/**
 * Correct typos and collect brand/generic expansions for medication catalog ranking.
 * Does not call clinical-search or RAG helpers.
 */
export function analyzeMedicationCatalogQuery(
  query: string,
  records: MedicationRecord[],
): MedicationCatalogQueryAnalysis {
  const originalQuery = query.trim();
  if (!originalQuery) {
    return { originalQuery: "", correctedQuery: "", corrections: [], expansions: [] };
  }

  const vocabulary = buildMedicationCatalogVocabulary(records);
  const rawTokens = originalQuery.split(/\s+/).filter(Boolean);
  const corrections: MedicationCatalogCorrection[] = [];
  const correctedTokens: string[] = [];

  for (const raw of rawTokens) {
    const lower = raw.toLowerCase();
    const normalized = normalizeSearchText(raw);
    const mapped = medicationTypoCorrections.get(lower) ?? medicationTypoCorrections.get(normalized);
    if (mapped && mapped !== normalized && mapped !== lower) {
      corrections.push({ from: lower, to: mapped });
      correctedTokens.push(mapped);
      continue;
    }
    const fuzzy = normalized ? uniqueEditDistanceOneMatch(normalized, vocabulary) : undefined;
    if (fuzzy) {
      corrections.push({ from: normalized, to: fuzzy });
      correctedTokens.push(fuzzy);
      continue;
    }
    correctedTokens.push(raw);
  }

  const correctedQuery = correctedTokens.join(" ");
  const baseTokens = new Set(queryTokens(correctedQuery));
  const expansionSeen = new Set<string>(baseTokens);
  const expansions: string[] = [];

  for (const token of queryTokens(correctedQuery)) {
    for (const term of brandOrNameExpansions(token, records)) {
      for (const piece of queryTokens(term)) {
        if (piece.length < 2 || expansionSeen.has(piece)) continue;
        expansionSeen.add(piece);
        expansions.push(piece);
        if (expansions.length >= maxExpansions) {
          return { originalQuery, correctedQuery, corrections, expansions };
        }
      }
    }
  }

  return { originalQuery, correctedQuery, corrections, expansions };
}

export function searchMedicationCatalog(
  records: MedicationRecord[],
  query: string,
  limit = 50,
  rankingExpansions: readonly string[] = [],
): {
  matches: MedicationSearchMatch[];
  analysis: MedicationCatalogQueryAnalysis;
} {
  const analysis = analyzeMedicationCatalogQuery(query, records);
  const rankExpansions = [...new Set([...analysis.expansions, ...rankingExpansions])];
  const matches = analysis.correctedQuery
    ? rankMedicationRecords(records, analysis.correctedQuery, limit, rankExpansions)
    : [];
  return { matches, analysis };
}

export function medicationCatalogInterpretation(analysis: MedicationCatalogQueryAnalysis) {
  if (!analysis.corrections.length && !analysis.expansions.length) return undefined;
  return {
    correctedQuery:
      analysis.corrections.length && analysis.correctedQuery !== analysis.originalQuery
        ? analysis.correctedQuery
        : undefined,
    corrections: analysis.corrections.length ? analysis.corrections : undefined,
    appliedExpansions: analysis.expansions.length ? analysis.expansions : undefined,
  };
}
