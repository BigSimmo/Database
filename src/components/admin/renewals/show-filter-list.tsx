import { ChecklistPressableRow, ChecklistRowActionButton } from "@/components/admin/renewals/checklist-row";
import { ChecklistStatus } from "@/components/admin/renewals/checklist-status";
import { personalStatus } from "@/components/admin/renewals/personal-list";
import { requirementDateLine, requirementRowUrgency } from "@/components/admin/renewals/urgency";
import { modeModuleSurface } from "@/components/mode-kit/recipes";
import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";
import { Button } from "@/components/ui/button";
import { cn, textMuted } from "@/components/ui-primitives";
import { RENEWALS_SHOW_LABELS, type RenewalsFilterItem, type RenewalsShowFilter } from "@/lib/admin/renewals-filters";
import type { AdminRequirementCatalogueItem } from "@/lib/admin/requirements";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * The Checklist narrowed by a link from Today (`?show=date-passed|due-90|
 * not-recorded`): a plain "Showing: <label> · N" line with Clear, then the
 * matching rows — catalogue items and personal renewals alike, read through
 * the same `renewalsShowMatches` Today counted with, so the count Today
 * showed and the rows here always agree.
 */
export function RenewalsShowFilterList({
  filter,
  matches,
  now,
  canEdit,
  onClear,
  onOpenCatalogue,
  onOpenPersonal,
  onAddDate,
  onRecordDates,
  testId = "admin-renewals-show",
}: {
  readonly filter: RenewalsShowFilter;
  readonly matches: readonly RenewalsFilterItem[];
  readonly now: Date;
  readonly canEdit: boolean;
  readonly onClear: () => void;
  readonly onOpenCatalogue: (item: AdminRequirementCatalogueItem, entry: OnCallEntry | null) => void;
  readonly onOpenPersonal: (entry: OnCallEntry) => void;
  readonly onAddDate: (item: AdminRequirementCatalogueItem) => void;
  /** Offered with the "Not recorded" view when editing is available. */
  readonly onRecordDates?: () => void;
  readonly testId?: string;
}) {
  const label = RENEWALS_SHOW_LABELS[filter];
  return (
    <div className="grid min-w-0 gap-3" data-testid={testId}>
      <div
        className={cn(
          modeModuleSurface,
          "flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1",
        )}
        data-testid={`${testId}-notice`}
      >
        <p className="nums text-sm font-medium text-[color:var(--text-heading)]" role="status">
          {`Showing: ${label} · ${matches.length}`}
        </p>
        <span className="flex flex-wrap items-center gap-2">
          {onRecordDates && matches.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={onRecordDates} testId={`${testId}-record-dates`}>
              Record dates
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClear} testId={`${testId}-clear`}>
            Clear
          </Button>
        </span>
      </div>

      {matches.length === 0 ? (
        <p className={cn(textMuted, "px-1 text-sm")} data-testid={`${testId}-empty`}>
          Nothing to show here right now.
        </p>
      ) : (
        <ul role="list" className={modeModuleSurface} data-testid={`${testId}-list`}>
          {matches.map((match) => {
            if (match.kind === "personal") {
              const { entry } = match;
              return (
                <ChecklistPressableRow
                  key={entry.id}
                  title={entry.title}
                  subtitle={requirementDateLine(match.expiresOn, now) ?? undefined}
                  statusTrailing={<ChecklistStatus urgency={personalStatus(entry, now)} />}
                  onOpen={() => onOpenPersonal(entry)}
                  anchorId={onCallEntryAnchorId(entry.id)}
                  testId={`${testId}-personal-row-${entry.slug}`}
                />
              );
            }
            const { row } = match;
            const notRecorded = row.state === "not-recorded";
            return (
              <ChecklistPressableRow
                key={row.item.id}
                title={row.item.title}
                subtitle={requirementDateLine(row.expiresOn, now) ?? undefined}
                meta={
                  row.item.status === "needs-checking" ? (
                    <span className={cn(textMuted, "text-xs")}>Check with your service</span>
                  ) : null
                }
                statusTrailing={notRecorded ? undefined : <ChecklistStatus urgency={requirementRowUrgency(row, now)} />}
                actionTrailing={
                  notRecorded && canEdit ? (
                    <ChecklistRowActionButton
                      label="Add date"
                      onClick={() => onAddDate(row.item)}
                      testId={`${testId}-add-date-${row.item.id}`}
                    />
                  ) : undefined
                }
                onOpen={() => onOpenCatalogue(row.item, row.entry)}
                anchorId={row.entry ? onCallEntryAnchorId(row.entry.id) : undefined}
                testId={`${testId}-row-${row.item.id}`}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
