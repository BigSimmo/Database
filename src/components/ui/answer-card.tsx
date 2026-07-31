"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui-primitives";

/*
 * The answer surface. `answerSurface` was `"rounded-lg bg-transparent"` — the
 * screen the product is judged on had no surface at all.
 *
 * Token note: the v2 semantic tokens (--pad-panel, --measure, --text-md,
 * --leading-prose, --pad-card, --rule-w, --e2) are declared on the opt-in
 * `.ckb-v2` layer, so every reference here carries the v1 fallback it resolves to
 * today. The components therefore render correctly with or without the layer, and
 * pick up the v2 values automatically inside it.
 */

export type AnswerCardProps = {
  children: ReactNode;
  /** Rendered above the prose — question echo, mode chip, provenance row. */
  header?: ReactNode;
  /** Rendered below the prose, outside the reading measure — usually AnswerFooter. */
  footer?: ReactNode;
  className?: string;
};

export function AnswerCard({ children, header, footer, className }: AnswerCardProps) {
  return (
    <article
      data-testid="answer-card"
      className={cn(
        "overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--e2,var(--shadow-soft))]",
        className,
      )}
    >
      {header ? (
        <div className="border-b border-[color:var(--border)] p-[var(--pad-panel)] pb-[var(--gap-stack)]">{header}</div>
      ) : null}
      <div
        className={cn(
          "p-[var(--pad-panel)]",
          // Prose measure is a hard ceiling: an answer that runs the full width of a
          // desktop viewport is unreadable regardless of type size.
          "max-w-[var(--measure)] text-[length:var(--text-md)] leading-prose text-[color:var(--text)]",
        )}
      >
        {children}
      </div>
      {footer}
    </article>
  );
}

export type DoseRow = {
  /** Drug or intervention name. */
  drug: string;
  /** Route, population, indication — the qualifier that makes the dose specific. */
  qualifier?: string;
  /** The numeral only, e.g. "12.5" or "250–750". Never include the unit here. */
  value: string;
  /** The unit, e.g. "mg", "mg/day". Rendered in sans, never uppercased. */
  unit?: string;
  /**
   * True when the source this row was read from is past its review date. Turns the
   * row's inset rule amber — a dose from a stale guideline is exactly the case
   * where "looks authoritative" is the danger.
   */
  overdue?: boolean;
};

export type DoseLineProps = {
  rows: DoseRow[];
  /** Optional caption above the ledger. */
  caption?: string;
  className?: string;
};

/**
 * The ledger treatment: one bordered card, hairline separators, drug on the left,
 * dose right-aligned in a fixed column so the numerals stack. `tabular-nums` alone
 * does nothing when the column is left-aligned — the alignment is what makes the
 * figures comparable at a glance.
 *
 * Unit typography is deliberate and was a real defect in the first pass: the unit
 * is sans at the label step, NOT uppercased. In medicine `g` and `G`, `mg` and
 * `MG` are not interchangeable, and an uppercasing transform silently changes a
 * dose.
 */
export function DoseLine({ rows, caption, className }: DoseLineProps) {
  if (!rows.length) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)]",
        className,
      )}
    >
      {caption ? (
        <p className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-[var(--pad-card)] py-2 text-xs font-semibold text-[color:var(--text-muted)]">
          {caption}
        </p>
      ) : null}
      <ul className="divide-y divide-[color:var(--border)]">
        {rows.map((row, index) => (
          <li
            key={`${row.drug}:${index}`}
            data-testid="dose-row"
            data-overdue={row.overdue ? "true" : undefined}
            // The inset rule is painted with box-shadow so it cannot add layout
            // width; the left padding compensates for it explicitly rather than
            // letting the rule eat the card inset.
            className={cn(
              "flex items-baseline justify-between gap-4 py-3 pr-[var(--pad-card)]",
              "pl-[calc(var(--pad-card)_+_var(--rule-w))]",
              row.overdue ? "shadow-[var(--rule-warning)]" : "shadow-[var(--rule-accent)]",
            )}
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[color:var(--text-heading)]">{row.drug}</span>
              {row.qualifier ? (
                <span className="mt-0.5 block text-xs text-[color:var(--text-muted)]">{row.qualifier}</span>
              ) : null}
            </span>
            <span className="shrink-0 whitespace-nowrap text-right">
              <span className="font-mono text-sm tabular-nums text-[color:var(--text-heading)] [font-weight:var(--font-weight-value)]">
                {row.value}
              </span>
              {row.unit ? (
                <span className="ml-1 text-sm-minus normal-case text-[color:var(--text-muted)] [font-weight:var(--font-weight-label)]">
                  {row.unit}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type AnswerFooterProps = {
  publisher?: string | null;
  version?: string | null;
  /** Formatted review date. Pass the formatted string, not a raw timestamp. */
  reviewDate?: string | null;
  /** Formatted generation timestamp. */
  generatedAt?: string | null;
  className?: string;
};

/**
 * Provenance strip, always visible. Trust is layout, not a tooltip: publisher,
 * version, review date and generation time are the four things a clinician needs
 * to decide whether to act on an answer, so they are not hidden behind a hover.
 * Missing segments are dropped rather than filled with "Unknown" — a run of
 * unknown fillers is noise — except the review date, which stays explicit because
 * "no review date" is itself a governance signal.
 */
export function AnswerFooter({ publisher, version, reviewDate, generatedAt, className }: AnswerFooterProps) {
  const segments = [
    publisher || null,
    version ? `Version ${version}` : null,
    `Review ${reviewDate || "date unknown"}`,
    generatedAt ? `Generated ${generatedAt}` : null,
  ].filter((segment): segment is string => Boolean(segment));

  return (
    <div
      data-testid="answer-footer"
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[color:var(--border)] bg-[color:var(--surface-wash)]",
        "px-[var(--pad-panel)] py-[var(--gap-inline)] text-xs tabular-nums text-[color:var(--text-muted)]",
        className,
      )}
    >
      {segments.map((segment, index) => (
        <span key={`${segment}:${index}`} className="inline-flex items-center gap-2">
          {index > 0 ? <span aria-hidden className="h-1 w-1 rounded-full bg-[color:var(--border-strong)]" /> : null}
          {segment}
        </span>
      ))}
    </div>
  );
}
