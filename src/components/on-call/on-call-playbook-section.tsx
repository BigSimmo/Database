"use client";

import { FileText, ListChecks, Phone, Search } from "lucide-react";
import Link from "next/link";

import { cardInteractive } from "@/components/card-recipes";
import { OnCallEntryRow } from "@/components/on-call/on-call-entry-row";
import { OnCallFreshnessBadge } from "@/components/on-call/on-call-freshness-badge";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { onCallDetailsSchemaFor, onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";
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
}

/** The one fact the Playbook may state about a linked document: its title and date. */
export interface OnCallLinkedDocument {
  id: string;
  title: string;
  /** ISO date string (publication or review date, whichever the caller prefers to surface), or null if unknown. */
  date: string | null;
}

interface OnCallPlaybookDetails {
  trigger: string;
  escalationSteps: readonly { order: number; whoToCall: string; when: string; phone?: string }[];
}

function parsePlaybookDetails(details: unknown): OnCallPlaybookDetails | null {
  const result = onCallDetailsSchemaFor("playbook").safeParse(details);
  return result.success ? (result.data as OnCallPlaybookDetails) : null;
}

function telHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const compact = raw.replace(/[^\d+]/g, "");
  return compact.length > 0 ? `tel:${compact}` : undefined;
}

const documentLinkRow = cn(cardInteractive, "flex min-h-tap w-full items-center gap-3 rounded-lg p-3 text-left");

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
        title="No local guideline linked"
        body="This scenario has no linked guideline in your document library. Search your documents to find and link one — this page never substitutes its own clinical advice."
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
        <Link key={doc.id} href={`/documents/${doc.id}`} className={documentLinkRow}>
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

function PlaybookCard({
  entry,
  documents,
  now,
}: {
  entry: OnCallEntry;
  documents: Readonly<Record<string, OnCallLinkedDocument>>;
  now: Date;
}) {
  const details = parsePlaybookDetails(entry.details);
  const freshness = onCallEntryFreshness(entry, now);
  const steps = details ? [...details.escalationSteps].sort((a, b) => a.order - b.order) : [];

  return (
    <article
      className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--e1)]"
      data-testid={`on-call-playbook-card-${entry.slug}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[color:var(--text)]">{entry.title}</h3>
          {details?.trigger ? <p className={cn("mt-0.5 text-xs", textMuted)}>{details.trigger}</p> : null}
        </div>
        <OnCallFreshnessBadge freshness={freshness} />
      </header>

      <div className="grid gap-2">
        <h4 className={eyebrowText}>Escalation steps</h4>
        {steps.length > 0 ? (
          <ol className="grid gap-2">
            {steps.map((step) => (
              <li key={step.order}>
                <OnCallEntryRow
                  icon={Phone}
                  title={`${step.order}. ${step.whoToCall}`}
                  subtitle={step.when}
                  href={telHref(step.phone)}
                  testId={`on-call-playbook-step-${entry.slug}-${step.order}`}
                />
              </li>
            ))}
          </ol>
        ) : (
          <p className={cn("text-sm", textMuted)}>No escalation steps recorded yet.</p>
        )}
      </div>

      <div className="grid gap-2">
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

  return (
    <div data-testid={testId} className="grid gap-3">
      {sorted.map((entry) => (
        <PlaybookCard key={entry.id} entry={entry} documents={documents} now={now} />
      ))}
    </div>
  );
}
