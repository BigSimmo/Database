/**
 * Server-side builders for the Diagnoses/Presentations stream workspace.
 * Keeps the full differentials snapshot off the client by shipping a trimmed
 * serializable model (match flags, related refs, browse chapters).
 */

import { normalizeSearchText } from "@/lib/catalog-search";
import {
  differentialPresentations,
  differentialRecords,
  differentialScenarioPresets,
  rankDifferentialRecords,
  rankPresentationWorkflows,
  type DifferentialPresentationWorkflow,
  type DifferentialRecord,
  getPresentationWorkflowSelectionForDiagnosisIds,
} from "@/lib/differentials";
import type {
  DifferentialStreamChapter,
  DifferentialStreamItem,
  DifferentialStreamModel,
  DifferentialStreamPathwayRef,
  DifferentialStreamPresetChip,
  DifferentialStreamRelatedRef,
  DifferentialStreamType,
} from "@/lib/differential-stream-model";

export type {
  DifferentialStreamChapter,
  DifferentialStreamItem,
  DifferentialStreamModel,
  DifferentialStreamPathwayRef,
  DifferentialStreamPresetChip,
  DifferentialStreamRelatedRef,
  DifferentialStreamType,
} from "@/lib/differential-stream-model";

const statusChapterOrder: DifferentialRecord["status"][] = ["emergent", "urgent", "routine"];

const statusChapterCopy: Record<DifferentialRecord["status"], { title: string; description: string }> = {
  emergent: {
    title: "Emergent",
    description: "Time-critical differentials to exclude first.",
  },
  urgent: {
    title: "Urgent",
    description: "High-priority causes that need prompt work-up.",
  },
  routine: {
    title: "Routine",
    description: "Lower-acuity differentials for structured comparison.",
  },
};

function exclusionPreviewForRecord(record: DifferentialRecord): string | null {
  const overlap = record.sections.find((section) => section.tone === "overlap");
  if (!overlap) return null;
  const item = overlap.items.map((entry) => entry.trim()).find(Boolean);
  if (item) return item;
  const summary = overlap.summary.trim();
  return summary || null;
}

function presentationChapterForSlug(slug: string): { id: string; title: string } | null {
  for (const presentation of differentialPresentations()) {
    if (presentation.candidates.some((candidate) => candidate.slug === slug)) {
      return { id: presentation.id, title: presentation.title };
    }
  }
  return null;
}

function relatedRefs(record: DifferentialRecord, knownSlugs: Set<string>): DifferentialStreamRelatedRef[] {
  const seen = new Set<string>();
  const refs: DifferentialStreamRelatedRef[] = [];
  for (const node of record.related) {
    const slug = node.id.trim().toLowerCase();
    if (!slug || !knownSlugs.has(slug) || slug === record.slug || seen.has(slug)) continue;
    seen.add(slug);
    refs.push({
      slug,
      label: node.label,
      likelihood: node.likelihood,
    });
  }
  return refs;
}

function diagnosisItemFromRecord(
  record: DifferentialRecord,
  knownSlugs: Set<string>,
  match?: { score: number; reasons: string[] },
): DifferentialStreamItem {
  const chapter = presentationChapterForSlug(record.slug);
  return {
    id: `diagnosis-${record.slug}`,
    slug: record.slug,
    title: record.title,
    description: record.clinicalHinge,
    examples: record.related.slice(0, 3).map((node) => node.label),
    href: `/differentials/diagnoses/${record.slug}`,
    status: record.status,
    matchReasons: match?.reasons ?? [],
    isMatch: Boolean(match),
    score: match?.score ?? 0,
    related: relatedRefs(record, knownSlugs),
    relatedPathways: [],
    candidateCount: null,
    exclusionPreview: exclusionPreviewForRecord(record),
    chapterId: chapter?.id ?? `status-${record.status}`,
    chapterTitle: chapter?.title ?? statusChapterCopy[record.status].title,
  };
}

function relatedPathwaysFor(
  workflow: DifferentialPresentationWorkflow,
  presentations: DifferentialPresentationWorkflow[],
): DifferentialStreamPathwayRef[] {
  const candidateSlugs = new Set(workflow.candidates.map((candidate) => candidate.slug));
  return presentations
    .filter((candidate) => candidate.id !== workflow.id)
    .map((candidate) => ({
      slug: candidate.id,
      label: candidate.title,
      sharedCandidateCount: candidate.candidates.filter((entry) => candidateSlugs.has(entry.slug)).length,
    }))
    .filter((candidate) => candidate.sharedCandidateCount > 0)
    .sort(
      (left, right) => right.sharedCandidateCount - left.sharedCandidateCount || left.label.localeCompare(right.label),
    );
}

function presentationItemFromWorkflow(
  workflow: DifferentialPresentationWorkflow,
  presentations: DifferentialPresentationWorkflow[],
  match?: { score: number; reasons: string[] },
): DifferentialStreamItem {
  return {
    id: `presentation-${workflow.id}`,
    slug: workflow.id,
    title: workflow.title,
    description: workflow.scopeLabel ?? workflow.subtitle,
    examples: workflow.safetySnapshot.tags.slice(0, 3),
    href: `/differentials/presentations/${workflow.id}`,
    status: workflow.status,
    matchReasons: match?.reasons ?? [],
    isMatch: Boolean(match),
    score: match?.score ?? 0,
    related: [],
    relatedPathways: relatedPathwaysFor(workflow, presentations),
    candidateCount: workflow.candidates.length,
    exclusionPreview: null,
    chapterId: `status-${workflow.status}`,
    chapterTitle: statusChapterCopy[workflow.status].title,
  };
}

function urgencyChapters(items: DifferentialStreamItem[]): DifferentialStreamChapter[] {
  return statusChapterOrder
    .map((status) => {
      const itemIds = items.filter((item) => item.status === status).map((item) => item.id);
      return {
        id: `status-${status}`,
        title: statusChapterCopy[status].title,
        description: statusChapterCopy[status].description,
        itemIds,
      };
    })
    .filter((chapter) => chapter.itemIds.length > 0);
}

function presentationChapters(items: DifferentialStreamItem[]): DifferentialStreamChapter[] {
  const byChapter = new Map<string, DifferentialStreamChapter>();
  const ungrouped: string[] = [];
  for (const item of items) {
    if (!item.chapterId.startsWith("status-")) {
      const existing = byChapter.get(item.chapterId);
      if (existing) {
        existing.itemIds.push(item.id);
      } else {
        byChapter.set(item.chapterId, {
          id: item.chapterId,
          title: item.chapterTitle,
          description: "Diagnoses linked to this presentation workflow.",
          itemIds: [item.id],
        });
      }
    } else {
      ungrouped.push(item.id);
    }
  }
  const chapters = [...byChapter.values()].sort((left, right) => left.title.localeCompare(right.title));
  if (ungrouped.length > 0) {
    chapters.push({
      id: "ungrouped",
      title: "Other diagnoses",
      description: "Not yet attached to a presentation workflow.",
      itemIds: ungrouped,
    });
  }
  return chapters;
}

function presetChips(): DifferentialStreamPresetChip[] {
  return differentialScenarioPresets()
    .slice(0, 7)
    .map((preset) => ({
      id: preset.id,
      label: preset.query.replace(/\s+/g, " ").trim(),
      query: preset.query.trim(),
    }))
    .filter((preset) => preset.label.length > 0);
}

/**
 * Build the query-lit / browse model for a differentials stream page.
 * With a query: relevance-ranked matches first (emergent tie-break already in
 * the shared ranker), then dimmed non-matches. Without a query: urgency chapters
 * for diagnoses, presentation list for presentations.
 */

function compareSeedIdsForMatches(matchSlugs: string[]): string[] {
  const slugs = matchSlugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean);
  if (slugs.length < 2) return slugs.slice(0, 1);
  // Prefer the highest-ranked pair that shares one presentation workflow so the
  // compare CTA never auto-ticks a set the presentations redirect will trim.
  for (let end = 1; end < Math.min(slugs.length, 8); end += 1) {
    for (let start = 0; start < end; start += 1) {
      const candidate = [slugs[start]!, slugs[end]!];
      const selection = getPresentationWorkflowSelectionForDiagnosisIds(candidate);
      if (selection && selection.diagnosisIds.length >= 2) {
        return selection.diagnosisIds.slice(0, 2);
      }
    }
  }
  return slugs.slice(0, 1);
}

export function buildDifferentialStreamModel(stream: DifferentialStreamType, query: string): DifferentialStreamModel {
  const trimmedQuery = query.trim();
  const hasQuery = Boolean(normalizeSearchText(trimmedQuery));
  const presets = stream === "diagnoses" ? presetChips() : [];

  if (stream === "presentations") {
    const presentations = differentialPresentations();

    if (!hasQuery) {
      const items = [...presentations]
        .sort(
          (left, right) =>
            statusChapterOrder.indexOf(left.status) - statusChapterOrder.indexOf(right.status) ||
            left.title.localeCompare(right.title),
        )
        .map((workflow) => presentationItemFromWorkflow(workflow, presentations));

      return {
        stream,
        items,
        matchCount: 0,
        chapters: urgencyChapters(items),
        presentationChapters: [],
        presets,
        safetyShelfIds: items
          .filter((item) => item.status === "emergent")
          .slice(0, 6)
          .map((item) => item.id),
        compareSeedIds: [],
      };
    }

    const ranked = rankPresentationWorkflows(presentations, trimmedQuery, presentations.length);
    const matchById = new Map(ranked.map((match) => [match.workflow.id, match]));
    const matchedItems = ranked.map((match) =>
      presentationItemFromWorkflow(match.workflow, presentations, {
        score: match.score,
        reasons: match.reasons,
      }),
    );
    const unmatchedItems = presentations
      .filter((workflow) => !matchById.has(workflow.id))
      .map((workflow) => presentationItemFromWorkflow(workflow, presentations))
      .sort((left, right) => left.title.localeCompare(right.title));
    const items = [...matchedItems, ...unmatchedItems];

    return {
      stream,
      items,
      matchCount: matchedItems.length,
      chapters: [],
      presentationChapters: [],
      presets,
      safetyShelfIds: items
        .filter((item) => item.status === "emergent")
        .slice(0, 6)
        .map((item) => item.id),
      compareSeedIds: [],
    };
  }

  const knownSlugs = new Set(differentialRecords.map((record) => record.slug));
  const ranked = hasQuery ? rankDifferentialRecords(differentialRecords, trimmedQuery, differentialRecords.length) : [];
  const matchBySlug = new Map(ranked.map((match) => [match.record.slug, match]));
  const matchedItems = ranked.map((match) =>
    diagnosisItemFromRecord(match.record, knownSlugs, { score: match.score, reasons: match.reasons }),
  );
  const unmatchedItems = differentialRecords
    .filter((record) => !matchBySlug.has(record.slug))
    .map((record) => diagnosisItemFromRecord(record, knownSlugs))
    .sort((left, right) => left.title.localeCompare(right.title));

  const browseItems = [...differentialRecords]
    .sort(
      (left, right) =>
        statusChapterOrder.indexOf(left.status) - statusChapterOrder.indexOf(right.status) ||
        left.title.localeCompare(right.title),
    )
    .map((record) => diagnosisItemFromRecord(record, knownSlugs));

  const items = hasQuery ? [...matchedItems, ...unmatchedItems] : browseItems;

  return {
    stream,
    items,
    matchCount: matchedItems.length,
    chapters: hasQuery ? [] : urgencyChapters(items),
    presentationChapters: hasQuery ? [] : presentationChapters(browseItems),
    presets,
    safetyShelfIds: hasQuery
      ? matchedItems
          .filter((item) => item.status === "emergent")
          .slice(0, 6)
          .map((item) => item.id)
      : browseItems
          .filter((item) => item.status === "emergent")
          .slice(0, 6)
          .map((item) => item.id),
    compareSeedIds: hasQuery ? compareSeedIdsForMatches(matchedItems.map((item) => item.slug)) : [],
  };
}
