"use client";

import { cn, SourceDesignationBadge, SourceStatusBadge, type SourceMetadataInput } from "@/components/ui-primitives";
import { Quantity } from "@/components/ui/quantity";
import { StatusMark } from "@/components/ui/status-mark";

export type DoseQuantity = {
  /** The numeral only, e.g. "12.5" or "250–750". Never include the unit here. */
  value: string;
  /** The unit, e.g. "mg", "mg/day". Rendered in sans, never uppercased. */
  unit?: string;
};

export type DoseSourceRef = {
  sourceId: string;
  title: string;
  locator?: string;
  metadata?: SourceMetadataInput;
  provenance?: SourceMetadataInput | string;
};

export type DoseRowBase = {
  /** Stable identity. Never the array index — a reordered ledger must not re-key. */
  id: string;
  /** Drug or intervention name. */
  drug: string;
  /** Route, population, indication — the qualifier that makes the dose specific. */
  qualifier?: string;
  dose: DoseQuantity;
  frequency?: string;
  route?: string;
  maximum?: DoseQuantity;
  metadata?: SourceMetadataInput;
  provenance?: SourceMetadataInput | string;
};

/**
 * `status` is REQUIRED and carries the governance enum, not a boolean.
 *
 * Two things follow from that, both deliberate. A call site cannot omit the
 * currency of the source a dose was read from — the highest-consequence surface
 * in the system gets the same "unrepresentable-as-absent" treatment `AnswerCard`
 * gives its verification notice. And `outdated` (superseded) cannot collapse
 * into `review_due` (still in force, review has come around); they are different
 * facts and get different marks and different words.
 *
 * An overdue row additionally requires `source`: the caution's entire purpose is
 * that re-verification is one click away, so "warned, with nowhere to go" is
 * refused by the type (DECISIONS §Q1).
 *
 * Governance-set throughout. Never inferred here from a date — the review policy
 * lives in the source governance layer (COMPONENTS §2).
 */
export type DoseRow = DoseRowBase &
  (
    | { status: "current" | "unknown"; source?: DoseSourceRef }
    | { status: "review_due" | "outdated"; source: DoseSourceRef }
  );

export type DoseLineProps = {
  rows: readonly DoseRow[];
  /** Optional caption above the ledger. */
  caption?: string;
  /** Required: an overdue row's whole point is that re-verification is one click away. */
  onOpenSource: (sourceId: string, locator?: string) => void;
  className?: string;
};

/**
 * The ledger treatment: one bordered card, hairline separators, drug on the left,
 * dose right-aligned in a fixed column so the numerals stack. `tabular-nums` alone
 * does nothing when the column is left-aligned — the alignment is what makes the
 * figures comparable at a glance.
 *
 * Dose typography is `Quantity`, never a reimplementation of it, because the two
 * rules that make a dose safe to read live there: the unit is never uppercased
 * (`g` is not `G`), and the unit is demoted so the figure is what you see first.
 *
 * Overdue is a three-channel signal (Q1): the amber inset rule, the words
 * ("Source review overdue" / "Source superseded"), and a non-colour `StatusMark`
 * whose shape differs per state. Colour alone fails greyscale print, forced
 * colours, and roughly one in twelve male readers — and a dose from a stale
 * guideline is exactly the case where "looks authoritative" is the danger.
 *
 * Both overdue states wear amber rather than danger red: SPEC §11 reserves the
 * amber channel for source currency and red for clinical hazard, and a
 * superseded source is a currency fact. The slashed mark and the word
 * "superseded" carry the difference in severity.
 */
export function DoseLine({ rows, caption, onOpenSource, className }: DoseLineProps) {
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
        {rows.map((row) => {
          const overdue = row.status === "review_due" || row.status === "outdated";
          const metadata =
            row.source?.metadata ??
            row.metadata ??
            (typeof row.source?.provenance === "object" && row.source?.provenance !== null
              ? row.source.provenance
              : typeof row.provenance === "object" && row.provenance !== null
                ? row.provenance
                : undefined);
          const rawProvenanceText =
            typeof row.source?.provenance === "string"
              ? row.source.provenance
              : typeof row.provenance === "string"
                ? row.provenance
                : null;

          return (
            <li
              key={row.id}
              data-testid="dose-row"
              data-status={row.status}
              data-overdue={overdue ? "true" : undefined}
              // The inset rule is painted with box-shadow so it cannot add layout
              // width; the left padding compensates for it explicitly rather than
              // letting the rule eat the card inset.
              className={cn(
                "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 pr-[var(--pad-card)]",
                "pl-[calc(var(--pad-card)_+_var(--rule-w))]",
                overdue ? "shadow-[var(--rule-warning)]" : "shadow-[var(--rule-accent)]",
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[color:var(--text-heading)]">{row.drug}</span>
                {row.qualifier ? (
                  <span className="mt-0.5 block text-xs text-[color:var(--text-muted)]">{row.qualifier}</span>
                ) : null}
                {row.route || row.frequency ? (
                  <span className="mt-0.5 block text-xs text-[color:var(--text-muted)]">
                    {[row.route, row.frequency].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                {overdue ? (
                  <span
                    data-testid="dose-row-overdue"
                    data-status={row.status}
                    className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--warning)]"
                  >
                    <StatusMark status={row.status} />
                    {row.status === "outdated" ? "Source superseded" : "Source review overdue"}
                  </span>
                ) : null}
                {metadata || rawProvenanceText ? (
                  <span data-testid="dose-row-provenance" className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {metadata ? (
                      <>
                        <SourceDesignationBadge metadata={metadata} />
                        <SourceStatusBadge metadata={metadata} />
                      </>
                    ) : (
                      <span className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 text-xs font-semibold text-[color:var(--text-muted)]">
                        {rawProvenanceText}
                      </span>
                    )}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 whitespace-nowrap text-right">
                <Quantity value={row.dose.value} unit={row.dose.unit} size="sm" />
                {row.maximum ? (
                  <span className="mt-0.5 block text-xs text-[color:var(--text-muted)]">
                    {"Max "}
                    <Quantity value={row.maximum.value} unit={row.maximum.unit} size="sm" demoted />
                  </span>
                ) : null}
                {row.source ? (
                  <button
                    type="button"
                    data-testid="dose-row-open-source"
                    onClick={() => onOpenSource(row.source!.sourceId, row.source!.locator)}
                    aria-label={`Open ${[row.source.title, row.source.locator].filter(Boolean).join(", ")}`}
                    className="mt-1 inline-flex min-h-tap items-center rounded-md text-xs font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  >
                    Open source
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
