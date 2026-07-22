"use client";

import {
  Check,
  Circle,
  Clipboard,
  ClipboardCheck,
  History,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Square,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  answerProgressDisplayMessage,
  answerProgressStepIndex,
  answerProgressSteps,
  type TimedAnswerProgressUpdate,
} from "@/components/clinical-dashboard/answer-progress";
import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";
import { useAppPreferences } from "@/components/clinical-dashboard/use-app-preferences";
import { ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { cn, floatingControl, sourceCard } from "@/components/ui-primitives";
import { answerEmptyState, answerLoading, copyButton } from "@/lib/ui-copy";

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

export function AnswerEmptyState({
  desktopComposerSlotId,
  recentQueries = [],
  onSelectRecent,
}: {
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

  return (
    <ModeHomeTemplate
      testId="answer-empty-state"
      title={answerEmptyState.heading}
      subtitle={answerEmptyState.subheading}
      icon={MessageSquareText}
      headingLevel={2}
      desktopComposerSlotId={desktopComposerSlotId}
      actionsLabel={answerEmptyState.starterActionsLabel}
      actions={[]}
      footer={
        <div className="grid w-full gap-3">
          {recents.length > 0 && (
            <AnswerSuggestionChips
              testId="answer-recent-queries"
              suggestions={recents}
              onPick={(entry) => onSelectRecent?.(entry)}
              label={answerEmptyState.recentLabel}
              layout="wrap"
              className="justify-center"
              icon={History}
            />
          )}
          {/* No privacy link here: the composer's PrivacyInputNotice is the
              single site-wide notice, so the hero footer must not repeat it. */}
          {/* Pre-query copy must describe what the search does, not assert that
              every indexed source is verified/current (PT-06): validation status
              varies per document and is surfaced on the results themselves. */}
          <ModeHomeVerificationFooter
            icon={ShieldCheck}
            label="Searches indexed clinical sources"
            body="Clinical Guide library"
          />
        </div>
      }
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
        <div className="h-4 w-10/12 animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
        <div className="h-4 w-full animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
        <div className="h-4 w-8/12 animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
        <div className={cn(sourceCard, "mt-4 flex min-h-[60px] items-center justify-between gap-3 p-3")}>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
            <div className="h-4 w-48 max-w-full animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
          </div>
          <div className="h-tap w-20 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-tap w-48 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
        <div className="h-tap w-40 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
        <div className="hidden h-28 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)] sm:block" />
      </div>
      <span className="sr-only">{answerLoading.ariaLabel}</span>
    </div>
  );
}

function elapsedLabel(elapsedMs: number) {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1_000));
  return seconds < 1 ? "<1s" : `${seconds}s`;
}

export function AnswerProgressStepper({
  events,
  startedAt,
  active,
  onStop,
}: {
  events: TimedAnswerProgressUpdate[];
  startedAt: number | null;
  active: boolean;
  onStop: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const latest = events.at(-1) ?? null;
  const finished = latest?.stage === "complete";
  const currentStep = latest ? answerProgressStepIndex(latest.stage) : 0;

  useEffect(() => {
    if (!active || finished || !startedAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [active, finished, startedAt]);

  const clientElapsedMs = startedAt ? Math.max(0, (finished ? (latest?.receivedAt ?? now) : now) - startedAt) : 0;
  const elapsedMs = finished && latest?.elapsedMs !== undefined ? latest.elapsedMs : clientElapsedMs;
  const details = events
    .map((event) => ({ ...event, displayMessage: answerProgressDisplayMessage(event) }))
    .filter((event, index, all) => index === 0 || event.displayMessage !== all[index - 1]?.displayMessage)
    .slice(-8);

  return (
    <section
      data-testid="answer-progress-stepper"
      data-progress-state={finished ? "complete" : "active"}
      aria-label={finished ? "Answer generation complete" : "Answer generation progress"}
      className="rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] px-3 py-2 text-[color:var(--text-heading)]"
    >
      <div className="flex min-h-8 items-center gap-2">
        {finished ? (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-[color:var(--clinical-accent)] motion-reduce:animate-none"
            aria-hidden
          />
        )}
        <p className="min-w-0 flex-1 text-sm font-semibold" role="status" aria-live="polite">
          {finished
            ? `Answer ready in ${elapsedLabel(elapsedMs)}`
            : latest
              ? answerProgressDisplayMessage(latest)
              : "Preparing the clinical search scope."}
        </p>
        {!finished ? (
          <span
            className="shrink-0 text-xs font-medium tabular-nums text-[color:var(--text-muted)]"
            aria-label={`${Math.max(0, Math.floor(elapsedMs / 1_000))} seconds elapsed`}
          >
            {elapsedLabel(elapsedMs)}
          </span>
        ) : null}
        {active && !finished ? (
          <button
            type="button"
            onClick={onStop}
            data-testid="stop-answer"
            className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <Square className="h-3 w-3 shrink-0 fill-current" aria-hidden />
            Stop
          </button>
        ) : null}
      </div>

      {!finished ? (
        <div className="mt-2 overflow-x-auto pb-1" aria-label="Answer generation stages">
          <ol className="grid min-w-[500px] grid-cols-5 gap-1 sm:min-w-0">
            {answerProgressSteps.map((step, index) => {
              const complete = index < currentStep;
              const current = index === currentStep;
              return (
                <li
                  key={step.stage}
                  data-state={complete ? "complete" : current ? "current" : "pending"}
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium",
                    current
                      ? "bg-[color:var(--surface-raised)] text-[color:var(--text-heading)]"
                      : complete
                        ? "text-[color:var(--clinical-accent-strong)]"
                        : "text-[color:var(--text-muted)]",
                  )}
                >
                  {complete ? (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : current ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="leading-tight">{step.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      <details className={cn("text-xs text-[color:var(--text-muted)]", finished ? "mt-0" : "mt-1")}>
        <summary className="w-fit cursor-pointer rounded-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]">
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
    </section>
  );
}
