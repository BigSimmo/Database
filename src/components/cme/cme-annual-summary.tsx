"use client";
import Link from "next/link";
import { cardSurface } from "@/components/card-recipes";
import { Button, buttonFaceClass } from "@/components/ui/button";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { formatCalendarDateLong } from "@/lib/cme/cpd-year";
import { evaluateYear } from "@/lib/cme/evaluate";
import { activeCmeYearEntries } from "@/lib/cme/export";
import { cmeCategoryLabels, type CmeEntry, type CmeRequirementSet } from "@/lib/cme/types";
/**
 * The phone's own print screen is the PDF maker: iOS offers Share and Save to
 * Files from it, Android and desktop browsers offer Save as PDF. The page title
 * becomes the suggested file name, so it is set for the duration of the print.
 */
function savePdf(year: number) {
  const previousTitle = document.title;
  document.title = `CPD annual summary ${year}`;
  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

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
      <div className="cme-print-controls mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/cme/log?year=${set.year}`} className={buttonFaceClass({ variant: "secondary" })}>
            Back to log
          </Link>
          <Button testId="cme-summary-save-pdf" onClick={() => savePdf(set.year)}>
            Save as PDF
          </Button>
          <a href={`/api/cme/export?year=${set.year}`} className={buttonFaceClass({ variant: "secondary" })}>
            Download CSV
          </a>
        </div>
        <p className={cn(textMuted, "mt-2 text-xs")}>
          Opens your device&apos;s print screen. Choose Save as PDF, or Share on a phone, to send it to your college or
          keep a copy.
        </p>
      </div>

      <header className="grid gap-1">
        <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)]">CPD annual summary — {set.year}</h1>
        {demoMode ? (
          <p className={cn(textMuted, "text-sm")}>Synthetic demonstration — not a personal CPD record.</p>
        ) : null}
        <p className="text-sm font-semibold tabular-nums">
          {active.length} active activities · {status.totalHours} / {set.totalHours} hours · Recorded costs AUD $
          {(costs / 100).toFixed(2)}
        </p>
      </header>

      <section className={cn(cardSurface, "mt-4 grid gap-2 p-4 text-sm")}>
        <p>
          Targets confirmed {formatCalendarDateLong(set.confirmedOn)}: {set.confirmedSource}
        </p>
        <p className={textMuted}>
          Archived entries are excluded. Formal peer review is a subset of reviewing hours. Source links identify
          learning material; they do not prove attendance or completion. Evidence files remain attached to individual
          entries. This summary is a personal record, not a compliance certificate.
        </p>
      </section>

      <h2 className={cn(eyebrowText, "mt-6")}>Requirements</h2>
      <ul className="mt-2 grid gap-2">
        {set.requirements.map((r, index) => (
          <li key={r.id} className={cn(cardSurface, "grid gap-0.5 px-4 py-3 text-sm")}>
            <span className="font-semibold text-[color:var(--text-heading)]">{r.label}</span>
            <span className={textMuted}>{status.statuses[index]?.summary}</span>
          </li>
        ))}
      </ul>

      <h2 className={cn(eyebrowText, "mt-6")}>Activity record</h2>
      <div className="mt-2 grid gap-2">
        {active.map((entry) => (
          <section key={entry.id} className={cn(cardSurface, "grid gap-1 p-4 text-sm")}>
            <h3 className="text-base font-semibold text-[color:var(--text-heading)]">{entry.title}</h3>
            <p className={textMuted}>{formatCalendarDateLong(entry.date)}</p>
            <p>{entry.allocations.map((a) => `${cmeCategoryLabels[a.category]}: ${a.hours} h`).join(" · ")}</p>
            <p>Formal peer review: {entry.formalPeerReviewHours ?? 0} h (within reviewing)</p>
            {entry.buckets.length ? <p>Domains: {entry.buckets.join("; ")}</p> : null}
            {entry.reflection ? <p className="whitespace-pre-wrap">{entry.reflection}</p> : null}
            <p className={textMuted}>
              Cost: {entry.costCents === null ? "Not recorded" : `AUD ${(entry.costCents / 100).toFixed(2)}`}
            </p>
            {entry.sourceUrl ? <p className="break-all">Learning source: {entry.sourceUrl}</p> : null}
            {entry.documentId ? (
              <p className={textMuted}>Private source document linked; not certified as evidence.</p>
            ) : null}
          </section>
        ))}
      </div>
      {!active.length ? (
        <p className={cn(textMuted, "mt-4 text-sm")}>No active activities recorded for this year.</p>
      ) : null}
    </main>
  );
}
