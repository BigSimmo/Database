// Patient-medication-list → drug-interaction evaluation.
//
// The companion to `medication-patient-alerts.ts`. That module answers "does
// this patient's *physiology* change how I use this drug?"; this one answers
// "does this drug collide with something the patient is *already taking*?".
// Both are pure and framework-free so the prescribing workspace, the medication
// detail page, and unit tests can share them.
//
// Input data is the generated `data/medication-interaction-index.json` (see
// `scripts/build-medication-interaction-index.ts`), which carries, per source
// medication, one entry per `Key Interactions` row: normalised severity, the
// resolved catalogue counterparties, and the verbatim source text.
//
// THE ONE INVARIANT THAT MATTERS
// `success` (green) is only reachable when every row on the medication resolved.
// A medication carrying an unresolved row returns `highestTone: null` with a
// non-zero `unresolvedRowCount`, and the render layer must show that as neutral
// grey with a "needs manual review" note — never as an all-clear. Missing
// analysis is not the same as a negative finding.

import interactionIndex from "../../data/medication-interaction-index.json";
import { SEMANTIC_TONE_PRIORITY, type SemanticTone } from "@/lib/semantic-tone";

export type InteractionSeverity =
  "critical" | "high" | "moderate" | "caution" | "low" | "none" | "safe" | "beneficial" | "unknown";

export type MedicationInteraction = {
  /** Stable id for React keys and test ids. */
  id: string;
  counterpartySlug: string;
  counterpartyName: string;
  /**
   * Lexicon term ids that fired on this row, for auditability. Row-level, not
   * per-counterparty: a row naming "MAOIs, Tramadol" reports both terms for
   * either match. Empty when the row resolved purely by drug name.
   */
  matchedTerms: string[];
  severity: InteractionSeverity;
  tone: SemanticTone;
  /** `row.key` — "Pharmacodynamic", "Pharmacokinetic", "Triple Whammy", … */
  kind: string;
  /** VERBATIM catalogue row text. Never paraphrased. */
  note: string;
};

export type MedicationInteractionResult = {
  interactions: MedicationInteraction[];
  counts: Record<SemanticTone, number>;
  /** Highest tone across matched interactions, or null when none matched. */
  highestTone: SemanticTone | null;
  /**
   * Interaction rows on this medication whose counterparty could not be
   * machine-resolved. Non-zero must suppress any green verdict.
   */
  unresolvedRowCount: number;
  /** Total interaction rows the catalogue carries for this medication. */
  totalRowCount: number;
};

type IndexRow = {
  rowKey: string;
  rowIndex: number;
  severity: string;
  counterparties: string[];
  termIds: string[];
  resolved: boolean;
};
type InteractionIndexShape = {
  version: number;
  sourceRowCount: number;
  names: Record<string, string>;
  bySlug: Record<string, { rows: IndexRow[]; unresolvedRowCount: number }>;
};

const INDEX = interactionIndex as unknown as InteractionIndexShape;

/** Display name for a catalogue slug, falling back to the slug itself. */
export function medicationDisplayName(slug: string): string {
  return INDEX.names[slug] ?? slug;
}

export type MedicationOption = { slug: string; name: string };

let cachedOptions: MedicationOption[] | null = null;

/**
 * Every catalogue medication as a pickable `{ slug, name }`, name-sorted.
 *
 * Sourced from the interaction index rather than the 3.5 MB catalogue snapshot:
 * the picker only needs slugs and names, and the index is already loaded on the
 * surfaces that host the picker.
 */
export function catalogueMedicationOptions(): MedicationOption[] {
  cachedOptions ??= Object.entries(INDEX.names)
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cachedOptions;
}

/** True when the slug names a real catalogue medication. */
export function isCatalogueMedicationSlug(slug: string): boolean {
  return Object.hasOwn(INDEX.names, slug);
}

export const SEVERITY_TONE: Record<InteractionSeverity, SemanticTone> = {
  critical: "danger",
  high: "danger",
  moderate: "warning",
  caution: "warning",
  low: "success",
  none: "success",
  safe: "success",
  beneficial: "success",
  // An unparsed severity token must not be optimistic.
  unknown: "neutral",
};

const EMPTY_COUNTS: Record<SemanticTone, number> = {
  danger: 0,
  warning: 0,
  clinical: 0,
  success: 0,
  neutral: 0,
  info: 0,
};

const SEVERITY_ORDER: InteractionSeverity[] = [
  "critical",
  "high",
  "moderate",
  "caution",
  "unknown",
  "low",
  "none",
  "safe",
  "beneficial",
];

function normaliseSeverity(value: string): InteractionSeverity {
  return (SEVERITY_ORDER as string[]).includes(value) ? (value as InteractionSeverity) : "unknown";
}

/** Total interaction rows the catalogue carries for a medication. */
export function interactionRowCount(slug: string): number {
  return INDEX.bySlug[slug]?.rows.length ?? 0;
}

/**
 * Evaluate one medication against the patient's current medication list.
 *
 * `patientMedicationSlugs` are catalogue slugs. The source medication is
 * excluded automatically, so a patient already taking the drug being viewed does
 * not produce a self-interaction.
 */
export function evaluateMedicationInteractions(
  slug: string,
  patientMedicationSlugs: readonly string[],
  /**
   * The medication's own record, when the caller has it. Used to recover the
   * verbatim `Key Interactions` row text by index — that text is deliberately
   * not duplicated into the generated index (see the build script). Without a
   * record the interaction still reports correctly, just with an empty `note`.
   */
  record?: { sections?: { type: string; rows?: { key: string; val: string }[] }[] } | null,
): MedicationInteractionResult {
  const entry = INDEX.bySlug[slug];
  if (!entry) {
    return {
      interactions: [],
      counts: { ...EMPTY_COUNTS },
      highestTone: null,
      unresolvedRowCount: 0,
      totalRowCount: 0,
    };
  }

  const patient = new Set(patientMedicationSlugs.filter((value) => value !== slug));
  const interactions: MedicationInteraction[] = [];
  const sourceRows = record?.sections?.find((section) => section.type === "inter")?.rows ?? [];

  for (const row of entry.rows) {
    for (const counterpartySlug of row.counterparties) {
      if (!patient.has(counterpartySlug)) continue;
      const severity = normaliseSeverity(row.severity);
      interactions.push({
        id: `${slug}:${row.rowIndex}:${counterpartySlug}`,
        counterpartySlug,
        counterpartyName: medicationDisplayName(counterpartySlug),
        matchedTerms: row.termIds,
        severity,
        tone: SEVERITY_TONE[severity],
        kind: row.rowKey,
        note: sourceRows[row.rowIndex]?.val ?? "",
      });
    }
  }

  interactions.sort((a, b) => {
    const byTone = SEMANTIC_TONE_PRIORITY[b.tone] - SEMANTIC_TONE_PRIORITY[a.tone];
    if (byTone !== 0) return byTone;
    const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return a.counterpartyName.localeCompare(b.counterpartyName);
  });

  const counts: Record<SemanticTone, number> = { ...EMPTY_COUNTS };
  for (const interaction of interactions) counts[interaction.tone] += 1;

  return {
    interactions,
    counts,
    highestTone: interactions[0]?.tone ?? null,
    unresolvedRowCount: entry.unresolvedRowCount,
    totalRowCount: entry.rows.length,
  };
}

// ---------------------------------------------------------------------------
// Composition with the physiology engine
// ---------------------------------------------------------------------------

export type MedicationVerdict = {
  tone: SemanticTone;
  /** True when something prevented a complete assessment (grey, not green). */
  incomplete: boolean;
  interactionCount: number;
  considerationCount: number;
  unresolvedRowCount: number;
};

/**
 * Fold the physiology considerations and the interaction matches into the single
 * tone a result row's border wears.
 *
 * Precedence is the shared `SEMANTIC_TONE_PRIORITY` ladder (danger 6 → info 1),
 * with one override that is the whole point of the function: if either engine
 * reports something it could not assess, a would-be `success` degrades to
 * `neutral`. Green must be unreachable on incomplete data — the same fail-safe
 * `evaluatePatientAlerts` already applies through its `unassessed` list.
 */
export function composeMedicationVerdict(input: {
  considerationTone: SemanticTone | null;
  considerationCount: number;
  unassessedCount: number;
  interactionTone: SemanticTone | null;
  interactionCount: number;
  unresolvedRowCount: number;
}): MedicationVerdict {
  const incomplete = input.unassessedCount > 0 || input.unresolvedRowCount > 0;
  const candidates = [input.considerationTone, input.interactionTone].filter(
    (tone): tone is SemanticTone => tone !== null,
  );

  let tone: SemanticTone = candidates.length
    ? candidates.reduce((best, current) =>
        SEMANTIC_TONE_PRIORITY[current] > SEMANTIC_TONE_PRIORITY[best] ? current : best,
      )
    : "success";

  if (incomplete && tone === "success") tone = "neutral";

  return {
    tone,
    incomplete,
    interactionCount: input.interactionCount,
    considerationCount: input.considerationCount,
    unresolvedRowCount: input.unresolvedRowCount,
  };
}
