"use client";

import type { ReactNode } from "react";

import { cn, type SourceMetadataInput } from "@/components/ui-primitives";
import type { AnswerState, DegradedAnswerState } from "@/components/ui/answer-state";
import { DateDisplay } from "@/components/ui/date-display";
import { MissingValue } from "@/components/ui/missing-value";
import { Quantity } from "@/components/ui/quantity";
import { RetrievalStateBanner } from "@/components/ui/retrieval-state-banner";
import { StatusMark } from "@/components/ui/status-mark";
import { VerificationNotice, type VerificationNoticeProps } from "@/components/ui/verification-notice";
import {
  answerClipboardCaveatLine,
  answerClipboardProvenanceLine,
  answerStateAttribution,
} from "@/lib/answer-clipboard";

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

/** A named action under the answer. Every action does something — there is no inert form. */
export type AnswerCardAction = {
  id: string;
  label: string;
  onActivate: () => void;
};

type AnswerCardBase = {
  /** System-owned verification wording. Required: a generated answer cannot render without it. */
  verification: VerificationNoticeProps;
  /** The question this answer responds to. The card owns the echo's framing. */
  query?: string;
  /** The answer prose. */
  children: ReactNode;
  /** Machine provenance, rendered through AnswerFooter. */
  provenance?: AnswerFooterProps;
  actions?: AnswerCardAction[];
  className?: string;
};

/**
 * A degraded answer must carry the route back to its sources: `onOpenSource` is
 * what turns the banner's caution into an affordance, so the type refuses a
 * degraded card that cannot be re-verified (DECISIONS §Q1).
 */
export type AnswerCardProps = AnswerCardBase &
  (
    | { state: Extract<AnswerState, { kind: "ready" }>; onOpenSource?: (sourceId: string, locator?: string) => void }
    | { state: DegradedAnswerState; onOpenSource: (sourceId: string, locator?: string) => void }
  );

export function AnswerCard({
  state,
  verification,
  query,
  children,
  provenance,
  actions,
  onOpenSource,
  className,
}: AnswerCardProps) {
  return (
    <article
      data-testid="answer-card"
      data-state={state.kind}
      className={cn(
        "overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--e2,var(--shadow-soft))]",
        className,
      )}
    >
      <div className="space-y-[var(--gap-stack)] border-b border-[color:var(--border)] p-[var(--pad-panel)]">
        {query ? (
          <p data-testid="answer-card-query" className="text-sm text-[color:var(--text-muted)]">
            <span className="sr-only">Question: </span>
            {query}
          </p>
        ) : null}
        {/* Above the prose and above the actions, in document order, on screen
            and on print alike. */}
        <VerificationNotice {...verification} />
        {state.kind !== "ready" ? (
          <RetrievalStateBanner
            state={state}
            onOpenSource={onOpenSource as (sourceId: string, locator?: string) => void}
          />
        ) : null}
      </div>
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
      {actions?.length ? (
        <div className="flex flex-wrap gap-2 px-[var(--pad-panel)] pb-[var(--pad-panel)]">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              data-testid="answer-card-action"
              onClick={action.onActivate}
              className="inline-flex min-h-tap items-center rounded-[var(--radius-md)] border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {provenance ? <AnswerFooter {...provenance} /> : null}
    </article>
  );
}

/**
 * The caveat a copied or exported answer carries with it. Copy is an audit
 * artefact: it leaves the app, loses the banner, and is pasted into notes that
 * outlive the session, so the degraded state has to travel in the text itself.
 * Provenance goes through `clipboardProvenanceLine()` so there is exactly one
 * implementation of the audit line.
 */
export type ClipboardSourceRef = {
  title: string;
  locator?: string;
  /** Absolute or app-relative link back to the cited document. */
  href?: string;
};

export function answerClipboardText({
  body,
  state,
  sourceOnly,
  sources,
  metadata,
}: {
  body: string;
  state: AnswerState;
  /**
   * True when the answer was assembled from source passages rather than written
   * by a model. It cannot be inferred from `state`: `#207` precedence puts
   * `ungrounded` above `source_only`, so an extractive answer that is also
   * weakly supported reports `ungrounded`, and keying attribution on the kind
   * pastes "AI-generated" over passages no model wrote — a false provenance
   * claim in a clinical record. The product composer takes the same explicit
   * flag for the same reason (`@/lib/answer-clipboard`); this primitive was left
   * without one, which mattered the moment `AnswerCard` acquired its first
   * product mount (ledger `#216`).
   */
  sourceOnly?: boolean;
  /** The cited documents, enumerated so the paste can be audited away from the app. */
  sources?: readonly ClipboardSourceRef[];
  /**
   * Provenance for a SINGLE document. Emitted only when it cannot contradict the
   * state — see below.
   */
  metadata?: SourceMetadataInput;
}) {
  // Attribution and the verify instruction are unconditional, including on
  // `ready`. A copied answer loses the banner, the notice and the links, so
  // clinical prose with nothing attached reads in a record as though a clinician
  // wrote and endorsed it. This deliberately exceeds SPEC §13 slice 8, which
  // scoped the copied caveat to non-ready states; see docs/design-system/SPEC.md.
  //
  // Attribution, the degraded caveat and the provenance suppression rule live in
  // `@/lib/answer-clipboard` so this primitive and the product composer (#208)
  // cannot drift apart — one implementation of each rule, two callers.
  const verify = "Verify against the linked source documents before clinical use.";

  const sourceList = sources?.length
    ? ["Sources for review:", ...sources.map((source) => `- ${clipboardSourceLine(source)}`)].join("\n")
    : null;

  return [
    body.trim(),
    `${answerStateAttribution(state, { sourceOnly })} ${verify}`,
    answerClipboardCaveatLine(state),
    sourceList,
    answerClipboardProvenanceLine(state, metadata),
  ]
    .filter(Boolean)
    .join("\n");
}

function clipboardSourceLine({ title, locator, href }: ClipboardSourceRef) {
  const label = [title.trim(), locator?.trim()].filter(Boolean).join(", ");
  return href?.trim() ? `${label} — ${href.trim()}` : label;
}

export type DoseQuantity = {
  /** The numeral only, e.g. "12.5" or "250–750". Never include the unit here. */
  value: string;
  /** The unit, e.g. "mg", "mg/day". Rendered in sans, never uppercased. */
  unit?: string;
};

export type DoseSourceRef = { sourceId: string; title: string; locator?: string };

type DoseRowBase = {
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

export type AnswerFooterProps = {
  publisher?: string | null;
  version?: string | null;
  /** ISO review date. Preformatted display strings are unrepresentable. */
  reviewDate?: string | null;
  /** ISO generation timestamp. */
  generatedAt?: string | null;
  className?: string;
};

/**
 * Provenance strip, always visible. Trust is layout, not a tooltip: publisher,
 * version, review date and generation time are the four things a clinician needs
 * to decide whether to act on an answer, so they are not hidden behind a hover.
 *
 * Every field is a machine value in, rendered through `DateDisplay`; an absent
 * field renders `MissingValue` rather than disappearing. The previous version
 * dropped unknown segments to avoid a run of "Unknown" filler, but a silently
 * absent publisher and a recorded one look identical that way — and on a
 * provenance strip the absence *is* the governance signal.
 */
export function AnswerFooter({ publisher, version, reviewDate, generatedAt, className }: AnswerFooterProps) {
  const fields: Array<{ label: string; value: ReactNode }> = [
    {
      label: "Publisher",
      value: publisher?.trim() ? publisher.trim() : <MissingValue reason="not_recorded" density="cell" />,
    },
    {
      label: "Version",
      value: version?.trim() ? version.trim() : <MissingValue reason="not_recorded" density="cell" />,
    },
    { label: "Review", value: <DateDisplay value={reviewDate} kind="review" missingReason="not_recorded" /> },
    { label: "Generated", value: <DateDisplay value={generatedAt} kind="generated" missingReason="not_recorded" /> },
  ];

  return (
    <div
      data-testid="answer-footer"
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[color:var(--border)] bg-[color:var(--surface-wash)]",
        "px-[var(--pad-panel)] py-[var(--gap-inline)] text-xs nums text-[color:var(--text-muted)]",
        className,
      )}
    >
      {fields.map((field, index) => (
        <span key={field.label} className="inline-flex items-center gap-2">
          {index > 0 ? <span aria-hidden className="h-1 w-1 rounded-full bg-[color:var(--border-strong)]" /> : null}
          <span>
            {field.label}
            {": "}
            {field.value}
          </span>
        </span>
      ))}
    </div>
  );
}
