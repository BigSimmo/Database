"use client";

import { Clipboard, ClipboardCheck, Search, Sparkles } from "lucide-react";

import { cn, EmptyState, floatingControl, LoadingPanel, sourceCard, textMuted } from "@/components/ui-primitives";

const sampleQueries = [
  {
    label: "Monitoring overview",
    query: "What monitoring and escalation issues should I consider across these documents?",
  },
  {
    label: "Lithium safety-net",
    query: "What toxicity safety-net symptoms should be reviewed for lithium?",
  },
  {
    label: "Clozapine table",
    query: "What clozapine monitoring items are shown in the table image?",
  },
  {
    label: "Risk escalation",
    query: "When should acute risk be escalated for senior review?",
  },
] as const;

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
  recentQueries = [],
  documentsLoading = false,
}: {
  onPickSample: (sample: string) => void;
  recentQueries?: string[];
  documentsLoading?: boolean;
}) {
  return (
    <div className="space-y-3">
      <EmptyState
        icon={Search}
        title="Ask indexed guidelines"
        body="Results, source quotes, and diagrams will appear here."
      />
      {documentsLoading ? (
        <LoadingPanel label="Checking indexed library before showing document status" variant="skeleton" lines={2} />
      ) : null}
      {recentQueries.length > 0 ? (
        <section
          aria-label="Recent questions"
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
        >
          <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              Recent questions
            </p>
            <span className={cn("text-[11px] font-semibold", textMuted)}>Resume</span>
          </div>
          <div className="grid gap-2">
            {recentQueries.map((recent) => (
              <button
                key={recent}
                type="button"
                onClick={() => onPickSample(recent)}
                title={recent}
                className={cn(
                  floatingControl,
                  "min-h-10 justify-start px-3 text-left text-xs font-semibold sm:text-sm",
                )}
              >
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 truncate">{recent}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section
        aria-label="Example questions"
        className={cn(
          "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 shadow-[var(--shadow-inset)]",
        )}
      >
        <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            Starter actions
          </p>
          <span className={cn("text-[11px] font-semibold", textMuted)}>Set question</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {sampleQueries.map((sample) => (
            <button
              key={sample.query}
              type="button"
              onClick={() => onPickSample(sample.query)}
              title={sample.query}
              aria-label={`Use sample question: ${sample.query}`}
              className={cn(
                floatingControl,
                "min-h-10 justify-start px-3 text-left text-xs motion-safe:transition-colors motion-safe:duration-150",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="min-w-0 truncate">{sample.label}</span>
            </button>
          ))}
        </div>
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
