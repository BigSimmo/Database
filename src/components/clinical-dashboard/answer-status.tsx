"use client";

import { Clipboard, ClipboardCheck, MessageSquareText, Search, Sparkles, UploadCloud } from "lucide-react";

import { cn, floatingControl, sourceCard, textMuted } from "@/components/ui-primitives";

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
      <span className="sm:hidden">{copied ? "Copied" : (shortLabel ?? label)}</span>
      <span className="hidden sm:inline">{copied ? "Copied" : label}</span>
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
    "min-h-[68px] flex-col items-start justify-center gap-1.5 rounded-xl px-4 py-3 text-left sm:min-h-[7rem] sm:items-center sm:text-center",
  );

  return (
    <div className="mx-auto grid w-full max-w-xl place-items-center gap-5 py-10 text-center sm:py-16">
      <div className="grid h-20 w-20 place-items-center rounded-3xl border border-[color:var(--clinical-chat-teal)]/15 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
        <MessageSquareText className="h-9 w-9" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-normal text-[color:var(--text-heading)]">How can I help?</h2>
        <p className={cn("mx-auto max-w-sm text-sm leading-6", textMuted)}>
          Ask a clinical question or search your documents.
        </p>
      </div>
      <section aria-label="Starter actions" className={cn("grid w-full gap-3 sm:grid-cols-3")}>
        <button
          type="button"
          onClick={() =>
            onPickSample("What monitoring and escalation issues should I consider across these documents?")
          }
          className={starterButtonClass}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)] sm:flex-col sm:gap-2">
            <Sparkles className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
            Ask a question
          </span>
          <span className={cn("line-clamp-2 text-xs leading-5 sm:max-w-[9rem]", textMuted)}>
            Start a source-backed clinical answer.
          </span>
        </button>
        <button type="button" onClick={onSearchDocuments} className={starterButtonClass}>
          <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)] sm:flex-col sm:gap-2">
            <Search className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
            Search documents
          </span>
          <span className={cn("line-clamp-2 text-xs leading-5 sm:max-w-[9rem]", textMuted)}>
            Browse matching files and source sections.
          </span>
        </button>
        <button type="button" onClick={onUploadDocument} className={starterButtonClass}>
          <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)] sm:flex-col sm:gap-2">
            <UploadCloud className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
            Upload document
          </span>
          <span className={cn("line-clamp-2 text-xs leading-5 sm:max-w-[9rem]", textMuted)}>
            Add a guideline, PDF, or local source.
          </span>
        </button>
      </section>
    </div>
  );
}

export function AnswerSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading answer">
      <div className="space-y-3 rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)]/45 p-4">
        <div className="h-4 w-10/12 animate-pulse rounded bg-[color:var(--surface-subtle)]" />
        <div className="h-4 w-full animate-pulse rounded bg-[color:var(--surface-subtle)]" />
        <div className="h-4 w-8/12 animate-pulse rounded bg-[color:var(--surface-subtle)]" />
        <div className={cn(sourceCard, "mt-4 flex min-h-[60px] items-center justify-between gap-3 p-3")}>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--surface-subtle)]" />
            <div className="h-4 w-48 max-w-full animate-pulse rounded bg-[color:var(--surface-subtle)]" />
          </div>
          <div className="h-[44px] w-20 animate-pulse rounded-lg bg-[color:var(--surface-subtle)]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-[44px] w-48 animate-pulse rounded-lg bg-[color:var(--surface-subtle)]" />
        <div className="h-[44px] w-40 animate-pulse rounded-lg bg-[color:var(--surface-subtle)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-lg bg-[color:var(--surface-subtle)]" />
        <div className="hidden h-28 animate-pulse rounded-lg bg-[color:var(--surface-subtle)] sm:block" />
      </div>
    </div>
  );
}
