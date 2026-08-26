"use client";

import { useRouter } from "next/navigation";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { type AnswerFeedbackType } from "@/lib/answer-feedback";
import { AnswerFollowUpSuggestions } from "@/components/clinical-dashboard/answer-follow-up-suggestions";
import { CrossModeLinksSection } from "@/components/clinical-dashboard/cross-mode-links";
import {
  isPreformattedGroundedAnswer,
  NaturalLanguageAnswer,
  UserQuestionBubble,
} from "@/components/clinical-dashboard/answer-content";
import { answerStateForAnswer } from "@/components/clinical-dashboard/answer-copy-payload";
import {
  AnswerSupportSummaryCard,
  answerSupportPriority,
  primaryVisualTable,
  SafetyFindingsListContent,
} from "@/components/clinical-dashboard/evidence-panels";
import { AnswerSourceDrawer } from "@/components/clinical-dashboard/answer-source-drawer";
import { useAnswerSourceSelection } from "@/components/clinical-dashboard/use-answer-source-selection";
import { CanonicalAnswerTables } from "@/components/clinical-dashboard/visual-evidence";
import { annotateSourceAttachments, buildAnswerSourceRows } from "@/components/clinical-dashboard/answer-source-rows";
import { citedDocumentHref } from "@/components/clinical-dashboard/source-actions";
import { AnswerCard, type AnswerSupportStrength } from "@/components/ui/answer-card";
import { Sheet } from "@/components/ui/sheet";
import { answerSurface, cn, iconTilePremium } from "@/components/ui-primitives";
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
  answerGrounded,
  sources,
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
  onScopeDocument,
}: {
  answer: RagAnswer;
  query: string;
  bestSource: BestSourceRecommendation | null;
  sourceSummary?: EvidenceSummary;
  renderModel: AnswerRenderModel;
  weakEvidence: boolean;
  answerGrounded: boolean;
  sources: SearchResult[];
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
  /** Narrows the search to one document, from the source drawer's overflow menu. */
  onScopeDocument?: (documentId: string) => void;
}) {
  const router = useRouter();
  const sourceCount =
    renderModel.primarySources.length ||
    sourceSummary?.total_sources ||
    sources.length ||
    answer.sources?.length ||
    answer.citations.length;
  const centralTables = renderModel.tables;
  /**
   * The one cited-source list. The rail under the answer lists these rows and the
   * drawer pages through them, so both are built from the same derivation rather
   * than each re-deriving from `primarySources` and drifting apart.
   */
  const railSources = useMemo(
    () =>
      annotateSourceAttachments(buildAnswerSourceRows(bestSource, sources, renderModel.primarySources), {
        tables: renderModel.tables,
        visualEvidence: renderModel.visualEvidence,
      }),
    [bestSource, sources, renderModel.primarySources, renderModel.tables, renderModel.visualEvidence],
  );
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
  const [safetyFindingsOpen, setSafetyFindingsOpen] = useState(false);
  /**
   * Which source the drawer is showing, whether a claim put it there, and that
   * claim's own support status — reset whenever the answer beneath them changes,
   * because all three are indices into one answer. See the hook for why that
   * reset is structural rather than left to the drawer's close handlers.
   */
  const {
    openIndex: openSourceIndex,
    claimIndex: claimSourceIndex,
    claimSupport,
    openFromRail: openSourceFromRail,
    openFromClaim: openSourceFromClaim,
    close: closeSourceDrawer,
  } = useAnswerSourceSelection(answer.interactionId ?? answer.answer);
  /**
   * "This page doesn't support the claim", from the drawer's overflow menu.
   *
   * It rides the answer feedback channel that already exists rather than a new
   * one: `wrong_source` is exactly this report in the shipped taxonomy
   * (`src/lib/answer-feedback.ts`), and reusing it means the report lands in the
   * same place a clinician's other answer feedback does.
   */
  const reportSourceMismatch = useCallback(() => {
    onSubmitFeedback("wrong_source");
  }, [onSubmitFeedback]);
  const safetyTriggerRef = useRef<HTMLButtonElement>(null);
  function openSafetyFindings() {
    setSafetyFindingsOpen(true);
  }
  function closeSafetyFindingsReview() {
    setSafetyFindingsOpen(false);
  }
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
    // Chat framing: one quiet governed line above the prose at every width, with
    // the complete wording still printed. Clinical owner approved 2026-08-25 —
    // see the `inline` docstring in verification-notice.tsx.
    presentation: "inline" as const,
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
      sourceOnly={answer.answerQualityTier === "source_only"}
      bestSource={bestSource}
      sources={sources}
      sourceLinks={renderModel.primarySources}
      // Server-assessed, per-sentence. This is what lets a number in the prose
      // restate an attribution the answer pipeline already made rather than one
      // this layer invented; where it is absent the prose renders unmarked.
      claims={answer.supportedClaims}
      railRows={railSources}
      copied={copiedAnswer}
      onCopy={onCopyAnswer}
      onOpenSource={openSourceFromClaim}
      onOpenRailSource={openSourceFromRail}
      openSourceIndex={openSourceIndex}
    />
  );
  /**
   * The support card is now the answer-level strip and nothing else: the safety
   * priority row (its trigger is the only route to the safety sheet), the
   * evidence gaps that belong to the answer rather than to any one document, and
   * the feedback control. Everything per-source moved to the rail and drawer.
   * Mount when any of those rows would render — a clean high-trust answer still
   * needs the "Report a problem" path.
   */
  const showInlineSupportCard = Boolean(priority || renderModel.warnings.length > 0 || onSubmitFeedback);

  return (
    <div className="min-w-0 space-y-4 motion-safe:animate-fade-up sm:space-y-5" data-dashboard-stage="answer-surface">
      {/* No outer p-2.5: AnswerCard is the raised surface (#216). Nesting panel
          padding here stacked on the card's own pad and blew the phone short-answer
          scroll budget (#227) by ~60px. */}
      <div className={cn(answerSurface, "space-y-3")}>
        {/* Decision 2 (2026-08-24): tables fold into the source drawer, so there is
            no longer a wide-screen aside for the echo to align against and the card
            owns the query echo in every layout. */}
        <div data-testid="table-specific-answer-layout" data-desktop-table-aside="false" className="space-y-3">
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
            {/* The question is a chat bubble on the current turn, exactly as it is
                on every prior turn. It used to be a muted echo inside the card
                header, which made the newest exchange read as a document with a
                subtitle while the ones above it read as a conversation.
                `AnswerCardQueryEcho`'s sr-only "Question: " prefix travels with
                it (see UserQuestionBubble) so the framing change costs a screen
                reader nothing. */}
            <UserQuestionBubble query={query} />
            {answerState.kind === "ready" ? (
              <AnswerCard state={answerState} verification={answerVerification} support={answerSupport} frame="bare">
                {answerProse}
              </AnswerCard>
            ) : (
              <AnswerCard
                state={answerState}
                verification={answerVerification}
                support={answerSupport}
                frame="bare"
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
                warnings={renderModel.warnings}
                safetyTriggerRef={safetyTriggerRef}
                safetyFindingsCount={safetyFindings.length}
                onOpenSafetyFindings={safetyFindings.length > 0 ? openSafetyFindings : undefined}
                pendingFeedback={pendingFeedback}
                onSubmitFeedback={onSubmitFeedback}
                // Chat framing: safety keeps its row, the other two collapse to
                // one line of buttons rather than two 56px stacked rows.
                density="compact"
              />
            ) : null}

            {/* Follow-ups first, and on every width. They were wrapped in
                `hidden sm:block`, so the most likely next tap on this surface
                was desktop-only — the phone got the two "where else does this
                appear" panels and none of the questions. Asking the next
                question is the clinical step; browsing the library is not, so
                the questions lead and the matches collapse to one line beneath
                them (owner decision, 2026-08-26, "direction B"). */}
            {followUpSuggestions?.length && onPickFollowUpSuggestion ? (
              <AnswerFollowUpSuggestions
                suggestions={followUpSuggestions}
                onPick={onPickFollowUpSuggestion}
                disabled={followUpSuggestionsDisabled}
                layout="rows"
              />
            ) : null}

            {crossModeQueries?.length && onCrossModeSearch ? (
              <CrossModeLinksSection queries={crossModeQueries} onModeSearch={onCrossModeSearch} variant="line" />
            ) : null}
          </div>
        </div>

        {/* Tables live in the drawer, and the drawer is reached through a rail row.
            `dedupeVisualEvidence` only filters visual evidence against the primary
            sources when there are some, so an answer can carry a table with no
            cited source to hang it off — and that table would then have no route at
            all. Render those in place rather than lose them. */}
        {centralTables.length > 0 && railSources.length === 0 ? (
          <div data-testid="answer-uncited-tables" className="min-w-0">
            <CanonicalAnswerTables tables={centralTables} />
          </div>
        ) : null}

        <AnswerSourceDrawer
          sources={railSources}
          openIndex={openSourceIndex}
          activeSupportIndex={claimSourceIndex}
          activeClaimSupport={claimSupport}
          // Paging past the source a claim pointed at drops the claim, so the
          // support sentence stops describing a page the reader is no longer on.
          onOpenIndexChange={openSourceFromRail}
          onClose={closeSourceDrawer}
          query={query}
          tables={centralTables}
          visualEvidence={renderModel.visualEvidence}
          quoteCards={renderModel.quoteCards}
          onFollowUpQuote={onFollowUpQuote}
          onScopeDocument={onScopeDocument}
          onReportSource={reportSourceMismatch}
        />

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
