"use client";

import Link from "next/link";
import { ExternalLink, FileText, Filter, Search } from "lucide-react";
import { cn, floatingControl, metadataPill, primaryControl } from "@/components/ui-primitives";
import type { SearchResult } from "@/lib/types";

export function SourceActionRow({
  viewerHref,
  sourceTitle,
  documentId,
  onScopeDocument,
  onFollowUp,
  imageCount = 0,
  divider = true,
}: {
  viewerHref: string;
  sourceTitle: string;
  documentId: string;
  onScopeDocument: (documentId: string) => void;
  onFollowUp?: () => void;
  imageCount?: number;
  divider?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", divider && "border-t border-[color:var(--border)] pt-3")}>
      <Link href={viewerHref} className={cn(primaryControl, "min-h-[44px] px-4 text-xs")}>
        <FileText className="h-4 w-4" />
        Open source
      </Link>
      {onFollowUp && (
        <button
          type="button"
          onClick={onFollowUp}
          className={cn(floatingControl, "px-3 text-xs")}
          aria-label={`Ask a follow-up from ${sourceTitle}`}
        >
          <Search className="h-4 w-4" />
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
        <Filter className="h-4 w-4" />
        <span className="sm:hidden">Scope</span>
        <span className="hidden sm:inline">Add scope</span>
      </button>
      {imageCount > 0 && (
        <span className={cn(metadataPill, "min-h-[44px] rounded-lg px-3")}>
          {imageCount} indexed image{imageCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

export function sourceResultHref(source: SearchResult) {
  return `/documents/${source.document_id}?page=${source.page_number ?? 1}&chunk=${source.id}`;
}

export function logSourceOpen(query: string, source: SearchResult) {
  if (!query.trim()) return;
  void fetch("/api/search/interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      documentId: source.document_id,
      chunkId: source.id,
      fileName: source.file_name,
      title: source.title,
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export function SourcePassageLinks({
  heading,
  sources,
  compact = false,
}: {
  heading: string;
  sources: SearchResult[];
  compact?: boolean;
}) {
  if (sources.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sources.slice(0, compact ? 2 : 3).map((source, index) => (
        <Link
          key={`${heading}:${source.id}:${index}`}
          href={sourceResultHref(source)}
          className={cn(
            compact ? metadataPill : floatingControl,
            "min-h-11 gap-1.5 px-2.5 text-[11px] sm:min-h-9 sm:px-3",
          )}
          title={`${source.title} · page ${source.page_number ?? "n/a"} · chunk ${source.chunk_index}`}
          aria-label={`Open source passage #${index + 1}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>p.{source.page_number ?? "n/a"}</span>
          <span className="hidden sm:inline">chunk {source.chunk_index}</span>
          {source.source_strength ? <span className="hidden sm:inline">· {source.source_strength}</span> : null}
        </Link>
      ))}
    </div>
  );
}
