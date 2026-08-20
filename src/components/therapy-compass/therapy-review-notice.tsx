import { ShieldAlert } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import { THERAPY_CATALOGUE_SUMMARY } from "./data/generated-assets";

/**
 * Library-level review disclosure for Therapy.
 *
 * Therapy is reachable in production with its review state stated rather than
 * hidden — the mode was previously `devOnly`, which 404'd the route and all 205
 * records for real users. This notice carries the catalogue-wide half of that
 * disclosure; the per-record half is the badge every result card, detail page,
 * brief and patient sheet already renders from `reviewStatus`.
 *
 * Counts come from the generated catalogue summary, which the index generator's
 * check mode keeps in step with the data, so the wording cannot drift as records
 * are signed off. Non-interactive on purpose: no tap target, no link, nothing to
 * dismiss — a caveat the reader can turn off is not a caveat.
 */
export function TherapyReviewNotice({ className }: { className?: string }) {
  const total: number = THERAPY_CATALOGUE_SUMMARY.totalCount;
  const needsReview: number = THERAPY_CATALOGUE_SUMMARY.needsReviewCount;

  if (needsReview === 0) return null;

  const scope =
    needsReview === total
      ? `No therapy record in this library has completed clinician review yet.`
      : `${needsReview} of ${total} therapy records have not completed clinician review yet.`;

  return (
    <div
      role="note"
      data-testid="therapy-review-notice"
      className={cn(
        "mx-auto flex w-full max-w-none items-start gap-2 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2.5 text-left sm:max-w-[60rem] sm:px-4",
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--warning)]" aria-hidden />
      <p className="m-0 text-xs leading-5 text-[color:var(--warning-text)]">
        <span className="font-semibold">Awaiting clinician review. </span>
        {scope} Records are shown so they can be read and checked against their cited sources — verify each one before
        using it clinically.
      </p>
    </div>
  );
}
