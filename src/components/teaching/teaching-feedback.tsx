"use client";

import { useMemo, useState } from "react";
import { ModeNotice } from "@/components/mode-kit/notice";
import { TeachingAccountPage, TeachingDepthPage } from "@/components/teaching/teaching-depth-page";
import { perthDateKey } from "@/components/teaching/teaching-dates";
import { useTeachingNow } from "@/components/teaching/use-teaching-now";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";
import { Button } from "@/components/ui/button";
import { teachingErrorMessage, teachingPost } from "@/lib/teaching/client";
import { demoFeedbackOpen } from "@/lib/teaching/depth-demo";
import {
  FEEDBACK_PRIVACY_LINE,
  feedbackPaces,
  feedbackPaceLabels,
  teachingDepthUrl,
  type FeedbackPace,
  type SessionRef,
} from "@/lib/teaching/depth-model";

function FeedbackForm({ session, demoMode }: { session: SessionRef; demoMode: boolean }) {
  const [useful, setUseful] = useState<number | null>(null);
  const [pace, setPace] = useState<FeedbackPace | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3 border-b border-[color:var(--border)] py-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (useful === null || pace === null || busy) return;
        setBusy(true);
        setError(null);
        try {
          if (!demoMode)
            await teachingPost(teachingDepthUrl(session.serviceId), {
              action: "feedback.submit",
              occurrenceId: session.occurrenceId,
              useful,
              pace,
            });
          setSent(true);
        } catch (cause) {
          setError(teachingErrorMessage(cause));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-medium">{session.title}</h2>
      {sent ? (
        <p role="status">{demoMode ? "Demo answer recorded on this page." : "Thanks. Your answer was sent."}</p>
      ) : (
        <>
          <fieldset disabled={busy}>
            <legend>How useful was it? 1 (least) to 5 (most)</legend>
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="flex min-h-12 items-center gap-2">
                  <input
                    type="radio"
                    name={`useful-${session.occurrenceId}`}
                    checked={useful === value}
                    onChange={() => setUseful(value)}
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Pace</legend>
            {feedbackPaces.map((value) => (
              <label key={value} className="flex min-h-12 items-center gap-2">
                <input
                  type="radio"
                  name={`pace-${session.occurrenceId}`}
                  checked={pace === value}
                  onChange={() => setPace(value)}
                />
                {feedbackPaceLabels[value]}
              </label>
            ))}
          </fieldset>
          <Button type="submit" variant="primary" disabled={busy || useful === null || pace === null}>
            {busy ? "Sending…" : "Send feedback"}
          </Button>
          {error ? <p role="alert">{error}</p> : null}
        </>
      )}
    </form>
  );
}
function FeedbackPage({ demoMode }: { demoMode: boolean }) {
  const now = useTeachingNow();
  const resource = useTeachingResource<{ sessions: SessionRef[] }>(
    demoMode ? null : "/api/teaching/depth?view=feedback-open",
  );
  const sessions = useMemo(
    () => (demoMode && now ? demoFeedbackOpen(perthDateKey(now)) : resource.data?.sessions),
    [demoMode, now, resource.data],
  );
  return (
    <TeachingDepthPage title="Feedback" demoMode={demoMode} resource={resource} ready={!!sessions}>
      <p>{FEEDBACK_PRIVACY_LINE}. Feedback uses taps only, with no written comments.</p>
      {sessions?.length === 0 ? (
        <ModeNotice>
          No sessions awaiting feedback. Feedback is available for seven days after a session you checked in to.
        </ModeNotice>
      ) : null}
      {sessions?.map((session) => (
        <FeedbackForm key={session.occurrenceId} session={session} demoMode={demoMode} />
      ))}
    </TeachingDepthPage>
  );
}
export function TeachingFeedback(props: { demoMode: boolean }) {
  return <TeachingAccountPage component={FeedbackPage} {...props} />;
}
