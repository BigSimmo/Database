"use client";

import { ExternalLink } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { cn, textMuted } from "@/components/ui-primitives";
import { mhaActMetadata, mhaActSection } from "@/lib/mha-act-sections";
import { formatPerthDateTime, parsePerthDateTimeInput, timelineFor, type MhaTimelineItem } from "@/lib/mha-timeline";

/** Fixed wording, owner-approved. Do not paraphrase. */
export const MHA_TIMELINE_REFERENCE_NOTE = "Reference only — check against the Act and your service's procedure.";
export const MHA_TIMELINE_AWAITING_REVIEW = "Awaiting clinical review — time not calculated";

function DeadlineLine({ item }: { item: MhaTimelineItem }) {
  if (item.quoteOnly) {
    return (
      <p className="text-sm font-semibold leading-6 text-[color:var(--text-muted)]" data-testid="mha-timeline-awaiting">
        {MHA_TIMELINE_AWAITING_REVIEW}
      </p>
    );
  }
  if (!item.deadline) {
    return <p className={cn("text-sm leading-6", textMuted)}>Enter when this was made to see the Perth time.</p>;
  }
  return (
    <p className="text-sm leading-6 text-[color:var(--text-body)]">
      <span className="font-semibold text-[color:var(--text-heading)]">Ends: </span>
      <time dateTime={item.deadline.toISOString()} data-testid="mha-timeline-deadline">
        {formatPerthDateTime(item.deadline)}
      </time>
    </p>
  );
}

/**
 * The form page's Mental Health Act timeline.
 *
 * Each time limit is shown as the Act's own words, with a link to the Act. A Perth clock time is
 * calculated only for an entry the owner has signed off; every other entry says it is awaiting
 * clinical review and shows no time. See `src/lib/mha-timeline.ts` for the rule and its tests.
 */
export function MhaTimelinePanel({ formCode }: { formCode: string }) {
  const inputId = useId();
  const hintId = useId();
  const headingId = useId();
  const [startValue, setStartValue] = useState("");
  const start = useMemo(() => parsePerthDateTimeInput(startValue), [startValue]);
  const items = useMemo(() => timelineFor(formCode, start), [formCode, start]);

  if (items.length === 0) return null;
  const anyReviewed = items.some((item) => !item.quoteOnly);

  return (
    <section id="form-timeline" aria-labelledby={headingId} className={cn(inPageAnchor, "space-y-3")}>
      <h2
        id={headingId}
        className="text-base-minus font-semibold leading-5 text-[color:var(--text-heading)] sm:text-base"
      >
        Timeline
      </h2>
      <p className="text-sm font-semibold leading-6 text-[color:var(--text-heading)]">{MHA_TIMELINE_REFERENCE_NOTE}</p>

      <div className="space-y-1">
        <label htmlFor={inputId} className="block text-sm font-semibold text-[color:var(--text-heading)]">
          When was this made?
        </label>
        <input
          id={inputId}
          type="datetime-local"
          value={startValue}
          onChange={(event) => setStartValue(event.target.value)}
          aria-describedby={hintId}
          className="min-h-12 w-full max-w-sm rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        />
        <p id={hintId} className={cn("text-xs leading-5", textMuted)}>
          {anyReviewed
            ? "Perth time (AWST)."
            : "Perth time (AWST). No time is calculated yet: every limit below is awaiting clinical review."}
        </p>
      </div>

      <ol className="space-y-3">
        {items.map((item) => {
          const { entry } = item;
          const heading = mhaActSection(entry.section)?.title;
          return (
            <li
              key={entry.id}
              className="space-y-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]"
            >
              <h3 className="text-sm font-semibold leading-6 text-[color:var(--text-heading)]">{entry.trigger}</h3>
              <blockquote
                cite={mhaActMetadata.sourceUrl}
                className="border-l-2 border-[color:var(--clinical-accent-border)] pl-3 text-sm italic leading-6 text-[color:var(--text-body)]"
              >
                {`“${entry.quote}”`}
              </blockquote>
              <a
                href={mhaActMetadata.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center gap-1.5 text-sm font-semibold text-[color:var(--clinical-accent)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              >
                {`Mental Health Act 2014 (WA) s ${entry.section}${heading ? ` — ${heading}` : ""}`}
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              </a>
              <p className={cn("text-xs leading-5", textMuted)}>{`Counted from: ${entry.anchor}.`}</p>
              <DeadlineLine item={item} />
            </li>
          );
        })}
      </ol>
      <p className={cn("text-xs leading-5", textMuted)}>
        {`Quoted from version ${mhaActMetadata.actVersion} of the Act, as at ${mhaActMetadata.actAsAt}.`}
      </p>
    </section>
  );
}
