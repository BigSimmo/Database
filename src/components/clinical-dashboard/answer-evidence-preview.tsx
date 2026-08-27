"use client";

import Link from "next/link";

import { cleanDisplayTitle } from "@/components/clinical-dashboard/display-text";
import { sourceResultHref } from "@/components/clinical-dashboard/source-actions";
import { cn } from "@/components/ui-primitives";
import type { VerifiedEvidencePreviewUnit } from "@/lib/answer-stream-contract";

/** The render policy caps primary sources at six, so the rail is built for six
 *  rather than for the three a specimen usually draws. */
const visiblePreviewSourceLimit = 6;

/**
 * The sources, arriving.
 *
 * This used to be a full panel — an icon tile, a heading reading "Selected
 * evidence — answer still being verified", a sentence of explanation, and a
 * three-column grid of cards with snippets — rendered *underneath* a filled
 * accent progress stepper. Two loud blocks stacked in the answer's own position,
 * both of which then disappeared when the answer arrived.
 *
 * It is now one horizontal rail of small cards that sits directly under the
 * progress line, and it is deliberately built to look like the source rail the
 * arrived answer renders, because that is what it becomes. Nothing is removed
 * when the answer lands; the cards stay where the reader's eye already settled.
 *
 * **The cards carry a dot, not a number.** The preview is the top slice of
 * retrieval in retrieval order, while the final list is rebuilt from what the
 * answer actually cites and re-capped by trust (`collectSourceCandidates` /
 * `dedupeSourceLinks`). Different sets in a different order, so a number
 * assigned here can end up pointing at a different document once the answer
 * lands — the precise failure the citation design exists to prevent. Numbering
 * is what arrival buys.
 *
 * Each card is a real link to the real page, so a reader who recognises a
 * document can open it without waiting for the answer at all.
 */
export function AnswerEvidencePreview({ preview }: { preview: VerifiedEvidencePreviewUnit }) {
  const visibleSources = preview.sources.slice(0, visiblePreviewSourceLimit);
  if (visibleSources.length === 0) return null;

  return (
    <div
      data-testid="answer-evidence-preview"
      role="group"
      aria-label={`Sources found so far, ${visibleSources.length}. Not yet numbered — the answer decides the final list.`}
      className="answer-sources-arriving flex gap-1.5 overflow-x-auto pb-1"
    >
      {visibleSources.map((source, index) => {
        const title = cleanDisplayTitle(source.title);
        return (
          <Link
            key={`${source.document_id}:${source.id}`}
            href={sourceResultHref(source)}
            data-testid="answer-evidence-preview-source"
            aria-label={`Open source found so far: ${title}, page ${source.page_number ?? "unknown"}`}
            style={{ "--stagger-index": index } as React.CSSProperties}
            className={cn(
              "stagger-item inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-[color:var(--border)]",
              "bg-[color:var(--surface-raised)] px-2.5 text-left transition",
              "hover:border-[color:var(--border-strong)] hover:shadow-[var(--e1)]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
            )}
          >
            <span
              aria-hidden="true"
              className="grid h-5 min-w-5 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-3xs font-bold text-[color:var(--text-muted)] forced-colors:border-[CanvasText]"
            >
              &bull;
            </span>
            <span className="min-w-0">
              <span className="block max-w-40 truncate text-2xs font-semibold leading-4 text-[color:var(--text-heading)]">
                {title}
              </span>
              <span className="block text-3xs leading-4 text-[color:var(--text-muted)]">
                <span className="nums">p.{source.page_number ?? "n/a"}</span>
                {source.section_heading ? ` · ${cleanDisplayTitle(source.section_heading)}` : ""}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
