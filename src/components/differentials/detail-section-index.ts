import { GitCompareArrows, Share2, ShieldCheck, Stethoscope, Waypoints } from "lucide-react";

import type { DocumentSection } from "@/components/document-viewer/section-index";
import {
  DETAIL_TAB_IDS,
  differentialSourceStatusLabel,
  visibleSectionItems,
  type DifferentialDetailContext,
  type DifferentialDetailTabId,
} from "@/lib/differential-detail";
import type { DifferentialSourceStatus } from "@/lib/differential-records";
import type { DifferentialRecord } from "@/lib/differential-snapshot";

/**
 * The diagnosis detail page's navigable sections, shaped as `DocumentSection` so
 * the shared in-page navigation primitives (`DocumentSectionTrack`,
 * `DocumentSectionList`) render them unchanged — the default template codified in
 * `docs/search-chrome-behaviour.md` ("Default in-page navigation template").
 *
 * Two differences from the document index this mirrors:
 * - Every tab is always present. A diagnosis without related records still has a
 *   Compare tab; the panel explains the absence better than a missing row would,
 *   and a five-segment track that changes length between diagnoses reads as a
 *   rendering bug rather than as information.
 * - `id` is the `DifferentialDetailTabId` itself, so the active section is just
 *   the active tab. These are discrete panels rather than scroll positions, so
 *   there is no scroll spy here — `useDocumentSectionSpy` is deliberately unused.
 */
export type DifferentialDetailSection = DocumentSection & { id: DifferentialDetailTabId };

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Raw weights before normalisation, anchored to what each panel actually holds so
 * the track reads as proportion rather than as "which of five". Floors keep every
 * segment tappable-looking on a sparse record; caps stop one dense panel from
 * squeezing the rest to hairlines.
 */
function rawWeight(id: DifferentialDetailTabId, counts: { reviewSections: number; related: number; overlaps: number }) {
  switch (id) {
    case "overview":
      return Math.max(2, Math.min(8, counts.reviewSections));
    case "compare":
      return Math.max(1.5, Math.min(5, (counts.related + 1) / 2));
    case "map":
      return Math.max(1.5, Math.min(4, counts.related / 2));
    case "related":
      return Math.max(1.5, Math.min(4, (counts.related + counts.overlaps) / 3));
    case "source":
      // A governance status footer, not a body of content. Deliberately the
      // smallest segment on every record.
      return 0.75;
  }
}

const sectionMeta: Record<DifferentialDetailTabId, { label: string; icon: DocumentSection["icon"] }> = {
  overview: { label: "Overview", icon: Stethoscope },
  compare: { label: "Compare", icon: GitCompareArrows },
  map: { label: "Map", icon: Waypoints },
  related: { label: "Related", icon: Share2 },
  source: { label: "Source", icon: ShieldCheck },
};

/**
 * Builds the weighted section index for one diagnosis. Pure and deterministic:
 * the same record always produces the same weights, so the track never shifts
 * between renders of the same page.
 *
 * `liveSourceStatus` mirrors `FooterStatus`: when the API returns owner-scoped
 * governance that differs from the bundled snapshot, the Source row must show
 * that live status rather than a stale "Current" label.
 */
export function buildDifferentialSectionIndex(
  record: DifferentialRecord,
  detailContext: DifferentialDetailContext,
  liveSourceStatus: DifferentialSourceStatus | null = null,
): DifferentialDetailSection[] {
  const counts = {
    // The same predicate the page uses to decide which section rows can expand,
    // so the segment matches what the Overview panel actually renders.
    reviewSections: record.sections.filter((section) => visibleSectionItems(section, record).length > 0).length,
    related: record.related.length,
    overlaps: Object.keys(detailContext.overlapLinks).length,
  };

  const sourceStatus = liveSourceStatus ?? detailContext.source.sourceStatus;

  const detail: Record<DifferentialDetailTabId, string> = {
    overview: plural(counts.reviewSections, "section"),
    compare: plural(counts.related + 1, "diagnosis", "diagnoses"),
    map: plural(counts.related, "link"),
    related: plural(counts.related + counts.overlaps, "item"),
    source: differentialSourceStatusLabel(sourceStatus),
  };

  const weights = DETAIL_TAB_IDS.map((id) => rawWeight(id, counts));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  return DETAIL_TAB_IDS.map((id, index) => ({
    id,
    label: sectionMeta[id].label,
    icon: sectionMeta[id].icon,
    detail: detail[id],
    weight: weights[index]! / total,
    // The trailing chevron in `DocumentSectionList` means "this row opens an
    // accordion". Selecting a tab swaps a panel instead, so never claim it.
    collapsible: false,
  }));
}
