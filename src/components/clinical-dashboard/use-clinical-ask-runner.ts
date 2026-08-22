"use client";

import { useCallback } from "react";
import type { ClinicalAskModeId } from "@/lib/clinical-ask/contracts";
import type { useClinicalAskSession } from "@/components/clinical-dashboard/clinical-ask-session-context";

type ClinicalAskSession = ReturnType<typeof useClinicalAskSession>;

export function useClinicalAskRunner({
  clinicalAskMode,
  clinicalAskOnline,
  clinicalAskSession,
  query,
}: {
  clinicalAskMode: ClinicalAskModeId | null;
  clinicalAskOnline: boolean;
  clinicalAskSession: ClinicalAskSession;
  query: string;
}) {
  return useCallback(() => {
    if (!clinicalAskMode || !query.trim() || !clinicalAskOnline) return;
    const controller = new AbortController();
    clinicalAskSession.setDraft(query, clinicalAskMode);
    clinicalAskSession.submit(clinicalAskMode, clinicalAskSession.confirmedContext);
    clinicalAskSession.setAbortController(controller);
    const receiveCurrentEvent = (event: Parameters<ClinicalAskSession["receiveEvent"]>[0]) => {
      if (!controller.signal.aborted) clinicalAskSession.receiveEvent(event);
    };
    void import("@/lib/clinical-ask/client-stream")
      .then(({ streamClinicalAsk }) =>
        streamClinicalAsk(
          {
            mode: clinicalAskMode,
            question: query.trim(),
            confirmedContext: clinicalAskSession.confirmedContext,
            clarificationAnswers: clinicalAskSession.clarificationAnswers,
            priorTurns: [],
            allowExternalFallback: true,
            inputTransport: "typed",
          },
          controller.signal,
          receiveCurrentEvent,
        ),
      )
      .then((payload) => {
        // When the stream fails before delivering any SSE event (e.g. 401, 429,
        // network error), streamClinicalAsk returns a failed payload but never
        // calls onEvent. Deliver a synthetic error event so the session exits
        // the submitted/pending state rather than staying stuck.
        if (!controller.signal.aborted && payload?.response.state === "failed") {
          receiveCurrentEvent({
            type: "error",
            code: payload.response.code,
            retryable: payload.response.retryable,
            message: payload.response.message,
          });
        }
      })
      .finally(() => clinicalAskSession.releaseAbortController(controller));
  }, [clinicalAskMode, clinicalAskOnline, clinicalAskSession, query]);
}
