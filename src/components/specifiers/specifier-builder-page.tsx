"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ClipboardCopy,
  FileCheck2,
  GitCompareArrows,
  ListChecks,
  RotateCcw,
  Tags,
  Waypoints,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SpecifierPageShell, SpecifierSafetyNote, specifierCard } from "@/components/specifiers/specifier-ui";
import { pairCompareHref } from "@/components/compare";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import {
  normalizeSpecifierSelection,
  specifierAppliesToBuilderDiagnosis,
  specifierRecords,
  type SpecifierBuilderDiagnosis,
  type SpecifierFamily,
  type SpecifierRecord,
} from "@/lib/specifiers";
import { copyButton, errorCopy, specifierBuilderCopy } from "@/lib/ui-copy";

const diagnosisPresets: Array<{ id: SpecifierBuilderDiagnosis; label: string }> = [
  { id: "mdd-recurrent", label: "Major depressive disorder, recurrent" },
  { id: "mdd-single", label: "Major depressive disorder, single episode" },
  { id: "bipolar-i-depressed", label: "Bipolar I disorder, current episode depressed" },
  { id: "bipolar-i-manic", label: "Bipolar I disorder, current episode manic" },
  { id: "bipolar-ii-depressed", label: "Bipolar II disorder, current episode depressed" },
];

const specifierFamilyOrder: Record<SpecifierFamily, number> = {
  "episode-features": 0,
  "course-onset": 1,
  "severity-remission": 2,
};

const builderSteps = [
  {
    id: "base",
    fullLabel: "Base diagnosis",
    copy: specifierBuilderCopy.steps.base,
  },
  {
    id: "episode-features",
    fullLabel: "Episode features",
    copy: specifierBuilderCopy.steps.episodeFeatures,
  },
  {
    id: "course-onset",
    fullLabel: "Course and onset",
    copy: specifierBuilderCopy.steps.courseOnset,
  },
  {
    id: "severity-remission",
    fullLabel: "Severity or remission",
    copy: specifierBuilderCopy.steps.severityRemission,
  },
] as const;

type BuilderStepId = (typeof builderSteps)[number]["id"];
type BuilderView = BuilderStepId | "review";
type CopyState = "idle" | "copied" | "failed";

function wordingSegment(record: SpecifierRecord) {
  if (record.slug === "mild-severity") return "mild";
  if (record.slug === "with-psychotic-features") return "severe with psychotic features";
  return record.name.charAt(0).toLowerCase() + record.name.slice(1);
}

function initialBuilderStep(specifiers: string[]): BuilderStepId {
  const firstRecord = specifiers
    .map((slug) => specifierRecords.find((record) => record.slug === slug))
    .filter((record): record is SpecifierRecord => Boolean(record))
    .sort((left, right) => specifierFamilyOrder[left.family] - specifierFamilyOrder[right.family])[0];
  return firstRecord?.family ?? "base";
}

function StepProgress({
  active,
  visited,
  onChange,
}: {
  active: BuilderView;
  visited: BuilderStepId[];
  onChange: (step: BuilderStepId) => void;
}) {
  return (
    <ol
      aria-label="Specifier builder steps"
      className="grid grid-cols-4 gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-1.5 shadow-[var(--shadow-inset)]"
    >
      {builderSteps.map((step, index) => {
        const isActive = active === step.id;
        const isComplete = visited.includes(step.id) && !isActive;
        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onChange(step.id)}
              aria-current={isActive ? "step" : undefined}
              aria-label={`Step ${index + 1} of ${builderSteps.length}: ${step.fullLabel}${isComplete ? ", reviewed" : ""}`}
              className={cn(
                "grid min-h-[3.25rem] w-full place-items-center rounded-lg border px-1 py-1.5 text-center transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:grid-cols-[1.75rem_auto] sm:justify-center sm:gap-2",
                isActive
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--e1)]"
                  : "border-transparent bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border)] hover:text-[color:var(--text-heading)]",
              )}
            >
              <span
                className={cn(
                  "nums grid h-6 w-6 place-items-center rounded-full border text-2xs font-extrabold",
                  isActive || isComplete
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                    : "border-[color:var(--border-strong)] text-[color:var(--text-muted)]",
                )}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
              </span>
              <span>
                <span className="block text-2xs font-extrabold sm:text-xs">{step.copy.shortLabel}</span>
                <span className="hidden text-2xs font-semibold lg:block">{step.copy.detail}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepHeading({ step }: { step: (typeof builderSteps)[number] }) {
  return (
    <div className="border-b border-[color:var(--border)] px-4 py-4 sm:px-5">
      <p className={cn(eyebrowText, "!text-[color:var(--clinical-accent)]")}>{step.copy.eyebrow}</p>
      <h2
        id="specifier-builder-stage-heading"
        tabIndex={-1}
        className="mt-1 text-xl font-extrabold text-[color:var(--text-heading)] outline-none"
      >
        {step.copy.title}
      </h2>
      <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-muted)]">{step.copy.body}</p>
    </div>
  );
}

export function SpecifierBuilderPage({ initialSpecifiers = [] }: { initialSpecifiers?: string[] }) {
  const validInitial = normalizeSpecifierSelection(initialSpecifiers);
  const initialDiagnosis =
    diagnosisPresets.find((preset) =>
      validInitial.every((slug) => {
        const record = specifierRecords.find((candidate) => candidate.slug === slug);
        return record ? specifierAppliesToBuilderDiagnosis(record, preset.id) : false;
      }),
    ) ?? diagnosisPresets[0];
  const firstStep = initialBuilderStep(validInitial);
  const [diagnosisId, setDiagnosisId] = useState<SpecifierBuilderDiagnosis>(initialDiagnosis.id);
  const [selected, setSelected] = useState<string[]>(validInitial);
  const [activeView, setActiveView] = useState<BuilderView>(firstStep);
  const [visited, setVisited] = useState<BuilderStepId[]>(firstStep === "base" ? ["base"] : ["base", firstStep]);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyTimer = useRef<number | null>(null);
  const focusStageHeading = useRef(false);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!focusStageHeading.current) return;
    document.getElementById("specifier-builder-stage-heading")?.focus();
    focusStageHeading.current = false;
  }, [activeView]);

  const diagnosis = diagnosisPresets.find((preset) => preset.id === diagnosisId) ?? initialDiagnosis;
  const selectedRecords = useMemo(
    () =>
      selected
        .map((slug) => specifierRecords.find((record) => record.slug === slug))
        .filter((record): record is SpecifierRecord => Boolean(record))
        .sort((left, right) => specifierFamilyOrder[left.family] - specifierFamilyOrder[right.family]),
    [selected],
  );
  const wording = [diagnosis.label, ...selectedRecords.map((record) => wordingSegment(record))].join(", ");
  const severityNotSpecified = !selectedRecords.some((record) => record.family === "severity-remission");

  function changeDiagnosis(nextDiagnosis: SpecifierBuilderDiagnosis) {
    setDiagnosisId(nextDiagnosis);
    setSelected((current) =>
      current.filter((slug) => {
        const record = specifierRecords.find((candidate) => candidate.slug === slug);
        return record ? specifierAppliesToBuilderDiagnosis(record, nextDiagnosis) : false;
      }),
    );
    setCopyState("idle");
  }

  function toggle(slug: string) {
    setSelected((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      return normalizeSpecifierSelection([...current, slug]);
    });
    setCopyState("idle");
  }

  function chooseSeverity(slug: string | null) {
    setSelected((current) => {
      const withoutSeverity = current.filter((item) => {
        const record = specifierRecords.find((candidate) => candidate.slug === item);
        return record?.family !== "severity-remission";
      });
      return slug ? normalizeSpecifierSelection([...withoutSeverity, slug]) : withoutSeverity;
    });
    setCopyState("idle");
  }

  function openStep(step: BuilderStepId, focusHeading = false) {
    focusStageHeading.current = focusHeading;
    setActiveView(step);
    setVisited((current) => (current.includes(step) ? current : [...current, step]));
  }

  function move(direction: -1 | 1) {
    if (activeView === "review") {
      openStep("severity-remission", true);
      return;
    }
    const index = builderSteps.findIndex((step) => step.id === activeView);
    if (direction === 1 && index === builderSteps.length - 1) {
      focusStageHeading.current = true;
      setActiveView("review");
      return;
    }
    const next = builderSteps[index + direction];
    if (next) openStep(next.id, true);
  }

  function resetBuilder() {
    setDiagnosisId(diagnosisPresets[0].id);
    setSelected([]);
    setVisited(["base"]);
    focusStageHeading.current = true;
    setActiveView("base");
    setCopyState("idle");
  }

  async function copyWording() {
    try {
      await copyTextToClipboard(wording);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyState("idle"), 2200);
  }

  const activeStep = activeView === "review" ? null : builderSteps.find((step) => step.id === activeView);
  const activeIndex = activeStep ? builderSteps.findIndex((step) => step.id === activeStep.id) : builderSteps.length;

  return (
    <SpecifierPageShell>
      <header className="grid min-w-0 gap-2 border-b border-[color:var(--border)] pb-5">
        <p className={eyebrowText}>{specifierBuilderCopy.hero.eyebrow}</p>
        <h1 className="text-3xl font-extrabold tracking-tight break-words text-[color:var(--text-heading)] sm:text-4xl">
          {specifierBuilderCopy.hero.title}
        </h1>
        <p className="max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          {specifierBuilderCopy.hero.body}
        </p>
      </header>

      <StepProgress active={activeView} visited={visited} onChange={openStep} />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0">
          {activeStep?.id === "base" ? (
            <section className={cn(specifierCard, "min-w-0 overflow-hidden")} data-testid="specifier-builder-base">
              <StepHeading step={activeStep} />
              <div className="p-4 sm:p-5">
                <label className="grid min-w-0 gap-1.5">
                  <span className="text-xs font-bold text-[color:var(--text-muted)]">Diagnostic phrase</span>
                  <select
                    value={diagnosisId}
                    onChange={(event) => changeDiagnosis(event.target.value as SpecifierBuilderDiagnosis)}
                    className="min-h-12 w-full max-w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20"
                  >
                    {diagnosisPresets.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          ) : null}

          {activeStep && activeStep.id !== "base" ? (
            <section
              className={cn(specifierCard, "min-w-0 overflow-hidden")}
              data-testid={`specifier-builder-${activeStep.id}`}
            >
              <StepHeading step={activeStep} />
              {activeStep.id === "severity-remission" ? (
                <fieldset>
                  <legend className="sr-only">Severity or remission options</legend>
                  <div className="grid min-w-0 sm:grid-cols-2">
                    <label className="group grid min-w-0 cursor-pointer grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] px-4 py-3.5 transition motion-reduce:transition-none hover:bg-[color:var(--surface-subtle)] sm:px-5">
                      <input
                        type="radio"
                        name="severity-remission"
                        aria-label={specifierBuilderCopy.review.notSpecified}
                        checked={!selectedRecords.some((record) => record.family === "severity-remission")}
                        onChange={() => chooseSeverity(null)}
                        className="peer sr-only"
                      />
                      <span
                        className={cn(
                          "mt-0.5 grid h-7 w-7 place-items-center rounded-full border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]",
                          severityNotSpecified
                            ? "border-[color:var(--clinical-accent)] bg-[color:var(--surface)]"
                            : "border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)]",
                        )}
                      >
                        {severityNotSpecified ? (
                          <span className="h-3 w-3 rounded-full bg-[color:var(--clinical-accent)]" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold text-[color:var(--text-heading)]">
                          {specifierBuilderCopy.review.notSpecified}
                        </span>
                        <span className="mt-1 block text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                          Leave severity or remission unstated when it is not established.
                        </span>
                      </span>
                    </label>
                    {specifierRecords
                      .filter((record) => record.family === "severity-remission")
                      .map((record, index) => {
                        const checked = selected.includes(record.slug);
                        const compatible = specifierAppliesToBuilderDiagnosis(record, diagnosisId);
                        return (
                          <label
                            key={record.slug}
                            className={cn(
                              "group grid min-w-0 cursor-pointer grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] px-4 py-3.5 transition motion-reduce:transition-none hover:bg-[color:var(--surface-subtle)] sm:px-5",
                              index % 2 === 0 && "sm:border-l",
                              checked && "bg-[color:var(--clinical-accent-soft)]/55",
                              !compatible && "cursor-not-allowed opacity-55",
                            )}
                          >
                            <input
                              type="radio"
                              name="severity-remission"
                              aria-label={record.shortName}
                              checked={checked}
                              disabled={!compatible}
                              onChange={() => chooseSeverity(record.slug)}
                              className="peer sr-only"
                            />
                            <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] peer-checked:border-[color:var(--clinical-accent)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]">
                              <span
                                className={cn(
                                  "h-3 w-3 rounded-full bg-[color:var(--clinical-accent)]",
                                  checked ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-extrabold break-words text-[color:var(--text-heading)]">
                                {record.shortName}
                              </span>
                              <span className="mt-1 block text-xs font-medium leading-5 break-words text-[color:var(--text-muted)]">
                                {compatible ? record.clinicalSignal : "Not applicable to the selected diagnosis."}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </fieldset>
              ) : (
                <fieldset>
                  <legend className="sr-only">{activeStep.fullLabel} options</legend>
                  <div className="grid min-w-0 sm:grid-cols-2">
                    {specifierRecords
                      .filter((record) => record.family === activeStep.id)
                      .map((record, index) => {
                        const checked = selected.includes(record.slug);
                        const compatible = specifierAppliesToBuilderDiagnosis(record, diagnosisId);
                        return (
                          <label
                            key={record.slug}
                            className={cn(
                              "group grid min-w-0 cursor-pointer grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] px-4 py-3.5 transition motion-reduce:transition-none hover:bg-[color:var(--surface-subtle)] sm:px-5",
                              index % 2 === 1 && "sm:border-l",
                              checked && "bg-[color:var(--clinical-accent-soft)]/55",
                              !compatible && "cursor-not-allowed opacity-55",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!compatible}
                              onChange={() => toggle(record.slug)}
                              className="peer sr-only"
                            />
                            <span
                              className={cn(
                                "mt-0.5 grid h-7 w-7 place-items-center rounded-md border text-transparent transition motion-reduce:transition-none peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]",
                                checked
                                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                                  : "border-[color:var(--border-strong)] bg-[color:var(--surface)]",
                              )}
                            >
                              <Check className="h-4 w-4" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-extrabold break-words text-[color:var(--text-heading)]">
                                {record.shortName}
                              </span>
                              <span className="mt-1 block text-xs font-medium leading-5 break-words text-[color:var(--text-muted)]">
                                {compatible ? record.clinicalSignal : "Not applicable to the selected diagnosis."}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </fieldset>
              )}
            </section>
          ) : null}

          {activeView === "review" ? (
            <section className={cn(specifierCard, "min-w-0 overflow-hidden")} data-testid="specifier-builder-review">
              <div className="border-b border-[color:var(--border)] px-4 py-4 sm:px-5">
                <p className={cn(eyebrowText, "!text-[color:var(--clinical-accent)]")}>
                  {specifierBuilderCopy.review.eyebrow}
                </p>
                <h2
                  id="specifier-builder-stage-heading"
                  tabIndex={-1}
                  className="mt-1 text-xl font-extrabold text-[color:var(--text-heading)] outline-none"
                >
                  {specifierBuilderCopy.review.title}
                </h2>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                  {specifierBuilderCopy.review.body}
                </p>
              </div>
              <div className="grid gap-4 p-4 sm:p-5">
                <div className="rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/45 p-4">
                  <p className={eyebrowText}>Completed wording</p>
                  <p
                    data-testid="specifier-completed-wording"
                    className="mt-2 text-lg font-extrabold leading-7 break-words text-[color:var(--text-heading)]"
                  >
                    {wording}
                  </p>
                </div>

                <div className="grid gap-2">
                  {builderSteps.map((step) => {
                    const records =
                      step.id === "base" ? [] : selectedRecords.filter((record) => record.family === step.id);
                    const value =
                      step.id === "base"
                        ? diagnosis.label
                        : records.length
                          ? records.map((record) => record.shortName).join(", ")
                          : specifierBuilderCopy.review.notSpecified;
                    return (
                      <div
                        key={step.id}
                        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-2xs font-bold uppercase tracking-wide text-[color:var(--text-muted)]">
                            {step.fullLabel}
                          </p>
                          <p className="mt-0.5 text-sm font-bold break-words text-[color:var(--text-heading)]">
                            {value}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openStep(step.id, true)}
                          className="inline-flex min-h-tap items-center rounded-lg px-3 text-xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                        >
                          Edit
                          <span className="sr-only"> {step.fullLabel}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4">
                  <button
                    type="button"
                    onClick={resetBuilder}
                    className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    {specifierBuilderCopy.review.startOver}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyWording()}
                    className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--e1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  >
                    {copyState === "copied" ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <ClipboardCopy className="h-4 w-4" aria-hidden />
                    )}
                    {copyState === "copied" ? copyButton.copied : specifierBuilderCopy.review.copy}
                  </button>
                </div>
                <p role="status" className="sr-only">
                  {copyState === "copied"
                    ? specifierBuilderCopy.review.copied
                    : copyState === "failed"
                      ? errorCopy.clipboardCopyFailed
                      : ""}
                </p>

                <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--border)] pt-4">
                  <Link
                    href="/specifiers/map"
                    className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text)] motion-reduce:transition-none"
                  >
                    <Waypoints className="h-4 w-4" aria-hidden />
                    Browse the map
                  </Link>
                  <Link
                    href={
                      selectedRecords.length >= 2
                        ? pairCompareHref("/specifiers/compare", selectedRecords[0].slug, selectedRecords[1].slug)
                        : "/specifiers/compare"
                    }
                    className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text)] motion-reduce:transition-none"
                  >
                    <GitCompareArrows className="h-4 w-4" aria-hidden />
                    Compare specifiers
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          {activeView !== "review" ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
              <button
                type="button"
                onClick={() => move(-1)}
                disabled={activeIndex === 0}
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text-muted)] disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:bg-[color:var(--surface-inset)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                {specifierBuilderCopy.navigation.previous}
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--e1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              >
                {activeIndex === 0
                  ? specifierBuilderCopy.navigation.continueToFeatures
                  : activeIndex === 1
                    ? specifierBuilderCopy.navigation.continueToCourse
                    : activeIndex === 2
                      ? specifierBuilderCopy.navigation.continueToSeverity
                      : specifierBuilderCopy.navigation.reviewWording}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>

        <aside className="grid min-w-0 content-start gap-4 xl:sticky xl:top-20">
          <section className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] shadow-[var(--e2)]">
            <div className="flex min-w-0 items-center gap-3 border-b border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
                <FileCheck2 className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className={cn(eyebrowText, "!text-[color:var(--clinical-accent)]")}>Working diagnosis</p>
                <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Structured wording</h2>
              </div>
            </div>
            <div className="grid min-w-0 gap-4 p-4">
              <p
                data-testid="specifier-working-wording"
                className="min-w-0 text-base font-extrabold leading-7 break-words text-[color:var(--text-heading)]"
              >
                {wording}
              </p>
              <div className="grid min-w-0 gap-2 border-t border-[color:var(--border)] pt-3">
                <p className={eyebrowText}>Applied specifiers</p>
                {selectedRecords.length ? (
                  <ul className="grid min-w-0 gap-2">
                    {selectedRecords.map((record) => (
                      <li
                        key={record.slug}
                        className="flex min-w-0 items-center justify-between gap-2 text-sm font-semibold text-[color:var(--text-muted)]"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2 break-words">
                          <Tags className="h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                          {record.shortName}
                        </span>
                        <Link
                          href={`/specifiers/${record.slug}`}
                          aria-label={`Review ${record.shortName}`}
                          className="grid h-tap w-tap shrink-0 place-items-center rounded-md text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                        >
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                    No specifiers selected yet.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className={cn(specifierCard, "p-4")}>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
              <p className={eyebrowText}>Before documenting</p>
            </div>
            <ul className="mt-3 grid gap-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
              <li>Confirm each specifier is valid for the base diagnosis.</li>
              <li>Check episode chronology and competing explanations.</li>
              <li>Use one internally consistent severity or remission descriptor.</li>
            </ul>
          </section>
        </aside>
      </div>

      <SpecifierSafetyNote />
    </SpecifierPageShell>
  );
}
