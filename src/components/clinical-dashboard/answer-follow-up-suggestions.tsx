"use client";

import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";

export function AnswerFollowUpSuggestions({
  suggestions,
  onPick,
  disabled = false,
  className,
  testId = "answer-follow-up-suggestions",
}: {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  disabled?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <AnswerSuggestionChips
      suggestions={suggestions}
      onPick={onPick}
      disabled={disabled}
      label="Try next"
      testId={testId}
      layout="wrap"
      className={className}
    />
  );
}
