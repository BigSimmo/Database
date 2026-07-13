"use client";

import { ClipboardList } from "lucide-react";
import { useMemo } from "react";

import {
  BadgeCluster,
  type ClinicalBadgeItem,
} from "@/components/clinical-dashboard/clinical-badge";
import { usePatientProfile } from "@/components/clinical-dashboard/patient-profile-context";
import {
  evaluatePatientAlerts,
  noticeToneForSemanticTone,
  type MedicationConsideration,
} from "@/lib/medication-patient-alerts";
import type { MedicationRecord } from "@/lib/medications";
import type { SemanticTone } from "@/lib/semantic-tone";
import { cn, InlineNotice } from "@/components/ui-primitives";

/** Badge for a result row summarising how many considerations apply. */
export function considerationSummaryBadge(
  count: number,
  highestTone: SemanticTone | null,
): ClinicalBadgeItem | null {
  if (!count || !highestTone) return null;
  return {
    id: "patient-alerts",
    label: `${count} alert${count === 1 ? "" : "s"}`,
    tone: highestTone,
  };
}

function considerationBadges(consideration: MedicationConsideration): ClinicalBadgeItem[] {
  return [
    ...consideration.factorLabels.map((label, index) => ({
      id: `${consideration.id}-factor-${index}`,
      label,
      tone: consideration.tone,
    })),
    ...consideration.reasons.map((reason, index) => ({
      id: `${consideration.id}-reason-${index}`,
      label: reason,
      tone: "neutral" as const,
    })),
  ];
}

/**
 * Detail-page block: evaluates the entered profile against a single medication
 * and renders the applicable considerations, an all-clear when none apply, and a
 * hint for any contraindication gate the profile did not supply.
 */
export function MedicationConsiderations({ record, className }: { record: MedicationRecord; className?: string }) {
  const { profile, isEmpty } = usePatientProfile();
  const result = useMemo(() => evaluatePatientAlerts(record, profile), [record, profile]);

  return (
    <section aria-label="Patient considerations" className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
        <h2 className="text-sm-minus font-semibold text-[color:var(--text-heading)]">
          Considerations for this patient
        </h2>
        {!isEmpty && result.considerations.length > 0 ? (
          <span className="rounded-full bg-[color:var(--surface-subtle)] px-2 py-0.5 text-2xs font-semibold text-[color:var(--text-muted)]">
            {result.considerations.length}
          </span>
        ) : null}
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3 text-sm text-[color:var(--text-muted)]">
          Enter patient details above to surface dosing, safety, and contraindication considerations for this
          medication.
        </div>
      ) : result.considerations.length === 0 ? (
        <InlineNotice tone="success">
          No matching considerations for the entered patient profile. Always confirm against source.
        </InlineNotice>
      ) : (
        <div className="space-y-2">
          {result.considerations.map((consideration) => (
            <InlineNotice key={consideration.id} tone={noticeToneForSemanticTone(consideration.tone)}>
              <div className="min-w-0 space-y-1.5" data-testid={`patient-consideration-${consideration.id}`}>
                <BadgeCluster items={considerationBadges(consideration)} compact />
                {consideration.note ? (
                  <p className="text-xs leading-5 text-[color:var(--text-heading)]">{consideration.note}</p>
                ) : null}
              </div>
            </InlineNotice>
          ))}
        </div>
      )}

      {!isEmpty && result.unassessed.length > 0 ? (
        <InlineNotice tone="info">
          Enter {result.unassessed.join(", ")} to fully assess this medication&rsquo;s contraindications.
        </InlineNotice>
      ) : null}
    </section>
  );
}
