"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type {
  ClinicalAskModeId,
  ClinicalAskResponse,
  ClinicalAskFeedbackMetadata,
  ClinicalAskStreamEvent,
  ConfirmedCaseContext,
  ContextSuggestion,
} from "@/lib/clinical-ask/contracts";
import { handoffContext, projectConfirmedContext } from "@/lib/clinical-ask/context";

export type ClinicalAskSessionState = {
  mode: ClinicalAskModeId | null;
  draft: string;
  confirmedContext: ConfirmedCaseContext;
  suggestions: ContextSuggestion[];
  response: ClinicalAskResponse | null;
  feedback: ClinicalAskFeedbackMetadata | null;
  clarificationAnswers: Partial<Record<string, string>>;
  submitted: boolean;
  pendingHandoff: { source: ClinicalAskModeId; target: ClinicalAskModeId; context: ConfirmedCaseContext } | null;
};

export const initialClinicalAskSessionState: ClinicalAskSessionState = {
  mode: null,
  draft: "",
  confirmedContext: {},
  suggestions: [],
  response: null,
  feedback: null,
  clarificationAnswers: {},
  submitted: false,
  pendingHandoff: null,
};

type Action =
  | { type: "setDraft"; draft: string; mode?: ClinicalAskModeId }
  | { type: "setSuggestions"; suggestions: ContextSuggestion[] }
  | { type: "confirmSuggestion"; id: string }
  | { type: "rejectSuggestion"; id: string }
  | { type: "submit"; mode: ClinicalAskModeId; context: ConfirmedCaseContext }
  | { type: "receiveEvent"; event: ClinicalAskStreamEvent }
  | { type: "setClarificationAnswer"; id: string; value: string }
  | { type: "prepareHandoff"; target: ClinicalAskModeId }
  | { type: "dismissHandoff" }
  | { type: "acceptHandoff" }
  | { type: "cancel" }
  | { type: "clear" };

function reducer(state: ClinicalAskSessionState, action: Action): ClinicalAskSessionState {
  switch (action.type) {
    case "setDraft":
      return { ...state, draft: action.draft, mode: action.mode ?? state.mode };
    case "setSuggestions":
      return { ...state, suggestions: action.suggestions };
    case "confirmSuggestion": {
      const suggestions = state.suggestions.map((item) =>
        item.id === action.id ? { ...item, status: "confirmed" as const } : item,
      );
      return {
        ...state,
        suggestions,
        confirmedContext: state.mode
          ? projectConfirmedContext(state.mode, state.confirmedContext, suggestions)
          : state.confirmedContext,
      };
    }
    case "rejectSuggestion":
      return (() => {
        const rejected = state.suggestions.find((item) => item.id === action.id);
        const suggestions = state.suggestions.map((item) =>
          item.id === action.id ? { ...item, status: "rejected" as const } : item,
        );
        if (!rejected || JSON.stringify(state.confirmedContext[rejected.field]) !== JSON.stringify(rejected.value)) {
          return { ...state, suggestions };
        }
        const confirmedContext = { ...state.confirmedContext };
        delete confirmedContext[rejected.field];
        return { ...state, suggestions, confirmedContext };
      })();
    case "submit":
      return {
        ...state,
        mode: action.mode,
        confirmedContext: projectConfirmedContext(action.mode, action.context, state.suggestions),
        submitted: true,
        response: null,
        feedback: null,
      };
    case "receiveEvent": {
      if (action.event.type === "context_suggestions") return { ...state, suggestions: action.event.suggestions };
      if (action.event.type === "clarification") return { ...state, response: action.event.response, submitted: false };
      if (action.event.type === "final")
        return {
          ...state,
          response: action.event.payload.response,
          feedback: action.event.payload.feedback,
          submitted: false,
        };
      if (action.event.type === "error" && state.mode)
        return {
          ...state,
          response: {
            state: "failed",
            mode: state.mode,
            code: action.event.code,
            retryable: action.event.retryable,
            message: action.event.message,
          },
          submitted: false,
        };
      return state;
    }
    case "setClarificationAnswer":
      return {
        ...state,
        clarificationAnswers: { ...state.clarificationAnswers, [action.id]: action.value },
      };
    case "prepareHandoff":
      return state.mode
        ? {
            ...state,
            pendingHandoff: {
              source: state.mode,
              target: action.target,
              context: handoffContext(state.mode, action.target, state.confirmedContext),
            },
          }
        : state;
    case "acceptHandoff":
      return state.pendingHandoff
        ? {
            ...state,
            mode: state.pendingHandoff.target,
            confirmedContext: state.pendingHandoff.context,
            pendingHandoff: null,
            response: null,
            feedback: null,
            clarificationAnswers: {},
            submitted: false,
          }
        : state;
    case "dismissHandoff":
      return { ...state, pendingHandoff: null };
    case "cancel":
      return { ...state, submitted: false };
    case "clear":
      return initialClinicalAskSessionState;
  }
}

type SessionValue = ClinicalAskSessionState & {
  setDraft(draft: string, mode?: ClinicalAskModeId): void;
  setSuggestions(suggestions: ContextSuggestion[]): void;
  confirmSuggestion(id: string): void;
  rejectSuggestion(id: string): void;
  submit(mode: ClinicalAskModeId, context: ConfirmedCaseContext): void;
  receiveEvent(event: ClinicalAskStreamEvent): void;
  setClarificationAnswer(id: string, value: string): void;
  prepareHandoff(target: ClinicalAskModeId): void;
  acceptHandoff(): void;
  dismissHandoff(): void;
  cancel(): void;
  clear(): void;
  setAbortController(controller: AbortController | null): void;
  setRetryAudio(blob: Blob | null): void;
};
const SessionContext = createContext<SessionValue | null>(null);

export function ClinicalAskSessionProvider({
  children,
  accountId,
}: {
  children: ReactNode;
  accountId?: string | null;
}) {
  const [state, dispatch] = useReducer(reducer, initialClinicalAskSessionState);
  const abortRef = useRef<AbortController | null>(null);
  const retryAudioRef = useRef<Blob | null>(null);
  const dispose = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    retryAudioRef.current = null;
  }, []);
  const clear = useCallback(() => {
    dispose();
    dispatch({ type: "clear" });
  }, [dispose]);
  const previousAccountRef = useRef(accountId);
  useEffect(() => {
    if (previousAccountRef.current !== accountId) {
      previousAccountRef.current = accountId;
      clear();
    }
  }, [accountId, clear]);
  useEffect(() => () => dispose(), [dispose]);
  const value = useMemo<SessionValue>(
    () => ({
      ...state,
      setDraft: (draft, mode) => dispatch({ type: "setDraft", draft, mode }),
      setSuggestions: (suggestions) => dispatch({ type: "setSuggestions", suggestions }),
      confirmSuggestion: (id) => dispatch({ type: "confirmSuggestion", id }),
      rejectSuggestion: (id) => dispatch({ type: "rejectSuggestion", id }),
      submit: (mode, context) => dispatch({ type: "submit", mode, context }),
      receiveEvent: (event) => dispatch({ type: "receiveEvent", event }),
      setClarificationAnswer: (id, value) => dispatch({ type: "setClarificationAnswer", id, value }),
      prepareHandoff: (target) => dispatch({ type: "prepareHandoff", target }),
      acceptHandoff: () => dispatch({ type: "acceptHandoff" }),
      dismissHandoff: () => dispatch({ type: "dismissHandoff" }),
      cancel: () => {
        dispose();
        dispatch({ type: "cancel" });
      },
      clear,
      setAbortController: (controller) => {
        abortRef.current?.abort();
        abortRef.current = controller;
      },
      setRetryAudio: (blob) => {
        retryAudioRef.current = blob;
      },
    }),
    [clear, dispose, state],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useClinicalAskSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useClinicalAskSession must be used inside ClinicalAskSessionProvider");
  return value;
}
