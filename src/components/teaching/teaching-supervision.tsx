"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ModeNotice } from "@/components/mode-kit/notice";
import { TeachingAccountPage, TeachingDepthPage } from "@/components/teaching/teaching-depth-page";
import { perthDateKey } from "@/components/teaching/teaching-dates";
import { useTeachingNow } from "@/components/teaching/use-teaching-now";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";
import { Button } from "@/components/ui/button";
import { teachingErrorMessage, teachingPost } from "@/lib/teaching/client";
import { demoSupervision } from "@/lib/teaching/depth-demo";
import { correctionReasons, correctionReasonLabels, SUPERVISION_UNDO_MS, supervisionTopics, supervisionTopicLabels, teachingDepthActionSchema, teachingDepthUrl, type CorrectionReason, type SupervisionPairingView, type SupervisionTopic, type TeachingDepthInput } from "@/lib/teaching/depth-model";

const field = "min-h-12 rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3";

function Pairing({ pairing, demoMode, today, refresh, locked, setLocked }: { pairing: SupervisionPairingView; demoMode: boolean; today: string; refresh: () => void; locked: boolean; setLocked: (value: boolean) => void }) {
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState("60");
  const [type, setType] = useState<"individual" | "group">("individual");
  const [topics, setTopics] = useState<SupervisionTopic[]>([]);
  const [target, setTarget] = useState(pairing.targetHours === null ? "" : String(pairing.targetHours));
  const [reason, setReason] = useState<CorrectionReason>("entered_in_error");
  const [correctionId, setCorrectionId] = useState("");
  const [correctedDate, setCorrectedDate] = useState(today);
  const [correctedMinutes, setCorrectedMinutes] = useState("60");
  const [correctedType, setCorrectedType] = useState<"individual" | "group">("individual");
  const [correctedTopics, setCorrectedTopics] = useState<SupervisionTopic[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const held = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (held.current) clearTimeout(held.current); }; }, []);
  const editable = !pairing.readOnlyUntil;

  async function send(input: TeachingDepthInput) {
    held.current = null; setPending(null); setBusy(true);
    try {
      if (!demoMode) await teachingPost(teachingDepthUrl(pairing.serviceId), input);
      if (mounted.current) { setMessage(demoMode ? "Demo only — no record was sent." : "Saved."); if (!demoMode) refresh(); }
    } catch (cause) { if (mounted.current) setMessage(teachingErrorMessage(cause)); }
    finally { if (mounted.current) setBusy(false); setLocked(false); }
  }
  function save(input: TeachingDepthInput, delayed = false) {
    if (locked || busy || held.current || !editable) return;
    const parsed = teachingDepthActionSchema.safeParse(input);
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? "Check the form."); return; }
    setMessage(null);
    setLocked(true);
    if (delayed) {
      setPending("Waiting 10 seconds before sending. Leaving this page cancels the unsent change.");
      held.current = setTimeout(() => void send(parsed.data), SUPERVISION_UNDO_MS);
    } else void send(parsed.data);
  }
  const inert = locked || busy || pending !== null;
  return <section className="grid gap-3 rounded-lg border border-[color:var(--border)] p-3">
    <h2 className="text-lg font-medium">{pairing.registrarName} · {pairing.supervisorName}</h2>
    <p>{pairing.serviceName} · {pairing.startsOn} to {pairing.endsOn}</p>
    <p>Confirmed: {pairing.confirmedMinutes / 60} hours · Pending: {pairing.pendingMinutes / 60} hours</p>
    {!editable ? <ModeNotice>Read-only records from a service you left. Available until {pairing.readOnlyUntil?.slice(0,10)}.</ModeNotice> : null}
    {pairing.access === "organiser" ? <ModeNotice>Organisers see totals and status only. Supervision topics and personal targets are private.</ModeNotice> : null}
    {pairing.access === "registrar" && editable ? <>
      <form className="grid gap-2" onSubmit={event => { event.preventDefault(); save({ action: "supervision.log", pairingId: pairing.pairingId, date, minutes: Number(minutes), type, topics }, true); }}>
        <h3 className="font-medium">Log supervision</h3>
        <label className="grid gap-1">Date<input className={field} type="date" value={date} min={pairing.startsOn} max={today < pairing.endsOn ? today : pairing.endsOn} required disabled={inert} onChange={event => setDate(event.target.value)} /></label>
        <label className="grid gap-1">Minutes<input className={field} type="number" value={minutes} min="15" max="240" step="15" required disabled={inert} onChange={event => setMinutes(event.target.value)} /></label>
        <label className="grid gap-1">Type<select className={field} value={type} disabled={inert} onChange={event => setType(event.target.value as typeof type)}><option value="individual">Individual</option><option value="group">Group</option></select></label>
        <fieldset disabled={inert}><legend>Topics (optional, up to five; no patient details)</legend><div className="grid sm:grid-cols-2">{supervisionTopics.map(topic => <label key={topic} className="flex min-h-12 items-center gap-2"><input type="checkbox" checked={topics.includes(topic)} onChange={event => setTopics(previous => event.target.checked ? previous.length < 5 ? [...previous, topic] : previous : previous.filter(value => value !== topic))} />{supervisionTopicLabels[topic]}</label>)}</div></fieldset>
        <Button type="submit" variant="primary" disabled={inert}>Send for supervisor confirmation</Button>
      </form>
      <form className="grid gap-2" onSubmit={event => { event.preventDefault(); save({ action: "supervision.target.set", pairingId: pairing.pairingId, targetHours: target === "" ? null : Number(target) }); }}>
        <label className="grid gap-1">Your personal target (hours, optional)<input className={field} type="number" min="1" max="500" step="0.1" value={target} disabled={inert} onChange={event => setTarget(event.target.value)} /></label>
        <Button type="submit" variant="secondary" disabled={inert}>Save my target</Button>
      </form>
    </> : null}
    {pairing.entries?.map(entry => <div key={entry.entryId} className="grid gap-2 border-t border-[color:var(--border)] pt-3">
      <p>{entry.date} · {entry.minutes} minutes · {entry.type} · {entry.status}</p>
      <p className="text-sm">{entry.topics.map(topic => supervisionTopicLabels[topic]).join(", ")}</p>
      {entry.confirmedByName ? <p>Confirmed by {entry.confirmedByName}</p> : null}
      {pairing.access === "supervisor" && editable && entry.status === "pending" ? <Button type="button" variant="secondary" disabled={inert} onClick={() => save({ action: "supervision.confirm", entryIds: [entry.entryId] }, true)}>Confirm {entry.date}</Button> : null}
      {entry.notes.map(note => <div key={note.noteId}><p>{correctionReasonLabels[note.reason]} · {note.confirmedAt ? "Correction confirmed" : "Correction awaiting confirmation"}</p><p>Proposed correction: {note.reason === "entered_in_error" ? "Mark this entry as entered in error." : Object.entries(note.correctedValue).map(([key, value]) => `${key === "minutes" ? "Minutes" : key === "date" ? "Date" : key === "type" ? "Type" : "Topics"}: ${Array.isArray(value) ? value.map(topic => supervisionTopicLabels[topic as SupervisionTopic] ?? topic).join(", ") : String(value)}`).join(" · ")}</p>{pairing.access === "supervisor" && editable && !note.confirmedAt ? <Button type="button" variant="secondary" disabled={inert} onClick={() => save({ action: "supervision.note.confirm", noteId: note.noteId }, true)}>Confirm correction</Button> : null}</div>)}
      {pairing.access === "registrar" && editable ? <Button type="button" variant="secondary" disabled={inert} onClick={() => { setCorrectionId(entry.entryId); setCorrectedDate(entry.date); setCorrectedMinutes(String(entry.minutes)); setCorrectedType(entry.type); setCorrectedTopics(entry.topics); }}>Correct {entry.date}</Button> : null}
    </div>)}
    {correctionId ? <form className="grid gap-2" onSubmit={event => {
      event.preventDefault();
      const values = reason === "wrong_date" ? { date: correctedDate } : reason === "wrong_length" ? { minutes: Number(correctedMinutes) } : reason === "wrong_type" ? { type: correctedType } : reason === "wrong_topics" ? { topics: correctedTopics } : {};
      save({ action: "supervision.note", entryId: correctionId, reason, correctedValue: values }, true);
    }}><label className="grid gap-1">Correction reason<select className={field} value={reason} disabled={inert} onChange={event => setReason(event.target.value as CorrectionReason)}>{correctionReasons.map(value => <option key={value} value={value}>{correctionReasonLabels[value]}</option>)}</select></label>
    {reason === "wrong_date" ? <label className="grid gap-1">Corrected date<input className={field} type="date" required min={pairing.startsOn} max={today < pairing.endsOn ? today : pairing.endsOn} value={correctedDate} disabled={inert} onChange={event => setCorrectedDate(event.target.value)} /></label> : null}
    {reason === "wrong_length" ? <label className="grid gap-1">Corrected minutes<input className={field} type="number" required min="15" max="240" step="15" value={correctedMinutes} disabled={inert} onChange={event => setCorrectedMinutes(event.target.value)} /></label> : null}
    {reason === "wrong_type" ? <label className="grid gap-1">Corrected type<select className={field} value={correctedType} disabled={inert} onChange={event => setCorrectedType(event.target.value as typeof correctedType)}><option value="individual">Individual</option><option value="group">Group</option></select></label> : null}
    {reason === "wrong_topics" ? <fieldset disabled={inert}><legend>Corrected topics (up to five)</legend>{supervisionTopics.map(topic => <label key={topic} className="flex min-h-12 items-center gap-2"><input type="checkbox" checked={correctedTopics.includes(topic)} onChange={event => setCorrectedTopics(previous => event.target.checked ? previous.length < 5 ? [...previous, topic] : previous : previous.filter(value => value !== topic))} />{supervisionTopicLabels[topic]}</label>)}</fieldset> : null}
    <p>The original record is retained.</p><Button type="submit" variant="secondary" disabled={inert}>Send correction for confirmation</Button><Button type="button" variant="secondary" disabled={inert} onClick={() => setCorrectionId("")}>Cancel correction</Button></form> : null}
    {pending ? <div role="status"><p>{pending}</p><Button type="button" variant="secondary" onClick={() => { if (held.current) clearTimeout(held.current); held.current = null; setPending(null); setLocked(false); setMessage("Cancelled before sending."); }}>Undo</Button></div> : null}
    {busy ? <p role="status">Sending…</p> : null}{message ? <p role="status">{message}</p> : null}
  </section>;
}
function SupervisionPage({ demoMode }: { demoMode: boolean }) {
  const [locked, setLocked] = useState(false);
  const now = useTeachingNow();
  const today = now ? perthDateKey(now) : null;
  const resource = useTeachingResource<{ pairings: SupervisionPairingView[] }>(demoMode ? null : "/api/teaching/depth?view=supervision");
  const pairings = useMemo(() => demoMode && today ? demoSupervision(today) : resource.data?.pairings, [demoMode, today, resource.data]);
  return <TeachingDepthPage title="Supervision" demoMode={demoMode} resource={resource} ready={!!pairings && !!today}>
    <p>Log teaching topics only, never patient details. Confirmation records the supervisor&apos;s acknowledgement; it does not award CPD credit.</p>
    {pairings?.length === 0 ? <ModeNotice>No supervision pairing yet. Ask your service organiser to set up a registrar and supervisor pairing.</ModeNotice> : null}
    {locked ? <p role="status">Finish or undo the current change before starting another.</p> : null}
    {today ? pairings?.map(pairing => <Pairing key={pairing.pairingId} pairing={pairing} today={today} demoMode={demoMode} refresh={resource.retry} locked={locked} setLocked={setLocked} />) : null}
  </TeachingDepthPage>;
}
export function TeachingSupervision(props: { demoMode: boolean }) { return <TeachingAccountPage component={SupervisionPage} {...props} />; }
