import type { Metadata } from "next";

import { CountTile, META_CLASS, SECTION_HEADING_CLASS } from "@/components/developer-area/hub/count-tile";
import { PanelPageShell } from "@/components/developer-area/hub/panel-page-shell";
import { QuarantineList } from "@/components/developer-area/hub/quarantine-list";
import { loadRepoAwarenessSnapshot, resolveRepoFreshness } from "@/lib/developer-area/repo-awareness-snapshot";

export const metadata: Metadata = {
  title: "Test health · Developer · Clinical KB",
  description: "Quarantined tests, why each was quarantined, and when its quarantine lapses.",
};

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
