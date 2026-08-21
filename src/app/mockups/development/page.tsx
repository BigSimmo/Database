import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { DeveloperHubNavHeader } from "@/components/developer-area/developer-hub-nav-header";
import { EnvironmentStrip } from "@/components/developer-area/hub/environment-strip";
import { PanelCard } from "@/components/developer-area/hub/panel-card";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { panelsInGroup, type HubPanelGroup } from "@/lib/developer-area/hub-panels";
import { loadLedgerSnapshot } from "@/lib/developer-area/ledger-snapshot";

export const metadata: Metadata = {
  title: "Developer · Clinical KB",
  description: "In-progress surfaces and repository state, reachable only to a signed-in administrator account.",
};

const GROUPS: { id: HubPanelGroup; anchor: string; label: string }[] = [
  { id: "work", anchor: "developer-hub-work", label: "Work and decisions" },
  { id: "clinical", anchor: "developer-hub-clinical", label: "Clinical trust" },
  { id: "system", anchor: "developer-hub-system", label: "System truth" },
  { id: "reference", anchor: "developer-hub-reference", label: "Reference" },
];

export default function DeveloperHubPage() {
  const snapshot = loadLedgerSnapshot();

  return (
    <>
      <DeveloperHubNavHeader />
      <main className="mx-auto grid w-full max-w-[64rem] gap-6 px-4 py-8 sm:px-6" data-testid="development-index">
        <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)]">Developer hub</h1>

        {/*
         * Carried over from the pre-hub index unchanged. This page links to
         * synthetic patient prototypes, so the caveat sits above the fold and is
         * not something a layout rewrite may quietly drop.
         */}
        <p className="flex items-start gap-2 rounded-xl border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--text)]">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--warning)]" />
          <span>
            <strong className="font-extrabold text-[color:var(--text-heading)]">Synthetic data only.</strong> No
            patient, message, schedule or team record on these surfaces is real, and nothing here is validated clinical
            decision support.
          </span>
        </p>

        <section id="developer-hub-environment" className={inPageAnchor}>
          <h2 className="sr-only">Environment</h2>
          <EnvironmentStrip demoMode={null} documentCount={null} buildSha={null} email={null} />
        </section>

        {snapshot.counts.p1 > 0 ? (
          <p
            data-testid="developer-hub-needs-you-now"
            className="rounded-xl border border-[color:var(--danger)]/40 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--text)]"
          >
            {snapshot.counts.p1} blocking {snapshot.counts.p1 === 1 ? "item" : "items"} in the task ledger.
          </p>
        ) : null}

        {GROUPS.map((group) => {
          const panels = panelsInGroup(group.id);
          // An empty group must render no anchor at all. `useResolvedPageSections`
          // drops a declared section whose anchor is missing — that is what lets
          // phases 2-4 add panels without touching the navigation — and rendering
          // the section unconditionally would make that mechanism inert here,
          // offering a jump to a bare heading above an empty grid.
          if (panels.length === 0) return null;

          return (
            <section key={group.id} id={group.anchor} className={inPageAnchor}>
              <h2 className="mb-3 text-lg font-extrabold text-[color:var(--text-heading)]">{group.label}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {panels.map((panel) => (
                  <PanelCard key={panel.id} panel={panel} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
