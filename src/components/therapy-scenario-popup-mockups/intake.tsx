"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ClipboardList,
  Pencil,
  Sparkles,
  SlidersHorizontal,
  Stethoscope,
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
  Eyebrow,
  FrameBlock,
  GhostButton,
  InertChipNotice,
  PhoneFrame,
  PrimaryButton,
  RecommendPageBehind,
  ScopeReadout,
  StudyPage,
  TopBar,
  focusRing,
  inferConstraints,
  labelFor,
  useNarrowing,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction 3 — Structured intake.
 *
 * The free text comes last, not first. Structured pickers build the
 * scenario and the popup writes the sentence, which stays visible and
 * editable, so what actually gets searched is never a guess. Tabs are
 * by clinical axis rather than by step, so any one can be revisited
 * without walking a sequence.
 * ------------------------------------------------------------------ */

type TabId = "presentation" | "constraints" | "sentence";

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "presentation", label: "Presentation", icon: Stethoscope },
  { id: "constraints", label: "Constraints", icon: SlidersHorizontal },
  { id: "sentence", label: "Scenario", icon: ClipboardList },
];

/** The tag vocabulary the catalogue actually carries. */
const PRESENTATIONS = [
  "Anxiety",
  "Mood",
  "Trauma",
  "Psychosis",
  "Substance use",
  "Eating/body image",
  "Neurodevelopmental",
  "Crisis/risk",
  "Personality",
  "Sleep",
];

const DRIVERS = ["Avoidance", "Rumination", "Withdrawal", "Compulsions", "Interpersonal conflict"];

const AGE_BANDS = ["Child", "Adolescent", "Adult", "Older adult"];

function useIntake() {
  const [presentations, setPresentations] = useState<string[]>(["Anxiety"]);
  const [driver, setDriver] = useState("Avoidance");
  const [ageBand, setAgeBand] = useState("Adult");
  const [explicit, setExplicit] = useState<string[]>(["outpatient"]);
  const [extra, setExtra] = useState("");
  const [edited, setEdited] = useState<string | null>(null);

  /**
   * The sentence is composed from the pickers unless the reader has taken it
   * over. Once edited it stops being regenerated, because silently rewriting
   * something a clinician typed is the one behaviour that would make this
   * direction untrustworthy.
   */
  const composed = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      `${ageBand.toLowerCase()} presenting with ${presentations.join(" and ").toLowerCase() || "unspecified"}`,
    );
    parts.push(`maintained mainly by ${driver.toLowerCase()}`);
    if (explicit.includes("outpatient")) parts.push("outpatient clinic");
    if (explicit.includes("inpatient")) parts.push("inpatient ward");
    if (explicit.includes("15min")) parts.push("15 minutes available");
    if (explicit.includes("5min")) parts.push("5 minutes available");
    if (explicit.includes("trauma")) parts.push("trauma caution");
    if (extra.trim()) parts.push(extra.trim());
    return `${parts.join(", ")}.`;
  }, [ageBand, presentations, driver, explicit, extra]);

  const sentence = edited ?? composed;
  const inferred = inferConstraints(sentence);
  const active = Array.from(new Set([...explicit, ...inferred]));
  const result = useNarrowing(active);

  const toggleConstraint = (key: string) =>
    setExplicit((prev) => (prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key]));

  const togglePresentation = (value: string) =>
    setPresentations((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));

  return {
    presentations,
    togglePresentation,
    driver,
    setDriver,
    ageBand,
    setAgeBand,
    explicit,
    toggleConstraint,
    extra,
    setExtra,
    sentence,
    composed,
    edited,
    setEdited,
    inferred,
    active,
    result,
  };
}

type Intake = ReturnType<typeof useIntake>;

function PickRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div role="group" aria-label={label} className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={selected}
              className={cn(
                "inline-flex min-h-12 items-center gap-1.5 rounded-full border px-3 text-2xs font-bold transition",
                selected
                  ? "border-[color:var(--text-heading)] bg-[color:var(--text-heading)] text-[color:var(--surface)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]",
                focusRing,
              )}
            >
              {selected ? <Check aria-hidden="true" size={12} strokeWidth={3} /> : null}
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabBody({ tab, intake }: { tab: TabId; intake: Intake }) {
  if (tab === "presentation") {
    return (
      <div className="flex flex-col gap-3.5">
        <div>
          <Eyebrow>Presentation</Eyebrow>
          <p className="m-0 mt-1 mb-1.5 text-3xs font-semibold text-[color:var(--text-soft)]">
            The tag vocabulary the catalogue itself uses. More than one is fine. Presentation and mechanism shape the
            ranking rather than the record count, so the footer number moves only with the constraint chips.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESENTATIONS.map((item) => (
              <Chip
                key={item}
                label={item}
                active={intake.presentations.includes(item)}
                onToggle={() => intake.togglePresentation(item)}
              />
            ))}
          </div>
        </div>
        <PickRow
          label="Main maintaining mechanism"
          options={DRIVERS}
          value={intake.driver}
          onChange={intake.setDriver}
        />
        <PickRow label="Age band" options={AGE_BANDS} value={intake.ageBand} onChange={intake.setAgeBand} />
      </div>
    );
  }

  if (tab === "constraints") {
    return (
      <div className="flex flex-col gap-3.5">
        {CONSTRAINT_GROUPS.map((group) => (
          <fieldset key={group.id} className="min-w-0 border-0 p-0">
            <legend className="mb-1.5 p-0">
              <Eyebrow>{group.label}</Eyebrow>
            </legend>
            <p className="m-0 mb-1.5 text-3xs font-semibold text-[color:var(--text-soft)]">{group.help}</p>
            <div className="flex flex-wrap gap-1.5">
              {constraintsIn(group.id).map((constraint) => (
                <Chip
                  key={constraint.key}
                  label={constraint.label}
                  active={intake.active.includes(constraint.key)}
                  inferred={intake.inferred.includes(constraint.key) && !intake.explicit.includes(constraint.key)}
                  disabled={intake.result.emptyingKeys.includes(constraint.key)}
                  onToggle={() => intake.toggleConstraint(constraint.key)}
                />
              ))}
            </div>
          </fieldset>
        ))}
        <InertChipNotice result={intake.result} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <Eyebrow tone="accent">What will be searched</Eyebrow>
          {intake.edited == null ? (
            <GhostButton icon={Pencil} onClick={() => intake.setEdited(intake.composed)}>
              Take over
            </GhostButton>
          ) : (
            <GhostButton icon={Sparkles} onClick={() => intake.setEdited(null)}>
              Rebuild
            </GhostButton>
          )}
        </div>
        {intake.edited == null ? (
          <p className="m-0 mt-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-2.5 text-2xs leading-5 text-[color:var(--text)]">
            {intake.sentence}
          </p>
        ) : (
          <textarea
            aria-label="Clinical situation"
            rows={4}
            value={intake.edited}
            onChange={(event) => intake.setEdited(event.target.value)}
            className={cn(
              "mt-1.5 w-full resize-y rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2 text-2xs leading-5 text-[color:var(--text)]",
              focusRing,
            )}
          />
        )}
        <p className="m-0 mt-1.5 text-3xs font-semibold leading-4 text-[color:var(--text-soft)]">
          {intake.edited == null
            ? "Written from the pickers. Take over to edit it directly, and it stops being rewritten."
            : "Yours now. Rebuild discards your edit and returns to the composed sentence."}
        </p>
      </div>

      <div>
        <Eyebrow>Anything else</Eyebrow>
        <input
          aria-label="Anything else"
          value={intake.extra}
          onChange={(event) => intake.setExtra(event.target.value)}
          placeholder="e.g. declined medication, interpreter needed"
          className={cn(
            "mt-1.5 min-h-12 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-2xs font-semibold text-[color:var(--text)] placeholder:text-[color:var(--text-soft)]",
            focusRing,
          )}
        />
      </div>

      <div>
        <Eyebrow>Constraints in force</Eyebrow>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {intake.active.length ? (
            intake.active.map((key) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-1 text-3xs font-bold text-[color:var(--text-muted)]"
              >
                {labelFor(key)}
                {intake.inferred.includes(key) && !intake.explicit.includes(key) ? (
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
    </div>
  );
}

function Popup({ intake, onClose, phone = false }: { intake: Intake; onClose: () => void; phone?: boolean }) {
  const [tab, setTab] = useState<TabId>("presentation");

  return (
    <>
      <header className="flex shrink-0 items-start gap-2.5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-base font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">
            Clinical situation
          </h2>
          <p className="m-0 mt-0.5 truncate text-3xs font-bold text-[color:var(--text-soft)]">{intake.sentence}</p>
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

      <div
        role="tablist"
        aria-label="Scenario sections"
        className={cn(
          "flex shrink-0 gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-2",
          phone ? "overflow-x-auto" : "",
        )}
      >
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "relative inline-flex min-h-12 shrink-0 items-center gap-1.5 px-2.5 text-2xs font-bold transition",
                active
                  ? "text-[color:var(--clinical-accent)]"
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

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        <TabBody tab={tab} intake={intake} />
      </div>

      <footer className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <ScopeReadout result={intake.result} compact={phone} />
          <PrimaryButton icon={Sparkles} className="ml-auto" onClick={onClose}>
            Rank {intake.result.count}
          </PrimaryButton>
        </div>
        <AdvisoryLine className="mt-2" />
      </footer>
    </>
  );
}

function DesktopScene() {
  const intake = useIntake();
  const [open, setOpen] = useState(true);

  return (
    <DesktopFrame>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <RecommendPageBehind
            situation={intake.sentence}
            activeKeys={intake.active}
            count={intake.result.count}
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
            aria-label="Clinical situation"
            className="relative flex h-full max-h-[33rem] w-full max-w-[42rem] animate-dialog-rise flex-col overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]"
          >
            <Popup intake={intake} onClose={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </DesktopFrame>
  );
}

function PhoneScene({ caption }: { caption: string }) {
  const intake = useIntake();
  const [open, setOpen] = useState(true);

  return (
    <PhoneFrame caption={caption}>
      <TopBar phone />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <RecommendPageBehind
          situation={intake.sentence}
          activeKeys={intake.active}
          count={intake.result.count}
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
            aria-label="Clinical situation"
            className="relative flex max-h-[94%] w-full animate-sheet-up flex-col overflow-hidden rounded-t-[1.25rem] border-t border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]"
          >
            <div className="flex shrink-0 justify-center bg-[color:var(--surface)] pt-2 pb-1">
              <span aria-hidden="true" className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
            </div>
            <Popup intake={intake} onClose={() => setOpen(false)} phone />
          </div>
        </div>
      ) : null}
    </PhoneFrame>
  );
}

export function TherapyScenarioPopupIntakeMockup() {
  return (
    <StudyPage
      eyebrow="Therapy · Recommend scenario · Direction 3"
      title="Structured intake"
      lede="Structured pickers first, free text last. The popup writes the scenario sentence from what you pick and shows it back to you, so what actually gets searched is explicit rather than assumed. Take it over at any point and it stops being rewritten."
      points={[
        {
          label: "Best for",
          body: "Consistent scenarios across clinicians, and for anyone who would rather pick than compose.",
        },
        {
          label: "Live feedback",
          body: "Records-in-scope in the footer, and the composed sentence visible in the header at all times.",
        },
        {
          label: "Trade-off",
          body: "The pickers are an opinion about what matters clinically, and any fixed vocabulary will miss cases.",
        },
      ]}
    >
      <FrameBlock
        label="Desktop"
        size="Dialog 672px wide, capped at 528px tall"
        note="Change the age band or the mechanism and watch the sentence in the header rewrite. Press Take over on the Scenario tab and it stops regenerating, because silently rewriting a clinician's own words would be the wrong behaviour."
      >
        <DesktopScene />
      </FrameBlock>

      <FrameBlock
        label="Phone"
        size="390px viewport, sheet at 94% height"
        note="Three tabs rather than five steps, so the presentation can be corrected without walking back through a sequence."
      >
        <div className="flex flex-wrap gap-6">
          <PhoneScene caption="Phone · Structured intake" />
        </div>
      </FrameBlock>
    </StudyPage>
  );
}
