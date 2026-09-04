"use client";

import { GraduationCap } from "lucide-react";

import { OnCallFreshnessBadge } from "@/components/on-call/on-call-freshness-badge";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { ExternalTextLink } from "@/components/ui/link";
import { cn, eyebrowText, metadataPillDensity, textMuted } from "@/components/ui-primitives";
import { onCallDetailsSchemaFor, onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";

export interface OnCallEducationSectionProps {
  entries: readonly OnCallEntry[];
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: Date;
  testId?: string;
}

interface OnCallEducationDetails {
  recurrence?: string;
  nextOccurrence?: string;
  presenter?: string;
  location?: string;
  recordingUrl?: string;
  topics: readonly string[];
}

function parseEducationDetails(details: unknown): OnCallEducationDetails | null {
  const result = onCallDetailsSchemaFor("education").safeParse(details);
  return result.success ? (result.data as OnCallEducationDetails) : null;
}

/**
 * `nextOccurrence` is owner-typed free text (spec: no roster/recurring-date
 * engine), not a guaranteed ISO date. A parseable value sorts by real time;
 * anything else (or missing) sorts after every dated entry, alphabetically by
 * title, rather than being silently dropped from the calendar.
 */
function occurrenceSortKey(value: string | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function EducationCard({ entry, now }: { entry: OnCallEntry; now: Date }) {
  const details = parseEducationDetails(entry.details);
  const freshness = onCallEntryFreshness(entry, now);

  return (
    <article
      className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--e1)]"
      data-testid={`on-call-education-card-${entry.slug}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[color:var(--text)]">{entry.title}</h3>
          {details?.presenter ? <p className={cn("mt-0.5 text-xs", textMuted)}>{details.presenter}</p> : null}
        </div>
        <OnCallFreshnessBadge freshness={freshness} />
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        {details?.nextOccurrence ? (
          <span className={cn(metadataPillDensity.standard, "rounded-full")}>Next: {details.nextOccurrence}</span>
        ) : null}
        {details?.recurrence ? (
          <span className={cn(metadataPillDensity.standard, "rounded-full")}>{details.recurrence}</span>
        ) : null}
        {details?.location ? (
          <span className={cn(metadataPillDensity.standard, "rounded-full")}>{details.location}</span>
        ) : null}
      </div>

      {details && details.topics.length > 0 ? (
        <p className="text-sm">
          <span className="font-semibold text-[color:var(--text)]">Topics: </span>
          <span className={textMuted}>{details.topics.join(", ")}</span>
        </p>
      ) : null}

      {details?.recordingUrl ? (
        // Marked as leaving the app: `ExternalTextLink` is the one component
        // that carries the visible glyph, the sr-only "(opens in a new tab)",
        // and `rel="noopener noreferrer"` together — never a bare anchor.
        <ExternalTextLink href={details.recordingUrl} className="text-sm">
          Watch recording
        </ExternalTextLink>
      ) : null}
    </article>
  );
}

/**
 * The Teaching (`education`) section: the calendar in order of next
 * occurrence, each card naming what, when, who presents, and — once one
 * exists — a recording link explicitly marked as leaving the app.
 */
export function OnCallEducationSection({
  entries,
  now = new Date(),
  testId = "on-call-education-section",
}: OnCallEducationSectionProps) {
  const educationEntries = entries.filter((entry) => entry.section === "education");

  if (educationEntries.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No teaching sessions yet"
        body="Sessions you add will appear here, ordered by their next occurrence."
        testId="on-call-education-empty"
      />
    );
  }

  const sorted = [...educationEntries].sort((a, b) => {
    const aDetails = parseEducationDetails(a.details);
    const bDetails = parseEducationDetails(b.details);
    const byOccurrence = occurrenceSortKey(aDetails?.nextOccurrence) - occurrenceSortKey(bDetails?.nextOccurrence);
    if (byOccurrence !== 0) return byOccurrence;
    return a.title.localeCompare(b.title);
  });

  return (
    <div data-testid={testId} className="grid gap-3">
      <h3 className={eyebrowText}>Next occurrence first</h3>
      {sorted.map((entry) => (
        <EducationCard key={entry.id} entry={entry} now={now} />
      ))}
    </div>
  );
}
