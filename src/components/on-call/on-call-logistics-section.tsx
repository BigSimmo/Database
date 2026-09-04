"use client";

import { MapPinned, Pencil, Phone } from "lucide-react";

import { OnCallEntryRow } from "@/components/on-call/on-call-entry-row";
import { OnCallFreshnessBadge } from "@/components/on-call/on-call-freshness-badge";
import { OnCallVerifyButton } from "@/components/on-call/on-call-entry-editor";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { ExternalTextLink } from "@/components/ui/link";
import { cn, eyebrowText, metadataPillDensity, toolbarButton } from "@/components/ui-primitives";
import { onCallDetailsSchemaFor, onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";

export interface OnCallLogisticsSectionProps {
  entries: readonly OnCallEntry[];
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: Date;
  testId?: string;
  /** Opens the entry editor for this row. Omitted when the viewer cannot edit. */
  onEditEntry?: (entry: OnCallEntry) => void;
  /** One-tap "still correct today"; shown only on a stale entry. */
  onVerified?: (entry: OnCallEntry) => void;
}

interface OnCallLogisticsDetails {
  category: string;
  location?: string;
  hours?: string;
  phone?: string;
  url?: string;
}

const UNGROUPED_CATEGORY = "General";

function parseLogisticsDetails(details: unknown): OnCallLogisticsDetails | null {
  const result = onCallDetailsSchemaFor("logistics").safeParse(details);
  return result.success ? (result.data as OnCallLogisticsDetails) : null;
}

function telHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const compact = raw.replace(/[^\d+]/g, "");
  return compact.length > 0 ? `tel:${compact}` : undefined;
}

function logisticsCategoryFor(entry: OnCallEntry): string {
  const details = parseLogisticsDetails(entry.details);
  return details?.category ?? UNGROUPED_CATEGORY;
}

function slugifyCategory(category: string): string {
  const slug = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "group";
}

function LogisticsRow({
  entry,
  now,
  onEditEntry,
  onVerified,
}: {
  entry: OnCallEntry;
  now: Date;
  onEditEntry?: (entry: OnCallEntry) => void;
  onVerified?: (entry: OnCallEntry) => void;
}) {
  const details = parseLogisticsDetails(entry.details);
  const freshness = onCallEntryFreshness(entry, now);
  const href = telHref(details?.phone);
  const showVerify = freshness.state === "stale" && Boolean(onVerified);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          <OnCallEntryRow
            icon={href ? Phone : MapPinned}
            title={entry.title}
            subtitle={details?.location}
            href={href}
            testId={`on-call-logistics-row-${entry.slug}`}
          >
            {details?.hours ? (
              <span className={cn(metadataPillDensity.standard, "rounded-full")}>{details.hours}</span>
            ) : null}
            {details?.phone && !href ? (
              <span className={cn(metadataPillDensity.standard, "rounded-full")}>{details.phone}</span>
            ) : null}
            <OnCallFreshnessBadge freshness={freshness} />
          </OnCallEntryRow>
        </div>
        {/* Sibling to the row, never nested inside it: the row above can
            itself be a `tel:` link, and a `<button>` inside an `<a>` is
            invalid, duplicate-interactive markup. */}
        {onEditEntry || showVerify ? (
          <div className="flex shrink-0 flex-col items-stretch justify-center gap-1.5">
            {showVerify && onVerified ? <OnCallVerifyButton entry={entry} onVerified={onVerified} /> : null}
            {onEditEntry ? (
              <button
                type="button"
                onClick={() => onEditEntry(entry)}
                aria-label={`Edit ${entry.title}`}
                data-testid={`on-call-logistics-edit-${entry.slug}`}
                className={cn(toolbarButton, "shrink-0")}
              >
                <Pencil aria-hidden className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {details?.url ? (
        // Rendered as a sibling, never nested inside the row above: when the
        // row itself is a `tel:` anchor, an interactive link inside it would
        // be invalid markup (an anchor inside an anchor) and unreachable by
        // keyboard in a predictable order.
        <ExternalTextLink href={details.url} className="ml-1 text-xs">
          More info
        </ExternalTextLink>
      ) : null}
    </div>
  );
}

/**
 * The Logistics section: the plainest On Call page (spec §8.4) — grouped
 * rows, each naming a place, an hour range, or a number. Grouped by
 * `details.category`, which the schema requires on every entry, so the
 * grouping key can never be missing the way Contacts' `tags`-derived area can.
 */
export function OnCallLogisticsSection({
  entries,
  now = new Date(),
  testId = "on-call-logistics-section",
  onEditEntry,
  onVerified,
}: OnCallLogisticsSectionProps) {
  const logisticsEntries = entries.filter((entry) => entry.section === "logistics");

  if (logisticsEntries.length === 0) {
    return (
      <EmptyState
        icon={MapPinned}
        title="No logistics notes yet"
        body="Parking, food, call rooms, IT, rostering, payroll and leave will appear here, grouped by category."
        testId="on-call-logistics-empty"
      />
    );
  }

  const byCategory = new Map<string, OnCallEntry[]>();
  for (const entry of logisticsEntries) {
    const category = logisticsCategoryFor(entry);
    const existing = byCategory.get(category);
    if (existing) existing.push(entry);
    else byCategory.set(category, [entry]);
  }

  const sortEntries = (list: OnCallEntry[]) =>
    [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  const groups = Array.from(byCategory.entries())
    .map(([category, list]) => ({ category, entries: sortEntries(list) }))
    .sort((a, b) => a.category.localeCompare(b.category));

  return (
    <div data-testid={testId} className="grid gap-5">
      {groups.map((group) => {
        const slug = slugifyCategory(group.category);
        const headingId = `on-call-logistics-category-${slug}-heading`;
        return (
          <section key={group.category} aria-labelledby={headingId} className="grid gap-2">
            <h3 id={headingId} className={eyebrowText}>
              {group.category}
            </h3>
            <div className="grid gap-2" data-testid={`on-call-logistics-group-${slug}`}>
              {group.entries.map((entry) => (
                <LogisticsRow
                  key={entry.id}
                  entry={entry}
                  now={now}
                  onEditEntry={onEditEntry}
                  onVerified={onVerified}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
