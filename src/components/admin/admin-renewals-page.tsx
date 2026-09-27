"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminFloatingAdd } from "@/components/admin/admin-floating-add";
import { AdminQuickAddSheet } from "@/components/admin/admin-quick-add-sheet";
import { AdminRenewedSheet } from "@/components/admin/admin-renewed-sheet";
import { isPersonalRenewal } from "@/components/admin/renewals/catalogue-lookup";
import { ChecklistList } from "@/components/admin/renewals/checklist-list";
import { ChecklistKindChips, type ChecklistKindFilter } from "@/components/admin/renewals/kind-chips";
import { ChecklistItemDetailSheet, type ChecklistItemSubject } from "@/components/admin/renewals/item-detail-sheet";
import { ChecklistSummary } from "@/components/admin/renewals/checklist-summary";
import { PersonalRenewalsList } from "@/components/admin/renewals/personal-list";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { focusRing } from "@/components/card-recipes";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { cn, floatingControl, textMuted } from "@/components/ui-primitives";
import { downloadTextFile } from "@/lib/admin/download-file";
import {
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

type RenewSubject = { entry: OnCallEntry | null; createItem?: (typeof ADMIN_REQUIREMENTS_CATALOGUE)[number] };

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
  const [undoBar, setUndoBar] = useState<{ message: string; undo: () => void } | null>(null);

  useEffect(() => {
    if (!undoBar) return;
    const timer = window.setTimeout(() => setUndoBar(null), 6000);
    return () => window.clearTimeout(timer);
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
    const response = await fetch(`/api/on-call/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildNotForThisJobToggleBody(entry, flag)),
    });
    if (!response.ok) throw await parseApiErrorResponse(response);
    const payload: unknown = await response.json();
    const parsed = onCallEntrySchema.safeParse((payload as { entry?: unknown } | null)?.entry);
    if (!parsed.success) throw new Error("Save response was invalid.");
    upsert(parsed.data);
    setUndoBar({
      message: flag ? `Not for this job · ${entry.title}` : `Moved back · ${entry.title}`,
      undo: () => {
        void (async () => {
          const restore = await fetch(`/api/on-call/entries/${entry.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildRestoreEntryBody(entry)),
          });
          if (!restore.ok) return;
          const restoredPayload: unknown = await restore.json();
          const restoredParsed = onCallEntrySchema.safeParse((restoredPayload as { entry?: unknown } | null)?.entry);
          if (restoredParsed.success) upsert(restoredParsed.data);
          setUndoBar(null);
        })();
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
                onMoveBack={(entry) => void setNotForThisJob(entry, false)}
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
          <span className="text-sm text-[color:var(--text)]">{undoBar.message}</span>
          <button
            type="button"
            onClick={undoBar.undo}
            className={cn(focusRing, "min-h-tap px-2 text-sm font-medium text-[color:var(--clinical-accent)]")}
          >
            Undo
          </button>
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
        onNotForThisJob={(entry, flag) => setNotForThisJob(entry, flag)}
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
      />

      <AdminQuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onSaved={upsert} />
    </InformationPageShell>
  );
}
