"use client";

import { Sparkles } from "lucide-react";

import { cn, subtleStatusPill } from "@/components/ui-primitives";

export function AnswerFollowUpSuggestions({
  suggestions,
  onPick,
  disabled = false,
}: {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  disabled?: boolean;
}) {
  if (!suggestions.length) return null;

  return (
    <div
      data-testid="answer-follow-up-suggestions"
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)]/70 p-2.5 sm:p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={cn(subtleStatusPill, "inline-flex min-h-6 items-center gap-1 px-2 text-[11px]")}>
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Suggested follow-ups
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onPick(suggestion)}
            className={cn(
              "max-w-full rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-left text-xs font-semibold leading-5 text-[color:var(--text)] transition",
              "hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--clinical-accent-soft)] hover:text-[color:var(--clinical-accent)]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
