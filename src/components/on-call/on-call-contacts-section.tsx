"use client";

import Link from "next/link";
import { Pencil, Phone, Plus, Printer } from "lucide-react";
import { useState } from "react";

import { OnCallEntryRow } from "@/components/on-call/on-call-entry-row";
import { OnCallFreshnessBadge } from "@/components/on-call/on-call-freshness-badge";
import { OnCallVerifyButton } from "@/components/on-call/on-call-entry-editor";
import { Button } from "@/components/ui/button";
import { OnCallCallDisc } from "@/components/on-call/on-call-call-disc";
import { OnCallFilterChips } from "@/components/on-call/on-call-filter-chips";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { eyebrowText, metadataPillDensity, toolbarButton } from "@/components/ui-primitives";
import { cn } from "@/components/ui-primitives";
import { onCallDetailsSchemaFor, onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";
import {
  ON_CALL_FILTER_ALL,
  onCallEntryMatchesFilter,
  onCallFilterOptions,
  type OnCallFacetReader,
} from "@/lib/on-call/entry-filters";
import { partitionContactsEntries } from "@/lib/on-call/who-is-who";

export interface OnCallContactsSectionProps {
  entries: readonly OnCallEntry[];
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: Date;
  testId?: string;
  /** Opens the editor in create mode. Omit to hide "Add contact" (e.g. read-only previews). */
  onAddEntry?: () => void;
  /** Opens the editor pre-filled with this entry. Omit to hide the row's edit control. */
  onEditEntry?: (entry: OnCallEntry) => void;
  /** Handed a freshly-verified entry after a one-tap "still correct" confirm. Omit to hide it. */
  onVerified?: (entry: OnCallEntry) => void;
}

interface OnCallContactDetails {
  role: string;
  phone?: string;
  extension?: string;
  afterHoursPhone?: string;
  pager?: string;
  contactName?: string;
  availability?: string;
}

/**
 * There is no dedicated `area` field on the contacts `details` schema (see
 * `src/lib/on-call/entry-model.ts`). `tags` is the categorisation field every
 * entry already carries, so the first tag is the area a role is filed under
 * — "Ward 4B", "ED" — and untagged entries fall into one shared group rather
 * than each becoming a group of one.
 */
const UNTAGGED_AREA = "General";
const NEEDS_CHECKING_HEADING = "Needs checking";

function contactAreaFor(entry: OnCallEntry): string {
  const first = entry.tags[0]?.trim();
  return first && first.length > 0 ? first : UNTAGGED_AREA;
}

/** The chip row filters on the same area the groups are headed by. */
const contactAreaFacet: OnCallFacetReader = (entry) => [contactAreaFor(entry)];

function parseContactDetails(details: unknown): OnCallContactDetails | null {
  const result = onCallDetailsSchemaFor("contacts").safeParse(details);
  return result.success ? (result.data as OnCallContactDetails) : null;
}

function telHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const compact = raw.replace(/[^\d+]/g, "");
  return compact.length > 0 ? `tel:${compact}` : undefined;
}

/** The one number the whole row rings. Direct beats after-hours beats pager. */
function primaryNumber(details: OnCallContactDetails): { label: string; value: string } | null {
  if (details.phone) return { label: "Direct", value: details.phone };
  if (details.afterHoursPhone) return { label: "After hours", value: details.afterHoursPhone };
  if (details.pager) return { label: "Pager", value: details.pager };
  return null;
}

function slugifyArea(area: string): string {
  const slug = area
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "group";
}

function ContactRow({
  entry,
  now,
  onEdit,
  onVerified,
}: {
  entry: OnCallEntry;
  now: Date;
  onEdit?: (entry: OnCallEntry) => void;
  onVerified?: (entry: OnCallEntry) => void;
}) {
  const details = parseContactDetails(entry.details);
  const freshness = onCallEntryFreshness(entry, now);
  const primary = details ? primaryNumber(details) : null;
  const href = telHref(primary?.value);

  const otherNumbers = details
    ? [
        details.phone && details.phone !== primary?.value ? `Direct ${details.phone}` : null,
        details.afterHoursPhone && details.afterHoursPhone !== primary?.value
          ? `After hours ${details.afterHoursPhone}`
          : null,
        details.pager && details.pager !== primary?.value ? `Pager ${details.pager}` : null,
        details.extension ? `Ext ${details.extension}` : null,
      ].filter((value): value is string => Boolean(value))
    : [];

  const showVerify = freshness.state === "stale" && Boolean(onVerified);

  return (
    <div className="flex items-stretch gap-2">
      <div className="min-w-0 flex-1">
        <OnCallEntryRow
          title={entry.title}
          subtitle={details?.contactName}
          icon={Phone}
          href={href}
          trailing={href ? <OnCallCallDisc /> : undefined}
          testId={`on-call-contact-row-${entry.slug}`}
        >
          {primary ? (
            <span className={cn(metadataPillDensity.standard, "gap-1.5 rounded-full")}>
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {`${primary.label}: ${primary.value}`}
            </span>
          ) : (
            <span className={cn(metadataPillDensity.standard, "rounded-full")}>No number on file</span>
          )}
          {otherNumbers.map((label) => (
            <span key={label} className={cn(metadataPillDensity.standard, "rounded-full")}>
              {label}
            </span>
          ))}
          {details?.availability ? (
            <span className={cn(metadataPillDensity.standard, "rounded-full")}>{details.availability}</span>
          ) : null}
          <OnCallFreshnessBadge freshness={freshness} />
        </OnCallEntryRow>
      </div>
      {/* Sibling to the row, never nested inside it: the row's own tap target is
          already a `tel:` link, and a `<button>` inside an `<a>` is invalid,
          duplicate-interactive markup. */}
      {onEdit || showVerify ? (
        <div className="flex shrink-0 flex-col items-stretch justify-center gap-1.5">
          {showVerify && onVerified ? <OnCallVerifyButton entry={entry} onVerified={onVerified} /> : null}
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(entry)}
              aria-label={`Edit ${entry.title}`}
              data-testid={`on-call-contact-edit-${entry.slug}`}
              className={cn(toolbarButton, "shrink-0")}
            >
              <Pencil aria-hidden className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The contacts section: one scrolling column of role rows, grouped by area,
 * with anything overdue for checking collected into its own group at the
 * TOP of the page rather than left to sort itself out at the bottom (spec
 * §8.4). This is the page built for one hand in a corridor at 2am — the
 * whole row rings the number, there is nothing smaller to aim for.
 */
export function OnCallContactsSection({
  entries,
  now = new Date(),
  testId = "on-call-contacts-section",
  onAddEntry,
  onEditEntry,
  onVerified,
}: OnCallContactsSectionProps) {
  // Role explainers share this section's rows but are not numbers to ring, so
  // they render on Who's who instead. Splitting here rather than at the page
  // keeps the two lists derived from one function
  // (`src/lib/on-call/who-is-who.ts`), so neither can drift into showing the
  // other's entries.
  const { contacts: allContacts } = partitionContactsEntries(entries);
  // The drawing's chip row. Areas are what Contacts already groups by, so the
  // chips and the group headings name the same thing rather than offering two
  // competing ways to cut the list.
  const filterOptions = onCallFilterOptions(allContacts, contactAreaFacet);
  const [activeFilter, setActiveFilter] = useState(ON_CALL_FILTER_ALL);
  const contactEntries = allContacts.filter((entry) => onCallEntryMatchesFilter(entry, contactAreaFacet, activeFilter));

  const addButton = onAddEntry ? (
    <Button variant="secondary" size="sm" icon={Plus} onClick={onAddEntry} testId="on-call-contacts-add">
      Add contact
    </Button>
  ) : undefined;

  const cardLink = (
    <Link
      href="/on-call/card"
      data-testid="on-call-contacts-card-link"
      className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)]"
    >
      <Printer className="h-4 w-4 shrink-0" aria-hidden />
      Printable card
    </Link>
  );

  if (allContacts.length === 0) {
    return (
      <EmptyState
        icon={Phone}
        title="No contacts yet"
        body="Contacts you add will appear here, grouped by area, with the whole row set up to ring the number."
        actions={
          // The card link belongs here too. It is the only route to
          // `/on-call/card`, and the card can already hold flagged playbook,
          // referral or logistics entries while Contacts is still empty —
          // dropping the link with the list stranded that page.
          <div className="flex flex-wrap items-center justify-center gap-2">
            {addButton}
            {cardLink}
          </div>
        }
        testId="on-call-contacts-empty"
      />
    );
  }

  const needsChecking: OnCallEntry[] = [];
  const byArea = new Map<string, OnCallEntry[]>();

  for (const entry of contactEntries) {
    if (onCallEntryFreshness(entry, now).state === "stale") {
      needsChecking.push(entry);
      continue;
    }
    const area = contactAreaFor(entry);
    const existing = byArea.get(area);
    if (existing) existing.push(entry);
    else byArea.set(area, [entry]);
  }

  const sortEntries = (list: OnCallEntry[]) =>
    [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  const areaGroups = Array.from(byArea.entries())
    .map(([area, list]) => ({ area, entries: sortEntries(list) }))
    .sort((a, b) => a.area.localeCompare(b.area));

  return (
    <div data-testid={testId} className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {cardLink}
        {addButton}
      </div>

      <OnCallFilterChips
        options={filterOptions}
        active={activeFilter}
        onChange={setActiveFilter}
        label="Filter contacts by area"
        testId="on-call-contacts-filters"
      />

      {needsChecking.length > 0 ? (
        <section aria-labelledby="on-call-contacts-needs-checking-heading" className="grid gap-2">
          <div
            className={cn(
              "sticky top-0 z-[var(--z-raised)] flex items-center gap-1.5 bg-[color:var(--background)] py-1",
            )}
          >
            <h3 id="on-call-contacts-needs-checking-heading" className={eyebrowText}>
              {NEEDS_CHECKING_HEADING}
            </h3>
            {/* Outside the heading, and hidden from assistive technology: the
                drawing puts a count beside each group, but folding it into the
                heading's accessible name turns "Needs checking" into "Needs
                checking 3", and the list underneath already carries its own
                length. */}
            <span aria-hidden="true" className="nums text-2xs font-bold text-[color:var(--text-muted)]">
              {needsChecking.length}
            </span>
          </div>
          <div className="grid gap-2" data-testid="on-call-contacts-group-needs-checking">
            {sortEntries(needsChecking).map((entry) => (
              <ContactRow key={entry.id} entry={entry} now={now} onEdit={onEditEntry} onVerified={onVerified} />
            ))}
          </div>
        </section>
      ) : null}

      {areaGroups.map((group) => {
        const slug = slugifyArea(group.area);
        const headingId = `on-call-contacts-area-${slug}-heading`;
        return (
          <section key={group.area} aria-labelledby={headingId} className="grid gap-2">
            <div className="sticky top-0 z-[var(--z-raised)] flex items-center gap-1.5 bg-[color:var(--background)] py-1">
              <h3 id={headingId} className={eyebrowText}>
                {group.area}
              </h3>
              <span aria-hidden="true" className="nums text-2xs font-bold text-[color:var(--text-muted)]">
                {group.entries.length}
              </span>
            </div>
            <div className="grid gap-2" data-testid={`on-call-contacts-group-${slug}`}>
              {group.entries.map((entry) => (
                <ContactRow key={entry.id} entry={entry} now={now} onEdit={onEditEntry} onVerified={onVerified} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
