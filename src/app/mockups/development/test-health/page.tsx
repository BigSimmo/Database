import type { Metadata } from "next";

import {
  CountTile,
  META_CLASS,
  MONO_CLASS,
  ROW_CLASS,
  SECTION_HEADING_CLASS,
} from "@/components/developer-area/hub/count-tile";
import { PanelPageShell } from "@/components/developer-area/hub/panel-page-shell";
import {
  isQuarantineExpired,
  loadRepoAwarenessSnapshot,
  resolveRepoFreshness,
} from "@/lib/developer-area/repo-awareness-snapshot";
import type { QuarantinedTest } from "@/lib/developer-area/repo-awareness-types";

export const metadata: Metadata = {
  title: "Test health · Developer · Clinical KB",
  description: "Quarantined tests, why each was quarantined, and when its quarantine lapses.",
};

/**
 * `QuarantineList` takes `now` as a parameter, rather than calling `new Date()`
 * itself, so a test can render both sides of the expiry boundary
 * (`isQuarantineExpired`) without faking the system clock.
 *
 * Every field on `QuarantinedTest` (id, title, spec, reason, owner,
 * reproduction, first_seen, last_seen, expires, tracking) is rendered
 * unconditionally as plain text below — none of them drive a branch, so there
 * is no enumerated value here that could be silently dropped the way an
 * unrecognised `page.area` or documentation `section` is handled on the
 * sibling pages. The only branch in this component is on `expired`, a boolean
 * *computed* from `expires` via `isQuarantineExpired`, not a raw field value
 * with its own domain of recognised/unrecognised states.
 */
export function QuarantineList({ entries, now }: { entries: readonly QuarantinedTest[]; now: Date }) {
  return (
    <ul data-testid="developer-test-health-list" className="grid gap-3">
      {entries.map((entry) => {
        const expired = isQuarantineExpired(entry, now);
        return (
          <li
            key={entry.id}
            data-testid={`developer-test-health-entry-${entry.id}`}
            className="grid gap-1 rounded-xl border border-[color:var(--border)] p-4"
          >
            <div className={ROW_CLASS}>
              <span className={MONO_CLASS}>{entry.id}</span>
              {expired ? (
                <span className="rounded-full border-2 border-[color:var(--danger)] px-2 py-0.5 text-xs font-bold text-[color:var(--text-heading)]">
                  expired {entry.expires}
                </span>
              ) : (
                <span className={META_CLASS}>· lapses {entry.expires}</span>
              )}
            </div>
            <p className="text-sm leading-6 text-[color:var(--text-heading)]">{entry.title}</p>
            <p className={META_CLASS}>
              {entry.spec} · {entry.owner} · first seen {entry.first_seen}, last seen {entry.last_seen}
            </p>
            <p className="text-sm leading-6 text-[color:var(--text-heading)]">{entry.reason}</p>
            <p className={META_CLASS}>Reproduce: {entry.reproduction}</p>
            <p className={META_CLASS}>Tracked in {entry.tracking}</p>
          </li>
        );
      })}
    </ul>
  );
}

export default function DeveloperTestHealthPage() {
  const snapshot = loadRepoAwarenessSnapshot();
  const now = new Date();
  const freshness = resolveRepoFreshness(snapshot, now);
  const { quarantined, note, counts } = snapshot.test_health;

  return (
    <PanelPageShell
      testId="developer-test-health"
      title="Test health"
      freshness={freshness}
      freshnessLabel="Repository"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountTile
          testId="developer-test-health-count-quarantined"
          value={counts.quarantined}
          label="quarantined tests"
        />
      </div>

      <p className={META_CLASS}>
        A quarantined test still runs, but its failure no longer blocks a merge. Quarantine requires three
        reproductions on the same commit and lapses within thirty days, so this list should be short and should
        empty itself.
      </p>

      <section aria-labelledby="developer-test-health-heading" className="grid gap-3">
        <h2 id="developer-test-health-heading" className={SECTION_HEADING_CLASS}>
          Quarantined · {counts.quarantined}
        </h2>
        {quarantined.length > 0 ? (
          <QuarantineList entries={quarantined} now={now} />
        ) : (
          /*
           * In words, never a blank container. An empty list and a failed load
           * look identical, and the ledger's own note explains the emptiness
           * better than anything this page could invent.
           */
          <div
            data-testid="developer-test-health-empty"
            className="grid gap-2 rounded-xl border border-[color:var(--border)] p-4"
          >
            <p className="text-sm leading-6 text-[color:var(--text-heading)]">No tests are quarantined.</p>
            {note ? <p className={META_CLASS}>The ledger records why: {note}</p> : null}
          </div>
        )}
      </section>
    </PanelPageShell>
  );
}
