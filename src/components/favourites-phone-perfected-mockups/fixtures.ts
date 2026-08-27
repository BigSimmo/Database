import { ClipboardList, MessagesSquare, Split, Stethoscope, type LucideIcon } from "lucide-react";

/**
 * Synthetic fixture for the phone Favourites study. Not clinical content and
 * not patient data: titles are drawn from the repository's own catalogues
 * (`data/forms-page-snapshot.json`, `data/differentials-snapshot.json`,
 * `src/data/therapies-index.json`) so the rows measure like real ones, and the
 * service names are plausible Perth-service labels invented for this page.
 *
 * The four kinds below are the ONLY things this application can persist as a
 * favourite — `favouriteContentTypeSchema` in `src/lib/favourites-contract.ts`
 * is `["service", "form", "differential", "therapy"]`. The six existing
 * favourites mockups draw saved medications, documents, quotes and searches;
 * none of those has a content type, so none of them can be saved.
 */

export type FavouriteKind = "service" | "form" | "differential" | "therapy";

/** `favouriteSetNames` verbatim, plus the null-set bucket the schema allows
 *  (`user_favourites.set_id` is nullable) and an `all` pseudo-set. */
export type FavouriteSetId =
  "all" | "clinical-review" | "ward-round" | "on-call" | "follow-up" | "teaching" | "reference" | "unfiled";

export type FavouriteRow = {
  id: string;
  kind: FavouriteKind;
  title: string;
  /** The single qualifier that survives the move from card to row. */
  detail: string;
  setId: Exclude<FavouriteSetId, "all">;
  pinned?: boolean;
  /** Presentation string in the shape `formatLastOpened` already produces. */
  lastOpened: string;
  /** Lower is more recent. Drives the "Recent" sort without inventing clocks. */
  recency: number;
};

export const kindIdentity: Record<
  FavouriteKind,
  { label: string; plural: string; icon: LucideIcon; ink: string; soft: string; border: string }
> = {
  // Services and forms carry real identity tokens. Differentials and therapies
  // do not, so they borrow within-surface category tones — promotion would want
  // `--type-differential` and `--type-therapy` added to the identity group.
  service: {
    label: "Service",
    plural: "Services",
    icon: Stethoscope,
    ink: "var(--type-service)",
    soft: "var(--type-service-soft)",
    border: "var(--type-service-border)",
  },
  form: {
    label: "Form",
    plural: "Forms",
    icon: ClipboardList,
    ink: "var(--type-form)",
    soft: "var(--type-form-soft)",
    border: "var(--type-form-border)",
  },
  differential: {
    label: "Differential",
    plural: "Differentials",
    icon: Split,
    ink: "var(--tone-purple)",
    soft: "var(--tone-purple-soft)",
    border: "var(--tone-purple-border)",
  },
  therapy: {
    label: "Therapy",
    plural: "Therapies",
    icon: MessagesSquare,
    ink: "var(--tone-indigo)",
    soft: "var(--tone-indigo-soft)",
    border: "var(--tone-indigo-border)",
  },
};

export const setLabels: Record<FavouriteSetId, string> = {
  all: "All",
  "clinical-review": "Clinical review",
  "ward-round": "Ward round",
  "on-call": "On call",
  "follow-up": "Follow up",
  teaching: "Teaching",
  reference: "Reference",
  unfiled: "Unfiled",
};

/** Rail order. `all` leads, `unfiled` trails, the six controlled names sit
 *  between them in the order `favouriteSetNames` declares. */
export const setOrder: FavouriteSetId[] = [
  "all",
  "clinical-review",
  "ward-round",
  "on-call",
  "follow-up",
  "teaching",
  "reference",
  "unfiled",
];

export const favouriteRows: FavouriteRow[] = [
  // ---- pinned ----------------------------------------------------------
  {
    id: "form-1a",
    kind: "form",
    title: "Referral for examination by psychiatrist",
    detail: "Form 1A",
    setId: "on-call",
    pinned: true,
    lastOpened: "Today 08:44",
    recency: 1,
  },
  {
    id: "diff-delirium",
    kind: "differential",
    title: "Delirium / acute confusion / encephalopathy",
    detail: "Must-not-miss",
    setId: "ward-round",
    pinned: true,
    lastOpened: "Today 08:20",
    recency: 2,
  },
  {
    id: "form-cto",
    kind: "form",
    title: "Community treatment order",
    detail: "Form 5A",
    setId: "follow-up",
    pinned: true,
    lastOpened: "Yesterday",
    recency: 3,
  },
  {
    id: "svc-cmht-inner",
    kind: "service",
    title: "Inner City Community Mental Health Team",
    detail: "Adult · catchment intake",
    setId: "ward-round",
    pinned: true,
    lastOpened: "Yesterday",
    recency: 4,
  },

  // ---- ward round ------------------------------------------------------
  {
    id: "diff-clozapine-myocarditis",
    kind: "differential",
    title: "Clozapine-induced myocarditis",
    detail: "Must-not-miss",
    setId: "ward-round",
    lastOpened: "Today 07:55",
    recency: 5,
  },
  {
    id: "diff-nms",
    kind: "differential",
    title: "Neuroleptic malignant syndrome",
    detail: "Must-not-miss",
    setId: "ward-round",
    lastOpened: "2 days ago",
    recency: 12,
  },
  {
    id: "form-continuation",
    kind: "form",
    title: "Continuation of detention",
    detail: "Form 3B",
    setId: "ward-round",
    lastOpened: "2 days ago",
    recency: 13,
  },
  {
    id: "diff-serotonin",
    kind: "differential",
    title: "Serotonin syndrome",
    detail: "Must-not-miss",
    setId: "ward-round",
    lastOpened: "3 days ago",
    recency: 18,
  },
  {
    id: "svc-liaison",
    kind: "service",
    title: "Consultation Liaison Psychiatry, Royal Perth",
    detail: "Inpatient referral",
    setId: "ward-round",
    lastOpened: "Last week",
    recency: 24,
  },

  // ---- on call ---------------------------------------------------------
  {
    id: "form-transport",
    kind: "form",
    title: "Transport order",
    detail: "Form 6A",
    setId: "on-call",
    lastOpened: "Today 02:10",
    recency: 6,
  },
  {
    id: "form-detain-voluntary",
    kind: "form",
    title: "Detain voluntary inpatient for assessment",
    detail: "Form 2A",
    setId: "on-call",
    lastOpened: "Yesterday",
    recency: 8,
  },
  {
    id: "diff-alcohol-withdrawal",
    kind: "differential",
    title: "Alcohol withdrawal",
    detail: "Time-critical",
    setId: "on-call",
    lastOpened: "Yesterday",
    recency: 9,
  },
  {
    id: "diff-acute-dystonia",
    kind: "differential",
    title: "Acute dystonia",
    detail: "Treat now",
    setId: "on-call",
    lastOpened: "3 days ago",
    recency: 19,
  },
  {
    id: "svc-triage",
    kind: "service",
    title: "Mental Health Emergency Response Line",
    detail: "Statewide · 24 hour",
    setId: "on-call",
    lastOpened: "Last week",
    recency: 25,
  },
  {
    id: "form-transport-extension",
    kind: "form",
    title: "Extension of transport order",
    detail: "Form 6B",
    setId: "on-call",
    lastOpened: "Last week",
    recency: 26,
  },

  // ---- clinical review -------------------------------------------------
  {
    id: "diff-treatment-resistant",
    kind: "differential",
    title: "Treatment-resistant depression",
    detail: "Review pathway",
    setId: "clinical-review",
    lastOpened: "Today 09:02",
    recency: 7,
  },
  {
    id: "thx-cbt",
    kind: "therapy",
    title: "Cognitive Behavioural Therapy (CBT)",
    detail: "First line · depression",
    setId: "clinical-review",
    lastOpened: "Yesterday",
    recency: 10,
  },
  {
    id: "diff-akathisia",
    kind: "differential",
    title: "Akathisia",
    detail: "Adverse effect",
    setId: "clinical-review",
    lastOpened: "2 days ago",
    recency: 14,
  },
  {
    id: "diff-adverse-nonadherence",
    kind: "differential",
    title: "Adverse-effect-driven non-adherence",
    detail: "Review pathway",
    setId: "clinical-review",
    lastOpened: "4 days ago",
    recency: 20,
  },
  {
    id: "thx-adherence",
    kind: "therapy",
    title: "Adherence-focused brief work",
    detail: "Adjunct",
    setId: "clinical-review",
    lastOpened: "Last week",
    recency: 27,
  },

  // ---- reference -------------------------------------------------------
  {
    id: "form-order-cannot-detain",
    kind: "form",
    title: "Order that person cannot continue to be detained",
    detail: "Form 4B",
    setId: "reference",
    lastOpened: "2 days ago",
    recency: 15,
  },
  {
    id: "diff-anticholinergic",
    kind: "differential",
    title: "Anticholinergic burden",
    detail: "Prescribing check",
    setId: "reference",
    lastOpened: "5 days ago",
    recency: 21,
  },
  {
    id: "diff-antidepressant-discontinuation",
    kind: "differential",
    title: "Antidepressant discontinuation syndrome",
    detail: "Prescribing check",
    setId: "reference",
    lastOpened: "Last week",
    recency: 28,
  },
  {
    id: "form-transfer",
    kind: "form",
    title: "Transfer order",
    detail: "Form 7A",
    setId: "reference",
    lastOpened: "Last week",
    recency: 29,
  },
  {
    id: "diff-alcohol-brain-injury",
    kind: "differential",
    title: "Alcohol-related brain injury",
    detail: "Longer-term",
    setId: "reference",
    lastOpened: "Saved",
    recency: 34,
  },

  // ---- teaching --------------------------------------------------------
  {
    id: "thx-act",
    kind: "therapy",
    title: "Acceptance and Commitment Therapy (ACT)",
    detail: "Registrar teaching",
    setId: "teaching",
    lastOpened: "3 days ago",
    recency: 16,
  },
  {
    id: "thx-behavioural-activation",
    kind: "therapy",
    title: "Behavioural Activation (BA)",
    detail: "Registrar teaching",
    setId: "teaching",
    lastOpened: "Last week",
    recency: 22,
  },
  {
    id: "thx-family",
    kind: "therapy",
    title: "Behavioural Couples Therapy (BCT)",
    detail: "Registrar teaching",
    setId: "teaching",
    lastOpened: "Last week",
    recency: 30,
  },
  {
    id: "thx-sscm",
    kind: "therapy",
    title: "Specialist Supportive Clinical Management (SSCM)",
    detail: "Eating disorders",
    setId: "teaching",
    lastOpened: "Saved",
    recency: 35,
  },

  // ---- follow up -------------------------------------------------------
  {
    id: "form-cto-continuation",
    kind: "form",
    title: "Continuation of community treatment order",
    detail: "Form 5B",
    setId: "follow-up",
    lastOpened: "3 days ago",
    recency: 17,
  },

  // ---- unfiled ---------------------------------------------------------
  {
    id: "svc-headspace",
    kind: "service",
    title: "Youth Early Psychosis Service, Northern Suburbs",
    detail: "16-25 · self-referral",
    setId: "unfiled",
    lastOpened: "5 days ago",
    recency: 23,
  },
  {
    id: "thx-craft",
    kind: "therapy",
    title: "Community Reinforcement and Family Training (CRAFT)",
    detail: "Family work",
    setId: "unfiled",
    lastOpened: "Saved",
    recency: 36,
  },
];

/** Counts per rail chip, computed once so the rail and the header agree. */
export function countsBySet(rows: readonly FavouriteRow[]): Record<FavouriteSetId, number> {
  const counts = Object.fromEntries(setOrder.map((id) => [id, 0])) as Record<FavouriteSetId, number>;
  for (const row of rows) {
    counts.all += 1;
    counts[row.setId] += 1;
  }
  return counts;
}

/** Pinned first, then the caller's order. Pinning is the only reordering a
 *  phone user can reach; `sortOrder` up/down stays a desktop affordance. */
/** Landing-library order: pinned rows first, then the remaining rows grouped by
 *  set rail order. Mirrors `FavouritesList` when `groupBySet` is true. */
export function landingLibrarySectionOrder(rows: readonly FavouriteRow[]): string[] {
  const pinned = rows.filter((row) => row.pinned).map((row) => row.id);
  const rest = rows.filter((row) => !row.pinned);
  const bySet = setOrder
    .filter((id) => id !== "all")
    .flatMap((id) => rest.filter((row) => row.setId === id).map((row) => row.id));
  return [...pinned, ...bySet];
}

export function pinnedFirst(rows: readonly FavouriteRow[]): FavouriteRow[] {
  return [...rows].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return a.recency - b.recency;
  });
}

export function matchesQuery(row: FavouriteRow, query: string) {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  return (
    row.title.toLowerCase().includes(needle) ||
    row.detail.toLowerCase().includes(needle) ||
    kindIdentity[row.kind].label.toLowerCase().includes(needle) ||
    setLabels[row.setId].toLowerCase().includes(needle)
  );
}
