import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { appModeHomeHref } from "@/lib/app-modes";

import {
  differentialDiagnosesCards,
  differentialPresentationsCards,
  type DifferentialStreamCard,
  type DifferentialStreamType,
} from "@/lib/differentials";

type DifferentialStreamPageProps = {
  query?: string;
  stream: DifferentialStreamType;
};

const streamCopy: Record<
  DifferentialStreamType,
  {
    heading: string;
    description: string;
    intro: string;
    cards: DifferentialStreamCard[];
  }
> = {
  presentations: {
    heading: "Differentials: Presentations",
    description: "Search and refine by presenting pattern before locking differential pathways.",
    intro: "Use this stream for symptom-first intake, acute presentations, and rapid sorting.",
    cards: differentialPresentationsCards,
  },
  diagnoses: {
    heading: "Differentials: Diagnoses",
    description: "Compare likely causes side-by-side and check exclusion clues.",
    intro: "Use this stream for differential ranking, safety ordering, and comparison notes.",
    cards: differentialDiagnosesCards,
  },
};

export function DifferentialStreamPage({ stream, query = "" }: DifferentialStreamPageProps) {
  const copy = streamCopy[stream];
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[color:var(--background)] px-4 py-10 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
            {copy.heading}
          </p>
          <h1 className="mt-1 text-4xl font-bold leading-tight text-[color:var(--text-heading)] sm:text-5xl">
            {copy.description}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">{copy.intro}</p>
          {query ? <p className="mt-2 text-sm font-bold text-[color:var(--clinical-accent)]">Query: {query}</p> : null}
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[color:var(--text-heading)]">Clinical entries</h2>
            <span className="text-sm text-[color:var(--text-muted)]">Diagnosis-focused differential content</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {copy.cards.map((card) => (
              <Link
                key={card.id}
                href={card.href}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]"
              >
                <h3 className="text-sm font-bold text-[color:var(--text-heading)]">{card.title}</h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{card.description}</p>
                <ul className="mt-2 flex flex-col gap-1 text-xs leading-6 text-[color:var(--text-soft)]">
                  {card.examples.map((example) => (
                    <li key={example} className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
                      {example}
                    </li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:grid-cols-[1fr_auto] sm:grid">
          <div className="grid gap-2">
            <h2 className="text-sm font-bold text-[color:var(--text-heading)]">Keep exploring</h2>
            <p className="text-sm leading-6 text-[color:var(--text-muted)]">
              Return to the differentials home to start from a different presentation, or open search to look up another
              differential.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/differentials"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to differential home
            </Link>
            <Link
              href={appModeHomeHref("differentials", { focus: true })}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)] hover:opacity-90"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
              Open differential search
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
