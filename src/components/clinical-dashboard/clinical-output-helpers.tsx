import Link from "next/link";
import {
  BookOpen,
  ClipboardCheck,
  ExternalLink,
  FileText,
  ListChecks,
  Search,
  ShieldAlert,
  Target,
} from "lucide-react";

import { AccessibleTable } from "@/components/AccessibleTable";
import { comparableAnswerText } from "@/components/clinical-dashboard/display-text";
import {
  chatMicroAction,
  cn,
  EmptyState,
  sourceCard,
  textMuted,
  toneDanger,
  toneInfo,
  toneNeutral,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import { emptyStates } from "@/lib/ui-copy";
import { type AnswerEvidenceMapRow, type AnswerViewMode, buildClinicalOutputSections } from "@/lib/ward-output";

type ClinicalDetailSection = ReturnType<typeof buildClinicalOutputSections>[number];

function isRedundantStructuredItem(item: string, primaryAnswer: string) {
  const itemText = comparableAnswerText(item);
  const answerText = comparableAnswerText(primaryAnswer);
  if (!itemText || !answerText) return false;
  if (answerText.includes(itemText) || itemText.includes(answerText)) return true;
  if (itemText.length < 40) return false;
  const answerWords = new Set(answerText.split(" ").filter((word) => word.length > 3));
  const itemWords = itemText.split(" ").filter((word) => word.length > 3);
  if (itemWords.length < 6) return false;
  const sharedWords = itemWords.filter((word) => answerWords.has(word)).length;
  if (sharedWords / itemWords.length >= 0.82) return true;
  return answerText.includes(itemText.slice(0, Math.min(160, itemText.length)));
}

export function displayItemsForClinicalDetailSection(
  section: ClinicalDetailSection,
  primaryAnswer: string,
  showLead: boolean,
) {
  if (showLead) return section.items;
  const nonRedundantItems = section.items.filter((item) => !isRedundantStructuredItem(item, primaryAnswer));
  return nonRedundantItems.length > 0 || section.items.length === 0 ? nonRedundantItems : section.items;
}

const clinicalDetailPriority: Record<string, number> = {
  action: 10,
  escalation: 20,
  thresholds: 30,
  cautions: 40,
  monitoring: 50,
  medication: 60,
  documentation: 70,
  comparison: 80,
  "support-map": 90,
  "source-gap": 100,
};

export function clinicalDetailContentCount(section: ClinicalDetailSection) {
  if (section.items.length > 0) return section.items.length;
  const tableRows =
    section.tables?.reduce((total, table) => total + (table.rows?.length ?? (table.markdown ? 1 : 0)), 0) ?? 0;
  return tableRows || section.tables?.length || 0;
}

export function sortClinicalDetailSections(sections: ClinicalDetailSection[]) {
  return [...sections].sort((left, right) => {
    const leftPriority = clinicalDetailPriority[left.id] ?? 75;
    const rightPriority = clinicalDetailPriority[right.id] ?? 75;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.title.localeCompare(right.title);
  });
}

export function clinicalDetailMeta(section: ClinicalDetailSection): {
  icon: typeof Search;
  eyebrow: string;
  toneClassName: string;
  accentClassName: string;
} {
  if (section.id === "thresholds") {
    return {
      icon: Target,
      eyebrow: "Thresholds",
      toneClassName: toneWarning,
      accentClassName: "bg-[color:var(--warning)]",
    };
  }
  if (section.id === "escalation" || section.id === "cautions" || section.id === "source-gap") {
    return {
      icon: ShieldAlert,
      eyebrow: section.id === "source-gap" ? "Source gap" : "Risk",
      toneClassName: toneDanger,
      accentClassName: "bg-[color:var(--danger)]",
    };
  }
  if (section.id === "monitoring" || section.id === "medication") {
    return {
      icon: ClipboardCheck,
      eyebrow: section.id === "monitoring" ? "Monitoring" : "Medication",
      toneClassName: toneWarning,
      accentClassName: "bg-[color:var(--warning)]",
    };
  }
  if (section.id === "support-map" || section.id === "comparison") {
    return {
      icon: BookOpen,
      eyebrow: section.id === "support-map" ? "Evidence support" : "Comparison",
      toneClassName: toneInfo,
      accentClassName: "bg-[color:var(--info)]",
    };
  }
  if (section.id === "documentation") {
    return {
      icon: FileText,
      eyebrow: "Documentation",
      toneClassName: toneNeutral,
      accentClassName: "bg-[color:var(--border-strong)]",
    };
  }
  return {
    icon: ListChecks,
    eyebrow: "Clinical action",
    toneClassName: toneSuccess,
    accentClassName: "bg-[color:var(--success)]",
  };
}

export function clinicalDetailSummaryItems(sections: ClinicalDetailSection[]) {
  const countById = (ids: string[]) =>
    sections
      .filter((section) => ids.includes(section.id))
      .reduce((total, section) => total + clinicalDetailContentCount(section), 0);
  const tableCount = sections.reduce((total, section) => total + (section.tables?.length ?? 0), 0);
  const items = [
    { label: "Actions", value: countById(["action", "escalation", "documentation"]) },
    { label: "Monitoring", value: countById(["monitoring", "medication"]) },
    { label: "Tables", value: tableCount },
    { label: "Cautions", value: countById(["cautions", "source-gap"]) },
    { label: "Evidence", value: countById(["support-map", "comparison"]) },
  ];
  return items.filter((item) => item.value > 0);
}

export function AnswerViewModeControl({
  value,
  onChange,
}: {
  value: AnswerViewMode;
  onChange: (mode: AnswerViewMode) => void;
}) {
  const modes: Array<{ value: AnswerViewMode; label: string; shortLabel: string; icon: typeof Search }> = [
    { value: "standard", label: "Standard", shortLabel: "All", icon: ListChecks },
    { value: "high_yield", label: "High-yield", shortLabel: "Key", icon: Target },
    { value: "evidence_map", label: "Evidence map", shortLabel: "Map", icon: BookOpen },
  ];

  return (
    <div
      data-testid="answer-view-mode-control"
      className="flex w-full max-w-full flex-wrap rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-inset)] sm:w-auto sm:flex-nowrap"
      role="group"
      aria-label="Answer detail view"
    >
      {modes.map((mode) => {
        const Icon = mode.icon;
        const active = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            aria-pressed={active}
            aria-label={`Show ${mode.label.toLowerCase()} answer view`}
            title={mode.label}
            className={cn(
              "inline-flex min-h-tap min-w-0 flex-1 basis-[4.75rem] items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition sm:flex-none sm:basis-auto sm:px-2.5 lg:min-h-9",
              active
                ? "bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-sm"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate sm:hidden">{mode.shortLabel}</span>
            <span className="hidden truncate sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const simpleClinicalTableProps = {
  compact: false,
  expandOnMobile: true,
} as const;

function compactEvidenceCell(value: string | null | undefined, max = 140) {
  const text = value ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

export function EvidenceMapTable({ rows }: { rows: AnswerEvidenceMapRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={BookOpen} title={emptyStates.evidenceMap.title} body={emptyStates.evidenceMap.body} />;
  }

  const tableRows = rows.map((row) => [
    compactEvidenceCell(row.section),
    row.supportLevel,
    String(row.citationCount),
    compactEvidenceCell(row.sourceStatus),
    compactEvidenceCell(row.bestSourceLabel, 72),
    row.bestLinkedPassage || "Open source passage.",
  ]);
  const linkedRows = rows.filter((row) => row.href);

  return (
    <div data-testid="answer-evidence-map" className="space-y-3">
      <AccessibleTable
        caption="Source support by answer section"
        columns={["Section", "Support level", "Citations", "Evidence status", "Top source", "Passage sample"]}
        rows={tableRows}
        dialogTitle="Source support by answer section"
        {...simpleClinicalTableProps}
      />
      {linkedRows.length ? (
        <div className="grid gap-2" aria-label="Evidence map source actions">
          {linkedRows.map((row) => (
            <Link
              key={`${row.id}:${row.href}`}
              href={row.href!}
              data-testid="evidence-map-open-source"
              className={cn(
                sourceCard,
                "grid min-h-[44px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-sm transition hover:border-[color:var(--primary)]/45 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              )}
              aria-label={`Open source for ${row.section}: ${row.bestSourceLabel}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[color:var(--text-heading)]">{row.section}</span>
                <span className={cn("block truncate text-xs", textMuted)}>{row.bestSourceLabel}</span>
              </span>
              <span className={cn(chatMicroAction, "pointer-events-none min-h-9 px-2 text-xs")}>
                Open source
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
