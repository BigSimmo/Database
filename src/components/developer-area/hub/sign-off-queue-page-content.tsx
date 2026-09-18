import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  CARD_CLASS,
  CountTile,
  META_CLASS,
  MONO_CLASS,
  PanelSection,
} from "@/components/developer-area/hub/panel-primitives";
import { PanelPageShell } from "@/components/developer-area/hub/panel-page-shell";
import { resolveLiveFreshness } from "@/lib/developer-area/freshness";
import {
  loadSignOffQueue,
  type SignOffFamily,
  type SignOffFamilyId,
  type SignOffRow,
} from "@/lib/developer-area/sign-off-queue";

/**
 * The clinical sign-off queue.
 *
 * Four rules shape this page, and the first three come from what the underlying
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
 *
 * **One family, one page of rows, sliced on the server.** The queue holds 1,592
 * records, and rendering them all produced a 4.66 MB response — heavier than the
 * `/sources/search` page already being repaired for the same reason. So the
 * family is chosen by `?family=`, the rows within it by `?page=`, and both slices
 * happen here rather than in the browser. `ReviewStatePageContent` learned this
 * the expensive way (PR #2449): slicing after the full array has already crossed
 * the boundary does not reduce a single transferred byte. Every family's total
 * stays on screen on every page, in the counts list below, so narrowing the view
 * never narrows the numbers.
 */
export const SIGN_OFF_PAGE_SIZE = 50;

const PAGER_LINK_CLASS =
  "inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const PAGER_DISABLED_CLASS =
  "inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-heading)] opacity-40";

const FAMILY_LINK_CLASS =
  "inline-flex min-h-12 w-full items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 py-2 text-sm leading-6 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const FAMILY_LINK_ACTIVE_CLASS =
  "inline-flex min-h-12 w-full items-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-3 py-2 text-sm leading-6 text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/** `?family=…&page=…`. Page 1 is left implicit so the shortest link is the common one. */
function queueHref(family: SignOffFamilyId, page: number): string {
  return page <= 1 ? `?family=${family}` : `?family=${family}&page=${page}`;
}

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

function Pager({
  family,
  page,
  totalPages,
  ariaLabel,
}: {
  family: SignOffFamilyId;
  page: number;
  totalPages: number;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-2" role="navigation" aria-label={ariaLabel}>
      {page > 1 ? (
        <Link href={queueHref(family, page - 1)} aria-label="Previous page" className={PAGER_LINK_CLASS}>
          <ChevronLeft aria-hidden="true" className="size-icon-sm" />
          Previous
        </Link>
      ) : (
        <span aria-label="Previous page" aria-disabled="true" className={PAGER_DISABLED_CLASS}>
          <ChevronLeft aria-hidden="true" className="size-icon-sm" />
          Previous
        </span>
      )}
      <span className="px-2 text-xs font-bold text-[color:var(--text-heading)]">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={queueHref(family, page + 1)} aria-label="Next page" className={PAGER_LINK_CLASS}>
          Next
          <ChevronRight aria-hidden="true" className="size-icon-sm" />
        </Link>
      ) : (
        <span aria-label="Next page" aria-disabled="true" className={PAGER_DISABLED_CLASS}>
          Next
          <ChevronRight aria-hidden="true" className="size-icon-sm" />
        </span>
      )}
    </div>
  );
}

function FamilySection({ family, requestedPage }: { family: SignOffFamily; requestedPage: number }) {
  const totalPages = Math.max(1, Math.ceil(family.rows.length / SIGN_OFF_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const startIndex = (page - 1) * SIGN_OFF_PAGE_SIZE;
  const pageRows = family.rows.slice(startIndex, startIndex + SIGN_OFF_PAGE_SIZE);

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p data-testid="developer-sign-off-pagination-summary" className={META_CLASS}>
          Showing {startIndex + 1}–{startIndex + pageRows.length} of {family.rows.length} records in this family (page{" "}
          {page} of {totalPages}). The family totals above are unaffected by this slice.
        </p>
        {totalPages > 1 ? (
          <Pager family={family.id} page={page} totalPages={totalPages} ariaLabel={`${family.name} pagination`} />
        ) : null}
      </div>

      <ul data-testid={`developer-sign-off-rows-${family.id}`} className="grid gap-2">
        {pageRows.map((row) => (
          <QueueRow key={row.key} row={row} />
        ))}
      </ul>

      {totalPages > 1 ? (
        <div className="flex justify-end pt-2">
          <Pager
            family={family.id}
            page={page}
            totalPages={totalPages}
            ariaLabel={`${family.name} pagination bottom`}
          />
        </div>
      ) : null}
    </PanelSection>
  );
}

export function SignOffQueuePageContent({
  requestedFamily,
  requestedPage = 1,
}: {
  requestedFamily?: string;
  requestedPage?: number;
}) {
  const queue = loadSignOffQueue();
  // Live, not snapshot-backed: every count is derived at read time from files
  // committed in this repository, so there is no capture date to report and no
  // generated snapshot that can go stale behind the page.
  const freshness = resolveLiveFreshness(null, new Date());
  // An unrecognised `?family=` falls back to the first family rather than 404ing.
  // A developer who hand-edits the query string should land on the queue, not on
  // an error page that reads as though the data is gone.
  const selected = queue.families.find((family) => family.id === requestedFamily) ?? queue.families[0]!;
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
          value={queue.total - unlinked}
          label="records with a page to open"
        />
      </div>

      {/*
       * Every family's total, on every page. This list is what makes the
       * pagination honest: only one family's rows are rendered at a time, so
       * without it a reader could mistake the visible section for the whole
       * queue. It doubles as the navigation between families.
       */}
      <PanelSection
        testId="developer-sign-off-summary"
        headingId="developer-sign-off-summary-heading"
        heading="Counts by family"
      >
        <p className={META_CLASS}>
          Every family&rsquo;s full total, whichever one is open below. Choose a family to read its records,{" "}
          {SIGN_OFF_PAGE_SIZE} at a time.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {queue.families.map((family) => {
            const active = family.id === selected.id;
            return (
              <li key={family.id}>
                <Link
                  href={queueHref(family.id, 1)}
                  aria-current={active ? "page" : undefined}
                  className={active ? FAMILY_LINK_ACTIVE_CLASS : FAMILY_LINK_CLASS}
                >
                  <span className="font-bold text-[color:var(--text-heading)]">{family.rows.length}</span>
                  {family.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </PanelSection>

      <FamilySection family={selected} requestedPage={requestedPage} />
    </PanelPageShell>
  );
}
