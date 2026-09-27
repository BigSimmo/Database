"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ModeNotice } from "@/components/mode-kit/notice";
import { TeachingAccountPage, TeachingDepthPage } from "@/components/teaching/teaching-depth-page";
import { perthDateKey } from "@/components/teaching/teaching-dates";
import { useTeachingNow } from "@/components/teaching/use-teaching-now";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";
import { Button } from "@/components/ui/button";
import { teachingErrorMessage, teachingPost } from "@/lib/teaching/client";
import { demoCpdReview } from "@/lib/teaching/depth-demo";
import { CPD_REVIEW_MAX_ROWS, cpdReviewBodySchema, type CpdReviewRow, type CpdReviewResult } from "@/lib/teaching/depth-model";

function ReviewPage({ demoMode }: { demoMode: boolean }) {
  const now = useTeachingNow();
  const resource = useTeachingResource<{ rows: CpdReviewRow[] }>(demoMode ? null : "/api/teaching/depth?view=cpd-review");
  const rows = useMemo(() => demoMode && now ? demoCpdReview(now) : resource.data?.rows, [demoMode, now, resource.data]);
  const [chosen, setChosen] = useState<Record<string, { hours: string; requestId: string }>>({});
  const [results, setResults] = useState<CpdReviewResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logged = new Set(results.filter(row => row.entryId !== null).map(row => row.occurrenceId));
  const selected = Object.entries(chosen).filter(([id]) => !logged.has(id));
  const parsed = cpdReviewBodySchema.safeParse({ rows: selected.map(([occurrenceId, value]) => ({ occurrenceId, hours: Number(value.hours), requestId: value.requestId })) });
  return <TeachingDepthPage title="Weekly CPD review" demoMode={demoMode} resource={resource} ready={!!rows}>
    <ModeNotice>Choose the sessions and hours you want to log. Attendance does not award CPD credit. These entries are private to you; your service cannot see your CPD figures.</ModeNotice>
    {rows?.length === 0 ? <p>No attended sessions waiting to be logged.</p> : null}
    <form className="grid gap-3" onSubmit={async event => {
      event.preventDefault(); if (!parsed.success || busy) return;
      setError(null);
      if (demoMode) { setError("The demo does not save anything to CPD."); return; }
      setBusy(true);
      try {
        const result = await teachingPost<{ results: CpdReviewResult[] }>("/api/teaching/cpd/review", parsed.data);
        setResults(previous => [...previous.filter(row => !result.results.some(next => next.occurrenceId === row.occurrenceId)), ...result.results]);
      } catch (cause) {
        // A request can fail after earlier rows saved. Retain request ids and choices for safe retry.
        setError(`${teachingErrorMessage(cause).replace("Nothing changed. ", "")} Some entries may have saved. Retry with the same choices; this will not add duplicates.`);
      } finally { setBusy(false); }
    }}>
      {rows?.map(row => <div key={row.occurrenceId} className="grid gap-2 border-b border-[color:var(--border)] py-3">
        <label className="flex min-h-12 items-center gap-3"><input type="checkbox" disabled={busy || logged.has(row.occurrenceId)} checked={!!chosen[row.occurrenceId]} onChange={event => {
          const checked = event.target.checked;
          setChosen(previous => { const next = { ...previous }; if (checked) next[row.occurrenceId] = { hours: String(row.hours), requestId: crypto.randomUUID() }; else delete next[row.occurrenceId]; return next; });
        }} /><span>{row.title}<span className="block text-sm">{row.serviceName} · {perthDateKey(new Date(row.startsAt))}</span></span></label>
        {chosen[row.occurrenceId] && !logged.has(row.occurrenceId) ? <label className="grid gap-1">Hours for {row.title}<input type="number" min="0.25" max="8" step="0.25" required disabled={busy} value={chosen[row.occurrenceId].hours} onChange={event => { const hours = event.target.value; setChosen(previous => ({ ...previous, [row.occurrenceId]: { ...previous[row.occurrenceId], hours } })); }} className="min-h-12 rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3" /></label> : null}
        {results.filter(result => result.occurrenceId === row.occurrenceId).map(result => <p key={result.occurrenceId} role="status">{result.entryId ? "Saved to your private CPD log." : result.message ?? "Not saved. Try again."}</p>)}
      </div>)}
      {selected.length > CPD_REVIEW_MAX_ROWS ? <p role="alert">Choose up to {CPD_REVIEW_MAX_ROWS} sessions at a time.</p> : null}
      {rows?.length ? <Button type="submit" variant="primary" disabled={busy || !parsed.success}>{busy ? "Saving…" : "Log selected sessions to my CPD"}</Button> : null}
      {error ? <p role="alert">{error}</p> : null}
    </form>
    <Link href="/cme/log" className="inline-flex min-h-12 items-center underline">Open my private CPD log</Link>
  </TeachingDepthPage>;
}
export function TeachingCpdReview(props: { demoMode: boolean }) { return <TeachingAccountPage component={ReviewPage} {...props} />; }
