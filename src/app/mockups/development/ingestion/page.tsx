import type { Metadata } from "next";

import { IngestionPanel } from "@/components/developer-area/hub/ingestion-panel";
import { PanelPageShell } from "@/components/developer-area/hub/panel-page-shell";
import { resolveFreshnessFrom } from "@/lib/developer-area/freshness";

export const metadata: Metadata = {
  title: "Ingestion · Developer · Clinical KB",
  description: "Whether an uploaded document actually indexed — queued, processing, finished, or stuck — read live.",
};

export default function DeveloperIngestionPage() {
  /**
   * Every other Phase 1/2 panel stamps "content as of <build time>", read from
   * a snapshot committed at build time. This page is deliberately not one of
   * those (plan §3, Ruling I1): `IngestionPanel` is a Client Component that
   * polls `/api/ingestion/jobs` live, so at the moment this Server Component
   * renders, no job data has been read yet. Passing a build-time value here —
   * or any non-null `contentAt` — would be true of the page and false of the
   * numbers on it (plan §8). `contentAt: null` is the honest answer for this
   * particular stamp: it renders "revision unknown", which is exactly what a
   * server that has not fetched anything should say. The fact §8 actually
   * asks for — when the data was last fetched, updating as it polls — is
   * rendered by `IngestionPanel` itself (`CheckedAt`), next to the data it
   * describes, since only the client component ever knows that timestamp.
   */
  const freshness = resolveFreshnessFrom(null, new Date(), { status: "live" });

  return (
    <PanelPageShell
      testId="developer-ingestion"
      title="Ingestion"
      freshness={freshness}
      freshnessLabel="Ingestion jobs"
    >
      <p className="text-sm leading-6 text-[color:var(--text-muted)]">
        Whether an uploaded document actually indexed — queued, processing, finished, or stuck — read live from the same
        endpoint the app itself uses, not from a build-time snapshot.
      </p>
      <IngestionPanel />
    </PanelPageShell>
  );
}
