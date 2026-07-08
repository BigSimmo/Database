"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/components/ui-primitives";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export function AnswerSuggestionChips({
  suggestions,
  onPick,
  disabled = false,
  label,
  testId,
  layout = "wrap",
  className,
  icon: Icon,
}: {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  disabled?: boolean;
  label?: string;
  testId?: string;
  layout?: "wrap" | "scroll";
  className?: string;
  // Optional leading glyph rendered inside every chip — used to signal a chip's
  // kind (e.g. a history icon on recent-search chips) without changing the label.
  icon?: LucideIcon;
}) {
  if (!suggestions.length) return null;

  return (
    <div
      data-testid={testId}
      className={cn("answer-suggestion-row", layout === "scroll" && "answer-suggestion-row-scroll", className)}
    >
      {label ? <span className="answer-suggestion-label shrink-0">{label}</span> : null}
      <div
        className={cn(
          "answer-suggestion-chips",
          layout === "scroll" ? "answer-suggestion-chips-scroll" : "answer-suggestion-chips-wrap",
        )}
        role={label ? undefined : "group"}
        aria-label={label ? undefined : "Suggested questions"}
      >
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onPick(suggestion)}
            className={cn("answer-suggestion-chip", focusRing, disabled && "opacity-60")}
          >
            {Icon ? (
              <>
                <Icon className="answer-suggestion-chip-icon" aria-hidden="true" />
                <span className="answer-suggestion-chip-label">{suggestion}</span>
              </>
            ) : (
              suggestion
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
