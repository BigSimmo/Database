// Patient-info → medication considerations engine.
//
// The medication catalogue (exported from the Medications app into
// `data/medications-snapshot.json`) already carries per-row patient-matching
// metadata (`MedicationSectionRow.patient`): `factors`, `action`, `severity`,
// a structured `match` object, and a source-backed `note`. Until now that data
// was only surfaced as static badges (`patientBadges` in `medication-badges.ts`).
//
// This module is the missing evaluation layer: given a medication record and a
// clinician-entered `PatientProfile`, it returns the considerations that apply
// to *this* patient, each with a human-readable reason and a resolved semantic
// tone. It is intentionally framework-free (imports only `@/lib/semantic-tone`
// and types from `@/lib/medications`) so it can be unit-tested and reused by
// both the medication detail page and the prescribing search workspace.
//
// Firing semantics are derived from the shape of the snapshot data. The three
// heuristic thresholds below (renal impairment, QTc prolongation, and the
// elderly/paediatric age cut-offs used only when a row carries a bare `factor`
// with no numeric `match`) are the one place where the exact rule cannot be read
// off the data. They are named constants so they can be re-tuned in one edit if
// the source Medications app uses different cut-offs.

import { SEMANTIC_TONE_PRIORITY, type SemanticTone } from "@/lib/semantic-tone";
import type { MedicationPatientMetadata, MedicationRecord, MedicationSectionRow } from "@/lib/medications";

export type AllergyClass = "penicillin" | "sulfa" | "nsaid" | "cephalosporin" | "macrolide" | "fluoroquinolone";

export type HepaticSeverity = "none" | "mild" | "moderate" | "severe";

export type ScrUnit = "umol/L" | "mg/dL";

export type PatientProfile = {
  ageYears?: number | null;
  egfr?: number | null;
  crcl?: number | null;
  scr?: number | null;
  scrUnit?: ScrUnit;
  hepatic?: HepaticSeverity | null;
  qtc?: number | null;
  pregnant?: boolean;
  breastfeeding?: boolean;
  allergies?: AllergyClass[];
};

export type MedicationConsideration = {
  /** Stable id `${sectionType}:${rowKey}` for React keys and test ids. */
  id: string;
  sectionType: string;
  rowKey: string;
  action?: string;
  severity?: string;
  tone: SemanticTone;
  /** Source-backed rationale (patient.note), falling back to the row text. */
  note: string;
  /** Human-readable trigger reasons, e.g. ["eGFR 22 < 30 mL/min"]. */
  reasons: string[];
  /** Display labels for the row's factors, e.g. ["Renal"]. */
  factorLabels: string[];
};

export type PatientAlertResult = {
  considerations: MedicationConsideration[];
  counts: Record<SemanticTone, number>;
  highestTone: SemanticTone | null;
  /**
   * Distinct inputs (e.g. ["eGFR", "hepatic status"]) referenced by a
   * contraindication on this medication that could not be evaluated because the
   * profile did not supply them — so a blank field is never read as an
   * all-clear. Rendered as a single hint, not per row.
   */
  unassessed: string[];
};

// ---------------------------------------------------------------------------
// Heuristic constants (⚠️ confirm against the BigSimmo/Medications reference).
// Only used when a row lists a numeric factor with no covering `match` key.
// ---------------------------------------------------------------------------
export const RENAL_IMPAIRMENT_EGFR = 60; // mL/min; CKD stage 3+.
export const QTC_PROLONGED_MS = 450; // ms; sex-agnostic conservative threshold.
export const ELDERLY_AGE_YEARS = 65;
export const PAEDIATRIC_AGE_YEARS = 18;
export const SCR_UMOL_PER_MGDL = 88.4; // serum creatinine unit conversion factor.

export const MEDICATION_FACTOR_LABELS: Record<string, string> = {
  renal: "Renal",
  hepatic: "Hepatic",
  pregnancy: "Pregnancy",
  lactation: "Breastfeeding",
  elderly: "Elderly",
  paediatric: "Paediatric",
  qtc: "QTc",
  "allergy-nsaid": "NSAID allergy",
  "allergy-pcn": "Penicillin allergy",
  "allergy-sulfa": "Sulfa allergy",
  "allergy-ceph": "Cephalosporin allergy",
  "allergy-macrolide": "Macrolide allergy",
  "allergy-fluoro": "Fluoroquinolone allergy",
};

const ALLERGY_FACTOR_BY_CLASS: Record<AllergyClass, string> = {
  penicillin: "allergy-pcn",
  sulfa: "allergy-sulfa",
  nsaid: "allergy-nsaid",
  cephalosporin: "allergy-ceph",
  macrolide: "allergy-macrolide",
  fluoroquinolone: "allergy-fluoro",
};

const ALLERGY_CLASS_BY_FACTOR = Object.fromEntries(
  Object.entries(ALLERGY_FACTOR_BY_CLASS).map(([cls, factor]) => [factor, cls as AllergyClass]),
) as Record<string, AllergyClass>;

// Section types that carry patient blocks, in display priority order. Used for a
// stable secondary sort within a tone.
const SECTION_ORDER: Record<string, number> = { contra: 0, risk: 1, mon: 2, dose: 3, spec: 4 };

const EMPTY_COUNTS: Record<SemanticTone, number> = {
  danger: 0,
  warning: 0,
  clinical: 0,
  success: 0,
  neutral: 0,
  info: 0,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberField(value: number | null | undefined): number | null {
  return isFiniteNumber(value) ? value : null;
}

function matchOperator(match: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = match[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function op(operator: Record<string, unknown>, name: string): number | null {
  return isFiniteNumber(operator[name]) ? (operator[name] as number) : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function normalizedScr(profile: PatientProfile): number | null {
  const scr = numberField(profile.scr);
  if (scr === null) return null;
  return profile.scrUnit === "mg/dL" ? scr * SCR_UMOL_PER_MGDL : scr;
}

/** True when the profile carries no information any criterion could match. */
export function isProfileEmpty(profile: PatientProfile | null | undefined): boolean {
  if (!profile) return true;
  if (
    numberField(profile.ageYears) !== null ||
    numberField(profile.egfr) !== null ||
    numberField(profile.crcl) !== null ||
    numberField(profile.scr) !== null ||
    numberField(profile.qtc) !== null
  ) {
    return false;
  }
  if (profile.pregnant || profile.breastfeeding) return false;
  if (profile.hepatic && profile.hepatic !== "none") return false;
  if (profile.allergies && profile.allergies.length > 0) return false;
  return true;
}

/** Map an engine tone to an `InlineNotice` tone (no "clinical" notice tone). */
export function noticeToneForSemanticTone(tone: SemanticTone): "success" | "warning" | "danger" | "info" | "neutral" {
  return tone === "clinical" ? "info" : tone;
}

// Mirror of the per-factor tone logic in `patientBadges` (medication-badges.ts)
// so the always-on badges and the live considerations agree on colour.
function considerationTone(action?: string, severity?: string): SemanticTone {
  if (action === "contraindication") return "danger";
  if (action === "monitor" || action === "dose-adjust") return "clinical";
  if (severity === "danger") return "danger";
  if (action === "caution" || severity === "caution") return "warning";
  if (action === "info" || severity === "info") return "info";
  return "warning";
}

type RowEvaluation = {
  reasons: string[];
  /** Numeric/categorical firing gates whose input was not supplied. */
  missingGates: string[];
};

// A bare factor is only evaluated when no `match` key of the same domain already
// covers it, so the numeric gate and the factor never double-report one row.
function evaluateRow(patient: MedicationPatientMetadata, profile: PatientProfile): RowEvaluation {
  const reasons: string[] = [];
  const missingGates: string[] = [];
  const match = (patient.match ?? {}) as Record<string, unknown>;
  const factors = patient.factors ?? [];

  const coversRenal = "egfr" in match || "crcl" in match || "scr" in match;
  const coversHepatic = "hepatic" in match;
  const coversAge = "age" in match;
  const coversQtc = "qtc" in match;

  // --- Structured match gates (precise, OR across keys) ---
  const age = numberField(profile.ageYears);
  const ageOp = matchOperator(match, "age");
  if (ageOp) {
    if (age === null) {
      missingGates.push("age");
    } else {
      const gte = op(ageOp, "gte");
      const gt = op(ageOp, "gt");
      const lt = op(ageOp, "lt");
      if (gte !== null && age >= gte) reasons.push(`Age ${age} ≥ ${gte}`);
      if (gt !== null && age > gt) reasons.push(`Age ${age} > ${gt}`);
      if (lt !== null && age < lt) reasons.push(`Age ${age} < ${lt}`);
    }
  }

  const egfrOp = matchOperator(match, "egfr");
  if (egfrOp) {
    const egfr = numberField(profile.egfr);
    const lt = op(egfrOp, "lt");
    if (egfr === null) missingGates.push("eGFR");
    else if (lt !== null && egfr < lt) reasons.push(`eGFR ${egfr} < ${lt} mL/min`);
  }

  const crclOp = matchOperator(match, "crcl");
  if (crclOp) {
    const crcl = numberField(profile.crcl);
    const lt = op(crclOp, "lt");
    const lte = op(crclOp, "lte");
    if (crcl === null) missingGates.push("CrCl");
    else {
      if (lt !== null && crcl < lt) reasons.push(`CrCl ${crcl} < ${lt} mL/min`);
      if (lte !== null && crcl <= lte) reasons.push(`CrCl ${crcl} ≤ ${lte} mL/min`);
    }
  }

  const scrOp = matchOperator(match, "scr");
  if (scrOp) {
    const scr = normalizedScr(profile);
    const gt = op(scrOp, "gt");
    if (scr === null) missingGates.push("serum creatinine");
    else if (gt !== null && scr > gt) reasons.push(`SCr ${Math.round(scr)} > ${gt} µmol/L`);
  }

  const qtcOp = matchOperator(match, "qtc");
  if (qtcOp) {
    const qtc = numberField(profile.qtc);
    const gte = op(qtcOp, "gte");
    if (qtc === null) missingGates.push("QTc");
    else if (gte !== null && qtc >= gte) reasons.push(`QTc ${qtc} ≥ ${gte} ms`);
  }

  if ("hepatic" in match) {
    const levels = stringList(match.hepatic);
    const hepatic = profile.hepatic;
    if (!hepatic) missingGates.push("hepatic status");
    else if (hepatic !== "none" && levels.includes(hepatic)) {
      reasons.push(`${capitalize(hepatic)} hepatic impairment`);
    }
  }

  // --- Factor triggers (booleans / allergy classes / derived numerics) ---
  const allergies = new Set(profile.allergies ?? []);
  for (const factor of factors) {
    if (factor === "pregnancy") {
      if (profile.pregnant) reasons.push("Pregnancy");
    } else if (factor === "lactation") {
      if (profile.breastfeeding) reasons.push("Breastfeeding");
    } else if (factor in ALLERGY_CLASS_BY_FACTOR) {
      const cls = ALLERGY_CLASS_BY_FACTOR[factor];
      if (allergies.has(cls)) reasons.push(MEDICATION_FACTOR_LABELS[factor] ?? `${capitalize(cls)} allergy`);
    } else if (factor === "renal" && !coversRenal) {
      const egfr = numberField(profile.egfr);
      const crcl = numberField(profile.crcl);
      if (egfr !== null && egfr < RENAL_IMPAIRMENT_EGFR) reasons.push(`Renal impairment (eGFR ${egfr})`);
      else if (crcl !== null && crcl < RENAL_IMPAIRMENT_EGFR) reasons.push(`Renal impairment (CrCl ${crcl})`);
      else if (egfr === null && crcl === null) missingGates.push("eGFR or CrCl");
    } else if (factor === "hepatic" && !coversHepatic) {
      if (!profile.hepatic) missingGates.push("hepatic status");
      else if (profile.hepatic !== "none") reasons.push(`${capitalize(profile.hepatic)} hepatic impairment`);
    } else if (factor === "elderly" && !coversAge) {
      if (age === null) missingGates.push("age");
      else if (age >= ELDERLY_AGE_YEARS) reasons.push(`Age ${age} ≥ ${ELDERLY_AGE_YEARS}`);
    } else if (factor === "paediatric" && !coversAge) {
      if (age === null) missingGates.push("age");
      else if (age < PAEDIATRIC_AGE_YEARS) reasons.push(`Age ${age} < ${PAEDIATRIC_AGE_YEARS}`);
    } else if (factor === "qtc" && !coversQtc) {
      const qtc = numberField(profile.qtc);
      if (qtc === null) missingGates.push("QTc");
      else if (qtc >= QTC_PROLONGED_MS) reasons.push(`QTc ${qtc} ≥ ${QTC_PROLONGED_MS} ms`);
    }
  }

  return { reasons: dedupe(reasons), missingGates: dedupe(missingGates) };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function factorLabelsFor(patient: MedicationPatientMetadata): string[] {
  return dedupe((patient.factors ?? []).map((factor) => MEDICATION_FACTOR_LABELS[factor] ?? capitalize(factor)));
}

/**
 * Evaluate every patient-tagged row of a medication against the entered profile.
 * Only fields present in the profile are tested (partial profiles are normal).
 * Contraindication rows that fire on a numeric/categorical gate the clinician
 * did not supply are surfaced separately as `unassessed`, so a missing input is
 * never read as an all-clear.
 */
export function evaluatePatientAlerts(record: MedicationRecord, profile: PatientProfile): PatientAlertResult {
  const considerations: MedicationConsideration[] = [];
  const unassessed = new Set<string>();

  for (const section of record.sections ?? []) {
    for (const row of section.rows ?? []) {
      const patient = rowPatient(row);
      if (!patient) continue;

      const { reasons, missingGates } = evaluateRow(patient, profile);

      if (reasons.length > 0) {
        considerations.push({
          id: `${section.type}:${row.key}`,
          sectionType: section.type,
          rowKey: row.key,
          action: patient.action,
          severity: patient.severity,
          tone: considerationTone(patient.action, patient.severity),
          note: (patient.note ?? row.val ?? "").replace(/\*\*/g, "").trim(),
          reasons,
          factorLabels: factorLabelsFor(patient),
        });
      } else if (patient.action === "contraindication") {
        for (const gate of missingGates) unassessed.add(gate);
      }
    }
  }

  considerations.sort((a, b) => {
    const byTone = SEMANTIC_TONE_PRIORITY[b.tone] - SEMANTIC_TONE_PRIORITY[a.tone];
    if (byTone !== 0) return byTone;
    const bySection = (SECTION_ORDER[a.sectionType] ?? 99) - (SECTION_ORDER[b.sectionType] ?? 99);
    if (bySection !== 0) return bySection;
    return a.rowKey.localeCompare(b.rowKey);
  });

  const counts: Record<SemanticTone, number> = { ...EMPTY_COUNTS };
  for (const consideration of considerations) counts[consideration.tone] += 1;

  return {
    considerations,
    counts,
    highestTone: considerations[0]?.tone ?? null,
    unassessed: Array.from(unassessed).sort(),
  };
}

function rowPatient(row: MedicationSectionRow): MedicationPatientMetadata | null {
  return row.patient && typeof row.patient === "object" ? row.patient : null;
}
