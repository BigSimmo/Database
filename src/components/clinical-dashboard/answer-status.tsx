"use client";

import type { CSSProperties } from "react";
import { Activity, Check, Clipboard, ClipboardCheck, History, Loader2, Square } from "lucide-react";

import {
  answerProgressDisplayMessage,
  answerProgressStepIndex,
  answerProgressSteps,
  type TimedAnswerProgressUpdate,
} from "@/components/clinical-dashboard/answer-progress";
import { useClientTime } from "@/lib/use-client-time";
import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";
import { useAppPreferences } from "@/components/clinical-dashboard/use-app-preferences";
import { ModeHomeTemplate } from "@/components/mode-home-template";
import { ShowAllChip } from "@/components/show-all-chip";
import { cn, floatingControl, sourceCard } from "@/components/ui-primitives";
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

export function AnswerSkeleton() {
  // role=status (matching LoadingPanel) so the initial answer-pending window —
  // after submit but before the first progress event — is announced. Without it
  // the aria-label sits on a plain div and screen readers stay silent until the
  // progress stepper (its own role=status) mounts.
  return (
    <div className="space-y-4" role="status" aria-label={answerLoading.ariaLabel}>
      <div className="space-y-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4">
        {skeletonBar("h-4 w-10/12", 0)}
        {skeletonBar("h-4 w-full", 1)}
        {skeletonBar("h-4 w-8/12", 2)}
        <div className={cn(sourceCard, "mt-4 flex min-h-[60px] items-center justify-between gap-3 p-3")}>
          <div className="min-w-0 flex-1 space-y-2">
            {skeletonBar("h-3 w-24", 3)}
            {skeletonBar("h-4 w-48 max-w-full", 4)}
          </div>
          {skeletonBar("h-tap w-20 rounded-lg", 5)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {skeletonBar("h-tap w-48 rounded-lg", 6)}
        {skeletonBar("h-tap w-40 rounded-lg", 7)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {skeletonBar("h-28 rounded-lg", 8)}
        {skeletonBar("hidden h-28 rounded-lg sm:block", 9)}
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
 * Single-line progress banner for the non-answer (library/document) search modes,
 * the flat sibling of AnswerProgressStepper.
 *
 * The Stop control is the sourceCapsuleHit/sourceCapsule pattern from
 * ui-primitives: the button is an invisible 48px tap target and the inner span is
 * the compact visible pill. The banner carries no vertical padding, so a bare
 * `min-h-tap` button filled its whole content box and sat 1px off the banner
 * border; splitting the face out keeps 8px of clearance without shrinking the tap
 * target, and keeps the focus ring inside the banner.
 */
export function SearchProgressBanner({ message, onStop }: { message: string; onStop: () => void }) {
  return (
    <div
      role="status"
      className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-medium text-[color:var(--text-heading)]"
    >
      <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-[color:var(--clinical-accent)]" />
      <span className="min-w-0 flex-1 truncate">{message}</span>
      <button
        type="button"
        onClick={onStop}
        data-testid="stop-answer"
        className="group inline-flex min-h-tap shrink-0 items-center justify-center rounded-full outline-none"
      >
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition group-hover:bg-[color:var(--surface-subtle)] group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[color:var(--focus)] motion-reduce:transition-none">
          <Square aria-hidden="true" className="h-3 w-3 shrink-0 fill-current" />
          Stop
        </span>
      </button>
    </div>
  );
}

type AnswerProgressDensity = "expanded" | "compact";

const answerActivityPath =
  "M0 24 H46 L52 23 L57 7 L64 37 L72 24 H122 L128 23 L133 4 L141 40 L149 24 H198 L204 23 L209 9 L216 35 L224 24 H272 L278 23 L283 10 L290 34 L298 24 H320";

function AnswerActivityTrace({ density }: { density: AnswerProgressDensity }) {
  const compact = density === "compact";

  return (
    <div
      data-testid="answer-activity-trace"
      data-density={density}
      className={cn("answer-activity-trace relative w-full overflow-hidden", compact ? "h-5" : "h-10 sm:h-12")}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 320 44"
        preserveAspectRatio="none"
        className="block size-full"
      >
        <path
          data-slot="answer-activity-trace-base"
          d={answerActivityPath}
          pathLength="320"
          fill="none"
          stroke="currentColor"
          strokeWidth={compact ? 1.25 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="text-[color:var(--clinical-accent)] opacity-25 forced-colors:text-[CanvasText] forced-colors:opacity-100"
        />
      </svg>
      {/* Two identical copies inside a 200%-wide strip. Each copy is `w-1/2` of the
          strip, i.e. exactly one container width, so the trace is not horizontally
          compressed. Translating the strip by -50% puts copy 2 where copy 1 was, so
          the loop is seamless and the resting (reduced-motion) frame at 0% is a
          correctly aligned full-width ECG rather than a blank box. */}
      <span
        aria-hidden="true"
        data-slot="answer-activity-trace-sweep"
        className="answer-activity-trace__sweep pointer-events-none absolute inset-y-0 left-0 flex w-[200%]"
      >
        {[0, 1].map((copy) => (
          <svg
            key={copy}
            focusable="false"
            viewBox="0 0 320 44"
            preserveAspectRatio="none"
            className="block h-full w-1/2 shrink-0"
          >
            <path
              d={answerActivityPath}
              pathLength="320"
              fill="none"
              stroke="currentColor"
              strokeWidth={compact ? 1.75 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="text-[color:var(--clinical-accent)] forced-colors:text-[Highlight]"
            />
          </svg>
        ))}
      </span>
    </div>
  );
}

export function AnswerProgressStepper({
  events,
  startedAt,
  active,
  onStop,
  density = "expanded",
}: {
  events: TimedAnswerProgressUpdate[];
  startedAt: number | null;
  active: boolean;
  onStop: () => void;
  density?: AnswerProgressDensity;
}) {
  const latest = events.at(-1) ?? null;
  const finished = latest?.stage === "complete";
  const now = useClientTime({
    fallback: startedAt ?? 0,
    updateInterval: active && !finished && startedAt ? 1_000 : undefined,
  });
  const currentStep = latest ? answerProgressStepIndex(latest.stage) : 0;
  const clientElapsedMs = startedAt ? Math.max(0, (finished ? (latest?.receivedAt ?? now) : now) - startedAt) : 0;
  const elapsedMs = finished && latest?.elapsedMs !== undefined ? latest.elapsedMs : clientElapsedMs;
  const currentMessage = latest ? answerProgressDisplayMessage(latest) : "Preparing the clinical search scope.";
  const compact = density === "compact" && !finished;
  const stageProgress = currentStep / Math.max(1, answerProgressSteps.length - 1);
  const details = events
    .map((event) => ({ ...event, displayMessage: answerProgressDisplayMessage(event) }))
    .filter((event, index, all) => index === 0 || event.displayMessage !== all[index - 1]?.displayMessage)
    .slice(-8);

  return (
    <section
      data-testid="answer-progress-stepper"
      data-progress-state={finished ? "complete" : "active"}
      data-density={finished ? "complete" : density}
      aria-label={finished ? "Answer generation complete" : "Answer generation progress"}
      aria-busy={active && !finished}
      className={cn(
        "border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--text-heading)]",
        finished ? "rounded-lg px-3 py-2" : compact ? "rounded-lg px-3 py-2.5" : "rounded-xl p-3 sm:p-4",
      )}
    >
      <span role="status" className="sr-only">
        {finished
          ? "Answer generation complete."
          : `Answer generation moved to step ${currentStep + 1} of ${answerProgressSteps.length}: ${answerProgressSteps[currentStep]?.label ?? "Prepare scope"}.`}
      </span>

      {compact ? <AnswerActivityTrace density="compact" /> : null}

      <div
        className={cn(
          "flex",
          finished ? "min-h-8 items-center gap-2" : compact ? "mt-1.5 items-start gap-2" : "items-start gap-3",
        )}
      >
        {finished ? (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[color:var(--surface-raised)] text-[color:var(--success)]">
            <Check className="size-icon-sm" aria-hidden />
          </span>
        ) : compact ? null : (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:var(--surface-raised)] text-[color:var(--clinical-accent)] shadow-[var(--e1)]">
            <Activity className="size-icon-lg" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-semibold sm:text-base">
              {finished
                ? `Answer ready in ${elapsedLabel(elapsedMs)}`
                : compact
                  ? "Creating cited answer"
                  : "Creating your cited answer"}
            </p>
            {!finished ? (
              <span
                className="nums shrink-0 text-xs font-medium text-[color:var(--text-muted)]"
                aria-label={`${Math.max(0, Math.floor(elapsedMs / 1_000))} seconds elapsed`}
              >
                {elapsedLabel(elapsedMs)} elapsed
              </span>
            ) : null}
          </div>
          {!finished ? (
            <p className={cn("mt-0.5 text-xs text-[color:var(--text-muted)]", compact ? "leading-snug" : "sm:text-sm")}>
              {compact ? (
                <>
                  <span className="font-medium text-[color:var(--text-body)]">
                    Step {currentStep + 1} of {answerProgressSteps.length} · {answerProgressSteps[currentStep]?.label}
                  </span>
                  <span aria-hidden="true"> — </span>
                </>
              ) : null}
              {currentMessage}
            </p>
          ) : null}
        </div>
        {active && !finished ? (
          <button
            type="button"
            onClick={onStop}
            data-testid="stop-answer"
            aria-label="Stop generating answer"
            className="group inline-flex min-h-tap shrink-0 items-center justify-center rounded-full outline-none"
          >
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition group-hover:bg-[color:var(--surface-subtle)] group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[color:var(--focus)] motion-reduce:transition-none">
              <Square className="size-icon-xs shrink-0 fill-current" aria-hidden />
              Stop
            </span>
          </button>
        ) : null}
      </div>

      {!finished && !compact ? (
        <div className="mt-2">
          <AnswerActivityTrace density="expanded" />
        </div>
      ) : null}

      {!finished && !compact ? (
        <div className="relative mt-3">
          <span
            aria-hidden
            className="absolute inset-x-[10%] top-7 hidden h-px overflow-hidden bg-[color:var(--border)] sm:block"
          >
            <span
              className="block h-full w-full origin-left bg-[color:var(--clinical-accent)] transition-transform duration-[var(--duration-base)] motion-reduce:transition-none"
              style={{ transform: `scaleX(${stageProgress})` }}
            />
          </span>
          <ol className="relative grid gap-1 sm:grid-cols-5 sm:gap-2" aria-label="Answer generation stages">
            {answerProgressSteps.map((step, index) => {
              const complete = index < currentStep;
              const current = index === currentStep;
              const last = index === answerProgressSteps.length - 1;
              return (
                <li
                  key={step.stage}
                  data-state={complete ? "complete" : current ? "current" : "pending"}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "relative flex min-w-0 items-start gap-3 rounded-lg px-2 py-2 sm:flex-col sm:items-center sm:gap-2 sm:px-2 sm:py-3 sm:text-center",
                    current
                      ? "animate-fade-up bg-[color:var(--surface-raised)] text-[color:var(--text-heading)] shadow-[var(--e1)] motion-reduce:animate-none"
                      : complete
                        ? "text-[color:var(--clinical-accent-strong)]"
                        : "text-[color:var(--text-muted)]",
                  )}
                >
                  {!last ? (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -bottom-1 left-6 top-10 w-px sm:hidden",
                        complete ? "bg-[color:var(--clinical-accent)]" : "bg-[color:var(--border)]",
                      )}
                    />
                  ) : null}
                  <span
                    data-slot="answer-progress-stage-marker"
                    className={cn(
                      "relative z-5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors duration-[var(--duration-base)] motion-reduce:transition-none",
                      complete
                        ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-strong)]"
                        : current
                          ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                          : "border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                    )}
                  >
                    {complete ? (
                      <Check className="size-icon-md" aria-hidden />
                    ) : current ? (
                      <Loader2 className="size-icon-md animate-spin motion-reduce:animate-none" aria-hidden />
                    ) : (
                      <span aria-hidden>{index + 1}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5 sm:pt-0">
                    <span className="sr-only">
                      {complete ? "Completed. " : current ? "Current step. " : "Not started. "}
                    </span>
                    <span className="block text-xs font-semibold leading-tight sm:text-sm">{step.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-[color:var(--text-muted)] sm:hidden lg:block">
                      {step.description}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {finished || !compact ? (
        <details className={cn("text-xs text-[color:var(--text-muted)]", finished ? "mt-0" : "mt-1")}>
          <summary
            className={cn(
              "cursor-pointer rounded-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              finished ? "w-fit" : "inline-flex min-h-tap items-center",
            )}
          >
            Processing details
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
