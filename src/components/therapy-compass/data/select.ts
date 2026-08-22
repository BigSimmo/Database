import type { Therapy } from "./types";
import { scoreTherapyCandidate } from "@/lib/therapy-ranking";

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

  // 3) Fall back to sentence boundaries (before a capital letter only, so a
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

export function searchTherapies(therapies: Therapy[], opts: SearchOptions): Therapy[] {
  const q = opts.query.trim().toLowerCase();
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

// ---- related ------------------------------------------------------------

/** Nearest neighbours by shared category then shared tags. */
export function relatedTherapies(all: Therapy[], therapy: Therapy, n = 4): Therapy[] {
  const others = all.filter((t) => t.slug !== therapy.slug);
  const scored = others.map((t) => {
    let s = 0;
    if (t.category === therapy.category) s += 5;
    const shared = t.tags.filter((tag) => therapy.tags.includes(tag)).length;
    s += shared * 2;
    return { t, s };
  });
  scored.sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name));
  return scored
    .filter((x) => x.s > 0)
    .slice(0, n)
    .map((x) => x.t);
}

// ---- recommend ----------------------------------------------------------

export type RecommendConstraint = {
  key: string;
  label: string;
  // Positive boost when the therapy matches; used to rank.
  match: (t: Therapy) => boolean;
};

export const RECOMMEND_CONSTRAINTS: RecommendConstraint[] = [
  {
    key: "outpatient",
    label: "Outpatient",
    match: (t) => lc(t.setting).includes("outpatient") || !lc(t.setting).includes("inpatient"),
  },
  {
    key: "inpatient",
    label: "Inpatient",
    match: (t) => lc(t.setting).includes("inpatient") || lc(t.setting).includes("acute"),
  },
  { key: "5min", label: "5 minutes", match: (t) => t.briefInterventionAvailable && !!t.briefVersion },
  { key: "15min", label: "15 minutes", match: (t) => !!t.fifteenMinuteVersion || t.briefInterventionAvailable },
  { key: "handout", label: "Handout", match: (t) => t.patientSheetAvailable },
  {
    key: "grounding",
    label: "Grounding",
    match: (t) => lc(`${t.tags.join(" ")} ${t.name}`).match(/ground|relax|distress|arousal/) != null,
  },
  {
    key: "skills",
    label: "Skills",
    match: (t) => lc(t.tags.join(" ")).match(/skill|dbt|cbt|behav/) != null,
  },
  {
    key: "psychoeducation",
    label: "Psychoeducation",
    match: (t) => lc(`${t.name} ${t.tags.join(" ")}`).includes("psychoeduc"),
  },
  { key: "trauma", label: "Trauma caution", match: (t) => t.tags.map(lc).includes("trauma") },
  {
    key: "avoid-mania",
    label: "Avoid mania",
    match: (t) => !lc(`${t.contraindicationsOrCautions} ${t.limitations}`).includes("mania"),
  },
];

export type Ranked = { therapy: Therapy; score: number };

export function rankRecommendations(
  therapies: Therapy[],
  query: string,
  constraintKeys: string[],
  limit = 6,
): Ranked[] {
  const q = query.trim().toLowerCase();
  const cons = RECOMMEND_CONSTRAINTS.filter((c) => constraintKeys.includes(c.key));
  const scored = therapies.map((t) => {
    let score = 0;
    if (q) score += Math.min(scoreTherapyCandidate(t, q), 60);
    for (const c of cons) if (c.match(t)) score += 10;
    if (t.reviewStatus === "reviewed") score += 4;
    if (typeof t.indexCompleteness === "number") score += t.indexCompleteness / 100;
    return { therapy: t, score };
  });
  scored.sort((a, b) => b.score - a.score || a.therapy.name.localeCompare(b.therapy.name));
  return scored.slice(0, limit);
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
