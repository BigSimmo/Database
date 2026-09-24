"use client";

import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";

import { OnCallCopyNumber } from "@/components/on-call/on-call-copy-number";
import { onCallTelHref } from "@/lib/on-call/home-modules";

import { ClipboardList, FileText, ListChecks, Pencil, Phone, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cardInteractive, cardSurface } from "@/components/card-recipes";
import { OnCallEntryRow } from "@/components/on-call/on-call-entry-row";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { OnCallStaleFlag } from "@/components/on-call/on-call-freshness-badge";
import { onCallGroupAnchorId } from "@/components/on-call/on-call-page-anchors";
import { OnCallVerifyButton } from "@/components/on-call/on-call-entry-editor";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { cn, eyebrowText, textMuted, toolbarButton } from "@/components/ui-primitives";
import {
  onCallDetailsSchemaFor,
  onCallEntryFreshness,
  type OnCallEntry,
  type OnCallLinkedDocument,
  onCallEntryIsEditable,
} from "@/lib/on-call/entry-model";
import { playbookFormReferences } from "@/lib/on-call/playbook-forms";
import { recordOnCallRecent } from "@/lib/on-call/recent-storage";
import { formatClinicalDate } from "@/lib/source-metadata";

export interface OnCallPlaybookSectionProps {
  entries: readonly OnCallEntry[];
  /**
   * The owner's own uploaded documents that `linkedDocumentIds` may point at,
   * keyed by id. Resolving ids to a title and date is the caller's job (this
   * component stays pure and prop-driven, matching every other On Call
   * section) — an id with no matching entry here is treated exactly like an
   * id that was never linked, which is what keeps a broken or stale link from
   * silently promoting a scenario to "has guidance" when it does not.
   */
  documents?: Readonly<Record<string, OnCallLinkedDocument>>;
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: Date;
  testId?: string;
  /** Opens the entry editor for this row. Omitted when the viewer cannot edit. */
  onEditEntry?: (entry: OnCallEntry) => void;
  /** One-tap "still correct today"; shown only on a stale entry. */
  onVerified?: (entry: OnCallEntry) => void;
}

/** The one fact the Playbook may state about a linked document: its title and date. */
// Re-exported so the existing import sites keep working; the declaration lives
// in the domain layer (see `src/lib/on-call/entry-model.ts`).
export type { OnCallLinkedDocument };

interface OnCallPlaybookDetails {
  trigger: string;
  escalationSteps: readonly { order: number; whoToCall: string; when: string; phone?: string }[];
}

function parsePlaybookDetails(details: unknown): OnCallPlaybookDetails | null {
  const result = onCallDetailsSchemaFor("playbook").safeParse(details);
  return result.success ? (result.data as OnCallPlaybookDetails) : null;
}

/** One tappable row inside a card — a linked guideline, or a referenced form. */
const linkRow = cn(cardInteractive, "flex min-h-tap w-full items-center gap-3 rounded-lg p-3 text-left");

function LinkedGuidance({
  linkedDocumentIds,
  documents,
  slug,
}: {
  linkedDocumentIds: readonly string[];
  documents: Readonly<Record<string, OnCallLinkedDocument>>;
  slug: string;
}) {
  const resolved = linkedDocumentIds
    .map((id) => documents[id])
    .filter((doc): doc is OnCallLinkedDocument => Boolean(doc));

  if (resolved.length === 0) {
    // THE PLAYBOOK RULE: no local guideline means no substitute guidance of any
    // kind — never a generated step, a dose, a threshold, or a "typically you
    // would…" sentence. State the gap plainly and point at the one place a real
    // answer can come from: the owner's own document library.
    return (
      <EmptyState
        icon={Search}
        title={linkedDocumentIds.length ? "Linked guideline unavailable" : "No local guideline linked"}
        body={
          linkedDocumentIds.length
            ? "The linked source has not loaded. It may be offline, removed, or unavailable to your account. This page does not substitute clinical advice."
            : "This scenario has no linked guideline in your document library. Search your documents to find and link one — this page never substitutes its own clinical advice."
        }
        actions={
          <Link
            href="/documents/search"
            className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
          >
            Search documents
          </Link>
        }
        testId={`on-call-playbook-no-guideline-${slug}`}
      />
    );
  }

  return (
    <div className="grid gap-2" data-testid={`on-call-playbook-guidance-${slug}`}>
      {resolved.map((doc) => (
        <Link key={doc.id} href={`/documents/${doc.id}`} className={linkRow}>
          <FileText className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[color:var(--text)]">{doc.title}</span>
            <span className={cn("block truncate text-xs", textMuted)}>{formatClinicalDate(doc.date)}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/**
 * The official forms this scenario names.
 *
 * Renders nothing when the owner named none. There is deliberately no empty
 * state here and no "find a form" prompt: an absent form reference is not a gap
 * to fill, and a suggestion box under an escalation ladder would read as the app
 * proposing a statutory form of its own. Which form applies is a legal judgement
 * this page does not make — see `src/lib/on-call/playbook-forms.ts`.
 */
function ReferencedForms({ entry }: { entry: OnCallEntry }) {
  const forms = playbookFormReferences(entry);
  if (forms.length === 0) return null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2" data-testid={`on-call-playbook-forms-${entry.slug}`}>
      <h4 className={eyebrowText}>Forms referenced</h4>
      {/* Says whose words the titles are. The code below is the owner's — they
          typed it into this scenario — but the title beside it is the Office of
          the Chief Psychiatrist's register, not a description the app or the
          owner wrote. */}
      <p className={cn("text-xs", textMuted)}>
        Official Western Australian Mental Health Act 2014 forms named in this scenario. Titles come from the Chief
        Psychiatrist&rsquo;s register.
      </p>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {forms.map((form) => (
          <li key={form.code}>
            <Link
              href={form.href}
              className={linkRow}
              data-testid={`on-call-playbook-form-${entry.slug}-${formTestIdPart(form.code)}`}
            >
              <ClipboardList className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[color:var(--text)]">Form {form.code}</span>
                {/* Never truncated: a clipped statutory title ("Order that
                    person cannot continue to be&hellip;") can read as the
                    opposite of what the form does. It wraps instead, which is
                    what keeps this legible at 320px. */}
                <span className={cn("block text-xs", textMuted)}>{form.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A form code as a testid-safe fragment: `6B attachment` -> `6b-attachment`. */
function formTestIdPart(code: string) {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function PlaybookCard({
  entry,
  documents,
  now,
  onEditEntry,
  onVerified,
}: {
  entry: OnCallEntry;
  documents: Readonly<Record<string, OnCallLinkedDocument>>;
  now: Date;
  onEditEntry?: (entry: OnCallEntry) => void;
  onVerified?: (entry: OnCallEntry) => void;
}) {
  const details = parsePlaybookDetails(entry.details);
  const freshness = onCallEntryFreshness(entry, now);
  const steps = details ? [...details.escalationSteps].sort((a, b) => a.order - b.order) : [];
  const showVerify = freshness.state === "stale" && Boolean(onVerified);

  return (
    <article
      id={onCallEntryAnchorId(entry.id)}
      tabIndex={-1}
      // The shared recipe, not a hand-rolled copy of it: these three had every
      // class right except `forced-colors:border`, so in Windows High Contrast
      // the card edge disappeared.
      className={cn(cardSurface, "grid grid-cols-[minmax(0,1fr)] gap-3 p-4")}
      data-testid={`on-call-playbook-card-${entry.slug}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-[color:var(--text)]">{entry.title}</h3>
          {details?.trigger ? <p className={cn("mt-0.5 text-xs", textMuted)}>{details.trigger}</p> : null}
        </div>
        {/* Sibling to the card, never nested inside a link: the escalation
            steps below are individually `tel:` rows, and a `<button>` inside
            an `<a>` is invalid, duplicate-interactive markup — this header is
            not itself a link, but the same edit/verify controls stay a
            sibling of the row content for consistency with every other
            section. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <OnCallStaleFlag freshness={freshness} />
          {showVerify && onVerified ? <OnCallVerifyButton entry={entry} onVerified={onVerified} /> : null}
          {onEditEntry ? (
            <button
              type="button"
              onClick={() => onEditEntry(entry)}
              aria-label={`Edit ${entry.title}`}
              data-testid={`on-call-playbook-edit-${entry.slug}`}
              className={cn(toolbarButton, "shrink-0")}
            >
              <Pencil aria-hidden className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <h4 className={eyebrowText}>Escalation steps</h4>
        {steps.length > 0 ? (
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {steps.map((step) => (
              <li key={step.order} className="flex min-w-0 items-start gap-2">
                <OnCallEntryRow
                  icon={onCallTelHref(step.phone) ? Phone : undefined}
                  title={`${step.order}. ${step.whoToCall}`}
                  subtitle={step.when}
                  href={onCallTelHref(step.phone)}
                  onActivate={() => recordOnCallRecent({ id: entry.id, title: entry.title })}
                  testId={`on-call-playbook-step-${entry.slug}-${step.order}`}
                >
                  {step.phone ? (
                    <span className="break-words text-xs">
                      {onCallTelHref(step.phone)
                        ? step.phone
                        : `Recorded number: ${step.phone} — use the hospital phone or switchboard`}
                    </span>
                  ) : null}
                </OnCallEntryRow>
                {step.phone ? (
                  <OnCallCopyNumber value={step.phone} label={`Copy number for ${step.whoToCall}`} />
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className={cn("text-sm", textMuted)}>No escalation steps recorded yet.</p>
        )}
      </div>

      <ReferencedForms entry={entry} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <h4 className={eyebrowText}>Local guidance</h4>
        <LinkedGuidance linkedDocumentIds={entry.linkedDocumentIds} documents={documents} slug={entry.slug} />
      </div>
    </article>
  );
}

/**
 * The Playbook section: scenario cards opening onto an escalation ladder plus
 * links to the owner's own guideline documents. THE PLAYBOOK RULE governs
 * every line this component renders in its own voice — it is limited to the
 * administrative facts on `details` (`trigger`, `escalationSteps`) and never
 * states a clinical step, a dose, or a threshold. Clinical content reaches the
 * reader only as a link to a document already in their corpus, shown with
 * that document's own title and date.
 */
export function OnCallPlaybookSection({
  entries,
  documents = {},
  now = new Date(),
  testId = "on-call-playbook-section",
  onEditEntry,
  onVerified,
}: OnCallPlaybookSectionProps) {
  const playbookEntries = entries.filter((entry) => entry.section === "playbook");

  if (playbookEntries.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No playbook scenarios yet"
        body="Escalation scenarios you add will appear here as cards, each linking to your own guideline documents."
        testId="on-call-playbook-empty"
      />
    );
  }

  const sorted = [...playbookEntries].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  // The drawing collects the scenarios with nothing linked into their own
  // group at the foot. Not cosmetic: a scenario whose local guideline is
  // missing is the one an owner needs to see and fix, and left in place among
  // the complete ones it is invisible until someone happens to scroll past it.
  const linked = sorted.filter((entry) => hasResolvedGuidance(entry, documents));
  const unlinked = sorted.filter((entry) => !hasResolvedGuidance(entry, documents));

  const card = (entry: OnCallEntry) => (
    <PlaybookCard
      key={entry.id}
      entry={entry}
      documents={documents}
      now={now}
      onEditEntry={onCallEntryIsEditable(entry) ? onEditEntry : undefined}
      onVerified={onCallEntryIsEditable(entry) ? onVerified : undefined}
    />
  );

  return (
    <div data-testid={testId} className="grid gap-5">
      {/* Two groups or one flat list, and the headings only exist in the first
          case. A single heading over the whole page is furniture — the same
          rule `onCallEntryGroups` applies everywhere else in this mode, and the
          same one that decides whether the header shows a bar at all. Demo mode
          is exactly that case: with no linked guidelines, "Unlinked 2" over
          everything said less than each card's own empty state already does.

          The anchors and testids survive either way: they are what the header's
          jump list targets and what the board ledger cites as proof. */}
      {linked.length > 0 ? (
        <PlaybookGroup slug="scenarios" label="Scenarios" count={linked.length}>
          {linked.map(card)}
        </PlaybookGroup>
      ) : null}

      {unlinked.length > 0 ? (
        <PlaybookGroup
          slug="no-guideline"
          // "Unlinked", matching the word the header's bar shows. The full
          // sentence lived here while there was no bar; with one above naming
          // this group in one word, two names for one destination is the
          // confusion, not the brevity. Each card still says what is missing.
          label="Unlinked"
          count={unlinked.length}
          headed={linked.length > 0}
        >
          {unlinked.map(card)}
        </PlaybookGroup>
      ) : null}
    </div>
  );
}

/**
 * One playbook group: the cards, with a heading only when there is another
 * group to tell it apart from.
 *
 * The anchor and the testid are unconditional. The anchor is what the header's
 * jump list targets, and `docs/on-call/design/mockup-conformance.md` cites the
 * testid as proof board 07's group is built — neither may come and go with the
 * data.
 */
function PlaybookGroup({
  slug,
  label,
  count,
  headed = true,
  children,
}: {
  slug: string;
  label: string;
  count: number;
  headed?: boolean;
  children: ReactNode;
}) {
  const headingId = `on-call-playbook-${slug}-heading`;
  return (
    <section
      id={onCallGroupAnchorId(slug)}
      aria-labelledby={headed ? headingId : undefined}
      aria-label={headed ? undefined : label}
      className={cn(inPageAnchor, "grid gap-2")}
    >
      {headed ? (
        <div className="flex items-center gap-1.5">
          <h3 id={headingId} className={eyebrowText}>
            {label}
          </h3>
          {/* Outside the heading and hidden: the count is a glance, not part
              of the group's name. */}
          <span aria-hidden="true" className="nums text-2xs font-bold text-[color:var(--text-muted)]">
            {count}
          </span>
        </div>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3" data-testid={`on-call-playbook-group-${slug}`}>
        {children}
      </div>
    </section>
  );
}

/**
 * Whether a scenario has at least one guideline document this reader can
 * actually open.
 *
 * Resolution, not the raw id list: a scenario can name a document that was
 * deleted, or that this reader cannot see. `LinkedGuidance` already drops
 * those, so grouping on the ids alone would file a scenario as complete while
 * its card shows the "no local guideline linked" empty state.
 */
function hasResolvedGuidance(entry: OnCallEntry, documents: Readonly<Record<string, OnCallLinkedDocument>>): boolean {
  return entry.linkedDocumentIds.some((id) => Boolean(documents[id]));
}
