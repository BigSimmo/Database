"use client";

import { ClipboardList, Pill } from "lucide-react";
import { useMemo } from "react";

import { BadgeCluster, type ClinicalBadgeItem } from "@/components/clinical-dashboard/clinical-badge";
import { usePatientProfile } from "@/components/clinical-dashboard/patient-profile-context";
import { evaluateMedicationInteractions, type MedicationVerdict } from "@/lib/medication-interactions";
import {
  evaluatePatientAlerts,
  noticeToneForSemanticTone,
  type MedicationConsideration,
} from "@/lib/medication-patient-alerts";
import type { MedicationRecord } from "@/lib/medications";
import type { SemanticTone } from "@/lib/semantic-tone";
import { cn, InlineNotice } from "@/components/ui-primitives";

/**
 * Verdict edge for the DESKTOP results table rows, which sit in a divided list
 * and already own their edge with an inset `ring-*` for selection.
 *
 * The phone cards do not use this. Their edge is set in `globals.css` via
 * `.medication-mobile-result[data-verdict="…"]`, because the existing
 * `[data-selected="true"]` rule there is unlayered and pins `border-color` —
 * a Tailwind border utility loses to it on exactly the top hit. Two mechanisms,
 * one per surface, each matching what that surface already used.
 */
export function medicationVerdictRingClass(tone: SemanticTone): string | null {
  const byTone: Record<SemanticTone, string | null> = {
    danger: "ring-1 ring-inset ring-[color:var(--danger-border)]",
    warning: "ring-1 ring-inset ring-[color:var(--warning-border)]",
    success: "ring-1 ring-inset ring-[color:var(--success-border)]",
    clinical: "ring-1 ring-inset ring-[color:var(--clinical-accent)]/40",
    info: "ring-1 ring-inset ring-[color:var(--info-border)]",
    // Neutral keeps the list's own divider as its edge — see the border variant.
    neutral: null,
  };
  return byTone[tone];
}

/**
 * One badge summarising the composed verdict for a result row.
 *
 * Returns null when there is nothing to say — no patient profile entered, or an
 * unremarkable medication with no findings and nothing unread.
 */
export function verdictSummaryBadge(verdict: MedicationVerdict): ClinicalBadgeItem | null {
  const findings = verdict.interactionCount + verdict.considerationCount;
  if (findings > 0) {
    const parts: string[] = [];
    if (verdict.interactionCount > 0) {
      parts.push(`${verdict.interactionCount} interaction${verdict.interactionCount === 1 ? "" : "s"}`);
    }
    if (verdict.considerationCount > 0) {
      parts.push(`${verdict.considerationCount} alert${verdict.considerationCount === 1 ? "" : "s"}`);
    }
    return { id: "patient-verdict", label: parts.join(" · "), tone: verdict.tone };
  }
  if (verdict.incomplete) {
    return { id: "patient-verdict", label: "Needs manual review", tone: "neutral" };
  }
  return { id: "patient-verdict", label: "No interaction found", tone: "success" };
}

/** Badge for a result row summarising how many considerations apply. */
export function considerationSummaryBadge(count: number, highestTone: SemanticTone | null): ClinicalBadgeItem | null {
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

      <MedicationInteractionBlock record={record} />
    </section>
  );
}

/**
 * Interactions between this medication and the patient's current medication list.
 *
 * Three branches, mirroring the considerations block above — and a fourth that
 * only this surface has: when the catalogue carries interaction rows whose
 * counterparty could not be machine-resolved, that is stated plainly instead of
 * being folded into the all-clear. "We found nothing" and "we could not read
 * some of it" are different claims, and only the first is reassuring.
 */
function MedicationInteractionBlock({ record }: { record: MedicationRecord }) {
  const { profile } = usePatientProfile();
  const result = useMemo(
    () => evaluateMedicationInteractions(record.slug, profile.medications ?? [], record),
    [record, profile.medications],
  );

  const hasList = (profile.medications ?? []).length > 0;
  const medicationCount = profile.medications?.length ?? 0;

  return (
    <section aria-label="Interactions with current medications" className="space-y-2 pt-1">
      <div className="flex items-center gap-2">
        <Pill className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
        <h3 className="text-sm-minus font-semibold text-[color:var(--text-heading)]">
          Interactions with this patient&rsquo;s medications
        </h3>
        {result.interactions.length > 0 ? (
          <span className="rounded-full bg-[color:var(--surface-subtle)] px-2 py-0.5 text-2xs font-semibold text-[color:var(--text-muted)]">
            {result.interactions.length}
          </span>
        ) : null}
      </div>

      {!hasList ? (
        <div className="rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3 text-sm text-[color:var(--text-muted)]">
          Add the patient&rsquo;s current medications to cross-check them against this drug&rsquo;s{" "}
          {result.totalRowCount} catalogued interaction {result.totalRowCount === 1 ? "row" : "rows"}.
        </div>
      ) : result.interactions.length === 0 ? (
        <InlineNotice tone={result.unresolvedRowCount > 0 ? "neutral" : "success"}>
          No interaction found between this medication and the {medicationCount}{" "}
          {medicationCount === 1 ? "medication" : "medications"} entered. Always confirm against source.
        </InlineNotice>
      ) : (
        <div className="space-y-2">
          {result.interactions.map((interaction) => (
            <InlineNotice key={interaction.id} tone={noticeToneForSemanticTone(interaction.tone)}>
              <div className="min-w-0 space-y-1.5" data-testid={`patient-interaction-${interaction.id}`}>
                <BadgeCluster
                  items={[
                    {
                      id: `${interaction.id}-counterparty`,
                      label: `With ${interaction.counterpartyName}`,
                      tone: interaction.tone,
                    },
                    { id: `${interaction.id}-kind`, label: interaction.kind, tone: "neutral" as const },
                  ]}
                  compact
                />
                {/* Verbatim catalogue text — never a paraphrase. */}
                {interaction.note ? (
                  <p className="text-xs leading-5 text-[color:var(--text-heading)]">{interaction.note}</p>
                ) : null}
              </div>
            </InlineNotice>
          ))}
        </div>
      )}

      {result.unresolvedRowCount > 0 ? (
        <InlineNotice tone="neutral">
          {result.unresolvedRowCount} of this medication&rsquo;s {result.totalRowCount} interaction{" "}
          {result.totalRowCount === 1 ? "row" : "rows"} could not be matched automatically — review the Key Interactions
          section below manually. This medication is not shown as clear.
        </InlineNotice>
      ) : null}
    </section>
  );
}
