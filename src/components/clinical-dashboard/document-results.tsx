"use client";

import Link from "next/link";
import { BookOpen, ChevronDown, Search } from "lucide-react";

import { DocumentOrganizationBadges, documentDisplayTitle } from "@/components/DocumentOrganizationBadges";
import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { SafeBoldText } from "@/components/SafeBoldText";
import { StrengthBadge } from "@/components/clinical-dashboard/badges";
import { UtilityDrawer } from "@/components/clinical-dashboard/dashboard-shell";
import { cleanDisplayTitle } from "@/components/clinical-dashboard/display-text";
import { MatchExplanationChips } from "@/components/clinical-dashboard/document-search-results";
import { QueryCoverageChips, RelevanceBadge } from "@/components/clinical-dashboard/relevance";
import {
  cn,
  floatingControl,
  iconTilePremium,
  panelSubtle,
  sourceCard,
  SourceStatusBadge,
  textMuted,
} from "@/components/ui-primitives";
import { type SmartDocumentTag } from "@/lib/document-tags";
import type { RelatedDocument, SearchResult } from "@/lib/types";

export { StagedAnswerResultSurface } from "@/components/clinical-dashboard/answer-result-surface";

function WhyThisMatchedPanel({ sources }: { sources: SearchResult[] }) {
  const visibleSources = sources.slice(0, 3);
  if (visibleSources.length === 0) return null;

  return (
    <details data-testid="why-this-matched" className={cn("group rounded-lg", panelSubtle)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn(iconTilePremium, "h-8 w-8")}>
            <Search className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">Why this matched</span>
            <span className={cn("block truncate text-xs", textMuted)}>
              Match signals, source strength, and term coverage for top passages
            </span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-2 border-t border-[color:var(--border)] p-3">
        {visibleSources.map((source) => (
          <article
            key={source.id}
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-semibold text-[color:var(--text)]">
                  {cleanDisplayTitle(source.title)}
                </p>
                <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                  <span className="font-mono tabular-nums">page {source.page_number ?? "n/a"}</span> ·{" "}
                  <span className="font-mono tabular-nums">chunk {source.chunk_index}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <RelevanceBadge relevance={source.relevance} />
                <StrengthBadge strength={source.source_strength} />
                <SourceStatusBadge metadata={source.source_metadata} />
              </div>
            </div>
            <MatchExplanationChips source={source} />
            {source.index_unit ? (
              <p
                className={cn(
                  "mt-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-1.5 text-xs leading-5",
                  textMuted,
                )}
              >
                <span className="font-semibold text-[color:var(--text)]">
                  {source.index_unit.unit_type.replaceAll("_", " ")}:
                </span>{" "}
                {source.index_unit.title}
              </p>
            ) : null}
            <div className="mt-2">
              <QueryCoverageChips relevance={source.relevance} limit={5} />
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}

export function RelatedDocumentsPanel({
  documents,
  onScopeDocument,
  onTagSearch,
}: {
  documents: RelatedDocument[];
  onScopeDocument: (documentId: string) => void;
  onTagSearch: (tag: SmartDocumentTag) => void;
}) {
  if (documents.length === 0) return null;

  return (
    <UtilityDrawer
      icon={BookOpen}
      title="Related documents"
      summary={`${documents.length} broader document match${documents.length === 1 ? "" : "es"}`}
      mobileSummary={`${documents.length} related`}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {documents.map((document) => (
          <article key={document.document_id} className={cn(sourceCard, "p-3 sm:p-4")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/documents/${document.document_id}?page=${document.best_pages[0] ?? 1}&chunk=${document.best_chunk_ids[0] ?? ""}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--primary)]"
                >
                  <span className="line-clamp-2">{documentDisplayTitle(document)}</span>
                </Link>
                <DocumentOrganizationBadges document={document} compact className="mt-1" />
                <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                  {document.match_reason} · pages {document.best_pages.join(", ") || "n/a"} · {document.image_count}{" "}
                  images{document.table_count ? ` · ${document.table_count} tables` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onScopeDocument(document.document_id)}
                className={cn(floatingControl, "min-h-11 px-3 text-xs")}
              >
                Scope
              </button>
            </div>
            {document.summary && (
              <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>
                <SafeBoldText text={document.summary} />
              </p>
            )}
            <DocumentTagCloud labels={document.labels} limit={6} className="mt-3" onTagClick={onTagSearch} />
          </article>
        ))}
      </div>
    </UtilityDrawer>
  );
}
