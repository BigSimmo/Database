// Overview landing for the document viewer: the header card, quick actions,
// overview/key-sections/useful-pages tiles, and page-jump chips. Extracted from
// DocumentViewer.tsx (maturity X3) as a pure move.
import { Download, FileText, Loader2, Sparkles, Tag, Target } from "lucide-react";
import { documentDisplayTitle, documentOrganizationProfile } from "@/components/DocumentOrganizationBadges";
import { formatDocumentLabelDisplay } from "@/lib/document-tags";
import {
  DocumentActionAnchor,
  DocumentActionButton,
  DocumentFileTile,
  DocumentMetaRow,
  documentFileKind,
  documentTileTone,
} from "@/components/clinical-dashboard/document-ui";
import { cn, panel, floatingControl, primaryControl, sourceCard, textMuted } from "@/components/ui-primitives";
import { cleanClinicalSummaryText } from "@/lib/source-text-sanitizer";
import { formatDocumentSummary } from "@/lib/document-summary-formatting";
import { formatClinicalDate } from "@/lib/source-metadata";
import type { ClinicalDocument } from "@/lib/types";
import type { PageRow } from "./types";

const primaryButton = primaryControl;
const secondaryButton = floatingControl;

function compactDocumentType(document: ClinicalDocument) {
  return documentFileKind(document.file_name, "PDF");
}

// Derive the header eyebrow from the document's real type instead of asserting
// every document is a "Clinical guideline". Prefers the organization profile's
// document_type, then a high-confidence document_type label, then a neutral fallback.
function documentTypeEyebrow(document: ClinicalDocument) {
  const profile = documentOrganizationProfile(document);
  const profileType =
    typeof profile?.document_type?.label === "string" && profile.document_type.label !== "unknown"
      ? profile.document_type.label
      : null;
  const labelType = document.labels?.find(
    (label) => label.label_type === "document_type" && (label.confidence ?? 0) >= 0.5,
  )?.label;
  const typeLabel = profileType ?? labelType;
  return typeLabel ? formatDocumentLabelDisplay(typeLabel, "document_type") : "Clinical document";
}

function documentOverviewText(document: ClinicalDocument) {
  const profile = document.summary?.clinical_specifics?.profile;
  // The stored raw summary opens with PDF-header boilerplate on many live
  // documents, so route it through the smart formatter and show its lead
  // sentences instead of the raw string.
  const formattedSummary = profile?.overview ? null : formatDocumentSummary(document.summary?.summary);
  const overview = profile?.overview
    ? cleanClinicalSummaryText(profile.overview)
    : (formattedSummary?.lead ?? formattedSummary?.sections[0]?.items.join(" ") ?? "");
  if (overview && !/source-backed review/i.test(overview)) return overview;
  return "A clear overview of this document, useful pages, and source PDF access.";
}

function documentKeySections(document: ClinicalDocument) {
  const labels = (document.labels ?? []).map((label) => label.label).filter(Boolean);
  return Array.from(new Set(labels)).slice(0, 3);
}

function DocumentPagePreview({
  href,
  pageNumber,
  onNavigate,
}: {
  href: string;
  pageNumber: number | null;
  onNavigate: (page: number) => void;
}) {
  // A real "jump to page" chip rather than a fake wireframe thumbnail that looks
  // like a skeleton that never resolves.
  return (
    <a
      href={href}
      onClick={(event) => {
        if (
          pageNumber === null ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        onNavigate(pageNumber);
      }}
      className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)]/40 hover:bg-[color:var(--clinical-accent-soft)] hover:text-[color:var(--clinical-accent)]"
    >
      <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" />
      <span className="nums">Jump to p.{pageNumber ?? "n/a"}</span>
    </a>
  );
}
function usefulDocumentPages(initialPage: number, pages: PageRow[]) {
  return Array.from(new Set([initialPage, ...pages.map((page) => page.page_number)]))
    .filter((page) => Number.isFinite(page))
    .slice(0, 3);
}

export function DocumentOverviewLanding({
  document,
  initialPage,
  signedUrl,
  pages,
  pageHref,
  onPageChange,
  onAskFromDocument,
  onAddToScope,
  onDownload,
  downloading,
  canSummarizeDocument,
}: {
  document: ClinicalDocument;
  initialPage: number;
  signedUrl: string | null;
  pages: PageRow[];
  pageHref: (page: number) => string;
  onPageChange: (page: number) => void;
  onAskFromDocument: () => void;
  onAddToScope: () => void;
  onDownload: () => void;
  downloading: boolean;
  canSummarizeDocument: boolean;
}) {
  const keySections = documentKeySections(document);
  const usefulPages = usefulDocumentPages(initialPage, pages);
  const documentType = compactDocumentType(document);
  const overviewText = documentOverviewText(document);

  return (
    <section className="grid gap-4 lg:grid-cols-3 lg:items-start">
      <article className={cn(panel, "p-4 sm:p-5 lg:col-span-3")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <DocumentFileTile
            kind={documentType}
            tone={documentTileTone(documentType)}
            className="h-20 w-20 rounded-xl text-sm sm:h-24 sm:w-24"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
              {documentTypeEyebrow(document)}
            </p>
            <h2 className="line-clamp-2 text-xl font-semibold leading-7 text-[color:var(--text-heading)]">
              {documentDisplayTitle(document)}
            </h2>
            <DocumentMetaRow
              className="mt-1"
              items={[
                documentType,
                `${document.page_count ?? (pages.length || "?")} pages`,
                `Uploaded ${formatClinicalDate(document.created_at)}`,
              ]}
            />
            {overviewText ? (
              <p className={cn("mt-2 line-clamp-2 text-sm leading-6", textMuted)}>{overviewText}</p>
            ) : null}
            {/* Search relevance badges are rendered in document search results; the viewer has no ranking context. */}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {signedUrl ? (
            <DocumentActionAnchor
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(primaryButton, "w-full min-h-12 px-2 text-xs sm:text-sm")}
            >
              Open PDF
            </DocumentActionAnchor>
          ) : (
            <DocumentActionAnchor
              href="#pdf-preview-section"
              className={cn(primaryButton, "w-full min-h-12 px-2 text-xs sm:text-sm")}
            >
              Open preview
            </DocumentActionAnchor>
          )}
          <DocumentActionButton
            onClick={onDownload}
            disabled={downloading}
            icon={downloading ? Loader2 : Download}
            className={cn(secondaryButton, "w-full min-h-12 px-2 text-xs sm:text-sm")}
          >
            {downloading ? "Preparing" : "Download"}
          </DocumentActionButton>
          <DocumentActionButton
            onClick={onAddToScope}
            icon={Target}
            className={cn(secondaryButton, "w-full min-h-12 px-2 text-xs sm:text-sm")}
          >
            Add to scope
          </DocumentActionButton>
          <DocumentActionButton
            onClick={onAskFromDocument}
            disabled={!canSummarizeDocument}
            icon={Sparkles}
            className={cn(secondaryButton, "w-full min-h-12 whitespace-nowrap px-2 text-xs sm:text-sm")}
          >
            Answer from this
          </DocumentActionButton>
        </div>
      </article>

      <section id="document-overview" className={cn(sourceCard, "scroll-mt-24 p-4")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <FileText aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Overview</h3>
            <p className={cn("mt-1 line-clamp-3 text-sm leading-6", textMuted)}>{documentOverviewText(document)}</p>
          </div>
        </div>
      </section>

      <section className={cn(sourceCard, "p-4")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <Tag aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Key sections</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(keySections.length ? keySections : ["Overview", "Useful pages", "Source PDF"]).map((section) => (
                <span
                  key={section}
                  className="inline-flex min-h-9 items-center rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-medium text-[color:var(--clinical-accent)]"
                >
                  {section}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={cn(sourceCard, "p-4")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <FileText aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Useful pages</h3>
            <p className={cn("mt-1 text-sm leading-6", textMuted)}>Most relevant pages for this document.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(usefulPages.length ? usefulPages : [initialPage]).map((page) => (
                <DocumentPagePreview key={page} href={pageHref(page)} pageNumber={page} onNavigate={onPageChange} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
