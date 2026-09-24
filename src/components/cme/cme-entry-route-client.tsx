"use client";

import { CmeEvidencePanel } from "@/components/cme/cme-evidence-panel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CmeEntryForm, type CmeEntryDraft } from "@/components/cme/cme-entry-form";
import { CmeEntryPage } from "@/components/cme/cme-entry-page";
import { cn, InlineNotice, textMuted } from "@/components/ui-primitives";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

export type CmeEntryRouteClientProps = {
  readonly entry: CmeEntry | null;
  readonly set: CmeRequirementSet;
  readonly edit: boolean;
  readonly demoMode: boolean;
};

async function responseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown; message?: unknown };
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Not JSON. Fall through to the status line below.
  }
  return `Could not update this entry (${response.status}).`;
}

function updatePayload(entry: CmeEntry, draft: CmeEntryDraft, transcribed = entry.transcribed) {
  return {
    date: draft.date,
    title: draft.title,
    allocations: draft.allocations,
    reflection: draft.reflection,
    costCents: draft.costCents,
    routineId: draft.routineId,
    documentId: draft.documentId,
    sourceUrl: draft.sourceUrl ?? null,
    buckets: draft.buckets,
    formalPeerReviewHours: draft.formalPeerReviewHours ?? 0,
    transcribed,
  };
}

export function CmeEntryRouteClient({ entry, set, edit, demoMode }: CmeEntryRouteClientProps) {
  const router = useRouter();
  const [archivePending, setArchivePending] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveOverride, setArchiveOverride] = useState<boolean | null>(null);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const domains = set.requirements.flatMap((requirement) =>
    requirement.spec.shape === "activity-count" ? [...requirement.spec.buckets] : [],
  );

  if (!entry) return <CmeEntryPage entryId="missing" entries={[]} set={set} />;
  const archived = archiveOverride ?? Boolean(entry.archivedAt);
  const loadedEntry = { ...entry, archivedAt: archived ? (entry.archivedAt ?? "archived") : null };
  const readOnly = Boolean(set.closedAt) || archived;

  async function patchEntry(payload: object) {
    if (demoMode) throw new Error("Demo mode is read-only. Sign in to update a private CME record.");
    const response = await fetch(`/api/cme/entries/${loadedEntry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await responseError(response));
  }

  if (edit && !readOnly) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6" data-testid="cme-entry-edit">
        <button
          type="button"
          onClick={() => {
            if (!dirty || window.confirm("Discard your unsaved changes?")) router.push(`/cme/log/${loadedEntry.id}`);
          }}
          className="inline-flex min-h-tap items-center text-sm font-semibold text-[color:var(--clinical-accent)]"
        >
          Cancel editing
        </button>
        <h1 className="mt-3 text-xl font-semibold text-[color:var(--text)]">Edit activity</h1>
        <p className={cn(textMuted, "mt-1 text-sm")}>
          Review the whole record before saving. Cancel, link navigation, closing and reloading all guard unsaved
          changes.
        </p>
        {demoMode ? (
          <div className="mt-4">
            <InlineNotice tone="neutral">Demo mode is read-only; the form is shown for inspection.</InlineNotice>
          </div>
        ) : null}
        <div className="mt-6">
          <CmeEntryForm
            initialEntry={loadedEntry}
            availableDomains={domains}
            submitLabel="Save changes"
            onDirtyChange={setDirty}
            onSubmit={async (draft) => {
              await patchEntry(updatePayload(loadedEntry, draft));
              router.push(`/cme/log/${loadedEntry.id}`);
              router.refresh();
            }}
          />
        </div>
      </main>
    );
  }

  async function setArchived(next: boolean) {
    setArchivePending(true);
    setArchiveError(null);
    try {
      await patchEntry({ archived: next });
      setArchiveOverride(next);
      router.refresh();
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Could not change archive status.");
    } finally {
      setArchivePending(false);
    }
  }

  return (
    <CmeEntryPage
      entryId={loadedEntry.id}
      entries={[loadedEntry]}
      set={set}
      editHref={!readOnly ? `/cme/log/${loadedEntry.id}?edit=1` : undefined}
      readOnly={readOnly}
      actions={
        <section className="mt-4" aria-label="Archive activity">
          {readOnly ? (
            <p className={cn(textMuted, "mb-2 text-sm")}>
              {set.closedAt
                ? "This CPD year is closed. Records and evidence are view-only."
                : "Archived: excluded from totals, copies, exports and annual summaries. Sources and evidence are retained."}
            </p>
          ) : null}
          <Button
            disabled={demoMode || Boolean(set.closedAt) || archivePending}
            // Archiving asks first; restoring does not. Both are reversible,
            // but archiving takes the activity out of this year's totals and
            // was one stray tap away from the top of the page.
            onClick={() => (archived ? void setArchived(false) : setConfirmArchiveOpen(true))}
          >
            {archivePending ? "Saving…" : archived ? "Restore entry" : "Archive entry"}
          </Button>
          <ConfirmDialog
            open={confirmArchiveOpen}
            onCancel={() => setConfirmArchiveOpen(false)}
            onConfirm={() => {
              setConfirmArchiveOpen(false);
              void setArchived(true);
            }}
            title="Archive this activity?"
            description="It stops counting toward this year's hours and is left out of copies, exports and the annual summary. Its sources and evidence are kept, and you can restore it at any time."
            confirmLabel="Archive activity"
            tone="primary"
          />
          {archiveError ? (
            <p role="alert" className="mt-2 text-sm">
              {archiveError}
            </p>
          ) : null}
        </section>
      }
      onCopied={async () => {
        if (demoMode) throw new Error("Demo mode is read-only.");
        const response = await fetch(`/api/cme/entries/${loadedEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcribed: true }),
        });
        if (!response.ok) throw new Error(await responseError(response));
      }}
    >
      <CmeEvidencePanel
        key={loadedEntry.id}
        entryId={loadedEntry.id}
        readOnly={demoMode || readOnly}
        demoMode={demoMode}
      />
    </CmeEntryPage>
  );
}
