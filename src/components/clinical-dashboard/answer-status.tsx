"use client";

import { Clipboard, ClipboardCheck, MessageSquareText, Search, Sparkles, UploadCloud } from "lucide-react";

import { cn, floatingControl, sourceCard, textMuted } from "@/components/ui-primitives";
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
      {copied ? <ClipboardCheck className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
      <span className="sm:hidden">{copied ? copyButton.copied : (shortLabel ?? label)}</span>
      <span className="hidden sm:inline">{copied ? copyButton.copied : label}</span>
    </button>
  );
}

export function AnswerEmptyState({
  onPickSample,
  onSearchDocuments,
  onUploadDocument,
}: {
  onPickSample: (sample: string) => void;
  onSearchDocuments: () => void;
  onUploadDocument: () => void;
}) {
  const starterButtonClass = cn(
    floatingControl,
    "min-h-[64px] flex-col items-start justify-center gap-1.5 rounded-lg px-4 py-3 text-left shadow-[var(--shadow-inset)] sm:min-h-[6.25rem] sm:items-center sm:text-center",
  );

  return (
    <div className="mx-auto grid w-full max-w-xl place-items-center gap-5 py-8 text-center sm:py-16">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[color:var(--clinical-chat-teal)]/15 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
        <MessageSquareText className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-normal text-[color:var(--text-heading)]">
          {answerEmptyState.heading}
        </h2>
        <p className={cn("mx-auto max-w-sm text-sm leading-6", textMuted)}>{answerEmptyState.subheading}</p>
      </div>
      <section aria-label={answerEmptyState.starterActionsLabel} className={cn("grid w-full gap-3 sm:grid-cols-3")}>
        <button
          type="button"
          onClick={() => onPickSample(answerEmptyState.starters.ask.samplePrompt)}
          className={starterButtonClass}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)] sm:flex-col sm:gap-2">
            <Sparkles className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
            {answerEmptyState.starters.ask.title}
          </span>
          <span className={cn("line-clamp-2 text-xs leading-5 sm:max-w-[9rem]", textMuted)}>
            {answerEmptyState.starters.ask.description}
          </span>
        </button>
        <button type="button" onClick={onSearchDocuments} className={starterButtonClass}>
          <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)] sm:flex-col sm:gap-2">
            <Search className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
            {answerEmptyState.starters.searchDocuments.title}
          </span>
          <span className={cn("line-clamp-2 text-xs leading-5 sm:max-w-[9rem]", textMuted)}>
            {answerEmptyState.starters.searchDocuments.description}
          </span>
        </button>
        <button type="button" onClick={onUploadDocument} className={starterButtonClass}>
          <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)] sm:flex-col sm:gap-2">
            <UploadCloud className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
            {answerEmptyState.starters.uploadDocument.title}
          </span>
          <span className={cn("line-clamp-2 text-xs leading-5 sm:max-w-[9rem]", textMuted)}>
            {answerEmptyState.starters.uploadDocument.description}
          </span>
        </button>
      </section>
    </div>
  );
}

export function AnswerSkeleton() {
  return (
    <div className="space-y-4" aria-label={answerLoading.ariaLabel}>
      <div className="space-y-3 rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)]/45 p-4">
        <div className="h-4 w-10/12 animate-skeleton-shimmer rounded bg-[color:var(--surface-subtle)]" />
        <div className="h-4 w-full animate-skeleton-shimmer rounded bg-[color:var(--surface-subtle)]" />
        <div className="h-4 w-8/12 animate-skeleton-shimmer rounded bg-[color:var(--surface-subtle)]" />
        <div className={cn(sourceCard, "mt-4 flex min-h-[60px] items-center justify-between gap-3 p-3")}>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 animate-skeleton-shimmer rounded bg-[color:var(--surface-subtle)]" />
            <div className="h-4 w-48 max-w-full animate-skeleton-shimmer rounded bg-[color:var(--surface-subtle)]" />
          </div>
          <div className="h-[44px] w-20 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-subtle)]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-[44px] w-48 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-subtle)]" />
        <div className="h-[44px] w-40 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-subtle)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-subtle)]" />
        <div className="hidden h-28 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-subtle)] sm:block" />
      </div>
    </div>
  );
}
