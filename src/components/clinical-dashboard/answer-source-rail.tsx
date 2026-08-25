"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronDown, Image as ImageIcon, Layers, Table2 } from "lucide-react";

import { cn, sourceCapsule, sourceCapsuleCountBadge, sourceCapsuleHit, textMuted } from "@/components/ui-primitives";
import { logSourceOpen } from "@/components/clinical-dashboard/source-actions";
import { cleanDisplayTitle } from "@/components/clinical-dashboard/display-text";
import {
  answerSourceRailRowId,
  type AnswerSourceRow,
  sourceBadgeDisplay,
  sourceCapsuleDisplay,
  sourceSpokenName,
  sourceStatusShortLabel,
  sourceSupportLabel,
} from "@/components/clinical-dashboard/answer-source-rows";

/**
 * The cited documents under an answer, as a horizontally scrolling row of cards.
 *
 * This is the single source-chrome surface: it replaced the "Sources" capsule
 * and its popover/sheet pair, the Evidence sheet's Claims and Quotes tabs, the
 * Clinical notes sheet, and the wide-screen table column. One card per document,
 * and one drawer behind every card.
 *
 * It shipped first as a vertical list, which was the wrong shape twice over: six
 * stacked 48 px rows is ~290 px of phone scroll spent on chrome, and a vertical
 * list of documents reads as the answer's conclusion rather than as its
 * references. Cards in a scroller cost one row whatever the source count.
 *
 * Four behaviours are load-bearing rather than decorative:
 *
 * - Cards are `min-h-12` (48 px). Do **not** reduce them to `min-h-11` to satisfy
 *   generic 44 px tap-target guidance; 44 px reintroduced a sub-pixel rounding
 *   flake in `ui-smoke`.
 * - **Only cited documents are numbered.** A retrieved-but-uncited document takes
 *   a dashed em-dash badge, because the numbers are the same numbers the in-prose
 *   marks use and a number here that no mark can reach would be a false promise.
 * - Only this container scrolls sideways. The page body must never scroll
 *   horizontally.
 * - The `compactCitations` preference collapses the rail to one chip, but the
 *   zero-source case stays worded in every mode — compact must never hide a
 *   missing-source signal.
 */
export function AnswerSourceRail({
  sources,
  query,
  onOpenSource,
  activeIndex = null,
  compact = false,
}: {
  sources: AnswerSourceRow[];
  query?: string;
  /** Opens the source drawer at this card. Omitted while the drawer is unavailable. */
  onOpenSource?: (index: number) => void;
  /** Card the drawer is currently showing. */
  activeIndex?: number | null;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const rowListId = useId();
  const display = sourceCapsuleDisplay({ sourceCount: sources.length, compact });

  if (!sources.length) {
    return (
      <p
        data-testid="answer-source-rail-empty"
        className={cn(
          "inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)]/40 px-2.5 py-1 text-xs font-semibold",
          textMuted,
        )}
      >
        {display.label}
      </p>
    );
  }

  // Collapsed: one chip carrying the count, expanded on tap. The cards below are
  // the same cards either way, so nothing is unreachable in compact mode.
  const collapsed = compact && !expanded;
  const citedCount = sources.filter((source) => source.cited !== false).length;

  return (
    <section data-testid="answer-source-rail" aria-label="Sources behind this answer" className="min-w-0">
      {compact ? (
        <button
          type="button"
          className={sourceCapsuleHit}
          aria-expanded={expanded}
          aria-controls={expanded ? rowListId : undefined}
          onClick={() => setExpanded((current) => !current)}
          data-testid="answer-source-rail-toggle"
        >
          <span className={sourceCapsule}>
            <Layers className="h-3 w-3 shrink-0" aria-hidden />
            {display.showLabelText ? <span className="min-w-0 truncate">{display.label}</span> : null}
            {display.showCountBadge ? <span className={sourceCapsuleCountBadge}>{sources.length}</span> : null}
            <ChevronDown
              className={cn("h-3 w-3 shrink-0 transition-transform", expanded && "rotate-180")}
              strokeWidth={2.25}
              aria-hidden
            />
          </span>
        </button>
      ) : (
        <p
          data-testid="answer-source-rail-heading"
          className={cn(
            "mb-1.5 flex items-baseline justify-between gap-2 border-t border-[color:var(--border)] pt-2.5 text-2xs font-semibold uppercase tracking-wide",
            textMuted,
          )}
        >
          <span>Sources</span>
          <span className="nums font-normal normal-case tracking-normal">
            {citedCount === sources.length
              ? `${sources.length} cited`
              : `${citedCount} cited · ${sources.length - citedCount} also found`}
          </span>
        </p>
      )}

      {/* `role="list"` on a div rather than a real <ol>: the rail sits inside
          `plain-answer-response`, where a ui-smoke guard asserts the primary
          answer renders as prose and not as a bullet list. The source-capsule
          preview used the same idiom for the same reason. */}
      {collapsed ? null : (
        <div className={cn("relative min-w-0", compact && "mt-2")}>
          <div
            id={rowListId}
            role="list"
            aria-label="Cited documents"
            className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sources.map((source, index) => (
              <div key={`${source.id}:${index}`} role="listitem" className="flex-none">
                <AnswerSourceCard
                  source={source}
                  index={index}
                  active={activeIndex === index}
                  query={query}
                  onOpenSource={onOpenSource}
                />
              </div>
            ))}
          </div>
          {/* Tells the eye there is more to the right without adding a control.
              Inert so it can never swallow a tap on the last card. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[color:var(--surface-raised)] to-transparent"
          />
        </div>
      )}
    </section>
  );
}

function AnswerSourceCard({
  source,
  index,
  active,
  query,
  onOpenSource,
}: {
  source: AnswerSourceRow;
  index: number;
  active: boolean;
  query?: string;
  onOpenSource?: (index: number) => void;
}) {
  const stale = source.metadata.document_status === "review_due" || source.metadata.document_status === "outdated";
  const cited = source.cited !== false;
  const body = (
    <>
      <span
        className={cn(
          "nums grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-[var(--radius-sm)] border px-1 text-2xs font-bold",
          !cited
            ? "border-dashed border-[color:var(--border-strong)] text-[color:var(--text-muted)]"
            : stale
              ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
              : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
        )}
        aria-hidden="true"
      >
        {sourceBadgeDisplay(source, index)}
      </span>
      <span className="grid min-w-0 gap-0.5 text-left">
        <span
          className={cn(
            "block truncate text-xs font-semibold leading-tight text-[color:var(--text-heading)]",
            cardTextWidth,
          )}
        >
          {cleanDisplayTitle(source.title)}
        </span>
        <span className={cn("flex items-center gap-1.5 truncate text-2xs leading-tight", cardTextWidth, textMuted)}>
          {/* Tabular figures keep page numbers aligned between cards; the mono
              face the old list row used opened a visible gap after "p." at this
              size. */}
          <span className="shrink-0 tabular-nums">p. {source.pageNumber ?? "n/a"}</span>
          <span aria-hidden>·</span>
          <span className={stale ? "font-semibold text-[color:var(--warning)]" : undefined}>
            {sourceStatusShortLabel(source.metadata)}
          </span>
          {source.hasTable ? (
            <Table2 className="h-3 w-3 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
          ) : null}
          {source.hasImage ? (
            <ImageIcon className="h-3 w-3 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
          ) : null}
        </span>
      </span>
    </>
  );

  // A historical thread turn mounts no drawer, so its cards link straight to the
  // document rather than advertising a panel that will not open.
  if (!onOpenSource) {
    return (
      <Link
        href={source.href}
        data-testid="answer-source-rail-row"
        onClick={() => query && logSourceOpen(query, source)}
        className={cn(cardClass, "border-[color:var(--border)]")}
        aria-label={`${cardLabel(source, index)} — open source`}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      id={answerSourceRailRowId(index)}
      data-testid="answer-source-rail-row"
      data-cited={cited ? "true" : "false"}
      aria-pressed={active}
      onClick={() => onOpenSource(index)}
      className={cn(
        cardClass,
        active
          ? "border-[color:var(--clinical-accent)] shadow-[var(--e1)]"
          : "border-[color:var(--border)] hover:border-[color:var(--border-strong)]",
      )}
      aria-label={`${cardLabel(source, index)} — open source detail`}
    >
      {body}
    </button>
  );
}

/**
 * The card's accessible name. It has to restate the support level and review
 * status, because an `aria-label` replaces the card's own text: without them a
 * screen reader would hear the title and page but never that the document is
 * outdated or that it only partly supports the answer.
 */
function cardLabel(source: AnswerSourceRow, index: number) {
  return [
    `${sourceSpokenName(source, index)}: ${cleanDisplayTitle(source.title)}`,
    `page ${source.pageNumber ?? "not available"}`,
    sourceSupportLabel(source),
    sourceStatusShortLabel(source.metadata),
  ].join(", ");
}

const cardClass =
  "inline-flex min-h-12 min-w-0 items-center gap-2.5 rounded-[var(--radius-lg)] border bg-[color:var(--surface-raised)] px-3 py-1.5 text-left shadow-[var(--shadow-inset)] transition-[border-color,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
const cardTextWidth = "max-w-[158px]";
