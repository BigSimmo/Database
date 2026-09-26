"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { cmeRoutineLogHref } from "@/components/cme/cme-route-navigation";
import { CmeRoutinesPage } from "@/components/cme/cme-routines-page";
import { cardSurface } from "@/components/card-recipes";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { cn, InlineNotice, textMuted } from "@/components/ui-primitives";
import {
  cmeRoutineCadenceLabels,
  cmeRoutineCadences,
  type CmeRoutine,
  type CmeRoutineCadence,
} from "@/lib/cme/routines";

type RoutineDraft = Omit<CmeRoutine, "id">;

const emptyDraft: RoutineDraft = {
  title: "",
  cadence: "monthly",
  usualHours: 1,
  usualAllocations: [],
  nextDue: null,
  archivedAt: null,
};

async function apiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;
  if (typeof payload?.message === "string") return payload.message;
  if (typeof payload?.error === "string") return payload.error;
  return `Could not save this routine (${response.status}).`;
}

export function CmeRoutinesRoute({
  nowIso,
  initialRoutines,
  demoMode,
}: {
  readonly nowIso: string;
  readonly initialRoutines: readonly CmeRoutine[];
  readonly demoMode: boolean;
}) {
  const router = useRouter();
  const [routines, setRoutines] = useState<CmeRoutine[]>(() => [...initialRoutines]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<RoutineDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The form renders above the list, so on a phone tapping Edit on a routine
  // further down opened it out of sight and looked like nothing happened.
  // Bring it into view and move focus to its heading each time it opens.
  const formHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!editingId) return;
    const heading = formHeadingRef.current;
    heading?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    heading?.focus({ preventScroll: true });
  }, [editingId]);

  function openNew() {
    setDraft(emptyDraft);
    setEditingId("new");
    setError(null);
  }
  function openEdit(routine: CmeRoutine) {
    const { id, ...next } = routine;
    setDraft(next);
    setEditingId(id);
    setError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || saving) return;
    if (demoMode) {
      setError("Demo mode is read-only. Sign in to save routines to a private CPD record.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const creating = editingId === "new";
      const response = await fetch(creating ? "/api/cme/routines" : `/api/cme/routines/${editingId}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const payload = (await response.json()) as { routine: CmeRoutine };
      setRoutines((current) =>
        creating
          ? [...current, payload.routine]
          : current.map((item) => (item.id === payload.routine.id ? payload.routine : item)),
      );
      setEditingId(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this routine.");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!editingId || editingId === "new" || saving) return;
    if (demoMode) {
      setError("Demo mode is read-only. Sign in to archive a private routine.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const archivedDraft = { ...draft, archivedAt: new Date().toISOString() };
      const response = await fetch(`/api/cme/routines/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(archivedDraft),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const payload = (await response.json()) as { routine: CmeRoutine };
      setRoutines((current) => current.map((item) => (item.id === payload.routine.id ? payload.routine : item)));
      setEditingId(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not archive this routine.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {editingId ? (
        <section
          className="mx-auto mt-6 w-[calc(100%-2rem)] max-w-3xl sm:w-[calc(100%-3rem)]"
          data-testid="cme-routine-form"
        >
          <form onSubmit={(event) => void save(event)} className={cn(cardSurface, "space-y-4 p-4")}>
            {/* h2: the page's own "Routines" heading below is its one h1. */}
            <h2
              ref={formHeadingRef}
              tabIndex={-1}
              className="scroll-mt-24 text-lg font-semibold text-[color:var(--text-heading)] focus:outline-none"
            >
              {editingId === "new" ? "New routine" : "Edit routine"}
            </h2>
            {demoMode ? (
              <InlineNotice tone="neutral">Demo mode shows the full routine form but cannot save it.</InlineNotice>
            ) : null}
            {error ? <InlineNotice tone="neutral">{error}</InlineNotice> : null}
            <TextField
              label="Routine name"
              id="cme-routine-title"
              required
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
            <label className="block text-sm font-medium text-[color:var(--text)]" htmlFor="cme-routine-cadence">
              Cadence
              <select
                id="cme-routine-cadence"
                value={draft.cadence}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, cadence: event.target.value as CmeRoutineCadence }))
                }
                className="mt-1 min-h-tap w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3"
              >
                {cmeRoutineCadences.map((cadence) => (
                  <option key={cadence} value={cadence}>
                    {cmeRoutineCadenceLabels[cadence]}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Usual hours"
              id="cme-routine-hours"
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={draft.usualHours}
              onChange={(event) =>
                setDraft((current) => ({ ...current, usualHours: Number(event.target.value), usualAllocations: [] }))
              }
              hint="Changing the duration clears the saved category split; review the split when you log the activity."
            />
            <TextField
              label="Next due"
              id="cme-routine-next-due"
              type="date"
              value={draft.nextDue ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, nextDue: event.target.value || null }))}
            />
            <p className={cn(textMuted, "text-xs")}>
              Logging this routine opens a pre-filled activity. Nothing is recorded until you review and save it.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…">
                Save routine
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
              {editingId !== "new" ? (
                <Button type="button" variant="toolbar" onClick={() => void archive()}>
                  Archive routine
                </Button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}
      <CmeRoutinesPage
        routines={routines}
        now={new Date(nowIso)}
        onLogRoutine={(prefill) => router.push(cmeRoutineLogHref(prefill))}
        onNewRoutine={openNew}
        onEditRoutine={openEdit}
      />
    </>
  );
}
