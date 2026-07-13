import type { AnswerProgressEvent } from "@/lib/rag";

export type AnswerStreamEventMap = {
  progress: AnswerProgressEvent;
  final: unknown;
  error: {
    error: string;
    status?: number;
    details?: { code?: string; message?: string };
  };
};

export type AnswerStreamEventName = keyof AnswerStreamEventMap;
export type AnswerStreamEvent = {
  [Name in AnswerStreamEventName]: { event: Name; data: AnswerStreamEventMap[Name] };
}[AnswerStreamEventName];

// Deliberately excludes the legacy `token` and `revising` event names. A new
// client can be routed to an older server during a rolling deployment, so
// accepting those events would re-expose unvalidated clinical prose.
const answerStreamEventNames = new Set<AnswerStreamEventName>(["progress", "final", "error"]);

export function isAnswerStreamEventName(value: string): value is AnswerStreamEventName {
  return answerStreamEventNames.has(value as AnswerStreamEventName);
}
