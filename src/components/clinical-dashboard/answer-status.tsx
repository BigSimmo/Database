"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Clipboard, ClipboardCheck, History, Square } from "lucide-react";

import {
  answerProgressDisplayMessage,
  answerProgressTookUnusualRoute,
  type TimedAnswerProgressUpdate,
} from "@/components/clinical-dashboard/answer-progress";
import { AnswerEvidencePreview } from "@/components/clinical-dashboard/answer-evidence-preview";
import type { VerifiedEvidencePreviewUnit } from "@/lib/answer-stream-contract";
import { useClientTime } from "@/lib/use-client-time";
import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";
import { useAppPreferences } from "@/components/clinical-dashboard/use-app-preferences";
import { ModeHomeTemplate } from "@/components/mode-home-template";
import { ShowAllChip } from "@/components/show-all-chip";
import { cn, floatingControl } from "@/components/ui-primitives";
import { appModeIcons } from "@/lib/app-mode-icons";
import type { AppModeId } from "@/lib/app-modes";
import { consolidatedModeSearchPath } from "@/lib/consolidated-mode-home-redirect";
import {
  answerLoading,
  copyButton,
  sharedHomeEmptyState,
  sharedHomePresentation,
  type SharedHomePresentation,
} from "@/lib/ui-copy";

export function CopyButton({
  label,
  shortLabel,
  ariaLabel,
  copied,
  onClick,
}: {
  label: string;
  shortLabel?: string;
  ariaLabel?: string;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={cn(floatingControl, "px-3 text-xs")}
    >
      {copied ? (
        <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Clipboard aria-hidden="true" className="h-4 w-4" />
      )}
      <span className="sm:hidden">{copied ? copyButton.copied : (shortLabel ?? label)}</span>
      <span className="hidden sm:inline">{copied ? copyButton.copied : label}</span>
    </button>
  );
}

export function SharedHomeEmptyState({
  modeId,
  desktopComposerSlotId,
  recentQueries = [],
  onSelectRecent,
}: {
  modeId: AppModeId;
  desktopComposerSlotId?: string;
  recentQueries?: string[];
  onSelectRecent?: (query: string) => void;
}) {
  // Returning users get their prior questions back as one-tap chips so they can
  // re-run without retyping. Capped for a calm surface; storage already dedupes.
  // Gated on the "Recent searches on home" preference so the settings toggle
  // actually controls this surface (2026-07-19 audit wiring).
  const { preferences } = useAppPreferences();
  const recents =
    onSelectRecent && preferences.showRecentOnHome
      ? recentQueries.filter((entry) => entry.trim().length > 0).slice(0, 5)
      : [];
  const presentation: SharedHomePresentation = sharedHomePresentation[modeId];

  return (
    <ModeHomeTemplate
      testId="shared-home-empty-state"
      title={presentation.title}
      subtitle={presentation.subtitle}
      icon={appModeIcons[modeId]}
      headingLevel={2}
      stabilizePhoneCopy
      desktopComposerSlotId={desktopComposerSlotId}
      heroAction={
        modeId === "calculators" ? (
          <ShowAllChip
            href={consolidatedModeSearchPath("calculators")}
            icon={appModeIcons.calculators}
            ariaLabel="Show all calculators"
            testId="calculators-show-all"
          />
        ) : undefined
      }
      actionsLabel={sharedHomeEmptyState.starterActionsLabel}
      actions={[]}
      footer={
        <div className="grid w-full gap-3">
          {recents.length > 0 && (
            <AnswerSuggestionChips
              testId="shared-home-recent-queries"
              suggestions={recents}
              onPick={(entry) => onSelectRecent?.(entry)}
              label={sharedHomeEmptyState.recentLabel}
              layout="wrap"
              className="home-recent-searches justify-center"
              icon={History}
            />
          )}
        </div>
      }
    />
  );
}

function skeletonBar(className: string, staggerIndex: number) {
  return (
    <div
      className={cn("animate-skeleton-shimmer stagger-item rounded bg-[color:var(--surface-inset)]", className)}
      style={{ "--stagger-index": staggerIndex } as CSSProperties}
    />
  );
}

/**
 * The window between submit and the first progress event, and the lazy-load
 * fallback for the dashboard chunk.
 *
 * It used to draw a bordered card, a source card with a tap-sized block, two
 * pill placeholders and a two-column grid — a wireframe of an answer that has
 * not been retrieved yet, promising a shape the payload may not produce (twenty
 * of thirty answers in the 2026-08-18 blinded read carried no sections at all).
 * Three prose bars make no promise beyond "text is coming", which is the only
 * thing that is actually known at this point.
 *
 * It deliberately carries no status text. This renders in the answer's body
 * slot while AnswerProgress renders the status line directly above it, and two
 * indicators disagreeing on the same screen — "Writing the answer…" over
 * "Reading your question…" — is worse than one. There is exactly one place that
 * says what is happening.
 *
 * role=status so the window is still announced; without it a screen reader stays
 * silent until AnswerProgress mounts with its own live region.
 */
export function AnswerSkeleton() {
  return (
    <div className="grid gap-2" role="status" aria-label={answerLoading.ariaLabel}>
      <div aria-hidden="true" className="grid gap-1.5">
        {skeletonBar("h-2 w-11/12", 0)}
        {skeletonBar("h-2 w-9/12", 1)}
        {skeletonBar("h-2 w-10/12", 2)}
      </div>
      <span className="sr-only">{answerLoading.ariaLabel}</span>
    </div>
  );
}

function elapsedLabel(elapsedMs: number) {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1_000));
  return seconds < 1 ? "<1s" : `${seconds}s`;
}

/**
 * The whole animation, in one element.
 *
 * A 5px dot at the head of the status line, breathing on a 2.4s cycle. It
 * replaces a `Loader2` spinner in the search banner and a scrolling ECG trace in
 * the answer progress panel, and it is the only moving thing either surface now
 * has.
 *
 * The reason it is a dot and not a spinner is the state it has to survive. The
 * indicator must stay correct and clearly visible when motion is suppressed —
 * that is a contract this repo learned the hard way, after Reduce Motion set the
 * ECG trace to `opacity: 0` and left a dead panel on a physical iPhone while an
 * answer was generating. A stopped dot is a bullet. A stopped spinner is a
 * fragment of a circle.
 *
 * The animation itself lives in globals.css as `.answer-progress-dot`, not as a
 * `motion-safe:` utility, because the in-app Motion preference has to be able to
 * opt back IN over the OS request and a Tailwind media variant cannot be
 * overridden by `html[data-motion="full"]`.
 */
function ProgressDot() {
  // One colour, running or complete. A green dot on completion was a status hue
  // carrying meaning that nothing else on the element repeated — and it was
  // redundant besides, because the line beside it already changes to "Answer
  // ready in 3s". Dropping it removes a colour-only signal and one more thing to
  // look at.
  //
  // The 20px box is the line-height of the text it marks, so the dot sits on the
  // optical centre of the first line without a nudge margin, and stays on the
  // first line when the text wraps.
  return (
    <span
      aria-hidden="true"
      data-slot="answer-progress-dot"
      className="answer-progress-dot grid h-5 w-2 shrink-0 place-items-center"
    >
      <span className="block h-[5px] w-[5px] rounded-full bg-[color:var(--clinical-accent)] forced-colors:bg-[Highlight]" />
    </span>
  );
}

/**
 * The Stop control, as a quiet text control rather than a raised pill.
 *
 * Kept at a 48px tap target with an 8px-tall visible face, the same
 * hit-area-larger-than-face pattern the raised pill used, so nothing about
 * reachability changes — only the weight.
 */
function StopControl({ onStop }: { onStop: () => void }) {
  return (
    <button
      type="button"
      onClick={onStop}
      data-testid="stop-answer"
      aria-label="Stop generating answer"
      className="group -my-2 inline-flex min-h-tap shrink-0 items-center justify-center rounded-md outline-none"
    >
      <span className="inline-flex items-center gap-1 rounded-md px-1 text-2xs font-semibold text-[color:var(--text-muted)] transition group-hover:text-[color:var(--text-heading)] group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[color:var(--focus)] motion-reduce:transition-none">
        <Square aria-hidden="true" className="size-icon-xs shrink-0 fill-current" />
        Stop
      </span>
    </button>
  );
}

/** After this long the wait is worth naming as abnormal. Deliberately a single
 *  threshold rather than a running counter: the old panel re-rendered "Ns
 *  elapsed" every second in the one position the eye already rests on, which
 *  makes the wait the subject. Nothing can be done with the number while the
 *  search is healthy; "taking longer than usual" is the part that is actionable,
 *  and it is announced once. */
const slowAnswerNoticeMs = 10_000;

function useSlowNotice(active: boolean, startedAt: number | null) {
  // The timer records WHICH run went slow rather than a bare boolean, so a new
  // question clears the notice by identity instead of by a reset written into an
  // effect body. Nothing is set synchronously during the effect.
  const [slowRun, setSlowRun] = useState<number | null>(null);
  useEffect(() => {
    if (!active || startedAt === null) return undefined;
    const timer = window.setTimeout(() => setSlowRun(startedAt), slowAnswerNoticeMs);
    return () => window.clearTimeout(timer);
  }, [active, startedAt]);
  return active && startedAt !== null && slowRun === startedAt;
}

/**
 * Single-line progress for the non-answer (library/document) search modes, the
 * flat sibling of AnswerProgress.
 *
 * It was a filled accent band with a spinning `Loader2`. Fill is how this app
 * marks a hazard, and a search in flight is not one, so it is now the same quiet
 * line the answer surface uses.
 */
export function SearchProgressBanner({ message, onStop }: { message: string; onStop: () => void }) {
  return (
    <p
      role="status"
      data-testid="search-progress"
      className="flex min-h-8 items-start gap-2 text-xs leading-5 text-[color:var(--text-muted)]"
    >
      <ProgressDot />
      <span className="min-w-0 flex-1">{message}</span>
      <StopControl onStop={onStop} />
    </p>
  );
}

/**
 * The wait on the answer surface.
 *
 * Replaces `AnswerProgressStepper`: a filled accent panel carrying a 36px icon
 * tile, a five-circle stepper with connecting rails, a scrolling ECG trace, a
 * per-second elapsed counter and a Processing details disclosure. Six things
 * were wrong with it, and the two that mattered are these — it narrated the
 * orchestrator's five stages, which the reader is not operating, and it never
 * showed a single source, even though the evidence preview crosses the stream
 * boundary before the prose and is the most useful content this surface has.
 *
 * What is here instead is one status line and the sources arriving beneath it,
 * drawn in the answer's own column at the answer's own size. Two consequences
 * are the point of the design rather than side effects:
 *
 *  - **Nothing jumps.** The old panel was ~210px tall and was removed, not
 *    transformed, when the answer arrived, so everything below it moved up by
 *    that distance at the exact moment the reader was given something to read.
 *    Here only the line changes; the rail stays where the eye settled.
 *  - **The rail degrades to nothing, not to a placeholder.** The preview unit is
 *    gated behind `NEXT_PUBLIC_RAG_INCREMENTAL_EVIDENCE_PREVIEW_RENDER` (#100
 *    Phase 1) and is off by default, so today the line carries the accrual on
 *    its own via `resultCount` and the rail is simply absent. Nothing here
 *    fabricates a source to fill the space.
 */
export function AnswerProgress({
  events,
  startedAt,
  active,
  onStop,
  evidencePreview = null,
}: {
  events: TimedAnswerProgressUpdate[];
  startedAt: number | null;
  active: boolean;
  onStop: () => void;
  evidencePreview?: VerifiedEvidencePreviewUnit | null;
}) {
  const latest = events.at(-1) ?? null;
  const finished = latest?.stage === "complete";
  const running = active && !finished;
  const slow = useSlowNotice(running, startedAt);
  // Only read on completion, so the clock is sampled once rather than subscribed
  // to at 1Hz for the whole wait.
  const now = useClientTime({ fallback: startedAt ?? 0 });
  const clientElapsedMs = startedAt ? Math.max(0, (latest?.receivedAt ?? now) - startedAt) : 0;
  const elapsedMs = latest?.elapsedMs !== undefined ? latest.elapsedMs : clientElapsedMs;
  const currentMessage = latest ? answerProgressDisplayMessage(latest) : "Reading your question…";
  const unusualRoute = answerProgressTookUnusualRoute(events);
  const details = events
    .map((event) => ({ ...event, displayMessage: answerProgressDisplayMessage(event) }))
    .filter((event, index, all) => index === 0 || event.displayMessage !== all[index - 1]?.displayMessage)
    .slice(-8);

  return (
    <section
      data-testid="answer-progress"
      data-progress-state={finished ? "complete" : "active"}
      aria-label={finished ? "Answer generation complete" : "Answer generation progress"}
      aria-busy={running}
      className="grid gap-2"
    >
      <p
        aria-live="polite"
        data-testid="answer-progress-line"
        className="flex items-start gap-2 text-xs leading-5 text-[color:var(--text-muted)]"
      >
        <ProgressDot />
        <span className="min-w-0 flex-1">
          {finished ? (
            <span className="font-medium text-[color:var(--text-heading)]">
              Answer ready in {elapsedLabel(elapsedMs)}
            </span>
          ) : (
            <>
              {currentMessage}
              {slow ? <span> &middot; taking longer than usual</span> : null}
            </>
          )}
        </span>
        {running ? <StopControl onStop={onStop} /> : null}
      </p>

      {evidencePreview ? <AnswerEvidencePreview preview={evidencePreview} /> : null}

      {/* A routine answer has nothing to disclose — the old panel offered the same
          five stages every time. These three stages mean the answer did not take
          the ordinary route, which is the case a reader may actually want to read
          back. */}
      {finished && unusualRoute ? (
        <details className="text-2xs text-[color:var(--text-muted)]">
          <summary className="w-fit cursor-pointer rounded-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]">
            How this answer was built
          </summary>
          <ol className="mt-2 space-y-1 border-l border-[color:var(--border)] pl-3">
            {details.map((event, index) => (
              <li key={`${event.receivedAt}-${event.stage}-${index}`} className="leading-relaxed">
                {event.displayMessage}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
