import { ON_CALL_COMPLIANCE_BANDS } from "@/components/on-call/on-call-page-sections";
import type { OnCallComplianceConsequence } from "@/lib/on-call/entry-model";

/**
 * Spec rule 2: urgency is a shape and plain words, in grey. Josh, 16:31Z: a renewal
 * that stops you working gets "a quiet icon and the words 'Stops you working'". The
 * shapes come from `ON_CALL_COMPLIANCE_BANDS` (Task 6 changes them to triangle,
 * diamond, ring and dash), so Today and Renewals can never disagree. Never red: a
 * passed date is said in words by the row, not by this mark (16:45Z review).
 */
export function AdminUrgencyMark({ consequence }: { consequence: OnCallComplianceConsequence | null }) {
  const band =
    ON_CALL_COMPLIANCE_BANDS.find((candidate) => candidate.consequence === consequence) ??
    ON_CALL_COMPLIANCE_BANDS[ON_CALL_COMPLIANCE_BANDS.length - 1];
  const Icon = band.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-muted)]">
      <Icon aria-hidden="true" className="size-icon-xs shrink-0" />
      {band.heading}
    </span>
  );
}
