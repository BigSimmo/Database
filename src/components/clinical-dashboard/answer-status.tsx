"use client";

import { Clipboard, ClipboardCheck, MessageSquareText, Search, Sparkles, UploadCloud } from "lucide-react";

import { ModeHomeTemplate } from "@/components/mode-home-template";
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
  desktopComposerSlotId,
}: {
  onPickSample: (sample: string) => void;
  onSearchDocuments: () => void;
  onUploadDocument: () => void;
  desktopComposerSlotId?: string;
}) {
  return (
    <ModeHomeTemplate
      testId="answer-empty-state"
      title={answerEmptyState.heading}
      subtitle={answerEmptyState.subheading}
      icon={MessageSquareText}
      headingLevel={2}
      desktopComposerSlotId={desktopComposerSlotId}
      actionsLabel={answerEmptyState.starterActionsLabel}
      actions={[
        {
          title: answerEmptyState.starters.ask.title,
          description: answerEmptyState.starters.ask.description,
          icon: Sparkles,
          onClick: () => onPickSample(answerEmptyState.starters.ask.samplePrompt),
        },
        {
          title: answerEmptyState.starters.searchDocuments.title,
          description: answerEmptyState.starters.searchDocuments.description,
          icon: Search,
          onClick: onSearchDocuments,
        },
        {
          title: answerEmptyState.starters.uploadDocument.title,
          description: answerEmptyState.starters.uploadDocument.description,
          icon: UploadCloud,
          onClick: onUploadDocument,
        },
      ]}
    />
  );
}

export function AnswerSkeleton() {
  return (
    <div className="space-y-4" aria-label={answerLoading.ariaLabel}>
      <div className="space-y-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4">
        <div className="h-4 w-10/12 animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
        <div className="h-4 w-full animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
        <div className="h-4 w-8/12 animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
        <div className={cn(sourceCard, "mt-4 flex min-h-[60px] items-center justify-between gap-3 p-3")}>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
            <div className="h-4 w-48 max-w-full animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]" />
          </div>
          <div className="h-[44px] w-20 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-[44px] w-48 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
        <div className="h-[44px] w-40 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
        <div className="hidden h-28 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)] sm:block" />
      </div>
    </div>
  );
}
