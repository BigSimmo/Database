export const answerFeedbackTypes = [
  "verified",
  "needs_correction",
  "source_insufficient",
  "wrong_source",
  "missing_source",
  "unsupported_answer",
  "numeric_error",
  "outdated_guidance",
] as const;

export type AnswerFeedbackType = (typeof answerFeedbackTypes)[number];
