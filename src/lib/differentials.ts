import { normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";
import { cleanDifferentialItem, type DifferentialDetailContext } from "@/lib/differential-detail";
import { loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import { deriveGovernanceFromSnapshot } from "@/lib/differential-records";
import type {
  DifferentialComparisonCandidate,
  DifferentialComparisonCriterion,
  DifferentialMapNode,
  DifferentialPresentationWorkflow,
  DifferentialRecord,
  DifferentialRedFlagFlow,
  DifferentialScenarioPreset,
  DifferentialSection,
} from "@/lib/differential-snapshot";

export type DifferentialStreamType = "presentations" | "diagnoses";

export type DifferentialLikelihood = "most-likely" | "possible" | "less-likely" | "must-not-miss";

export type DifferentialStreamCard = {
  id: string;
  title: string;
  description: string;
  examples: string[];
  href: string;
};

export type {
  DifferentialComparisonCandidate,
  DifferentialComparisonCriterion,
  DifferentialMapNode,
  DifferentialPresentationWorkflow,
  DifferentialRecord,
  DifferentialRedFlagFlow,
  DifferentialScenarioPreset,
  DifferentialSection,
};

function catalog() {
  return loadDifferentialSnapshot();
}

export { loadDifferentialSnapshot } from "@/lib/differential-fixtures";

export const differentialRecords: DifferentialRecord[] = catalog().diagnoses;

export function differentialPresentations(): DifferentialPresentationWorkflow[] {
  return catalog().presentations;
}

export function differentialScenarioPresets(): DifferentialScenarioPreset[] {
  // The generated snapshot can carry markdown-header artifacts (e.g. "# Scenario
  // Presets") as synthetic first rows; they are not searchable presets.
  return catalog().presets.filter((preset) => !preset.query.trimStart().startsWith("#"));
}

export function differentialRedFlagFlows(): DifferentialRedFlagFlow[] {
  return catalog().redFlagFlows;
}

export function differentialSearchAliases(): Record<string, string[]> {
  // The generated snapshot can leak template metadata (field name → numeric
  // weight, e.g. "tags" → ["1.1"]) into the alias map; bare-number aliases
  // would match unrelated records by substring, so drop them.
  return Object.fromEntries(
    Object.entries(catalog().searchAliases)
      .map(([token, aliases]) => [token, aliases.filter((alias) => !/^\d+(\.\d+)?$/.test(alias.trim()))] as const)
      .filter(([, aliases]) => aliases.length > 0),
  );
}

export function getPresentationWorkflow(slug: string | null | undefined) {
  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) return null;
  return differentialPresentations().find((presentation) => presentation.id === normalizedSlug) ?? null;
}

export const acuteConfusionPresentationWorkflow: DifferentialPresentationWorkflow =
  getPresentationWorkflow("acute-confusion-encephalopathy") ?? differentialPresentations()[0]!;

export const differentialPresentationsCards: DifferentialStreamCard[] = differentialPresentations().map(
  (presentation) => ({
    id: `presentation-${presentation.id}`,
    title: presentation.title,
    description: presentation.subtitle,
    examples: presentation.safetySnapshot.tags.slice(0, 3),
    href: `/differentials/presentations/${presentation.id}`,
  }),
);

export const differentialDiagnosesCards: DifferentialStreamCard[] = differentialRecords.map((record) => ({
  id: `diagnosis-${record.slug}`,
  title: record.title,
  description: record.clinicalHinge,
  examples: record.related.slice(0, 3).map((node) => node.label),
  href: `/differentials/diagnoses/${record.slug}`,
}));

export function getDifferentialRecord(slug: string | null | undefined) {
  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) return null;
  return differentialRecords.find((record) => record.slug === normalizedSlug) ?? null;
}

export function presentationStaticParams() {
  return differentialPresentations().map((presentation) => ({ slug: presentation.id }));
}

function diagnosisTitleSlugMap(records: DifferentialRecord[]) {
  const titleToSlug = new Map<string, string>();
  for (const record of records) {
    const key = cleanDifferentialItem(record.title).toLowerCase();
    if (key && !titleToSlug.has(key)) titleToSlug.set(key, record.slug);
  }
  return titleToSlug;
}

/** Server-computed context for the diagnosis detail page. Everything the page
 *  needs from the full catalog travels in this small serializable payload so
 *  the client component never imports the generated snapshot. */
export function getDifferentialDetailContext(
  record: DifferentialRecord,
  catalog: {
    records?: DifferentialRecord[];
    presentations?: DifferentialPresentationWorkflow[];
  } = {},
): DifferentialDetailContext {
  const catalogRecords = catalog.records ?? differentialRecords;
  const catalogPresentations = catalog.presentations ?? differentialPresentations();
  const catalogSlugs = new Set(catalogRecords.map((entry) => entry.slug));
  const knownRelatedSlugs = [...new Set(record.related.map((node) => node.id).filter((id) => catalogSlugs.has(id)))];

  const overlapLinks: Record<string, string> = {};
  const titleMap = diagnosisTitleSlugMap(catalogRecords);
  for (const section of record.sections) {
    if (section.tone !== "overlap") continue;
    for (const item of section.items) {
      const cleaned = cleanDifferentialItem(item);
      const slug = titleMap.get(cleaned.toLowerCase());
      if (slug && slug !== record.slug) overlapLinks[cleaned] = slug;
    }
  }

  const presentation =
    catalogPresentations.find((workflow) => workflow.candidates.some((candidate) => candidate.slug === record.slug)) ??
    null;

  const snapshot = loadDifferentialSnapshot();
  const governance = deriveGovernanceFromSnapshot(snapshot);
  return {
    knownRelatedSlugs,
    overlapLinks,
    comparePresentation: presentation ? { slug: presentation.id, title: presentation.title } : null,
    source: {
      version: snapshot.governance.version,
      exportedAt: snapshot.exportedAt,
      reviewStatus: snapshot.governance.reviewStatus,
      sourceTitle: snapshot.governance.sourceTitle,
      sourceStatus: governance.source_status,
      validationStatus: governance.validation_status,
    },
  };
}

export function differentialStaticParams() {
  return differentialRecords.map((record) => ({ slug: record.slug }));
}

function expandQueryTerms(terms: string[]) {
  const aliases = differentialSearchAliases();
  const expanded = new Set(terms);
  for (const term of terms) {
    for (const alias of aliases[term] ?? []) {
      for (const aliasToken of normalizeSearchText(alias).split(/\s+/).filter(Boolean)) expanded.add(aliasToken);
      expanded.add(normalizeSearchText(alias));
    }
  }
  return [...expanded];
}

const differentialStatusRank: Record<DifferentialRecord["status"], number> = {
  emergent: 0,
  urgent: 1,
  routine: 2,
};

export type DifferentialRecordMatch = {
  record: DifferentialRecord;
  score: number;
  reasons: string[];
};

/** Back-compat alias kept for the universal-search workstream naming. */
export type DifferentialSearchMatch = DifferentialRecordMatch;

export type DifferentialPresentationMatch = {
  workflow: DifferentialPresentationWorkflow;
  score: number;
  reasons: string[];
};

function diagnosisHingeText(record: DifferentialRecord) {
  return normalizeSearchText(
    [record.subtitle, record.clinicalHinge, record.safetySnapshot.summary, ...record.safetySnapshot.tags].join(" "),
  );
}

export function diagnosisFullText(record: DifferentialRecord) {
  return normalizeSearchText(
    [
      record.title,
      record.slug,
      record.subtitle,
      record.clinicalHinge,
      record.safetySnapshot.summary,
      ...record.safetySnapshot.tags,
      ...record.sections.flatMap((section) => [section.title, section.summary, ...section.items]),
      ...record.related.flatMap((node) => [node.label, node.note ?? ""]),
      ...record.currentPresentation,
      ...record.investigations,
      ...record.immediateActions,
    ].join(" "),
  );
}

/** Ranked catalogue search over diagnosis records, built on the shared
 *  rankCatalogRecords primitive. Records are passed in so the API can rank
 *  live owner rows and universal search can rank the snapshot with the same
 *  scoring. Alias expansion (symptom -> diagnosis vocabulary) comes from the
 *  imported catalogue's searchAliases; urgency shapes ties only, never
 *  outranking a stronger text match. */
export function rankDifferentialRecords(
  records: DifferentialRecord[],
  query: string,
  limit = 50,
  // Low-weight synonym/acronym/alias terms (see rankMedicationRecords) composed onto the
  // catalogue's own symptom-alias expansion for the shared ranker's expanded lane.
  expansions: string[] = [],
): DifferentialRecordMatch[] {
  return rankCatalogRecords(records, query, {
    fields: [
      { id: "title", weight: 8, text: (record) => normalizeSearchText(`${record.title} ${record.slug}`) },
      { id: "hinge", weight: 3, text: diagnosisHingeText },
    ],
    fullText: diagnosisFullText,
    contentWeight: 2,
    compactBonus: 6,
    compactExtraText: (record) => normalizeSearchText(record.title),
    phraseBonus: 4,
    exactValues: (record) => [normalizeSearchText(record.title), normalizeSearchText(record.slug)],
    exactBonus: 10,
    expandTokens: expansions.length ? (terms) => [...expandQueryTerms(terms), ...expansions] : expandQueryTerms,
    limit,
    tieBreak: (left, right) =>
      differentialStatusRank[left.status] - differentialStatusRank[right.status] ||
      left.title.localeCompare(right.title),
  }).map(({ record, score, signals }) => ({
    record,
    score,
    reasons: [
      signals.fields.title ? "title" : "",
      signals.exact || signals.compact ? "exact name" : "",
      signals.fields.hinge ? "clinical hinge/safety" : "",
      signals.content ? "content" : "",
      signals.expanded ? "symptom alias" : "",
    ].filter(Boolean),
  }));
}

function presentationSafetyText(workflow: DifferentialPresentationWorkflow) {
  return normalizeSearchText([workflow.subtitle, ...workflow.safetySnapshot.tags].join(" "));
}

export function presentationFullText(workflow: DifferentialPresentationWorkflow) {
  return normalizeSearchText(
    [
      workflow.title,
      workflow.id,
      workflow.subtitle,
      ...workflow.safetySnapshot.tags,
      workflow.safetySnapshot.summary,
      workflow.highestUrgencyNote,
      ...workflow.reviewChecklist,
      ...workflow.candidates.map((candidate) => candidate.slug.replace(/-/g, " ")),
    ].join(" "),
  );
}

/** Ranked catalogue search over presentation workflows (same scoring family
 *  as rankDifferentialRecords, weighted towards safety tags). */
export function rankPresentationWorkflows(
  workflows: DifferentialPresentationWorkflow[],
  query: string,
  limit = 20,
): DifferentialPresentationMatch[] {
  return rankCatalogRecords(workflows, query, {
    fields: [
      { id: "title", weight: 8, text: (workflow) => normalizeSearchText(`${workflow.title} ${workflow.id}`) },
      { id: "safety", weight: 4, text: presentationSafetyText },
    ],
    fullText: presentationFullText,
    contentWeight: 2,
    compactBonus: 6,
    compactExtraText: (workflow) => normalizeSearchText(workflow.title),
    phraseBonus: 4,
    exactValues: (workflow) => [normalizeSearchText(workflow.title), normalizeSearchText(workflow.id)],
    exactBonus: 10,
    expandTokens: expandQueryTerms,
    limit,
    tieBreak: (left, right) =>
      differentialStatusRank[left.status] - differentialStatusRank[right.status] ||
      left.title.localeCompare(right.title),
  }).map(({ record, score, signals }) => ({
    workflow: record,
    score,
    reasons: [
      signals.fields.title ? "title" : "",
      signals.exact || signals.compact ? "exact name" : "",
      signals.fields.safety ? "safety focus" : "",
      signals.content ? "content" : "",
      signals.expanded ? "symptom alias" : "",
    ].filter(Boolean),
  }));
}

export type DifferentialSearchResultItem = {
  id: string;
  kind: "presentation" | "diagnosis";
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  status: DifferentialRecord["status"];
  score: number;
  matchLabel: "Best match" | "High match" | "Moderate match" | "Lower match";
  tags: string[];
  safety: string;
  reasons: string[];
};

function diagnosisResultItem(match: DifferentialRecordMatch): Omit<DifferentialSearchResultItem, "matchLabel"> {
  const { record, score, reasons } = match;
  return {
    id: record.slug,
    kind: "diagnosis",
    slug: record.slug,
    title: record.title,
    subtitle: record.clinicalHinge || record.subtitle,
    href: `/differentials/diagnoses/${record.slug}`,
    status: record.status,
    score,
    tags: [...record.currentPresentation.slice(0, 3), record.investigations[0]]
      .filter((value): value is string => Boolean(value?.trim()))
      .slice(0, 4),
    safety: record.safetySnapshot.summary,
    reasons,
  };
}

function presentationResultItem(
  match: DifferentialPresentationMatch,
): Omit<DifferentialSearchResultItem, "matchLabel"> {
  const { workflow, score, reasons } = match;
  return {
    id: workflow.id,
    kind: "presentation",
    slug: workflow.id,
    title: workflow.title,
    subtitle: workflow.subtitle,
    href: `/differentials/presentations/${workflow.id}`,
    status: workflow.status,
    score,
    tags: workflow.safetySnapshot.tags.slice(0, 4),
    safety: workflow.safetySnapshot.summary,
    reasons,
  };
}

/** Compose ranked diagnosis + presentation matches into one adaptive result
 *  list: when a presentation matches about as strongly as the best diagnosis
 *  it leads (followed by its candidate diagnoses in ranked order), otherwise
 *  results interleave purely by score. Deduped by id, capped at `limit`. */
export function composeDifferentialSearchResults(
  diagnoses: DifferentialRecordMatch[],
  presentations: DifferentialPresentationMatch[],
  limit = 8,
): DifferentialSearchResultItem[] {
  const items: Array<Omit<DifferentialSearchResultItem, "matchLabel">> = [];
  const seen = new Set<string>();
  const push = (item: Omit<DifferentialSearchResultItem, "matchLabel">) => {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  const topPresentation = presentations[0];
  const topDiagnosisScore = diagnoses[0]?.score ?? 0;
  const presentationLeads =
    Boolean(topPresentation) && (topDiagnosisScore === 0 || topPresentation!.score >= topDiagnosisScore * 0.8);

  if (topPresentation && presentationLeads) {
    push(presentationResultItem(topPresentation));
    const candidateSlugs = new Set(topPresentation.workflow.candidates.map((candidate) => candidate.slug));
    for (const match of diagnoses) {
      if (candidateSlugs.has(match.record.slug)) push(diagnosisResultItem(match));
    }
    for (const match of diagnoses) push(diagnosisResultItem(match));
    for (const match of presentations.slice(1)) push(presentationResultItem(match));
  } else {
    const merged = [
      ...diagnoses.map((match) => ({ score: match.score, item: diagnosisResultItem(match) })),
      ...presentations.map((match) => ({ score: match.score, item: presentationResultItem(match) })),
    ].sort((left, right) => right.score - left.score);
    for (const entry of merged) push(entry.item);
  }

  return items.slice(0, limit).map((item, index) => ({
    ...item,
    matchLabel:
      index === 0 ? "Best match" : item.score >= 12 ? "High match" : item.score >= 6 ? "Moderate match" : "Lower match",
  }));
}

/** Back-compat wrapper: empty query returns the full catalogue (the API route
 *  relies on this), otherwise relevance-ranked results in ranked order. */
export function searchDifferentialRecords(query: string) {
  if (!normalizeSearchText(query)) return differentialRecords;
  return rankDifferentialRecords(differentialRecords, query, differentialRecords.length).map((match) => match.record);
}

/** Back-compat wrapper: empty query returns all presentations, otherwise
 *  ranked results in ranked order. */
export function searchPresentationWorkflows(query: string) {
  const presentations = differentialPresentations();
  if (!normalizeSearchText(query)) return presentations;
  return rankPresentationWorkflows(presentations, query, presentations.length).map((match) => match.workflow);
}
