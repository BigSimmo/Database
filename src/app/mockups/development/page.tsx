import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { DeveloperHubNavHeader, developerHubNavSections } from "@/components/developer-area/developer-hub-nav-header";
import { EnvironmentStrip } from "@/components/developer-area/hub/environment-strip";
import { PanelCard } from "@/components/developer-area/hub/panel-card";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { panelsInGroup, type HubPanelGroup } from "@/lib/developer-area/hub-panels";
import { loadLedgerSnapshot } from "@/lib/developer-area/ledger-snapshot";
import { resolveDeploymentCommitSha } from "@/lib/observability/sentry-release";

export const metadata: Metadata = {
  title: "Developer · Clinical KB",
  description: "In-progress surfaces and repository state, reachable only to a signed-in administrator account.",
};

/**
 * Which nav section each panel group renders into. Ids only — `developerHubNavSections`
 * owns the anchor and the heading text, and this page derives both from it below.
 *
 * The section sheet and the `<h2>` are two renderings of one label, so a local
 * copy of that text could drift with every gate green: the sheet could offer
 * "Clinical trust" while the heading said something else, and nothing would
 * notice. That is the same defect class this whole feature exists to close —
 * one truth held in two places, one of them free to move.
 *
 * `developer-hub-environment` is deliberately absent: it is a navigable section
 * but not a panel group, so it must not produce a panel grid.
 */
const PANEL_GROUP_BY_SECTION_ID: Record<string, HubPanelGroup | undefined> = {
  "developer-hub-work": "work",
  "developer-hub-clinical": "clinical",
  "developer-hub-system": "system",
  "developer-hub-reference": "reference",
};

const GROUPS = developerHubNavSections.flatMap((section) => {
  const group = PANEL_GROUP_BY_SECTION_ID[section.id];
  return group ? [{ group, anchor: section.id, label: section.label }] : [];
});

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
          {/*
           * Build identity only. `resolveDeploymentCommitSha` reads
           * `RAILWAY_GIT_COMMIT_SHA`, which the Dockerfile already declares, and
           * returns `null` when it is absent — so local dev keeps saying "build
           * unknown" honestly rather than inventing one.
           *
           * `demoMode`, `documentCount` and the signed-in email stay null because
           * the plan scopes that wiring to Phase 2: see the "Known gap,
           * deliberate" note in docs/superpowers/plans/2026-08-21-developer-hub-phase-1.md
           * — the component and its contract exist, the real values are not wired,
           * and the strip is required to render honestly rather than invent them.
           * `null` is not an absence here, it is the strip's way of naming what it
           * has not read; `demoMode` is the load-bearing one, since claiming "Live
           * data" on a page that never looked states the opposite of the truth in
           * demo mode.
           */}
          <EnvironmentStrip demoMode={null} documentCount={null} buildSha={resolveDeploymentCommitSha()} email={null} />
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
          const panels = panelsInGroup(group.group);
          // An empty group must render no anchor at all. `useResolvedPageSections`
          // drops a declared section whose anchor is missing — that is what lets
          // phases 2-4 add panels without touching the navigation — and rendering
          // the section unconditionally would make that mechanism inert here,
          // offering a jump to a bare heading above an empty grid.
          if (panels.length === 0) return null;

          return (
            <section key={group.group} id={group.anchor} className={inPageAnchor}>
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
