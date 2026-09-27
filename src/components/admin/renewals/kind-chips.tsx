import { focusRing } from "@/components/card-recipes";
import { cn } from "@/components/ui-primitives";
import { ADMIN_REQUIREMENT_GROUPS, type AdminRequirementGroup } from "@/lib/admin/requirements";

export type ChecklistKindFilter = "all" | AdminRequirementGroup;

const KIND_LABELS: Record<AdminRequirementGroup, string> = {
  registration: "Registration",
  checks: "Checks",
  health: "Health",
  training: "Training",
  job: "Job",
};

export const CHECKLIST_KIND_FILTERS: readonly ChecklistKindFilter[] = ["all", ...ADMIN_REQUIREMENT_GROUPS];

export function checklistKindLabel(kind: ChecklistKindFilter): string {
  return kind === "all" ? "All" : KIND_LABELS[kind];
}

/**
 * The kind filter row (final design, screens-v3): "All, Registration, Checks,
 * Health, Training, Job", no consequence-group labels. `aria-pressed`, not a
 * radio group — the list underneath is always fully present; a chip narrows
 * it rather than replacing it, the same choice On Call's now-withdrawn filter
 * row made (see `on-call-filter-chips.tsx`), but this row IS mounted, on the
 * owner's approval for Renewals specifically.
 */
export function ChecklistKindChips({
  active,
  onChange,
  testId,
}: {
  readonly active: ChecklistKindFilter;
  readonly onChange: (next: ChecklistKindFilter) => void;
  readonly testId?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Filter the checklist by kind"
      data-testid={testId}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      {CHECKLIST_KIND_FILTERS.map((kind) => {
        const selected = kind === active;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={selected}
            data-testid={testId ? `${testId}-${kind}` : undefined}
            onClick={() => onChange(kind)}
            className={cn(
              focusRing,
              "inline-flex min-h-tap shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
              selected
                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text)] hover:border-[color:var(--border-strong)]",
            )}
          >
            {checklistKindLabel(kind)}
          </button>
        );
      })}
    </div>
  );
}
