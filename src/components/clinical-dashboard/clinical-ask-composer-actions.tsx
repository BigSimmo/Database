"use client";

import { Mic, Square } from "lucide-react";
import { useEffect } from "react";
import type { ClinicalAskModeId } from "@/lib/clinical-ask/contracts";
import { clinicalAskModeProfile } from "@/lib/clinical-ask/mode-profiles";
import { identifierShapeWarning } from "@/lib/clinical-ask/context";
import { useClinicalAskSpeech } from "./use-clinical-ask-speech";

export function ClinicalAskComposerActions({
  mode,
  draft,
  active,
  offline,
  onDraftChange,
  onAsk,
}: {
  mode: ClinicalAskModeId;
  draft: string;
  active: boolean;
  offline: boolean;
  onDraftChange(value: string): void;
  onAsk(): void;
}) {
  const speech = useClinicalAskSpeech();
  const blocked = identifierShapeWarning(draft);
  const label = clinicalAskModeProfile(mode).label;
  const recording = speech.state === "listening" || speech.state === "stopping";
  useEffect(() => {
    if (speech.state === "ready_to_review") onDraftChange(speech.transcript);
  }, [onDraftChange, speech.state, speech.transcript]);
  const reason = blocked
    ? "Remove identifiable details before using Clinical Ask or the microphone."
    : offline
      ? "Clinical Ask needs the server evidence path."
      : undefined;
  return (
    <div className="clinical-ask-action-rail" data-clinical-ask-actions="true" aria-label="Clinical Ask actions">
      <button
        type="button"
        onClick={recording ? speech.stop : speech.start}
        disabled={active || blocked || speech.state === "transcribing" || speech.state === "requesting_permission"}
        aria-label={
          recording
            ? "Stop recording"
            : speech.state === "transcribing"
              ? "Transcribing recording"
              : `Dictate question for ${label}`
        }
        title={reason}
      >
        {recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
      </button>
      <button
        type="button"
        onClick={onAsk}
        disabled={active || blocked || offline || !draft.trim()}
        aria-label={`Ask ${label}`}
        title={reason}
      >
        {active ? `Asking ${label}…` : `Ask ${label}`}
      </button>
      {reason ? <p role="status">{reason}</p> : null}
    </div>
  );
}
