"use client";

import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui-primitives";
import { StatusMark, type DocumentStatus } from "@/components/ui/status-mark";

type CitationBase = {
  /** 1-based index as it appears in the answer text. */
  index: number;
  /** Short source label — document title, abbreviated. */
  label: string;
  /** Page or section locator, e.g. "p. 14" or "§3.2". */
  locator?: string;
  /** Currency of the cited source. Drives the mark, never the label wording. */
  status?: DocumentStatus;
  className?: string;
};

/**
 * Interactive citation requires an activation handler. Static (print/export)
 * citations set `interactive={false}` and must not advertise an action.
 */
export type CitationProps = CitationBase &
  ({ interactive?: true; onActivate: () => void } | { interactive: false; onActivate?: never });

/**
 * The citation chip — the mark that makes a grounded answer auditable, and the
 * single most product-defining element in this system. It existed only as three
 * class strings (`sourceCapsuleHit`, `sourceCapsule`, `sourceCapsuleCountBadge`)
 * plus unlayered CSS, so a designer could not place one and nothing tested it.
 *
 * Structure: an invisible tap-sized hit target wrapping a compact visible face. The
 * chip reads small and light without shrinking the tap area — the same trick the
 * old recipes used, kept because it is correct.
 *
 * The status mark is the source's currency, not the citation's. A citation to an
 * outdated source is still a valid citation; it is the source that is stale, and
 * the reader has to be able to see that without opening it.
 */
export function Citation({ index, label, locator, status, onActivate, interactive = true, className }: CitationProps) {
  const face = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium",
        "border-[color:var(--clinical-accent-border)] bg-[color-mix(in_srgb,var(--clinical-accent-soft)_55%,var(--surface))]",
        "text-[color:var(--clinical-accent)]",
        className,
      )}
    >
      <span className="nums font-mono font-semibold">{index}</span>
      <span className="min-w-0 max-w-[18ch] truncate">{label}</span>
      {locator ? <span className="nums text-[color:var(--text-muted)]">{locator}</span> : null}
      {status ? <StatusMark status={status} className="h-1.5 w-1.5" /> : null}
    </span>
  );

  const accessibleName = [`Source ${index}`, label, locator, status ? statusPhrase(status) : null]
    .filter(Boolean)
    .join(", ");

  if (!interactive) {
    return (
      <span data-testid="citation" aria-label={accessibleName} className="inline-flex w-fit items-center">
        {face}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-testid="citation"
      onClick={onActivate}
      aria-label={accessibleName}
      className="inline-flex min-h-tap w-fit items-center justify-center rounded-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
    >
      {face}
    </button>
  );
}

// One phrase per state — the same vocabulary the badges and provenance use, so a
// screen reader never hears the same state described two ways on one page.
function statusPhrase(status: DocumentStatus) {
  if (status === "current") return "current source";
  if (status === "review_due") return "review due";
  if (status === "outdated") return "outdated source";
  return "review status unknown";
}

/**
 * A run of citations under an answer paragraph or claim. A list, not a row of
 * loose buttons, so assistive technology announces how many sources back the
 * claim before reading them.
 */
export function CitationList({
  citations,
  label = "Sources for this answer",
  emptyNote = "No source supports this statement.",
  className,
}: {
  citations: ReactNode[];
  label?: string;
  /**
   * Shown when there are zero citations. An ungrounded statement in a clinical
   * tool is a governance event, so the empty case says so rather than rendering
   * nothing and looking identical to a cited one.
   */
  emptyNote?: ReactNode;
  className?: string;
}) {
  if (!citations.length) {
    return (
      <p
        data-testid="citation-list-empty"
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--warning)]"
      >
        <FileText aria-hidden="true" className="size-icon-xs shrink-0" />
        {emptyNote}
      </p>
    );
  }

  return (
    <ul
      data-testid="citation-list"
      aria-label={`${label} (${citations.length})`}
      className={cn("m-0 flex list-none flex-wrap items-center gap-1.5 p-0", className)}
    >
      {citations.map((citation, index) => (
        <li key={index} className="contents">
          {citation}
        </li>
      ))}
    </ul>
  );
}
