import type { Therapy } from "./types";

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
  tags: string[]; // therapy must carry ALL selected tags
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

function scoreTherapy(t: Therapy, q: string): number {
  if (!q) return 1;
  const name = lc(t.name);
  const tags = t.tags.map(lc);
  let score = 0;
  if (name === q) score += 100;
  if (name.startsWith(q)) score += 40;
  if (name.includes(q)) score += 20;
  if (t.aliases.some((a) => lc(a).includes(q))) score += 18;
  if (tags.some((tag) => tag.includes(q))) score += 14;
  if (lc(t.category).includes(q)) score += 8;
  if (lc(t.bestUsedFor).includes(q)) score += 6;
  if (lc(t.targetSymptoms).includes(q)) score += 5;
  if (lc(t.clinicalSummary).includes(q)) score += 3;
  if (lc(t.indications).includes(q)) score += 3;
  return score;
}

export function searchTherapies(therapies: Therapy[], opts: SearchOptions): Therapy[] {
  const q = opts.query.trim().toLowerCase();
  const wantTags = opts.tags.map(lc);
  const scored = therapies
    .filter((t) => {
      if (opts.briefOnly && !t.briefInterventionAvailable) return false;
      if (opts.sheetOnly && !t.patientSheetAvailable) return false;
      if (opts.reviewedOnly && t.reviewStatus !== "reviewed") return false;
      if (wantTags.length && !wantTags.every((wt) => t.tags.some((tag) => lc(tag) === wt))) return false;
      return scoreTherapy(t, q) > 0;
    })
    .map((t) => ({ t, s: scoreTherapy(t, q) }));
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
    if (t.modality && t.modality === therapy.modality) s += 1;
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
    match: (t) => lc(`${t.tags.join(" ")} ${t.modality}`).match(/skill|dbt|cbt|behav/) != null,
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
    if (q) score += Math.min(scoreTherapy(t, q), 60);
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

/** Pick the therapy whose time-required reads shortest, for the decision summary. */
export function shortestDelivery(therapies: Therapy[]): Therapy | null {
  if (!therapies.length) return null;
  const weight = (t: Therapy) => {
    const s = lc(t.timeRequired);
    const m = s.match(/(\d+)/);
    const base = m ? Number(m[1]) : 99;
    return t.briefInterventionAvailable ? base - 5 : base;
  };
  return [...therapies].sort((a, b) => weight(a) - weight(b))[0];
}
