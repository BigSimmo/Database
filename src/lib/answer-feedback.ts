export const answerFeedbackTypes = [
  "verified",
  "needs_correction",
  "source_insufficient",
  "wrong_source",
  "missing_source",
  "unsupported_answer",
  "numeric_error",
  "outdated_guidance",
  "wrong_mode",
  "missed_source",
  "unsupported_conclusion",
  "important_information_missing",
  "source_conflict",
  "outdated_source",
  "presentation_problem",
] as const;

export type AnswerFeedbackType = (typeof answerFeedbackTypes)[number];
