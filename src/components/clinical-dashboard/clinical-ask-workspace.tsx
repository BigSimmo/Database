"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { identifierShapeWarning } from "@/lib/clinical-ask/context";
import { ClinicalAskAnswerSurface } from "./clinical-ask-answer-surface";
import { useClinicalAskSession } from "./clinical-ask-session-context";
import { clinicalAskWorkspaceVisible } from "./use-clinical-ask-shell-state";

export function ClinicalAskWorkspace({ onDraftChange }: { onDraftChange?(draft: string): void } = {}) {
  const router = useRouter();
  const session = useClinicalAskSession();
  const [contextOpen, setContextOpen] = useState(false);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);
  if (!clinicalAskWorkspaceVisible(session)) return null;
  const suggested = session.suggestions.filter((item) => item.status === "suggested");
  const hasContext = Object.keys(session.confirmedContext).length > 0 || suggested.length > 0;
  return (
    <section className="clinical-ask-workspace" aria-label="Clinical Ask workspace">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase">Clinical Ask</p>
          <h2>Review before use</h2>
        </div>
        <div className="flex gap-2">
          <button ref={contextTriggerRef} type="button" onClick={() => setContextOpen(true)}>
            Review Case Context
          </button>
          <button type="button" onClick={session.clear}>
            Clear case
          </button>
        </div>
      </div>
      <p>
        Do not enter identifiable details. Case Context stays in this tab and is cleared when you clear the case or sign
        out.
      </p>
      {identifierShapeWarning(session.draft) ? (
        <p role="alert">Remove identifiable details before using Clinical Ask or the microphone.</p>
      ) : null}
      {session.submitted ? <p role="status">Clinical Ask is gathering governed evidence…</p> : null}
      {session.response ? (
        <ClinicalAskAnswerSurface
          response={session.response}
          question={session.submittedQuestion || session.draft}
          clarificationAnswers={session.clarificationAnswers}
          onClarificationChange={session.setClarificationAnswer}
          onPrepareHandoff={session.prepareHandoff}
          onFollowUp={(value) => {
            session.setDraft(value, session.mode ?? undefined);
            onDraftChange?.(value);
          }}
          feedbackMetadata={session.feedback}
        />
      ) : null}
      <Sheet
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        title="Review Case Context"
        description="Confirm only non-identifying details that are relevant to this question."
        placement="responsive-right"
        mobilePlacement="fullscreen"
        returnFocusRef={contextTriggerRef}
      >
        {!hasContext ? <p>No Case Context has been confirmed.</p> : null}
        {suggested.map((item) => (
          <div key={item.id} className="clinical-ask-context-item">
            <p>
              <strong>{item.field}</strong>: {Array.isArray(item.value) ? item.value.join(", ") : item.value}
            </p>
            <button type="button" onClick={() => session.confirmSuggestion(item.id)}>
              Confirm
            </button>
            <button type="button" onClick={() => session.rejectSuggestion(item.id)}>
              Reject
            </button>
          </div>
        ))}
        {Object.entries(session.confirmedContext).map(([field, value]) => (
          <p key={field}>
            <strong>{field}</strong>: {Array.isArray(value) ? value.join(", ") : value}
          </p>
        ))}
      </Sheet>
      <Sheet
        open={Boolean(session.pendingHandoff)}
        onClose={session.dismissHandoff}
        title="Review Clinical Ask handoff"
        description="Review the reduced Case Context before moving to the next mode."
        placement="responsive-right"
        mobilePlacement="fullscreen"
        footer={
          <button
            type="button"
            onClick={() => {
              const target = session.pendingHandoff?.target;
              if (!target) return;
              session.acceptHandoff();
              router.push(`/?mode=${target}`);
            }}
          >
            Accept handoff
          </button>
        }
      >
        {session.pendingHandoff
          ? Object.entries(session.pendingHandoff.context).map(([field, value]) => (
              <p key={field}>
                <strong>{field}</strong>: {Array.isArray(value) ? value.join(", ") : value}
              </p>
            ))
          : null}
      </Sheet>
    </section>
  );
}
