"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AdminFloatingAdd } from "@/components/admin/admin-floating-add";
import { AdminQuickAddSheet } from "@/components/admin/admin-quick-add-sheet";
import { AdminRenewedSheet } from "@/components/admin/admin-renewed-sheet";
import { catalogueItemForEntry, isPersonalRenewal } from "@/components/admin/renewals/catalogue-lookup";
import { ChecklistList } from "@/components/admin/renewals/checklist-list";
import { ChecklistKindChips, type ChecklistKindFilter } from "@/components/admin/renewals/kind-chips";
import { ChecklistItemDetailSheet, type ChecklistItemSubject } from "@/components/admin/renewals/item-detail-sheet";
import { ChecklistSummary } from "@/components/admin/renewals/checklist-summary";
import { PersonalRenewalsList } from "@/components/admin/renewals/personal-list";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { focusRing } from "@/components/card-recipes";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";
import { EmptyState, InlineNotice } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { cn, floatingControl, textMuted } from "@/components/ui-primitives";
import { downloadTextFile } from "@/lib/admin/download-file";
import {
  buildNotForThisJobCreateBody,
  buildNotForThisJobToggleBody,
  buildRestoreEntryBody,
  renewalsCalendarFile,
  workforceCopyText,
} from "@/lib/admin/renewals";
import {
  ADMIN_REQUIREMENTS_CATALOGUE,
  requirementChecklistRows,
  requirementsNotForThisJob,
  requirementsRecordedCount,
} from "@/lib/admin/requirements";
import { adminLoadState, selectAdminOwnEntries } from "@/lib/admin/own-entries";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { onCallEntrySchema, type OnCallEntry } from "@/lib/on-call/entry-model";
import { cacheOnCallEntries, useOnCallEntries } from "@/lib/on-call/entry-store";
import { parseApiErrorResponse } from "@/lib/api-client-error";

type CatalogueItem = (typeof ADMIN_REQUIREMENTS_CATALOGUE)[number];
type RenewSubject = { entry: OnCallEntry | null; createItem?: CatalogueItem };

/** Design: "Undo for 10 s" (M9). The bar stays past this while an undo is failing. */
const UNDO_WINDOW_MS = 10_000;

type UndoBar = {
  readonly message: string;
  readonly undo: () => Promise<void>;
  /** Set once an undo attempt failed: the bar then stays, with Retry, until it works or is dismissed. */
  readonly failed?: boolean;
};

/** A failed save that is not an undo ("Move back"): shown as a neutral notice with Retry. */
type FailedAction = { readonly message: string; readonly retry: () => Promise<void> };

async function parsedEntry(response: Response): Promise<OnCallEntry> {
  if (!response.ok) throw await parseApiErrorResponse(response);
  const payload: unknown = await response.json();
  const parsed = onCallEntrySchema.safeParse((payload as { entry?: unknown } | null)?.entry);
  if (!parsed.success) throw new Error("Save response was invalid.");
  return parsed.data;
}

/**
 * Renewals (final design, screens-v3): a Checklist tab built from the
 * statewide Requirements catalogue (`src/lib/admin/requirements.ts`), and a
 * Personal tab for the reader's own items that aren't on it. Every fact this
 * page reads was recorded by the reader; nothing is checked with an issuer —
 * see `src/lib/on-call/compliance.ts`, "What this page may never say".
 */
export function AdminRenewalsPage({ now: nowProp }: { now?: Date } = {}) {
  const state = useOnCallEntries();
  const mountedAt = useMemo(() => new Date(), []);
  const now = nowProp ?? mountedAt;
  // `cacheOnCallEntries` (called from `upsert` below) writes through to the
  // shared store; this counter forces a fresh read of `state.entries` right
  // after it does, so a save is reflected on this page immediately rather
  // than waiting on some other, unrelated state change to trigger a render.
  const [entryVersion, setEntryVersion] = useState(0);
  // `entryVersion` is never read inside the callback below; it exists only to
  // force this memo to re-run right after `upsert` writes to the (possibly
  // mocked) shared store, since `state` itself may not change reference on
  // every write.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const own = useMemo(() => selectAdminOwnEntries(state), [state, entryVersion]);
  const loadState = adminLoadState(state);
  const ready = loadState === "ready";
  const [signInOpen, setSignInOpen] = useState(false);

  const [tab, setTab] = useState<"checklist" | "personal">("checklist");
  const [kindFilter, setKindFilter] = useState<ChecklistKindFilter>("all");
  const [detailSubject, setDetailSubject] = useState<ChecklistItemSubject | null>(null);
  // `renewSubject` is kept across a close (not nulled) so a dismissed
  // half-filled sheet stays in memory for the same subject, per Addendum A;
  // `renewOpen` is the sheet's own visibility.
  const [renewSubject, setRenewSubject] = useState<RenewSubject | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const [undoBar, setUndoBar] = useState<UndoBar | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [failedAction, setFailedAction] = useState<FailedAction | null>(null);

  useEffect(() => {
    if (!undoBar || undoBar.failed) return;
    const timer = setTimeout(() => setUndoBar(null), UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [undoBar]);

  const rows = useMemo(() => requirementChecklistRows(ADMIN_REQUIREMENTS_CATALOGUE, own), [own]);
  const counts = useMemo(() => requirementsRecordedCount(ADMIN_REQUIREMENTS_CATALOGUE, own), [own]);
  // The same selector Today's "N not for this job" reads, so the two agree.
  const notForThisJob = useMemo(
    () => requirementsNotForThisJob(ADMIN_REQUIREMENTS_CATALOGUE, own).map(({ entry }) => entry),
    [own],
  );
  const personalEntries = useMemo(() => own.filter((entry) => isPersonalRenewal(entry)), [own]);

  function upsert(entry: OnCallEntry) {
    cacheOnCallEntries([...state.entries.filter((existing) => existing.id !== entry.id), entry]);
    setEntryVersion((version) => version + 1);
  }

  function removeEntry(id: string) {
    cacheOnCallEntries(state.entries.filter((existing) => existing.id !== id));
    setEntryVersion((version) => version + 1);
  }

  // A link to one entry (`/admin/renewals#on-call-entry-<id>`: Today's
  // "Renewed", Needs you, an old `/on-call/compliance#…` bookmark) opens that
  // entry's detail sheet once the reader's rows have loaded, so "Renewed" is
  // the next tap. Each hash opens once; a later hashchange opens the new one.
  const openedHash = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    function openFromHash() {
      const hash = window.location.hash.slice(1);
      if (!hash.startsWith("on-call-entry-") || openedHash.current === hash) return;
      const entry = own.find((candidate) => onCallEntryAnchorId(candidate.id) === hash);
      if (!entry) return;
      const item = catalogueItemForEntry(entry);
      if (item) {
        openedHash.current = hash;
        setTab("checklist");
        setDetailSubject({ kind: "catalogue", item, entry });
      } else if (isPersonalRenewal(entry)) {
        openedHash.current = hash;
        setTab("personal");
        setDetailSubject({ kind: "personal", entry });
      }
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [ready, own]);

  async function runUndo(bar: UndoBar) {
    setUndoBusy(true);
    try {
      await bar.undo();
      setUndoBar(null);
    } catch {
      // Spec "Offline" / design point 11: a failed save stays on screen with Retry.
      setUndoBar({ ...bar, failed: true });
    } finally {
      setUndoBusy(false);
    }
  }

  async function moveBack(entry: OnCallEntry) {
    setFailedAction(null);
    try {
      await setNotForThisJob(entry, false);
    } catch {
      setFailedAction({ message: `Couldn't move back ${entry.title}.`, retry: () => moveBack(entry) });
    }
  }

  async function copyForWorkforce() {
    const text = workforceCopyText(own, now);
    try {
      await copyTextToClipboard(text);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  function downloadAll() {
    const file = renewalsCalendarFile(own, now);
    if (file) downloadTextFile(file, "renewals.ics", "text/calendar;charset=utf-8");
  }

  async function setNotForThisJob(entry: OnCallEntry, flag: boolean) {
    const saved = await parsedEntry(
      await fetch(`/api/on-call/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildNotForThisJobToggleBody(entry, flag)),
      }),
    );
    upsert(saved);
    setUndoBar({
      message: flag ? `Not for this job · ${entry.title}` : `Moved back · ${entry.title}`,
      undo: async () => {
        const restored = await parsedEntry(
          await fetch(`/api/on-call/entries/${entry.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildRestoreEntryBody(entry)),
          }),
        );
        upsert(restored);
      },
    });
  }

  /** "Not for this job" on a catalogue item never recorded: a minimal row, and Undo deletes it. */
  async function markItemNotForThisJob(item: CatalogueItem) {
    const created = await parsedEntry(
      await fetch("/api/on-call/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildNotForThisJobCreateBody(item, crypto.randomUUID().slice(0, 6))),
      }),
    );
    upsert(created);
    setUndoBar({
      message: `Not for this job · ${item.title}`,
      undo: async () => {
        const response = await fetch(`/api/on-call/entries/${created.id}`, { method: "DELETE" });
        if (!response.ok) throw await parseApiErrorResponse(response);
        removeEntry(created.id);
      },
    });
  }

  return (
    <InformationPageShell testId="admin-renewals-main">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold text-[color:var(--text-heading)]">Renewals</h1>
        <p className={cn(textMuted, "text-sm")}>Source: Medical Board, WA Health · Updated 26 Sep 2026</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyForWorkforce()}
          disabled={!ready}
          data-testid="admin-renewals-copy"
          className={cn(floatingControl, "disabled:cursor-not-allowed disabled:opacity-60")}
        >
          {copy === "copied" ? "Copied" : "Copy for workforce"}
        </button>
        <button
          type="button"
          onClick={downloadAll}
          disabled={!ready}
          data-testid="admin-renewals-calendar-all"
          className={cn(floatingControl, "disabled:cursor-not-allowed disabled:opacity-60")}
        >
          Add all to my calendar
        </button>
      </div>
      {copy === "failed" ? (
        <textarea
          readOnly
          value={workforceCopyText(own, now)}
          aria-label="Text to copy for workforce"
          className="min-h-24 w-full rounded-lg border border-[color:var(--border)] p-3 text-sm"
        />
      ) : null}

      {loadState === "loading" ? (
        <ModeModuleSkeleton rows={6} twoLine testId="admin-renewals-loading" />
      ) : loadState === "failed" ? (
        <EmptyState
          title="Couldn't load your renewals"
          body="Check your connection and try again."
          actions={
            <Button variant="primary" onClick={state.retry} testId="admin-renewals-retry">
              Retry
            </Button>
          }
          testId="admin-renewals-failed"
        />
      ) : loadState === "signed-out" ? (
        <>
          <EmptyState
            title="Sign in to see your renewals"
            body="Renewals are kept for your signed-in account only."
            actions={
              <Button variant="primary" onClick={() => setSignInOpen(true)}>
                Sign in
              </Button>
            }
            testId="admin-renewals-signed-out"
          />
          <AccountSetupDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
        </>
      ) : (
        <>
          <Tabs
            label="Renewals"
            value={tab}
            onChange={(value) => setTab(value as "checklist" | "personal")}
            items={[
              { id: "checklist", label: "Checklist" },
              { id: "personal", label: "Personal" },
            ]}
          />

          {failedAction ? (
            <div data-testid="admin-renewals-action-failed">
              <InlineNotice tone="neutral">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>{failedAction.message}</span>
                  <button
                    type="button"
                    onClick={() => void failedAction.retry()}
                    className={cn(focusRing, "min-h-tap px-2 text-sm font-medium text-[color:var(--clinical-accent)]")}
                  >
                    Retry
                  </button>
                </span>
              </InlineNotice>
            </div>
          ) : null}

          {tab === "checklist" ? (
            <div className="grid gap-4">
              <ChecklistSummary
                rows={rows}
                recorded={counts.recorded}
                total={counts.total}
                notForThisJob={notForThisJob.length}
                now={now}
                testId="admin-renewals-summary"
              />
              <ChecklistKindChips active={kindFilter} onChange={setKindFilter} testId="admin-renewals-kind" />
              <ChecklistList
                rows={rows}
                notForThisJob={notForThisJob}
                filter={kindFilter}
                now={now}
                onOpen={(item, entry) => setDetailSubject({ kind: "catalogue", item, entry })}
                onAddDate={(item) => {
                  setRenewSubject({ entry: null, createItem: item });
                  setRenewOpen(true);
                }}
                onMoveBack={(entry) => void moveBack(entry)}
              />
            </div>
          ) : (
            <PersonalRenewalsList
              entries={personalEntries}
              now={now}
              onOpen={(entry) => setDetailSubject({ kind: "personal", entry })}
              onAdd={() => setQuickAddOpen(true)}
            />
          )}
        </>
      )}

      {undoBar ? (
        <div
          data-testid="admin-renewals-undo-bar"
          className="fixed inset-x-4 bottom-20 z-[var(--z-chrome)] flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 shadow-[var(--e4)]"
        >
          <span className="text-sm text-[color:var(--text)]">
            {undoBar.failed ? `Undo didn't save · ${undoBar.message}` : undoBar.message}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {undoBar.failed ? (
              <button
                type="button"
                onClick={() => setUndoBar(null)}
                className={cn(focusRing, "min-h-tap px-2 text-sm text-[color:var(--text-muted)]")}
              >
                Dismiss
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void runUndo(undoBar)}
              disabled={undoBusy}
              className={cn(
                focusRing,
                "min-h-tap px-2 text-sm font-medium text-[color:var(--clinical-accent)] disabled:opacity-60",
              )}
            >
              {undoBar.failed ? "Retry" : "Undo"}
            </button>
          </span>
        </div>
      ) : null}

      {ready ? (
        <AdminFloatingAdd label="Add a renewal" onClick={() => setQuickAddOpen(true)} testId="admin-renewals-add" />
      ) : null}

      <ChecklistItemDetailSheet
        subject={detailSubject}
        now={now}
        onClose={() => setDetailSubject(null)}
        onRenew={() => {
          if (!detailSubject) return;
          setDetailSubject(null);
          if (detailSubject.kind === "catalogue") {
            setRenewSubject(
              detailSubject.entry ? { entry: detailSubject.entry } : { entry: null, createItem: detailSubject.item },
            );
          } else {
            setRenewSubject({ entry: detailSubject.entry });
          }
          setRenewOpen(true);
        }}
        onNotForThisJob={(item, entry, flag) => (entry ? setNotForThisJob(entry, flag) : markItemNotForThisJob(item))}
      />

      <AdminRenewedSheet
        key={renewSubject?.entry?.id ?? renewSubject?.createItem?.id ?? "none"}
        open={renewOpen}
        entry={renewSubject?.entry ?? null}
        createItem={renewSubject?.createItem}
        onClose={() => setRenewOpen(false)}
        onSaved={(entry) => {
          upsert(entry);
          setUndoBar(null);
        }}
        onRemoved={removeEntry}
      />

      <AdminQuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onSaved={upsert} />
    </InformationPageShell>
  );
}
