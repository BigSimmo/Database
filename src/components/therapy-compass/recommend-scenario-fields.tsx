"use client";

import { cn, eyebrowText, searchShell, searchShellInput } from "@/components/ui-primitives";
import { ChoiceChip } from "@/components/ui/chip";

import { RECOMMEND_CONSTRAINT_GROUPS, RECOMMEND_CONSTRAINTS } from "./data/select";

export type RecommendScenarioFieldsProps = {
  recQuery: string;
  setRecQuery: (q: string) => void;
  isConstraintActive: (key: string) => boolean;
  isConstraintInferred: (key: string) => boolean;
  toggleConstraint: (key: string) => void;
  /** Prefix for label/input ids — must be unique per mount (desktop vs sheet). */
  idPrefix: string;
};

export function RecommendScenarioFields({
  recQuery,
  setRecQuery,
  isConstraintActive,
  isConstraintInferred,
  toggleConstraint,
  idPrefix,
}: RecommendScenarioFieldsProps) {
  const situationId = `${idPrefix}-rec-q`;

  return (
    <>
      <label htmlFor={situationId} className="block text-xs font-semibold text-[color:var(--text-heading)]">
        Clinical situation
      </label>
      <div className={cn(searchShell, "mt-2 min-w-0 bg-[color:var(--surface)] px-2.5 py-2")}>
        <textarea
          id={situationId}
          value={recQuery}
          onChange={(event) => setRecQuery(event.target.value)}
          placeholder="e.g. 28-year-old with panic attacks in outpatient clinic, 15 minutes available, no trauma work yet"
          className={cn(
            searchShellInput,
            "min-h-20 resize-y py-1.5 text-base leading-normal text-[color:var(--text)] sm:text-sm",
          )}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {RECOMMEND_CONSTRAINT_GROUPS.map((group) => {
          const chips = RECOMMEND_CONSTRAINTS.filter((constraint) => constraint.group === group.id);
          return (
            <fieldset key={group.id} className="min-w-0">
              <legend className={cn(eyebrowText, "mb-2 px-0")}>{group.label}</legend>
              <div className="flex flex-wrap gap-2">
                {chips.map((constraint) => {
                  const active = isConstraintActive(constraint.key);
                  const inferred = isConstraintInferred(constraint.key);
                  return (
                    <ChoiceChip
                      key={constraint.key}
                      pressed={active}
                      onPressedChange={() => toggleConstraint(constraint.key)}
                      title={inferred ? `${constraint.label} — inferred from the situation` : undefined}
                    >
                      {constraint.label}
                    </ChoiceChip>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {RECOMMEND_CONSTRAINTS.some((constraint) => isConstraintInferred(constraint.key)) ? (
        <p className="mt-3 text-xs text-[color:var(--text-muted)]">
          From the situation: accent chips were inferred from the typed presentation. Toggle any chip to override.
        </p>
      ) : null}
    </>
  );
}
