import dsmClinicalContent from "@/data/dsm-clinical-content.json";
import { normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";

export type DsmLabeledText = {
  label: string;
  text: string;
};

export type DsmSpecifier = {
  name: string;
  description: string | null;
};

export type DsmCategory = {
  key: string;
  label: string;
  css_class: string;
  color: string;
  diagnosis_count: number;
};

export type DsmDiagnosis = {
  record_id: string;
  slug: string;
  category: Pick<DsmCategory, "key" | "label">;
  icd_code: string;
  title: string;
  key_features: DsmLabeledText[];
  criteria_display: DsmLabeledText[];
  clinical_checkpoints: DsmLabeledText[];
  specifiers: DsmSpecifier[];
  differentials: string[];
  differential_notes: Array<Record<string, unknown>>;
  classification_notes: Array<Record<string, unknown>>;
  documentation_template: string;
  severity_specifier_supported: boolean;
};

type DsmClinicalContentExport = {
  export_format_version: string;
  generated_at: string;
  source_repository: string;
  content_scope: string;
  categories: DsmCategory[];
  diagnoses: Array<Omit<DsmDiagnosis, "slug">>;
};

export type DsmSearchMatch = {
  diagnosis: DsmDiagnosis;
  score: number;
  reasons: string[];
};

export type DsmDiagnosisSummary = Pick<DsmDiagnosis, "slug" | "title" | "icd_code" | "category"> & {
  summary: string;
  criteriaCount: number;
  differentialCount: number;
  specifierCount: number;
};

const exportData = dsmClinicalContent as DsmClinicalContentExport;

function slugFromRecordId(recordId: string) {
  return recordId.replace(/^DSM-[^-]+-/, "").toLowerCase();
}

export const dsmContentMetadata = {
  version: exportData.export_format_version,
  generatedAt: exportData.generated_at,
  sourceRepository: exportData.source_repository,
  scope: exportData.content_scope,
} as const;

export const dsmCategories = exportData.categories.filter((category) => category.diagnosis_count > 0);

export const dsmDiagnoses: DsmDiagnosis[] = exportData.diagnoses.map((diagnosis) => ({
  ...diagnosis,
  slug: slugFromRecordId(diagnosis.record_id),
  key_features: diagnosis.key_features ?? [],
  criteria_display: diagnosis.criteria_display ?? [],
  clinical_checkpoints: diagnosis.clinical_checkpoints ?? [],
  specifiers: diagnosis.specifiers ?? [],
  differentials: diagnosis.differentials ?? [],
  differential_notes: diagnosis.differential_notes ?? [],
  classification_notes: diagnosis.classification_notes ?? [],
}));

const diagnosisBySlug = new Map(dsmDiagnoses.map((diagnosis) => [diagnosis.slug, diagnosis] as const));
const diagnosisByNormalizedTitle = new Map(
  dsmDiagnoses.map((diagnosis) => [normalizeSearchText(diagnosis.title), diagnosis] as const),
);

// Lookup by parenthetical abbreviation in title (e.g., "PMDD" from "Premenstrual dysphoric disorder (PMDD)").
const PARENTHETICAL_ABBREV_RE = /\(([A-Z][A-Z0-9-]+)\)/;
const diagnosisByAbbreviation = new Map<string, DsmDiagnosis>();
for (const diagnosis of dsmDiagnoses) {
  const match = PARENTHETICAL_ABBREV_RE.exec(diagnosis.title);
  if (match) diagnosisByAbbreviation.set(match[1].toLowerCase(), diagnosis);
}

// Lookup by title initialism (e.g., "MDD" from "Major depressive disorder", "OCD" from
// "Obsessive-compulsive disorder", "PDD" from "Persistent depressive disorder (dysthymia)").
// Strip parentheticals first so aliases like PDD are not polluted by subtitle words.
// Splits on spaces, hyphens, and slashes.
const diagnosisByInitialism = new Map<string, DsmDiagnosis>();
for (const diagnosis of dsmDiagnoses) {
  const initialism = diagnosis.title
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s\-\/]+/)
    .map((word) => word[0])
    .filter((char) => Boolean(char) && /[A-Za-z0-9]/i.test(char))
    .join("")
    .toLowerCase();
  if (initialism.length >= 2 && !diagnosisByInitialism.has(initialism)) {
    diagnosisByInitialism.set(initialism, diagnosis);
  }
}

// Lookup by normalized title with slashes collapsed to spaces, covering alternate formatting
// such as "Persistent depressive disorder / dysthymia" matching the title
// "Persistent depressive disorder (dysthymia)".
function normalizeWithSlash(text: string) {
  return normalizeSearchText(text.replace(/\s*\/\s*/g, " "));
}
const diagnosisBySlashNormalizedTitle = new Map(
  dsmDiagnoses.map((diagnosis) => [normalizeWithSlash(diagnosis.title), diagnosis] as const),
);

export function getDsmDiagnosis(slug: string) {
  return diagnosisBySlug.get(slug.toLowerCase());
}

export function dsmCriteria(diagnosis: DsmDiagnosis) {
  return diagnosis.criteria_display.length > 0 ? diagnosis.criteria_display : diagnosis.key_features;
}

export function dsmDiagnosisSummary(diagnosis: DsmDiagnosis): DsmDiagnosisSummary {
  const criteria = dsmCriteria(diagnosis);
  return {
    slug: diagnosis.slug,
    title: diagnosis.title,
    icd_code: diagnosis.icd_code,
    category: diagnosis.category,
    summary: criteria[0]?.text ?? diagnosis.key_features[0]?.text ?? "Review the complete diagnostic record.",
    criteriaCount: criteria.length,
    differentialCount: diagnosis.differentials.length,
    specifierCount: diagnosis.specifiers.length,
  };
}

export function dsmDiagnosisSearchText(diagnosis: DsmDiagnosis) {
  return normalizeSearchText(
    [
      diagnosis.title,
      diagnosis.slug,
      diagnosis.icd_code,
      diagnosis.category.label,
      ...diagnosis.key_features.flatMap((feature) => [feature.label, feature.text]),
      ...diagnosis.criteria_display.flatMap((criterion) => [criterion.label, criterion.text]),
      ...diagnosis.clinical_checkpoints.flatMap((checkpoint) => [checkpoint.label, checkpoint.text]),
      ...diagnosis.specifiers.flatMap((specifier) => [specifier.name, specifier.description ?? ""]),
      ...diagnosis.differentials,
    ].join(" "),
  );
}

export function rankDsmDiagnoses(
  query: string,
  limit = dsmDiagnoses.length,
  expansions: string[] = [],
): DsmSearchMatch[] {
  const normalizedExpansions = expansions.map(normalizeSearchText).filter(Boolean);
  return rankCatalogRecords(dsmDiagnoses, query, {
    fields: [
      {
        id: "title",
        weight: 8,
        text: (diagnosis) => normalizeSearchText(`${diagnosis.title} ${diagnosis.slug}`),
      },
      {
        id: "code",
        weight: 7,
        text: (diagnosis) => normalizeSearchText(diagnosis.icd_code),
      },
      {
        id: "category",
        weight: 4,
        text: (diagnosis) => normalizeSearchText(diagnosis.category.label),
      },
      {
        id: "criteria",
        weight: 3,
        text: (diagnosis) =>
          normalizeSearchText(
            dsmCriteria(diagnosis)
              .map((criterion) => criterion.text)
              .join(" "),
          ),
      },
    ],
    fullText: dsmDiagnosisSearchText,
    contentWeight: 2,
    compactBonus: 4,
    compactExtraText: (diagnosis) => normalizeSearchText(diagnosis.title),
    phraseBonus: 6,
    exactValues: (diagnosis) => [normalizeSearchText(diagnosis.title), normalizeSearchText(diagnosis.slug)],
    exactBonus: 14,
    prefixValues: (diagnosis) => [normalizeSearchText(diagnosis.title), normalizeSearchText(diagnosis.slug)],
    prefixBonus: 5,
    expandTokens: (terms) => [...terms, ...normalizedExpansions],
    limit,
    tieBreak: (left, right) => left.title.localeCompare(right.title),
  }).map(({ record, score, signals }) => ({
    diagnosis: record,
    score,
    reasons: [
      signals.exact ? "Exact diagnosis" : null,
      signals.prefix ? "Title match" : null,
      signals.fields.code ? "ICD code" : null,
      signals.fields.category ? "Category" : null,
      signals.fields.criteria ? "Criteria" : null,
      signals.content ? "Clinical content" : null,
    ].filter((reason): reason is string => Boolean(reason)),
  }));
}

export function listDsmDiagnosisSummaries(options: { query?: string; category?: string } = {}) {
  const query = options.query?.trim() ?? "";
  const records = query
    ? rankDsmDiagnoses(query).map((match) => match.diagnosis)
    : [...dsmDiagnoses].sort((left, right) => left.title.localeCompare(right.title));
  return records
    .filter((diagnosis) => !options.category || diagnosis.category.key === options.category)
    .map(dsmDiagnosisSummary);
}

export function resolveDsmDifferential(value: string) {
  const title = value.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const normalized = normalizeSearchText(title);
  const exact = diagnosisByNormalizedTitle.get(normalized);
  if (exact) return exact;

  // Try abbreviation from parenthetical (e.g., PMDD → "Premenstrual dysphoric disorder (PMDD)").
  const byAbbrev = diagnosisByAbbreviation.get(normalized);
  if (byAbbrev) return byAbbrev;

  // Try initialism match (e.g., MDD → "Major depressive disorder").
  const byInitialism = diagnosisByInitialism.get(normalized);
  if (byInitialism) return byInitialism;

  // Try slash-normalized title match (e.g., "Persistent depressive disorder / dysthymia").
  const bySlash = diagnosisBySlashNormalizedTitle.get(normalizeWithSlash(title));
  if (bySlash) return bySlash;

  return dsmDiagnoses.find((diagnosis) => {
    const candidate = normalizeSearchText(diagnosis.title);
    return candidate.startsWith(normalized) || normalized.startsWith(candidate);
  });
}

export function dsmStaticParams() {
  return dsmDiagnoses.map((diagnosis) => ({ slug: diagnosis.slug }));
}

export const defaultDsmComparisonSlugs = [
  "major-depressive-disorder",
  "bipolar-ii-disorder",
  "persistent-depressive-disorder-dysthymia",
] as const;
