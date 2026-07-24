"use client";

import Link from "next/link";
import { memo } from "react";
import { BookOpen, FileImage, Filter, ListChecks } from "lucide-react";

import { DocumentOrganizationBadges, documentDisplayTitle } from "@/components/DocumentOrganizationBadges";
import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { SafeBoldText } from "@/components/SafeBoldText";
import { UtilityDrawer } from "@/components/clinical-dashboard/dashboard-shell";
import { DocumentBadge, DocumentFileTile, documentFileKind } from "@/components/clinical-dashboard/document-ui";
import { cn, floatingControl, sourceCard, textMuted } from "@/components/ui-primitives";
import { type SmartDocumentTag } from "@/lib/document-tags";
import type { RelatedDocument } from "@/lib/types";

export { StagedAnswerResultSurface } from "@/components/clinical-dashboard/answer-result-surface";

// Compact page label so the metadata pill stays a single glanceable token on
// phones: "p.12" for one page, "p.12 +2" when several pages matched.
function relatedPageLabel(pages: number[]) {
  const valid = pages.filter((page) => Number.isFinite(page));
  if (valid.length === 0) return "Page n/a";
  if (valid.length === 1) return `p.${valid[0]}`;
  return `p.${valid[0]} +${valid.length - 1}`;
}

function relatedDocumentHref(document: RelatedDocument) {
  const params = new URLSearchParams();
  params.set("page", String(document.best_pages[0] ?? 1));
  const chunkId = document.best_chunk_ids[0];
  if (chunkId) params.set("chunk", chunkId);
  return `/documents/${document.document_id}?${params.toString()}`;
}

function RelatedDocumentCard({
  document,
  onScopeDocument,
  onTagSearch,
}: {
  document: RelatedDocument;
  onScopeDocument: (documentId: string) => void;
  onTagSearch: (tag: SmartDocumentTag) => void;
}) {
  const title = documentDisplayTitle(document);
  const imageCount = document.image_count ?? 0;
  const tableCount = document.table_count ?? 0;
  const metaPill = "min-h-6 rounded-md px-2";
  // Site and document-type are already surfaced by the governance badges above,
  // so drop them from the tag cloud to avoid showing the same chip twice.
  const tagCloudLabels = document.labels.filter(
    (label) => label.label_type !== "site" && label.label_type !== "document_type",
  );

  return (
    <article className={cn(sourceCard, "p-2.5 sm:p-3.5")}>
      <div className="flex items-start gap-2.5">
        <DocumentFileTile kind={documentFileKind(document.file_name)} compact />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-2xs font-bold uppercase tracking-[0.06em]", textMuted)}>
            {document.match_reason}
          </p>
          <Link
            href={relatedDocumentHref(document)}
            className="mt-0.5 inline-flex min-h-tap items-center rounded-md text-sm font-semibold leading-6 text-[color:var(--text)] transition hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-7"
          >
            <span className="line-clamp-2">{title}</span>
          </Link>
        </div>
        <button
          type="button"
          onClick={() => onScopeDocument(document.document_id)}
          aria-label={`Scope search to ${title}`}
          className={cn(floatingControl, "w-tap shrink-0 px-0 text-xs sm:w-auto sm:px-2.5")}
        >
          <Filter aria-hidden="true" className="h-4 w-4" />
          <span className="hidden sm:inline">Scope</span>
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <DocumentBadge variant="neutral" icon={BookOpen} className={metaPill}>
          {relatedPageLabel(document.best_pages)}
        </DocumentBadge>
        {imageCount > 0 ? (
          <DocumentBadge variant="relevant" icon={FileImage} className={metaPill}>
            {imageCount} image{imageCount === 1 ? "" : "s"}
          </DocumentBadge>
        ) : null}
        {tableCount > 0 ? (
          <DocumentBadge variant="relevant" icon={ListChecks} className={metaPill}>
            {tableCount} table{tableCount === 1 ? "" : "s"}
          </DocumentBadge>
        ) : null}
      </div>

      <DocumentOrganizationBadges document={document} compact className="mt-1.5" />

      {document.summary ? (
        <p className={cn("mt-2 line-clamp-2 text-sm-minus leading-6 sm:text-sm", textMuted)}>
          <SafeBoldText text={document.summary} />
        </p>
      ) : null}

      <DocumentTagCloud labels={tagCloudLabels} limit={3} compact className="mt-2" onTagClick={onTagSearch} />
    </article>
  );
}

function RelatedDocumentsPanelImpl({
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
      <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2">
        {documents.map((document) => (
          <RelatedDocumentCard
            key={document.document_id}
            document={document}
            onScopeDocument={onScopeDocument}
            onTagSearch={onTagSearch}
          />
        ))}
      </div>
    </UtilityDrawer>
  );
}

// Memoized so answer SSE progress in ClinicalDashboard does not re-render this
// subtree when documents and callbacks are unchanged.
export const RelatedDocumentsPanel = memo(RelatedDocumentsPanelImpl);
