"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";

import { CmeAllocationField, isAllocationBalanced } from "@/components/cme/cme-allocation-field";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { TextField } from "@/components/ui/text-field";
import { cn, fieldControlPlain, fieldControlWithIcon, InlineNotice, textMuted } from "@/components/ui-primitives";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { cmeEntryCreateSchema } from "@/lib/cme/schemas";
import type { CmeAllocation } from "@/lib/cme/types";

/**
 * One activity, captured on one sheet: what it was, when, how many hours it
 * ran for, how those hours split across categories, a reflection in the
 * owner's own words, and what it cost.
 *
 * `statedHours` never reaches `onSubmit`. It exists only so the owner has a
 * figure to check the category split against while entering it — the number
 * that actually counts is always the sum of `allocations`, the same figure
 * `src/lib/cme/evaluate.ts` computes everywhere else. The Save control stays
 * disabled until that sum matches what the owner said the activity took.
 */

/** Common CME durations. Typing an exact figure into "Hours for this activity" always works too. */
const HOUR_PRESETS = [0.5, 1, 1.5, 2, 3, 4, 6, 8] as const;

export type CmeEntryDraft = z.infer<typeof cmeEntryCreateSchema>;

export type CmeEntryFormProps = {
  onSubmit: (entry: CmeEntryDraft) => Promise<void>;
};

/** `null` for blank or unparseable text — a cost the owner never actually stated, not a zero cost. */
function centsFromDollarText(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const dollars = Number(trimmed);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

function parsePositiveHours(raw: string): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function CmeEntryForm({ onSubmit }: CmeEntryFormProps) {
  // Bumped after every successful save to remount CmeAllocationField, which
  // otherwise has no way to clear its own typed-text state from outside.
  const [formKey, setFormKey] = useState(0);
  const [date, setDate] = useState(() => perthCalendarDate(new Date()));
  const [title, setTitle] = useState("");
  const [statedHoursText, setStatedHoursText] = useState("1");
  const [allocations, setAllocations] = useState<CmeAllocation[]>([]);
  const [allocatedTotal, setAllocatedTotal] = useState(0);
  const [reflection, setReflection] = useState("");
  const [costText, setCostText] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const statedHours = parsePositiveHours(statedHoursText);
  const balanced = isAllocationBalanced(allocatedTotal, statedHours);
  const costTrimmed = costText.trim();
  const costValid = costTrimmed === "" || centsFromDollarText(costTrimmed) !== null;

  const draft: CmeEntryDraft = {
    date,
    title: title.trim(),
    allocations,
    reflection,
    costCents: centsFromDollarText(costText),
    routineId: null,
    documentId: null,
    buckets: [],
  };
  const parsedDraft = cmeEntryCreateSchema.safeParse(draft);
  const canSave = balanced && allocations.length > 0 && costValid && parsedDraft.success;

  function handleAllocationChange(nextAllocations: readonly CmeAllocation[], total: number) {
    setAllocations([...nextAllocations]);
    setAllocatedTotal(total);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || saving || !parsedDraft.success) return;
    setSubmitError(null);
    setSaving(true);
    try {
      await onSubmit(parsedDraft.data);
      setDate(perthCalendarDate(new Date()));
      setTitle("");
      setStatedHoursText("1");
      setAllocations([]);
      setAllocatedTotal(0);
      setReflection("");
      setCostText("");
      setFormKey((key) => key + 1);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save this entry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5" noValidate>
      {submitError ? <InlineNotice tone="neutral">{submitError}</InlineNotice> : null}

      <TextField
        label="What was it"
        id="cme-entry-title"
        required
        placeholder="Grand round, course, reading…"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <TextField
        label="Date"
        id="cme-entry-date"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />

      <div>
        <TextField
          label="Hours for this activity"
          id="cme-entry-stated-hours"
          type="text"
          inputMode="decimal"
          value={statedHoursText}
          onChange={(event) => setStatedHoursText(event.target.value)}
        />
        <div role="group" aria-label="Quick-pick hours" className="mt-2 flex flex-wrap gap-2">
          {HOUR_PRESETS.map((preset) => {
            const selected = parsePositiveHours(statedHoursText) === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={selected}
                onClick={() => setStatedHoursText(String(preset))}
                className={cn(
                  "min-h-tap rounded-lg border px-3 text-sm font-semibold transition",
                  selected
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                )}
              >
                {String(preset)}
              </button>
            );
          })}
        </div>
      </div>

      <CmeAllocationField
        key={formKey}
        statedHours={statedHours}
        onChange={handleAllocationChange}
        idPrefix="cme-entry-allocation"
      />

      <FormField
        label="Reflection"
        id="cme-entry-reflection"
        hint="In your own words — this is the part an audit actually reads."
      >
        {(field) => (
          <textarea
            id={field.id}
            aria-describedby={field.describedBy}
            rows={2}
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            className={cn(fieldControlPlain, "h-auto min-h-16 resize-y py-2 leading-6")}
          />
        )}
      </FormField>

      <FormField label="What it cost" id="cme-entry-cost" describedBy="cme-entry-cost-optional">
        {(field) => (
          <>
            <div className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium",
                  textMuted,
                )}
              >
                $
              </span>
              <input
                id={field.id}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                aria-describedby={field.describedBy}
                value={costText}
                onChange={(event) => setCostText(event.target.value)}
                className={fieldControlWithIcon}
              />
            </div>
            <p id="cme-entry-cost-optional" data-testid="cme-cost-optional" className={cn("mt-1.5 text-xs", textMuted)}>
              Optional — leave this blank if it did not cost you anything.
            </p>
            {!costValid ? (
              <p className={cn("mt-1 text-xs font-medium", textMuted)}>Numbers only, like 45 or 45.50.</p>
            ) : null}
          </>
        )}
      </FormField>

      <Button type="submit" variant="primary" disabled={!canSave} busy={saving} busyLabel="Saving…" block>
        Save entry
      </Button>
    </form>
  );
}
