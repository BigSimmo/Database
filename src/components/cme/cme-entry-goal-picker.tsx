"use client";

import Link from "next/link";
import { useState } from "react";

import { cn, textMuted } from "@/components/ui-primitives";
import type { CmePlanGoal } from "@/lib/cme/plan-goals";

/**
 * "Which goal did this serve?" on one activity's page. Saves as soon as a
 * choice is made, says so, and puts the old choice back if the save fails.
 */
export function CmeEntryGoalPicker({
  entryId,
  goals,
  initialGoalId,
  readOnly,
}: {
  entryId: string;
  goals: readonly CmePlanGoal[];
  initialGoalId: string | null;
  readOnly: boolean;
}) {
  const [goalId, setGoalId] = useState<string | null>(initialGoalId);
  const [status, setStatus] = useState<string | null>(null);

  if (goals.length === 0) {
    return (
      <p className={cn(textMuted, "text-sm")} data-testid="cme-entry-goal-none">
        No plan goals for this year yet.{" "}
        <Link
          href="/cme/plan"
          className="inline-flex min-h-tap items-center font-semibold text-[color:var(--clinical-accent)]"
        >
          Write your plan
        </Link>
      </p>
    );
  }

  async function choose(next: string | null) {
    const previous = goalId;
    setGoalId(next);
    setStatus("Saving…");
    try {
      const response = await fetch(`/api/cme/entries/${entryId}/goal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: next }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? `Could not save the goal (${response.status}).`);
      }
      setStatus("Saved.");
    } catch (error) {
      setGoalId(previous);
      setStatus(error instanceof Error ? error.message : "Could not save the goal.");
    }
  }

  return (
    <div data-testid="cme-entry-goal">
      <label className="block text-sm font-medium text-[color:var(--text)]" htmlFor={`cme-entry-goal-${entryId}`}>
        Which goal from your plan did this serve?
      </label>
      <select
        id={`cme-entry-goal-${entryId}`}
        value={goalId ?? ""}
        disabled={readOnly}
        onChange={(event) => void choose(event.target.value || null)}
        className="mt-1 block min-h-tap w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--text)]"
      >
        <option value="">No goal</option>
        {goals.map((goal) => (
          <option key={goal.id} value={goal.id}>
            {goal.goal}
          </option>
        ))}
      </select>
      <p role="status" className={cn(textMuted, "mt-1 text-xs")}>
        {status}
      </p>
    </div>
  );
}
