import type { Metadata } from "next";
import Link from "next/link";

import {
  CARD_CLASS,
  CountTile,
  META_CLASS,
  MONO_CLASS,
  PanelSection,
} from "@/components/developer-area/hub/panel-primitives";
import { PanelPageShell } from "@/components/developer-area/hub/panel-page-shell";
import { resolveLiveFreshness } from "@/lib/developer-area/freshness";
import { loadSignOffQueue, type SignOffFamily, type SignOffRow } from "@/lib/developer-area/sign-off-queue";

export const metadata: Metadata = {
  title: "Clinical sign-off queue · Developer · PsychSift",
  description: "The clinical records this repository holds on disk that are waiting for a person to sign them off.",
};

/**
 * The clinical sign-off queue.
 *
 * Three rules shape this page, and all three come from what the underlying
 * files actually say rather than from a preference about layout.
 *
 * **It groups, and never merges.** Seven families, five review vocabularies, one
 * section each. Each section states the file it was read from and the native
 * field its status comes from, and each row prints that source's own word before
 * any label this page invented. A single unified status column would make seven
 * different clinical decisions look like one decision someone forgot to take.
 *
 * **It reads, and never signs.** No control on this page publishes, approves or
 * unhides anything. The dictionary drafts stay unpublished; this list is the
 * only place in the running app where they are readable at all, which is the
 * point of including them.
 *
 * **It links only where a record exists to open.** A row with no route carries
 * no link rather than one that 404s, and the section says so. Two families are in
 * that position today: the 333 dictionary sense drafts, which nothing in the app
 * renders, and the source acquisition candidates, which live only in the ledger.
 *
 * It does not claim to cover every clinical record. It reads seven families this
 * repository holds on disk and knows nothing about any other, so the heading, the
 * tiles and the hub card all avoid a completeness word on purpose.
 */
function QueueRow({ row }: { row: SignOffRow }) {
  return (
    <li className={CARD_CLASS}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={MONO_CLASS}>{row.id}</span>
        <span className="rounded-full border border-[color:var(--border-strong)] px-2 py-0.5 text-xs font-bold text-[color:var(--text-muted)]">
          {row.statusLabel}
        </span>
      </div>
      <p className="text-sm font-bold leading-6 text-[color:var(--text-heading)]">
        {row.href ? (
          <Link
            href={row.href}
            className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            {row.title}
          </Link>
        ) : (
          row.title
        )}
      </p>
      <p className="text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-bold">To sign off: </span>
        {row.requires}
      </p>
      {/*
       * The source's own status word, printed verbatim under every row. This is
       * what stops the display label above from becoming the only vocabulary a
       * reader ever sees, which is how five distinct review states quietly
       * become one.
       */}
      <p className={META_CLASS}>Recorded as: {row.nativeStatus}</p>
    </li>
  );
}

function FamilySection({ family }: { family: SignOffFamily }) {
  return (
    <PanelSection
      testId={`developer-sign-off-family-${family.id}`}
      headingId={`developer-sign-off-family-${family.id}-heading`}
      heading={`${family.name} — ${family.rows.length} waiting`}
    >
      <p className="text-sm leading-6 text-[color:var(--text-muted)]">{family.note}</p>
      <p className={META_CLASS}>
        Read from {family.source}. Status field: {family.nativeField}.
        {family.unrouted ? " Some of these records have no route in this app; those rows carry no link." : ""}
      </p>
      <ul data-testid={`developer-sign-off-rows-${family.id}`} className="grid gap-2">
        {family.rows.map((row) => (
          <QueueRow key={row.key} row={row} />
        ))}
      </ul>
    </PanelSection>
  );
}

export default function DeveloperClinicalSignOffPage() {
  const queue = loadSignOffQueue();
  // Live, not snapshot-backed: every count is derived at read time from files
  // committed in this repository, so there is no capture date to report and no
  // generated snapshot that can go stale behind the page.
  const freshness = resolveLiveFreshness(null, new Date());
  // Counted per row, not per family: the dictionary family is flagged unrouted
  // because its 333 sense drafts have nowhere to go, but its 96 definition
  // reviews do point at a live entry. Counting the family whole would report 429
  // unreachable records, which is wrong by 96.
  const unlinked = queue.families.reduce(
    (sum, family) => sum + family.rows.filter((row) => row.href === null).length,
    0,
  );

  return (
    <PanelPageShell
      testId="developer-clinical-sign-off"
      title="Clinical sign-off queue"
      freshness={freshness}
      freshnessLabel="Sign-off queue"
    >
      <p className="text-sm leading-6 text-[color:var(--text-muted)]">
        The clinical records this repository holds on disk that are waiting for a person to sign them off, grouped by
        the family they belong to. Seven families, read from the files that already hold them — this is not a claim
        about every clinical record anywhere, only about these. The page is read-only: nothing on it publishes, approves
        or unhides a record. The families use five unrelated review vocabularies and keep them, so every row prints the
        word its own source file uses underneath the label shown beside it.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountTile testId="developer-sign-off-count-total" value={queue.total} label="records awaiting sign-off" />
        <CountTile testId="developer-sign-off-count-families" value={queue.families.length} label="record families" />
        <CountTile testId="developer-sign-off-count-unrouted" value={unlinked} label="records no page renders" />
        <CountTile
          testId="developer-sign-off-count-linked"
          value={queue.families.reduce((sum, family) => sum + family.rows.filter((row) => row.href).length, 0)}
          label="records with a page to open"
        />
      </div>

      <div className="grid gap-1 rounded-xl border border-[color:var(--border)] p-4">
        <p className="text-sm font-bold leading-6 text-[color:var(--text-heading)]">Counts by family</p>
        <ul data-testid="developer-sign-off-summary" className="grid gap-1">
          {queue.families.map((family) => (
            <li key={family.id} className="text-sm leading-6 text-[color:var(--text-muted)]">
              <span className="font-bold text-[color:var(--text-heading)]">{family.rows.length}</span> {family.name}
            </li>
          ))}
        </ul>
      </div>

      {queue.families.map((family) => (
        <FamilySection key={family.id} family={family} />
      ))}
    </PanelPageShell>
  );
}
