"use client";

import type { ReactNode } from "react";
import { cn, SourceDesignationBadge, SourceStatusBadge, type SourceMetadataInput } from "@/components/ui-primitives";
import { DateDisplay } from "@/components/ui/date-display";
import { MissingValue } from "@/components/ui/missing-value";

export type AnswerFooterProps = {
  publisher?: string | null;
  version?: string | null;
  /** ISO review date. Preformatted display strings are unrepresentable. */
  reviewDate?: string | null;
  /** ISO generation timestamp. */
  generatedAt?: string | null;
  /** Optional machine source metadata for clean provenance display. */
  metadata?: SourceMetadataInput;
  /** Optional provenance metadata or label. */
  provenance?: SourceMetadataInput | string | null;
  className?: string;
};

/**
 * Provenance strip, always visible. Trust is layout, not a tooltip: publisher,
 * version, review date and generation time are the four things a clinician needs
 * to decide whether to act on an answer, so they are not hidden behind a hover.
 *
 * Every field is a machine value in, rendered through `DateDisplay`; an absent
 * field renders `MissingValue` rather than disappearing. When source metadata
 * or provenance is present in the payload, provenance badges display source
 * authority and status cleanly.
 */
export function AnswerFooter({
  publisher,
  version,
  reviewDate,
  generatedAt,
  metadata: explicitMetadata,
  provenance,
  className,
}: AnswerFooterProps) {
  const metadata = explicitMetadata ?? (typeof provenance === "object" && provenance !== null ? provenance : undefined);
  const rawProvenanceText = typeof provenance === "string" ? provenance : null;

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
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[color:var(--border)] bg-[color:var(--surface-wash)]",
        "px-[var(--pad-panel)] py-[var(--gap-inline)] text-xs nums text-[color:var(--text-muted)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {fields.map((field, index) => (
          <span key={field.label} className="inline-flex items-center gap-2">
            {index > 0 ? <span aria-hidden className="h-1 w-1 rounded-full bg-[color:var(--border-strong)]" /> : null}
            <span>
              {field.label}
              {": "}
              <strong className="font-semibold text-[color:var(--text-heading)]">{field.value}</strong>
            </span>
          </span>
        ))}
      </div>
      {metadata || rawProvenanceText ? (
        <span
          data-testid="answer-footer-provenance"
          className="inline-flex flex-wrap items-center gap-1.5 border-l border-[color:var(--border)] pl-3"
        >
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
    </div>
  );
}
