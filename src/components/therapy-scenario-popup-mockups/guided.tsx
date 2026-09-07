"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  LifeBuoy,
  MapPin,
  Sparkles,
  Stethoscope,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";

import {
  AdvisoryLine,
  Chip,
  CONSTRAINT_GROUPS,
  constraintsIn,
  DesktopFrame,
  EXAMPLE_SITUATION,
  Eyebrow,
  FrameBlock,
  GhostButton,
  InertChipNotice,
  PhoneFrame,
  PrimaryButton,
  RecommendPageBehind,
  ScopeReadout,
  SituationField,
  StudyPage,
  TopBar,
  focusRing,
  inferConstraints,
  labelFor,
  useNarrowing,
  type GroupId,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction 1 — Guided scenario builder.
 *
 * The popup is a short sequence rather than one dense form: situation,
 * then one step per constraint group, then a review. Each step asks one
 * question and shows what it just cost you in records, so the reader
 * always knows whether a chip earned its place.
 * ------------------------------------------------------------------ */

type StepId = "situation" | GroupId | "review";

const STEPS: Array<{ id: StepId; label: string; icon: LucideIcon; question: string }> = [
  {
    id: "situation",
    label: "Situation",
    icon: Stethoscope,
    question: "What is the clinical situation?",
  },
  { id: "setting", label: "Setting", icon: MapPin, question: "Where will the work happen?" },
  { id: "time", label: "Time", icon: Clock, question: "How long do you have?" },
  { id: "support", label: "Support", icon: LifeBuoy, question: "What should the patient leave with?" },
  { id: "cautions", label: "Cautions", icon: TriangleAlert, question: "What must it not make worse?" },
  { id: "review", label: "Review", icon: Sparkles, question: "Ready to rank" },
];

function useScenario() {
  const [situation, setSituation] = useState(EXAMPLE_SITUATION);
  const [explicit, setExplicit] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const inferred = inferConstraints(situation).filter((key) => !dismissed.includes(key));
  const active = Array.from(new Set([...explicit, ...inferred]));
  const result = useNarrowing(active);

  const toggle = (key: string) => {
    if (explicit.includes(key)) {
      setExplicit(explicit.filter((value) => value !== key));
      if (inferConstraints(situation).includes(key)) setDismissed([...dismissed, key]);
      return;
    }
    if (inferred.includes(key)) {
      setDismissed([...dismissed, key]);
      return;
    }
    setDismissed(dismissed.filter((value) => value !== key));
    setExplicit([...explicit, key]);
  };

  return { situation, setSituation, active, inferred, toggle, result };
}

type Scenario = ReturnType<typeof useScenario>;

/** One class per step, in step order. Length must match STEPS. */
const PROGRESS_WIDTHS = ["w-1/6", "w-2/6", "w-3/6", "w-4/6", "w-5/6", "w-full"];

function StepRail({ step, onStep, phone = false }: { step: StepId; onStep: (next: StepId) => void; phone?: boolean }) {
  const index = STEPS.findIndex((item) => item.id === step);
  return (
    <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
      <div role="tablist" aria-label="Scenario steps" className={cn("flex gap-1 px-2", phone ? "overflow-x-auto" : "")}>
        {STEPS.map((item, itemIndex) => {
          const active = item.id === step;
          const done = itemIndex < index;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onStep(item.id)}
              className={cn(
                "relative inline-flex min-h-12 shrink-0 items-center gap-1.5 px-2.5 text-2xs font-bold transition",
                active
                  ? "text-[color:var(--clinical-accent)]"
                  : done
                    ? "text-[color:var(--text)]"
                    : "text-[color:var(--text-soft)] hover:text-[color:var(--text)]",
                focusRing,
              )}
            >
              <item.icon aria-hidden="true" size={13} strokeWidth={2} />
              {item.label}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-1.5 bottom-0 h-0.5 rounded-full",
                  active ? "bg-[color:var(--clinical-accent)]" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
      {/* Progress is drawn rather than described: six short steps, not a long form.
          The fill is a discrete class per step rather than an inline width, because
          the step count is fixed and every fraction lands on a Tailwind sixth —
          which keeps this off the inline-style drift ratchet. */}
      <div aria-hidden="true" className="h-0.5 w-full bg-[color:var(--surface-subtle)]">
        <div className={cn("h-0.5 bg-[color:var(--clinical-accent)] transition-all", PROGRESS_WIDTHS[index])} />
      </div>
    </div>
  );
}

function StepBody({ step, scenario }: { step: StepId; scenario: Scenario }) {
  const meta = STEPS.find((item) => item.id === step) ?? STEPS[0];

  if (step === "situation") {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="m-0 text-sm font-semibold text-[color:var(--text-heading)]">{meta.question}</h3>
          <p className="m-0 mt-1 text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
            Plain sentence is enough. Setting, time and cautions written here are picked up automatically on the next
            steps, and every one of them can be overridden.
          </p>
        </div>
        <SituationField id="guided-situation" value={scenario.situation} onChange={scenario.setSituation} rows={4} />
        {scenario.inferred.length ? (
          <div className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-2.5">
            <Eyebrow tone="accent">Picked up from what you wrote</Eyebrow>
            <p className="m-0 mt-1 text-2xs font-semibold text-[color:var(--text-muted)]">
              {scenario.inferred.map(labelFor).join(", ")}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="m-0 text-sm font-semibold text-[color:var(--text-heading)]">Scenario</h3>
          <p className="m-0 mt-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5 text-2xs leading-5 text-[color:var(--text)]">
            {scenario.situation || "No situation written"}
          </p>
        </div>
        <div>
          <Eyebrow>Constraints in force</Eyebrow>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {scenario.active.length ? (
              scenario.active.map((key) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-1 text-3xs font-bold text-[color:var(--text-muted)]"
                >
                  {labelFor(key)}
                  {scenario.inferred.includes(key) ? (
                    <Sparkles
                      aria-hidden="true"
                      size={10}
                      strokeWidth={2.2}
                      className="text-[color:var(--clinical-accent)]"
                    />
                  ) : null}
                </span>
              ))
            ) : (
              <span className="text-3xs font-bold text-[color:var(--text-soft)]">None</span>
            )}
          </div>
        </div>
        <InertChipNotice result={scenario.result} />
        <div>
          <Eyebrow>First records in scope</Eyebrow>
          <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
            {scenario.result.names.map((name) => (
              <li key={name} className="truncate text-2xs font-semibold text-[color:var(--text-muted)]">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const chips = constraintsIn(step);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="m-0 text-sm font-semibold text-[color:var(--text-heading)]">{meta.question}</h3>
        <p className="m-0 mt-1 text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
          {CONSTRAINT_GROUPS.find((group) => group.id === step)?.help}. Optional, and skipping keeps the scope wide.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((constraint) => (
          <Chip
            key={constraint.key}
            label={constraint.label}
            active={scenario.active.includes(constraint.key)}
            inferred={scenario.inferred.includes(constraint.key)}
            disabled={scenario.result.emptyingKeys.includes(constraint.key)}
            onToggle={() => scenario.toggle(constraint.key)}
          />
        ))}
      </div>
      <InertChipNotice result={scenario.result} />
    </div>
  );
}

function Popup({ scenario, onClose, phone = false }: { scenario: Scenario; onClose: () => void; phone?: boolean }) {
  const [step, setStep] = useState<StepId>("situation");
  const index = STEPS.findIndex((item) => item.id === step);
  const last = index === STEPS.length - 1;

  return (
    <>
      <header className="flex shrink-0 items-start gap-2.5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-base font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">
            Build the scenario
          </h2>
          <p className="m-0 mt-0.5 text-3xs font-bold text-[color:var(--text-soft)]">
            Step {index + 1} of {STEPS.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "grid size-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
            focusRing,
          )}
        >
          <X aria-hidden="true" size={16} strokeWidth={2} />
          <span className="sr-only">Close without applying</span>
        </button>
      </header>

      <StepRail step={step} onStep={setStep} phone={phone} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        <StepBody step={step} scenario={scenario} />
      </div>

      <footer className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <ScopeReadout result={scenario.result} compact={phone} />
          <span className="ml-auto flex items-center gap-2">
            {index > 0 ? (
              <GhostButton icon={ArrowLeft} onClick={() => setStep(STEPS[index - 1].id)}>
                {phone ? "" : "Back"}
              </GhostButton>
            ) : null}
            {last ? (
              <PrimaryButton icon={Sparkles} onClick={onClose}>
                Show {scenario.result.count}
              </PrimaryButton>
            ) : (
              <PrimaryButton icon={ArrowRight} onClick={() => setStep(STEPS[index + 1].id)}>
                Next
              </PrimaryButton>
            )}
          </span>
        </div>
        <AdvisoryLine className="mt-2" />
      </footer>
    </>
  );
}

function DesktopScene() {
  const scenario = useScenario();
  const [open, setOpen] = useState(true);

  return (
    <DesktopFrame>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <RecommendPageBehind
            situation={scenario.situation}
            activeKeys={scenario.active}
            count={scenario.result.count}
            onOpen={() => setOpen(true)}
          />
        </div>
      </div>
      {open ? (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close without applying"
            onClick={() => setOpen(false)}
            className="absolute inset-0 animate-overlay-in bg-[color:var(--neutral-950)]/50 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Build the scenario"
            className="relative flex h-full max-h-[32rem] w-full max-w-[38rem] animate-dialog-rise flex-col overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]"
          >
            <Popup scenario={scenario} onClose={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </DesktopFrame>
  );
}

function PhoneScene({ caption }: { caption: string }) {
  const scenario = useScenario();
  const [open, setOpen] = useState(true);

  return (
    <PhoneFrame caption={caption}>
      <TopBar phone />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <RecommendPageBehind
          situation={scenario.situation}
          activeKeys={scenario.active}
          count={scenario.result.count}
          onOpen={() => setOpen(true)}
          phone
        />
      </div>
      {open ? (
        <div className="absolute inset-0 z-[100] flex items-end">
          <button
            type="button"
            aria-label="Close without applying"
            onClick={() => setOpen(false)}
            className="absolute inset-0 animate-overlay-in bg-[color:var(--neutral-950)]/50"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Build the scenario"
            className="relative flex max-h-[94%] w-full animate-sheet-up flex-col overflow-hidden rounded-t-[1.25rem] border-t border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]"
          >
            <div className="flex shrink-0 justify-center bg-[color:var(--surface)] pt-2 pb-1">
              <span aria-hidden="true" className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
            </div>
            <Popup scenario={scenario} onClose={() => setOpen(false)} phone />
          </div>
        </div>
      ) : null}
    </PhoneFrame>
  );
}

export function TherapyScenarioPopupGuidedMockup() {
  return (
    <StudyPage
      eyebrow="Therapy · Recommend scenario · Direction 1"
      title="Guided scenario builder"
      lede="The popup asks one question at a time: the situation, then one step per constraint group, then a review. A running count in the footer shows what each chip actually costs you, so a constraint is never added blind."
      points={[
        {
          label: "Best for",
          body: "Getting a complete scenario in when you are not sure which constraints matter.",
        },
        {
          label: "Live feedback",
          body: "Records-in-scope updates on every chip, computed from the real 205-record catalogue.",
        },
        {
          label: "Trade-off",
          body: "Five steps is slower than one screen when you already know exactly what you want.",
        },
      ]}
    >
      <FrameBlock
        label="Desktop"
        size="Dialog 608px wide, capped at 512px tall"
        note="Type into the situation box and watch the chips light up on the later steps. A chip that would empty the result is shown disabled rather than allowed to return nothing."
      >
        <DesktopScene />
      </FrameBlock>

      <FrameBlock
        label="Phone"
        size="390px viewport, sheet at 94% height"
        note="Same steps, docked to the bottom edge. The count and the forward action stay pinned above the home indicator."
      >
        <div className="flex flex-wrap gap-6">
          <PhoneScene caption="Phone · Stepped builder" />
        </div>
      </FrameBlock>
    </StudyPage>
  );
}
