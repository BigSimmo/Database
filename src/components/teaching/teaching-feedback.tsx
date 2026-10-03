"use client";

import { useId, useMemo, useState } from "react";
import { ModeNotice } from "@/components/mode-kit/notice";
import { TeachingAccountPage, TeachingDepthPage } from "@/components/teaching/teaching-depth-page";
import { perthDateKey, perthTime, shortDayLabel } from "@/components/teaching/teaching-dates";
import { useTeachingNow } from "@/components/teaching/use-teaching-now";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, textMuted } from "@/components/ui-primitives";
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

const USEFUL = ["1", "2", "3", "4", "5"] as const;

function FeedbackForm({ session, demoMode }: { session: SessionRef; demoMode: boolean }) {
  const [useful, setUseful] = useState<number | null>(null);
  const [pace, setPace] = useState<FeedbackPace | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();
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
      <div className="grid gap-0.5">
        <h2 className="text-base-minus font-medium text-[color:var(--text-heading)]">{session.title}</h2>
        <p className={cn("text-sm", textMuted)}>
          {shortDayLabel(perthDateKey(session.startsAt))} · {perthTime(session.startsAt)}
        </p>
      </div>
      {sent ? (
        <p role="status">{demoMode ? "Demo answer recorded on this page." : "Thanks. Your answer was sent."}</p>
      ) : (
        <>
          <div className="grid gap-1.5">
            <p id={`${ids}-useful`} className="text-sm font-medium text-[color:var(--text-heading)]">
              How useful was it? 1 (least) to 5 (most)
            </p>
            <SegmentedControl
              ariaLabelledBy={`${ids}-useful`}
              layout="equal"
              value={useful === null ? "" : String(useful)}
              onChange={(value) => setUseful(Number(value))}
              options={USEFUL.map((value) => ({ value, label: value, disabled: busy }))}
            />
          </div>
          <div className="grid gap-1.5">
            <p id={`${ids}-pace`} className="text-sm font-medium text-[color:var(--text-heading)]">
              Pace
            </p>
            <SegmentedControl<FeedbackPace | "">
              ariaLabelledBy={`${ids}-pace`}
              layout="equal"
              value={pace ?? ""}
              onChange={(value) => {
                if (value) setPace(value);
              }}
              options={feedbackPaces.map((value) => ({ value, label: feedbackPaceLabels[value], disabled: busy }))}
            />
          </div>
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
