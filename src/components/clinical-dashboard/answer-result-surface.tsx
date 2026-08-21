"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck, ExternalLink, Layers, ShieldAlert } from "lucide-react";

import { type AnswerFeedbackType } from "@/lib/answer-feedback";
import { AnswerFollowUpSuggestions } from "@/components/clinical-dashboard/answer-follow-up-suggestions";
import { CrossModeLinksSection } from "@/components/clinical-dashboard/cross-mode-links";
import { isPreformattedGroundedAnswer, NaturalLanguageAnswer } from "@/components/clinical-dashboard/answer-content";
import { answerStateForAnswer } from "@/components/clinical-dashboard/answer-copy-payload";
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
import { citedDocumentHref } from "@/components/clinical-dashboard/source-actions";
import { CanonicalAnswerTables, MobileEvidenceSheetContent } from "@/components/clinical-dashboard/visual-evidence";
import { AnswerCard, AnswerCardQueryEcho, type AnswerSupportStrength } from "@/components/ui/answer-card";
import { Sheet } from "@/components/ui/sheet";
import { answerSurface, cn, iconTilePremium, subtleStatusPill } from "@/components/ui-primitives";
import { type AnswerRenderModel } from "@/lib/answer-render-policy";
import { type AppModeId } from "@/lib/app-modes";
import { extractSafetyFindings } from "@/lib/clinical-safety";
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
  const router = useRouter();
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
  // `trust` already distinguishes these; until now only a conditionally-rendered
  // side card ever showed the difference, so a "medium" answer - which includes
  // the case of a high-risk claim resting on unreviewed-authority evidence - read
  // exactly like a fully verified one. Wording lives in AnswerCard.
  const answerSupport: AnswerSupportStrength =
    renderModel.trust === "high"
      ? "strong"
      : renderModel.trust === "medium"
        ? "supported"
        : renderModel.trust === "low"
          ? "limited"
          : "unassessed";
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
  /**
   * PR 13 answer adoption. The design system's projection of the same payload,
   * built here so the live support-priority caution and the DS
   * `RetrievalStateBanner` are two renderings of one state rather than two
   * independent readings of the same fields.
   *
   * Goes through `answerStateForAnswer` so empty `answer.sources` still falls
   * back to the search-result set — the same resolution the clipboard path uses.
   * `weakEvidence` is passed through rather than re-derived — render trust is
   * the render policy's decision, not this layer's.
   */
  const answerState = useMemo(
    () => answerStateForAnswer({ answer, sources, weakEvidence }),
    [answer, sources, weakEvidence],
  );
  const priority = answerSupportPriority(answer, safeAnswerSections, centralVisualEvidence, safetyFindings, {
    grounded: answerGrounded,
    weakEvidence,
    answerState,
  });
  // Built once so both arms of the `ready` / degraded split below stay identical.
  // The split exists only because `AnswerCardProps` discriminates on `state` to make
  // `onOpenSource` required for a degraded card (DECISIONS §Q1), and a union-typed
  // `state` cannot narrow that at the call site.
  const answerVerification = {
    state: answerState.kind,
    presentation: "responsive-compact" as const,
    // From the quality tier, never from the state kind: #207 precedence lets
    // stale/partial/ungrounded outrank source_only, so keying on the kind announced
    // "AI-generated" directly above the Source-only disclosure saying no model wrote
    // it (#228).
    attribution: (answer.answerQualityTier === "source_only" ? "extractive" : "model") as "extractive" | "model",
    sourceCount: "sourceCount" in answerState ? answerState.sourceCount : sourceCount,
  };
  const answerProse = (
    <NaturalLanguageAnswer
      text={answer.answer}
      query={query}
      preformatted={isPreformattedGroundedAnswer(answer)}
      sourceCount={sourceCount}
      sourceOnly={answer.answerQualityTier === "source_only"}
      bestSource={bestSource}
      sources={sources}
      sourceLinks={renderModel.primarySources}
      copied={copiedAnswer}
      onCopy={onCopyAnswer}
    />
  );
  const inlineEvidenceSummary = compactEvidenceSummary(answer, sources, sourceSummary, renderModel);
  const evidenceTrustLabel = inlineEvidenceSummary.split(" · ")[0] || "Review support";
  const showInlineSupportCard = Boolean(priority || showClinicalNotes || showEvidenceDrawer);
  const showLayoutAside = centralTables.length > 0;

  return (
    <div className="min-w-0 space-y-4 motion-safe:animate-fade-up sm:space-y-5" data-dashboard-stage="answer-surface">
      {/* No outer p-2.5: AnswerCard is the raised surface (#216). Nesting panel
          padding here stacked on the card's own pad and blew the phone short-answer
          scroll budget (#227) by ~60px. */}
      <div className={cn(answerSurface, "space-y-3")}>
        {/* When a table aside is present, keep the query echo above the grid — the
            same placement UserQuestionBubble had — so desktop tableTop aligns with
            the card chrome rather than sitting ~40px above prose buried under the
            in-card query+notice stack (ui-smoke clinical-table delta). Phone-only
            answers without a table keep the echo inside AnswerCard. */}
        {showLayoutAside ? <AnswerCardQueryEcho query={query} className="px-1" /> : null}
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
            {/* PR 13 answer adoption. System-owned verification wording above the
                prose, in document order, on screen and on print alike — the call
                site chooses the state, never the words. The degraded banner sits
                directly under it and carries the one-click route back to the
                cited page, so a caution is never raised with nowhere to go. */}
            {/* One count, not two. The notice and the banner are the two
                governance statements on this surface and they sit adjacent, so
                reading "Based on 3 cited sources." directly above "2 of 7
                sources for this answer are past their review date" leaves a
                clinician unable to tell how much of the evidence base is
                overdue. Both now come from the projection. `source_only` is the
                one kind that carries no count, hence the `in` guard.

                The card owns the notice, the banner, the query echo, and their
                order now. The banner it raises is scoped to
                `stale_evidence`/`partial_retrieval` — the two kinds that say
                something the notice cannot (#227 over #207; see answer-card.tsx).
                This surface no longer decides that. */}
            {answerState.kind === "ready" ? (
              <AnswerCard
                state={answerState}
                verification={answerVerification}
                support={answerSupport}
                query={showLayoutAside ? undefined : query}
              >
                {answerProse}
              </AnswerCard>
            ) : (
              <AnswerCard
                state={answerState}
                verification={answerVerification}
                support={answerSupport}
                query={showLayoutAside ? undefined : query}
                // Navigate to the cited page — do not reuse onScopeDocument. That
                // handler only replaces selectedDocumentIds and leaves the clinician
                // on the answer screen with a silent filter change while the button
                // is labelled "Open <source>, p. N".
                onOpenSource={(sourceId, locator) => {
                  const href = citedDocumentHref(sourceId, locator, [...sources, ...(answer.sources ?? [])]);
                  if (href) router.push(href);
                }}
              >
                {answerProse}
              </AnswerCard>
            )}

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
              <CrossModeLinksSection
                queries={crossModeQueries}
                onModeSearch={onCrossModeSearch}
                variant="responsive-compact"
              />
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
            description="Check how well sources support this answer."
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
          >
            <MobileEvidenceSheetContent
              answer={answer}
              sources={sources}
              renderModel={renderModel}
              visualEvidence={renderModel.visualEvidence}
              answerEvidenceMapRows={answerEvidenceMapRows}
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
