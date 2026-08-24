"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Search, TriangleAlert } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { cn, subtleStatusPill, textMuted } from "@/components/ui-primitives";
import { logSourceOpen } from "@/components/clinical-dashboard/source-actions";
import { cleanDisplayTitle, sourceQuoteDisplayText } from "@/components/clinical-dashboard/display-text";
import { SignedImage } from "@/components/clinical-dashboard/signed-image";
import { CanonicalAnswerTables } from "@/components/clinical-dashboard/visual-evidence";
import {
  answerSourceRailRowId,
  type AnswerSourceRow,
  sourceBadgeLabel,
  sourceRowIsStale,
  sourceStatusShortLabel,
  sourceSupportSentence,
} from "@/components/clinical-dashboard/answer-source-rows";
import { type CanonicalAnswerTableRecord } from "@/lib/answer-render-policy";
import type { QuoteCard, VisualEvidenceCard } from "@/lib/types";

/**
 * Above this many sources the numbered pager stops being a scan and starts being
 * a row of indistinguishable chips, so it degrades to prev / "n of m" / next.
 */
const NUMBERED_PAGER_LIMIT = 4;

/**
 * Attaches each table to the source it was cited from.
 *
 * A table whose `source.chunkId` matches no row still has to be reachable —
 * losing the wide-screen table column was an accepted cost, losing the tables
 * was not — so anything unmatched falls to the first source.
 */
function tablesForSource(tables: CanonicalAnswerTableRecord[], sources: AnswerSourceRow[], index: number) {
  const chunkIds = new Set(sources.map((source) => source.id));
  const source = sources[index];
  if (!source) return [];
  return tables.filter((table) => {
    const chunkId = table.source?.chunkId;
    if (chunkId && chunkIds.has(chunkId)) return chunkId === source.id;
    return index === 0;
  });
}

function imagesForSource(visualEvidence: VisualEvidenceCard[], source: AnswerSourceRow | null) {
  if (!source) return [];
  const byChunk = visualEvidence.filter((card) => card.source_chunk_id === source.id);
  if (byChunk.length) return byChunk;
  return visualEvidence.filter((card) => card.document_id === source.documentId);
}

function quoteCardForSource(quoteCards: QuoteCard[], source: AnswerSourceRow | null) {
  if (!source) return null;
  return quoteCards.find((card) => card.chunk_id === source.id) ?? null;
}

function passageForSource(quoteCard: QuoteCard | null, source: AnswerSourceRow | null) {
  if (!source) return "";
  return sourceQuoteDisplayText(quoteCard?.quote || source.snippet || "");
}

/**
 * One cited document at a time: the support it gives, the passage it was read
 * from, any table or image on that page, and the route to the original PDF.
 *
 * Built on the shared `Sheet` so the portal, focus trap, late focus return,
 * Escape/backdrop dismissal, and the bottom-sheet-on-phone / centred-from-`sm:`
 * split are the same ones every other product overlay uses.
 *
 * `openIndex` is the row the drawer is showing; `activeSupportIndex` is the row
 * a *claim* pointed at. They differ when the drawer was opened from the source
 * list rather than from a reference mark, which is why the support sentence has
 * a null case rather than asserting a claim that was never made.
 */
export function AnswerSourceDrawer({
  sources,
  openIndex,
  activeSupportIndex = null,
  onOpenIndexChange,
  onClose,
  query,
  tables = [],
  visualEvidence = [],
  quoteCards = [],
  onFollowUpQuote,
}: {
  sources: AnswerSourceRow[];
  openIndex: number | null;
  activeSupportIndex?: number | null;
  onOpenIndexChange: (index: number) => void;
  onClose: () => void;
  query?: string;
  tables?: CanonicalAnswerTableRecord[];
  visualEvidence?: VisualEvidenceCard[];
  quoteCards?: QuoteCard[];
  /**
   * Asks a follow-up question from the passage on screen. Carried over from the
   * evidence sheet's quote cards — the passage moved into the drawer, so the
   * action it supported moved with it rather than being dropped.
   */
  onFollowUpQuote?: (quote: QuoteCard) => void;
}) {
  // Resolved late rather than captured on open, so paging to another source
  // returns focus to the row that source actually occupies in the rail.
  const resolveReturnFocusTarget = useCallback(() => {
    if (openIndex === null) return null;
    return document.getElementById(answerSourceRailRowId(openIndex));
  }, [openIndex]);

  const open = openIndex !== null && openIndex >= 0 && openIndex < sources.length;
  const source = open ? sources[openIndex] : null;
  const quoteCard = quoteCardForSource(quoteCards, source);
  const passage = passageForSource(quoteCard, source);
  const sourceTables = open ? tablesForSource(tables, sources, openIndex) : [];
  const sourceImages = imagesForSource(visualEvidence, source);
  const stale = source ? sourceRowIsStale(source) : false;
  const numbered = sources.length <= NUMBERED_PAGER_LIMIT;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      testId="answer-source-drawer"
      title={source ? cleanDisplayTitle(source.title) : "Source"}
      description="Check the answer against the cited passage."
      closeLabel="Close source detail"
      titleAccessory={
        source ? (
          <span className={cn(subtleStatusPill, "nums min-h-6 px-2 text-2xs")}>
            {sourceBadgeLabel(openIndex ?? 0)} · p. {source.pageNumber ?? "n/a"}
          </span>
        ) : null
      }
      headerActions={
        source ? (
          <Link
            href={source.href}
            onClick={() => query && logSourceOpen(query, source)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            aria-label={`Open ${cleanDisplayTitle(source.title)} in the document viewer`}
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : null
      }
      headerClassName="gap-2 p-2.5 sm:p-3"
      titleClassName="text-base-minus leading-5"
      contentClassName="max-h-[88dvh] bg-[color:var(--surface-raised)] sm:max-h-[min(85dvh,40rem)] sm:max-w-xl"
      bodyClassName="bg-[color:var(--surface-raised)] px-3 pb-0 pt-2 sm:p-3"
      resolveReturnFocusTarget={resolveReturnFocusTarget}
      footer={
        sources.length > 1 ? (
          <nav
            className="flex items-center justify-between gap-2"
            aria-label="Move between cited sources"
            data-testid="answer-source-drawer-pager"
            data-pager-variant={numbered ? "numbered" : "compact"}
          >
            <button
              type="button"
              className={pagerStepClass}
              onClick={() => onOpenIndexChange(Math.max(0, (openIndex ?? 0) - 1))}
              disabled={(openIndex ?? 0) === 0}
              aria-label="Previous source"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            {numbered ? (
              <span className="flex min-w-0 items-center gap-1.5">
                {sources.map((row, index) => (
                  <button
                    key={`${row.id}:${index}`}
                    type="button"
                    onClick={() => onOpenIndexChange(index)}
                    aria-current={index === openIndex ? "true" : undefined}
                    aria-label={`Source ${sourceBadgeLabel(index)}: ${cleanDisplayTitle(row.title)}`}
                    className={cn(
                      "nums grid h-12 min-w-12 place-items-center rounded-md border text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                      index === openIndex
                        ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                        : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                    )}
                  >
                    {sourceBadgeLabel(index)}
                  </button>
                ))}
              </span>
            ) : (
              <span className={cn("nums text-xs font-semibold", textMuted)}>
                {(openIndex ?? 0) + 1} of {sources.length}
              </span>
            )}
            <button
              type="button"
              className={pagerStepClass}
              onClick={() => onOpenIndexChange(Math.min(sources.length - 1, (openIndex ?? 0) + 1))}
              disabled={(openIndex ?? 0) >= sources.length - 1}
              aria-label="Next source"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </nav>
        ) : null
      }
      footerClassName="px-3 py-2 sm:px-3"
    >
      {source ? (
        <div className="grid gap-3 pb-3">
          <p data-testid="answer-source-drawer-support" className="text-sm leading-6 text-[color:var(--text)]">
            {sourceSupportSentence(source, activeSupportIndex)}
          </p>

          {stale ? (
            <p
              data-testid="answer-source-drawer-status"
              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-md border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/45 px-2.5 py-2 text-xs leading-5 text-[color:var(--text)]"
            >
              <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--warning)]" />
              <span>
                <span className="font-semibold">{sourceStatusShortLabel(source.metadata)}</span> — this document is past
                its review date. Confirm the passage against a current source before acting on it.
              </span>
            </p>
          ) : null}

          {passage ? (
            <section aria-label="Cited passage">
              <p className={cn("mb-1.5 text-2xs font-semibold uppercase tracking-wide", textMuted)}>Cited passage</p>
              <blockquote
                data-testid="answer-source-drawer-passage"
                className="border-l-2 border-[color:var(--clinical-accent)]/35 pl-3 text-sm font-medium leading-6 text-[color:var(--text)]"
              >
                &ldquo;{passage}&rdquo;
              </blockquote>
              {onFollowUpQuote && quoteCard ? (
                <button
                  type="button"
                  data-testid="answer-source-drawer-follow-up"
                  onClick={() => {
                    onFollowUpQuote(quoteCard);
                    onClose();
                  }}
                  className="mt-2 inline-flex min-h-12 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                >
                  <Search aria-hidden="true" className="h-3.5 w-3.5" />
                  Ask about this passage
                </button>
              ) : null}
            </section>
          ) : null}

          {sourceTables.length ? (
            <section aria-label="Tables on this page" data-testid="answer-source-drawer-tables">
              <p className={cn("mb-1.5 text-2xs font-semibold uppercase tracking-wide", textMuted)}>
                {sourceTables.length === 1 ? "Table" : "Tables"}
              </p>
              <CanonicalAnswerTables tables={sourceTables} />
            </section>
          ) : null}

          {sourceImages.length ? (
            <section aria-label="Images on this page" data-testid="answer-source-drawer-images" className="grid gap-2">
              <p className={cn("text-2xs font-semibold uppercase tracking-wide", textMuted)}>
                {sourceImages.length === 1 ? "Image" : "Images"}
              </p>
              {sourceImages.slice(0, 3).map((card) => (
                <SignedImage
                  key={card.id}
                  endpoint={card.signed_url_endpoint}
                  alt={card.caption?.trim() || "Clinical document image"}
                  caption={card.caption}
                  className="max-h-52"
                  zoomable
                />
              ))}
            </section>
          ) : null}

          <Link
            href={source.href}
            onClick={() => query && logSourceOpen(query, source)}
            className="inline-flex min-h-12 items-center gap-1.5 justify-self-start rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            View original PDF
          </Link>
        </div>
      ) : null}
    </Sheet>
  );
}

const pagerStepClass =
  "grid h-12 w-12 shrink-0 place-items-center rounded-md border border-[color:var(--border)] text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
