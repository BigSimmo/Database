import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  CircleHelp,
  GitCompareArrows,
  ListChecks,
  MessageSquareQuote,
  Network,
  Route,
  ShieldAlert,
  Sparkles,
  Target,
  Waypoints,
} from "lucide-react";

import {
  FormulationBreadcrumbs,
  FormulationPageShell,
  FormulationSafetyNote,
  FormulationSubnav,
  MechanismBadge,
  MechanismDomainChips,
  SectionHeading,
  formulationCard,
} from "@/components/formulation/formulation-ui";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { formulationSourceLibrary, relatedFormulationMechanisms, type FormulationMechanism } from "@/lib/formulation";

function comparisonHref(left: string, right?: string) {
  const params = new URLSearchParams({ a: left });
  if (right) params.set("b", right);
  return `/formulation/compare?${params.toString()}`;
}

function RecordFact({ icon: Icon, label, body }: { icon: typeof Network; label: string; body: string }) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 px-4 py-3.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span>
        <span className="block text-xs font-bold text-[color:var(--text-heading)]">{label}</span>
        <span className="mt-0.5 block text-xs font-medium leading-5 text-[color:var(--text-muted)]">{body}</span>
      </span>
    </div>
  );
}

function GuidanceSection({
  icon: Icon,
  title,
  items,
  tone = "default",
  open = false,
}: {
  icon: typeof Network;
  title: string;
  items: string[];
  tone?: "default" | "success" | "warning";
  open?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-[color:var(--success)] bg-[color:var(--success-soft)]"
      : tone === "warning"
        ? "text-[color:var(--warning)] bg-[color:var(--warning-soft)]"
        : "text-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]";

  return (
    <details open={open} className="group border-b border-[color:var(--border)] last:border-b-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", toneClass)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-sm font-extrabold text-[color:var(--text-heading)]">{title}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="px-4 pb-4 pl-[4.25rem] sm:px-5 sm:pb-5 sm:pl-[4.75rem]">
        <ul className="grid gap-2.5 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          {items.map((item) => (
            <li key={item} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--clinical-accent)]" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function FactorColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="p-4 sm:p-5">
      <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">{title}</h3>
      <ul className="mt-3 grid gap-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--clinical-accent)]" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormulationMechanismPage({ mechanism }: { mechanism: FormulationMechanism }) {
  const related = relatedFormulationMechanisms(mechanism);
  const primaryRelated = related[0];
  const sources = mechanism.sources
    .map((sourceId) => formulationSourceLibrary[sourceId])
    .filter((source): source is NonNullable<typeof source> => Boolean(source));

  return (
    <FormulationPageShell>
      <div className="grid gap-3">
        <FormulationBreadcrumbs current={mechanism.name} />
        <FormulationSubnav active="search" />
      </div>

      <section className="grid gap-5 border-b border-[color:var(--border)] pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="grid gap-4 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-start">
          <span className="grid h-14 w-14 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16">
            <Network className="h-7 w-7" aria-hidden />
          </span>
          <div className="grid gap-2">
            <div>
              <p className={eyebrowText}>Formulation mechanism</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
                {mechanism.name}
              </h1>
            </div>
            <p className="max-w-3xl text-base font-medium leading-7 text-[color:var(--text-muted)]">
              {mechanism.definition}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <MechanismBadge />
              <MechanismDomainChips values={mechanism.domains} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link
            href={comparisonHref(mechanism.id, primaryRelated?.id)}
            className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <GitCompareArrows className="h-4 w-4" aria-hidden />
            Compare
          </Link>
          <Link
            href={`/formulation/builder?mechanism=${mechanism.id}`}
            className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <ListChecks className="h-4 w-4" aria-hidden />
            Use in formulation
          </Link>
        </div>
      </section>

      <section aria-labelledby="what-matters-now" className={cn(formulationCard, "overflow-hidden")}>
        <div className="border-b border-[color:var(--border)] px-4 py-2.5 sm:px-5">
          <p id="what-matters-now" className={eyebrowText}>
            What matters now
          </p>
        </div>
        <div className="grid divide-y divide-[color:var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <RecordFact icon={Network} label="Core process" body={mechanism.coreProcess} />
          <RecordFact icon={Waypoints} label="Maintaining cycle" body={mechanism.maintainingCycles[0]} />
          <RecordFact icon={MessageSquareQuote} label="Patient language" body={`“${mechanism.patientPhrases[0]}”`} />
          <RecordFact icon={Target} label="Treatment leverage" body={mechanism.treatmentLeverage} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid min-w-0 gap-5">
          <SectionHeading
            eyebrow="Fit, function, and alternatives"
            title="Test the mechanism against the case"
            body="Use sequence, function, patient language, and disconfirming evidence to decide whether this hypothesis adds explanatory value."
          />

          <section className={cn(formulationCard, "overflow-hidden")}>
            <GuidanceSection icon={Check} title="When this fits" items={mechanism.fitIndicators} tone="success" open />
            <GuidanceSection
              icon={ShieldAlert}
              title="When this may not fit"
              items={mechanism.poorFitIndicators}
              tone="warning"
            />
            <GuidanceSection icon={CircleHelp} title="Clinical clues" items={mechanism.clinicalClues} />
            <GuidanceSection
              icon={MessageSquareQuote}
              title="Patient language"
              items={mechanism.patientPhrases.map((item) => `“${item}”`)}
            />
          </section>

          <section className={cn(formulationCard, "overflow-hidden")}>
            <div className="border-b border-[color:var(--border)] px-4 py-3 sm:px-5">
              <p className={eyebrowText}>Across the formulation</p>
              <h2 className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">
                Predisposing, precipitating, and perpetuating factors
              </h2>
            </div>
            <div className="grid divide-y divide-[color:var(--border)] md:grid-cols-3 md:divide-x md:divide-y-0">
              <FactorColumn title="Predisposing" items={mechanism.predisposing} />
              <FactorColumn title="Precipitating" items={mechanism.precipitating} />
              <FactorColumn title="Perpetuating" items={mechanism.perpetuating} />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className={cn(formulationCard, "grid content-start gap-3 p-4 sm:p-5")}>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className={eyebrowText}>Short case example</p>
                <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                  {mechanism.caseExample}
                </p>
              </div>
            </article>
            <article className={cn(formulationCard, "grid content-start gap-3 p-4 sm:p-5")}>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Route className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className={eyebrowText}>Formulation language</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--text-heading)]">
                  {mechanism.exampleSentence}
                </p>
              </div>
            </article>
          </section>

          <section className={cn(formulationCard, "grid gap-4 p-4 sm:p-5")}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Target className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className={eyebrowText}>Treatment implications</p>
                <h2 className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">
                  Translate the hypothesis into a testable target
                </h2>
              </div>
            </div>
            <ul className="grid gap-2 text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:grid-cols-2">
              {mechanism.treatmentImplications.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[color:var(--success)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-sm font-semibold leading-6 text-[color:var(--text-heading)]">
              {mechanism.treatmentTargetExample}
            </p>
          </section>
        </div>

        <aside className="grid content-start gap-4 xl:sticky xl:top-20">
          <section className={cn(formulationCard, "overflow-hidden")}>
            <div className="border-b border-[color:var(--border)] px-4 py-3">
              <p className={eyebrowText}>Quick reference</p>
            </div>
            <dl className="divide-y divide-[color:var(--border)]">
              {[
                ["Common symptoms", mechanism.symptoms.slice(0, 4).join(" · ")],
                ["Clinical contexts", mechanism.diagnosticContexts.slice(0, 3).join(" · ")],
                ["Development", mechanism.development],
                ["Formulation use", mechanism.formulationUse],
              ].map(([label, body]) => (
                <div key={label} className="px-4 py-3">
                  <dt className="text-xs font-extrabold text-[color:var(--text-heading)]">{label}</dt>
                  <dd className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={cn(formulationCard, "p-4")}>
            <p className={eyebrowText}>Add to a draft</p>
            <p className="mt-2 text-sm font-bold leading-6 text-[color:var(--text-heading)]">
              {mechanism.exampleSentence}
            </p>
            <Link
              href={`/formulation/builder?mechanism=${mechanism.id}`}
              className="mt-3 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)]"
            >
              Use in formulation
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>

          {related.length ? (
            <section className={cn(formulationCard, "overflow-hidden")}>
              <div className="border-b border-[color:var(--border)] px-4 py-3">
                <p className={eyebrowText}>Compare next</p>
              </div>
              <div className="divide-y divide-[color:var(--border)]">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={comparisonHref(mechanism.id, item.id)}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 text-sm font-bold text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)]"
                  >
                    {item.name}
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {sources.length ? (
            <details className={cn(formulationCard, "group overflow-hidden")}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <BookOpenCheck className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
                <span className="flex-1 text-xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">
                  Evidence notes
                </span>
                <ChevronDown
                  className="h-4 w-4 text-[color:var(--text-soft)] transition group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="grid gap-2 border-t border-[color:var(--border)] p-4">
                {sources.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold leading-5 text-[color:var(--clinical-accent)] hover:underline"
                  >
                    {source.title}
                  </a>
                ))}
                <p className="mt-1 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
                  Teaching references only. Check current local guidance and clinical applicability.
                </p>
              </div>
            </details>
          ) : null}
        </aside>
      </div>

      <FormulationSafetyNote />
    </FormulationPageShell>
  );
}
