import type { Therapy } from "./types";

/**
 * A related therapy, with the signal that put it on the list.
 *
 * The reason is not decoration. "Related therapies" without one asks the reader
 * to reverse-engineer why a suggestion is there, and on this catalogue the
 * honest answers differ a lot: one row can be a therapy this record explicitly
 * names as an alternative, and the next can be a therapy that merely treats the
 * same symptoms.
 */
export type RelatedTherapy = { therapy: Therapy; reason: string };

/** Weights, highest first. Named so the reason and the ranking cannot disagree. */
const NAMED_IN_RECORD = 8;
const NAMES_THIS_RECORD = 4;
const SAME_CATEGORY = 2;
const SHARED_TAG_SCALE = 1.2;
const SHARED_TARGET_SCALE = 0.25;

const WORD = /[a-z][a-z-]{3,}/g;

/**
 * Words too common in this corpus to carry similarity even before IDF: every
 * record is a therapy record, so "therapy", "patient" and "treatment" appear
 * almost everywhere and only add noise to the token overlap.
 */
const STOP_WORDS = new Set([
  "therapy",
  "therapies",
  "therapist",
  "patient",
  "patients",
  "treatment",
  "treatments",
  "clinical",
  "clinician",
  "session",
  "sessions",
  "with",
  "that",
  "this",
  "when",
  "where",
  "which",
  "from",
  "their",
  "them",
  "they",
  "have",
  "been",
  "into",
  "than",
  "then",
  "used",
  "using",
  "also",
  "more",
  "most",
  "such",
  "other",
  "over",
  "while",
]);

function inverseDocumentFrequency(documentCount: number, corpusSize: number): number {
  // Standard smoothed IDF. This is the whole point of the scorer: `Crisis/risk`
  // is on 196 of 205 records and `DBT` on 10, so an unweighted shared-tag count
  // ranks "both are therapies for unwell people" above "both are DBT".
  return Math.log(corpusSize / (1 + documentCount));
}

function targetWords(therapy: Therapy): Set<string> {
  const text = [therapy.targetSymptoms, therapy.bestUsedFor, therapy.mechanism].filter(Boolean).join(" ").toLowerCase();
  const words = new Set<string>();
  for (const match of text.matchAll(WORD)) {
    if (!STOP_WORDS.has(match[0])) words.add(match[0]);
  }
  return words;
}

/** Free prose in which this record may name another therapy. */
function mentionText(therapy: Therapy): string {
  return [
    therapy.alternatives,
    therapy.limitations,
    therapy.contraindicationsOrCautions,
    therapy.clinicalSummary,
    therapy.bestUsedFor,
    therapy.homework,
    therapy.commonPitfalls,
  ]
    .filter(Boolean)
    .join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * How a therapy's name appears when another record refers to it.
 *
 * Two matching modes, because the two name forms fail differently. Full names
 * are long and unambiguous, so they match case-insensitively. Acronyms are
 * short and collide with ordinary English — "ACT" as a therapy versus "act" as
 * a verb, "BA" versus a stray initialism — so they match case-sensitively
 * against the original prose, where the therapy sense is the capitalised one.
 */
function nameMatchers(therapy: Therapy): Array<{ pattern: RegExp; caseSensitive: boolean }> {
  const matchers: Array<{ pattern: RegExp; caseSensitive: boolean }> = [];
  const base = therapy.name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (base.length >= 6) {
    matchers.push({ pattern: new RegExp(`\\b${escapeRegExp(base.toLowerCase())}\\b`), caseSensitive: false });
  }
  const acronyms = new Set<string>();
  for (const alias of therapy.aliases) {
    const trimmed = alias.trim();
    if (trimmed.length >= 2 && trimmed === trimmed.toUpperCase()) acronyms.add(trimmed);
    else if (trimmed.length >= 6) {
      matchers.push({ pattern: new RegExp(`\\b${escapeRegExp(trimmed.toLowerCase())}\\b`), caseSensitive: false });
    }
  }
  for (const inner of therapy.name.matchAll(/\(([^)]+)\)/g)) {
    const value = inner[1].trim();
    if (value.length >= 2 && value.length <= 8 && value === value.toUpperCase()) acronyms.add(value);
  }
  for (const acronym of acronyms) {
    matchers.push({ pattern: new RegExp(`\\b${escapeRegExp(acronym)}\\b`), caseSensitive: true });
  }
  return matchers;
}

function mentions(text: string, matchers: ReturnType<typeof nameMatchers>): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return matchers.some((matcher) => matcher.pattern.test(matcher.caseSensitive ? text : lower));
}

/**
 * Identity key that collapses the catalogue's duplicate records.
 *
 * Two pairs exist today — "Supported digital trauma-focused CBT" also ships as
 * "Supported digital trauma-focused CBT (Self-Help & Digital Therapies)", and
 * CBT-I appears twice. Under any similarity scorer a record's own near-twin is
 * its single best match, so the list would open with what looks like the page
 * you are already on.
 */
function identityKey(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Nearest neighbours for one therapy, ranked by five signals and labelled with
 * the strongest one.
 *
 * Pure and deterministic: the same catalogue always produces the same list in
 * the same order, so the panel never reshuffles between renders. Ties break on
 * name.
 *
 * The signals, strongest first:
 * 1. this record names the candidate in its own prose — the catalogue's own
 *    editorial judgement, and the only signal an author wrote deliberately;
 * 2. the candidate names this record;
 * 3. IDF-weighted shared tags — a rare shared tag is evidence, a ubiquitous one
 *    is not;
 * 4. same category;
 * 5. IDF-weighted overlap in what the two therapies target.
 */
export function relatedTherapies(all: Therapy[], therapy: Therapy, limit = 4): RelatedTherapy[] {
  const corpusSize = all.length || 1;

  const tagDocuments = new Map<string, number>();
  const wordDocuments = new Map<string, number>();
  const wordsBySlug = new Map<string, Set<string>>();
  for (const record of all) {
    for (const tag of new Set(record.tags)) tagDocuments.set(tag, (tagDocuments.get(tag) ?? 0) + 1);
    const words = targetWords(record);
    wordsBySlug.set(record.slug, words);
    for (const word of words) wordDocuments.set(word, (wordDocuments.get(word) ?? 0) + 1);
  }

  const selfKey = identityKey(therapy.name);
  const selfTags = new Set(therapy.tags);
  const selfWords = wordsBySlug.get(therapy.slug) ?? targetWords(therapy);
  const selfMentionText = mentionText(therapy);
  const selfMatchers = nameMatchers(therapy);

  const scored = all
    .filter((candidate) => candidate.slug !== therapy.slug && identityKey(candidate.name) !== selfKey)
    .map((candidate) => {
      const contributions: Array<{ score: number; reason: string }> = [];

      if (mentions(selfMentionText, nameMatchers(candidate))) {
        contributions.push({ score: NAMED_IN_RECORD, reason: "Named in this record" });
      }
      if (mentions(mentionText(candidate), selfMatchers)) {
        contributions.push({ score: NAMES_THIS_RECORD, reason: "References this therapy" });
      }

      const sharedTags = candidate.tags.filter((tag) => selfTags.has(tag));
      if (sharedTags.length) {
        let best = sharedTags[0];
        let bestWeight = -Infinity;
        let total = 0;
        for (const tag of sharedTags) {
          const weight = inverseDocumentFrequency(tagDocuments.get(tag) ?? 0, corpusSize);
          total += weight;
          if (weight > bestWeight || (weight === bestWeight && tag < best)) {
            bestWeight = weight;
            best = tag;
          }
        }
        contributions.push({ score: total * SHARED_TAG_SCALE, reason: `Also for ${best.toLowerCase()}` });
      }

      if (candidate.category === therapy.category) {
        contributions.push({ score: SAME_CATEGORY, reason: "Same family" });
      }

      const candidateWords = wordsBySlug.get(candidate.slug) ?? targetWords(candidate);
      let overlap = 0;
      for (const word of candidateWords) {
        if (selfWords.has(word)) overlap += inverseDocumentFrequency(wordDocuments.get(word) ?? 0, corpusSize);
      }
      if (overlap > 0) {
        contributions.push({ score: overlap * SHARED_TARGET_SCALE, reason: "Similar targets" });
      }

      const score = contributions.reduce((sum, entry) => sum + entry.score, 0);
      // Label with the strongest *kind* of signal present, not the largest
      // contribution. Shared-tag IDF is summed, so several moderately rare tags
      // can outscore NAMED_IN_RECORD even though the editorial name mention is
      // the explanation this browsing surface should lead with. Contributions
      // are already pushed in documented strongest-first order.
      return { therapy: candidate, score, reason: contributions[0]?.reason ?? "Related record" };
    })
    .filter((entry) => entry.score > 0);

  scored.sort((a, b) => b.score - a.score || a.therapy.name.localeCompare(b.therapy.name));
  return scored.slice(0, limit).map(({ therapy: record, reason }) => ({ therapy: record, reason }));
}
