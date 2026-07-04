"use client";

import Link from "next/link";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ClipboardCheck, ExternalLink, Layers, Search, X } from "lucide-react";

import { DocumentOrganizationBadges, documentDisplayTitle } from "@/components/DocumentOrganizationBadges";
import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { SafeBoldText } from "@/components/SafeBoldText";
import { Sheet } from "@/components/ui/sheet";
import { type AnswerFeedbackType } from "@/components/ClinicalDashboard";
import { NaturalLanguageAnswer, UserQuestionBubble } from "@/components/clinical-dashboard/answer-content";
import { StrengthBadge } from "@/components/clinical-dashboard/badges";
import { UtilityDrawer } from "@/components/clinical-dashboard/dashboard-shell";
import { cleanDisplayTitle } from "@/components/clinical-dashboard/display-text";
import { MatchExplanationChips } from "@/components/clinical-dashboard/document-search-results";
import {
  AnswerSupportSummaryCard,
  answerHasCentralTable,
  answerSupportPriority,
  ClinicalNotesChecklistPanel,
  clinicalNotesCount,
  clinicalNotesDisplayCountForAnswer,
  compactEvidenceSummary,
  type EvidenceTabName,
  formatQuoteCardsForClipboard,
  primaryVisualTable,
  SafetyFindingsPanel,
} from "@/components/clinical-dashboard/evidence-panels";
import { QueryCoverageChips, RelevanceBadge } from "@/components/clinical-dashboard/relevance";
import { useMobilePreviewSheet } from "@/components/clinical-dashboard/use-mobile-preview-sheet";
import { InlineTableCard, MobileEvidenceSheetContent } from "@/components/clinical-dashboard/visual-evidence";
import {
  answerSurface,
  cn,
  floatingControl,
  iconTilePremium,
  panelSubtle,
  sourceCard,
  SourceStatusBadge,
  subtleStatusPill,
  textMuted,
} from "@/components/ui-primitives";
import { type AnswerRenderModel } from "@/lib/answer-render-policy";
import { extractSafetyFindings } from "@/lib/clinical-safety";
import { type SmartDocumentTag } from "@/lib/document-tags";
import { type SourceGovernanceWarning } from "@/lib/source-governance";
import type {
  AnswerSection,
  BestSourceRecommendation,
  ClinicalQueryMode,
  ConflictOrGap,
  EvidenceRelevance,
  EvidenceSummary,
  RagAnswer,
  RelatedDocument,
  SearchResult,
  SearchScopeSummary,
} from "@/lib/types";
import { type AnswerEvidenceMapRow, type AnswerViewMode } from "@/lib/ward-output";

function WhyThisMatchedPanel({ sources }: { sources: SearchResult[] }) {
  const visibleSources = sources.slice(0, 3);
  if (visibleSources.length === 0) return null;

  return (
    <details data-testid="why-this-matched" className={cn("group rounded-lg", panelSubtle)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn(iconTilePremium, "h-8 w-8")}>
            <Search className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">Why this matched</span>
            <span className={cn("block truncate text-xs", textMuted)}>
              Match signals, source strength, and term coverage for top passages
            </span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-2 border-t border-[color:var(--border)] p-3">
        {visibleSources.map((source) => (
          <article
            key={source.id}
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-semibold text-[color:var(--text)]">
                  {cleanDisplayTitle(source.title)}
                </p>
                <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                  <span className="font-mono tabular-nums">page {source.page_number ?? "n/a"}</span> ·{" "}
                  <span className="font-mono tabular-nums">chunk {source.chunk_index}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <RelevanceBadge relevance={source.relevance} />
                <StrengthBadge strength={source.source_strength} />
                <SourceStatusBadge metadata={source.source_metadata} />
              </div>
            </div>
            <MatchExplanationChips source={source} />
            {source.index_unit ? (
              <p
                className={cn(
                  "mt-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-1.5 text-xs leading-5",
                  textMuted,
                )}
              >
                <span className="font-semibold text-[color:var(--text)]">
                  {source.index_unit.unit_type.replaceAll("_", " ")}:
                </span>{" "}
                {source.index_unit.title}
              </p>
            ) : null}
            <div className="mt-2">
              <QueryCoverageChips relevance={source.relevance} limit={5} />
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}

export function RelatedDocumentsPanel({
  documents,
  onScopeDocument,
  onTagSearch,
}: {
  documents: RelatedDocument[];
  onScopeDocument: (documentId: string) => void;
  onTagSearch: (tag: SmartDocumentTag) => void;
}) {
  if (documents.length === 0) return null;

  return (
    <UtilityDrawer
      icon={BookOpen}
      title="Related documents"
      summary={`${documents.length} broader document match${documents.length === 1 ? "" : "es"}`}
      mobileSummary={`${documents.length} related`}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {documents.map((document) => (
          <article key={document.document_id} className={cn(sourceCard, "p-3 sm:p-4")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/documents/${document.document_id}?page=${document.best_pages[0] ?? 1}&chunk=${document.best_chunk_ids[0] ?? ""}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--primary)]"
                >
                  <span className="line-clamp-2">{documentDisplayTitle(document)}</span>
                </Link>
                <DocumentOrganizationBadges document={document} compact className="mt-1" />
                <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                  {document.match_reason} · pages {document.best_pages.join(", ") || "n/a"} · {document.image_count}{" "}
                  images{document.table_count ? ` · ${document.table_count} tables` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onScopeDocument(document.document_id)}
                className={cn(floatingControl, "min-h-11 px-3 text-xs")}
              >
                Scope
              </button>
            </div>
            {document.summary && (
              <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>
                <SafeBoldText text={document.summary} />
              </p>
            )}
            <DocumentTagCloud labels={document.labels} limit={6} className="mt-3" onTagClick={onTagSearch} />
          </article>
        ))}
      </div>
    </UtilityDrawer>
  );
}

export function StagedAnswerResultSurface({
  answer,
  query,
  safeAnswerText,
  bestSource,
  currentRelevance,
  queryMode,
  sourceGovernanceWarnings,
  sourceSummary,
  renderModel,
  weakEvidence,
  groupedGovernanceWarningCount,
  answerViewMode,
  answerEvidenceMapRows,
  onScopeDocument,
  answerGrounded,
  sources,
  gaps,
  searchScope,
  demoMode,
  safeAnswerSections,
  safetyFindings,
  copiedAnswer,
  pendingFeedback,
  onCopyAnswer,
  onSubmitFeedback,
}: {
  answer: RagAnswer;
  query: string;
  safeAnswerText: string;
  bestSource: BestSourceRecommendation | null;
  currentRelevance: EvidenceRelevance | null | undefined;
  queryMode: ClinicalQueryMode;
  sourceGovernanceWarnings: SourceGovernanceWarning[];
  sourceSummary?: EvidenceSummary;
  renderModel: AnswerRenderModel;
  weakEvidence: boolean;
  groupedGovernanceWarningCount: number;
  answerViewMode: AnswerViewMode;
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  onScopeDocument: (documentId: string) => void;
  answerGrounded: boolean;
  sources: SearchResult[];
  gaps: ConflictOrGap[];
  searchScope: SearchScopeSummary | null;
  demoMode: boolean;
  safeAnswerSections: Array<AnswerSection & { citationSources: SearchResult[] }>;
  safetyFindings: ReturnType<typeof extractSafetyFindings>;
  copiedAnswer: boolean;
  pendingFeedback: AnswerFeedbackType | null;
  onCopyAnswer: () => void;
  onSubmitFeedback: (feedbackType: AnswerFeedbackType) => void;
}) {
  const noteCount = clinicalNotesCount(answer);
  const showClinicalNotes = safetyFindings.length > 0 || noteCount > 0;
  const clinicalNoteDisplayCount = clinicalNotesDisplayCountForAnswer(
    answer,
    answerViewMode,
    noteCount || safetyFindings.length,
  );
  const sourceCount =
    renderModel.primarySources.length ||
    sourceSummary?.total_sources ||
    sources.length ||
    answer.sources?.length ||
    answer.citations.length;
  const centralTable = answerHasCentralTable(answer) ? primaryVisualTable(answer) : null;
  const showEvidenceDrawer = renderModel.allowedBlocks.some((block) =>
    ["sourceStatus", "reviewSources", "evidenceMap", "quoteCards", "visualEvidence", "warnings"].includes(block),
  );
  const [clinicalNotesOpen, setClinicalNotesOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceInitialTab, setEvidenceInitialTab] = useState<EvidenceTabName | null>(null);
  const [activeReviewPanel, setActiveReviewPanel] = useState<"clinical" | "evidence" | null>(null);
  const [copiedQuotes, setCopiedQuotes] = useState(false);
  const clinicalNotesTriggerRef = useRef<HTMLButtonElement>(null);
  const evidenceTriggerRef = useRef<HTMLButtonElement>(null);
  const useReviewSheet = useMobilePreviewSheet();
  const copyQuotesTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copyQuotesTimerRef.current !== null) window.clearTimeout(copyQuotesTimerRef.current);
    };
  }, []);
  function openClinicalNotes() {
    setEvidenceOpen(false);
    setEvidenceInitialTab(null);
    if (useReviewSheet) {
      setActiveReviewPanel(null);
      setClinicalNotesOpen(true);
      return;
    }
    setClinicalNotesOpen(false);
    setActiveReviewPanel("clinical");
  }
  function restoreFocusToTrigger(ref: RefObject<HTMLElement | null>) {
    window.requestAnimationFrame(() => {
      if (ref.current?.isConnected) ref.current.focus({ preventScroll: true });
    });
  }
  function closeClinicalNotesReview() {
    setClinicalNotesOpen(false);
    restoreFocusToTrigger(clinicalNotesTriggerRef);
  }
  function openEvidence(initialTab: EvidenceTabName | null = null) {
    setClinicalNotesOpen(false);
    setEvidenceInitialTab(initialTab);
    if (useReviewSheet) {
      setActiveReviewPanel(null);
      setEvidenceOpen(true);
      return;
    }
    setEvidenceOpen(false);
    setActiveReviewPanel("evidence");
  }
  function closeEvidenceReview() {
    setEvidenceOpen(false);
    setEvidenceInitialTab(null);
    restoreFocusToTrigger(evidenceTriggerRef);
  }
  function closeDesktopReviewPanel() {
    const triggerRef = activeReviewPanel === "clinical" ? clinicalNotesTriggerRef : evidenceTriggerRef;
    setActiveReviewPanel(null);
    restoreFocusToTrigger(triggerRef);
  }
  function openTableEvidence() {
    setClinicalNotesOpen(false);
    openEvidence("Tables");
  }
  const copyQuotes = useCallback(async () => {
    const quoteText = formatQuoteCardsForClipboard(renderModel.quoteCards);
    if (!quoteText) return;
    try {
      await navigator.clipboard.writeText(quoteText);
      setCopiedQuotes(true);
      if (copyQuotesTimerRef.current !== null) window.clearTimeout(copyQuotesTimerRef.current);
      copyQuotesTimerRef.current = window.setTimeout(() => setCopiedQuotes(false), 1600);
    } catch {
      setCopiedQuotes(false);
    }
  }, [renderModel.quoteCards]);
  const priority = answerSupportPriority(answer, safeAnswerSections, centralTable, safetyFindings, {
    grounded: answerGrounded,
    weakEvidence,
  });
  const inlineEvidenceSummary = compactEvidenceSummary(answer, sources, sourceSummary, renderModel);
  const evidenceTrustLabel = inlineEvidenceSummary.split(" · ")[0] || "Review support";
  const showInlineSupportCard = Boolean(priority || showClinicalNotes || showEvidenceDrawer);
  const showLayoutAside = Boolean(activeReviewPanel || centralTable);

  return (
    <div className="min-w-0 space-y-4 motion-safe:animate-fade-up sm:space-y-5" data-dashboard-stage="answer-surface">
      <div className={cn(answerSurface, "space-y-3 p-2.5 sm:p-3")}>
        <UserQuestionBubble query={query} />

        <div
          data-testid="table-specific-answer-layout"
          data-desktop-table-aside={centralTable ? "true" : "false"}
          className={cn(
            "space-y-3",
            showLayoutAside &&
              "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(21rem,0.72fr)] lg:items-start lg:gap-5 lg:space-y-0",
          )}
        >
          <div className="min-w-0 space-y-3">
            <NaturalLanguageAnswer
              text={safeAnswerText || answer.answer}
              sourceCount={sourceCount}
              weakEvidence={weakEvidence}
              grounded={answerGrounded}
              sourceOnly={answer.answerQualityTier === "source_only"}
              bestSource={bestSource}
              sources={sources}
              sourceLinks={renderModel.primarySources}
              copied={copiedAnswer}
              onCopy={onCopyAnswer}
            />

            {showInlineSupportCard ? (
              <AnswerSupportSummaryCard
                priority={priority}
                clinicalCount={clinicalNoteDisplayCount}
                evidenceSummary={inlineEvidenceSummary}
                clinicalAvailable={showClinicalNotes}
                evidenceAvailable={showEvidenceDrawer}
                clinicalTriggerRef={clinicalNotesTriggerRef}
                evidenceTriggerRef={evidenceTriggerRef}
                onOpenClinicalNotes={openClinicalNotes}
                onOpenEvidence={() => openEvidence(null)}
              />
            ) : null}

            {centralTable && activeReviewPanel ? <InlineTableCard item={centralTable} /> : null}
          </div>

          {activeReviewPanel ? (
            <aside
              data-testid="desktop-answer-review-panel"
              className="hidden min-h-0 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)] lg:flex lg:max-h-[calc(100dvh-8rem)] lg:flex-col lg:sticky lg:top-4"
              aria-label={activeReviewPanel === "clinical" ? "Clinical notes" : "Evidence"}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className={cn(iconTilePremium, "h-8 w-8 rounded-lg")}>
                    {activeReviewPanel === "clinical" ? (
                      <ClipboardCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Layers className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-[color:var(--text-heading)]">
                        {activeReviewPanel === "clinical" ? "Clinical notes" : "Evidence"}
                      </h3>
                      <span className={cn(subtleStatusPill, "nums min-h-6 px-2 text-[11px]")}>
                        {activeReviewPanel === "clinical" ? clinicalNoteDisplayCount : "Supported"}
                      </span>
                    </div>
                    <p className={cn("mt-1 text-sm leading-5", textMuted)}>
                      {activeReviewPanel === "clinical"
                        ? "Source-backed points from this answer."
                        : "Review by evidence type."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDesktopReviewPanel}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  aria-label={`Close ${activeReviewPanel === "clinical" ? "clinical notes" : "evidence"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 polished-scroll">
                {activeReviewPanel === "clinical" ? (
                  <ClinicalNotesChecklistPanel
                    answer={answer}
                    viewMode={answerViewMode}
                    evidenceMapRows={answerEvidenceMapRows}
                    bestSource={bestSource}
                    copied={copiedAnswer}
                    onCopy={onCopyAnswer}
                    onOpenTables={openTableEvidence}
                  />
                ) : (
                  <MobileEvidenceSheetContent
                    answer={answer}
                    sources={sources}
                    renderModel={renderModel}
                    query={query}
                    visualEvidence={renderModel.visualEvidence}
                    answerEvidenceMapRows={answerEvidenceMapRows}
                    sourceGovernanceWarnings={sourceGovernanceWarnings}
                    demoMode={demoMode}
                    initialTab={evidenceInitialTab}
                    pendingFeedback={pendingFeedback}
                    copiedQuotes={copiedQuotes}
                    onCopyQuotes={copyQuotes}
                    onSubmitFeedback={onSubmitFeedback}
                    onScopeDocument={onScopeDocument}
                  />
                )}
              </div>
            </aside>
          ) : centralTable ? (
            <div className="min-w-0 lg:sticky lg:top-24">
              <InlineTableCard item={centralTable} />
            </div>
          ) : null}
        </div>

        {showClinicalNotes ? (
          <Sheet
            open={clinicalNotesOpen}
            onClose={closeClinicalNotesReview}
            title="Clinical notes"
            description="Source-backed points from this answer."
            closeLabel="Close clinical notes"
            headerLeading={
              <span className={cn(iconTilePremium, "h-8 w-8 rounded-lg text-[color:var(--primary)]")}>
                <ClipboardCheck className="h-3.5 w-3.5" />
              </span>
            }
            titleAccessory={
              <span className="nums grid h-5 min-w-5 place-items-center rounded border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] px-1 text-[11px] font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]">
                {clinicalNoteDisplayCount}
              </span>
            }
            headerActions={
              bestSource ? (
                <Link
                  href={bestSource.viewer_href}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  aria-label="Open clinical notes source"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              ) : null
            }
            headerClassName="gap-2 p-2.5 sm:p-3"
            titleClassName="text-[15px] leading-5"
            closeButtonClassName="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            contentClassName="max-h-[92dvh] translate-y-0 bg-[color:var(--surface-raised)] motion-safe:animate-none sm:h-auto sm:max-h-[88dvh] sm:max-w-lg"
            contentStyle={{ height: "80dvh" }}
            bodyClassName="flex flex-col bg-[color:var(--surface-raised)] px-3 pb-0 pt-2 sm:p-3"
            returnFocusRef={clinicalNotesTriggerRef}
            portal
          >
            <ClinicalNotesChecklistPanel
              answer={answer}
              viewMode={answerViewMode}
              evidenceMapRows={answerEvidenceMapRows}
              bestSource={bestSource}
              copied={copiedAnswer}
              onCopy={onCopyAnswer}
              onOpenTables={openTableEvidence}
            />
          </Sheet>
        ) : null}

        {showEvidenceDrawer ? (
          <Sheet
            open={evidenceOpen}
            onClose={closeEvidenceReview}
            title="Evidence"
            description="Review by evidence type."
            titleAccessory={
              <span className={cn(subtleStatusPill, "min-h-6 px-2 text-[11px]")}>{evidenceTrustLabel}</span>
            }
            closeLabel="Close evidence"
            headerLeading={
              <span className={cn(iconTilePremium, "h-8 w-8 rounded-lg text-[color:var(--primary)]")}>
                <Layers className="h-3.5 w-3.5" />
              </span>
            }
            contentClassName="max-h-[92dvh] translate-y-0 bg-[color:var(--surface-raised)] motion-safe:animate-none sm:h-auto sm:max-h-[88dvh] sm:max-w-lg"
            contentStyle={{ height: "80dvh" }}
            bodyClassName="bg-[color:var(--surface-raised)] px-3 pb-0 pt-2 sm:p-3"
            returnFocusRef={evidenceTriggerRef}
            portal
          >
            <MobileEvidenceSheetContent
              answer={answer}
              sources={sources}
              renderModel={renderModel}
              query={query}
              visualEvidence={renderModel.visualEvidence}
              answerEvidenceMapRows={answerEvidenceMapRows}
              sourceGovernanceWarnings={sourceGovernanceWarnings}
              demoMode={demoMode}
              initialTab={evidenceInitialTab}
              pendingFeedback={pendingFeedback}
              copiedQuotes={copiedQuotes}
              onCopyQuotes={copyQuotes}
              onSubmitFeedback={onSubmitFeedback}
              onScopeDocument={onScopeDocument}
            />
          </Sheet>
        ) : null}
      </div>

      <SafetyFindingsPanel findings={safetyFindings} />
    </div>
  );
}
