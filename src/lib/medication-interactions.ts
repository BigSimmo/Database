// Patient-medication-list → drug-interaction evaluation.

import interactionIndex from "../../data/medication-interaction-index.json";
import { SEMANTIC_TONE_PRIORITY, type SemanticTone } from "@/lib/semantic-tone";

export type InteractionSeverity =
  | "critical"
  | "high"
  | "moderate"
  | "caution"
  | "low"
  | "none"
  | "safe"
  | "beneficial"
  | "unknown";

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
        interactions.push(interactionFromRow(slug, row, counterpartySlug, sourceRows[row.rowIndex]?.val ?? ""));
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
      interactions.push(interactionFromRow(patientSlug, row, patientSlug, "", true));
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
