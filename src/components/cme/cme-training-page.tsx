"use client";

import { GraduationCap, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { cardSurface } from "@/components/card-recipes";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { cn, EmptyState, eyebrowText, InlineNotice, textMuted } from "@/components/ui-primitives";
import { formatCalendarDateLong, perthCalendarDate } from "@/lib/cme/cpd-year";
import {
  currentPosition,
  formatFteMonths,
  fteMonthsAsOf,
  nextMilestone,
  trainingMilestoneInputSchema,
  trainingPeriodInputSchema,
  validateTrainingPeriods,
  type NextMilestone,
  type TrainingMilestone,
  type TrainingMilestoneDueKind,
  type TrainingPeriod,
  type TrainingPeriodKind,
  type TrainingPeriodProblem,
} from "@/lib/cme/training-timeline";

/**
 * TRAINING — the trainee's own record of their training: stages, rotations
 * and breaks, where they are today, the training clock, and the next
 * milestone due.
 *
 * Nothing is preloaded. The college's stage lengths and milestones are the
 * trainee's to enter from the college's current requirements; this page only
 * does arithmetic on what they wrote. It never reads or changes CPD targets.
 *
 * Every write goes through `/api/cme/training`; the server re-checks the whole
 * timeline before saving, and the same check runs here first so a problem is
 * shown beside the form rather than after a round trip.
 */

type RecordType = "period" | "milestone";

const periodKindLabels: Record<TrainingPeriodKind, string> = {
  stage: "Stage",
  rotation: "Rotation",
  break: "Break",
};

type PeriodDraft = { kind: TrainingPeriodKind; label: string; startsOn: string; endsOn: string; fte: string };
type MilestoneDraft = {
  label: string;
  dueKind: TrainingMilestoneDueKind;
  dueFteMonths: string;
  dueOn: string;
  completedOn: string;
};

type FieldErrors = Record<string, string>;

const emptyPeriodDraft: PeriodDraft = { kind: "rotation", label: "", startsOn: "", endsOn: "", fte: "1" };
const emptyMilestoneDraft: MilestoneDraft = {
  label: "",
  dueKind: "fte-months",
  dueFteMonths: "",
  dueOn: "",
  completedOn: "",
};

function periodToDraft(period: TrainingPeriod): PeriodDraft {
  return {
    kind: period.kind,
    label: period.label,
    startsOn: period.startsOn,
    endsOn: period.endsOn ?? "",
    fte: String(period.fte),
  };
}

function milestoneToDraft(milestone: TrainingMilestone): MilestoneDraft {
  return {
    label: milestone.label,
    dueKind: milestone.dueKind,
    dueFteMonths: milestone.dueFteMonths === null ? "" : String(milestone.dueFteMonths),
    dueOn: milestone.dueOn ?? "",
    completedOn: milestone.completedOn ?? "",
  };
}

/** A break always counts 0 and a stage's FTE is ignored, so only a rotation's field is the trainee's. */
function periodPayload(draft: PeriodDraft) {
  const fte = draft.kind === "break" ? 0 : draft.kind === "stage" ? 1 : Number(draft.fte);
  return {
    kind: draft.kind,
    label: draft.label,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn || null,
    fte: Number.isFinite(fte) ? fte : Number.NaN,
  };
}

function milestonePayload(draft: MilestoneDraft) {
  const months = draft.dueFteMonths.trim() === "" ? null : Number(draft.dueFteMonths);
  return {
    label: draft.label,
    dueKind: draft.dueKind,
    dueFteMonths: draft.dueKind === "fte-months" ? months : null,
    dueOn: draft.dueKind === "date" ? draft.dueOn || null : null,
    completedOn: draft.completedOn || null,
  };
}

function fieldErrorsOf(issues: readonly { path: readonly PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

async function apiError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;
  if (typeof payload?.message === "string") return payload.message;
  if (typeof payload?.error === "string") return payload.error;
  return `${fallback} (${response.status}).`;
}

function byStartThenLabel(a: TrainingPeriod, b: TrainingPeriod) {
  return a.startsOn.localeCompare(b.startsOn) || a.label.localeCompare(b.label);
}

function periodDates(period: TrainingPeriod): string {
  const start = formatCalendarDateLong(period.startsOn);
  return period.endsOn ? `${start} to ${formatCalendarDateLong(period.endsOn)}` : `${start}, ongoing`;
}

function formatFte(fte: number): string {
  return `${Number(fte.toFixed(2))} FTE`;
}

function milestoneDueText(milestone: TrainingMilestone): string {
  if (milestone.dueKind === "date") return milestone.dueOn ? `Due ${formatCalendarDateLong(milestone.dueOn)}` : "";
  return milestone.dueFteMonths === null ? "" : `Due at ${formatFteMonths(milestone.dueFteMonths)}`;
}

function nextDueDetail(next: NextMilestone, today: string): string {
  const { milestone, projectedOn, overdue, reason } = next;
  if (!projectedOn) return reason ?? "No date can be given for this milestone yet.";
  const date = formatCalendarDateLong(projectedOn);
  if (milestone.dueKind === "date") {
    if (overdue) return `Overdue: it was due on ${date}.`;
    return projectedOn === today ? "Due today." : `Due ${date}.`;
  }
  const target = milestone.dueFteMonths === null ? "its target" : formatFteMonths(milestone.dueFteMonths);
  if (overdue) return `Overdue: your training clock reached ${target} on ${date}, and it is not marked complete.`;
  if (projectedOn <= today) return `Due today: your training clock reaches ${target} today.`;
  return `Projected for ${date}, when your training clock reaches ${target} at your current FTE. This is an estimate, not a college date.`;
}

export function CmeTrainingPage({
  nowIso,
  initialPeriods,
  initialMilestones,
  demoMode,
}: {
  readonly nowIso: string;
  readonly initialPeriods: readonly TrainingPeriod[];
  readonly initialMilestones: readonly TrainingMilestone[];
  readonly demoMode: boolean;
}) {
  const router = useRouter();
  const today = perthCalendarDate(new Date(nowIso));
  const [periods, setPeriods] = useState<TrainingPeriod[]>(() => [...initialPeriods]);
  const [milestones, setMilestones] = useState<TrainingMilestone[]>(() => [...initialMilestones]);

  const [periodEditing, setPeriodEditing] = useState<string | "new" | null>(null);
  const [periodDraft, setPeriodDraft] = useState<PeriodDraft>(emptyPeriodDraft);
  const [periodErrors, setPeriodErrors] = useState<FieldErrors>({});
  const [periodProblems, setPeriodProblems] = useState<TrainingPeriodProblem[]>([]);

  const [milestoneEditing, setMilestoneEditing] = useState<string | "new" | null>(null);
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneDraft>(emptyMilestoneDraft);
  const [milestoneErrors, setMilestoneErrors] = useState<FieldErrors>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ type: RecordType; id: string; label: string } | null>(null);

  const periodHeadingRef = useRef<HTMLHeadingElement>(null);
  const milestoneHeadingRef = useRef<HTMLHeadingElement>(null);
  // The forms open where the add buttons are, which can be far down the page on
  // a phone; bring each into view and focus its heading when it opens.
  useEffect(() => {
    if (!periodEditing) return;
    periodHeadingRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    periodHeadingRef.current?.focus({ preventScroll: true });
  }, [periodEditing]);
  useEffect(() => {
    if (!milestoneEditing) return;
    milestoneHeadingRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    milestoneHeadingRef.current?.focus({ preventScroll: true });
  }, [milestoneEditing]);

  const orderedPeriods = [...periods].sort(byStartThenLabel);
  const storedProblems = validateTrainingPeriods(periods);
  const position = currentPosition(periods, today);
  const clock = fteMonthsAsOf(periods, today);
  const next = nextMilestone(milestones, periods, today);
  const isEmpty = periods.length === 0 && milestones.length === 0;

  function openPeriod(period?: TrainingPeriod) {
    setPeriodDraft(period ? periodToDraft(period) : emptyPeriodDraft);
    setPeriodEditing(period ? period.id : "new");
    setPeriodErrors({});
    setPeriodProblems([]);
    setError(null);
  }

  function openMilestone(milestone?: TrainingMilestone) {
    setMilestoneDraft(milestone ? milestoneToDraft(milestone) : emptyMilestoneDraft);
    setMilestoneEditing(milestone ? milestone.id : "new");
    setMilestoneErrors({});
    setError(null);
  }

  async function send(type: RecordType, id: string | "new", payload: object): Promise<Response> {
    const creating = id === "new";
    return fetch(creating ? "/api/cme/training" : `/api/cme/training/${id}`, {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    });
  }

  async function savePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!periodEditing || saving) return;
    setError(null);
    const parsed = trainingPeriodInputSchema.safeParse(periodPayload(periodDraft));
    if (!parsed.success) {
      setPeriodErrors(fieldErrorsOf(parsed.error.issues));
      setPeriodProblems([]);
      return;
    }
    setPeriodErrors({});
    const candidateId = periodEditing === "new" ? "__new__" : periodEditing;
    const candidate: TrainingPeriod = { id: candidateId, ...parsed.data };
    const proposed =
      periodEditing === "new" ? [...periods, candidate] : periods.map((p) => (p.id === periodEditing ? candidate : p));
    const problems = validateTrainingPeriods(proposed).filter((problem) => problem.periodIds.includes(candidateId));
    setPeriodProblems(problems);
    if (problems.length > 0) return;
    if (demoMode) {
      setError("Demo mode is read-only. Sign in to record your training.");
      return;
    }
    setSaving(true);
    try {
      const response = await send("period", periodEditing, parsed.data);
      if (!response.ok) throw new Error(await apiError(response, "Could not save this period"));
      const payload = (await response.json()) as { period: TrainingPeriod };
      setPeriods((current) =>
        periodEditing === "new"
          ? [...current, payload.period]
          : current.map((item) => (item.id === payload.period.id ? payload.period : item)),
      );
      setPeriodEditing(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this period.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!milestoneEditing || saving) return;
    setError(null);
    const parsed = trainingMilestoneInputSchema.safeParse(milestonePayload(milestoneDraft));
    if (!parsed.success) {
      setMilestoneErrors(fieldErrorsOf(parsed.error.issues));
      return;
    }
    setMilestoneErrors({});
    if (demoMode) {
      setError("Demo mode is read-only. Sign in to record your training.");
      return;
    }
    setSaving(true);
    try {
      const response = await send("milestone", milestoneEditing, parsed.data);
      if (!response.ok) throw new Error(await apiError(response, "Could not save this milestone"));
      const payload = (await response.json()) as { milestone: TrainingMilestone };
      setMilestones((current) =>
        milestoneEditing === "new"
          ? [...current, payload.milestone]
          : current.map((item) => (item.id === payload.milestone.id ? payload.milestone : item)),
      );
      setMilestoneEditing(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this milestone.");
    } finally {
      setSaving(false);
    }
  }

  async function setCompleted(milestone: TrainingMilestone, completedOn: string | null) {
    if (saving) return;
    if (demoMode) {
      setError("Demo mode is read-only. Sign in to record your training.");
      return;
    }
    setSaving(true);
    setError(null);
    const { id, ...fields } = milestone;
    try {
      const response = await send("milestone", id, { ...fields, completedOn });
      if (!response.ok) throw new Error(await apiError(response, "Could not update this milestone"));
      const payload = (await response.json()) as { milestone: TrainingMilestone };
      setMilestones((current) => current.map((item) => (item.id === payload.milestone.id ? payload.milestone : item)));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this milestone.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || saving) return;
    if (demoMode) {
      setError("Demo mode is read-only. Sign in to record your training.");
      setPendingDelete(null);
      return;
    }
    setSaving(true);
    setError(null);
    const { type, id } = pendingDelete;
    try {
      const response = await fetch(`/api/cme/training/${id}?type=${type}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await apiError(response, "Could not delete this record"));
      if (type === "period") setPeriods((current) => current.filter((item) => item.id !== id));
      else setMilestones((current) => current.filter((item) => item.id !== id));
      if (periodEditing === id) setPeriodEditing(null);
      if (milestoneEditing === id) setMilestoneEditing(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this record.");
    } finally {
      setSaving(false);
      setPendingDelete(null);
    }
  }

  const periodForm = periodEditing ? (
    <form
      onSubmit={(event) => void savePeriod(event)}
      noValidate
      className={cn(cardSurface, "mt-3 space-y-4 p-4")}
      data-testid="cme-training-period-form"
    >
      <h3
        ref={periodHeadingRef}
        tabIndex={-1}
        className="scroll-mt-24 text-lg font-semibold text-[color:var(--text-heading)] focus:outline-none"
      >
        {periodEditing === "new" ? "Add a stage, rotation or break" : "Edit period"}
      </h3>
      {demoMode ? <InlineNotice tone="neutral">Demo mode shows the form but cannot save it.</InlineNotice> : null}
      <Select
        label="Kind"
        id="cme-training-period-kind"
        value={periodDraft.kind}
        options={(["stage", "rotation", "break"] as const).map((kind) => ({
          value: kind,
          label: periodKindLabels[kind],
        }))}
        onChange={(event) => {
          const kind = event.target.value as TrainingPeriodKind;
          setPeriodDraft((current) => ({
            ...current,
            kind,
            fte: kind === "rotation" && (current.fte === "0" || current.fte === "") ? "1" : current.fte,
          }));
        }}
        hint="A stage holds rotations. A rotation counts toward your training clock. A break pauses it."
      />
      <TextField
        label="Label"
        id="cme-training-period-label"
        required
        value={periodDraft.label}
        error={periodErrors.label}
        onChange={(event) => setPeriodDraft((current) => ({ ...current, label: event.target.value }))}
      />
      <TextField
        label="Start date"
        id="cme-training-period-start"
        type="date"
        required
        value={periodDraft.startsOn}
        error={periodErrors.startsOn}
        onChange={(event) => setPeriodDraft((current) => ({ ...current, startsOn: event.target.value }))}
      />
      <TextField
        label="End date"
        id="cme-training-period-end"
        type="date"
        value={periodDraft.endsOn}
        error={periodErrors.endsOn}
        hint="Leave empty if it is still going."
        onChange={(event) => setPeriodDraft((current) => ({ ...current, endsOn: event.target.value }))}
      />
      {periodDraft.kind === "rotation" ? (
        <TextField
          label="FTE"
          id="cme-training-period-fte"
          type="number"
          inputMode="decimal"
          min="0.01"
          max="1"
          step="0.01"
          required
          value={periodDraft.fte}
          error={periodErrors.fte}
          hint="1 for full-time, 0.5 for half-time."
          onChange={(event) => setPeriodDraft((current) => ({ ...current, fte: event.target.value }))}
        />
      ) : null}
      {periodProblems.length > 0 ? (
        <InlineNotice tone="warning">
          <span data-testid="cme-training-period-problems">
            {periodProblems.map((problem) => problem.message).join(" ")}
          </span>
        </InlineNotice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…">
          Save period
        </Button>
        <Button type="button" variant="secondary" onClick={() => setPeriodEditing(null)}>
          Cancel
        </Button>
      </div>
    </form>
  ) : null;

  const milestoneForm = milestoneEditing ? (
    <form
      onSubmit={(event) => void saveMilestone(event)}
      noValidate
      className={cn(cardSurface, "mt-3 space-y-4 p-4")}
      data-testid="cme-training-milestone-form"
    >
      <h3
        ref={milestoneHeadingRef}
        tabIndex={-1}
        className="scroll-mt-24 text-lg font-semibold text-[color:var(--text-heading)] focus:outline-none"
      >
        {milestoneEditing === "new" ? "Add a milestone" : "Edit milestone"}
      </h3>
      {demoMode ? <InlineNotice tone="neutral">Demo mode shows the form but cannot save it.</InlineNotice> : null}
      <TextField
        label="Milestone"
        id="cme-training-milestone-label"
        required
        value={milestoneDraft.label}
        error={milestoneErrors.label}
        onChange={(event) => setMilestoneDraft((current) => ({ ...current, label: event.target.value }))}
      />
      <Select
        label="Due by"
        id="cme-training-milestone-due-kind"
        value={milestoneDraft.dueKind}
        options={[
          { value: "fte-months", label: "Training time (FTE months)" },
          { value: "date", label: "A date" },
        ]}
        onChange={(event) =>
          setMilestoneDraft((current) => ({ ...current, dueKind: event.target.value as TrainingMilestoneDueKind }))
        }
      />
      {milestoneDraft.dueKind === "fte-months" ? (
        <TextField
          label="FTE months"
          id="cme-training-milestone-months"
          type="number"
          inputMode="decimal"
          min="0.01"
          max="600"
          step="0.01"
          required
          value={milestoneDraft.dueFteMonths}
          error={milestoneErrors.dueFteMonths}
          hint="The training time it is due at, from your college's current requirements."
          onChange={(event) => setMilestoneDraft((current) => ({ ...current, dueFteMonths: event.target.value }))}
        />
      ) : (
        <TextField
          label="Due date"
          id="cme-training-milestone-due-on"
          type="date"
          required
          value={milestoneDraft.dueOn}
          error={milestoneErrors.dueOn}
          onChange={(event) => setMilestoneDraft((current) => ({ ...current, dueOn: event.target.value }))}
        />
      )}
      <TextField
        label="Completed on"
        id="cme-training-milestone-completed"
        type="date"
        value={milestoneDraft.completedOn}
        error={milestoneErrors.completedOn}
        hint="Leave empty until it is done."
        onChange={(event) => setMilestoneDraft((current) => ({ ...current, completedOn: event.target.value }))}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…">
          Save milestone
        </Button>
        <Button type="button" variant="secondary" onClick={() => setMilestoneEditing(null)}>
          Cancel
        </Button>
      </div>
    </form>
  ) : null;

  return (
    <main data-testid="cme-training" className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[color:var(--text)]">Training</h1>
      <p className={cn(textMuted, "mt-1 text-sm")}>
        Your own record of your training. It is not the college&apos;s record, and nothing here changes your CPD
        targets.
      </p>

      {error ? (
        <div className="mt-4">
          <InlineNotice tone="danger">{error}</InlineNotice>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="mt-6">
          <EmptyState
            testId="cme-training-empty"
            icon={GraduationCap}
            title="Nothing is preloaded here."
            body="Enter your own stages, rotations, breaks and milestones from your college's current requirements. The page then shows where you are, your training time so far, and what is due next."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <section
            aria-labelledby="cme-training-position-heading"
            data-testid="cme-training-position"
            className={cn(cardSurface, "p-4")}
          >
            <h2 id="cme-training-position-heading" className={eyebrowText}>
              You are here
            </h2>
            <p className="mt-2 font-semibold text-[color:var(--text)]" data-testid="cme-training-stage">
              {position.stage ? position.stage.label : "No stage covers today"}
            </p>
            {position.onBreak && position.breakPeriod ? (
              <p className="mt-1 text-sm text-[color:var(--text)]" data-testid="cme-training-on-break">
                On a break: {position.breakPeriod.label}. Your training clock is paused.
              </p>
            ) : position.rotation ? (
              <p className="mt-1 text-sm text-[color:var(--text)]" data-testid="cme-training-rotation">
                {position.rotation.label}
                {position.rotationIndex !== null && position.rotationCount !== null
                  ? `, rotation ${position.rotationIndex} of ${position.rotationCount}`
                  : ""}
                {position.rotation.fte < 1 ? `, at ${formatFte(position.rotation.fte)}` : ""}
              </p>
            ) : (
              <p className={cn(textMuted, "mt-1 text-sm")}>No rotation covers today.</p>
            )}
            <p className="mt-3 text-sm text-[color:var(--text)]" data-testid="cme-training-clock">
              Training time so far: <span className="font-semibold">{formatFteMonths(clock)}</span>
            </p>
            <p className={cn(textMuted, "mt-1 text-xs")}>
              Only rotations count. Half-time counts half, and breaks pause the clock.
            </p>
          </section>

          <section
            aria-labelledby="cme-training-next-heading"
            data-testid="cme-training-next"
            className={cn(cardSurface, "p-4")}
          >
            <h2 id="cme-training-next-heading" className={eyebrowText}>
              Next due
            </h2>
            {next ? (
              <>
                <p className="mt-2 font-semibold text-[color:var(--text)]">{next.milestone.label}</p>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    next.overdue ? "font-semibold text-[color:var(--danger)]" : "text-[color:var(--text)]",
                  )}
                  data-testid="cme-training-next-detail"
                >
                  {nextDueDetail(next, today)}
                </p>
              </>
            ) : (
              <p className={cn(textMuted, "mt-2 text-sm")} data-testid="cme-training-next-detail">
                {milestones.length === 0 ? "No milestones yet." : "Every milestone is marked complete."}
              </p>
            )}
          </section>
        </div>
      )}

      <section aria-labelledby="cme-training-periods-heading" className="mt-8">
        <h2 id="cme-training-periods-heading" className={eyebrowText}>
          Stages, rotations and breaks
        </h2>
        {storedProblems.length > 0 ? (
          <div className="mt-3">
            <InlineNotice tone="warning">
              <span data-testid="cme-training-timeline-problems">
                Your timeline has a problem to fix: {storedProblems.map((problem) => problem.message).join(" ")}
              </span>
            </InlineNotice>
          </div>
        ) : null}
        {orderedPeriods.length > 0 ? (
          <ul data-testid="cme-training-periods" className="mt-3 space-y-3">
            {orderedPeriods.map((period) => {
              const rowProblems = storedProblems.filter((problem) => problem.periodIds.includes(period.id));
              return (
                <li key={period.id} className={cn(cardSurface, "flex items-start justify-between gap-4 p-4")}>
                  <div className="min-w-0">
                    <p className="font-semibold text-[color:var(--text)]">
                      <span className={cn(eyebrowText, "mr-2")}>{periodKindLabels[period.kind]}</span>
                      {period.label}
                    </p>
                    <p className={cn(textMuted, "text-sm")}>
                      {periodDates(period)}
                      {period.kind === "rotation" ? ` · ${formatFte(period.fte)}` : ""}
                    </p>
                    {rowProblems.length > 0 ? (
                      <p className="mt-1 text-sm font-medium text-[color:var(--danger)]">
                        Overlaps another period. Change a date to fix it.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Button
                      variant="toolbar"
                      size="sm"
                      aria-label={`Edit ${period.label}`}
                      onClick={() => openPeriod(period)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="toolbar"
                      size="sm"
                      aria-label={`Delete ${period.label}`}
                      onClick={() => setPendingDelete({ type: "period", id: period.id, label: period.label })}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={cn(textMuted, "mt-3 text-sm")}>No periods yet.</p>
        )}
        {periodForm}
        {periodEditing ? null : (
          <div className="mt-3">
            <Button variant="secondary" icon={Plus} onClick={() => openPeriod()}>
              Add stage, rotation or break
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="cme-training-milestones-heading" className="mt-8">
        <h2 id="cme-training-milestones-heading" className={eyebrowText}>
          Milestones
        </h2>
        {milestones.length > 0 ? (
          <ul data-testid="cme-training-milestones" className="mt-3 space-y-3">
            {milestones.map((milestone) => (
              <li key={milestone.id} className={cn(cardSurface, "flex items-start justify-between gap-4 p-4")}>
                <div className="min-w-0">
                  <p className="font-semibold text-[color:var(--text)]">{milestone.label}</p>
                  <p className={cn(textMuted, "text-sm")}>
                    {milestone.completedOn
                      ? `Completed ${formatCalendarDateLong(milestone.completedOn)}`
                      : milestoneDueText(milestone)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {milestone.completedOn ? (
                    <Button
                      variant="toolbar"
                      size="sm"
                      aria-label={`Mark ${milestone.label} not complete`}
                      onClick={() => void setCompleted(milestone, null)}
                    >
                      Not complete
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Mark ${milestone.label} complete`}
                      onClick={() => void setCompleted(milestone, today)}
                    >
                      Mark complete
                    </Button>
                  )}
                  <Button
                    variant="toolbar"
                    size="sm"
                    aria-label={`Edit ${milestone.label}`}
                    onClick={() => openMilestone(milestone)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="toolbar"
                    size="sm"
                    aria-label={`Delete ${milestone.label}`}
                    onClick={() => setPendingDelete({ type: "milestone", id: milestone.id, label: milestone.label })}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn(textMuted, "mt-3 text-sm")}>No milestones yet.</p>
        )}
        {milestoneForm}
        {milestoneEditing ? null : (
          <div className="mt-3">
            <Button variant="secondary" icon={Plus} onClick={() => openMilestone()}>
              Add milestone
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={pendingDelete?.type === "milestone" ? "Delete this milestone?" : "Delete this period?"}
        description={`"${pendingDelete?.label ?? ""}" will be removed from your training record. This cannot be undone.`}
        confirmLabel={pendingDelete?.type === "milestone" ? "Delete milestone" : "Delete period"}
        busy={saving}
        busyLabel="Deleting…"
      />
    </main>
  );
}
