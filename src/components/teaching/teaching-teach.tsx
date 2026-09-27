"use client";

import { useMemo, useState } from "react";
import { ModeNotice } from "@/components/mode-kit/notice";
import { TeachingAccountPage, TeachingDepthPage } from "@/components/teaching/teaching-depth-page";
import { perthDateKey, perthTime } from "@/components/teaching/teaching-dates";
import { useTeachingNow } from "@/components/teaching/use-teaching-now";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";
import { Button } from "@/components/ui/button";
import { teachingErrorMessage, teachingPost } from "@/lib/teaching/client";
import { demoFeedbackTotals, demoTeach } from "@/lib/teaching/depth-demo";
import { readinessItems, readinessLabels, teachingDepthUrl, type FeedbackTotals, type Readiness, type SessionRef, type TeachRead, type TeachSession } from "@/lib/teaching/depth-model";

function FeedbackSummary({ session, demoMode }: { session: SessionRef; demoMode: boolean }) {
  const [open, setOpen] = useState(false);
  const resource = useTeachingResource<FeedbackTotals>(open && !demoMode ? teachingDepthUrl(session.serviceId, { action: "feedback.totals", occurrenceId: session.occurrenceId }) : null);
  const totals = demoMode ? demoFeedbackTotals() : resource.data;
  return <section className="grid gap-2 border-b border-[color:var(--border)] py-3">
    <h3 className="font-medium">{session.title}</h3>
    <p className="text-sm">{perthDateKey(new Date(session.startsAt))} · {perthTime(session.startsAt)} Perth</p>
    <Button type="button" variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide feedback" : "View feedback"}</Button>
    {open ? <div aria-live="polite">
      {!demoMode && ["error", "offline", "setup", "signed-out"].includes(resource.status) ? <><ModeNotice>Feedback could not load.</ModeNotice><Button type="button" variant="secondary" onClick={resource.retry}>Try again</Button></> : !totals ? <p>Loading feedback…</p> : !totals.released ? <ModeNotice>Feedback is not released yet. Individual answers and names are never shown here.</ModeNotice> : <>
        <p>{totals.replies} anonymous replies</p>
        <p>Usefulness (1–5): {Object.entries(totals.useful).map(([rating, count]) => `${rating}: ${count}`).join(" · ")}</p>
        <p>Pace: too slow {totals.pace.slow} · about right {totals.pace.right} · too fast {totals.pace.fast}</p>
      </>}
    </div> : null}
  </section>;
}

function Preparation({ session, demoMode, onSaved }: { session: TeachSession; demoMode: boolean; onSaved: () => void }) {
  const [local, setLocal] = useState<Readiness>({ items: session.items, deidConfirmedAt: session.deidConfirmedAt });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(body: Record<string, unknown>, next: Readiness) {
    setBusy(true); setError(null);
    try {
      const saved = demoMode ? next : await teachingPost<Readiness>(teachingDepthUrl(session.serviceId), { ...body, occurrenceId: session.occurrenceId });
      setLocal(saved); onSaved();
    } catch (cause) { setError(teachingErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-2 rounded-lg border border-[color:var(--border)] p-3">
    <h2 className="text-lg font-medium">{session.title}</h2>
    <p>{perthDateKey(new Date(session.startsAt))} · {perthTime(session.startsAt)} Perth · {session.venue ?? "Room not set"}</p>
    {session.status === "cancelled" ? <ModeNotice>This session is cancelled.</ModeNotice> : <>
      <p className="text-sm">Prepare your aims and reading list outside PsychSift. Do not upload slides, patient details or Teams passcodes.</p>
      <fieldset disabled={busy} className="grid gap-1">
        <legend className="font-medium">Readiness</legend>
        {readinessItems.map(item => <label key={item} className="flex min-h-12 items-center gap-3">
          <input type="checkbox" checked={local.items.includes(item)} onChange={event => {
            const done = event.target.checked;
            void save({ action: "readiness.set", item, done }, { ...local, items: done ? [...local.items, item] : local.items.filter(value => value !== item) });
          }} />{readinessLabels[item]}
        </label>)}
      </fieldset>
      {local.deidConfirmedAt ? <p>De-identification confirmed.</p> : <Button type="button" disabled={busy} variant="primary" onClick={() => void save({ action: "readiness.deid.confirm" }, { ...local, deidConfirmedAt: new Date().toISOString() })}>I have checked that my material is de-identified</Button>}
      {busy ? <p role="status">Saving…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </>}
  </section>;
}

function TeachPage({ demoMode }: { demoMode: boolean }) {
  const now = useTeachingNow();
  const resource = useTeachingResource<TeachRead>(demoMode ? null : "/api/teaching/depth?view=teach");
  const data = useMemo(() => demoMode && now ? demoTeach(perthDateKey(now)) : resource.data, [demoMode, now, resource.data]);
  return <TeachingDepthPage title="Teach" demoMode={demoMode} resource={resource} ready={!!data}>
    {data?.upcoming.length === 0 ? <ModeNotice>No sessions assigned to you. Ask your organiser to name you as presenter.</ModeNotice> : null}
    {data?.upcoming.map(session => <Preparation key={session.occurrenceId} session={session} demoMode={demoMode} onSaved={demoMode ? () => {} : resource.retry} />)}
    <h2 className="text-lg font-medium">Taught before</h2>
    {data?.taught.length === 0 ? <p>No previous sessions.</p> : null}
    {data?.taught.map(session => <FeedbackSummary key={session.occurrenceId} session={session} demoMode={demoMode} />)}
  </TeachingDepthPage>;
}
export function TeachingTeach(props: { demoMode: boolean }) { return <TeachingAccountPage component={TeachPage} {...props} />; }
