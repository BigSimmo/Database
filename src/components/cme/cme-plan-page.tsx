"use client";

import { Check, NotebookPen, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cardSurface } from "@/components/card-recipes";
import { cn, eyebrowText, floatingControl, InlineNotice, primaryControl, textMuted } from "@/components/ui-primitives";
import { formatCalendarDateLong } from "@/lib/cme/cpd-year";
import {
  CME_PLAN_GOAL_MAX,
  CME_PLAN_GOAL_MAX_LENGTH,
  CME_PLAN_GOAL_MIN_LENGTH,
  hoursByGoal,
  type CmePlanGoal,
} from "@/lib/cme/plan-goals";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

/**
 * DEVELOPMENT PLAN — the year's goals, written once near the start of the
 * year and checked against as it goes.
 *
 * Three parts: the goals themselves (edited as a list and saved in one step),
 * whether the plan is marked written for the year's requirement, and at the
 * bottom how the year's hours have fallen across the goals. Each activity
 * names its goal on its own page, so the tally fills in as activities are
 * linked.
 *
 * The goals are the owner's own words. The app suggests nothing.
 */

type Draft = { key: string; id?: string; goal: string };

let draftKey = 0;
function nextKey(): string {
  draftKey += 1;
  return `goal-${draftKey}`;
}

export function CmePlanPage({
  set,
  goals,
  entries,
  demoMode = false,
}: {
  set: CmeRequirementSet;
  goals: readonly CmePlanGoal[];
  entries: readonly CmeEntry[];
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    goals.length
      ? goals.map((goal) => ({ key: nextKey(), id: goal.id, goal: goal.goal }))
      : [{ key: nextKey(), goal: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const readOnly = Boolean(set.closedAt) || demoMode;
  const planRequirement = set.requirements.find((requirement) => requirement.id === "plan");
  const tally = hoursByGoal(goals, entries);
  const filled = drafts.filter((draft) => draft.goal.trim().length > 0);
  const tooShort = filled.some((draft) => draft.goal.trim().length < CME_PLAN_GOAL_MIN_LENGTH);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/cme/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: set.year,
          goals: filled.map((draft) =>
            draft.id ? { id: draft.id, goal: draft.goal.trim() } : { goal: draft.goal.trim() },
          ),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        goals?: CmePlanGoal[];
        message?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.message ?? `Could not save your plan (${response.status}).`);
      setDrafts((payload?.goals ?? []).map((goal) => ({ key: nextKey(), id: goal.id, goal: goal.goal })));
      setMessage("Plan saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main data-testid="cme-plan" className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <p className={eyebrowText}>{set.year}</p>
      <h1 className="mt-1 text-xl font-semibold text-[color:var(--text)]">Development plan</h1>
      <p className={cn(textMuted, "mt-1 text-sm")}>
        Three to five goals for the year, in your own words. Link each activity to the goal it served from the
        activity&rsquo;s page, and the hours add up below.
      </p>

      {demoMode ? (
        <div className="mt-4">
          <InlineNotice tone="neutral">Demo mode is read-only; the plan is shown for inspection.</InlineNotice>
        </div>
      ) : null}
      {set.closedAt ? (
        <div className="mt-4">
          <InlineNotice tone="neutral">This CPD year is closed. Its plan is view-only.</InlineNotice>
        </div>
      ) : null}

      <section className={cn(cardSurface, "mt-5 p-4")} aria-labelledby="cme-plan-goals">
        <h2 id="cme-plan-goals" className="text-base font-semibold text-[color:var(--text)]">
          Goals
        </h2>
        <ol className="mt-3 flex flex-col gap-3" data-testid="cme-plan-goals">
          {drafts.map((draft, index) => (
            <li key={draft.key} className="flex items-start gap-2">
              <span className={cn(textMuted, "nums mt-3 w-5 shrink-0 text-sm")}>{index + 1}.</span>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Goal {index + 1}</span>
                <textarea
                  value={draft.goal}
                  readOnly={readOnly}
                  maxLength={CME_PLAN_GOAL_MAX_LENGTH}
                  rows={2}
                  placeholder="For example: improve how I document capacity assessments"
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((item) => (item.key === draft.key ? { ...item, goal: event.target.value } : item)),
                    )
                  }
                  className="block min-h-tap w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text)]"
                />
              </label>
              {!readOnly ? (
                <button
                  type="button"
                  aria-label={`Remove goal ${index + 1}`}
                  onClick={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))}
                  className="grid size-12 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]"
                >
                  <Trash2 aria-hidden="true" className="size-icon-sm" />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        {!readOnly ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={floatingControl}
              disabled={drafts.length >= CME_PLAN_GOAL_MAX}
              onClick={() => setDrafts((current) => [...current, { key: nextKey(), goal: "" }])}
            >
              <Plus aria-hidden="true" className="size-icon-sm" />
              Add a goal
            </button>
            <button
              type="button"
              className={primaryControl}
              disabled={saving || tooShort}
              onClick={() => void save()}
              data-testid="cme-plan-save"
            >
              {saving ? "Saving…" : "Save plan"}
            </button>
          </div>
        ) : null}
        {tooShort ? (
          <p className={cn(textMuted, "mt-2 text-sm")}>
            Each goal needs at least {CME_PLAN_GOAL_MIN_LENGTH} characters.
          </p>
        ) : null}
        <p role="status" className="mt-2 text-sm font-semibold text-[color:var(--text)]" data-testid="cme-plan-message">
          {message}
        </p>
      </section>

      <section className={cn(cardSurface, "mt-4 flex items-start gap-3 p-4")} data-testid="cme-plan-status">
        {planRequirement?.completedOn ? (
          <Check aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--text)]" />
        ) : (
          <NotebookPen aria-hidden="true" className={cn("mt-0.5 size-icon-md shrink-0", textMuted)} />
        )}
        <div className="min-w-0 text-sm">
          {planRequirement?.completedOn ? (
            <p className="font-semibold text-[color:var(--text)]">
              Plan written {formatCalendarDateLong(planRequirement.completedOn)}.
            </p>
          ) : (
            <>
              <p className="font-semibold text-[color:var(--text)]">Not yet marked as written.</p>
              <p className={textMuted}>
                Once your goals are in, record the date on{" "}
                <Link
                  href="/cme/setup#cme-setup-steps"
                  className="inline-flex min-h-tap items-center font-semibold text-[color:var(--clinical-accent)]"
                >
                  the setup page
                </Link>{" "}
                so the year counts it as done.
              </p>
            </>
          )}
          <Link
            href={`/cme/new?title=${encodeURIComponent("Writing my professional development plan")}`}
            className="inline-flex min-h-tap items-center font-semibold text-[color:var(--clinical-accent)]"
          >
            Log the time you spent on it
          </Link>
        </div>
      </section>

      {goals.length > 0 ? (
        <section className="mt-6" aria-labelledby="cme-plan-tally">
          <h2 id="cme-plan-tally" className={cn(eyebrowText, "mb-2")}>
            Hours by goal
          </h2>
          <ul className="flex flex-col gap-2" data-testid="cme-plan-tally">
            {tally.map((row) => (
              <li
                key={row.goal?.id ?? "none"}
                className={cn(cardSurface, "flex items-center justify-between gap-3 p-3")}
              >
                <span className={cn("min-w-0 text-sm", row.goal ? "text-[color:var(--text)]" : textMuted)}>
                  {row.goal ? row.goal.goal : "Not linked to a goal"}
                </span>
                <span className="nums shrink-0 text-sm font-semibold text-[color:var(--text)]">
                  {row.hours} h · {row.entryCount}
                  <span className="sr-only"> {row.entryCount === 1 ? "activity" : "activities"}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
