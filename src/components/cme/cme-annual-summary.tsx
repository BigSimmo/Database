"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { evaluateYear } from "@/lib/cme/evaluate";
import { activeCmeYearEntries } from "@/lib/cme/export";
import { cmeCategoryLabels, type CmeEntry, type CmeRequirementSet } from "@/lib/cme/types";
export function CmeAnnualSummary({
  set,
  entries,
  demoMode = false,
}: {
  set: CmeRequirementSet;
  entries: readonly CmeEntry[];
  demoMode?: boolean;
}) {
  const active = activeCmeYearEntries(entries, set.year);
  const status = evaluateYear({ set, entries: active });
  const costs = active.reduce((sum, e) => sum + (e.costCents ?? 0), 0);
  return (
    <main
      className="cme-annual-summary mx-auto min-w-0 w-full max-w-4xl px-4 py-6 [overflow-wrap:anywhere] text-[color:var(--text)]"
      data-testid="cme-annual-summary"
    >
      <style>{`@media print {
      html:has(.cme-annual-summary), body:has(.cme-annual-summary), body:has(.cme-annual-summary) *:has(.cme-annual-summary) {
        display: block !important; position: static !important; width: auto !important; height: auto !important;
        max-height: none !important; max-width: none !important; overflow: visible !important;
        contain: none !important; transform: none !important; padding: 0 !important; margin: 0 !important;
        background: white !important;
      }
      body:has(.cme-annual-summary) *:not(.cme-annual-summary):not(.cme-annual-summary *):not(:has(.cme-annual-summary)) { display: none !important; }
      .cme-annual-summary { display: block !important; position: static !important; width: 100% !important; height: auto !important; max-width: none !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; background: white !important; }
      .cme-annual-summary, .cme-annual-summary * { color: black !important; text-shadow: none !important; box-shadow: none !important; }
      .cme-annual-summary .cme-print-controls { display: none !important; }
      .cme-annual-summary section { break-inside: avoid; }
    }`}</style>
      <div className="cme-print-controls mb-4 flex flex-wrap items-center gap-4">
        <Link
          href={`/cme/log?year=${set.year}`}
          className="inline-flex min-h-tap items-center justify-center rounded-lg border border-[color:var(--border)] px-3 text-sm font-semibold"
        >
          Back to log
        </Link>
        <Button onClick={() => window.print()}>Print annual summary</Button>
        <a
          href={`/api/cme/export?year=${set.year}`}
          className="inline-flex min-h-tap items-center justify-center rounded-lg border border-[color:var(--border)] px-3 text-sm font-semibold"
        >
          Download CSV
        </a>
      </div>
      <h1 className="text-2xl font-semibold">CPD annual summary — {set.year}</h1>
      {demoMode ? <p>Synthetic demonstration — not a personal CPD record.</p> : null}
      <p className="mt-2">
        {active.length} active activities · {status.totalHours} / {set.totalHours} hours · Recorded costs AUD $
        {(costs / 100).toFixed(2)}
      </p>
      <p className="mt-2 text-sm">
        Targets confirmed {set.confirmedOn}: {set.confirmedSource}
      </p>
      <p className="mt-2 text-sm">
        Archived entries are excluded. Formal peer review is a subset of reviewing hours. Source links identify learning
        material; they do not prove attendance or completion. Evidence files remain attached to individual entries. This
        summary is a personal record, not a compliance certificate.
      </p>
      <h2 className="mt-6 text-lg font-semibold">Requirements</h2>
      <ul className="mt-2 space-y-2">
        {set.requirements.map((r, index) => (
          <li key={r.id}>
            {r.label}: {status.statuses[index]?.summary}
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-lg font-semibold">Activity record</h2>
      {active.map((entry) => (
        <section key={entry.id} className="mt-4 border-t border-[color:var(--border)] pt-3">
          <h3 className="font-semibold">
            {entry.date} — {entry.title}
          </h3>
          <p>{entry.allocations.map((a) => `${cmeCategoryLabels[a.category]}: ${a.hours} h`).join(" · ")}</p>
          <p>Formal peer review: {entry.formalPeerReviewHours ?? 0} h (within reviewing)</p>
          {entry.buckets.length ? <p>Domains: {entry.buckets.join("; ")}</p> : null}
          {entry.reflection ? <p className="whitespace-pre-wrap">{entry.reflection}</p> : null}
          <p>Cost: {entry.costCents === null ? "Not recorded" : `AUD ${(entry.costCents / 100).toFixed(2)}`}</p>
          {entry.sourceUrl ? <p className="break-all">Learning source: {entry.sourceUrl}</p> : null}
          {entry.documentId ? <p>Private source document linked; not certified as evidence.</p> : null}
        </section>
      ))}
      {!active.length ? <p className="mt-4">No active activities recorded for this year.</p> : null}
    </main>
  );
}
