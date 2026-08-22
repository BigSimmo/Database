"use client";

import Link from "next/link";
import { FileText, Filter, Search } from "lucide-react";
import { cn, floatingControl, metadataPillDensity, primaryControl } from "@/components/ui-primitives";
import { registryCorpusDetailHref } from "@/lib/registry-corpus-links";
import type { CrossModeLink } from "@/lib/cross-mode-links";
import type { SearchResult, Citation } from "@/lib/types";

export function SourceActionRow({
  viewerHref,
  sourceTitle,
  documentId,
  onScopeDocument,
  onFollowUp,
  onOpenSource,
  imageCount = 0,
  divider = true,
}: {
  viewerHref: string;
  sourceTitle: string;
  documentId: string;
  onScopeDocument: (documentId: string) => void;
  onFollowUp?: () => void;
  onOpenSource?: () => void;
  imageCount?: number;
  divider?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", divider && "border-t border-[color:var(--border)] pt-3")}>
      <Link href={viewerHref} onClick={onOpenSource} className={cn(primaryControl, "min-h-tap px-4 text-xs")}>
        <FileText aria-hidden="true" className="h-4 w-4" />
        Open source
      </Link>
      {onFollowUp && (
        <button
          type="button"
          onClick={onFollowUp}
          className={cn(floatingControl, "px-3 text-xs")}
          aria-label={`Ask a follow-up from ${sourceTitle}`}
        >
          <Search aria-hidden="true" className="h-4 w-4" />
          <span className="sm:hidden">Follow-up</span>
          <span className="hidden sm:inline">Ask follow-up</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => onScopeDocument(documentId)}
        className={cn(floatingControl, "px-3 text-xs")}
        aria-label={`Search only ${sourceTitle}`}
      >
        <Filter aria-hidden="true" className="h-4 w-4" />
        <span className="sm:hidden">Scope</span>
        <span className="hidden sm:inline">Add scope</span>
      </button>
      {imageCount > 0 && (
        <span className={cn(metadataPillDensity.tap, "rounded-lg")}>
          {imageCount} indexed image{imageCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

export function sourceResultHref(source: SearchResult) {
  const metadata =
    source.source_metadata && typeof source.source_metadata === "object"
      ? (source.source_metadata as Record<string, unknown>)
      : {};
  const registryHref = registryCorpusDetailHref({
    kind: metadata.registry_record_kind as string | undefined,
    slug: metadata.registry_record_slug as string | undefined,
    subkind: metadata.registry_record_subkind as string | undefined,
    recordId: metadata.registry_record_id as string | undefined,
  });
  if (registryHref) return registryHref;
  return `/documents/${source.document_id}?page=${source.page_number ?? 1}&chunk=${source.id}`;
}

/**
 * Href for the retrieval-state banner's "Open source" action. `sourceId` is the
 * projection's document key; `locator` is the banner's `p. N` string when known.
 * Synthetic `__unidentified_*` keys are not navigable.
 */
export function citedDocumentHref(
  sourceId: string,
  locator: string | undefined,
  candidates: readonly SearchResult[],
): string | null {
  if (!sourceId || sourceId.startsWith("__unidentified_")) return null;

  const pageMatch = locator?.match(/^p\.\s*(\d+)$/i);
  const pageFromLocator = pageMatch ? Number(pageMatch[1]) : null;
  // Match the locator's page before picking a chunk. One document can contribute
  // chunks from several pages, and `loadAuthorizedDocumentDetail` makes the
  // selected chunk's page authoritative over the requested one
  // (`src/lib/document-detail.ts`: `effectivePage = selectedChunk?.page_number ??
  // requestedPage`). Taking the first candidate while advertising the locator's
  // page therefore opens a control labelled "p. 12" on page 4.
  const documentCandidates = candidates.filter((source) => source.document_id === sourceId);
  const match =
    (pageFromLocator != null
      ? documentCandidates.find((source) => source.page_number === pageFromLocator)
      : undefined) ?? documentCandidates[0];

  if (match) {
    const page = pageFromLocator ?? match.page_number ?? 1;
    // Only pin a chunk that actually sits on the page being advertised;
    // otherwise open the page and let the viewer land where the label promised.
    const chunkIsOnAdvertisedPage = pageFromLocator == null || match.page_number === pageFromLocator;
    const metadata =
      match.source_metadata && typeof match.source_metadata === "object"
        ? (match.source_metadata as Record<string, unknown>)
        : {};
    const registryHref = registryCorpusDetailHref({
      kind: metadata.registry_record_kind as string | undefined,
      slug: metadata.registry_record_slug as string | undefined,
      subkind: metadata.registry_record_subkind as string | undefined,
      recordId: metadata.registry_record_id as string | undefined,
    });
    if (registryHref) return registryHref;
    return chunkIsOnAdvertisedPage
      ? `/documents/${encodeURIComponent(sourceId)}?page=${page}&chunk=${encodeURIComponent(match.id)}`
      : `/documents/${encodeURIComponent(sourceId)}?page=${page}`;
  }

  const params = new URLSearchParams();
  if (pageFromLocator != null) params.set("page", String(pageFromLocator));
  const query = params.toString();
  return `/documents/${encodeURIComponent(sourceId)}${query ? `?${query}` : ""}`;
}

type SourceOpenTelemetry = {
  id: string;
  title?: string;
  document_id?: string;
  documentId?: string;
  file_name?: string;
  fileName?: string;
  source_strength?: string | null;
  sourceStrength?: string | null;
  similarity?: number | null;
  score?: number | null;
  source_metadata?: unknown;
  metadata?: unknown;
};

export function logSourceOpen(query: string, source: SourceOpenTelemetry) {
  if (!query.trim()) return;
  const documentId = source.document_id ?? source.documentId;
  if (!documentId) return;
  const metadata =
    source.source_metadata && typeof source.source_metadata === "object"
      ? (source.source_metadata as Record<string, unknown>)
      : source.metadata && typeof source.metadata === "object"
        ? (source.metadata as Record<string, unknown>)
        : null;

  void fetch("/api/search/interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      documentId,
      chunkId: source.id,
      fileName: source.file_name ?? source.fileName,
      title: source.title,
      citationTelemetry: {
        provenance: "retrieval_only",
        source_strength: source.source_strength ?? source.sourceStrength,
        similarity: source.similarity ?? source.score,
        document_status: metadata?.document_status,
      },
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export function logCitationOpen(query: string, citation: Citation, sourceStrength?: string) {
  if (!query.trim()) return;
  const metadata =
    citation.source_metadata && typeof citation.source_metadata === "object"
      ? (citation.source_metadata as Record<string, unknown>)
      : null;

  void fetch("/api/search/interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      documentId: citation.document_id,
      chunkId: citation.chunk_id,
      fileName: citation.file_name,
      title: citation.title,
      citationTelemetry: {
        provenance: citation.provenance,
        source_strength: sourceStrength,
        similarity: citation.similarity,
        document_status: metadata?.document_status,
      },
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export function logCrossModeLinkOpen(query: string, link: Pick<CrossModeLink, "modeId" | "slug" | "title">) {
  if (!query.trim()) return;
  void fetch("/api/search/interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      crossMode: { mode: link.modeId, slug: link.slug, title: link.title },
    }),
    keepalive: true,
  }).catch(() => undefined);
}
