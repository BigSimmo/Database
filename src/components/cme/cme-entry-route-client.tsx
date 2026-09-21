"use client";

import { CmeEntryPage } from "@/components/cme/cme-entry-page";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

export type CmeEntryRouteClientProps = {
  readonly entryId: string;
  readonly entries: readonly CmeEntry[];
  readonly set: CmeRequirementSet;
  /** When false (demo mode), copy still works but nothing is written. */
  readonly persistTranscribed: boolean;
};

/**
 * Client wrapper so the entry page can PATCH `transcribed_at` after a
 * successful clipboard copy without the Server Component owning a handler.
 */
export function CmeEntryRouteClient({
  entryId,
  entries,
  set,
  persistTranscribed,
}: CmeEntryRouteClientProps) {
  async function persistCopied(id: string) {
    if (!persistTranscribed) return;
    const response = await fetch(`/api/cme/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcribed: true }),
    });
    if (!response.ok) {
      throw new Error("Could not mark this entry as copied.");
    }
  }

  return <CmeEntryPage entryId={entryId} entries={entries} set={set} onCopied={persistCopied} />;
}
