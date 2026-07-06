import { loadDifferentialSnapshot } from "@/lib/differential-fixtures";
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
  return catalog().presets;
}

export function differentialRedFlagFlows(): DifferentialRedFlagFlow[] {
  return catalog().redFlagFlows;
}

export function differentialSearchAliases(): Record<string, string[]> {
  return catalog().searchAliases;
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

export function differentialStaticParams() {
  return differentialRecords.map((record) => ({ slug: record.slug }));
}

function expandQueryTokens(query: string) {
  const aliases = differentialSearchAliases();
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const alias of aliases[token] ?? []) expanded.add(alias);
  }
  return [...expanded];
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

export type DifferentialPresentationMatch = {
  workflow: DifferentialPresentationWorkflow;
  score: number;
  reasons: string[];
};

type QueryTermPlan = {
  normalizedQuery: string;
  compactQuery: string;
  terms: string[];
  aliasTerms: string[];
};

function buildQueryTermPlan(query: string): QueryTermPlan | null {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;
  const terms = Array.from(new Set(normalizedQuery.split(/\s+/).filter((term) => term.length > 1)));
  const aliasTerms = Array.from(
    new Set(
      expandQueryTokens(query)
        .map(normalizeSearchText)
        .filter((term) => term.length > 1 && !terms.includes(term)),
    ),
  );
  return {
    normalizedQuery,
    compactQuery: normalizedQuery.replace(/\s+/g, ""),
    terms,
    aliasTerms,
  };
}

/** Ranked catalogue search over diagnosis records. Records are passed in so
 *  the API can rank live owner rows and the client can rank snapshot data with
 *  the same scoring. Alias expansion (symptom -> diagnosis vocabulary) comes
 *  from the imported catalogue's searchAliases. */
export function rankDifferentialRecords(
  records: DifferentialRecord[],
  query: string,
  limit = 50,
): DifferentialRecordMatch[] {
  const plan = buildQueryTermPlan(query);
  if (!plan) return [];
  const { normalizedQuery, compactQuery, terms, aliasTerms } = plan;

  return records
    .map((record) => {
      const title = normalizeSearchText(record.title);
      const slug = normalizeSearchText(record.slug);
      const hingeText = normalizeSearchText(
        [record.subtitle, record.clinicalHinge, record.safetySnapshot.summary, ...record.safetySnapshot.tags].join(" "),
      );
      const contentText = normalizeSearchText(
        [
          ...record.sections.flatMap((section) => [section.title, section.summary, ...section.items]),
          ...record.related.flatMap((node) => [node.label, node.note ?? ""]),
          ...record.currentPresentation,
          ...record.investigations,
          ...record.immediateActions,
        ].join(" "),
      );
      const text = `${title} ${slug} ${hingeText} ${contentText}`;

      const titleMatches = terms.filter((term) => title.includes(term) || slug.includes(term));
      const hingeMatches = terms.filter((term) => hingeText.includes(term));
      const contentMatches = terms.filter((term) => contentText.includes(term));
      const aliasMatches = aliasTerms.filter((term) => text.includes(term));
      const exactName = title === normalizedQuery || slug === normalizedQuery;
      const compactTitleMatch = compactQuery.length >= 4 && title.replace(/\s+/g, "").includes(compactQuery);

      let score = 0;
      score += titleMatches.length * 8;
      if (exactName) score += 10;
      if (compactTitleMatch) score += 6;
      score += hingeMatches.length * 3;
      score += contentMatches.length * 2;
      score += aliasMatches.length * 2;
      if (text.includes(normalizedQuery)) score += 4;
      // Safety-first tie shaping only: a small nudge so equal-evidence matches
      // surface must-not-miss diagnoses first, never enough to outrank a
      // stronger text match.
      if (score > 0 && record.status === "emergent") score += 2;
      else if (score > 0 && record.status === "urgent") score += 1;

      const reasons = [
        titleMatches.length ? "title" : "",
        exactName || compactTitleMatch ? "exact name" : "",
        hingeMatches.length ? "clinical hinge/safety" : "",
        contentMatches.length ? "content" : "",
        aliasMatches.length ? "symptom alias" : "",
        score > 0 && record.status !== "routine" ? "urgency" : "",
      ].filter(Boolean);

      return { record, score, reasons };
    })
    .filter((match) => match.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        differentialStatusRank[left.record.status] - differentialStatusRank[right.record.status] ||
        left.record.title.localeCompare(right.record.title),
    )
    .slice(0, limit);
}

/** Ranked catalogue search over presentation workflows (same scoring family
 *  as rankDifferentialRecords, weighted towards safety tags and candidates). */
export function rankPresentationWorkflows(
  workflows: DifferentialPresentationWorkflow[],
  query: string,
  limit = 20,
): DifferentialPresentationMatch[] {
  const plan = buildQueryTermPlan(query);
  if (!plan) return [];
  const { normalizedQuery, compactQuery, terms, aliasTerms } = plan;

  return workflows
    .map((workflow) => {
      const title = normalizeSearchText(workflow.title);
      const id = normalizeSearchText(workflow.id);
      const safetyText = normalizeSearchText([workflow.subtitle, ...workflow.safetySnapshot.tags].join(" "));
      const contentText = normalizeSearchText(
        [
          workflow.safetySnapshot.summary,
          workflow.highestUrgencyNote,
          ...workflow.reviewChecklist,
          ...workflow.candidates.map((candidate) => candidate.slug.replace(/-/g, " ")),
        ].join(" "),
      );
      const text = `${title} ${id} ${safetyText} ${contentText}`;

      const titleMatches = terms.filter((term) => title.includes(term) || id.includes(term));
      const safetyMatches = terms.filter((term) => safetyText.includes(term));
      const contentMatches = terms.filter((term) => contentText.includes(term));
      const aliasMatches = aliasTerms.filter((term) => text.includes(term));
      const exactName = title === normalizedQuery || id === normalizedQuery;
      const compactTitleMatch = compactQuery.length >= 4 && title.replace(/\s+/g, "").includes(compactQuery);

      let score = 0;
      score += titleMatches.length * 8;
      if (exactName) score += 10;
      if (compactTitleMatch) score += 6;
      score += safetyMatches.length * 4;
      score += contentMatches.length * 2;
      score += aliasMatches.length * 2;
      if (text.includes(normalizedQuery)) score += 4;
      if (score > 0 && workflow.status === "emergent") score += 2;
      else if (score > 0 && workflow.status === "urgent") score += 1;

      const reasons = [
        titleMatches.length ? "title" : "",
        exactName || compactTitleMatch ? "exact name" : "",
        safetyMatches.length ? "safety focus" : "",
        contentMatches.length ? "content" : "",
        aliasMatches.length ? "symptom alias" : "",
        score > 0 && workflow.status !== "routine" ? "urgency" : "",
      ].filter(Boolean);

      return { workflow, score, reasons };
    })
    .filter((match) => match.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        differentialStatusRank[left.workflow.status] - differentialStatusRank[right.workflow.status] ||
        left.workflow.title.localeCompare(right.workflow.title),
    )
    .slice(0, limit);
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
 *  relies on this), otherwise ranked results in ranked order. */
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
