"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronDown, ExternalLink, Layers } from "lucide-react";

import {
  cn,
  sourceCapsule,
  sourceCapsuleCountBadge,
  sourceCapsuleHit,
  StatusDotMarker,
  textMuted,
} from "@/components/ui-primitives";
import { logSourceOpen } from "@/components/clinical-dashboard/source-actions";
import { cleanDisplayTitle } from "@/components/clinical-dashboard/display-text";
import {
  answerSourceRailRowId,
  type AnswerSourceRow,
  sourceBadgeLabel,
  sourceBadgeToneClass,
  sourceCapsuleDisplay,
  sourceStatusDotTone,
  sourceStatusShortLabel,
  sourceSupportLabel,
} from "@/components/clinical-dashboard/answer-source-rows";

/**
 * The numbered list of cited documents under an answer.
 *
 * This is the single source-chrome surface: it replaces the "Sources" capsule
 * and its popover/sheet pair, the Evidence sheet's Claims and Quotes tabs, the
 * Clinical notes sheet, and the wide-screen table column. One row per document,
 * and one drawer behind every row.
 *
 * Two behaviours are load-bearing rather than decorative:
 *
 * - Rows are `min-h-12` (48 px). Do **not** reduce them to `min-h-11` to satisfy
 *   generic 44 px tap-target guidance; 44 px reintroduced a sub-pixel rounding
 *   flake in `ui-smoke`.
 * - The `compactCitations` preference collapses the rail to one chip, but the
 *   zero-source case stays worded in every mode — compact must never hide a
 *   missing-source signal.
 */
export function AnswerSourceRail({
  sources,
  query,
  onOpenSource,
  compact = false,
}: {
  sources: AnswerSourceRow[];
  query?: string;
  /** Opens the source drawer at this row. Omitted while the drawer is unavailable. */
  onOpenSource?: (index: number) => void;
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

  // Collapsed: one chip carrying the count, expanded on tap. The rows below are
  // the same rows either way, so nothing is unreachable in compact mode.
  const collapsed = compact && !expanded;

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
      ) : null}

      {/* `role="list"` on a div rather than a real <ol>: the rail sits inside
          `plain-answer-response`, where a ui-smoke guard asserts the primary
          answer renders as prose and not as a bullet list. The source-capsule
          preview used the same idiom for the same reason. */}
      {collapsed ? null : (
        <div
          id={rowListId}
          role="list"
          className={cn("grid gap-0 divide-y divide-[color:var(--border)]", compact && "mt-2")}
          aria-label="Cited documents"
        >
          {sources.map((source, index) => (
            <div key={`${source.id}:${index}`} role="listitem" className="min-w-0">
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-1">
                <span
                  className={cn(
                    "nums grid h-8 min-w-8 place-items-center rounded-md border px-1 text-xs font-bold shadow-[var(--shadow-inset)]",
                    sourceBadgeToneClass(source.metadata, index),
                  )}
                  aria-hidden="true"
                >
                  {sourceBadgeLabel(index)}
                </span>
                {/* Title and metadata share one tap target rather than stacking a
                    48 px control on top of a separate caption line: the rail lists
                    every cited source inline where the old capsule was a single
                    chip, so each row's height is phone scroll budget.
                    A historical thread turn mounts no drawer, so its rows link
                    straight to the document rather than advertising a panel that
                    will not open. */}
                {onOpenSource ? (
                  <button
                    type="button"
                    id={answerSourceRailRowId(index)}
                    data-testid="answer-source-rail-row"
                    onClick={() => onOpenSource(index)}
                    className={railRowLabelClass}
                    aria-label={`${railRowLabel(source, index)} — open source detail`}
                  >
                    <span className="block line-clamp-2">{cleanDisplayTitle(source.title)}</span>
                    <span
                      className={cn(
                        "mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal",
                        textMuted,
                      )}
                    >
                      <span className="font-mono tabular-nums">p. {source.pageNumber ?? "n/a"}</span>
                      <span aria-hidden>·</span>
                      <span>{sourceSupportLabel(source, index)}</span>
                      <StatusDotMarker
                        tone={sourceStatusDotTone(source.metadata)}
                        label={sourceStatusShortLabel(source.metadata)}
                        labelClassName={
                          source.metadata.document_status === "review_due" ||
                          source.metadata.document_status === "outdated"
                            ? "font-semibold text-[color:var(--warning)]"
                            : undefined
                        }
                      />
                    </span>
                  </button>
                ) : (
                  <Link
                    href={source.href}
                    data-testid="answer-source-rail-row"
                    onClick={() => query && logSourceOpen(query, source)}
                    className={railRowLabelClass}
                    aria-label={`${railRowLabel(source, index)} — open source`}
                  >
                    <span className="block line-clamp-2">{cleanDisplayTitle(source.title)}</span>
                    <span
                      className={cn(
                        "mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal",
                        textMuted,
                      )}
                    >
                      <span className="font-mono tabular-nums">p. {source.pageNumber ?? "n/a"}</span>
                      <span aria-hidden>·</span>
                      <span>{sourceSupportLabel(source, index)}</span>
                      <StatusDotMarker
                        tone={sourceStatusDotTone(source.metadata)}
                        label={sourceStatusShortLabel(source.metadata)}
                        labelClassName={
                          source.metadata.document_status === "review_due" ||
                          source.metadata.document_status === "outdated"
                            ? "font-semibold text-[color:var(--warning)]"
                            : undefined
                        }
                      />
                    </span>
                  </Link>
                )}
                <Link
                  href={source.href}
                  onClick={() => query && logSourceOpen(query, source)}
                  className="grid h-12 w-12 place-items-center rounded-md text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  aria-label={`Open ${sourceBadgeLabel(index)} source page`}
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The row's accessible name. It has to restate the support level and review
 * status, because an `aria-label` replaces the row's own text: without them a
 * screen reader would hear the title and page but never that the document is
 * outdated or that it only partly supports the claim.
 */
function railRowLabel(source: AnswerSourceRow, index: number) {
  return [
    `${sourceBadgeLabel(index)}: ${cleanDisplayTitle(source.title)}`,
    `page ${source.pageNumber ?? "not available"}`,
    sourceSupportLabel(source, index),
    sourceStatusShortLabel(source.metadata),
  ].join(", ");
}

const railRowLabelClass =
  "flex min-h-12 w-full min-w-0 flex-col justify-center rounded-md py-1 text-left text-sm font-semibold leading-5 text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
