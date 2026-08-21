import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FreshnessStamp } from "@/components/developer-area/hub/freshness-stamp";
import { LedgerItem } from "@/components/developer-area/hub/ledger-item";
import {
  loadLedgerSnapshot,
  openItemsByPriority,
  resolveFreshness,
  type LedgerOpenItem,
  type LedgerPriority,
} from "@/lib/developer-area/ledger-snapshot";

export const metadata: Metadata = {
  title: "Task ledger · Developer · Clinical KB",
  description: "Every outstanding task, recommendation and issue, read from the committed ledger snapshot.",
};

const PRIORITY_GROUPS: { priority: LedgerPriority; heading: string; note: string }[] = [
  { priority: "P1", heading: "P1 — blocking", note: "Something is broken or unsafe until this lands." },
  { priority: "P2", heading: "P2 — important", note: "Real work that is not holding anything else up." },
  { priority: "P3", heading: "P3 — background", note: "Worth doing when there is room." },
];

/**
 * Acuity answers "how soon do I start this", which is not what priority
 * answers. The descriptor is spelled out so the two scales cannot be read as
 * one, and an acuity value this map has never seen falls through to its own raw
 * text rather than being dropped or coerced into the nearest known band.
 */
const ACUITY_NOTE: Record<string, string> = {
  A1: "start now",
  A2: "start soon",
  A3: "start when there is room",
};

const TILE_CLASS = "grid gap-1 rounded-xl border border-[color:var(--border)] p-4";
const TILE_NUMBER_CLASS = "text-2xl font-extrabold text-[color:var(--text-heading)]";
const TILE_LABEL_CLASS = "text-xs text-[color:var(--text-muted)]";
const SECTION_HEADING_CLASS = "text-lg font-extrabold text-[color:var(--text-heading)]";
const META_CLASS = "text-xs text-[color:var(--text-muted)]";
const DISCLOSURE_CLASS = "flex min-h-12 cursor-pointer items-center text-xs font-bold text-[color:var(--text-muted)]";

export default function DeveloperLedgerPage() {
  const snapshot = loadLedgerSnapshot();
  const freshness = resolveFreshness(snapshot, new Date());
  const grouped = openItemsByPriority(snapshot);

  // `openItemsByPriority` only recognises P1-P3. Anything else would vanish
  // from the list while still being counted in `counts.open` — a page quietly
  // under-reporting outstanding work, which is the exact `#338` failure this
  // feature exists to prevent. So the remainder is rendered under its own
  // heading instead of being silently discarded.
  const recognised = new Set([...grouped.P1, ...grouped.P2, ...grouped.P3].map((item) => item.id));
  const unrecognised: LedgerOpenItem[] = snapshot.open.filter((item) => !recognised.has(item.id));

  return (
    <main data-testid="developer-ledger" className="mx-auto grid w-full max-w-[64rem] gap-6 px-4 py-8 sm:px-6">
      <Link
        data-testid="developer-ledger-back"
        href="/mockups/development"
        className="inline-flex min-h-12 w-fit items-center gap-2 text-sm font-bold text-[color:var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <ArrowLeft aria-hidden="true" className="size-icon-sm" />
        Developer hub
      </Link>

      <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)]">Task ledger</h1>

      {/*
       * Unconditional, and directly under the title. Every number below is read
       * from a snapshot committed at build time, so the one thing a reader must
       * never have to guess is how old it is.
       */}
      <FreshnessStamp freshness={freshness} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div data-testid="developer-ledger-count-open" className={TILE_CLASS}>
          <span className={TILE_NUMBER_CLASS}>{snapshot.counts.open}</span>
          <span className={TILE_LABEL_CLASS}>open items</span>
        </div>
        <div data-testid="developer-ledger-count-p1" className={TILE_CLASS}>
          <span className={TILE_NUMBER_CLASS}>{snapshot.counts.p1}</span>
          <span className={TILE_LABEL_CLASS}>blocking, priority P1</span>
        </div>
        <div data-testid="developer-ledger-count-queued" className={TILE_CLASS}>
          <span className={TILE_NUMBER_CLASS}>{snapshot.counts.queued}</span>
          <span className={TILE_LABEL_CLASS}>in the running order</span>
        </div>
        <div data-testid="developer-ledger-count-pending" className={TILE_CLASS}>
          <span className={TILE_NUMBER_CLASS}>{snapshot.counts.pending}</span>
          <span className={TILE_LABEL_CLASS}>requests not yet applied</span>
        </div>
      </div>

      {grouped.P1.length > 0 ? (
        <section
          data-testid="developer-ledger-blockers"
          aria-labelledby="developer-ledger-blockers-heading"
          className="grid gap-2 rounded-xl border border-[color:var(--danger)]/40 bg-[color:var(--danger-soft)] px-4 py-3"
        >
          <h2 id="developer-ledger-blockers-heading" className={SECTION_HEADING_CLASS}>
            Blocking now
          </h2>
          <ul className="grid gap-2">
            {grouped.P1.map((item) => (
              <li key={item.id} className="text-sm leading-6 text-[color:var(--text-heading)]">
                <span className="font-mono text-xs text-[color:var(--text-muted)]">{item.id}</span> {item.summary}
              </li>
            ))}
          </ul>
          <p className={META_CLASS}>Full detail for each of these is in the open items list below.</p>
        </section>
      ) : null}

      <section aria-labelledby="developer-ledger-queue-heading" className="grid gap-3">
        <h2 id="developer-ledger-queue-heading" className={SECTION_HEADING_CLASS}>
          Recommended running order
        </h2>
        <p data-testid="developer-ledger-queue-caption" className={META_CLASS}>
          Ordered by acuity — urgency, not priority. Acuity says how soon to start something; the priority badges
          further down say how much an item matters. They are separate scales kept on separate tables, and neither is
          derived from the other.
        </p>
        <ol data-testid="developer-ledger-queue" className="grid gap-3">
          {snapshot.queue.map((entry) => {
            const note = ACUITY_NOTE[entry.acuity];
            return (
              <li
                key={`${entry.order}-${entry.ids.join("-")}`}
                data-testid={`developer-ledger-queue-entry-${entry.order}`}
                className="grid gap-2 rounded-xl border border-[color:var(--border)] p-4"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`${META_CLASS} font-bold`}>{entry.order}.</span>
                  {entry.ids.map((id) => (
                    <span key={id} className="font-mono text-xs text-[color:var(--text-muted)]">
                      {id}
                    </span>
                  ))}
                  {/*
                   * Outlined and pill-shaped against the priority badge's
                   * filled rectangle, and carrying its own plain-English
                   * descriptor, so the two scales cannot be mistaken for one.
                   */}
                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-[color:var(--border)] px-2 py-0.5 text-xs font-bold text-[color:var(--text-heading)]">
                    {entry.acuity}
                    {note ? <span className={`${META_CLASS} font-normal`}>· {note}</span> : null}
                  </span>
                </div>
                <p className={META_CLASS}>
                  {entry.capability} · {entry.timing} · {entry.estimate}
                </p>
                <details>
                  <summary className={DISCLOSURE_CLASS}>Outcome and stopping condition</summary>
                  <p className="mt-2 text-xs leading-6 text-[color:var(--text-muted)]">{entry.detail}</p>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="developer-ledger-open-heading" className="grid gap-3">
        <h2 id="developer-ledger-open-heading" className={SECTION_HEADING_CLASS}>
          Open items
        </h2>
        {/*
         * A wrapper rather than one `<ul>`: each priority group needs its own
         * heading, and a heading between `<li>` siblings is not valid list
         * markup. Every open item still sits under this single test id, in
         * P1 -> P2 -> P3 order.
         */}
        <div data-testid="developer-ledger-open" className="grid gap-6">
          {PRIORITY_GROUPS.map((group) => {
            const items = grouped[group.priority];
            if (items.length === 0) return null;
            const headingId = `developer-ledger-open-${group.priority}`;
            return (
              <section key={group.priority} aria-labelledby={headingId} className="grid gap-2">
                <h3 id={headingId} className="text-sm font-extrabold text-[color:var(--text-heading)]">
                  {group.heading} · {items.length}
                </h3>
                <p className={META_CLASS}>{group.note}</p>
                <ul className="grid gap-3">
                  {items.map((item) => (
                    <LedgerItem key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            );
          })}

          {unrecognised.length > 0 ? (
            <section aria-labelledby="developer-ledger-open-other" className="grid gap-2">
              <h3 id="developer-ledger-open-other" className="text-sm font-extrabold text-[color:var(--text-heading)]">
                Other · {unrecognised.length}
              </h3>
              <p className={META_CLASS}>
                These rows carry a priority this page does not recognise. They are shown as they are rather than
                dropped, so the list still adds up to the {snapshot.counts.open} open items counted above.
              </p>
              <ul className="grid gap-3">
                {unrecognised.map((item) => (
                  <LedgerItem key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="developer-ledger-pending-heading" className="grid gap-3">
        <h2 id="developer-ledger-pending-heading" className={SECTION_HEADING_CLASS}>
          Requests not yet applied
        </h2>
        <p className={META_CLASS}>
          Inbox records waiting on the next reconcile. They are not in the open items above yet, so the two lists do not
          overlap.
        </p>
        {snapshot.pending.length > 0 ? (
          <ul data-testid="developer-ledger-pending" className="grid gap-3">
            {snapshot.pending.map((request) => (
              <li
                key={request.request_id}
                data-testid={`developer-ledger-pending-${request.request_id}`}
                className="grid gap-1 rounded-xl border border-[color:var(--border)] p-4"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-lg border border-[color:var(--border)] px-2 py-0.5 text-xs text-[color:var(--text-muted)]">
                    {request.action}
                  </span>
                  <span className={`${META_CLASS} font-mono`}>{request.request_id}</span>
                </div>
                <p className="text-sm leading-6 text-[color:var(--text-heading)]">{request.summary}</p>
                <p className={META_CLASS}>{request.created_at ?? "no creation date recorded"}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p data-testid="developer-ledger-pending" className={META_CLASS}>
            No requests are waiting.
          </p>
        )}
      </section>
    </main>
  );
}
