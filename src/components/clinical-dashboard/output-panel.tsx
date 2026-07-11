"use client";

import { CircleCheck, ListChecks } from "lucide-react";

import { AccessibleTable } from "@/components/AccessibleTable";
import { SafeBoldText } from "@/components/SafeBoldText";
import { plainAnswerText } from "@/components/clinical-dashboard/answer-content";
import { SectionHeading, UtilityDrawer } from "@/components/clinical-dashboard/dashboard-shell";
import {
  AnswerViewModeControl,
  clinicalDetailContentCount,
  clinicalDetailMeta,
  clinicalDetailSummaryItems,
  displayItemsForClinicalDetailSection,
  EvidenceMapTable,
  simpleClinicalTableProps,
  sortClinicalDetailSections,
} from "@/components/clinical-dashboard/clinical-output-helpers";
import { cn, iconTilePremium, metadataPill, panelSubtle, subtleStatusPill } from "@/components/ui-primitives";
import type { RagAnswer } from "@/lib/types";
import {
  type AnswerEvidenceMapRow,
  type AnswerViewMode,
  buildAnswerEvidenceMap,
  buildClinicalOutputSections,
  buildHighYieldClinicalOutputSections,
} from "@/lib/ward-output";

export function ClinicalOutputPanel({
  answer,
  collapsed = false,
  showLead = true,
  viewMode = "standard",
  onViewModeChange,
  evidenceMapRows,
}: {
  answer: RagAnswer;
  collapsed?: boolean;
  showLead?: boolean;
  viewMode?: AnswerViewMode;
  onViewModeChange?: (mode: AnswerViewMode) => void;
  evidenceMapRows?: AnswerEvidenceMapRow[];
}) {
  const sections =
    viewMode === "high_yield" ? buildHighYieldClinicalOutputSections(answer) : buildClinicalOutputSections(answer);
  const rows = evidenceMapRows ?? buildAnswerEvidenceMap(answer);
  if (sections.length === 0 && (viewMode !== "evidence_map" || rows.length === 0)) return null;
  const leadSection = sections.find((section) => section.id === "bottom-line") ?? sections[0];
  const primaryAnswer = plainAnswerText(answer.answer);
  const detailSections = sections
    .filter((section) => section.id !== "verify-source")
    .filter((section) => (showLead ? section.id !== leadSection?.id : section.id !== "bottom-line"))
    .map((section) => ({
      ...section,
      items: displayItemsForClinicalDetailSection(section, primaryAnswer, showLead),
    }))
    .filter((section) => section.items.length > 0 || Boolean(section.tables?.length));
  const orderedDetailSections = sortClinicalDetailSections(detailSections);
  const summaryItems = clinicalDetailSummaryItems(orderedDetailSections);
  const title =
    viewMode === "evidence_map"
      ? "Evidence map"
      : viewMode === "high_yield"
        ? "High-yield clinical details"
        : showLead
          ? "Clinical answer"
          : "Structured clinical details";
  const description =
    viewMode === "evidence_map"
      ? "Mapped answer sections to linked source support and source status."
      : viewMode === "high_yield"
        ? "Actions, thresholds, cautions, escalation triggers, monitoring, and dose details."
        : showLead
          ? "Dense source-backed structure for review."
          : "Adaptive source-backed support below the concise answer.";

  const content = (
    <section data-testid="clinical-action-view" className={cn(panelSubtle, "p-3 sm:p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          icon={ListChecks}
          title={title}
          description={description}
          action={onViewModeChange ? <AnswerViewModeControl value={viewMode} onChange={onViewModeChange} /> : undefined}
          hideDescriptionOnMobile
          compactMobile
        />
      </div>
      {summaryItems.length ? (
        <div
          data-testid="clinical-detail-summary"
          className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
          aria-label="High-yield clinical detail summary"
        >
          {summaryItems.map((item) => (
            <span
              key={item.label}
              className={cn(
                subtleStatusPill,
                "min-h-12 min-w-0 justify-between gap-2 rounded-lg px-3 py-2 text-left sm:min-h-9",
              )}
            >
              <span className="min-w-0 truncate text-2xs uppercase tracking-[0.06em]">{item.label}</span>
              <span className="shrink-0 text-sm font-bold text-[color:var(--text-heading)]">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {showLead && leadSection ? (
        <div className="mt-3 rounded-md border border-[color:var(--primary)]/15 bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]">
          <div className="flex items-start gap-2.5">
            <span className={cn(iconTilePremium, "h-8 w-8 text-[color:var(--primary)]")}>
              <CircleCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--primary)]">
                {leadSection.title}
              </p>
              <p className="mt-1 text-base-minus font-semibold leading-6 text-[color:var(--text-heading)]">
                <SafeBoldText text={leadSection.items[0] ?? "Review the source-backed answer and citations."} />
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {viewMode === "evidence_map" ? (
        <div className="mt-3">
          <EvidenceMapTable rows={rows} />
        </div>
      ) : orderedDetailSections.length ? (
        <div
          className={cn(
            "mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3",
            showLead && "border-t border-[color:var(--border)] pt-3",
          )}
        >
          {orderedDetailSections.map((section) => {
            const isWide = section.id === "thresholds" || Boolean(section.tables?.length);
            const itemCount = clinicalDetailContentCount(section);
            const meta = clinicalDetailMeta(section);
            const Icon = meta.icon;
            return (
              <article
                key={section.id}
                data-testid="clinical-detail-card"
                className={cn(
                  "min-w-0 rounded-lg border border-[color:var(--border)]/80 bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]",
                  isWide && "md:col-span-2 xl:col-span-3",
                )}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
                        meta.toneClassName,
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-2xs font-bold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
                        {meta.eyebrow}
                      </p>
                      <h3 className="truncate text-sm font-semibold text-[color:var(--text-heading)]">
                        {section.title}
                      </h3>
                    </div>
                  </div>
                  <span className={cn(metadataPill, "min-h-7 shrink-0 px-2 text-3xs")}>{itemCount}</span>
                </div>
                {section.tables?.length ? (
                  <div className="mt-3 grid gap-3">
                    {section.tables.map((table) => (
                      <div key={table.id} data-testid="clinical-detail-table" className="min-w-0 space-y-2">
                        <AccessibleTable
                          caption={table.caption}
                          markdown={table.markdown}
                          rows={table.rows}
                          columns={table.columns}
                          {...simpleClinicalTableProps}
                          clinicalOnly
                          dialogTitle={table.caption || "Clinical table"}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                {section.items.length ? (
                  <ul className="mt-3 grid gap-2 text-base-minus leading-6 text-[color:var(--text)]">
                    {section.items.map((item, index) => (
                      <li
                        key={`${section.id}:${index}:${item.slice(0, 48)}`}
                        className="grid min-h-10 min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-md border border-[color:var(--border)]/70 bg-[color:var(--surface-raised)] px-3 py-2 shadow-[var(--shadow-inset)] sm:min-h-9"
                      >
                        <span
                          className={cn("mt-1 h-4 w-1 shrink-0 rounded-full", meta.accentClassName)}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 break-words">
                          <SafeBoldText text={item} />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );

  if (collapsed) {
    return (
      <UtilityDrawer
        icon={ListChecks}
        title="Clinical answer"
        summary="Collapsed because direct source support was not found."
        mobileSummary="Clinical formats"
      >
        {content}
      </UtilityDrawer>
    );
  }

  return content;
}
