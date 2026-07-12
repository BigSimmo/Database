"use client";

import { Clipboard, ClipboardCheck, History, MessageSquareText, Search, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";

import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";
import { ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { cn, floatingControl, sourceCard } from "@/components/ui-primitives";
import { answerEmptyState, answerLoading, copyButton, privacyCopy } from "@/lib/ui-copy";

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
  onSearchDocuments,
  onUploadDocument,
  desktopComposerSlotId,
  recentQueries = [],
  onSelectRecent,
}: {
  onSearchDocuments: () => void;
  onUploadDocument: () => void;
  desktopComposerSlotId?: string;
  recentQueries?: string[];
  onSelectRecent?: (query: string) => void;
}) {
  // Returning users get their prior questions back as one-tap chips so they can
  // re-run without retyping. Capped for a calm surface; storage already dedupes.
  const recents = onSelectRecent ? recentQueries.filter((entry) => entry.trim().length > 0).slice(0, 5) : [];

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
          {/* Quick actions are secondary to the composer above, so they read as
              light text links (not pills) with a hairline divider — this also
              breaks the visual repetition of stacked equal-weight chip rows. */}
          <div className="answer-quick-actions" role="group" aria-label={answerEmptyState.quickActionsLabel}>
            <button type="button" className="answer-quick-action" onClick={onSearchDocuments}>
              <Search className="answer-quick-action-icon" aria-hidden="true" />
              {answerEmptyState.starters.searchDocuments.title}
            </button>
            <span className="answer-quick-action-divider" aria-hidden="true" />
            <button type="button" className="answer-quick-action" onClick={onUploadDocument}>
              <Upload className="answer-quick-action-icon" aria-hidden="true" />
              {answerEmptyState.starters.uploadDocument.title}
            </button>
          </div>
          <ModeHomeVerificationFooter icon={ShieldCheck} label="Source backed" body="Clinical Guide library" />
          {/* APP-5 collection notice + on-query PHI reminder, kept to one calm line
              at the point of collection; full detail on /privacy. See PIA-1/PIA-5. */}
          <p
            className="text-center text-2xs leading-4 text-[color:var(--text-muted)]"
            aria-label={privacyCopy.noticeAriaLabel}
          >
            {privacyCopy.composerNotice}{" "}
            <Link
              href="/privacy"
              className="font-medium text-[color:var(--text-soft)] underline underline-offset-2 transition-colors hover:text-[color:var(--text-heading)]"
            >
              {privacyCopy.composerLinkLabel}
            </Link>
          </p>
        </div>
      }
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
          <div className="h-11 w-20 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-11 w-48 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
        <div className="h-11 w-40 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)]" />
        <div className="hidden h-28 animate-skeleton-shimmer rounded-lg bg-[color:var(--surface-inset)] sm:block" />
      </div>
    </div>
  );
}
