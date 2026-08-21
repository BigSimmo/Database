"use client";

import Link from "next/link";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import type { HubPanel } from "@/lib/developer-area/hub-panels";

const CARD_CLASS =
  "grid min-h-12 gap-1 rounded-xl border border-[color:var(--border)] p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export function PanelCard({ panel }: { panel: HubPanel }) {
  if (panel.phase === 1 && panel.href) {
    return (
      <Link href={panel.href} className={CARD_CLASS} data-testid={`developer-hub-panel-${panel.id}`}>
        <span className="text-sm font-extrabold text-[color:var(--text-heading)]">{panel.name}</span>
        <span className="text-xs leading-5 text-[color:var(--text-muted)]">{panel.summary}</span>
      </Link>
    );
  }

  // Unavailable for a *stated* reason, so `aria-disabled` + an inert handler,
  // never native `disabled` — which would remove the tab stop and make the
  // reason unreachable. See docs/wiring-conventions.md.
  const noteId = `developer-hub-panel-${panel.id}-note`;
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby={noteId}
      onClick={ignoreUnavailableActivation}
      title={`${panel.name} — coming soon`}
      className={`${CARD_CLASS} opacity-70`}
      data-testid={`developer-hub-panel-${panel.id}`}
    >
      <span className="text-sm font-extrabold text-[color:var(--text-heading)]">{panel.name}</span>
      <span className="text-xs leading-5 text-[color:var(--text-muted)]">{panel.summary}</span>
      <span className="text-xs font-bold text-[color:var(--text-muted)]">Phase {panel.phase}</span>
      <span id={noteId} className="sr-only">
        {panel.name} is not built yet. It arrives in phase {panel.phase}.
      </span>
    </button>
  );
}
