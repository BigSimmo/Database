import { catalogueItemForEntry } from "@/components/admin/renewals/catalogue-lookup";
import { ChecklistPressableRow, ChecklistRowActionButton } from "@/components/admin/renewals/checklist-row";
import { ChecklistStatus } from "@/components/admin/renewals/checklist-status";
import type { ChecklistKindFilter } from "@/components/admin/renewals/kind-chips";
import { checklistKindLabel } from "@/components/admin/renewals/kind-chips";
import { requirementDateLine, requirementRowUrgency } from "@/components/admin/renewals/urgency";
import { ModeGroupedList } from "@/components/mode-kit/grouped-list";
import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import type {
  AdminRequirementCatalogueItem,
  RequirementChecklistRow,
  RequirementRowState,
} from "@/lib/admin/requirements";
import { complianceExpiresOn } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

const STATE_HEADINGS: Record<RequirementRowState, string> = {
  "needs-action": "Soonest first",
  "no-end-date": "No end date",
  "not-recorded": "Not recorded yet",
};

function groupRows(rows: readonly RequirementChecklistRow[], filter: ChecklistKindFilter) {
  if (filter !== "all") return [{ heading: checklistKindLabel(filter), rows }];
  const order: RequirementRowState[] = ["needs-action", "no-end-date", "not-recorded"];
  return order
    .map((state) => ({ heading: STATE_HEADINGS[state], rows: rows.filter((row) => row.state === state) }))
    .filter((group) => group.rows.length > 0);
}

/**
 * The checklist's main list: grouped by state under "All" (soonest first, no
 * end date, not recorded yet — final design, screens-v3), or by the selected
 * kind chip's own single heading. Ends in the "Not for this job" section,
 * always last, with its own "Move back" action.
 */
export function ChecklistList({
  rows,
  notForThisJob,
  filter,
  now,
  canEdit = true,
  onOpen,
  onAddDate,
  onMoveBack,
  testId = "admin-renewals-checklist",
}: {
  readonly rows: readonly RequirementChecklistRow[];
  readonly notForThisJob: readonly OnCallEntry[];
  readonly filter: ChecklistKindFilter;
  readonly now: Date;
  readonly canEdit?: boolean;
  readonly onOpen: (item: AdminRequirementCatalogueItem, entry: OnCallEntry | null) => void;
  readonly onAddDate: (item: AdminRequirementCatalogueItem) => void;
  readonly onMoveBack: (entry: OnCallEntry) => void;
  readonly testId?: string;
}) {
  const filtered = filter === "all" ? rows : rows.filter((row) => row.item.group === filter);
  const groups = groupRows(filtered, filter);
  const filteredNotForThisJob = notForThisJob.filter((entry) => {
    if (filter === "all") return true;
    return catalogueItemForEntry(entry)?.group === filter;
  });

  return (
    <div className="grid min-w-0 gap-5" data-testid={testId}>
      {groups.map((group) => (
        <ModeGroupedList key={group.heading} eyebrow={group.heading} testId={`${testId}-group-${group.heading}`}>
          {group.rows.map((row) => {
            const urgency = requirementRowUrgency(row, now);
            const showAddDate = row.state === "not-recorded";
            return (
              <ChecklistPressableRow
                key={row.item.id}
                title={row.item.title}
                subtitle={requirementDateLine(row.expiresOn, now) ?? (showAddDate ? "Not recorded yet" : undefined)}
                meta={
                  row.item.status === "needs-checking" ? (
                    <span className={cn(textMuted, "text-xs")}>Check with your service</span>
                  ) : null
                }
                statusTrailing={showAddDate ? undefined : <ChecklistStatus urgency={urgency} />}
                actionTrailing={
                  showAddDate && canEdit ? (
                    <ChecklistRowActionButton
                      label="Add date"
                      onClick={() => onAddDate(row.item)}
                      testId={`${testId}-add-date-${row.item.id}`}
                    />
                  ) : undefined
                }
                onOpen={() => onOpen(row.item, row.entry)}
                anchorId={row.entry ? onCallEntryAnchorId(row.entry.id) : undefined}
                testId={`${testId}-row-${row.item.id}`}
              />
            );
          })}
        </ModeGroupedList>
      ))}

      {filteredNotForThisJob.length > 0 ? (
        <section aria-labelledby={`${testId}-not-for-this-job-heading`} className="grid gap-2">
          <h2 id={`${testId}-not-for-this-job-heading`} className={eyebrowText}>
            Not for this job
          </h2>
          <ModeGroupedList testId={`${testId}-not-for-this-job`}>
            {filteredNotForThisJob.map((entry) => {
              const item = catalogueItemForEntry(entry);
              const expiresOn = complianceExpiresOn(entry);
              return (
                <ChecklistPressableRow
                  key={entry.id}
                  title={item?.title ?? entry.title}
                  subtitle={requirementDateLine(expiresOn, now) ?? "Not recorded yet"}
                  meta={
                    item?.status === "needs-checking" ? (
                      <span className={cn(textMuted, "text-xs")}>Check with your service</span>
                    ) : null
                  }
                  actionTrailing={
                    canEdit ? (
                      <ChecklistRowActionButton
                        label="Move back"
                        onClick={() => onMoveBack(entry)}
                        testId={`${testId}-move-back-${entry.slug}`}
                      />
                    ) : undefined
                  }
                  onOpen={() => (item ? onOpen(item, entry) : undefined)}
                  anchorId={onCallEntryAnchorId(entry.id)}
                  testId={`${testId}-not-for-this-job-row-${entry.slug}`}
                />
              );
            })}
          </ModeGroupedList>
        </section>
      ) : null}

      <p className={cn(textMuted, "px-1 text-xs")}>Linked to your account only, not shared with your health service.</p>
    </div>
  );
}
