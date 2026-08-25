import { statusDotMuted, statusDotReady, statusDotReview, type StatusDotTone } from "@/components/ui-primitives";
import { sourceResultHref } from "@/components/clinical-dashboard/source-actions";
import { normalizeSourceMetadata, sourceStatusLabel } from "@/lib/source-metadata";
import { type SourceLink } from "@/lib/answer-render-policy";
import type { BestSourceRecommendation, SearchResult } from "@/lib/types";

/**
 * One cited document as the answer surface shows it: the shape the source rail
 * lists and the source drawer pages through.
 *
 * This module is a leaf on purpose. The rail, the drawer, and `answer-content`
 * all need these helpers, and `answer-content` re-exports the public ones, so
 * keeping the derivations here is what stops those three from importing each
 * other in a cycle.
 */
export type AnswerSourceRow = {
  id: string;
  documentId: string;
  title: string;
  fileName?: string;
  pageNumber: number | null;
  metadata: ReturnType<typeof normalizeSourceMetadata>;
  sourceMetadata?: SearchResult["source_metadata"];
  score: number;
  href: string;
  snippet?: string;
  sourceStrength?:
    SourceLink["sourceStrength"] | BestSourceRecommendation["source_strength"] | SearchResult["source_strength"];
};

/** Back-compat alias for the capsule-era name. */
export type CapsulePreviewSource = AnswerSourceRow;

/**
 * The one "Sources" summary shown when the rail is collapsed.
 *
 * With the compact-citations preference on, the chip drops its text label to
 * icon + count; the "No direct source found" warning always stays worded —
 * compact mode must never hide a missing-source signal.
 */
export function sourceCapsuleDisplay({ sourceCount, compact = false }: { sourceCount: number; compact?: boolean }): {
  label: string;
  showLabelText: boolean;
  showCountBadge: boolean;
} {
  if (sourceCount <= 0) return { label: "No direct source found", showLabelText: true, showCountBadge: false };
  return { label: "Sources", showLabelText: !compact, showCountBadge: true };
}

export function sourceStatusDotTone(
  metadata: ReturnType<typeof normalizeSourceMetadata> | null | undefined,
): StatusDotTone {
  if (!metadata) return "muted";
  if (metadata.document_status === "current") return "ready";
  if (metadata.document_status === "review_due" || metadata.document_status === "outdated") return "review";
  return "muted";
}

export function sourceStatusDotClass(metadata: ReturnType<typeof normalizeSourceMetadata> | null | undefined) {
  const tone = sourceStatusDotTone(metadata);
  if (tone === "ready") return statusDotReady;
  if (tone === "review") return statusDotReview;
  return statusDotMuted;
}

export function sourceStatusShortLabel(metadata: ReturnType<typeof normalizeSourceMetadata>) {
  if (metadata.document_status === "review_due") return "Review due";
  if (metadata.document_status === "outdated") return "Outdated";
  if (metadata.document_status === "current") return "Current";
  return sourceStatusLabel(metadata);
}

/** Decision 1 (2026-08-24): staleness is carried by the row and the drawer, never by the reference mark. */
export function sourceRowIsStale(source: AnswerSourceRow) {
  return source.metadata.document_status === "review_due" || source.metadata.document_status === "outdated";
}

export function sourceBadgeLabel(index: number) {
  return `S${index + 1}`;
}

export function sourceBadgeToneClass(metadata: ReturnType<typeof normalizeSourceMetadata>, index: number) {
  if (metadata.document_status === "review_due" || metadata.document_status === "outdated") {
    return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }
  if (index === 0) {
    return "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]";
  }
  return "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
}

export function sourceSupportLabel(source: AnswerSourceRow, index: number) {
  if (!source.sourceStrength || source.sourceStrength === "none") return "Unsupported";
  if (source.sourceStrength === "limited") return "Partial";
  if (source.sourceStrength === "moderate") return "Partial";
  if (index === 0 || source.sourceStrength === "strong") return "Direct";
  return "Partial";
}

/**
 * The drawer's support clause. `index === null` means the drawer was opened from
 * the source list rather than from a claim, so there is no claim to speak about.
 */
export function sourceSupportSentence(source: AnswerSourceRow | null, index: number | null) {
  if (!source || index === null) return "Opened from the source list, so this is the document, not a claim.";
  const support = sourceSupportLabel(source, index);
  if (support === "Direct") return "This page states the claim directly.";
  if (support === "Partial")
    return "This page supports part of the claim. Read the passage before relying on the rest.";
  return "Related to the question — this page does not state the claim.";
}

/**
 * Builds the rail's ordered, de-duplicated source list from the three shapes the
 * answer surface has on hand.
 *
 * The cap is six rather than the capsule's four: the rail is the whole cited
 * list now rather than a preview of it, and `trustCaps` admits six primary
 * sources at high trust. The drawer's pager is what absorbs the extra rows.
 */
export function buildAnswerSourceRows(
  bestSource: BestSourceRecommendation | null,
  sources: SearchResult[],
  sourceLinks: SourceLink[] = [],
): AnswerSourceRow[] {
  const rows: AnswerSourceRow[] = [];
  const seen = new Set<string>();
  const pushRow = (row: AnswerSourceRow) => {
    const key = `${row.id}:${row.title}:${row.pageNumber ?? "n/a"}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  sourceLinks.slice(0, 6).forEach((source) => {
    pushRow({
      id: source.chunk_id,
      documentId: source.document_id,
      title: source.title || source.file_name || "Source",
      fileName: source.file_name,
      pageNumber: source.page_number,
      metadata: normalizeSourceMetadata(source.sourceMetadata),
      sourceMetadata: source.sourceMetadata,
      score: source.score ?? 0,
      href: source.href,
      snippet: source.snippet,
      sourceStrength: source.sourceStrength,
    });
  });

  if (bestSource) {
    pushRow({
      id: bestSource.chunk_id,
      documentId: bestSource.document_id,
      title: bestSource.title || bestSource.file_name || "Source",
      fileName: bestSource.file_name,
      pageNumber: bestSource.page_number,
      metadata: normalizeSourceMetadata(bestSource.source_metadata),
      sourceMetadata: bestSource.source_metadata,
      score: bestSource.score,
      href: bestSource.viewer_href,
      sourceStrength: bestSource.source_strength,
    });
  }

  sources.slice(0, 6).forEach((source) => {
    pushRow({
      id: source.id,
      documentId: source.document_id,
      title: source.title || source.file_name || "Source",
      fileName: source.file_name,
      pageNumber: source.page_number,
      metadata: normalizeSourceMetadata(source.source_metadata),
      sourceMetadata: source.source_metadata,
      score: source.hybrid_score ?? source.similarity ?? source.lexical_score ?? 0,
      href: sourceResultHref(source),
      sourceStrength: source.source_strength,
    });
  });

  return rows.slice(0, 6);
}

/** DOM id for a rail row, so a Sheet can resolve its return-focus target late. */
export function answerSourceRailRowId(index: number) {
  return `answer-source-rail-row-${index}`;
}
