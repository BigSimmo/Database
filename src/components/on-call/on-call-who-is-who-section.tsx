"use client";

import { Pencil, Users } from "lucide-react";

import { OnCallFreshnessBadge } from "@/components/on-call/on-call-freshness-badge";
import { OnCallVerifyButton } from "@/components/on-call/on-call-entry-editor";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { cardPadding, cardSurface } from "@/components/card-recipes";
import { cn, eyebrowText, textMuted, toolbarButton } from "@/components/ui-primitives";
import { onCallDetailsSchemaFor, onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";
import { partitionContactsEntries } from "@/lib/on-call/who-is-who";

export interface OnCallWhoIsWhoSectionProps {
  entries: readonly OnCallEntry[];
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: Date;
  testId?: string;
  /** Opens the editor pre-filled with this entry. Omit to hide the row's edit control. */
  onEditEntry?: (entry: OnCallEntry) => void;
  /** Handed a freshly-verified entry after a one-tap "still correct" confirm. Omit to hide it. */
  onVerified?: (entry: OnCallEntry) => void;
}

interface OnCallContactDetails {
  role: string;
  availability?: string;
}

function parseContactDetails(details: unknown): OnCallContactDetails | null {
  const result = onCallDetailsSchemaFor("contacts").safeParse(details);
  return result.success ? (result.data as OnCallContactDetails) : null;
}

const UNGROUPED_AREA = "Roles";

function areaFor(entry: OnCallEntry): string {
  const first = entry.tags[0]?.trim();
  return first && first.length > 0 ? first : UNGROUPED_AREA;
}

function slugifyArea(area: string): string {
  const slug = area
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "group";
}

/**
 * One role, explained.
 *
 * Deliberately NOT an `OnCallEntryRow`: that component makes the whole row a
 * `tel:` target, which is right for Contacts and wrong here. A role explainer
 * exists to be read — what this person does, and when it is reasonable to wake
 * them — and giving it a one-tap dial would turn "understand the ladder" into
 * "ring the consultant", which is the opposite of what it is for. The number to
 * ring lives on the Contacts row for the same role.
 */
function RoleCard({
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
  const details = parseContactDetails(entry.details);
  const freshness = onCallEntryFreshness(entry, now);
  const showVerify = freshness.state === "stale" && Boolean(onVerified);

  return (
    <article
      className={cn(cardSurface, cardPadding.standard, "grid grid-cols-[minmax(0,1fr)] gap-2")}
      data-testid={`on-call-role-${entry.slug}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 grid gap-0.5">
          <h4 className="text-base font-semibold text-[color:var(--text-heading)]">{entry.title}</h4>
          {details?.role && details.role !== entry.title ? (
            <p className={cn(textMuted, "text-xs")}>{details.role}</p>
          ) : null}
        </div>
        {onEditEntry || showVerify ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {showVerify && onVerified ? <OnCallVerifyButton entry={entry} onVerified={onVerified} /> : null}
            {onEditEntry ? (
              <button
                type="button"
                onClick={() => onEditEntry(entry)}
                aria-label={`Edit ${entry.title}`}
                data-testid={`on-call-role-edit-${entry.slug}`}
                className={cn(toolbarButton, "shrink-0")}
              >
                <Pencil aria-hidden className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* `body` is the owner's own words about the role. It is administrative
          fact — who does what, and when to call them — which AGENTS.md and the
          mode's clinical boundary both allow. Nothing here is app-authored. */}
      {entry.body ? <p className="text-sm leading-6 text-[color:var(--text)]">{entry.body}</p> : null}

      {entry.subtitle ? (
        <p className="text-sm text-[color:var(--text)]">
          <span className={cn(eyebrowText, "mr-1.5")}>When to call</span>
          {entry.subtitle}
        </p>
      ) : null}

      {details?.availability ? <p className={cn(textMuted, "text-xs")}>{details.availability}</p> : null}

      <OnCallFreshnessBadge freshness={freshness} />
    </article>
  );
}

/**
 * Who's who — what each role does and when to call them, the on-call ladder in
 * words, and the local acronyms.
 *
 * These are `contacts` rows carrying `details.kind: "role-explainer"`, so they
 * need no new section value and therefore no migration. `partitionContactsEntries`
 * is the one place they are separated from ordinary contacts.
 */
export function OnCallWhoIsWhoSection({
  entries,
  now = new Date(),
  testId = "on-call-who-is-who-section",
  onEditEntry,
  onVerified,
}: OnCallWhoIsWhoSectionProps) {
  const { roleExplainers } = partitionContactsEntries(entries);

  if (roleExplainers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No roles explained yet"
        body="What each role does, when it is reasonable to call them, and what the local acronyms mean. Add these as contacts and mark them as a role explainer."
        testId="on-call-who-is-who-empty"
      />
    );
  }

  const byArea = new Map<string, OnCallEntry[]>();
  for (const entry of roleExplainers) {
    const area = areaFor(entry);
    const existing = byArea.get(area);
    if (existing) existing.push(entry);
    else byArea.set(area, [entry]);
  }

  const groups = Array.from(byArea.entries())
    .map(([area, list]) => ({
      area,
      entries: [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.area.localeCompare(b.area));

  return (
    <div data-testid={testId} className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {groups.map((group) => {
        const slug = slugifyArea(group.area);
        const headingId = `on-call-who-is-who-${slug}-heading`;
        return (
          <section key={group.area} aria-labelledby={headingId} className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <h3 id={headingId} className={eyebrowText}>
              {group.area}
            </h3>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2" data-testid={`on-call-who-is-who-group-${slug}`}>
              {group.entries.map((entry) => (
                <RoleCard key={entry.id} entry={entry} now={now} onEditEntry={onEditEntry} onVerified={onVerified} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
