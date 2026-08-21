// Patient-medication-list → drug-interaction evaluation.
//
// The companion to `medication-patient-alerts.ts`. That module answers "does
// this patient's *physiology* change how I use this drug?"; this one answers
// "does this drug collide with something the patient is *already taking*?".
// Both are pure and framework-free so the prescribing workspace, the medication
// detail page, and unit tests can share them.
//
// Input is the generated `data/medication-interaction-index.json` (see
// `scripts/build-medication-interaction-index.ts`): per source medication, one
// entry per `Key Interactions` row, carrying normalised severity and the
// resolved catalogue counterparties. The verbatim row text is NOT duplicated
// into the index — it is read back off the `MedicationRecord` by `rowIndex`.
//
// THE ONE INVARIANT THAT MATTERS
// `success` (green) must be unreachable on incomplete analysis. Four separate
// things can make the analysis incomplete, and each has to keep green off:
//
//   1. A row whose counterparty could not be resolved → `unresolvedRowCount`.
//   2. A medication the index has no entry for at all → `dataAvailable: false`,
//      which reports a synthetic `unresolvedRowCount` of 1. Without this, a drug
//      we know nothing about scored zero unresolved rows and composed straight
//      to green — a false all-clear on absent data, the worst failure this
//      module has.
//   3. An unparsed severity token → `SEVERITY_TONE.unknown` is `neutral`, never
//      `success`.
//   4. An entered medication outside both ends of every resolved interaction edge →
//      `unreachableCounterparties`. Case 2 covers the drug being VIEWED; this
//      covers the drugs in the PATIENT's list. Both of that pair are uncheckable
//      for the same reason, and only one of them used to stop green: a patient
//      on a drug the corpus never mentions produced no interactions, zero
//      unresolved rows, and a confident green.
//
// Missing analysis is not the same as a negative finding. `composeMedicationVerdict`
// is where that is finally enforced.
//
// SYMMETRY
// Interaction prose is not reliably symmetric: drug A's rows may name drug B
// while drug B's rows never mention A. Evaluating only the viewed drug's rows
// therefore misses real pairs in one direction. Both directions are scanned and
// the results de-duplicated, preferring the copy that carries source text.

import interactionIndex from "../../data/medication-interaction-index.json";
import { SEMANTIC_TONE_PRIORITY, type SemanticTone } from "@/lib/semantic-tone";

export type InteractionSeverity =
  "critical" | "high" | "moderate" | "caution" | "low" | "none" | "safe" | "beneficial" | "unknown";

export type MedicationInteraction = {
  id: string;
  counterpartySlug: string;
  counterpartyName: string;
  matchedTerms: string[];
  severity: InteractionSeverity;
  tone: SemanticTone;
  kind: string;
  note: string;
};

export type MedicationInteractionResult = {
  interactions: MedicationInteraction[];
  counts: Record<SemanticTone, number>;
  highestTone: SemanticTone | null;
  unresolvedRowCount: number;
  totalRowCount: number;
  dataAvailable: boolean;
  /**
   * Entered medications outside the catalogue's resolved interaction graph,
   * so they could not be cross-checked in either direction. See
   * `UNREACHABLE_SLUGS` — this is the fourth route to an incomplete analysis.
   */
  unreachableCounterparties: string[];
};

type IndexRow = {
  rowKey: string;
  rowIndex: number;
  severity: string;
  counterparties: string[];
  termIds: string[];
  resolved: boolean;
  /** Verbatim row text, carried so the reverse direction has wording too. */
  note: string;
};

type InteractionIndexShape = {
  version: number;
  sourceRowCount: number;
  names: Record<string, string>;
  bySlug: Record<string, { rows: IndexRow[]; unresolvedRowCount: number }>;
};

const INDEX = interactionIndex as unknown as InteractionIndexShape;

/**
 * Catalogue medications outside both ends of every resolved interaction edge.
 *
 * 35 of 328 today. A drug in here cannot produce an alert from any direction:
 * not from its own resolved rows, not from anyone else's. Entering it therefore yields
 * silence, and silence in this UI is otherwise indistinguishable from "checked,
 * nothing found" — which is the single most misleading state this feature can
 * reach, because the reassurance is unearned.
 *
 * Most of it is genuine corpus coverage (antibiotics, antidiabetics, aperients,
 * vitamins) that only new interaction rows can fix. It is derived here rather
 * than baked into the generated index so the two cannot drift, and computed once
 * at module load — a single pass over ~520 rows.
 */
const UNREACHABLE_SLUGS: ReadonlySet<string> = (() => {
  const reachable = new Set<string>();
  for (const [sourceSlug, entry] of Object.entries(INDEX.bySlug)) {
    for (const row of entry.rows) {
      if (row.counterparties.length > 0) reachable.add(sourceSlug);
      for (const slug of row.counterparties) reachable.add(slug);
    }
  }
  return new Set(Object.keys(INDEX.names).filter((slug) => !reachable.has(slug)));
})();

/** Whether no resolved interaction edge in the catalogue includes this medication. */
export function isUnreachableCounterparty(slug: string): boolean {
  return UNREACHABLE_SLUGS.has(slug);
}

export function medicationDisplayName(slug: string): string {
  return INDEX.names[slug] ?? slug;
}

export type MedicationOption = { slug: string; name: string };
let cachedOptions: MedicationOption[] | null = null;

export function catalogueMedicationOptions(): MedicationOption[] {
  cachedOptions ??= Object.entries(INDEX.names)
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cachedOptions;
}

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

// The catalogue writes every interaction row as `SEVERITY — body`, e.g.
// "CRITICAL — MAOIs, Tramadol… Massive risk of Serotonin Syndrome". The prefix
// is the same value already carried in `severity`, so rendering it inside the
// paragraph both repeats the badge beside it and opens every entry with a
// shouty all-caps token and a dangling dash — which is what made the block read
// as unformatted dump rather than prose. Only recognised severity labels are
// removable: a broad all-caps pattern can eat clinical acronyms or instructions
// such as "NSAID-induced" and "NEVER-combine".
const SEVERITY_PREFIX = new RegExp(`^\\s*(?:${SEVERITY_ORDER.join("|")})\\s*[—–-]\\s*`, "i");

/**
 * The interaction row's text with that redundant severity prefix removed.
 *
 * Deliberately NOT a summariser: no sentence is dropped, reordered or reworded,
 * because the wording is the clinical claim and the surface promises it
 * verbatim. A row that does not carry the prefix is returned untouched.
 */
export function interactionNoteBody(note: string): string {
  return note.replace(SEVERITY_PREFIX, "").trim();
}

/** Display label for a severity, e.g. "critical" → "Critical". */
export function severityLabel(severity: InteractionSeverity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function interactionRowCount(slug: string): number {
  return INDEX.bySlug[slug]?.rows.length ?? 0;
}

function sourceRowsFor(record?: { sections?: { type: string; rows?: { key: string; val: string }[] }[] } | null) {
  return record?.sections?.find((section) => section.type === "inter")?.rows ?? [];
}

function interactionFromRow(
  sourceSlug: string,
  row: IndexRow,
  counterpartySlug: string,
  note: string,
  reverse = false,
): MedicationInteraction {
  const severity = normaliseSeverity(row.severity);
  return {
    id: reverse
      ? `${sourceSlug}:reverse:${row.rowIndex}:${counterpartySlug}`
      : `${sourceSlug}:${row.rowIndex}:${counterpartySlug}`,
    counterpartySlug,
    counterpartyName: medicationDisplayName(counterpartySlug),
    matchedTerms: row.termIds,
    severity,
    tone: SEVERITY_TONE[severity],
    kind: row.rowKey,
    note,
  };
}

export function evaluateMedicationInteractions(
  slug: string,
  patientMedicationSlugs: readonly string[],
  record?: { sections?: { type: string; rows?: { key: string; val: string }[] }[] } | null,
): MedicationInteractionResult {
  const entry = INDEX.bySlug[slug];
  const dataAvailable = Boolean(entry && entry.rows.length > 0);
  const patient = new Set(patientMedicationSlugs.filter((value) => value !== slug));
  const interactions: MedicationInteraction[] = [];
  const sourceRows = sourceRowsFor(record);

  if (entry) {
    for (const row of entry.rows) {
      for (const counterpartySlug of row.counterparties) {
        if (!patient.has(counterpartySlug)) continue;
        // Prefer the live record's wording; fall back to the indexed copy when no
        // record was supplied. The two are kept identical by
        // `check:medication-interactions`, which fails on a stale artefact.
        interactions.push(interactionFromRow(slug, row, counterpartySlug, sourceRows[row.rowIndex]?.val || row.note));
      }
    }
  }

  // Interaction prose is not guaranteed to be symmetric. Check each entered
  // medication's index entry as well so a clinically material edge is not missed
  // merely because it is documented on the existing drug rather than the candidate.
  for (const patientSlug of patient) {
    const reverseEntry = INDEX.bySlug[patientSlug];
    if (!reverseEntry) continue;
    for (const row of reverseEntry.rows) {
      if (!row.counterparties.includes(slug)) continue;
      // The reverse row belongs to the PATIENT's medication, whose record this
      // caller does not hold — so its wording can only come from the index. It
      // used to be passed as "", which rendered a drug name and a severity chip
      // with nothing underneath explaining either.
      interactions.push(interactionFromRow(patientSlug, row, patientSlug, row.note, true));
    }
  }

  // Keep the strongest form of an equivalent pair. Distinct rows are retained
  // because they may encode different mechanisms or severities.
  const deduped = new Map<string, MedicationInteraction>();
  for (const interaction of interactions) {
    const key = `${interaction.counterpartySlug}:${interaction.kind}:${interaction.severity}`;
    const existing = deduped.get(key);
    if (!existing || (!existing.note && interaction.note)) deduped.set(key, interaction);
  }
  const resultInteractions = Array.from(deduped.values());

  resultInteractions.sort((a, b) => {
    const byTone = SEMANTIC_TONE_PRIORITY[b.tone] - SEMANTIC_TONE_PRIORITY[a.tone];
    if (byTone !== 0) return byTone;
    const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return a.counterpartyName.localeCompare(b.counterpartyName);
  });

  const counts: Record<SemanticTone, number> = { ...EMPTY_COUNTS };
  for (const interaction of resultInteractions) counts[interaction.tone] += 1;

  return {
    interactions: resultInteractions,
    counts,
    highestTone: resultInteractions[0]?.tone ?? null,
    unresolvedRowCount: dataAvailable ? (entry?.unresolvedRowCount ?? 0) : 1,
    totalRowCount: entry?.rows.length ?? 0,
    dataAvailable,
    // The graph calculation already includes both endpoints of every resolved
    // edge. Keep this result filter as a defensive invariant so the UI can never
    // call a medication uncheckable directly above an alert about that drug.
    unreachableCounterparties: Array.from(patient)
      .filter((value) => UNREACHABLE_SLUGS.has(value))
      .filter((value) => !resultInteractions.some((item) => item.counterpartySlug === value))
      .sort((a, b) => medicationDisplayName(a).localeCompare(medicationDisplayName(b))),
  };
}

export type MedicationVerdict = {
  tone: SemanticTone;
  incomplete: boolean;
  interactionCount: number;
  considerationCount: number;
  unresolvedRowCount: number;
};

export function composeMedicationVerdict(input: {
  considerationTone: SemanticTone | null;
  considerationCount: number;
  unassessedCount: number;
  interactionTone: SemanticTone | null;
  interactionCount: number;
  unresolvedRowCount: number;
  /**
   * Entered medications outside the resolved interaction graph. Optional so existing callers
   * keep compiling, but a caller that omits it can still reach green while an
   * uncheckable drug sits in the patient's list.
   */
  unreachableCounterpartyCount?: number;
}): MedicationVerdict {
  const incomplete =
    input.unassessedCount > 0 || input.unresolvedRowCount > 0 || (input.unreachableCounterpartyCount ?? 0) > 0;
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
