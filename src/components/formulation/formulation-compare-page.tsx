"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GitCompareArrows, HelpCircle, Network, Target } from "lucide-react";

import {
  CompareIdsChrome,
  pairCompareHref,
  type CompareCatalogItem,
  type CompareStarterChip,
} from "@/components/compare";
import {
  FormulationPageShell,
  FormulationSafetyNote,
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

const COMPARE_PATH = "/formulation/compare";

const catalogItems: CompareCatalogItem[] = formulationMechanisms.map((mechanism) => ({
  id: mechanism.id,
  title: mechanism.name,
  snippet: mechanism.summary,
  tag: mechanism.domains[0],
}));

const starterChips: CompareStarterChip[] = [
  {
    id: "rumination-worry",
    label: "Rumination vs worry",
    href: pairCompareHref(COMPARE_PATH, "rumination", "worry"),
  },
  {
    id: "avoidance-shame",
    label: "Avoidance vs shame",
    href: pairCompareHref(COMPARE_PATH, "avoidance", "shame"),
  },
];

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
  const router = useRouter();
  const left = initialLeft ? (findFormulationMechanism(initialLeft) ?? null) : null;
  const right = initialRight && initialRight !== left?.id ? (findFormulationMechanism(initialRight) ?? null) : null;
  const ready = Boolean(left && right);
  const guide = left && right ? comparisonGuideFor(left.id, right.id) : null;
  const rows = left && right ? comparisonRows(left, right) : [];

  return (
    <FormulationPageShell>
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

      <CompareIdsChrome
        selectedIds={[left?.id, right?.id]}
        maxCount={2}
        items={catalogItems}
        starters={starterChips}
        emptyTitle="Choose two mechanisms"
        emptyDescription="Search the formulation catalogue, or start from a common pair."
        actionLabel="Choose mechanisms"
        searchPlaceholder="Search mechanism"
        pickerTitle="Choose two mechanisms"
        pickerDescription="Assign a mechanism to A or B. Duplicates are blocked."
        pickerId="formulation-compare-picker"
        pickerTestId="formulation-compare-picker"
        changeLabel="Change mechanisms"
        slotPlaceholder="Choose mechanism"
        icon={Network}
        onCommit={(ids) => router.push(pairCompareHref(COMPARE_PATH, ids[0], ids[1]))}
      />

      {ready && left && right ? (
        <>
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
        </>
      ) : null}

      <FormulationSafetyNote />
    </FormulationPageShell>
  );
}
