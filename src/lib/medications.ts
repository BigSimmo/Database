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

export type MedicationSearchResult = {
  id: string;
  name: string;
  indication: string;
  match: string;
  dose: string;
  ceiling: string;
  action: string;
  tone: MedicationResultTone;
  href: string;
};

export function normalizeMedicationSlug(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

export function medicationUsualDose(record: MedicationRecord) {
  const quickDose = quickValue(record, "usual dose");
  if (quickDose) return quickDose.replace(/\*\*/g, "").split(".")[0]?.trim() ?? quickDose;
  const doseRow = sectionByType(record, "dose")?.rows[0];
  return doseRow?.val?.replace(/\*\*/g, "").split(".")[0]?.trim() ?? "See dosing";
}

export function medicationCeiling(record: MedicationRecord) {
  return statValue(record, "max dose") || statValue(record, "ceiling") || "See reference";
}

export function medicationAction(record: MedicationRecord) {
  return (
    quickValue(record, "avoid") ||
    firstRowValue(record, "contra", "absolute") ||
    firstRowValue(record, "summary", "clinical focus") ||
    firstRowValue(record, "mon", "laboratory") ||
    "Review full prescribing reference."
  )
    .replace(/\*\*/g, "")
    .split(".")[0]
    ?.trim();
}

export function medicationResultTone(record: MedicationRecord, score: number): MedicationResultTone {
  if (score >= 12) return "teal";
  if (score >= 6) return "blue";
  return "slate";
}

export function medicationToSearchResult(match: MedicationSearchMatch): MedicationSearchResult {
  const { medication, score } = match;
  return {
    id: medication.slug,
    name: medication.name,
    indication: medicationIndication(medication),
    match: score >= 12 ? "Exact clinical fit" : score >= 6 ? "Good clinical fit" : "Related match",
    dose: medicationUsualDose(medication),
    ceiling: medicationCeiling(medication),
    action: medicationAction(medication) ?? "Review full prescribing reference.",
    tone: medicationResultTone(medication, score),
    href: `/medications/${medication.slug}`,
  };
}

export function rankMedicationRecords(records: MedicationRecord[], query: string, limit = 50): MedicationSearchMatch[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const terms = Array.from(new Set(normalizedQuery.split(/\s+/).filter((term) => term.length > 1)));

  return records
    .map((medication) => {
      const title = normalizeSearchText(medication.name);
      const slug = normalizeSearchText(medication.slug);
      const taxonomy = normalizeSearchText(
        [medication.class, medication.subclass, medication.category, medication.tag, medication.schedule].join(" "),
      );
      const text = medicationSearchText(medication);
      const compactText = text.replace(/\s+/g, "");
      const matchedTerms = terms.filter((term) => text.includes(term));
      const titleMatches = terms.filter((term) => title.includes(term) || slug.includes(term));
      const taxonomyMatches = terms.filter((term) => taxonomy.includes(term));
      const compactTitleMatch =
        compactQuery.length >= 4 &&
        (compactText.includes(compactQuery) || title.replace(/\s+/g, "").includes(compactQuery));

      const namePrefixMatch =
        normalizedQuery.length >= 3 && (title.startsWith(normalizedQuery) || slug.startsWith(normalizedQuery));

      let score = 0;
      score += titleMatches.length * 8;
      if (compactTitleMatch) score += 6;
      if (namePrefixMatch) score += 5;
      score += taxonomyMatches.length * 3;
      score += matchedTerms.length * 2;
      if (normalizedQuery && text.includes(normalizedQuery)) score += 4;
      if (title === normalizedQuery || slug === normalizedQuery) score += 10;

      const reasons = [
        titleMatches.length ? "name" : "",
        namePrefixMatch ? "name prefix" : "",
        compactTitleMatch ? "exact name" : "",
        taxonomyMatches.length ? "class/category" : "",
        matchedTerms.length ? "content" : "",
      ].filter(Boolean);

      return { medication, score, reasons };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.medication.name.localeCompare(right.medication.name))
    .slice(0, limit);
}

export function medicationIdentityBadges(record: MedicationRecord) {
  const badges: Array<{ label: string; tone?: "clinical" | "success" | "danger" | "warning" | "neutral" | "info" }> =
    [];
  if (record.tag) badges.push({ label: record.tag, tone: "neutral" });
  if (record.schedule) badges.push({ label: record.schedule, tone: record.schedule === "S8" ? "danger" : "info" });
  const brand = firstRowValue(record, "form", "brand");
  if (brand) badges.push({ label: brand, tone: "neutral" });
  return badges;
}

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
