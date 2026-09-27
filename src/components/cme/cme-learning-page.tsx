import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { EmptyState, cn, raisedCard, textMuted, toneWarning } from "@/components/ui-primitives";
import { formatCalendarDateLong, formatCalendarDateShort, perthCalendarDate } from "@/lib/cme/cpd-year";
import {
  LEARNING_DIRECTORY_STALE_AFTER_DAYS,
  isDirectoryStale,
  learningItemLogHref,
  unconfirmedLearningItems,
  upcomingLearningItems,
  type LearningDirectoryItem,
} from "@/lib/cme/learning-directory";

const KIND_LABEL: Record<LearningDirectoryItem["kind"], string> = {
  course: "Course",
  event: "Event",
  recorded: "Recorded",
};

function dateLabel(item: LearningDirectoryItem): string {
  const { startsOn, endsOn } = item;
  if (startsOn === null) return item.kind === "recorded" ? "Watch any time" : "Date not confirmed";
  if (endsOn === null || endsOn === startsOn) return formatCalendarDateLong(startsOn);
  if (startsOn.slice(0, 4) === endsOn.slice(0, 4)) {
    return `${formatCalendarDateShort(startsOn)} to ${formatCalendarDateLong(endsOn)}`;
  }
  return `${formatCalendarDateLong(startsOn)} to ${formatCalendarDateLong(endsOn)}`;
}

function modeLabel(item: LearningDirectoryItem): string {
  const where = item.mode === "online" ? "Online" : item.mode === "in-person" ? "In person" : "Online and in person";
  return item.location && item.mode !== "online" ? `${where}, ${item.location}` : where;
}

function LearningItemCard({ item }: { item: LearningDirectoryItem }) {
  return (
    <li data-testid="cme-learning-item" className={cn(raisedCard, "p-4")}>
      <p className={cn(textMuted, "text-xs font-semibold")}>
        {KIND_LABEL[item.kind]} · {item.provider}
      </p>
      <h3 className="mt-1 text-base font-semibold text-[color:var(--text)]">{item.title}</h3>
      <dl className="mt-2 grid gap-1 text-sm text-[color:var(--text)]">
        <div className="flex gap-2">
          <dt className={textMuted}>When</dt>
          <dd>{dateLabel(item)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className={textMuted}>Where</dt>
          <dd>{modeLabel(item)}</dd>
        </div>
        {item.costNote ? (
          <div className="flex gap-2">
            <dt className={textMuted}>Cost</dt>
            <dd>{item.costNote}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-3 flex flex-wrap gap-x-4">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-[color:var(--clinical-accent)]"
        >
          Details
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">(opens the organiser&apos;s page in a new tab)</span>
        </a>
        <Link
          href={learningItemLogHref(item)}
          className="inline-flex min-h-tap items-center text-sm font-semibold text-[color:var(--clinical-accent)]"
        >
          Log as CPD
        </Link>
      </div>
    </li>
  );
}

/**
 * LEARNING — a curated list of upcoming WA courses and events. Past items drop
 * off by today's Perth date; items whose dates could not be confirmed sit in
 * their own section and never drop off. Public content: no signed-in data.
 */
export function CmeLearningPage({
  items,
  lastCheckedOn,
  nowIso,
}: {
  items: readonly LearningDirectoryItem[];
  lastCheckedOn: string;
  nowIso: string;
}) {
  const today = perthCalendarDate(new Date(nowIso));
  const upcoming = upcomingLearningItems(items, today);
  const unconfirmed = unconfirmedLearningItems(items);
  const stale = isDirectoryStale(lastCheckedOn, today);

  return (
    <main data-testid="cme-learning" className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[color:var(--text)]">Learning</h1>
      <p className={cn(textMuted, "mt-1 text-sm")}>
        Upcoming courses and events in Western Australia. Past events drop off on their own.
      </p>
      <p className={cn(textMuted, "mt-2 text-sm")}>
        This is a curated list, not an endorsement. Confirm dates, cost and CPD eligibility with the organiser.
      </p>
      <p className={cn(textMuted, "mt-2 text-sm")}>List last checked on {formatCalendarDateLong(lastCheckedOn)}.</p>
      {stale ? (
        <p
          data-testid="cme-learning-stale"
          className={cn(toneWarning, "mt-3 rounded-xl border p-3 text-sm font-medium")}
        >
          This list may be out of date. It was last checked more than {LEARNING_DIRECTORY_STALE_AFTER_DAYS} days ago, so
          check each organiser&apos;s page before planning around it.
        </p>
      ) : null}

      <section aria-labelledby="cme-learning-upcoming-heading" className="mt-6">
        <h2 id="cme-learning-upcoming-heading" className="text-base font-semibold text-[color:var(--text)]">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              testId="cme-learning-empty"
              title="No upcoming courses or events are listed right now."
              body="The list is checked about once a month, and past events are removed automatically."
            />
          </div>
        ) : (
          <ul className="mt-3 grid gap-3">
            {upcoming.map((item) => (
              <LearningItemCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      {unconfirmed.length > 0 ? (
        <section
          data-testid="cme-learning-unconfirmed"
          aria-labelledby="cme-learning-unconfirmed-heading"
          className="mt-8"
        >
          <h2 id="cme-learning-unconfirmed-heading" className="text-base font-semibold text-[color:var(--text)]">
            Dates to confirm
          </h2>
          <p className={cn(textMuted, "mt-1 text-sm")}>
            We couldn&apos;t confirm the date for these. Check the organiser&apos;s page before planning around them.
          </p>
          <ul className="mt-3 grid gap-3">
            {unconfirmed.map((item) => (
              <LearningItemCard key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
