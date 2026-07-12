export type AnswerLifecycleStatus =
  "idle" | "loading" | "streaming" | "revising" | "completed" | "cancelled" | "failed";
export type AnswerLifecycle = { status: AnswerLifecycleStatus; query: string | null };
export type AnswerLifecycleEvent =
  | { type: "start"; query: string }
  | { type: "stream" }
  | { type: "revise" }
  | { type: "complete" }
  | { type: "cancel" }
  | { type: "fail" }
  | { type: "reset" };
export const initialAnswerLifecycle: AnswerLifecycle = { status: "idle", query: null };
export function answerLifecycleReducer(state: AnswerLifecycle, event: AnswerLifecycleEvent): AnswerLifecycle {
  switch (event.type) {
    case "start":
      return { status: "loading", query: event.query };
    case "stream":
      return { ...state, status: "streaming" };
    case "revise":
      return { ...state, status: "revising" };
    case "complete":
      return { ...state, status: "completed" };
    case "cancel":
      return { ...state, status: "cancelled" };
    case "fail":
      return { ...state, status: "failed" };
    case "reset":
      return initialAnswerLifecycle;
  }
}
