"use client";

import { useId, useState, type ReactNode } from "react";

import { catalogueItemForEntry } from "@/components/admin/renewals/catalogue-lookup";
import { ChecklistPressableRow, ChecklistRowActionButton } from "@/components/admin/renewals/checklist-row";
import { ChecklistStatus } from "@/components/admin/renewals/checklist-status";
import type { ChecklistKindFilter } from "@/components/admin/renewals/kind-chips";
import { checklistKindLabel } from "@/components/admin/renewals/kind-chips";
import { requirementDateLine, requirementRowUrgency } from "@/components/admin/renewals/urgency";
import { ModeGroupedList } from "@/components/mode-kit/grouped-list";
import { modeModuleSurface } from "@/components/mode-kit/recipes";
import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";
import { Button } from "@/components/ui/button";
import { cn, eyebrowText, floatingControl, textMuted } from "@/components/ui-primitives";
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

/** How many not-recorded rows show before "Show all N". */
export const NOT_RECORDED_PREVIEW_ROWS = 5;

/**
 * What the "Record dates" slot above "Not recorded yet" offers: the button
 * that opens the step-through sheet, or — when editing is unavailable — the
 * plain reason, never a button that pretends to work.
 */
export type RecordDatesSlot =
  { readonly kind: "button"; readonly onOpen: () => void } | { readonly kind: "note"; readonly text: string };

/**
 * "Not recorded yet", with its count beside the heading (outside the
 * heading's own name, so it still reads exactly "Not recorded yet"), the
 * "Record dates" entry point, and the first five rows before "Show all N".
 */
function NotRecordedGroup({
  heading,
  rows,
  recordDates,
  renderRow,
  testId,
}: {
  readonly heading: string;
  readonly rows: readonly RequirementChecklistRow[];
  readonly recordDates?: RecordDatesSlot;
  readonly renderRow: (row: RequirementChecklistRow) => ReactNode;
  readonly testId: string;
}) {
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, NOT_RECORDED_PREVIEW_ROWS);
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-2" data-testid={testId}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3">
        <span className="flex items-baseline gap-1">
          <h2 id={headingId} className={eyebrowText}>
            {heading}
          </h2>
          <span className={cn(eyebrowText, "nums")} data-testid={`${testId}-count`}>
            <span aria-hidden="true">{"· "}</span>
            {rows.length}
          </span>
        </span>
        {recordDates?.kind === "button" ? (
          <Button variant="secondary" size="sm" onClick={recordDates.onOpen} testId="admin-renewals-record-dates">
            Record dates
          </Button>
        ) : recordDates?.kind === "note" ? (
          <span className={cn(textMuted, "text-xs")} data-testid="admin-renewals-record-dates-note">
            {recordDates.text}
          </span>
        ) : null}
      </div>
      <ul role="list" className={modeModuleSurface}>
        {shown.map(renderRow)}
      </ul>
      {!expanded && rows.length > NOT_RECORDED_PREVIEW_ROWS ? (
        <button
          type="button"
          className={cn(floatingControl, "justify-self-start")}
          onClick={() => setExpanded(true)}
          data-testid={`${testId}-show-all`}
        >
          {`Show all ${rows.length}`}
        </button>
      ) : null}
    </section>
  );
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
  recordDates,
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
  /** The "Record dates" slot shown beside "Not recorded yet" (under "All" only). */
  readonly recordDates?: RecordDatesSlot;
  readonly testId?: string;
}) {
  const filtered = filter === "all" ? rows : rows.filter((row) => row.item.group === filter);
  const groups = groupRows(filtered, filter);
  const filteredNotForThisJob = notForThisJob.filter((entry) => {
    if (filter === "all") return true;
    return catalogueItemForEntry(entry)?.group === filter;
  });

  const renderRow = (row: RequirementChecklistRow, inNotRecordedGroup: boolean) => {
    const urgency = requirementRowUrgency(row, now);
    const showAddDate = row.state === "not-recorded";
    // Under "Not recorded yet" the group heading already says it; under a
    // kind chip the row mixes with recorded ones, so it keeps its own line.
    const notRecordedLine = showAddDate && !inNotRecordedGroup ? "Not recorded yet" : undefined;
    return (
      <ChecklistPressableRow
        key={row.item.id}
        title={row.item.title}
        subtitle={requirementDateLine(row.expiresOn, now) ?? notRecordedLine}
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
  };

  return (
    <div className="grid min-w-0 gap-5" data-testid={testId}>
      {groups.map((group) =>
        filter === "all" && group.heading === STATE_HEADINGS["not-recorded"] ? (
          <NotRecordedGroup
            key={group.heading}
            heading={group.heading}
            rows={group.rows}
            recordDates={recordDates}
            testId={`${testId}-group-${group.heading}`}
            renderRow={(row) => renderRow(row, true)}
          />
        ) : (
          <ModeGroupedList key={group.heading} eyebrow={group.heading} testId={`${testId}-group-${group.heading}`}>
            {group.rows.map((row) => renderRow(row, false))}
          </ModeGroupedList>
        ),
      )}

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
