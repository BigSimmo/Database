import { normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";
import { cleanDifferentialItem, type DifferentialDetailContext } from "@/lib/differential-detail";
import { loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import { deriveGovernanceFromSnapshot } from "@/lib/differential-records";
import {
  type DifferentialPresentationMatch,
  type DifferentialRecordMatch,
} from "@/lib/differential-search-composition";
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
export {
  composeDifferentialSearchResults,
  type DifferentialPresentationMatch,
  type DifferentialRecordMatch,
  type DifferentialSearchMatch,
  type DifferentialSearchResultItem,
} from "@/lib/differential-search-composition";

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

export function getPresentationWorkflowForDiagnosisIds(ids: Iterable<string>) {
  const requestedIds = new Set(Array.from(ids, (id) => id.trim().toLowerCase()).filter(Boolean));
  if (!requestedIds.size) return null;

  let bestMatch: DifferentialPresentationWorkflow | null = null;
  let bestMatchCount = 0;
  for (const presentation of differentialPresentations()) {
    const matchCount = presentation.candidates.reduce(
      (count, candidate) => count + (requestedIds.has(candidate.slug) ? 1 : 0),
      0,
    );
    if (matchCount > bestMatchCount) {
      bestMatch = presentation;
      bestMatchCount = matchCount;
    }
  }
  return bestMatch;
}

export function getPresentationWorkflowSelectionForDiagnosisIds(ids: Iterable<string>) {
  const diagnosisIds = Array.from(new Set(Array.from(ids, (id) => id.trim().toLowerCase()).filter(Boolean)));
  const workflow = getPresentationWorkflowForDiagnosisIds(diagnosisIds);
  if (!workflow) return null;
  const candidateIds = new Set(workflow.candidates.map((candidate) => candidate.slug));
  return {
    workflow,
    diagnosisIds: diagnosisIds.filter((id) => candidateIds.has(id)),
  };
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
  const routableDiagnosisSlugs = new Set(differentialRecords.map((entry) => entry.slug));
  const routablePresentationSlugs = new Set(differentialPresentations().map((entry) => entry.id));
  const knownRelatedSlugs = [
    ...new Set(record.related.map((node) => node.id).filter((id) => routableDiagnosisSlugs.has(id))),
  ];

  const overlapLinks: Record<string, string> = {};
  const titleMap = diagnosisTitleSlugMap(catalogRecords);
  for (const section of record.sections) {
    if (section.tone !== "overlap") continue;
    for (const item of section.items) {
      const cleaned = cleanDifferentialItem(item);
      const slug = titleMap.get(cleaned.toLowerCase());
      if (slug && slug !== record.slug && routableDiagnosisSlugs.has(slug)) overlapLinks[cleaned] = slug;
    }
  }

  const presentation =
    catalogPresentations.find(
      (workflow) =>
        routablePresentationSlugs.has(workflow.id) &&
        workflow.candidates.some((candidate) => candidate.slug === record.slug),
    ) ?? null;

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

// Cross-entity link indexes: presentations and diagnoses are one logical catalogue joined
// by workflow.candidates[].slug, so each ranker also indexes the other kind's titles at low
// weight. Both caches are built lazily from the static snapshot (no invalidation needed).

let diagnosisTitleBySlugCache: Map<string, string> | null = null;

function diagnosisTitleBySlug(): Map<string, string> {
  diagnosisTitleBySlugCache ??= new Map(differentialRecords.map((record) => [record.slug, record.title]));
  return diagnosisTitleBySlugCache;
}

let presentationTitleTextBySlugCache: Map<string, string> | null = null;

/** Reverse index text: normalized titles of the snapshot presentations that list this
 *  diagnosis as a candidate, so a presentation-shaped query ("acute confusion") surfaces
 *  the differentials it works up. */
function presentationTitleTextForDiagnosis(slug: string): string {
  if (!presentationTitleTextBySlugCache) {
    presentationTitleTextBySlugCache = new Map();
    for (const workflow of differentialPresentations()) {
      const text = normalizeSearchText(`${workflow.title} ${workflow.id}`);
      for (const candidate of workflow.candidates) {
        const existing = presentationTitleTextBySlugCache.get(candidate.slug);
        presentationTitleTextBySlugCache.set(candidate.slug, existing ? `${existing} ${text}` : text);
      }
    }
  }
  return presentationTitleTextBySlugCache.get(slug) ?? "";
}

/** Forward index text: the candidate differentials' titles (falling back to de-hyphenated
 *  slugs for candidates outside the snapshot, e.g. owner-edited rows), so a diagnosis-shaped
 *  query ("wernicke") surfaces the presentations that work it up. Computed from the passed
 *  workflow so owner rows ranked via the differentials API get the same treatment. */
function candidateTitlesText(workflow: DifferentialPresentationWorkflow): string {
  const titles = diagnosisTitleBySlug();
  return normalizeSearchText(
    workflow.candidates.map((candidate) => titles.get(candidate.slug) ?? candidate.slug.replace(/-/g, " ")).join(" "),
  );
}

const differentialStatusRank: Record<DifferentialRecord["status"], number> = {
  emergent: 0,
  urgent: 1,
  routine: 2,
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
      // Cross-entity lane (kept out of fullText so it never earns the phrase/content
      // double-count): weight sits well below title/hinge, so a presentation-shaped query
      // surfaces the candidates without ever outranking a direct match; equal-score
      // candidates fall to the emergent-first tie-break below.
      { id: "presentations", weight: 2, text: (record) => presentationTitleTextForDiagnosis(record.slug) },
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
      signals.fields.presentations ? "presentation link" : "",
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
  // Low-weight synonym/acronym/alias terms (see rankDifferentialRecords) composed onto the
  // catalogue's own symptom-alias expansion for the shared ranker's expanded lane.
  expansions: string[] = [],
): DifferentialPresentationMatch[] {
  return rankCatalogRecords(workflows, query, {
    fields: [
      { id: "title", weight: 8, text: (workflow) => normalizeSearchText(`${workflow.title} ${workflow.id}`) },
      { id: "safety", weight: 4, text: presentationSafetyText },
      // Cross-entity lane (see rankDifferentialRecords' "presentations" field): the candidate
      // differentials' titles, so a diagnosis-shaped query surfaces the presentations that
      // work it up without outranking the diagnosis's own record.
      { id: "candidates", weight: 2, text: candidateTitlesText },
    ],
    fullText: presentationFullText,
    contentWeight: 2,
    compactBonus: 6,
    compactExtraText: (workflow) => normalizeSearchText(workflow.title),
    phraseBonus: 4,
    exactValues: (workflow) => [normalizeSearchText(workflow.title), normalizeSearchText(workflow.id)],
    exactBonus: 10,
    expandTokens: expansions.length ? (terms) => [...expandQueryTerms(terms), ...expansions] : expandQueryTerms,
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
      signals.fields.candidates ? "candidate differential" : "",
      signals.content ? "content" : "",
      signals.expanded ? "symptom alias" : "",
    ].filter(Boolean),
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
