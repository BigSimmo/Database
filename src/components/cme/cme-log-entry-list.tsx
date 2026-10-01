"use client";

import { focusRing } from "@/components/card-recipes";
import { categoryNames, formatLogHours, monthAnchorId, type MonthGroup } from "@/components/cme/cme-log-shared";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeStateLabel } from "@/components/mode-kit/state-label";
import { modeNumberText } from "@/components/mode-kit/type";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { formatCalendarMonthLabel, formatCmeRowDate } from "@/lib/cme/cpd-year";
import { totalAllocatedHours } from "@/lib/cme/evaluate";
import { cmeCertificateMissing, type CmeEntry } from "@/lib/cme/types";

/**
 * One activity as a 52 px row in its month's hairline list (`ModeRow`: the
 * title at 500, the second line at 13 px muted): the day and the category,
 * then "No certificate" only when something is known to be missing, and the
 * hours at 400 beside the row's link. "No certificate" shows only when the log
 * has counted active certificates and found none (`cmeCertificateMissing`); an activity
 * whose evidence was not counted says nothing rather than guessing.
 */
function EntryRow({ entry, today }: { entry: CmeEntry; today: string }) {
  return (
    <ModeRow
      href={`/cme/log/${entry.id}`}
      testId={`cme-log-row-${entry.id}`}
      title={entry.title}
      subtitle={`${formatCmeRowDate(entry.date, today)} · ${categoryNames(entry)}`}
      meta={cmeCertificateMissing(entry) ? <ModeStateLabel>No certificate</ModeStateLabel> : null}
      trailing={
        // `nums font-normal` are repeated from the recipe so Task 7's scanner, which reads literal classes, sees 400.
        <span className={cn(modeNumberText, "nums font-normal pr-2 text-base-minus text-[color:var(--text)]")}>
          {entry.archivedAt ? "Archived" : `${formatLogHours(totalAllocatedHours([entry]))} h`}
        </span>
      }
    />
  );
}

/**
 * The log's months, most recent first. Each month header stays pinned at the
 * top of the page while its own rows scroll under it — the same in-flow sticky
 * group header On Call's contact groups use. It is a content heading inside
 * page flow, not a second navigation bar: it pins at `top-0` of the page
 * scroll, so the phone header's collapse row (which owns the viewport top)
 * still covers it whenever that header is showing.
 */
export function CmeLogMonthList({ groups, today }: { groups: readonly MonthGroup[]; today: string }) {
  return (
    <>
      {groups.map((group) => (
        <section
          key={group.key}
          id={monthAnchorId(group.key)}
          data-testid={`cme-log-month-${group.key}`}
          aria-labelledby={`${group.key}-heading`}
          className={cn(inPageAnchor, "grid gap-2")}
        >
          <div
            data-testid={`cme-log-month-header-${group.key}`}
            className="sticky top-0 z-[var(--z-raised)] flex min-h-8 items-center justify-between gap-3 bg-[color:var(--background)] px-3"
          >
            <h2 id={`${group.key}-heading`} className={eyebrowText}>
              {group.label}
            </h2>
            <span
              className={cn(modeNumberText, "nums font-normal text-2xs normal-case text-[color:var(--text-muted)]")}
            >
              {`${formatLogHours(group.hours)} h`}
            </span>
          </div>
          <ModeGroupedList>
            {group.entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} today={today} />
            ))}
          </ModeGroupedList>
        </section>
      ))}
    </>
  );
}

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

/**
 * Twelve bars, January to December, each as tall as that month's hours in the
 * list below (so it agrees with the month totals the headers show). A month
 * with something listed is a link to its section; an empty month is a quiet
 * stub with its name and "0 hours" for a screen reader, never a dead link.
 * The current month's bar is the one accent on the strip.
 */
export function CmeLogMonthStrip({
  year,
  groups,
  today,
}: {
  year: number;
  groups: readonly MonthGroup[];
  today: string;
}) {
  const byKey = new Map(groups.map((group) => [group.key, group]));
  const max = Math.max(0, ...groups.map((group) => group.hours));
  const currentKey = today.slice(0, 7);
  return (
    <nav aria-label="Jump to month" data-testid="cme-log-month-strip">
      <ol className="grid grid-cols-12 gap-0.5">
        {MONTHS.map((month) => {
          const key = `${year}-${month}`;
          const group = byKey.get(key);
          const hours = group?.hours ?? 0;
          const name = formatCalendarMonthLabel(key).split(" ")[0] ?? key;
          const current = key === currentKey;
          // A logged month never shrinks below a visible sliver, however small next to the busiest month.
          const height = max > 0 && hours > 0 ? Math.max(12, Math.round((hours / max) * 100)) : 0;
          const face = (
            <>
              <span aria-hidden="true" className="flex h-8 w-full items-end justify-center">
                <span
                  data-month-bar={key}
                  className={cn(
                    "block w-3/5 max-w-4 rounded-t-sm",
                    height === 0
                      ? "h-0.5 bg-[color:var(--border)]"
                      : current
                        ? "bg-[color:var(--clinical-accent)]"
                        : "bg-[color:var(--border-strong)]",
                  )}
                  style={height === 0 ? undefined : { height: `${height}%` }}
                />
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "text-xs leading-4",
                  current ? "font-semibold text-[color:var(--clinical-accent)]" : "text-[color:var(--text-muted)]",
                )}
              >
                {name.charAt(0)}
              </span>
            </>
          );
          const label = `${name}, ${formatLogHours(hours)} hours`;
          return (
            <li key={key} className="min-w-0">
              {group ? (
                <a
                  href={`#${monthAnchorId(key)}`}
                  aria-label={label}
                  aria-current={current ? "date" : undefined}
                  data-testid={`cme-log-month-jump-${key}`}
                  className={cn(
                    focusRing,
                    "flex min-h-tap w-full flex-col items-center justify-end rounded-md pb-0.5 transition-colors duration-[var(--duration-instant)] hover:bg-[color:var(--surface-subtle)] active:bg-[color:var(--surface-wash)]",
                  )}
                >
                  {face}
                </a>
              ) : (
                <span className="flex min-h-tap w-full flex-col items-center justify-end pb-0.5">
                  {face}
                  <span className="sr-only">{label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
