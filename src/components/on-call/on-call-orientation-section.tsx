"use client";

import { BookOpen, FileText, User } from "lucide-react";
import Link from "next/link";

import { cardInteractive } from "@/components/card-recipes";
import { OnCallFreshnessBadge } from "@/components/on-call/on-call-freshness-badge";
import type { OnCallLinkedDocument } from "@/components/on-call/on-call-playbook-section";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";
import { formatClinicalDate } from "@/lib/source-metadata";

export interface OnCallOrientationSectionProps {
  entries: readonly OnCallEntry[];
  /** The owner's own documents that `linkedDocumentIds` may point at, keyed by id. */
  documents?: Readonly<Record<string, OnCallLinkedDocument>>;
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: Date;
  testId?: string;
}

const documentLinkRow = cn(cardInteractive, "flex min-h-tap w-full items-center gap-3 rounded-lg p-3 text-left");

function OrientationCard({
  entry,
  documents,
  now,
}: {
  entry: OnCallEntry;
  documents: Readonly<Record<string, OnCallLinkedDocument>>;
  now: Date;
}) {
  const freshness = onCallEntryFreshness(entry, now);
  const linkedDocs = entry.linkedDocumentIds
    .map((id) => documents[id])
    .filter((doc): doc is OnCallLinkedDocument => Boolean(doc));

  return (
    <article
      className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--e1)]"
      data-testid={`on-call-orientation-card-${entry.slug}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[color:var(--text)]">{entry.title}</h3>
          {entry.subtitle ? <p className={cn("mt-0.5 text-xs", textMuted)}>{entry.subtitle}</p> : null}
        </div>
        <OnCallFreshnessBadge freshness={freshness} />
      </header>

      {entry.body ? (
        // The pinned summary sits ABOVE the document link, inside a bordered
        // note, always visibly attributed to the owner — spec §7.4: it must
        // never read as the manual's own words. `pinnedSummaryIsOwnerNote` on
        // `details` exists purely so this attribution can never be forgotten;
        // the flag itself carries no other information.
        <div
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3"
          data-testid={`on-call-orientation-note-${entry.slug}`}
        >
          <p className={cn(eyebrowText, "mb-1 flex items-center gap-1.5")}>
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Your note
          </p>
          <p className="text-sm text-[color:var(--text)]">{entry.body}</p>
        </div>
      ) : null}

      {linkedDocs.length > 0 ? (
        <div className="grid gap-2">
          {linkedDocs.map((doc) => (
            <Link key={doc.id} href={`/documents/${doc.id}`} className={documentLinkRow}>
              <FileText className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[color:var(--text)]">{doc.title}</span>
                <span className={cn("block truncate text-xs", textMuted)}>{formatClinicalDate(doc.date)}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className={cn("text-sm", textMuted)}>No document linked yet.</p>
      )}
    </article>
  );
}

/**
 * The Orientation section: a shelf of manuals. The uploaded document stays
 * the source of truth (spec §2) — this component never retypes manual
 * content. Where the owner has pinned a short summary, it renders above the
 * document link inside a bordered note that is always labelled "Your note",
 * so it can never be mistaken for the manual's own words.
 */
export function OnCallOrientationSection({
  entries,
  documents = {},
  now = new Date(),
  testId = "on-call-orientation-section",
}: OnCallOrientationSectionProps) {
  const orientationEntries = entries.filter((entry) => entry.section === "orientation");

  if (orientationEntries.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No orientation manuals yet"
        body="Manuals you add will appear here as a shelf, each optionally carrying your own pinned summary above it."
        testId="on-call-orientation-empty"
      />
    );
  }

  const sorted = [...orientationEntries].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  return (
    <div data-testid={testId} className="grid gap-3">
      {sorted.map((entry) => (
        <OrientationCard key={entry.id} entry={entry} documents={documents} now={now} />
      ))}
    </div>
  );
}
