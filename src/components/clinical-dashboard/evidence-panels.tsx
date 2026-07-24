"use client";

import Link from "next/link";
import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useId, useRef, useState } from "react";
import {
  Activity,
  CircleAlert,
  CircleCheck,
  ChevronDown,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  Loader2,
  Plus,
  Quote,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Target,
} from "lucide-react";

import { type AnswerFeedbackType } from "@/lib/answer-feedback";
import { ClinicalOutputPanel } from "@/components/clinical-dashboard/output-panel";
import {
  isPreformattedGroundedAnswer,
  keyClinicalItemsFromSections,
  keyClinicalItemsFromTable,
  plainAnswerText,
  sourceStatusDotClass,
} from "@/components/clinical-dashboard/answer-content";
import { CopyButton } from "@/components/clinical-dashboard/answer-status";
import { StrengthBadge } from "@/components/clinical-dashboard/badges";
import {
  displayItemsForClinicalDetailSection,
  EvidenceMapTable,
  sortClinicalDetailSections,
} from "@/components/clinical-dashboard/clinical-output-helpers";
import { SectionHeading } from "@/components/clinical-dashboard/dashboard-shell";
import { cleanDisplayTitle, compactSourceSnippet } from "@/components/clinical-dashboard/display-text";
import { SourceActionRow } from "@/components/clinical-dashboard/source-actions";
import {
  chatMicroAction,
  clinicalDivider,
  cn,
  codeText,
  EmptyState,
  iconTilePremium,
  metadataPill,
  panelSubtle,
  proseMeasure,
  sourceCard,
  subtleStatusPill,
  tableMicroActionRow,
  textMuted,
  toneDanger,
  toneNeutral,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import { isAnswerSourceBacked, type AnswerRenderModel, type SourceLink } from "@/lib/answer-render-policy";
import { documentCitationHref, formatCitationLabel, formatCompactCitationLabel } from "@/lib/citations";
import {
  extractSafetyFindings,
  formatSafetyFindingLabel,
  sortSafetyFindingsBySeverity,
  type SafetyFinding,
  type SafetyFindingKind,
} from "@/lib/clinical-safety";
import { normalizeSourceMetadata, sourceStatusLabel, validationStatusLabel } from "@/lib/source-metadata";
import { normalizeExtractedGlyphs, sourceTextForVerbatimQuote } from "@/lib/source-text-sanitizer";
import type {
  AnswerSection,
  BestSourceRecommendation,
  EvidenceSummary,
  QuoteCard,
  RagAnswer,
  SearchResult,
  VisualEvidenceCard,
} from "@/lib/types";
import { emptyStates } from "@/lib/ui-copy";
import {
  type AnswerEvidenceMapRow,
  type AnswerViewMode,
  buildClinicalOutputSections,
  buildHighYieldClinicalOutputSections,
} from "@/lib/ward-output";

export {
  AnswerViewModeControl,
  clinicalDetailContentCount,
  clinicalDetailMeta,
  clinicalDetailSummaryItems,
  displayItemsForClinicalDetailSection,
  EvidenceMapTable,
  simpleClinicalTableProps,
  sortClinicalDetailSections,
} from "@/components/clinical-dashboard/clinical-output-helpers";

type AnswerSupportPriority = {
  title: string;
  detail: string;
  sourceLabel?: string;
  tone: "priority" | "caution";
};

export function answerSupportPriority(
  answer: RagAnswer,
  sections: Array<AnswerSection & { citationSources: SearchResult[] }>,
  table: VisualEvidenceCard | null,
  safetyFindings: ReturnType<typeof extractSafetyFindings>,
  options: { grounded: boolean; weakEvidence: boolean },
): AnswerSupportPriority | null {
  const firstSafetyFinding = sortSafetyFindingsBySeverity(safetyFindings)[0];
  if (firstSafetyFinding) {
    return {
      title: "Safety findings",
      detail: formatSafetyFindingLabel(firstSafetyFinding),
      tone: "caution",
    };
  }

  if (answer.answerQualityTier === "source_only" || !options.grounded || options.weakEvidence) {
    return {
      title: "Review source match",
      detail:
        "Verify cited passages before using clinical numbers, monitoring, dose, route, timing, or risk decisions.",
      sourceLabel: "Review",
      tone: "caution",
    };
  }

  const sectionItems = keyClinicalItemsFromSections(sections);
  const tableItems = keyClinicalItemsFromTable(table);
  const item = sectionItems[0] ?? tableItems[0] ?? null;
  if (!item) return null;

  return {
    title: item.label ?? "Priority",
    detail: item.detail,
    sourceLabel: "S1",
    tone: "priority",
  };
}

export function AnswerSupportSummaryCard({
  priority,
  clinicalCount,
  evidenceSummary,
  clinicalAvailable,
  evidenceAvailable,
  clinicalTriggerRef,
  evidenceTriggerRef,
  safetyTriggerRef,
  safetyFindingsCount = 0,
  onOpenClinicalNotes,
  onOpenEvidence,
  onOpenSafetyFindings,
}: {
  priority: AnswerSupportPriority | null;
  clinicalCount: number;
  evidenceSummary: string;
  clinicalAvailable: boolean;
  evidenceAvailable: boolean;
  clinicalTriggerRef?: RefObject<HTMLButtonElement | null>;
  evidenceTriggerRef?: RefObject<HTMLButtonElement | null>;
  safetyTriggerRef?: RefObject<HTMLButtonElement | null>;
  safetyFindingsCount?: number;
  onOpenClinicalNotes: () => void;
  onOpenEvidence: () => void;
  onOpenSafetyFindings?: () => void;
}) {
  const supportRowCount = Number(clinicalAvailable) + Number(evidenceAvailable);
  const supportButtonClass =
    "grid min-h-[56px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]";
  const safetyInteractive = Boolean(onOpenSafetyFindings && safetyFindingsCount > 0);

  return (
    <section
      data-testid="answer-support-card"
      className="max-w-[68ch] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
      aria-label="Answer support"
    >
      {priority ? (
        safetyInteractive ? (
          <button
            ref={safetyTriggerRef}
            id="answer-safety-findings-drawer-trigger"
            data-testid="answer-safety-findings-trigger"
            type="button"
            onClick={onOpenSafetyFindings}
            className={cn(supportButtonClass, "w-full border-t-2 border-t-[color:var(--warning)]")}
            aria-label="Open safety-critical source findings"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[color:var(--warning)]"
              aria-hidden="true"
            >
              <CircleAlert aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{priority.title}</span>
              <span className={cn("mt-1 block line-clamp-2 text-xs leading-5", textMuted)}>{priority.detail}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={cn(subtleStatusPill, "nums min-h-8 px-2 text-xs")}>{safetyFindingsCount}</span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 text-[color:var(--text-muted)]" />
            </span>
          </button>
        ) : (
          <div
            className={cn(
              "grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-t-2 px-3 py-2",
              priority.tone === "caution"
                ? "border-t-[color:var(--warning)]"
                : "border-t-[color:var(--clinical-accent)]",
            )}
          >
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                priority.tone === "caution" ? "text-[color:var(--warning)]" : "text-[color:var(--clinical-accent)]",
              )}
              aria-hidden="true"
            >
              {priority.tone === "caution" ? (
                <CircleAlert aria-hidden="true" className="h-4 w-4" />
              ) : (
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 sm:flex sm:min-w-0 sm:items-center sm:gap-3">
              <p className="shrink-0 text-sm font-semibold text-[color:var(--text-heading)]">{priority.title}</p>
              <p className={cn("mt-0.5 line-clamp-1 text-xs leading-5 sm:mt-0", textMuted)}>{priority.detail}</p>
            </div>
            {priority.sourceLabel ? (
              <span className="nums inline-flex min-h-7 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2.5 text-2xs font-semibold text-[color:var(--text-muted)]">
                {priority.sourceLabel}
              </span>
            ) : null}
          </div>
        )
      ) : null}

      {supportRowCount > 0 ? (
        <div
          className={cn(
            "grid divide-y divide-[color:var(--border)] border-t border-[color:var(--border)]",
            supportRowCount === 2 && "sm:grid-cols-2 sm:divide-x sm:divide-y-0",
          )}
        >
          {clinicalAvailable ? (
            <button
              ref={clinicalTriggerRef}
              id="answer-clinical-notes-drawer-mobile-trigger"
              data-testid="answer-clinical-notes-trigger"
              type="button"
              onClick={onOpenClinicalNotes}
              className={supportButtonClass}
              aria-label="Open clinical notes"
            >
              <ClipboardCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-[color:var(--text-muted)]" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[color:var(--text-heading)]">Clinical notes</span>
                <span className={cn("mt-1 block truncate text-xs", textMuted)}>
                  {clinicalCount} note{clinicalCount === 1 ? "" : "s"}
                </span>
              </span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 text-[color:var(--text-muted)]" />
            </button>
          ) : null}
          {evidenceAvailable ? (
            <button
              ref={evidenceTriggerRef}
              id="answer-evidence-drawer-mobile-trigger"
              data-testid="answer-evidence-trigger"
              type="button"
              onClick={onOpenEvidence}
              className={supportButtonClass}
              aria-label="Open evidence"
            >
              <Layers aria-hidden="true" className="h-5 w-5 shrink-0 text-[color:var(--text-muted)]" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[color:var(--text-heading)]">Evidence</span>
                <span className={cn("mt-1 block truncate text-xs", textMuted)}>{evidenceSummary}</span>
              </span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 text-[color:var(--text-muted)]" />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

type ClinicalDetailSection = ReturnType<typeof buildClinicalOutputSections>[number];

type ClinicalNotesTabId = "essentials" | "actions" | "safety";

type ClinicalNotesRow = {
  id: string;
  title: string;
  detail: string;
  sourceIndex: number;
  tone: "safe" | "warn";
  href?: string;
};

function clinicalNoteHref(
  sourceIndex: number,
  sourceLinks: SourceLink[],
  bestSource: BestSourceRecommendation | null,
): string | undefined {
  return sourceLinks[sourceIndex - 1]?.href ?? sourceLinks[0]?.href ?? bestSource?.viewer_href ?? undefined;
}

const clinicalNotesTabMeta: Record<
  ClinicalNotesTabId,
  { label: string; icon: typeof ShieldCheck; sectionIds: string[] }
> = {
  essentials: {
    label: "Essentials",
    icon: ClipboardCheck,
    sectionIds: ["thresholds", "monitoring", "medication", "support-map", "comparison"],
  },
  actions: {
    label: "Actions",
    icon: Activity,
    sectionIds: ["action", "documentation", "monitoring", "medication"],
  },
  safety: {
    label: "Safety",
    icon: ShieldCheck,
    sectionIds: ["escalation", "cautions", "source-gap", "thresholds"],
  },
};

function compactClinicalNoteText(value: string) {
  return normalizeExtractedGlyphs(value)
    .replace(/\*\*/g, "")
    .replace(/\s*\[\d+(?:,\s*\d+)*\]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripClinicalNoteLeadIn(value: string) {
  let text = compactClinicalNoteText(value);
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text
      .replace(/^(the\s+same\s+)?synthetic\s+source\s+says\s+/i, "")
      .replace(/^the\s+(indexed\s+)?source\s+says\s+/i, "")
      .replace(/^source\s+text\s+says\s+/i, "")
      .replace(/^according\s+to\s+[^,]+,\s*/i, "")
      .trim();
  }
  return text;
}

function titleCaseClinicalNote(value: string) {
  return value
    .replace(/\b\w[\w/-]*/g, (word) => {
      if (/[A-Z]{2,}|\/|\d/.test(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOr\b/g, "or")
    .replace(/\bTo\b/g, "to");
}

function sentenceCaseClinicalNoteDetail(value: string) {
  const text = stripClinicalNoteLeadIn(value);
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
}

function clinicalNoteHeuristicTitle(value: string) {
  const text = stripClinicalNoteLeadIn(value);
  const lower = text.toLowerCase();

  if (/\bbaseline checklist\b/.test(lower) && /\bconfirm indication\b/.test(lower)) return "Indication";
  if (/\b(vomiting|diarrhoea|diarrhea|dehydration|acute kidney injury|tremor|confusion|ataxia)\b/.test(lower)) {
    return "Toxicity review triggers";
  }
  if (
    /\b(escalate|urgent review|urgent|red flag|seizures?|severe constipation|chest pain|dyspnoea|tachycardia)\b/.test(
      lower,
    )
  ) {
    return "Escalation triggers";
  }
  if (/\blithium levels?\b/.test(lower) && /\b(5\s*(?:to|-|–)\s*7|dose change|stable|days?)\b/.test(lower)) {
    return "Lithium level timing";
  }
  if (/\b(lithium level|serum lithium|trough level)\b/.test(lower)) return "Lithium level check";
  if (/\b(fbc|anc)\b/.test(lower)) return "FBC/ANC monitoring";
  if (/\bmyocarditis\b/.test(lower)) return "Myocarditis screening";
  if (/\b(metabolic|weight|lipids?|glucose|hba1c|waist)\b/.test(lower)) return "Metabolic monitoring";
  if (/\b(constipation|bowel)\b/.test(lower)) return "Constipation prevention";
  if (/\b(shared-care|shared care|communication|handover)\b/.test(lower)) return "Shared-care communication";
  if (/\b(renal|kidney|creatinine|egfr)\b/.test(lower)) return "Renal function";
  if (/\b(thyroid|tsh)\b/.test(lower)) return "Thyroid monitoring";
  if (/\bcalcium\b/.test(lower)) return "Calcium monitoring";
  if (/\b(nsaid|ace inhibitor|diuretic|interacting medicine|medicine reconciliation)\b/.test(lower)) {
    return "Interacting medicines";
  }

  return null;
}

function clinicalNoteTitleFromItem(item: string, section: ClinicalDetailSection, index: number) {
  const text = stripClinicalNoteLeadIn(item);
  const heuristicTitle = clinicalNoteHeuristicTitle(text);
  if (heuristicTitle) return heuristicTitle;
  const colonIndex = text.indexOf(":");
  if (colonIndex > 8 && colonIndex < 54) {
    const title = text.slice(0, colonIndex).trim();
    const detailStart = text
      .slice(colonIndex + 1)
      .split(/[,;]/)[0]
      ?.trim();
    if (/\b(checklist|checkpoint|points?)\b/i.test(title) && detailStart) {
      return clinicalNoteTitleFromFragment(detailStart);
    }
    return title;
  }
  const dashIndex = text.search(/\s[-–]\s/);
  if (dashIndex > 8 && dashIndex < 54) return text.slice(0, dashIndex).trim();
  if (section.items.length === 1 && section.title.length <= 42) return section.title;
  const words = text
    .replace(/^(confirm|check|review|record|document)\s+/i, "")
    .split(" ")
    .filter(Boolean);
  return words.slice(0, Math.min(words.length, index === 0 ? 5 : 4)).join(" ") || section.title;
}

function clinicalNoteDetailFromItem(item: string, title: string) {
  const text = stripClinicalNoteLeadIn(item);
  const normalizedTitle = title.toLowerCase();
  const lowerText = text.toLowerCase();
  const colonIndex = text.indexOf(":");
  if (colonIndex > 8 && colonIndex < 64) {
    const beforeColon = text.slice(0, colonIndex);
    const afterColon = text.slice(colonIndex + 1).trim();
    if (/\b(checklist|checkpoint|points?)\b/i.test(beforeColon) && afterColon) {
      return sentenceCaseClinicalNoteDetail(afterColon);
    }
  }
  if (lowerText.startsWith(`${normalizedTitle}:`)) {
    return sentenceCaseClinicalNoteDetail(text.slice(title.length + 1).trim());
  }
  if (lowerText.startsWith(`${normalizedTitle} -`) || lowerText.startsWith(`${normalizedTitle} –`)) {
    return sentenceCaseClinicalNoteDetail(text.slice(title.length + 2).trim());
  }
  if (text === title) return "Review linked source context before using this note.";
  return sentenceCaseClinicalNoteDetail(text);
}

function clinicalNoteTitleFromFragment(fragment: string) {
  const text = stripClinicalNoteLeadIn(fragment)
    .replace(/^(and|or)\s+/i, "")
    .replace(/^(confirm|check|review|record|document)\s+/i, "")
    .replace(/[.;:,]+$/g, "");
  if (!text) return "Clinical note";
  return clinicalNoteHeuristicTitle(text) ?? titleCaseClinicalNote(text);
}

function splitClinicalNoteFragments(item: string, section: ClinicalDetailSection, title: string) {
  const detail = clinicalNoteDetailFromItem(item, title);
  const titleLooksGeneric = /\b(checkpoint|checklist|item|point|monitoring|safety)\b/i.test(title);
  const itemLooksGeneric = /\b(checkpoint|checklist|item|point|monitoring|safety)\b/i.test(
    stripClinicalNoteLeadIn(item),
  );
  if (!titleLooksGeneric && !itemLooksGeneric && section.items.length > 1) return null;

  const fragments = detail
    .replace(/\band\s+/gi, "")
    .split(/[,;]\s+/)
    .map((fragment) => compactClinicalNoteText(fragment).replace(/[.;:,]+$/g, ""))
    .filter((fragment) => fragment.length > 5);

  return fragments.length >= 3 ? fragments.slice(0, 5) : null;
}

function clinicalNoteToneForText(text: string, fallback: ClinicalNotesRow["tone"]) {
  if (/\b(toxicity|toxic|warning|caution|urgent|red flag|adverse|confusion|ataxia|tremor)\b/i.test(text)) {
    return "warn";
  }
  return fallback;
}

function clinicalNoteHasDistinctDetail(row: ClinicalNotesRow) {
  const title = compactClinicalNoteText(row.title).toLowerCase();
  const detail = compactClinicalNoteText(row.detail).toLowerCase();
  return Boolean(detail) && detail !== title;
}

function clinicalNotesTableEvidenceCount(answer: RagAnswer) {
  return (answer.visualEvidence ?? answer.smartPanel?.visualEvidence ?? []).filter(
    (item) => item.accessibleTableMarkdown || item.tableRows?.length,
  ).length;
}

function clinicalNotesRowsForTab(
  sections: ClinicalDetailSection[],
  tab: ClinicalNotesTabId,
  sourceLinks: SourceLink[] = [],
  bestSource: BestSourceRecommendation | null = null,
) {
  const meta = clinicalNotesTabMeta[tab];
  const rows: ClinicalNotesRow[] = [];
  let sourceIndex = 1;

  for (const section of sections) {
    const sectionText = `${section.title} ${section.items.join(" ")}`.toLowerCase();
    const isVerifySourceReview = section.id === "verify-source";
    if (isVerifySourceReview && tab !== "safety") continue;
    const hasMonitoringText =
      (tab === "actions" || tab === "essentials") &&
      /\b(monitor|screen|level|fbc|anc|metabolic|renal|thyroid|function)\b/i.test(sectionText);
    const hasSafetyText =
      tab === "safety" &&
      /\b(toxicity|toxic|urgent|caution|contraindication|red flag|escalat|warning|review due)\b/i.test(sectionText);
    if (!isVerifySourceReview && !meta.sectionIds.includes(section.id) && !hasMonitoringText) {
      if (!hasSafetyText) continue;
    }
    if (tab === "essentials" && section.id === "action" && rows.length >= 2) {
      continue;
    }
    const tone: ClinicalNotesRow["tone"] =
      section.id === "escalation" || section.id === "cautions" || isVerifySourceReview ? "warn" : "safe";

    for (const item of section.items.slice(0, 4)) {
      if (section.tables?.length && /\b(table|showing domains|table showing)\b/i.test(item)) continue;
      const title = clinicalNoteTitleFromItem(item, section, rows.length);
      const fragments = splitClinicalNoteFragments(item, section, title);
      if (fragments) {
        for (const fragment of fragments) {
          const fragmentTitle = clinicalNoteTitleFromFragment(fragment);
          const currentSourceIndex = sourceIndex;
          rows.push({
            id: `${tab}:${section.id}:${rows.length}:${fragmentTitle}`,
            title: fragmentTitle,
            detail: fragment,
            sourceIndex: sourceIndex++,
            tone: clinicalNoteToneForText(fragment, tone),
            href: clinicalNoteHref(currentSourceIndex, sourceLinks, bestSource),
          });
        }
      } else {
        const currentSourceIndex = sourceIndex;
        rows.push({
          id: `${tab}:${section.id}:${rows.length}:${title}`,
          title,
          detail: clinicalNoteDetailFromItem(item, title),
          sourceIndex: sourceIndex++,
          tone: clinicalNoteToneForText(item, tone),
          href: clinicalNoteHref(currentSourceIndex, sourceLinks, bestSource),
        });
      }
    }
  }

  return rows.slice(0, 6);
}

function clinicalNotesAvailableTabs(sections: ClinicalDetailSection[]) {
  return (Object.keys(clinicalNotesTabMeta) as ClinicalNotesTabId[])
    .map((id) => ({ id, ...clinicalNotesTabMeta[id], count: clinicalNotesRowsForTab(sections, id).length }))
    .filter((tab) => tab.count > 0);
}

/**
 * Align clinical-notes inputs with the fail-closed render model: when an answer
 * is not explicitly source-backed, strip structured clinical payloads so the
 * notes sheet cannot reconstruct actionable monitoring/escalation/comparison
 * content from untrusted sections, quotes, or documentBreakdown (visual
 * evidence is passed separately).
 */
function trustGatedAnswerForClinicalNotes(
  answer: RagAnswer,
  visualEvidence: VisualEvidenceCard[] = answer.visualEvidence ?? [],
): RagAnswer {
  if (isAnswerSourceBacked(answer)) {
    return {
      ...answer,
      visualEvidence,
      smartPanel: answer.smartPanel ? { ...answer.smartPanel, visualEvidence } : answer.smartPanel,
    };
  }
  return {
    ...answer,
    answerSections: [],
    quoteCards: [],
    documentBreakdown: [],
    comparisonMatrix: undefined,
    comparisonEvaluationState: undefined,
    visualEvidence,
    smartPanel: answer.smartPanel ? { ...answer.smartPanel, visualEvidence, quotes: [] } : answer.smartPanel,
  };
}

/**
 * Builds the non-empty clinical detail sections used by the clinical notes view.
 *
 * @param answer - The answer from which to derive clinical detail sections.
 * @param viewMode - Selects the standard or high-yield section set.
 * @returns The sorted clinical detail sections with display-ready items.
 */
function clinicalNotesDetailSectionsForAnswer(answer: RagAnswer, viewMode: AnswerViewMode) {
  const sections =
    viewMode === "high_yield" ? buildHighYieldClinicalOutputSections(answer) : buildClinicalOutputSections(answer);
  const primaryAnswer = plainAnswerText(answer.answer, { preformatted: isPreformattedGroundedAnswer(answer) });
  const keepVerifySource = answer.answerQualityTier === "source_only" || answer.grounded === false;
  return sortClinicalDetailSections(
    sections
      .filter((section) => (keepVerifySource || section.id !== "verify-source") && section.id !== "bottom-line")
      .map((section) => ({
        ...section,
        items: displayItemsForClinicalDetailSection(section, primaryAnswer, false),
      }))
      .filter((section) => section.items.length > 0),
  );
}

export function clinicalNotesDisplayCountForAnswer(answer: RagAnswer, viewMode: AnswerViewMode, fallback: number) {
  const tabs = clinicalNotesAvailableTabs(
    clinicalNotesDetailSectionsForAnswer(trustGatedAnswerForClinicalNotes(answer), viewMode),
  );
  const largestTabCount = tabs.reduce((largest, tab) => Math.max(largest, tab.count), 0);
  return Math.max(1, largestTabCount || fallback);
}

export function ClinicalNotesChecklistPanel({
  answer,
  visualEvidence,
  viewMode,
  evidenceMapRows,
  sourceLinks = [],
  bestSource,
  copied,
  onCopy,
  onOpenTables,
}: {
  answer: RagAnswer;
  visualEvidence: VisualEvidenceCard[];
  viewMode: AnswerViewMode;
  evidenceMapRows: AnswerEvidenceMapRow[];
  sourceLinks?: SourceLink[];
  bestSource: BestSourceRecommendation | null;
  copied: boolean;
  onCopy: () => void;
  onOpenTables?: () => void;
}) {
  const renderableAnswer = trustGatedAnswerForClinicalNotes(answer, visualEvidence);
  const detailSections = clinicalNotesDetailSectionsForAnswer(renderableAnswer, viewMode);
  const tabs = clinicalNotesAvailableTabs(detailSections);
  const defaultTab = tabs.find((tab) => tab.id === "actions")?.id ?? tabs[0]?.id ?? "actions";
  const [requestedTab, setRequestedTab] = useState<ClinicalNotesTabId>(defaultTab);
  const tabRefs = useRef(new Map<ClinicalNotesTabId, HTMLButtonElement>());
  const tabBaseId = useId();
  const tabButtonId = (id: ClinicalNotesTabId) => `${tabBaseId}-tab-${id}`;
  const notesPanelId = `${tabBaseId}-panel`;
  const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : defaultTab;
  const rows = clinicalNotesRowsForTab(detailSections, activeTab, sourceLinks, bestSource);
  const tableEvidenceCount = clinicalNotesTableEvidenceCount(renderableAnswer);
  const warningRows = clinicalNotesRowsForTab(detailSections, "safety", sourceLinks, bestSource);
  const warningCount = warningRows.filter((row) => row.tone === "warn").length || warningRows.length;

  if (!tabs.length || rows.length === 0) {
    return (
      <ClinicalOutputPanel
        answer={renderableAnswer}
        showLead={false}
        viewMode={viewMode}
        evidenceMapRows={evidenceMapRows}
      />
    );
  }

  const showTabStrip = tabs.length > 1;

  function handleTabKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const order = tabs.map((tab) => tab.id);
    const index = order.indexOf(activeTab);
    const next =
      event.key === "ArrowRight"
        ? order[(index + 1) % order.length]
        : event.key === "ArrowLeft"
          ? order[(index - 1 + order.length) % order.length]
          : event.key === "Home"
            ? order[0]
            : event.key === "End"
              ? order[order.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    if (next !== activeTab) setRequestedTab(next);
    tabRefs.current.get(next)?.focus();
  }

  return (
    <section data-testid="clinical-notes-checklist" className="flex min-h-0 min-w-0 flex-1 flex-col">
      {showTabStrip ? (
        <div className="sticky top-0 z-10 -mx-3 -mt-2 border-b border-[color:var(--border)] bg-[color:var(--surface-raised)]/98 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:mt-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-0">
          <div
            role="tablist"
            aria-label="Clinical notes categories"
            onKeyDown={handleTabKeyDown}
            className={cn(
              "grid min-w-0 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-inset)]",
              tabs.length === 2 ? "grid-cols-2" : "grid-cols-3",
            )}
          >
            {tabs.map((tab) => {
              const selected = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  ref={(element) => {
                    if (element) tabRefs.current.set(tab.id, element);
                    else tabRefs.current.delete(tab.id);
                  }}
                  type="button"
                  role="tab"
                  id={tabButtonId(tab.id)}
                  aria-selected={selected}
                  aria-controls={notesPanelId}
                  tabIndex={selected ? 0 : -1}
                  aria-label={`${tab.label} (${tab.count})`}
                  onClick={() => setRequestedTab(tab.id)}
                  className={cn(
                    "inline-flex min-h-tap min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                    selected
                      ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                  )}
                >
                  <span className="truncate">{tab.label}</span>
                  <span
                    className={cn(
                      "nums grid h-5 min-w-5 place-items-center rounded-full px-1 text-2xs",
                      selected
                        ? "bg-[color:var(--surface-raised)] text-[color:var(--clinical-accent)]"
                        : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {tableEvidenceCount > 0 && onOpenTables ? (
        <div className={cn("flex min-w-0 justify-end", showTabStrip ? "mt-3" : "mt-0")}>
          <button
            type="button"
            onClick={onOpenTables}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:min-h-9"
          >
            <Table2 aria-hidden="true" className="h-3.5 w-3.5" />
            Tables
          </button>
        </div>
      ) : null}

      <div
        id={showTabStrip ? notesPanelId : undefined}
        role={showTabStrip ? "tabpanel" : undefined}
        aria-labelledby={showTabStrip ? tabButtonId(activeTab) : undefined}
        className={cn(
          "overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]",
          showTabStrip || (tableEvidenceCount > 0 && onOpenTables) ? "mt-3" : "mt-0",
        )}
      >
        {rows.map((row) => {
          const hasDistinctDetail = clinicalNoteHasDistinctDetail(row);
          const RowIcon = row.tone === "warn" ? CircleAlert : activeTab === "actions" ? Activity : CircleCheck;
          const isWarnRow = row.tone === "warn";
          const rowContent = (
            <>
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                  isWarnRow ? "text-[color:var(--warning)]" : "text-[color:var(--clinical-accent)]",
                )}
                aria-hidden="true"
              >
                <RowIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                    {row.title}
                  </p>
                  {!isWarnRow ? (
                    <span className={cn(subtleStatusPill, "min-h-6 px-2 text-2xs", toneSuccess)}>
                      {activeTab === "actions" ? "Action" : "Source"}
                    </span>
                  ) : null}
                </div>
                {hasDistinctDetail ? (
                  <p className={cn("mt-0.5 line-clamp-2 text-xs leading-5", textMuted)}>{row.detail}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {isWarnRow ? (
                  <span className={cn(subtleStatusPill, "min-h-6 px-2 text-2xs", toneWarning)}>Review</span>
                ) : (
                  <span className="nums grid h-6 min-w-7 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-1.5 text-2xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]">
                    S{row.sourceIndex}
                  </span>
                )}
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 -rotate-90 text-[color:var(--text-muted)]" />
              </div>
            </>
          );
          return row.href ? (
            <Link
              key={row.id}
              href={row.href}
              data-testid="clinical-note-row"
              className="grid min-h-[56px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[color:var(--border)] px-3 py-2.5 transition last:border-b-0 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]"
            >
              {rowContent}
            </Link>
          ) : (
            <article
              key={row.id}
              data-testid="clinical-note-row"
              className="grid min-h-[56px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[color:var(--border)] px-3 py-2.5 last:border-b-0"
            >
              {rowContent}
            </article>
          );
        })}
      </div>

      {warningCount > 0 && activeTab !== "safety" ? (
        <button
          type="button"
          onClick={() => setRequestedTab("safety")}
          className="mt-3 grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/45 px-3 py-2 text-left text-[color:var(--warning)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--warning-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <CircleAlert aria-hidden="true" className="h-5 w-5" />
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-[0.06em]">Safety preview ({warningCount})</span>
            <span className="block truncate text-xs font-semibold">Review toxicity symptoms</span>
          </span>
          <span className={cn(subtleStatusPill, "nums min-h-7 px-2 text-xs")}>S1</span>
        </button>
      ) : null}

      <div className="sticky bottom-0 -mx-3 mt-auto border-t border-[color:var(--border)] bg-[color:var(--surface-raised)]/98 px-2.5 py-1.5 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-2">
        <div className="grid grid-cols-3 divide-x divide-[color:var(--border)] bg-[color:var(--surface)]">
          {bestSource ? (
            <Link
              href={bestSource.viewer_href}
              className="inline-flex min-h-tap items-center justify-center gap-1.5 px-2 text-2xs font-semibold text-[color:var(--primary)]"
            >
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              Source
            </Link>
          ) : (
            <span className="inline-flex min-h-tap items-center justify-center gap-1.5 px-2 text-2xs font-semibold text-[color:var(--text-soft)]">
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              Source
            </span>
          )}
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex min-h-tap items-center justify-center gap-1.5 px-2 text-2xs font-semibold text-[color:var(--text)]"
          >
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            aria-disabled="true"
            aria-describedby="clinical-notes-add-unavailable"
            title="Add to favourites — coming soon"
            className="inline-flex min-h-tap cursor-not-allowed items-center justify-center gap-1.5 px-2 text-2xs font-semibold text-[color:var(--primary)] opacity-60"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add
          </button>
          <span id="clinical-notes-add-unavailable" className="sr-only">
            Adding clinical notes to favourites is coming soon.
          </span>
        </div>
      </div>
    </section>
  );
}

function safetyFindingKindTone(kind: SafetyFindingKind) {
  return kind === "contraindication" || kind === "red_flag" ? toneDanger : toneWarning;
}

function SafetyFindingRowIcon({ kind }: { kind: SafetyFindingKind }) {
  if (kind === "contraindication" || kind === "red_flag") {
    return <ShieldAlert aria-hidden="true" className="h-5 w-5" />;
  }
  return <CircleAlert aria-hidden="true" className="h-5 w-5" />;
}

// Issue 9: governance provenance retained on safety-finding citations lets the safety
// panel badge sources that are outdated, due for review, or not locally validated —
// the same currency/validation signals shown for ordinary source citations. Current
// and unknown-status sources add no badge (they carry no actionable caveat here).
function safetyFindingGovernanceLabels(citation: SafetyFinding["citation"]): string[] {
  const metadata = citation.source_metadata ? normalizeSourceMetadata(citation.source_metadata) : null;
  if (!metadata) return [];
  const labels: string[] = [];
  if (metadata.document_status === "outdated" || metadata.document_status === "review_due") {
    labels.push(sourceStatusLabel(metadata));
  }
  if (metadata.clinical_validation_status === "unverified") {
    labels.push(validationStatusLabel(metadata));
  }
  return labels;
}

export function SafetyFindingsListContent({ findings }: { findings: SafetyFinding[] }) {
  if (findings.length === 0) return null;

  const sortedFindings = sortSafetyFindingsBySeverity(findings);

  return (
    <div
      data-testid="safety-findings-panel"
      className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      {sortedFindings.map((finding, index) => (
        <article
          key={`${finding.id}:${finding.href}:${index}`}
          data-testid="safety-finding-row"
          className="grid min-h-[70px] grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-b border-[color:var(--border)] px-3 py-3 last:border-b-0"
        >
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-md",
              finding.kind === "contraindication" || finding.kind === "red_flag"
                ? "text-[color:var(--danger)]"
                : "text-[color:var(--warning)]",
            )}
            aria-hidden="true"
          >
            <SafetyFindingRowIcon kind={finding.kind} />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={cn(subtleStatusPill, "min-h-6 px-2 text-2xs", safetyFindingKindTone(finding.kind))}>
                {finding.label}
              </span>
              <Link
                href={finding.href}
                className="inline-flex min-h-tap min-w-0 items-center gap-1 text-xs font-semibold text-[color:var(--primary)] transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:min-h-8"
                aria-label={`Open source ${formatSafetyFindingLabel(finding)}`}
              >
                <span className="truncate">{formatCompactCitationLabel(finding.citation)}</span>
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              </Link>
              {safetyFindingGovernanceLabels(finding.citation).map((label) => (
                <span
                  key={label}
                  data-testid="safety-finding-governance"
                  className={cn(subtleStatusPill, "min-h-6 px-2 text-2xs", toneWarning)}
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-sm leading-5 text-[color:var(--text-heading)]">{finding.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function compactEvidenceSummary(
  answer: RagAnswer,
  sources: SearchResult[],
  sourceSummary?: EvidenceSummary,
  renderModel?: AnswerRenderModel,
) {
  const support =
    renderModel?.trust === "high"
      ? "Strong support"
      : renderModel?.trust === "medium"
        ? "Supported"
        : renderModel?.trust === "low"
          ? "Limited support"
          : "Review support";
  const claimCount = renderModel?.evidenceRows.length || answer.answerSections?.length || answer.citations.length;
  const quoteCount = renderModel?.quoteCards.length ?? answer.quoteCards?.length ?? sourceSummary?.quote_count ?? 0;
  const tableCount = (renderModel?.visualEvidence ?? answer.visualEvidence ?? []).filter(
    (item) => item.accessibleTableMarkdown || item.tableRows?.length,
  ).length;
  const sourceCount = renderModel?.primarySources.length || sourceSummary?.total_sources || sources.length;
  const countParts = [
    claimCount > 0 ? `${claimCount} claim${claimCount === 1 ? "" : "s"}` : null,
    quoteCount > 0 ? `${quoteCount} quote${quoteCount === 1 ? "" : "s"}` : null,
    tableCount > 0 ? `${tableCount} table${tableCount === 1 ? "" : "s"}` : null,
  ].filter((part): part is string => Boolean(part));

  if (countParts.length === 0 && sourceCount > 0) {
    countParts.push(`${sourceCount} source${sourceCount === 1 ? "" : "s"}`);
  }

  return [support, ...countParts].join(" · ");
}

export type EvidenceTabName = "Claims" | "Quotes" | "Tables" | "Images" | "Gaps";

function renderModelAllows(renderModel: AnswerRenderModel, block: AnswerRenderModel["allowedBlocks"][number]) {
  return renderModel.allowedBlocks.includes(block);
}

export function evidenceTabOrder(_answer: RagAnswer, renderModel: AnswerRenderModel): EvidenceTabName[] {
  const order: EvidenceTabName[] = ["Claims", "Quotes", "Tables", "Images", "Gaps"];
  return order.filter((tab) => {
    if (tab === "Tables") {
      return (
        renderModelAllows(renderModel, "visualEvidence") &&
        renderModel.visualEvidence.some((item) => item.accessibleTableMarkdown || item.tableRows?.length)
      );
    }
    if (tab === "Images") return renderModelAllows(renderModel, "visualEvidence");
    if (tab === "Quotes") return renderModelAllows(renderModel, "quoteCards");
    if (tab === "Gaps") return renderModel.warnings.length > 0;
    return renderModelAllows(renderModel, "evidenceMap") || renderModelAllows(renderModel, "reviewSources");
  });
}

export function evidenceTabCount({
  tab,
  sources,
  visualEvidence,
  answerEvidenceMapRows,
  renderModel,
}: {
  tab: EvidenceTabName;
  sources: SearchResult[];
  visualEvidence: VisualEvidenceCard[];
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  renderModel: AnswerRenderModel;
}) {
  if (tab === "Tables") {
    return visualEvidence.filter((item) => item.accessibleTableMarkdown || item.tableRows?.length).length;
  }
  if (tab === "Claims")
    return (
      answerEvidenceMapRows.length ||
      renderModel.evidenceRows.length ||
      sources.length ||
      renderModel.primarySources.length
    );
  if (tab === "Images") return visualEvidence.length;
  if (tab === "Quotes") return renderModel.quoteCards.length;
  return renderModel.warnings.length;
}

export function clinicalNotesCount(answer: RagAnswer) {
  return buildHighYieldClinicalOutputSections(trustGatedAnswerForClinicalNotes(answer)).filter((section) =>
    ["action", "escalation", "thresholds", "cautions", "monitoring", "medication", "source-gap"].includes(section.id),
  ).length;
}

export function answerHasCentralTable(answer: RagAnswer) {
  return (
    answer.queryClass === "table_threshold" ||
    answer.responseMode === "threshold_table" ||
    Boolean(answer.visualEvidence?.some((item) => item.accessibleTableMarkdown || item.tableRows?.length))
  );
}

export function primaryVisualTable(answer: RagAnswer) {
  return answer.visualEvidence?.find((item) => item.accessibleTableMarkdown || item.tableRows?.length) ?? null;
}

const answerFeedbackOptions: Array<{
  type: AnswerFeedbackType;
  label: string;
  icon: typeof CircleCheck;
  tone: "success" | "warning" | "danger" | "neutral";
}> = [
  { type: "verified", label: "Verified", icon: CircleCheck, tone: "success" },
  { type: "needs_correction", label: "Needs correction", icon: CircleAlert, tone: "warning" },
  { type: "source_insufficient", label: "Source insufficient", icon: ShieldAlert, tone: "warning" },
  { type: "wrong_source", label: "Wrong source", icon: FileText, tone: "danger" },
  { type: "missing_source", label: "Missing source", icon: Search, tone: "warning" },
  { type: "unsupported_answer", label: "Unsupported answer", icon: ShieldAlert, tone: "danger" },
  { type: "numeric_error", label: "Numeric error", icon: Target, tone: "danger" },
  { type: "outdated_guidance", label: "Outdated guidance", icon: RefreshCw, tone: "warning" },
];

function feedbackToneClass(tone: "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return toneSuccess;
  if (tone === "warning") return toneWarning;
  if (tone === "danger") return toneDanger;
  return toneNeutral;
}

export function AnswerFeedbackPanel({
  pending,
  onSubmit,
}: {
  pending: AnswerFeedbackType | null;
  onSubmit: (feedbackType: AnswerFeedbackType) => void;
}) {
  return (
    <section
      data-testid="answer-review-panel"
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
      aria-label="Answer review"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text)]">Answer review</p>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>
            Capture misses for retrieval and RAG evals without changing the answer.
          </p>
        </div>
        {pending ? (
          <span className={cn(metadataPill, "min-h-7 px-2 text-2xs")}>
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            Saving
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {answerFeedbackOptions.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              disabled={Boolean(pending)}
              onClick={() => onSubmit(item.type)}
              className={cn(
                "inline-flex min-h-tap items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-10",
                feedbackToneClass(item.tone),
              )}
            >
              {pending === item.type ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {item.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RenderModelSourceList({
  sources,
  query,
  onScopeDocument,
}: {
  sources: SourceLink[];
  query: string;
  onScopeDocument: (documentId: string) => void;
}) {
  if (sources.length === 0) {
    return (
      <EmptyState icon={FileText} title={emptyStates.sourcePassages.title} body={emptyStates.sourcePassages.body} />
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source, index) => {
        const metadata = normalizeSourceMetadata(source.sourceMetadata);
        const snippet = compactSourceSnippet(source.snippet ?? "", { dropTitle: source.title });
        const openLabel = `Open source ${index + 1}: ${cleanDisplayTitle(source.title)}${query ? ` for ${query}` : ""}`;
        return (
          <article key={`${source.id}:${source.href}`} className={cn(sourceCard, "overflow-hidden p-0")}>
            <Link
              href={source.href}
              className="block min-h-[44px] px-3 py-3 transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              aria-label={openLabel}
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                <span className={sourceStatusDotClass(metadata)} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-[color:var(--text-heading)]">
                    {cleanDisplayTitle(source.title)}
                  </p>
                  <p className={cn("mt-1 text-xs", textMuted)}>
                    p.{source.page_number ?? "n/a"} · {sourceStatusLabel(metadata)} · {source.sourceStrength} support
                  </p>
                </div>
                <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
              </div>
              {snippet ? <p className={cn("mt-2 line-clamp-2 text-sm leading-6", textMuted)}>{snippet}</p> : null}
            </Link>
            <div className={cn(tableMicroActionRow, "justify-start border-t px-3 py-2")}>
              <button type="button" onClick={() => onScopeDocument(source.document_id)} className={chatMicroAction}>
                <Filter aria-hidden="true" className="h-3.5 w-3.5" />
                Scope document
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function VerificationWorkspace({
  renderModel,
  query,
  answerEvidenceMapRows,
  pendingFeedback,
  onSubmitFeedback,
  onScopeDocument,
}: {
  renderModel: AnswerRenderModel;
  query: string;
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  pendingFeedback: AnswerFeedbackType | null;
  onSubmitFeedback: (feedbackType: AnswerFeedbackType) => void;
  onScopeDocument: (documentId: string) => void;
}) {
  const verificationSources = renderModel.primarySources.slice(0, renderModel.trust === "unsupported" ? 3 : 6);
  return (
    <section
      data-testid="answer-verification-workspace"
      className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]"
    >
      <div className="space-y-3">
        <AnswerFeedbackPanel pending={pendingFeedback} onSubmit={onSubmitFeedback} />
        <div className={cn(panelSubtle, "p-3")}>
          <p className="text-sm font-semibold text-[color:var(--text)]">Section support map</p>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>
            Each answer section should resolve back to a linked cited passage before clinical use.
          </p>
          <div className="mt-3">
            <EvidenceMapTable rows={answerEvidenceMapRows} />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className={cn(panelSubtle, "p-3")}>
          <p className="text-sm font-semibold text-[color:var(--text)]">Cited source excerpts</p>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>
            Open the document to inspect the PDF page and highlighted indexed passage.
          </p>
        </div>
        <RenderModelSourceList sources={verificationSources} query={query} onScopeDocument={onScopeDocument} />
      </div>
    </section>
  );
}

// Moved to a light module so the dashboard can import it without pulling this heavy component
// tree into the initial bundle; re-exported here to keep evidence-panels' public API stable.
export { evidenceMapRowsFromRenderModel } from "@/components/clinical-dashboard/evidence-map-model";

export function AnswerSafetyNotice({
  demoMode,
  weakEvidence = false,
  retrievalDiagnostics,
}: {
  demoMode: boolean;
  weakEvidence?: boolean;
  retrievalDiagnostics?: RagAnswer["retrievalDiagnostics"];
}) {
  const retrievalGateBlocked = retrievalDiagnostics?.gateStatus === "blocked";
  return (
    <div
      data-testid="answer-safety-notice"
      className={cn(
        "rounded-md border border-[color:var(--warning)]/20 border-l-2 border-l-[color:var(--warning)] px-2.5 py-2 text-xs leading-5",
        weakEvidence ? "bg-[color:var(--warning-soft)]/30" : "border-[color:var(--border)] bg-[color:var(--surface)]",
      )}
    >
      <p className="font-semibold text-[color:var(--text-heading)]">
        {weakEvidence
          ? "Weak source support; verify the linked source before relying on this answer."
          : "Draft only; verify source first before pasting into the medical record."}
      </p>
      {retrievalGateBlocked ? (
        <p className="mt-1 text-2xs text-[color:var(--warning)]">
          Retrieval confidence gate was triggered. Expand evidence details before using this result.
        </p>
      ) : null}
      {demoMode ? (
        <p className="mt-1 text-2xs font-semibold text-[color:var(--warning)]">
          Synthetic demo only: this is not clinical guidance.
        </p>
      ) : null}
    </div>
  );
}

export function QuoteCards({
  quotes,
  copiedQuotes,
  onCopyQuotes,
  onFollowUp,
  onScopeDocument,
}: {
  quotes: QuoteCard[];
  copiedQuotes: boolean;
  onCopyQuotes: () => void;
  onFollowUp?: (quote: QuoteCard) => void;
  onScopeDocument: (documentId: string) => void;
}) {
  return (
    <section id="quotes" className="space-y-3 scroll-mt-4 sm:scroll-mt-6">
      <SectionHeading
        icon={Quote}
        title="Source quotes"
        description="Verbatim excerpts linked to the source PDF and page."
        hideDescriptionOnMobile
        compactMobile
        action={
          quotes.length > 0 ? (
            <CopyButton label="Copy exact quotes" shortLabel="Quotes" copied={copiedQuotes} onClick={onCopyQuotes} />
          ) : null
        }
      />
      {quotes.length === 0 ? (
        <EmptyState icon={Quote} title={emptyStates.exactQuotes.title} body={emptyStates.exactQuotes.body} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {quotes.map((quote, index) => {
            const quoteText = sourceTextForVerbatimQuote(quote.quote);
            const quoteTitle = cleanDisplayTitle(quote.title);
            return (
              <article key={`${quote.chunk_id}:${quote.quote}`} className={cn(sourceCard, "p-3 sm:p-4")}>
                <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                  <span className={cn(iconTilePremium, codeText, "h-7 w-7 text-xs font-bold sm:h-8 sm:w-8")}>
                    {index + 1}
                  </span>
                  <StrengthBadge strength={quote.source_strength} />
                </div>
                <blockquote
                  className={cn(proseMeasure, "text-base-minus font-medium leading-6 text-[color:var(--text)]")}
                >
                  &ldquo;{quoteText}&rdquo;
                </blockquote>
                <div
                  className={cn(
                    "mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 sm:mt-4 sm:gap-3",
                    clinicalDivider,
                  )}
                >
                  <span className="max-w-full text-base-minus font-semibold leading-6 text-[color:var(--primary)] sm:hidden">
                    {formatCompactCitationLabel(quote)}
                  </span>
                  <span className="hidden max-w-full text-xs font-semibold leading-5 text-[color:var(--primary)] sm:inline">
                    {quoteTitle}, page {quote.page_number ?? "n/a"}
                  </span>
                  <div className="w-full sm:w-auto">
                    <SourceActionRow
                      viewerHref={documentCitationHref(quote)}
                      sourceTitle={`quote ${index + 1} from ${quoteTitle}`}
                      documentId={quote.document_id}
                      onScopeDocument={onScopeDocument}
                      onFollowUp={onFollowUp ? () => onFollowUp(quote) : undefined}
                      divider={false}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function formatQuoteCardsForClipboard(quotes: QuoteCard[]) {
  return quotes
    .map((quote, index) =>
      [
        // Clean the copied text the same way the card displays it, so clipboard
        // output never contains internal image-data blocks or glyph artifacts.
        `${index + 1}. "${sourceTextForVerbatimQuote(quote.quote)}"`,
        ...(quote.isTruncated
          ? ["Warning: quote truncated for length; open the source to read the full passage."]
          : []),
        `Source: ${formatCitationLabel(quote)}`,
        `Link: ${documentCitationHref(quote)}`,
      ].join("\n"),
    )
    .join("\n\n");
}
