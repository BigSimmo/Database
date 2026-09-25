import { Check, CircleDashed } from "lucide-react";
import Link from "next/link";

import { cardSurface } from "@/components/card-recipes";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { formatCalendarDateShort } from "@/lib/cme/cpd-year";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";
import { buildCmeYearCheck, type CmeYearCheckRow } from "@/lib/cme/year-check";

/** How many proving activities a row names before "and N more". */
const PROOF_LIMIT = 4;

/**
 * YEAR CHECK — the year as an audit would read it.
 *
 * Two groups: the targets the owner confirmed for the year, then the three
 * things asked of every activity (evidence, a reflection, copied to the CPD
 * home). Each row says in words whether it is ready, names the activities that
 * prove it, and offers the one action that closes the gap.
 *
 * Ready and not-ready are carried by a tick or an open circle plus the words,
 * never by colour: this mode does not use red, amber or green for status.
 */
export function CmeYearCheckPage({ set, entries }: { set: CmeRequirementSet; entries: readonly CmeEntry[] }) {
  const check = buildCmeYearCheck(set, entries);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const targets = check.rows.filter((row) => row.group === "targets");
  const records = check.rows.filter((row) => row.group === "records");

  return (
    <main data-testid="cme-year-check" className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <p className={eyebrowText}>{set.year} year check</p>
      <h1 className="mt-1 text-xl font-semibold text-[color:var(--text)]">
        {check.readyCount} of {check.rows.length} ready
      </h1>
      <p className={cn(textMuted, "mt-1 text-sm")}>
        Everything an audit of this year would ask for, and what each one rests on. Targets are the ones you confirmed
        for {set.year}
        {set.confirmedOn ? ` on ${formatCalendarDateShort(set.confirmedOn)}` : ""}.
      </p>

      <CheckGroup title="Targets" rows={targets} byId={byId} />
      <CheckGroup title="For every activity" rows={records} byId={byId} />

      <p className={cn(textMuted, "mt-6 text-sm")}>
        Ready to hand over? Open your{" "}
        <Link
          href={`/cme/summary?year=${set.year}`}
          className="inline-flex min-h-tap items-center font-semibold text-[color:var(--clinical-accent)]"
        >
          annual summary
        </Link>{" "}
        to save it as a PDF.
      </p>
    </main>
  );
}

function CheckGroup({
  title,
  rows,
  byId,
}: {
  title: string;
  rows: readonly CmeYearCheckRow[];
  byId: ReadonlyMap<string, CmeEntry>;
}) {
  return (
    <section className="mt-6" aria-labelledby={`cme-check-${title}`}>
      <h2 id={`cme-check-${title}`} className={cn(eyebrowText, "mb-2")}>
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <CheckRow key={row.id} row={row} byId={byId} />
        ))}
      </ul>
    </section>
  );
}

function CheckRow({ row, byId }: { row: CmeYearCheckRow; byId: ReadonlyMap<string, CmeEntry> }) {
  const proof = row.entryIds.map((id) => byId.get(id)).filter((entry): entry is CmeEntry => Boolean(entry));
  // Targets list what proves them; records list what still needs attention.
  const showProof = proof.length > 0 && (row.group === "records" ? !row.ready : true);
  const StatusIcon = row.ready ? Check : CircleDashed;
  return (
    <li
      className={cn(cardSurface, "p-4")}
      data-testid={`cme-check-row-${row.id}`}
      data-ready={row.ready ? "true" : "false"}
    >
      <div className="flex items-start gap-3">
        <StatusIcon
          aria-hidden="true"
          className={cn("mt-0.5 size-icon-md shrink-0", row.ready ? "text-[color:var(--text)]" : textMuted)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--text)]">
            {row.label}
            <span className="sr-only">{row.ready ? " — ready" : " — not ready"}</span>
          </p>
          <p className={cn(textMuted, "mt-0.5 text-sm")}>{row.summary}</p>
          {showProof ? (
            <details className="mt-2">
              <summary className="min-h-tap cursor-pointer text-sm font-semibold text-[color:var(--clinical-accent)]">
                {row.group === "records" ? "Which activities" : `What counts (${proof.length})`}
              </summary>
              <ul className="mt-1 flex flex-col">
                {proof.slice(0, PROOF_LIMIT).map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/cme/log/${entry.id}`}
                      className="flex min-h-tap items-center justify-between gap-3 text-sm text-[color:var(--text)]"
                    >
                      <span className="truncate">{entry.title}</span>
                      <span className={cn(textMuted, "shrink-0 text-xs")}>{formatCalendarDateShort(entry.date)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {proof.length > PROOF_LIMIT ? (
                <p className={cn(textMuted, "text-xs")}>and {proof.length - PROOF_LIMIT} more in your log</p>
              ) : null}
            </details>
          ) : null}
          {row.action ? (
            <Link
              href={row.action.href}
              className="mt-2 inline-flex min-h-tap items-center text-sm font-semibold text-[color:var(--clinical-accent)]"
            >
              {row.action.label}
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}
