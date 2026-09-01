"use client";

import { useRouter } from "next/navigation";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { CircleAlert, ShieldAlert, TriangleAlert } from "lucide-react";

import { type AnswerFeedbackType } from "@/lib/answer-feedback";
import { AnswerFollowUpSuggestions } from "@/components/clinical-dashboard/answer-follow-up-suggestions";
import { CrossModeLinksSection } from "@/components/clinical-dashboard/cross-mode-links";
import {
  isPreformattedGroundedAnswer,
  NaturalLanguageAnswer,
  UserQuestionBubble,
} from "@/components/clinical-dashboard/answer-content";
import { answerStateForAnswer } from "@/components/clinical-dashboard/answer-copy-payload";
import { AnswerUtilityActions, SafetyFindingsListContent } from "@/components/clinical-dashboard/evidence-panels";
import { AnswerSourceDrawer } from "@/components/clinical-dashboard/answer-source-drawer";
import { useAnswerSourceSelection } from "@/components/clinical-dashboard/use-answer-source-selection";
import { CanonicalAnswerTables } from "@/components/clinical-dashboard/visual-evidence";
import { annotateSourceAttachments, buildAnswerSourceRows } from "@/components/clinical-dashboard/answer-source-rows";
import { citedDocumentHref } from "@/components/clinical-dashboard/source-actions";
import { AnswerCard, type AnswerSupportStrength } from "@/components/ui/answer-card";
import { VerificationNotice } from "@/components/ui/verification-notice";
import { Sheet } from "@/components/ui/sheet";
import { answerSurface, cn } from "@/components/ui-primitives";
import { type AnswerRenderModel } from "@/lib/answer-render-policy";
import { type AppModeId } from "@/lib/app-modes";
import { extractSafetyFindings } from "@/lib/clinical-safety";
import type { BestSourceRecommendation, EvidenceSummary, QuoteCard, RagAnswer, SearchResult } from "@/lib/types";

/**
 * Renders a staged answer with inline content and optional clinical notes, evidence, safety findings, and follow-up interfaces.
 *
 * @returns The staged answer surface.
 */
/** The header status chips share one shape so they read as one status line. */
const chipShape =
  "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-3xs font-semibold uppercase tracking-eyebrow";
/**
 * An interactive chip is a small pill inside a full-size button, not a small
 * button. `before:-inset-y-*` hit expansion draws the same 48px region and is
 * what DocumentTagCloud uses, but it is invisible to `boundingBox()` and so to
 * every tap-target check in the suite — and the safety chip is the only route to
 * the safety-critical findings sheet, which is the last control on this surface
 * that should rest on a target no gate can see. The button carries the height,
 * the inner pill carries the look.
 */
const chipButton =
  // Negative vertical margin is forbidden because wrapped chips overflow into
  // answer prose and steal clicks from citations. Keep the full min-h-12 (48px)
  // hitbox in layout so status chips cannot cover the answer body.
  "inline-flex min-h-12 shrink-0 items-center focus-visible:outline-none";
const chipFocus =
  "group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[color:var(--focus)]";

function StagedAnswerResultSurfaceImpl({
  answer,
  query,
  bestSource,
  sourceSummary,
  renderModel,
  weakEvidence,
  sources,
  safetyFindings,
  copiedAnswer,
  pendingFeedback,
  onCopyAnswer,
  onSubmitFeedback,
  onFollowUpQuote,
  crossModeQueries,
  onCrossModeSearch,
  followUpSuggestions,
  onPickFollowUpSuggestion,
  followUpSuggestionsDisabled = false,
  onScopeDocument,
}: {
  answer: RagAnswer;
  query: string;
  bestSource: BestSourceRecommendation | null;
  sourceSummary?: EvidenceSummary;
  renderModel: AnswerRenderModel;
  weakEvidence: boolean;
  sources: SearchResult[];
  safetyFindings: ReturnType<typeof extractSafetyFindings>;
  copiedAnswer: boolean;
  pendingFeedback: AnswerFeedbackType | null;
  onCopyAnswer: () => void;
  onSubmitFeedback: (feedbackType: AnswerFeedbackType) => void;
  onFollowUpQuote?: (quote: QuoteCard) => void;
  crossModeQueries?: Array<string | null | undefined>;
  onCrossModeSearch?: (mode: AppModeId, query: string) => void;
  followUpSuggestions?: string[];
  onPickFollowUpSuggestion?: (suggestion: string) => void;
  followUpSuggestionsDisabled?: boolean;
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
  const sourceOnly = answer.answerQualityTier === "source_only";
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
  const [safetyFindingsOpen, setSafetyFindingsOpen] = useState(false);
  const [evidenceGapsOpen, setEvidenceGapsOpen] = useState(false);
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
    attribution: (sourceOnly ? "extractive" : "model") as "extractive" | "model",
    sourceCount: "sourceCount" in answerState ? answerState.sourceCount : sourceCount,
    // The compact governed instruction moves into the Source-only disclosure on
    // screen. Print keeps the complete notice in the card header because a
    // collapsed interactive disclosure is not part of the printed record.
    className: sourceOnly ? "hidden print:flex" : undefined,
  };
  /**
   * The header status line the approved specimen draws: the support chip (owned
   * by AnswerCard), the safety-notes control, and the cited count.
   *
   * The safety chip is the ONLY route to the safety-critical findings sheet now
   * that the support card is gone, so it is a real button whenever there are
   * findings — never a decorative label. Its count is worded, not bare: "2
   * safety notes" survives forced-colors and greyscale print, where a coloured
   * chip alone would not.
   */
  const citedSourceCount = railSources.filter((row) => row.cited !== false).length || renderModel.primarySources.length;
  const retrievedSourceCount = Math.max(citedSourceCount, sourceCount, sources.length);
  const answerMetaChips =
    safetyFindings.length > 0 ? (
      <button
        ref={safetyTriggerRef}
        id="answer-safety-findings-drawer-trigger"
        data-testid="answer-safety-findings-trigger"
        type="button"
        onClick={openSafetyFindings}
        className={cn("group", chipButton)}
        aria-label={`Open safety-critical source findings — ${safetyFindings.length} ${safetyFindings.length === 1 ? "note" : "notes"}`}
      >
        <span
          className={cn(
            chipShape,
            "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)] transition group-hover:bg-[color:var(--warning-soft)]/70",
            chipFocus,
          )}
        >
          <TriangleAlert aria-hidden="true" className="size-icon-xs shrink-0" />
          {safetyFindings.length} {safetyFindings.length === 1 ? "safety note" : "safety notes"}
        </span>
      </button>
    ) : null;
  /**
   * Evidence gaps sit with the other status chips rather than in the action row.
   * They are a statement about the answer's evidence, like the safety notes
   * beside them — and the action row the specimen draws is Copy plus the two
   * verdicts, which at 390px is already the full width of the row.
   */
  const answerMetaChipsWithGaps =
    renderModel.warnings.length > 0 ? (
      <>
        {answerMetaChips}
        <button
          id="answer-evidence-gaps-trigger"
          data-testid="answer-evidence-gaps-trigger"
          type="button"
          onClick={() => setEvidenceGapsOpen((current) => !current)}
          className={cn("group", chipButton)}
          aria-expanded={evidenceGapsOpen}
          aria-controls={evidenceGapsOpen ? "answer-evidence-gaps-detail" : undefined}
        >
          <span
            className={cn(
              chipShape,
              "border-[color:var(--border)] bg-[color:var(--surface-wash)] text-[color:var(--text-muted)] transition group-hover:bg-[color:var(--surface-subtle)]",
              chipFocus,
            )}
          >
            <CircleAlert aria-hidden="true" className="size-icon-xs shrink-0 text-[color:var(--warning)]" />
            {renderModel.warnings.length} evidence {renderModel.warnings.length === 1 ? "gap" : "gaps"}
          </span>
        </button>
      </>
    ) : (
      answerMetaChips
    );
  const answerMetaTrailing =
    citedSourceCount > 0 ? (
      <span className="nums text-3xs text-[color:var(--text-muted)]" data-testid="answer-cited-count">
        {citedSourceCount === retrievedSourceCount
          ? `${citedSourceCount} cited`
          : `${citedSourceCount} of ${retrievedSourceCount} cited`}
      </span>
    ) : null;

  function openAnswerStateSource(sourceId: string, locator?: string) {
    const href = citedDocumentHref(sourceId, locator, [...sources, ...(answer.sources ?? [])]);
    if (href) router.push(href);
  }

  const answerProse = (
    <NaturalLanguageAnswer
      text={answer.answer}
      query={query}
      preformatted={isPreformattedGroundedAnswer(answer)}
      sourceOnly={sourceOnly}
      sourceOnlyVerificationState={answerState.kind}
      answerState={answerState}
      onOpenStateSource={openAnswerStateSource}
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
      showCopyAction={false}
    />
  );

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
            {/* PR 13 answer adoption. System-owned verification wording sits above
                ordinary prose. A source-only answer folds the compact wording into
                its disclosure on screen, while print keeps the complete notice in
                document order. The call site chooses the state, never the words.
                The degraded banner carries the one-click route back to the cited
                page, so a caution is never raised with nowhere to go. */}
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
              <AnswerCard
                state={answerState}
                verification={answerVerification}
                support={answerSupport}
                frame="bare"
                retrievalStatePlacement="content"
                verificationPlacement="content"
                metaChips={answerMetaChipsWithGaps}
                metaTrailing={answerMetaTrailing}
              >
                {answerProse}
              </AnswerCard>
            ) : (
              <AnswerCard
                state={answerState}
                verification={answerVerification}
                support={answerSupport}
                frame="bare"
                retrievalStatePlacement={answerState.kind === "stale_evidence" ? "content" : "header"}
                verificationPlacement="content"
                metaChips={answerMetaChipsWithGaps}
                metaTrailing={answerMetaTrailing}
                // Navigate to the cited page — do not reuse onScopeDocument. That
                // handler only replaces selectedDocumentIds and leaves the clinician
                // on the answer screen with a silent filter change while the button
                // is labelled "Open <source>, p. N".
                onOpenSource={openAnswerStateSource}
              >
                {answerProse}
              </AnswerCard>
            )}

            {renderModel.warnings.length > 0 && evidenceGapsOpen ? (
              <div id="answer-evidence-gaps-detail" className="grid max-w-[68ch] gap-2">
                {renderModel.warnings.map((warning, index) => (
                  <p
                    key={`${warning}:${index}`}
                    className="rounded-md border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/45 px-2.5 py-2 text-xs leading-5 text-[color:var(--text)]"
                  >
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}

            <AnswerUtilityActions
              copied={copiedAnswer}
              onCopy={onCopyAnswer}
              pendingFeedback={pendingFeedback}
              onSubmitFeedback={onSubmitFeedback}
            />

            {/* The governed caution, placed here rather than above the prose
                (owner decision, 2026-08-31, matching the approved specimen).
                `verificationPlacement="content"` on both AnswerCard arms is the
                other half of this: the card still owns the wording and still
                refuses to render an answer without it, and this is the surface
                honouring the obligation that prop documents. The words are
                unchanged. */}
            <VerificationNotice {...answerVerification} />

            {/* Kept, though the approved specimen does not draw it: that specimen
                is one answer with no library matches to show, and this collapsed
                line is the only route from an answer to the Medication and
                Differentials records behind it. Removing chrome a picture omits
                is one thing; removing a navigation route on the same evidence is
                another. Still collapsed, still below the caution. */}
            {crossModeQueries?.length && onCrossModeSearch ? (
              <CrossModeLinksSection queries={crossModeQueries} onModeSearch={onCrossModeSearch} variant="line" />
            ) : null}

            {followUpSuggestions?.length && onPickFollowUpSuggestion ? (
              <AnswerFollowUpSuggestions
                suggestions={followUpSuggestions}
                onPick={onPickFollowUpSuggestion}
                disabled={followUpSuggestionsDisabled}
                layout="rows"
              />
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
            // The warning tones are written out rather than layered onto
            // `iconTilePremium`: that recipe carries the clinical-accent border and
            // background, so appending `text-…` recoloured only the glyph — the sheet
            // opened with an amber shield sitting in a blue tile while the card that
            // opens it drew an amber one. This matches `AnswerSupportSummaryCard`'s
            // tile exactly, so the colour the design assigns to the icon tile is the
            // same on both sides of the tap.
            headerLeading={
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]">
                <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
            }
            // Neutral for the same reason as the trigger row's count: the header's
            // icon tile and title carry the state, so the number itself must not be a
            // status-coloured numeral.
            titleAccessory={
              <span className="nums grid h-5 min-w-5 place-items-center rounded border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-1 text-2xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
                {safetyFindings.length}
              </span>
            }
            headerClassName="gap-2 p-2.5 sm:p-3"
            titleClassName="text-base-minus leading-5"
            closeButtonClassName="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            contentClassName="max-h-[88dvh] bg-[color:var(--surface-raised)] sm:max-h-[min(80dvh,36rem)] sm:max-w-lg"
            // No `flex flex-col` here. The Sheet body is the scrollport, and as a flex
            // column its single child (the findings card) became a shrinkable flex
            // item: it was compressed from its natural height to whatever was left,
            // and because that card is `overflow-hidden` the findings below the fold
            // were clipped rather than scrolled. The body then had nothing to scroll,
            // so the gesture went to the page behind the sheet. A plain block
            // scrollport keeps the list at its natural height and scrolls it.
            bodyClassName="bg-[color:var(--surface-raised)] px-3 pb-0 pt-2 sm:p-3"
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
