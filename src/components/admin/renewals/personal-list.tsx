import { ChecklistPressableRow } from "@/components/admin/renewals/checklist-row";
import { ChecklistStatus } from "@/components/admin/renewals/checklist-status";
import { requirementDateLine } from "@/components/admin/renewals/urgency";
import { modeModuleSurface } from "@/components/mode-kit/recipes";
import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";
import { Button } from "@/components/ui/button";
import { cn, textMuted } from "@/components/ui-primitives";
import { complianceExpiresOn } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { perthCalendarDate } from "@/lib/cme/cpd-year";

/** The Personal tab's own, simpler status word: this axis has no catalogue
 *  "start renewing" lead time to draw from unless the entry itself carries a
 *  `leadTimeDays`, so a personal row reads "Recorded" once a date exists, a
 *  diamond once that date has passed, or "Not recorded yet" with a dashed ring. */
function personalStatus(entry: OnCallEntry, now: Date) {
  const expiresOn = complianceExpiresOn(entry);
  if (!expiresOn) return { shape: "ring" as const, word: "Not recorded yet" };
  if (expiresOn < perthCalendarDate(now)) return { shape: "diamond" as const, word: "Date passed" };
  return { shape: null, word: "Recorded" };
}

export function PersonalRenewalsList({
  entries,
  now,
  canEdit = true,
  onOpen,
  onAdd,
  testId = "admin-renewals-personal",
}: {
  readonly entries: readonly OnCallEntry[];
  readonly now: Date;
  readonly canEdit?: boolean;
  readonly onOpen: (entry: OnCallEntry) => void;
  readonly onAdd: () => void;
  readonly testId?: string;
}) {
  if (entries.length === 0) {
    return (
      <div className={cn(modeModuleSurface, "grid gap-2 p-4")} data-testid={`${testId}-empty`}>
        <p className="text-base-minus font-medium text-[color:var(--text-heading)]">No personal renewals</p>
        {canEdit ? (
          <>
            <p className={cn(textMuted, "text-sm")}>Add one that isn&rsquo;t on the checklist.</p>
            <div>
              <Button variant="primary" onClick={onAdd} testId={`${testId}-empty-add`}>
                Add a renewal
              </Button>
            </div>
          </>
        ) : null}
      </div>
    );
  }
  return (
    <ul role="list" className={cn(modeModuleSurface)} data-testid={testId}>
      {entries.map((entry) => {
        const expiresOn = complianceExpiresOn(entry);
        return (
          <ChecklistPressableRow
            key={entry.id}
            title={entry.title}
            subtitle={requirementDateLine(expiresOn, now)}
            statusTrailing={<ChecklistStatus urgency={personalStatus(entry, now)} />}
            onOpen={() => onOpen(entry)}
            anchorId={onCallEntryAnchorId(entry.id)}
            testId={`${testId}-row-${entry.slug}`}
          />
        );
      })}
    </ul>
  );
}
