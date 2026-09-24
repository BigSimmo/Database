"use client";

import { ChevronLeft, FileQuestion, Pencil, Repeat } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { cardSurface } from "@/components/card-recipes";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MissingValue } from "@/components/ui/missing-value";
import { cn, EmptyState, eyebrowText, textMuted } from "@/components/ui-primitives";
import { formatEntryForCpdHome } from "@/lib/cme/clipboard";
import { formatCalendarDateLong } from "@/lib/cme/cpd-year";
import { normalizeCmeSourceUrl } from "@/lib/cme/learning-source";
import { cmeCategoryLabels, type CmeEntry, type CmeRequirementSet } from "@/lib/cme/types";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

export type CmeEntryPageProps = {
  /** The entry to show. Looked up from `entries` so a route needs to pass only the id from its own params. */
  readonly entryId: string;
  /** Every entry the owner has recorded for the loaded year. */
  readonly entries: readonly CmeEntry[];
  readonly set: CmeRequirementSet;
  /**
   * Called once the entry has actually been copied. Must persist
   * `transcribed_at` (or resolve as a no-op in demo) before this page shows
   * success — a local-only flip would lie after refresh.
   */
  readonly onCopied?: (entryId: string) => void | Promise<void>;
  readonly editHref?: string;
  readonly readOnly?: boolean;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
};

function noop() {}

/** `15000` -> `"$150.00"`. */
function formatCostCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * ONE ENTRY — the screen carrying the control this mode's owner presses most.
 *
 * The allocations, each with the category "college pill" it counts toward
 * (colleges recognise the same three national categories, so the pill names
 * the one each allocation was booked against); the reflection in the
 * owner's own words; the evidence row; the cost row; and the big
 * "Copy for your CPD home" button, which puts `formatEntryForCpdHome`'s text
 * on the clipboard and then marks the entry transcribed — never the other
 * way around, so a failed copy can never be recorded as a successful one.
 *
 * **The cost never leaves this screen through the copy button.** It is
 * shown here because design decision §7 puts it on this record for tax time,
 * and `clipboard.ts` deliberately excludes it from what reaches a CPD
 * portal — see that file's own comment for why.
 */
export function CmeEntryPage({
  entryId,
  entries,
  set,
  onCopied = noop,
  editHref,
  readOnly = false,
  children,
  actions,
}: CmeEntryPageProps) {
  const entry = entries.find((candidate) => candidate.id === entryId) ?? null;
  const [transcribed, setTranscribed] = useState(entry?.transcribed ?? false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [stampFailed, setStampFailed] = useState(false);

  if (!entry) {
    return (
      <main data-testid="cme-entry-page" className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <EmptyState
          testId="cme-entry-not-found"
          icon={FileQuestion}
          title="This entry could not be found."
          body="It may have been removed, or the link is out of date."
        />
        <div className="mt-4">
          <Link
            href={`/cme/log?year=${set.year}`}
            className="inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-[color:var(--clinical-accent)]"
          >
            <ChevronLeft aria-hidden="true" className="size-icon-sm" />
            Back to your log
          </Link>
        </div>
      </main>
    );
  }

  async function handleCopy() {
    // `entry` is narrowed non-null by the guard above, but that guard runs on
    // an earlier render than this closure captures — TypeScript cannot see
    // across the closure, so the null check is repeated rather than asserted.
    if (!entry || readOnly || entry.archivedAt) return;
    setCopyFailed(false);
    setStampFailed(false);
    try {
      await copyTextToClipboard(formatEntryForCpdHome(entry, set));
    } catch {
      setCopyFailed(true);
      return;
    }
    try {
      await onCopied(entry.id);
      setTranscribed(true);
    } catch {
      setStampFailed(true);
    }
  }

  const totalHours = Math.round(entry.allocations.reduce((sum, allocation) => sum + allocation.hours, 0) * 100) / 100;

  return (
    <main data-testid="cme-entry-page" className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href={`/cme/log?year=${set.year}`}
        className="inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-[color:var(--clinical-accent)]"
      >
        <ChevronLeft aria-hidden="true" className="size-icon-sm" />
        Back to your log
      </Link>

      <div className={cn(cardSurface, "mt-4 flex flex-col gap-1 p-4")}>
        <h1 className="text-lg font-semibold leading-snug text-[color:var(--text-heading)]">{entry.title}</h1>
        <p className={cn(textMuted, "text-sm")}>
          {formatCalendarDateLong(entry.date)} · {totalHours} hour{totalHours === 1 ? "" : "s"}
          {entry.archivedAt ? " recorded · excluded from totals" : ""}
        </p>
        {entry.routineId ? (
          <span className="mt-1 inline-flex">
            <Chip size="compact" icon={Repeat} appearance={{ kind: "information", tone: "accent" }}>
              Routine
            </Chip>
          </span>
        ) : null}
        {editHref ? (
          <Link
            href={editHref}
            className="mt-2 inline-flex min-h-tap items-center gap-2 self-start text-sm font-semibold text-[color:var(--clinical-accent)]"
          >
            <Pencil aria-hidden="true" className="size-icon-sm" />
            Edit entry
          </Link>
        ) : null}
      </div>

      <section data-testid="cme-entry-allocations" className="mt-5">
        <h2 className={eyebrowText}>Allocations</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {entry.allocations.map((allocation) => (
            <li key={allocation.category} className={cn(cardSurface, "flex items-center justify-between gap-3 p-3")}>
              <Chip appearance={{ kind: "category", tone: "indigo" }}>{cmeCategoryLabels[allocation.category]}</Chip>
              <span className="text-sm font-bold tabular-nums text-[color:var(--text-heading)]">
                {allocation.hours} h
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="cme-entry-reflection" className="mt-5">
        <h2 className={eyebrowText}>Reflection</h2>
        {entry.reflection.trim().length > 0 ? (
          <p
            className={cn(
              cardSurface,
              "mt-2 whitespace-pre-wrap break-words p-3 text-sm leading-relaxed text-[color:var(--text)]",
            )}
          >
            {entry.reflection}
          </p>
        ) : (
          <div className="mt-2">
            <EmptyState testId="cme-entry-reflection-empty" title="No reflection written yet." />
          </div>
        )}
      </section>

      <section data-testid="cme-entry-evidence" className="mt-5">
        <h2 className={eyebrowText}>Source record</h2>
        {entry.documentId ? (
          <div className={cn(cardSurface, "mt-2 p-3 text-sm text-[color:var(--text)]")}>
            A private source document is linked to this entry. This label records the link; it does not certify the
            document as audit evidence.
          </div>
        ) : (
          <div className="mt-2">
            <EmptyState
              testId="cme-entry-evidence-empty"
              title="No source is linked."
              body="A learning source and evidence of your participation are separate. Manage supporting files below."
            />
          </div>
        )}
      </section>

      {entry.sourceUrl ? (
        <p className="mt-3 break-all text-sm">
          Learning source:{" "}
          <a
            href={normalizeCmeSourceUrl(entry.sourceUrl) ?? undefined}
            rel="noreferrer"
            target="_blank"
            className="underline"
          >
            {entry.sourceUrl}
          </a>
          . This link is not evidence.
        </p>
      ) : null}
      {children}
      <section data-testid="cme-entry-cost" className="mt-5">
        <h2 className={eyebrowText}>Cost</h2>
        <p className={cn(cardSurface, "mt-2 p-3 text-sm text-[color:var(--text)]")}>
          {entry.costCents !== null ? formatCostCents(entry.costCents) : <MissingValue reason="not_recorded" />}
        </p>
      </section>

      <section data-testid="cme-entry-portal" className="mt-6">
        <h2 className={eyebrowText}>Your CPD home</h2>
        <div className="mt-2">
          <Button
            variant="primary"
            size="lg"
            block
            disabled={readOnly || Boolean(entry.archivedAt)}
            onClick={() => void handleCopy()}
          >
            Copy for your CPD home
          </Button>
        </div>
        {/* Position and words carry this, never colour — design decision §12
            bans red, amber and green from this mode, including for a
            not-yet-transcribed entry. */}
        <p data-testid="cme-entry-transcribed-status" className={cn(textMuted, "mt-2 text-center text-xs")}>
          {copyFailed
            ? "Could not copy — check clipboard permissions and try again."
            : stampFailed
              ? "Copied to your clipboard, but this record could not be marked as copied."
              : transcribed
                ? "Copied to your clipboard for your CPD home."
                : "Not yet copied for your CPD home."}
        </p>
        <p className={cn(textMuted, "mt-1 text-center text-2xs")}>
          Puts the core activity details on your clipboard for transfer, then marks this entry copied.
        </p>
      </section>
      {/* Last, below the record: archiving sat straight under the title,
          above the details, where it was the easiest thing to tap by mistake. */}
      {actions}
    </main>
  );
}
