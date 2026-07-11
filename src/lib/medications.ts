import { normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";

export type MedicationPatientMetadata = {
  factors?: string[];
  action?: string;
  severity?: string;
  match?: Record<string, unknown>;
  note?: string;
};

export type MedicationSectionRow = {
  key: string;
  val: string;
  tags?: string[];
  patient?: MedicationPatientMetadata | null;
};

export type MedicationSection = {
  title: string;
  type: string;
  rows: MedicationSectionRow[];
};

export type MedicationStat = {
  label: string;
  value: string;
  cls?: string;
  flag?: string;
};

export type MedicationQuickRow = {
  label: string;
  value: string;
};

export type MedicationRecord = {
  slug: string;
  name: string;
  class: string;
  subclass: string;
  category: string;
  accent: string;
  tag: string;
  schedule: string;
  stats: MedicationStat[];
  sections: MedicationSection[];
  quick: MedicationQuickRow[];
};

export type MedicationSearchMatch = {
  medication: MedicationRecord;
  score: number;
  reasons: string[];
};

export type MedicationResultTone = "teal" | "blue" | "slate";

export type MedicationActionTone = "danger" | "warning" | "neutral";

export type MedicationSearchResult = {
  id: string;
  name: string;
  indication: string;
  match: string;
  dose: string;
  ceiling: string;
  action: string;
  actionTone: MedicationActionTone;
  tone: MedicationResultTone;
  href: string;
};

export function normalizeMedicationSlug(value: string) {
  return value.trim().toLowerCase();
}

export { normalizeSearchText };

export function normalizeRecord(record: MedicationRecord): MedicationRecord {
  return {
    ...record,
    slug: normalizeMedicationSlug(record.slug),
    name: record.name.trim(),
    class: record.class?.trim() ?? "",
    subclass: record.subclass?.trim() ?? "",
    category: record.category?.trim() ?? "",
    accent: record.accent?.trim() || "#0f766e",
    tag: record.tag?.trim() ?? "",
    schedule: record.schedule?.trim() ?? "",
    stats: Array.isArray(record.stats) ? record.stats : [],
    sections: Array.isArray(record.sections) ? record.sections : [],
    quick: Array.isArray(record.quick) ? record.quick : [],
  };
}

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

function statValue(record: MedicationRecord, labelIncludes: string) {
  const stat = record.stats.find((item) => item.label.toLowerCase().includes(labelIncludes.toLowerCase()));
  return stat?.value?.trim() ?? "";
}

function quickValue(record: MedicationRecord, labelIncludes: string) {
  const row = record.quick.find((item) => item.label.toLowerCase().includes(labelIncludes.toLowerCase()));
  return row?.value?.trim() ?? "";
}

export function medicationSearchText(record: MedicationRecord) {
  const sectionText = record.sections
    .flatMap((section) => [section.title, ...section.rows.flatMap((row) => [row.key, row.val, ...(row.tags ?? [])])])
    .join(" ");
  const quickText = record.quick.map((row) => `${row.label} ${row.value}`).join(" ");
  const statText = record.stats.map((stat) => `${stat.label} ${stat.value}`).join(" ");
  return normalizeSearchText(
    [
      record.name,
      record.slug,
      record.class,
      record.subclass,
      record.category,
      record.tag,
      record.schedule,
      sectionText,
      quickText,
      statText,
    ].join(" "),
  );
}

export function medicationIndication(record: MedicationRecord) {
  return (
    firstRowValue(record, "ind", "primary") ||
    firstRowValue(record, "summary", "overview") ||
    record.subclass ||
    record.category
  );
}

// Take the first sentence without mangling decimals ("1.5 mg") or common
// abbreviations ("e.g.", "i.e.", "etc.") the naive split(".")[0] used to cut
// mid-parenthesis ("Any hepatic impairment (e").
export function firstClinicalSentence(value: string): string {
  const text = value.trim();
  const periods = /\./g;
  let match: RegExpExecArray | null;
  while ((match = periods.exec(text))) {
    const next = text[match.index + 1];
    if (next !== undefined && !/\s/.test(next)) continue;
    const before = text.slice(0, match.index);
    if (/(?:^|[\s(])(?:e\.g|i\.e|etc|vs|approx)$/i.test(before)) continue;
    return before.trim();
  }
  return text;
}

export function medicationUsualDose(record: MedicationRecord) {
  const quickDose = quickValue(record, "usual dose");
  if (quickDose) return firstClinicalSentence(quickDose.replace(/\*\*/g, "")) || quickDose;
  const doseRow = sectionByType(record, "dose")?.rows[0];
  const doseValue = doseRow?.val?.replace(/\*\*/g, "");
  return doseValue ? firstClinicalSentence(doseValue) || "See dosing" : "See dosing";
}

export function medicationCeiling(record: MedicationRecord) {
  return statValue(record, "max dose") || statValue(record, "ceiling") || "See reference";
}

// The action tone is derived from which source field supplied the text (not from
// output-text heuristics): avoid/contraindication content is a hard stop (danger),
// monitoring/laboratory content is a check-first caution (warning), and summary or
// fallback text is neutral reference material.
export function medicationActionDetail(record: MedicationRecord): { text: string; tone: MedicationActionTone } {
  const sources: Array<{ raw: string; tone: MedicationActionTone }> = [
    { raw: quickValue(record, "avoid"), tone: "danger" },
    { raw: firstRowValue(record, "contra", "absolute"), tone: "danger" },
    { raw: firstRowValue(record, "summary", "clinical focus"), tone: "neutral" },
    { raw: firstRowValue(record, "mon", "laboratory"), tone: "warning" },
  ];
  const picked = sources.find((source) => source.raw) ?? {
    raw: "Review full prescribing reference.",
    tone: "neutral" as const,
  };
  const text = firstClinicalSentence(picked.raw.replace(/\*\*/g, "")) || "Review full prescribing reference";
  return { text, tone: picked.tone === "danger" ? avoidTextTone(text) : picked.tone };
}

// Avoid/contraindication fields are heterogeneous: hard stops ("Contraindicated
// in ...", "Severe respiratory depression, paralytic ileus"), explicit
// no-contraindication statements ("NONE — ...") and caution-only guidance
// ("Pregnancy Category B2", "requires pharmacist review and dose reduction").
// Only hard stops may carry the danger icon / "Do not use" prefix. Condition
// lists without any keyword stay danger — under-warning is the failure mode to
// avoid — so downgrades are keyed to explicit none/caution phrasing only.
const HARD_STOP_PATTERN = /contraindicat|do not\b|avoid\b|hypersensitiv|anaphylax|never\b|must not/i;
const CAUTION_ONLY_PATTERN =
  /pregnancy category|\bcategory [ab]\d?\b|pharmacist|dose reduction|reduce dose|requires?\b[^.]*\breview|generally (?:considered )?safe/i;

function avoidTextTone(text: string): MedicationActionTone {
  if (/^(?:none\b|no\s+(?:absolute\s+)?contraindication)/i.test(text)) {
    return /caution/i.test(text) ? "warning" : "neutral";
  }
  if (!HARD_STOP_PATTERN.test(text) && CAUTION_ONLY_PATTERN.test(text)) {
    return "warning";
  }
  return "danger";
}

export function medicationAction(record: MedicationRecord) {
  return medicationActionDetail(record).text;
}

export function medicationResultTone(record: MedicationRecord, score: number): MedicationResultTone {
  if (score >= 12) return "teal";
  if (score >= 6) return "blue";
  return "slate";
}

export function medicationToSearchResult(match: MedicationSearchMatch): MedicationSearchResult {
  const { medication, score } = match;
  const action = medicationActionDetail(medication);
  return {
    id: medication.slug,
    name: medication.name,
    indication: medicationIndication(medication),
    match: score >= 12 ? "Exact clinical fit" : score >= 6 ? "Good clinical fit" : "Related match",
    dose: medicationUsualDose(medication),
    ceiling: medicationCeiling(medication),
    action: action.text,
    actionTone: action.tone,
    tone: medicationResultTone(medication, score),
    href: `/medications/${medication.slug}`,
  };
}

export function rankMedicationRecords(
  records: MedicationRecord[],
  query: string,
  limit = 50,
  // Low-weight synonym/acronym/alias terms (e.g. from analyzeClinicalQuery) threaded into the
  // shared ranker's expanded lane: they add recall via the content haystack without competing
  // with exact name/prefix scoring. Empty by default so existing callers are unchanged.
  expansions: string[] = [],
): MedicationSearchMatch[] {
  return rankCatalogRecords(records, query, {
    fields: [
      {
        id: "name",
        weight: 8,
        text: (medication) => normalizeSearchText(`${medication.name} ${medication.slug}`),
      },
      {
        id: "taxonomy",
        weight: 3,
        text: (medication) =>
          normalizeSearchText(
            [medication.class, medication.subclass, medication.category, medication.tag, medication.schedule].join(" "),
          ),
      },
    ],
    fullText: medicationSearchText,
    contentWeight: 2,
    compactBonus: 6,
    compactExtraText: (medication) => normalizeSearchText(medication.name),
    phraseBonus: 4,
    exactValues: (medication) => [normalizeSearchText(medication.name), normalizeSearchText(medication.slug)],
    exactBonus: 10,
    prefixValues: (medication) => [normalizeSearchText(medication.name), normalizeSearchText(medication.slug)],
    prefixBonus: 5,
    expandTokens: expansions.length ? (terms) => [...terms, ...expansions] : undefined,
    limit,
    tieBreak: (left, right) => left.name.localeCompare(right.name),
  }).map(({ record, score, signals }) => ({
    medication: record,
    score,
    reasons: [
      signals.fields.name ? "name" : "",
      signals.prefix ? "name prefix" : "",
      signals.compact ? "exact name" : "",
      signals.fields.taxonomy ? "class/category" : "",
      signals.content ? "content" : "",
    ].filter(Boolean),
  }));
}

export { medicationIdentityBadges } from "@/lib/medication-badges";

export function medicationDetailTiles(record: MedicationRecord) {
  const usualDose = medicationUsualDose(record);
  const ceiling = medicationCeiling(record);
  const avoid = medicationAction(record);
  return [
    {
      label: "Prescribing answer",
      value: medicationIndication(record).split(".")[0] ?? record.name,
      meta: record.subclass || record.category,
    },
    {
      label: "Dosing",
      value: usualDose,
      meta: record.stats[0]?.label ?? "Usual dose",
    },
    {
      label: "Dose ceiling",
      value: ceiling,
      meta: "MAX",
    },
    {
      label: "Avoid",
      value: avoid?.split(",")[0] ?? "Review contraindications",
      meta: record.schedule === "S8" ? "Controlled" : "Safety",
      danger: true,
    },
  ];
}
