import type { ClinicalBadgeTone } from "@/components/clinical-dashboard/clinical-badge";
import type {
  MedicationPatientMetadata,
  MedicationRecord,
  MedicationSectionRow,
  MedicationStat,
} from "@/lib/medications";

const clinicalBadgeTonePriority: Record<ClinicalBadgeTone, number> = {
  danger: 6,
  warning: 5,
  clinical: 4,
  success: 3,
  neutral: 2,
  info: 1,
};

export type MedicationGovernance = {
  sourceStatus?: string;
  validationStatus?: string;
};

export type MedicationBadge = {
  id: string;
  label: string;
  tone: ClinicalBadgeTone;
};

const TAG_TONES: Record<string, ClinicalBadgeTone> = {
  PBS: "success",
  TGA: "info",
  OFF: "warning",
};

const FACTOR_LABELS: Record<string, string> = {
  renal: "Renal",
  hepatic: "Hepatic",
  pregnancy: "Pregnancy",
  lactation: "Breastfeeding",
  elderly: "Elderly",
  paediatric: "Paediatric",
};

function sectionByType(record: MedicationRecord, type: string) {
  return record.sections.find((section) => section.type === type);
}

function firstRowValue(record: MedicationRecord, type: string, keyIncludes?: string) {
  const section = sectionByType(record, type);
  if (!section) return "";
  const row = keyIncludes
    ? section.rows.find((item) => item.key.toLowerCase().includes(keyIncludes.toLowerCase()))
    : section.rows[0];
  return row?.val?.trim() ?? "";
}

function firstRow(record: MedicationRecord, type: string, keyIncludes?: string) {
  const section = sectionByType(record, type);
  if (!section) return undefined;
  return keyIncludes
    ? section.rows.find((item) => item.key.toLowerCase().includes(keyIncludes.toLowerCase()))
    : section.rows[0];
}

function quickValue(record: MedicationRecord, labelIncludes: string) {
  const row = record.quick.find((item) => item.label.toLowerCase().includes(labelIncludes.toLowerCase()));
  return row?.value?.trim() ?? "";
}

function pushBadge(badges: MedicationBadge[], badge: MedicationBadge) {
  if (!badges.some((existing) => existing.id === badge.id)) {
    badges.push(badge);
  }
}

export function dedupeBadges(badges: MedicationBadge[]): MedicationBadge[] {
  const seen = new Set<string>();
  return badges.filter((badge) => {
    if (seen.has(badge.id)) return false;
    seen.add(badge.id);
    return true;
  });
}

export function sortBadgesByPriority(badges: MedicationBadge[]): MedicationBadge[] {
  return [...badges].sort((a, b) => clinicalBadgeTonePriority[b.tone] - clinicalBadgeTonePriority[a.tone]);
}

function formulationShortLabel(value: string): string | null {
  const cleaned = value
    .replace(/\*\*/g, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  if (!cleaned) return null;

  const mgMatch = cleaned.match(/(\d+)\s*mg/i);
  if (mgMatch) {
    const mg = mgMatch[1];
    const isEc = /enteric/i.test(cleaned);
    const isTab = /tablet/i.test(cleaned);
    if (isEc && isTab) return `${mg} mg EC tablet`;
    if (isTab) return `${mg} mg tablet`;
    if (isEc) return `${mg} mg EC`;
    return `${mg} mg`;
  }

  const firstSentence = cleaned.split(".")[0]?.trim() ?? "";
  if (!firstSentence) return null;
  return firstSentence.length > 28 ? `${firstSentence.slice(0, 28).trim()}…` : firstSentence;
}

function parsePbsBadges(pbsText: string, badges: MedicationBadge[]) {
  const upper = pbsText.toUpperCase();
  if (upper.includes("STREAMLINED PBS")) {
    pushBadge(badges, { id: "identity-pbs-streamlined", label: "PBS streamlined", tone: "success" });
  } else if (/AUTHORITY REQUIRED/i.test(pbsText)) {
    pushBadge(badges, { id: "identity-pbs-authority", label: "Authority required", tone: "warning" });
  }

  const itemMatch = pbsText.match(/\bitem\s+(\d{4}[A-Z])\b/i) ?? pbsText.match(/\b(\d{4}[A-Z])\b/);
  if (itemMatch?.[1]) {
    pushBadge(badges, { id: `identity-pbs-item-${itemMatch[1]}`, label: itemMatch[1], tone: "neutral" });
  }
}

function isReviewed(record: MedicationRecord, governance?: MedicationGovernance) {
  if (governance?.validationStatus === "locally_reviewed" || governance?.validationStatus === "approved") {
    return true;
  }
  const sourceText = firstRowValue(record, "src", "source review").toLowerCase();
  return sourceText.includes("checked");
}

function patientBadges(patient: MedicationPatientMetadata, prefix: string, badges: MedicationBadge[]) {
  const match = patient.match ?? {};
  const scr = match.scr as { gt?: number } | undefined;
  if (typeof scr?.gt === "number") {
    pushBadge(badges, {
      id: `${prefix}-scr-gt-${scr.gt}`,
      label: `Cr >${scr.gt} avoid`,
      tone: "danger",
    });
  }

  const age = match.age as { lt?: number; gt?: number } | undefined;
  if (typeof age?.lt === "number") {
    pushBadge(badges, {
      id: `${prefix}-age-lt-${age.lt}`,
      label: `Avoid <${age.lt} years`,
      tone: "warning",
    });
  }
  if (typeof age?.gt === "number") {
    pushBadge(badges, {
      id: `${prefix}-age-gt-${age.gt}`,
      label: `Avoid >${age.gt} years`,
      tone: "warning",
    });
  }

  const action = patient.action ?? "";
  const severity = patient.severity === "danger" ? "danger" : action === "contraindication" ? "danger" : "warning";
  const factorTone: ClinicalBadgeTone =
    action === "monitor" || action === "dose-adjust" ? "clinical" : severity === "danger" ? "danger" : "warning";

  for (const factor of patient.factors ?? []) {
    const label = FACTOR_LABELS[factor] ?? factor.charAt(0).toUpperCase() + factor.slice(1);
    pushBadge(badges, {
      id: `${prefix}-factor-${factor}`,
      label,
      tone: action === "contraindication" ? "danger" : factorTone,
    });
  }
}

function textHeuristicBadges(
  row: MedicationSectionRow,
  sectionType: string,
  prefix: string,
  badges: MedicationBadge[],
) {
  const val = row.val.replace(/\*\*/g, "");
  const keyLower = row.key.toLowerCase();
  const combined = `${row.key} ${val}`.toLowerCase();

  if (/^critical\b/i.test(val) || /^contraindicated\b/i.test(val)) {
    pushBadge(badges, { id: `${prefix}-contraindicated`, label: "Contraindicated", tone: "danger" });
  }

  if (sectionType === "risk") {
    const severityMatch = val.match(/^(HIGH|MODERATE|LOW)\b/i);
    if (severityMatch?.[1]) {
      const level = severityMatch[1].toUpperCase();
      pushBadge(badges, {
        id: `${prefix}-severity-${level}`,
        label: level.charAt(0) + level.slice(1).toLowerCase(),
        tone: level === "HIGH" ? "warning" : "neutral",
      });
    }
  }

  if (combined.includes("<60 kg") || combined.includes("< 60 kg")) {
    pushBadge(badges, { id: `${prefix}-reduce-60kg`, label: "Reduce <60 kg", tone: "warning" });
  }
  if (combined.includes("child-pugh c")) {
    pushBadge(badges, { id: `${prefix}-child-pugh-c`, label: "Child-Pugh C", tone: "danger" });
  }
  if (combined.includes("do not crush")) {
    pushBadge(badges, { id: `${prefix}-do-not-crush`, label: "Do not crush", tone: "warning" });
  }
  if (combined.includes("take with food") || combined.includes("with meals")) {
    pushBadge(badges, { id: `${prefix}-with-food`, label: "Take with food", tone: "clinical" });
  }

  if (sectionType === "dose" && keyLower.includes("renal")) {
    pushBadge(badges, { id: `${prefix}-renal-adjust`, label: "Renal adjustment", tone: "warning" });
  }
}

export function medicationIdentityBadges(
  record: MedicationRecord,
  governance?: MedicationGovernance,
): MedicationBadge[] {
  const badges: MedicationBadge[] = [];

  if (record.tag) {
    pushBadge(badges, { id: "identity-tag", label: record.tag, tone: "neutral" });
  }
  if (record.schedule) {
    pushBadge(badges, {
      id: "identity-schedule",
      label: record.schedule,
      tone: record.schedule === "S8" ? "danger" : "info",
    });
  }

  const brand = firstRowValue(record, "form", "brand");
  if (brand) {
    pushBadge(badges, { id: "identity-brand", label: brand.replace(/\*\*/g, ""), tone: "neutral" });
  }

  const formulation = formulationShortLabel(quickValue(record, "route / formulation"));
  if (formulation) {
    pushBadge(badges, { id: "identity-formulation", label: formulation, tone: "neutral" });
  }

  const primaryRow = firstRow(record, "ind", "primary");
  for (const tag of primaryRow?.tags ?? []) {
    pushBadge(badges, {
      id: `identity-ind-tag-${tag}`,
      label: tag,
      tone: TAG_TONES[tag] ?? "neutral",
    });
  }

  const pbsText = firstRowValue(record, "form", "prescribing & pbs");
  if (pbsText) {
    parsePbsBadges(pbsText, badges);
  }

  if (isReviewed(record, governance)) {
    pushBadge(badges, { id: "identity-reviewed", label: "Reviewed", tone: "success" });
  }

  if (governance?.sourceStatus === "review_due") {
    pushBadge(badges, { id: "identity-review-due", label: "Review due", tone: "warning" });
  } else if (governance?.sourceStatus === "outdated") {
    pushBadge(badges, { id: "identity-outdated", label: "Outdated", tone: "danger" });
  }

  return sortBadgesByPriority(dedupeBadges(badges));
}

export function medicationRowBadges(row: MedicationSectionRow, sectionType: string): MedicationBadge[] {
  const badges: MedicationBadge[] = [];
  const prefix = `row-${sectionType}-${row.key}`.replace(/\s+/g, "-").toLowerCase();

  if (row.patient) {
    patientBadges(row.patient, prefix, badges);
  }

  for (const tag of row.tags ?? []) {
    pushBadge(badges, {
      id: `${prefix}-tag-${tag}`,
      label: tag,
      tone: TAG_TONES[tag] ?? "info",
    });
  }

  textHeuristicBadges(row, sectionType, prefix, badges);

  const limit = sectionType === "contra" || badges.some((badge) => badge.tone === "danger") ? 4 : 3;
  return sortBadgesByPriority(dedupeBadges(badges)).slice(0, limit);
}

export function medicationAccessBadges(record: MedicationRecord): MedicationBadge[] {
  const badges: MedicationBadge[] = [];
  const brand = firstRowValue(record, "form", "brand");
  if (brand) {
    pushBadge(badges, { id: "access-brand", label: brand.replace(/\*\*/g, ""), tone: "neutral" });
  }

  const pbsText = firstRowValue(record, "form", "prescribing & pbs");
  if (pbsText) {
    parsePbsBadges(pbsText, badges);
    const itemMatch = pbsText.match(/\bitem\s+(\d{4}[A-Z])\b/i);
    if (itemMatch?.[1]) {
      pushBadge(badges, { id: `access-item-${itemMatch[1]}`, label: `Item ${itemMatch[1]}`, tone: "neutral" });
    }
  }

  const routes = firstRowValue(record, "form", "oral routes");
  if (routes) {
    const short = formulationShortLabel(routes);
    if (short) {
      pushBadge(badges, { id: "access-formulation", label: short, tone: "neutral" });
    }
  }

  return sortBadgesByPriority(dedupeBadges(badges)).slice(0, 4);
}

export function medicationStatTone(stat: MedicationStat): ClinicalBadgeTone {
  const cls = stat.cls?.toLowerCase() ?? "";
  const flag = stat.flag?.toLowerCase() ?? "";
  if (cls === "hi" || flag === "hi") return "danger";
  if (cls === "warn" || flag === "warn") return "warning";
  if (cls === "good") return "success";
  return "neutral";
}

export function medicationAccessFields(record: MedicationRecord): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [];
  const brand = firstRowValue(record, "form", "brand");
  if (brand) fields.push({ label: "Brand", value: brand.replace(/\*\*/g, "") });

  const pbsText = firstRowValue(record, "form", "prescribing & pbs");
  if (pbsText) {
    if (/STREAMLINED PBS/i.test(pbsText)) {
      fields.push({ label: "PBS status", value: "PBS streamlined" });
    } else if (/AUTHORITY REQUIRED/i.test(pbsText)) {
      fields.push({ label: "PBS status", value: "Authority required" });
    }
    const itemMatch = pbsText.match(/\bitem\s+(\d{4}[A-Z])\b/i);
    if (itemMatch?.[1]) {
      fields.push({ label: "PBS item", value: itemMatch[1] });
    }
  }

  const routes = firstRowValue(record, "form", "oral routes");
  if (routes) {
    fields.push({ label: "Formulation", value: routes.replace(/\*\*/g, "").split(".")[0]?.trim() ?? routes });
  }

  return fields;
}
