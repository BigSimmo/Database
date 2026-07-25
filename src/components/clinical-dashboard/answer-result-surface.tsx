"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ClipboardCheck, ExternalLink, Layers, ShieldAlert } from "lucide-react";

import { type AnswerFeedbackType } from "@/lib/answer-feedback";
import { AnswerFollowUpSuggestions } from "@/components/clinical-dashboard/answer-follow-up-suggestions";
import { CrossModeLinksSection } from "@/components/clinical-dashboard/cross-mode-links";
import {
  isPreformattedGroundedAnswer,
  NaturalLanguageAnswer,
  UserQuestionBubble,
} from "@/components/clinical-dashboard/answer-content";
import {
  AnswerSupportSummaryCard,
  answerSupportPriority,
  ClinicalNotesChecklistPanel,
  clinicalNotesCount,
  clinicalNotesDisplayCountForAnswer,
  compactEvidenceSummary,
  type EvidenceTabName,
  formatQuoteCardsForClipboard,
  primaryVisualTable,
  SafetyFindingsListContent,
} from "@/components/clinical-dashboard/evidence-panels";
import { CanonicalAnswerTables, MobileEvidenceSheetContent } from "@/components/clinical-dashboard/visual-evidence";
import { Sheet } from "@/components/ui/sheet";
import { answerSurface, cn, iconTilePremium, subtleStatusPill } from "@/components/ui-primitives";
import { type AnswerRenderModel } from "@/lib/answer-render-policy";
import { type AppModeId } from "@/lib/app-modes";
import { extractSafetyFindings } from "@/lib/clinical-safety";
import { type SourceGovernanceWarning } from "@/lib/source-governance";
import type {
  AnswerSection,
  BestSourceRecommendation,
  EvidenceSummary,
  QuoteCard,
  RagAnswer,
  SearchResult,
} from "@/lib/types";
import { type AnswerEvidenceMapRow, type AnswerViewMode } from "@/lib/ward-output";

/**
 * Renders a staged answer with inline content and optional clinical notes, evidence, safety findings, and follow-up interfaces.
 *
 * @returns The staged answer surface.
 */
function StagedAnswerResultSurfaceImpl({
  answer,
  query,
  bestSource,
  sourceGovernanceWarnings,
  sourceSummary,
  renderModel,
  weakEvidence,
  answerViewMode,
  answerEvidenceMapRows,
  onScopeDocument,
  answerGrounded,
  sources,
  demoMode,
  safeAnswerSections,
  safetyFindings,
  copiedAnswer,
  pendingFeedback,
  onCopyAnswer,
  onSubmitFeedback,
  onFollowUpQuote,
  followUpSuggestions,
  onPickFollowUpSuggestion,
  followUpSuggestionsDisabled = false,
  crossModeQueries,
  onCrossModeSearch,
}: {
  answer: RagAnswer;
  query: string;
  bestSource: BestSourceRecommendation | null;
  sourceGovernanceWarnings: SourceGovernanceWarning[];
  sourceSummary?: EvidenceSummary;
  renderModel: AnswerRenderModel;
  weakEvidence: boolean;
  answerViewMode: AnswerViewMode;
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  onScopeDocument: (documentId: string) => void;
  answerGrounded: boolean;
  sources: SearchResult[];
  demoMode: boolean;
  safeAnswerSections: Array<AnswerSection & { citationSources: SearchResult[] }>;
  safetyFindings: ReturnType<typeof extractSafetyFindings>;
  copiedAnswer: boolean;
  pendingFeedback: AnswerFeedbackType | null;
  onCopyAnswer: () => void;
  onSubmitFeedback: (feedbackType: AnswerFeedbackType) => void;
  onFollowUpQuote?: (quote: QuoteCard) => void;
  followUpSuggestions?: string[];
  onPickFollowUpSuggestion?: (suggestion: string) => void;
  followUpSuggestionsDisabled?: boolean;
  crossModeQueries?: Array<string | null | undefined>;
  onCrossModeSearch?: (mode: AppModeId, query: string) => void;
}) {
  const noteCount = clinicalNotesCount(answer);
  const showClinicalNotes =
    safetyFindings.length > 0 ||
    noteCount > 0 ||
    answer.answerQualityTier === "source_only" ||
    answerGrounded === false;
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
  const centralTables = renderModel.tables;
  const centralVisualEvidence = primaryVisualTable(answer);
  const showEvidenceDrawer = renderModel.allowedBlocks.some((block) =>
    ["sourceStatus", "reviewSources", "evidenceMap", "quoteCards", "visualEvidence", "warnings"].includes(block),
  );
  const [activeReviewSheet, setActiveReviewSheet] = useState<"clinical-notes" | "evidence" | "safety" | null>(null);
  const clinicalNotesOpen = activeReviewSheet === "clinical-notes";
  const evidenceOpen = activeReviewSheet === "evidence";
  const safetyFindingsOpen = activeReviewSheet === "safety";
  const [evidenceInitialTab, setEvidenceInitialTab] = useState<EvidenceTabName | null>(null);
  const [copiedQuotes, setCopiedQuotes] = useState(false);
  const clinicalNotesTriggerRef = useRef<HTMLButtonElement>(null);
  const evidenceTriggerRef = useRef<HTMLButtonElement>(null);
  const safetyTriggerRef = useRef<HTMLButtonElement>(null);
  const copyQuotesTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copyQuotesTimerRef.current !== null) window.clearTimeout(copyQuotesTimerRef.current);
    };
  }, []);
  function openClinicalNotes() {
    setEvidenceInitialTab(null);
    setActiveReviewSheet("clinical-notes");
  }
  function closeClinicalNotesReview() {
    setActiveReviewSheet(null);
  }
  function openEvidence(initialTab: EvidenceTabName | null = null) {
    setEvidenceInitialTab(initialTab);
    setActiveReviewSheet("evidence");
  }
  function closeEvidenceReview() {
    setActiveReviewSheet(null);
    setEvidenceInitialTab(null);
  }
  function handleQuoteFollowUp(quote: QuoteCard) {
    setActiveReviewSheet(null);
    setEvidenceInitialTab(null);
    onFollowUpQuote?.(quote);
  }
  function openTableEvidence() {
    openEvidence("Tables");
  }
  function openSafetyFindings() {
    setEvidenceInitialTab(null);
    setActiveReviewSheet("safety");
  }
  function closeSafetyFindingsReview() {
    setActiveReviewSheet(null);
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
  const priority = answerSupportPriority(answer, safeAnswerSections, centralVisualEvidence, safetyFindings, {
    grounded: answerGrounded,
    weakEvidence,
  });
  const inlineEvidenceSummary = compactEvidenceSummary(answer, sources, sourceSummary, renderModel);
  const evidenceTrustLabel = inlineEvidenceSummary.split(" · ")[0] || "Review support";
  const showInlineSupportCard = Boolean(priority || showClinicalNotes || showEvidenceDrawer);
  const showLayoutAside = centralTables.length > 0;

  return (
    <div className="min-w-0 space-y-4 motion-safe:animate-fade-up sm:space-y-5" data-dashboard-stage="answer-surface">
      <div className={cn(answerSurface, "space-y-3 p-2.5 sm:p-3")}>
        <UserQuestionBubble query={query} />

        <div
          data-testid="table-specific-answer-layout"
          data-desktop-table-aside={centralTables.length ? "true" : "false"}
          className={cn(
            "space-y-3",
            showLayoutAside &&
              "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(21rem,0.72fr)] lg:items-start lg:gap-5 lg:space-y-0",
          )}
        >
          <div className="min-w-0 space-y-3">
            <NaturalLanguageAnswer
              text={answer.answer}
              preformatted={isPreformattedGroundedAnswer(answer)}
              sourceCount={sourceCount}
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
                safetyTriggerRef={safetyTriggerRef}
                safetyFindingsCount={safetyFindings.length}
                onOpenClinicalNotes={openClinicalNotes}
                onOpenEvidence={() => openEvidence(null)}
                onOpenSafetyFindings={safetyFindings.length > 0 ? openSafetyFindings : undefined}
              />
            ) : null}

            {crossModeQueries?.length && onCrossModeSearch ? (
              <CrossModeLinksSection queries={crossModeQueries} onModeSearch={onCrossModeSearch} />
            ) : null}

            {followUpSuggestions?.length && onPickFollowUpSuggestion ? (
              <div className="hidden sm:block">
                <AnswerFollowUpSuggestions
                  suggestions={followUpSuggestions}
                  onPick={onPickFollowUpSuggestion}
                  disabled={followUpSuggestionsDisabled}
                />
              </div>
            ) : null}
          </div>

          {centralTables.length ? (
            <div className="min-w-0 lg:sticky lg:top-24">
              <CanonicalAnswerTables tables={centralTables} />
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
              <span className={cn(iconTilePremium, "h-8 w-8 rounded-lg text-[color:var(--clinical-accent)]")}>
                <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
            }
            titleAccessory={
              <span className="nums grid h-5 min-w-5 place-items-center rounded border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] px-1 text-2xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]">
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
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </Link>
              ) : null
            }
            headerClassName="gap-2 p-2.5 sm:p-3"
            titleClassName="text-base-minus leading-5"
            closeButtonClassName="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            contentClassName="max-h-[88dvh] bg-[color:var(--surface-raised)] sm:max-h-[min(80dvh,36rem)] sm:max-w-md"
            bodyClassName="flex flex-col bg-[color:var(--surface-raised)] px-3 pb-0 pt-2 sm:p-3"
            returnFocusRef={clinicalNotesTriggerRef}
            portal
          >
            <ClinicalNotesChecklistPanel
              answer={answer}
              visualEvidence={renderModel.visualEvidence}
              viewMode={answerViewMode}
              evidenceMapRows={answerEvidenceMapRows}
              sourceLinks={renderModel.primarySources}
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
            titleAccessory={<span className={cn(subtleStatusPill, "min-h-6 px-2 text-2xs")}>{evidenceTrustLabel}</span>}
            closeLabel="Close evidence"
            headerLeading={
              <span className={cn(iconTilePremium, "h-8 w-8 rounded-lg text-[color:var(--clinical-accent)]")}>
                <Layers aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
            }
            contentClassName="max-h-[88dvh] bg-[color:var(--surface-raised)] sm:max-h-[min(88dvh,44rem)] sm:max-w-3xl"
            bodyClassName="bg-[color:var(--surface-raised)] px-3 pb-0 pt-2 sm:p-3"
            returnFocusRef={evidenceTriggerRef}
            portal
          >
            <MobileEvidenceSheetContent
              answer={answer}
              sources={sources}
              renderModel={renderModel}
              visualEvidence={renderModel.visualEvidence}
              answerEvidenceMapRows={answerEvidenceMapRows}
              sourceGovernanceWarnings={sourceGovernanceWarnings}
              demoMode={demoMode}
              initialTab={evidenceInitialTab}
              pendingFeedback={pendingFeedback}
              copiedQuotes={copiedQuotes}
              onCopyQuotes={copyQuotes}
              onSubmitFeedback={onSubmitFeedback}
              onFollowUpQuote={handleQuoteFollowUp}
              onScopeDocument={onScopeDocument}
            />
          </Sheet>
        ) : null}

        {safetyFindings.length > 0 ? (
          <Sheet
            open={safetyFindingsOpen}
            onClose={closeSafetyFindingsReview}
            title="Safety-critical source findings"
            description="Items come from source text. Verify before clinical use."
            closeLabel="Close safety findings"
            headerLeading={
              <span className={cn(iconTilePremium, "h-8 w-8 rounded-lg text-[color:var(--warning)]")}>
                <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
            }
            titleAccessory={
              <span className="nums grid h-5 min-w-5 place-items-center rounded border border-[color:var(--warning)]/20 bg-[color:var(--warning-soft)] px-1 text-2xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]">
                {safetyFindings.length}
              </span>
            }
            headerClassName="gap-2 p-2.5 sm:p-3"
            titleClassName="text-base-minus leading-5"
            closeButtonClassName="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            contentClassName="max-h-[88dvh] bg-[color:var(--surface-raised)] sm:max-h-[min(80dvh,36rem)] sm:max-w-lg"
            bodyClassName="flex flex-col bg-[color:var(--surface-raised)] px-3 pb-0 pt-2 sm:p-3"
            returnFocusRef={safetyTriggerRef}
            portal
          >
            <SafetyFindingsListContent findings={safetyFindings} />
          </Sheet>
        ) : null}
      </div>
    </div>
  );
}

// Memoized so keystrokes in the follow-up composer (which live in the parent
// ClinicalDashboard's `query` state) no longer re-render this 385-line answer +
// evidence subtree. All props are stable across keystrokes: the parent
// stabilizes its handlers with useCallback/useMemo and the `query` prop it
// passes is `latestAnswerQuery ?? query`, which is non-null and stable once an
// answer exists.
export const StagedAnswerResultSurface = memo(StagedAnswerResultSurfaceImpl);
