import type { Therapy } from "./types";
import { scoreTherapyCandidate } from "@/lib/therapy-ranking";
import { expandedSmartSearchQuery } from "@/lib/smart-search-intent";

// ---- text helpers -------------------------------------------------------

const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();

/** Split a numbered / newline / sentence delivery-step blob into clean steps. */
export function parseSteps(text: string | null, max = 12): string[] {
  if (!text) return [];
  const clean = (arr: string[]) =>
    arr
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, max);

  // 1) Newline-delimited list (strip leading "1." / "1)" markers).
  const byLine = text
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  if (byLine.length > 1) return clean(byLine);

  // 2) Inline numbered markers ("1. Build … 2. Identify …"): split ON the
  //    markers so a bare "1." never becomes its own step.
  const markerCount = text.match(/\d+[.)]\s+\S/g)?.length ?? 0;
  if (markerCount > 1) {
    const byMarker = text.split(/\s*\d+[.)]\s+/).filter((x) => x.trim());
    if (byMarker.length > 1) return clean(byMarker);
  }

  // 3) Arrow-separated steps ("Build engagement → set goals → …"). 52 of the
  //    205 records write their delivery this way, and without this they render
  //    as one unbroken sentence occupying half a phone screen.
  //
  //    Strictly AFTER the numbered check, never before it. Three records
  //    (behaviour-therapy, exposure-based-cbt, interoceptive-exposure) number
  //    their steps and use an arrow *inside* one of them to write a causal
  //    chain — "linking cue → behaviour → short-term payoff → long-term cost".
  //    Splitting on arrows first shreds that clinical formulation into
  //    fragments, which is worse than the wall of text this rule exists to fix.
  const byArrow = text
    .split(/\s*(?:→|->|➔|⟶)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (byArrow.length > 1) return clean(byArrow);

  // 4) Fall back to sentence boundaries (before a capital letter only, so a
  //    numeric marker isn't treated as a new sentence).
  return clean(text.split(/(?<=\.)\s+(?=[A-Z])/));
}

/** First N sentences of a longer text, for previews. */
export function summarise(text: string | null, sentences = 1): string {
  if (!text) return "";
  const parts = text.split(/(?<=\.)\s+/);
  return parts.slice(0, sentences).join(" ").trim();
}

/**
 * True when a sentence is only a therapy-name restatement, or starts with that
 * name before a word boundary (alias suffixes like `(CT)` / `, DT`, or prose
 * such as "Behavioural activation is…"). Prefix-sharing words without a
 * boundary ("Behavioural activationism") stay.
 */
function isExcludedTitleSentence(part: string, exclude: string): boolean {
  if (!exclude) return false;
  const normalized = part.toLowerCase().replace(/[.]+$/, "").trim();
  if (!normalized) return false;
  if (normalized === exclude) return true;
  const escaped = exclude.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}\\b`).test(normalized);
}

/**
 * Compact card copy: skip a leading sentence that merely restates the therapy
 * name (common in clinicalSummary), then return up to `maxSentences` of the
 * remainder. Empty when nothing useful remains.
 */
export function cardPreviewText(
  text: string | null | undefined,
  options: { exclude?: string | null; maxSentences?: number } = {},
): string {
  if (!text) return "";
  const maxSentences = options.maxSentences ?? 1;
  const exclude = (options.exclude ?? "").trim().toLowerCase().replace(/[.]+$/, "");
  const parts = text
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const useful = parts.filter((part) => !isExcludedTitleSentence(part, exclude));

  return useful.slice(0, maxSentences).join(" ").trim();
}

/**
 * Surface filter/query-relevant tags first so a one-row TagRow shows what
 * matched the search rather than the catalogue's domain prefix.
 */
export function prioritiseTherapyTags(
  tags: string[],
  options: { query?: string; activeTags?: string[] } = {},
): string[] {
  if (!tags.length) return tags;
  const active = new Set((options.activeTags ?? []).map((tag) => tag.toLowerCase()));
  const tokens = (options.query ?? "")
    .toLowerCase()
    .split(/[^a-z0-9/+-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  const rank = (tag: string) => {
    const lower = tag.toLowerCase();
    if (active.has(lower)) return 0;
    if (tokens.some((token) => lower === token || lower.includes(token) || token.includes(lower))) {
      return 1;
    }
    return 2;
  };

  return tags
    .map((tag, index) => ({ tag, index, rank: rank(tag) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.tag);
}

export function reviewStatusMeta(status: string): { label: string; tone: "warning" | "success" | "neutral" } {
  if (status === "reviewed") return { label: "Reviewed", tone: "success" };
  if (status === "needs_review") return { label: "Needs source review", tone: "warning" };
  return { label: status.replace(/_/g, " "), tone: "neutral" };
}

/**
 * The part of `indications` that is not already on the page.
 *
 * Every record in the catalogue builds `indications` by concatenating
 * `bestUsedFor`, then `targetSymptoms`, then the treatment goals. Rendering the
 * field whole therefore repeats two blocks the reader has just read, at length
 * — which is exactly what made the old "When to use" section a wall of text on
 * a phone.
 *
 * Both components are removed only when they are genuinely present, so a record
 * that ever stops following that shape degrades to showing its `indications`
 * unchanged rather than losing clinical content. A residue too short to be a
 * sentence is treated as punctuation left behind, not as content.
 */
export function splitIndications(therapy: Therapy): string | null {
  const indications = therapy.indications?.trim();
  if (!indications) return null;

  let rest = indications;
  const bestUsedFor = therapy.bestUsedFor?.trim();
  if (bestUsedFor && rest.toLowerCase().startsWith(bestUsedFor.toLowerCase())) {
    rest = rest.slice(bestUsedFor.length);
  }
  const targetSymptoms = therapy.targetSymptoms?.trim();
  if (targetSymptoms) {
    const at = rest.toLowerCase().indexOf(targetSymptoms.toLowerCase());
    if (at >= 0) rest = `${rest.slice(0, at)} ${rest.slice(at + targetSymptoms.length)}`;
  }

  const residue = rest
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:]+/, "")
    .trim();
  // Nothing was removed: the record does not follow the concatenated shape, so
  // show the field as authored rather than guessing at its structure.
  if (residue === indications) return indications;
  return residue.length >= 20 ? residue : null;
}

export function complexityLabel(complexity: string | null): string {
  if (!complexity) return "Complexity not set";
  const c = complexity.toLowerCase();
  return `${c.charAt(0).toUpperCase()}${c.slice(1)} complexity`;
}

// ---- search -------------------------------------------------------------

export type SearchOptions = {
  query: string;
  tags: string[]; // therapy must carry ANY selected tag (OR within the group — see matchesTopics)
  briefOnly: boolean;
  sheetOnly: boolean;
  reviewedOnly: boolean;
};

export const EMPTY_SEARCH: SearchOptions = {
  query: "",
  tags: [],
  briefOnly: false,
  sheetOnly: false,
  reviewedOnly: false,
};

/**
 * Topics facet predicate — OR within the group, matching every other adopted
 * facet in the app (docs/filter-contract.md section 1). Picking both CBT and
 * DBT means "either", not "a therapy tagged with both": AND-within-group is
 * the exact defect class already fixed for document tags, where it made a
 * second selection within one group a dead affordance instead of a widen.
 *
 * Exported so the filter sheet's option counts (`searchTherapies`'s own
 * `hint` predicate) and the real filter run through one function — the count
 * must be produced by the same predicate as the filter, or the two drift
 * apart the moment the combination rule changes (section 3).
 */
export function matchesTopics(therapy: Therapy, topics: ReadonlySet<string>): boolean {
  if (topics.size === 0) return true;
  const wanted = [...topics].map(lc);
  return therapy.tags.some((tag) => wanted.includes(lc(tag)));
}

/**
 * Availability facet predicate — reviewed status and brief-intervention
 * availability are independent constraints that AND together (they are two
 * separate one-option facet groups, not options inside one group), and each
 * ANDs against Topics in turn. Neither combines with the other by OR.
 */
export function matchesAvailability(therapy: Therapy, reviewedOnly: boolean, briefOnly: boolean): boolean {
  if (reviewedOnly && therapy.reviewStatus !== "reviewed") return false;
  if (briefOnly && !therapy.briefInterventionAvailable) return false;
  return true;
}

export function searchTherapies(
  therapies: Therapy[],
  opts: SearchOptions,
  interpretNaturalLanguage = false,
): Therapy[] {
  const q = (interpretNaturalLanguage ? expandedSmartSearchQuery("therapy-compass", opts.query) : opts.query)
    .trim()
    .toLowerCase();
  const topics = new Set(opts.tags);
  const scored = therapies
    .map((t) => {
      if (!matchesAvailability(t, opts.reviewedOnly, opts.briefOnly)) return null;
      if (opts.sheetOnly && !t.patientSheetAvailable) return null;
      if (!matchesTopics(t, topics)) return null;
      const score = scoreTherapyCandidate(t, q);
      return score > 0 ? { t, s: score } : null;
    })
    .filter((candidate): candidate is { t: Therapy; s: number } => candidate !== null);
  scored.sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name));
  return scored.map((x) => x.t);
}

// ---- recommend ----------------------------------------------------------

export type RecommendConstraintGroupId = "setting" | "time" | "support" | "cautions";

export type RecommendConstraint = {
  key: string;
  label: string;
  group: RecommendConstraintGroupId;
  // Positive boost when the therapy matches; used to rank.
  match: (t: Therapy) => boolean;
};

export const RECOMMEND_CONSTRAINT_GROUPS: Array<{ id: RecommendConstraintGroupId; label: string }> = [
  { id: "setting", label: "Setting" },
  { id: "time", label: "Time" },
  { id: "support", label: "Support" },
  { id: "cautions", label: "Cautions" },
];

export const RECOMMEND_CONSTRAINTS: RecommendConstraint[] = [
  {
    key: "outpatient",
    label: "Outpatient",
    group: "setting",
    match: (t) => /outpatient|community|ambulatory|clinic|primary care/.test(lc(t.setting)),
  },
  {
    key: "inpatient",
    label: "Inpatient",
    group: "setting",
    match: (t) => /inpatient|ward|hospital/.test(lc(t.setting)),
  },
  {
    key: "5min",
    label: "5 minutes",
    group: "time",
    match: (t) => t.briefInterventionAvailable && !!t.briefVersion,
  },
  {
    key: "15min",
    label: "15 minutes",
    group: "time",
    match: (t) => !!t.fifteenMinuteVersion || t.briefInterventionAvailable,
  },
  { key: "handout", label: "Handout", group: "support", match: (t) => t.patientSheetAvailable },
  {
    key: "grounding",
    label: "Grounding",
    group: "support",
    match: (t) => lc(`${t.tags.join(" ")} ${t.name} ${t.bestUsedFor}`).match(/ground|relax|distress|arousal/) != null,
  },
  {
    key: "skills",
    label: "Skills",
    group: "support",
    match: (t) => lc(`${t.tags.join(" ")} ${t.name} ${t.bestUsedFor}`).match(/skill|dbt|cbt|behav/) != null,
  },
  {
    key: "psychoeducation",
    label: "Psychoeducation",
    group: "support",
    match: (t) => lc(`${t.name} ${t.tags.join(" ")} ${t.bestUsedFor}`).includes("psychoeduc"),
  },
  {
    key: "trauma",
    label: "Trauma caution",
    group: "cautions",
    match: (t) => t.tags.map(lc).includes("trauma") || /trauma|ptsd/.test(lc(t.name)),
  },
  {
    key: "avoid-mania",
    label: "Avoid mania",
    group: "cautions",
    match: (t) => !/mania|hypomania/.test(lc(`${t.contraindicationsOrCautions} ${t.limitations}`)),
  },
];

export type Ranked = { therapy: Therapy; score: number; reasons: string[] };

const RECOMMEND_STOPWORDS = new Set([
  "what",
  "which",
  "therapy",
  "therapies",
  "treatment",
  "treatments",
  "for",
  "in",
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "with",
  "care",
  "help",
  "choosing",
  "need",
  "do",
  "you",
  "i",
  "patient",
  "someone",
  "who",
  "has",
  "have",
  "is",
  "are",
  "this",
  "that",
  "from",
  "into",
  "about",
]);

/** Setting / time / format words that must not count as clinical “treats” hits. */
const RECOMMEND_LOGISTICS_TOKENS = new Set([
  "outpatient",
  "inpatient",
  "community",
  "ambulatory",
  "clinic",
  "ward",
  "hospital",
  "minutes",
  "minute",
  "handout",
  "sheet",
  "leaflet",
]);

const RECOMMEND_RELEVANCE_FLOOR_WITH_QUERY = 18;
const RECOMMEND_RELEVANCE_FLOOR_CONSTRAINTS_ONLY = 8;
const RECOMMEND_NAME_SCORE_CAP = 40;

function uniqueKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of keys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

/** Clinical tokens from a situation, with catalogue-search stopwords removed. */
export function recommendQueryTokens(query: string): string[] {
  return lc(query)
    .replace(/[^a-z0-9\s/+-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !RECOMMEND_STOPWORDS.has(token));
}

/**
 * Infer constraint chips from free-text situation language. Explicit chip
 * toggles still win via {@link resolveRecommendConstraints}.
 */
export function inferRecommendConstraints(query: string): string[] {
  const q = lc(query);
  const inferred: string[] = [];
  if (/\boutpatient\b|\bcommunity\b|\bambulatory\b|\bclinic\b/.test(q)) inferred.push("outpatient");
  if (/\binpatient\b|\bward\b|\badmission\b|\bin-?patient\b/.test(q)) inferred.push("inpatient");
  if (/\b5\s*-?\s*min|\bfive[-\s]?minute|\bmicro[-\s]?session\b/.test(q)) inferred.push("5min");
  if (/\b15\s*-?\s*min|\bfifteen[-\s]?minute/.test(q)) inferred.push("15min");
  if (/\bhandout\b|\bsheet\b|\bleaflet\b/.test(q)) inferred.push("handout");
  if (/\bground(?:ing)?\b/.test(q)) inferred.push("grounding");
  if (/\bskills?\b/.test(q)) inferred.push("skills");
  if (/\bpsychoeduc/.test(q)) inferred.push("psychoeducation");
  if (/\btrauma\b|\bptsd\b/.test(q)) inferred.push("trauma");
  if (/\bmania\b|\bmanic\b|\bhypomania\b|\bbipolar\b/.test(q)) inferred.push("avoid-mania");
  return inferred;
}

export function resolveRecommendConstraints(
  query: string,
  explicitKeys: string[],
  dismissedKeys: string[] = [],
): string[] {
  const dismissed = new Set(dismissedKeys);
  return uniqueKeys([...explicitKeys, ...inferRecommendConstraints(query)].filter((key) => !dismissed.has(key)));
}

function fieldContains(value: string | null | undefined, token: string): boolean {
  return Boolean(value) && lc(value).includes(token);
}

function cautionHaystack(t: Therapy): string {
  return lc(`${t.contraindicationsOrCautions} ${t.limitations} ${t.warnings.join(" ")}`);
}

function clinicalFieldScore(t: Therapy, tokens: string[]): { score: number; reasons: string[] } {
  const presentationTokens = tokens.filter((token) => !RECOMMEND_LOGISTICS_TOKENS.has(token));
  const logisticsTokens = tokens.filter((token) => RECOMMEND_LOGISTICS_TOKENS.has(token));
  let score = 0;
  const reasons: string[] = [];
  let treatsHits = 0;
  let settingHits = 0;
  for (const token of presentationTokens) {
    if (
      fieldContains(t.targetSymptoms, token) ||
      fieldContains(t.indications, token) ||
      fieldContains(t.bestUsedFor, token)
    ) {
      treatsHits += 1;
      score += 16;
    } else if (fieldContains(t.clinicalSummary, token)) {
      score += 5;
    }
  }
  for (const token of uniqueKeys([...presentationTokens, ...logisticsTokens])) {
    if (fieldContains(t.setting, token) || fieldContains(t.patientPopulation, token)) {
      settingHits += 1;
      score += 8;
    }
    if (fieldContains(t.timeRequired, token) || fieldContains(t.sessionLength, token)) {
      score += 6;
    }
  }
  if (treatsHits) {
    reasons.push(treatsHits === 1 ? "Matches the described presentation" : "Matches several presentation terms");
  }
  if (settingHits) reasons.push("Fits the stated setting or population");
  return { score, reasons };
}

export function rankRecommendations(
  therapies: Therapy[],
  query: string,
  constraintKeys: string[],
  limit = 6,
): Ranked[] {
  const tokens = recommendQueryTokens(query);
  const presentationQuery = tokens.filter((token) => !RECOMMEND_LOGISTICS_TOKENS.has(token)).join(" ");
  const cons = RECOMMEND_CONSTRAINTS.filter((c) => constraintKeys.includes(c.key));
  const floor = tokens.length
    ? RECOMMEND_RELEVANCE_FLOOR_WITH_QUERY
    : cons.length
      ? RECOMMEND_RELEVANCE_FLOOR_CONSTRAINTS_ONLY
      : Number.POSITIVE_INFINITY;

  const scored = therapies.map((t) => {
    const reasons: string[] = [];
    let score = 0;
    if (presentationQuery) score += Math.min(scoreTherapyCandidate(t, presentationQuery), RECOMMEND_NAME_SCORE_CAP);
    const fields = clinicalFieldScore(t, tokens);
    score += fields.score;
    reasons.push(...fields.reasons);

    for (const c of cons) {
      if (c.key === "avoid-mania") {
        if (/mania|hypomania|activation/.test(cautionHaystack(t))) {
          score -= 28;
          reasons.push("Caution: mania or activation risk");
        }
        continue;
      }
      if (c.key === "trauma") {
        const risky = /not (?:for|indicated in) trauma|contraindicat\w* in (?:trauma|ptsd)|avoid (?:in )?trauma/.test(
          cautionHaystack(t),
        );
        if (risky) {
          score -= 22;
          reasons.push("Caution: trauma contraindication");
        } else if (c.match(t)) {
          score += 12;
          reasons.push("Trauma-informed option");
        } else {
          score -= 18;
        }
        continue;
      }
      if (c.match(t)) {
        score += 12;
        if (c.group === "setting" || c.group === "time") reasons.push(`Fits ${c.label.toLowerCase()}`);
      } else {
        score -= 18;
      }
    }

    if (t.reviewStatus === "reviewed") score += 4;
    if (typeof t.indexCompleteness === "number") score += t.indexCompleteness / 100;
    const orderedReasons = uniqueKeys(reasons);
    const cautionReasons = orderedReasons.filter((reason) => reason.startsWith("Caution:"));
    const otherReasons = orderedReasons.filter((reason) => !reason.startsWith("Caution:"));
    return { therapy: t, score, reasons: [...cautionReasons, ...otherReasons].slice(0, 4) };
  });
  scored.sort((a, b) => b.score - a.score || a.therapy.name.localeCompare(b.therapy.name));
  return scored.filter((row) => row.score >= floor).slice(0, limit);
}

// ---- compare summary ----------------------------------------------------

export function needsReviewCount(therapies: Therapy[]): number {
  return therapies.filter((t) => t.reviewStatus !== "reviewed").length;
}

/**
 * Rough duration weight (in a notional "minutes" scale) from free-form
 * `timeRequired` prose. Uses the smallest number present (a range like
 * "8–12 sessions" is bounded by its low end) and scales sessions/weeks up
 * relative to minutes so a minute-based brief ranks below a multi-session course.
 */
function durationWeight(t: Therapy): number {
  const s = lc(t.timeRequired);
  const nums = (s.match(/\d+/g) ?? []).map(Number);
  const smallest = nums.length ? Math.min(...nums) : NaN;
  let weight: number;
  if (/\bmin(ute)?s?\b/.test(s)) weight = Number.isFinite(smallest) ? smallest : 15;
  else if (/session|week|month/.test(s)) weight = (Number.isFinite(smallest) ? smallest : 8) * 50;
  else if (Number.isFinite(smallest)) weight = smallest * 10;
  else weight = t.briefInterventionAvailable ? 60 : 200;
  if (t.briefInterventionAvailable) weight -= 25;
  return weight;
}

/** Pick the therapy with the shortest delivery time, for the decision summary. */
export function shortestDelivery(therapies: Therapy[]): Therapy | null {
  if (!therapies.length) return null;
  return [...therapies].sort((a, b) => durationWeight(a) - durationWeight(b))[0];
}
