"use client";

import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";

export function AnswerFollowUpSuggestions({
  suggestions,
  onPick,
  disabled = false,
}: {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  disabled?: boolean;
}) {
  return (
    <AnswerSuggestionChips
      suggestions={suggestions}
      onPick={onPick}
      disabled={disabled}
      label="Try next"
      testId="answer-follow-up-suggestions"
      layout="wrap"
    />
  );
}
