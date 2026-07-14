"use client";

import Link from "next/link";
import { ArrowRight, GitCompareArrows, HelpCircle, Network, Repeat2, Target } from "lucide-react";
import { useState } from "react";

import {
  FormulationBreadcrumbs,
  FormulationPageShell,
  FormulationSafetyNote,
  FormulationSubnav,
  MechanismDomainChips,
  formulationCard,
} from "@/components/formulation/formulation-ui";
import { cn, eyebrowText } from "@/components/ui-primitives";
import {
  comparisonGuideFor,
  findFormulationMechanism,
  formulationMechanisms,
  type FormulationMechanism,
} from "@/lib/formulation";

function fallbackPair(leftId?: string, rightId?: string) {
  const left =
    findFormulationMechanism(leftId ?? "") ?? findFormulationMechanism("rumination") ?? formulationMechanisms[0];
  const requestedRight = findFormulationMechanism(rightId ?? "");
  const preferredRight = findFormulationMechanism(left.id === "rumination" ? "worry" : "rumination");
  const right =
    requestedRight && requestedRight.id !== left.id
      ? requestedRight
      : preferredRight && preferredRight.id !== left.id
        ? preferredRight
        : formulationMechanisms.find((item) => item.id !== left.id)!;
  return { left, right };
}

function Selector({
  label,
  value,
  otherValue,
  onChange,
}: {
  label: string;
  value: string;
  otherValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className={eyebrowText}>{label}</span>
      <span className="relative">
        <Network
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--clinical-accent)]"
          aria-hidden
        />
        <select
          aria-label={`Mechanism ${label}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-10 pr-9 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20"
        >
          {formulationMechanisms.map((mechanism) => (
            <option key={mechanism.id} value={mechanism.id} disabled={mechanism.id === otherValue}>
              {mechanism.name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function comparisonRows(left: FormulationMechanism, right: FormulationMechanism) {
  return [
    { label: "Definition", left: left.definition, right: right.definition },
    { label: "Core process", left: left.coreProcess, right: right.coreProcess },
    {
      label: "Look for",
      left: left.clinicalClues.slice(0, 2).join(" · "),
      right: right.clinicalClues.slice(0, 2).join(" · "),
    },
    { label: "Patient language", left: `“${left.patientPhrases[0]}”`, right: `“${right.patientPhrases[0]}”` },
    { label: "Maintaining cycle", left: left.maintainingCycles[0], right: right.maintainingCycles[0] },
    { label: "Treatment leverage", left: left.treatmentLeverage, right: right.treatmentLeverage },
    { label: "Check before using", left: left.poorFitIndicators[0], right: right.poorFitIndicators[0] },
  ];
}

export function FormulationComparePage({ initialLeft, initialRight }: { initialLeft?: string; initialRight?: string }) {
  const initial = fallbackPair(initialLeft, initialRight);
  const [leftId, setLeftId] = useState(initial.left.id);
  const [rightId, setRightId] = useState(initial.right.id);
  const left = findFormulationMechanism(leftId) ?? initial.left;
  const right = findFormulationMechanism(rightId) ?? initial.right;
  const guide = comparisonGuideFor(left.id, right.id);
  const rows = comparisonRows(left, right);

  function chooseLeft(nextId: string) {
    setLeftId(nextId);
    if (nextId === rightId) {
      setRightId(formulationMechanisms.find((item) => item.id !== nextId)?.id ?? rightId);
    }
  }

  function chooseRight(nextId: string) {
    setRightId(nextId);
    if (nextId === leftId) {
      setLeftId(formulationMechanisms.find((item) => item.id !== nextId)?.id ?? leftId);
    }
  }

  function swap() {
    setLeftId(right.id);
    setRightId(left.id);
  }

  return (
    <FormulationPageShell>
      <div className="grid gap-3">
        <FormulationBreadcrumbs current="Compare" />
        <FormulationSubnav active="compare" />
      </div>

      <header className="grid gap-2 border-b border-[color:var(--border)] pb-5">
        <p className={eyebrowText}>Alternative hypotheses</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
          Compare mechanisms
        </h1>
        <p className="max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          Compare function, sequence, patient language, and treatment leverage. The aim is not to choose a label—it is
          to identify which hypothesis best explains this person’s pattern.
        </p>
      </header>

      <section
        className={cn(
          formulationCard,
          "grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] sm:items-end sm:p-5",
        )}
      >
        <Selector label="A" value={left.id} otherValue={right.id} onChange={chooseLeft} />
        <button
          type="button"
          onClick={swap}
          aria-label="Swap compared mechanisms"
          className="grid h-tap w-tap place-items-center justify-self-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <Repeat2 className="h-4 w-4" aria-hidden />
        </button>
        <Selector label="B" value={right.id} otherValue={left.id} onChange={chooseRight} />
      </section>

      <section className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-4 text-center sm:px-6">
        <div className="mx-auto flex max-w-4xl items-start justify-center gap-2.5">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
          <div>
            <p className={cn(eyebrowText, "!text-[color:var(--clinical-accent)]")}>Ask this</p>
            <p className="mt-1 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">
              {guide?.assessmentQuestion ??
                `Which pattern better explains the sequence, protective function, and consequences: ${left.name.toLowerCase()} or ${right.name.toLowerCase()}?`}
            </p>
          </div>
        </div>
      </section>

      {guide ? (
        <section
          className={cn(formulationCard, "grid overflow-hidden md:grid-cols-3")}
          aria-label="Focused distinction"
        >
          {[
            ["Most useful distinction", guide.mostUsefulDistinction],
            ["Common confusion", guide.commonConfusion],
            ["Treatment difference", guide.treatmentImplicationDifference],
          ].map(([label, body], index) => (
            <div
              key={label}
              className={cn(
                "p-4 sm:p-5",
                index > 0 && "border-t border-[color:var(--border)] md:border-l md:border-t-0",
              )}
            >
              <p className={eyebrowText}>{label}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--text-heading)]">{body}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section
        className={cn(formulationCard, "overflow-hidden")}
        aria-label={`${left.name} compared with ${right.name}`}
      >
        <div className="grid sm:grid-cols-2">
          {[left, right].map((mechanism, index) => (
            <div
              key={mechanism.id}
              className={cn(
                "grid gap-3 px-4 py-4 sm:px-5",
                index === 1 && "border-t border-[color:var(--border)] sm:border-l sm:border-t-0",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-xs font-extrabold text-[color:var(--clinical-accent-contrast)]">
                  {index === 0 ? "A" : "B"}
                </span>
                <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">{mechanism.name}</h2>
              </div>
              <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">{mechanism.summary}</p>
              <MechanismDomainChips values={mechanism.domains} limit={3} />
            </div>
          ))}
        </div>

        <div className="border-t border-[color:var(--border)]">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid border-b border-[color:var(--border)] last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div className="bg-[color:var(--surface-subtle)] px-4 py-3 text-xs font-extrabold text-[color:var(--text-heading)] sm:flex sm:items-center">
                {row.label}
              </div>
              {[row.left, row.right].map((body, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className={cn(
                    "grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 px-4 py-3 text-sm font-medium leading-6 text-[color:var(--text-muted)]",
                    index === 1 && "border-t border-[color:var(--border)] sm:border-l sm:border-t-0",
                  )}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-xs font-extrabold text-[color:var(--clinical-accent)]">
                    {index === 0 ? "A" : "B"}
                  </span>
                  <span>{body}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="grid border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] sm:grid-cols-2">
          {[left, right].map((mechanism, index) => (
            <div
              key={mechanism.id}
              className={cn(
                "p-4 sm:p-5",
                index === 1 && "border-t border-[color:var(--border)] sm:border-l sm:border-t-0",
              )}
            >
              <p className={eyebrowText}>Formulation language</p>
              <p className="mt-1.5 text-sm font-bold leading-6 text-[color:var(--text-heading)]">
                {mechanism.exampleSentence}
              </p>
              <Link
                href={`/formulation/${mechanism.id}`}
                className="mt-3 inline-flex min-h-tap items-center gap-2 rounded-md px-1 text-sm font-bold text-[color:var(--clinical-accent)] hover:underline"
              >
                Open full guide
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href="/formulation/map"
          className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text)]"
        >
          <GitCompareArrows className="h-4 w-4" aria-hidden />
          Browse the map
        </Link>
        <Link
          href={`/formulation/builder?mechanism=${left.id}&mechanism=${right.id}`}
          className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)]"
        >
          <Target className="h-4 w-4" aria-hidden />
          Use both hypotheses
        </Link>
      </div>

      <FormulationSafetyNote />
    </FormulationPageShell>
  );
}
