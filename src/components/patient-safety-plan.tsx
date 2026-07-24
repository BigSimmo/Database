"use client";

import {
  Activity,
  Anchor,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardCopy,
  Heart,
  Users,
  HandHelping,
  Phone,
  PhoneCall,
  Plus,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  cn,
  clinicalDivider,
  eyebrowText,
  fieldLabel,
  fieldControlPlain,
  metadataPill,
  panelSubtle,
  primaryControl,
  toneNeutral,
  toneSuccess,
} from "@/components/ui-primitives";

/*
 * Patient Safety Plan generator — Tools-page clinical tool.
 *
 * A clinician builds an evidence-based safety plan *with* the patient (the
 * Stanley-Brown Safety Planning Intervention, six prioritised steps), and a
 * live patient-facing preview updates as they type — ready to print, save as
 * PDF, or hand over. Working content stays in this mounted browser component;
 * the app neither stores it nor sends it to a server. Copy and print are
 * explicit user-directed exports. Sample content is seeded so the layout reads
 * fully; every field is editable and "Clear all" empties the plan.
 * Australian English + AU crisis resources throughout, per the Clinical KB
 * (en-AU) voice. All chrome is token-driven so light/dark, reduced-motion and
 * forced-colors follow the shared design system.
 */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const softButton = cn(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-sm-minus font-bold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
  focusRing,
);

type StepKind = "list" | "contact";
type StepKey = "warning" | "coping" | "people" | "support" | "professional" | "environment";

type Entry = { id: string; primary: string; secondary?: string };

interface StepDef {
  key: StepKey;
  step: number;
  icon: LucideIcon;
  /** Clinician-facing card title in the builder. */
  builderTitle: string;
  /** Patient-facing, first-person title in the plan. */
  patientTitle: string;
  /** Short guidance for the clinician. */
  helper: string;
  kind: StepKind;
  primaryPlaceholder: string;
  secondaryPlaceholder?: string;
  emptyHint: string;
}

const STEPS: StepDef[] = [
  {
    key: "warning",
    step: 1,
    icon: Activity,
    builderTitle: "Warning signs",
    patientTitle: "Signs a tough time might be building",
    helper: "Thoughts, feelings, images or situations that come up before a crisis.",
    kind: "list",
    primaryPlaceholder: "e.g. Not sleeping for a couple of nights",
    emptyHint: "We’ll list these together.",
  },
  {
    key: "coping",
    step: 2,
    icon: Anchor,
    builderTitle: "Things I can do on my own",
    patientTitle: "Things I can do on my own to settle",
    helper: "Internal coping strategies — no one else needed. Grounding, movement, distraction.",
    kind: "list",
    primaryPlaceholder: "e.g. Slow breathing — 4 in, 6 out",
    emptyHint: "Add a few calming strategies.",
  },
  {
    key: "people",
    step: 3,
    icon: Users,
    builderTitle: "People & places that help me feel calm",
    patientTitle: "People and places that take my mind off things",
    helper: "Social settings and company that distract — not for asking for help yet.",
    kind: "list",
    primaryPlaceholder: "e.g. Sit in the local library",
    emptyHint: "Add people or places that help.",
  },
  {
    key: "support",
    step: 4,
    icon: HandHelping,
    builderTitle: "People I can ask for help",
    patientTitle: "People I can reach out to for support",
    helper: "Trusted people the patient would talk to when struggling. Add how to reach them.",
    kind: "contact",
    primaryPlaceholder: "Name & relationship",
    secondaryPlaceholder: "Phone or how to reach them",
    emptyHint: "Add at least one trusted person.",
  },
  {
    key: "professional",
    step: 5,
    icon: Stethoscope,
    builderTitle: "Professionals & crisis lines",
    patientTitle: "Professionals and services I can call",
    helper: "Clinician, crisis team and 24/7 lines. Confirm the numbers for your service.",
    kind: "contact",
    primaryPlaceholder: "Service or clinician",
    secondaryPlaceholder: "Phone / hours",
    emptyHint: "Add clinical contacts and a 24/7 line.",
  },
  {
    key: "environment",
    step: 6,
    icon: ShieldCheck,
    builderTitle: "Making my space safer",
    patientTitle: "Making my space safer",
    helper: "Means-safety steps — put time and distance between the patient and anything harmful.",
    kind: "list",
    primaryPlaceholder: "e.g. A friend holds my medication",
    emptyHint: "Agree practical means-safety steps.",
  },
];

const SEED: Record<StepKey, Entry[]> = {
  warning: [
    { id: "w1", primary: "Not sleeping for a couple of nights" },
    { id: "w2", primary: "Withdrawing from friends and letting messages pile up" },
    { id: "w3", primary: "Thoughts that people would be better off without me" },
    { id: "w4", primary: "Drinking more than usual" },
  ],
  coping: [
    { id: "c1", primary: "Walk around the block with music on" },
    { id: "c2", primary: "Cold water on my face, then slow breathing (4 in, 6 out)" },
    { id: "c3", primary: "Make a cup of tea and step out into the garden" },
  ],
  people: [
    { id: "p1", primary: "Text my sister and sit with her" },
    { id: "p2", primary: "Take Biscuit to the dog park" },
    { id: "p3", primary: "Work in the local library where it’s quiet" },
  ],
  support: [
    { id: "s1", primary: "Priya — my sister", secondary: "0400 000 000" },
    { id: "s2", primary: "Jordan — close friend", secondary: "0400 111 222" },
  ],
  professional: [
    { id: "pr1", primary: "Dr Nguyen — GP", secondary: "Rosewood Clinic · (02) 0000 0000" },
    { id: "pr2", primary: "Community mental health crisis team", secondary: "1800 000 000 · 24/7" },
    { id: "pr3", primary: "Lifeline", secondary: "13 11 14 · 24/7" },
  ],
  environment: [
    { id: "e1", primary: "Priya keeps my medication and hands it out weekly" },
    { id: "e2", primary: "Leave anything I could misuse with a mate for now" },
    { id: "e3", primary: "Skip alcohol on the days I’m feeling low" },
  ],
};

const SEED_REASONS: Entry[] = [
  { id: "r1", primary: "My dog, Biscuit" },
  { id: "r2", primary: "Finishing my apprenticeship" },
  { id: "r3", primary: "The camping trip with mates in spring" },
  { id: "r4", primary: "Being there for my niece" },
];

// Production default: a fresh plan starts blank so no sample/placeholder content
// (including the non-working example crisis numbers) can reach a printed handover.
// "Load example" restores the SEED content on demand for demos and training.
const EMPTY_ENTRIES: Record<StepKey, Entry[]> = {
  warning: [],
  coping: [],
  people: [],
  support: [],
  professional: [],
  environment: [],
};

/* ---------- small building blocks ---------- */

function AddRow({
  kind,
  primaryPlaceholder,
  secondaryPlaceholder,
  onAdd,
}: {
  kind: StepKind;
  primaryPlaceholder: string;
  secondaryPlaceholder?: string;
  onAdd: (primary: string, secondary?: string) => void;
}) {
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");

  const submit = () => {
    const trimmed = primary.trim();
    if (!trimmed) return;
    onAdd(trimmed, secondary.trim() || undefined);
    setPrimary("");
    setSecondary("");
  };

  return (
    <div className={cn("grid gap-2", kind === "contact" && "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]")}>
      <input
        value={primary}
        onChange={(event) => setPrimary(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={primaryPlaceholder}
        aria-label={primaryPlaceholder}
        className={cn(fieldControlPlain, "min-h-10")}
      />
      {kind === "contact" ? (
        <input
          value={secondary}
          onChange={(event) => setSecondary(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={secondaryPlaceholder}
          aria-label={secondaryPlaceholder}
          className={cn(fieldControlPlain, "min-h-10")}
        />
      ) : null}
      <button
        type="button"
        onClick={submit}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-3 text-sm-minus font-bold text-[color:var(--text-muted)] transition hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)]",
          kind === "list" && "justify-self-start",
          focusRing,
        )}
      >
        <Plus className="size-icon-sm" aria-hidden="true" />
        Add
      </button>
    </div>
  );
}

function EntryChip({ entry, kind, onRemove }: { entry: Entry; kind: StepKind; onRemove: () => void }) {
  return (
    <li
      className={cn(
        "group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 shadow-[var(--shadow-inset)]",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm-minus font-semibold leading-5 text-[color:var(--text-heading)]">{entry.primary}</p>
        {kind === "contact" && entry.secondary ? (
          <p className="mt-0.5 inline-flex items-center gap-1 font-mono text-2xs font-bold tabular-nums text-[color:var(--clinical-accent)]">
            <Phone className="size-icon-xs" aria-hidden="true" />
            {entry.secondary}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove “${entry.primary}”`}
        className={cn(
          "grid size-7 place-items-center rounded-md text-[color:var(--text-soft)] transition hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger)]",
          focusRing,
        )}
      >
        <X className="size-icon-sm" aria-hidden="true" />
      </button>
    </li>
  );
}

function StepBuilderCard({
  def,
  entries,
  onAdd,
  onRemove,
}: {
  def: StepDef;
  entries: Entry[];
  onAdd: (primary: string, secondary?: string) => void;
  onRemove: (id: string) => void;
}) {
  const Icon = def.icon;
  const filled = entries.length > 0;

  return (
    <section
      className={cn(panelSubtle, "grid content-start gap-3 p-4")}
      aria-label={`Step ${def.step}: ${def.builderTitle}`}
    >
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <Icon className="size-icon-md" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xs font-bold tabular-nums text-[color:var(--text-soft)]">
              Step {def.step}
            </span>
            {filled ? (
              <span
                className={cn(
                  "inline-flex size-4 place-items-center items-center justify-center rounded-full text-[color:var(--success)]",
                )}
                aria-hidden="true"
              >
                <CheckCheck className="size-icon-xs" aria-hidden="true" />
              </span>
            ) : null}
          </div>
          <h3 className="text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">{def.builderTitle}</h3>
          <p className="mt-0.5 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">{def.helper}</p>
        </div>
        <span className={cn(metadataPill, "shrink-0 tabular-nums")}>{entries.length}</span>
      </header>

      {entries.length ? (
        <ul className="grid gap-1.5">
          {entries.map((entry) => (
            <EntryChip key={entry.id} entry={entry} kind={def.kind} onRemove={() => onRemove(entry.id)} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] px-3 py-2 text-2xs font-semibold text-[color:var(--text-soft)]">
          {def.emptyHint}
        </p>
      )}

      <AddRow
        kind={def.kind}
        primaryPlaceholder={def.primaryPlaceholder}
        secondaryPlaceholder={def.secondaryPlaceholder}
        onAdd={onAdd}
      />
    </section>
  );
}

/* ---------- patient-facing preview ---------- */

function PreviewStep({ def, entries }: { def: StepDef; entries: Entry[] }) {
  const Icon = def.icon;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] font-mono text-sm font-extrabold tabular-nums text-[color:var(--clinical-accent)]">
        {def.step}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden="true" />
          <h3 className="text-sm-minus font-extrabold leading-5 text-[color:var(--text-heading)]">
            {def.patientTitle}
          </h3>
        </div>
        {entries.length ? (
          <ul className="mt-1.5 grid gap-1">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-sm-minus leading-5 text-[color:var(--text)]"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-[color:var(--clinical-accent)]"
                />
                <span className="min-w-0 font-medium">
                  {entry.primary}
                  {def.kind === "contact" && entry.secondary ? (
                    <span className="ml-1.5 font-mono text-2xs font-bold tabular-nums text-[color:var(--clinical-accent)]">
                      {entry.secondary}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-2xs font-semibold italic leading-4 text-[color:var(--text-soft)]">
            To be completed together.
          </p>
        )}
      </div>
    </li>
  );
}

/* ---------- root ---------- */

export function PatientSafetyPlan() {
  const [entries, setEntries] = useState<Record<StepKey, Entry[]>>(EMPTY_ENTRIES);
  const [reasons, setReasons] = useState<Entry[]>([]);
  const [planDate, setPlanDate] = useState("");
  const [mobileTab, setMobileTab] = useState<"build" | "preview">("build");
  const [copied, setCopied] = useState(false);
  const [finalised, setFinalised] = useState(false);

  // Per-instance id counter — avoids a module-level mutable that would persist
  // across remounts; ids only need to be unique within this mounted plan.
  const uidRef = useRef(0);
  const uid = useCallback((prefix: string) => `${prefix}-live-${uidRef.current++}`, []);

  const addEntry = useCallback(
    (key: StepKey, primary: string, secondary?: string) => {
      setEntries((prev) => ({ ...prev, [key]: [...prev[key], { id: uid(key), primary, secondary }] }));
      setFinalised(false);
    },
    [uid],
  );

  const removeEntry = useCallback((key: StepKey, id: string) => {
    setEntries((prev) => ({ ...prev, [key]: prev[key].filter((entry) => entry.id !== id) }));
    setFinalised(false);
  }, []);

  const filledSteps = useMemo(() => STEPS.filter((step) => entries[step.key].length > 0).length, [entries]);
  const ready = filledSteps === STEPS.length;

  const planText = useMemo(() => {
    const lines: string[] = [
      "MY SAFETY PLAN",
      "Name (add after export): ____________________",
      planDate ? `Date: ${planDate}` : "",
      "",
    ];
    for (const step of STEPS) {
      lines.push(`${step.step}. ${step.patientTitle}`);
      const rows = entries[step.key];
      if (rows.length) {
        for (const row of rows) lines.push(`   • ${row.primary}${row.secondary ? ` — ${row.secondary}` : ""}`);
      } else {
        lines.push("   • (to be completed)");
      }
      lines.push("");
    }
    if (reasons.length) {
      lines.push("MY REASONS FOR LIVING");
      for (const reason of reasons) lines.push(`   • ${reason.primary}`);
      lines.push("");
    }
    lines.push("In an emergency: call 000 or go to your nearest Emergency Department.");
    lines.push("24/7 support: Lifeline 13 11 14 · Suicide Call Back Service 1300 659 467.");
    return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n");
  }, [entries, planDate, reasons]);

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(planText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable in some embeds — safe no-op */
    }
  };

  const printPlan = () => {
    if (typeof window !== "undefined") window.print();
  };

  const loadExample = () => {
    const hasContent =
      Object.values(entries).some((rows) => rows.length > 0) || reasons.length > 0 || planDate.trim() !== "";
    if (hasContent && !window.confirm("Replace the current plan with the example content?")) return;
    setEntries(SEED);
    setReasons(SEED_REASONS);
    // Clear the plan date so example content cannot look like a current handover.
    setPlanDate("");
    setFinalised(false);
  };

  const clearAll = () => {
    setEntries(EMPTY_ENTRIES);
    setReasons([]);
    setPlanDate("");
    setFinalised(false);
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        "safety-plan-tool min-w-0 bg-[color:var(--background)] text-[color:var(--text)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]",
      )}
    >
      {/* Tool header */}
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
            <span className="grid size-tap shrink-0 place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
              <ShieldCheck className="size-icon-lg" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className={eyebrowText}>Clinical KB · Clinical tool</p>
              <h1 className="mt-0.5 text-2xl-minus font-extrabold leading-tight text-[color:var(--text-heading)]">
                Safety plan generator
              </h1>
              <p className="mt-1 max-w-xl text-sm-minus font-medium leading-5 text-[color:var(--text-muted)]">
                Build an identifier-free safety plan <em>with</em> your patient — the six prioritised steps — then
                export it through your approved clinical workflow.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <div className="grid gap-1">
              <span className={cn(eyebrowText, "leading-none")}>Plan progress</span>
              <div className="flex items-center gap-2">
                <div className="flex gap-1" role="img" aria-label={`${filledSteps} of ${STEPS.length} steps complete`}>
                  {STEPS.map((step) => (
                    <span
                      key={step.key}
                      className={cn(
                        "h-1.5 w-6 rounded-full transition-colors",
                        entries[step.key].length
                          ? "bg-[color:var(--clinical-accent)]"
                          : "bg-[color:var(--surface-inset)] ring-1 ring-inset ring-[color:var(--border)]",
                      )}
                    />
                  ))}
                </div>
                <span
                  className={cn(
                    "inline-flex min-h-6 items-center gap-1 rounded-md border px-2 text-2xs font-bold",
                    ready ? toneSuccess : toneNeutral,
                  )}
                >
                  {ready ? "Ready to share" : `${filledSteps}/${STEPS.length} steps`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFinalised(true)}
              disabled={!ready}
              className={cn(primaryControl, "min-h-tap disabled:opacity-50")}
            >
              {finalised ? (
                <Check className="size-icon-md" aria-hidden="true" />
              ) : (
                <Sparkles className="size-icon-md" aria-hidden="true" />
              )}
              {finalised ? "Plan finalised" : "Finalise plan"}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile pane switch */}
      <div data-print-hide className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:hidden">
        <div
          role="tablist"
          aria-label="Safety plan view"
          className="grid grid-cols-2 gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1"
        >
          {(["build", "preview"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              type="button"
              id={`spg-tab-${tab}`}
              aria-selected={mobileTab === tab}
              aria-controls={`spg-panel-${tab}`}
              onClick={() => setMobileTab(tab)}
              className={cn(
                "min-h-10 rounded-md px-3 text-sm-minus font-bold transition",
                mobileTab === tab
                  ? "bg-[color:var(--surface)] text-[color:var(--text-heading)] shadow-[var(--shadow-tight)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                focusRing,
              )}
            >
              {tab === "build" ? "Build" : "Plan preview"}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:items-start lg:px-8">
        {/* ---------- Builder ---------- */}
        <div
          id="spg-panel-build"
          data-print-hide
          role="tabpanel"
          aria-labelledby="spg-tab-build"
          className={cn("min-w-0 grid content-start gap-4", mobileTab === "build" ? "grid" : "hidden", "lg:grid")}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
              Build the plan
            </h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={loadExample} className={softButton}>
                <Sparkles className="size-icon-sm" aria-hidden="true" />
                Load example
              </button>
              <button type="button" onClick={clearAll} className={softButton}>
                <RotateCcw className="size-icon-sm" aria-hidden="true" />
                Clear all
              </button>
            </div>
          </div>

          {/* Local-only working boundary */}
          <section className={cn(panelSubtle, "grid gap-3 p-4")} aria-label="Safety plan privacy">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
              <ShieldCheck className="mt-0.5 size-icon-md text-[color:var(--clinical-accent)]" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">
                  Keep this plan identifier-free
                </h2>
                <p className="mt-1 text-2xs font-medium leading-5 text-[color:var(--text-muted)]">
                  Do not enter the patient&apos;s name, date of birth, or record number. Enter only the minimum plan
                  details and support contacts needed. Working content is kept only in this browser tab; Clinical KB
                  does not save it or send it to a server.
                </p>
              </div>
            </div>
            <div>
              <label htmlFor="spg-date" className={fieldLabel}>
                Plan date (optional)
              </label>
              <input
                id="spg-date"
                value={planDate}
                onChange={(event) => {
                  setPlanDate(event.target.value);
                  setFinalised(false);
                }}
                placeholder="e.g. 12 Aug 2026"
                className={fieldControlPlain}
              />
            </div>
          </section>

          {STEPS.map((def) => (
            <StepBuilderCard
              key={def.key}
              def={def}
              entries={entries[def.key]}
              onAdd={(primary, secondary) => addEntry(def.key, primary, secondary)}
              onRemove={(id) => removeEntry(def.key, id)}
            />
          ))}

          {/* Reasons for living */}
          <section
            className="grid content-start gap-3 rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] p-4"
            aria-label="Reasons for living"
          >
            <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-chat-sand-border-strong)] bg-[color:var(--surface)] text-[color:var(--warning)]">
                <Heart className="size-icon-md" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">
                  Reasons for living
                </h3>
                <p className="mt-0.5 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
                  The people, plans and things that matter — worth coming back to.
                </p>
              </div>
              <span className={cn(metadataPill, "shrink-0 tabular-nums")}>{reasons.length}</span>
            </header>
            {reasons.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {reasons.map((reason) => (
                  <li
                    key={reason.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--clinical-chat-sand-border-strong)] bg-[color:var(--surface)] py-1 pl-3 pr-1.5 text-sm-minus font-semibold text-[color:var(--text-heading)]"
                  >
                    {reason.primary}
                    <button
                      type="button"
                      onClick={() => {
                        setReasons((prev) => prev.filter((item) => item.id !== reason.id));
                        setFinalised(false);
                      }}
                      aria-label={`Remove “${reason.primary}”`}
                      className={cn(
                        "grid size-5 place-items-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger)]",
                        focusRing,
                      )}
                    >
                      <X className="size-icon-xs" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <AddRow
              kind="list"
              primaryPlaceholder="e.g. Finishing my apprenticeship"
              onAdd={(primary) => {
                setReasons((prev) => [...prev, { id: uid("reason"), primary }]);
                setFinalised(false);
              }}
            />
          </section>
        </div>

        {/* ---------- Preview ---------- */}
        <div
          id="spg-panel-preview"
          data-safety-plan-copy
          role="tabpanel"
          aria-labelledby="spg-tab-preview"
          className={cn(
            "min-w-0",
            mobileTab === "preview" ? "block" : "hidden",
            "lg:block lg:sticky lg:top-6 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1",
          )}
        >
          {/* Preview toolbar */}
          <div data-print-hide className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
              Patient copy
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={copyPlan} className={softButton}>
                {copied ? (
                  <CheckCheck className="size-icon-sm text-[color:var(--success)]" aria-hidden="true" />
                ) : (
                  <ClipboardCopy className="size-icon-sm" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={printPlan} className={softButton}>
                <Printer className="size-icon-sm" aria-hidden="true" />
                Print / PDF
              </button>
            </div>
          </div>

          <p
            data-print-hide
            className="mb-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-2xs font-semibold leading-5 text-[color:var(--text-muted)]"
          >
            Copying, printing, or saving a PDF moves the plan outside Clinical KB. Add any patient identifier only after
            export, using your organisation&apos;s approved clinical record and handling process.
          </p>

          {finalised ? (
            <div
              role="status"
              data-print-hide
              className={cn(
                "mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm-minus font-bold",
                toneSuccess,
              )}
            >
              <Check className="size-icon-md shrink-0" aria-hidden="true" />
              Plan finalised — print it or hand a copy to your patient before they leave.
            </div>
          ) : null}

          {/* The plan document */}
          <article className="grid content-start gap-5 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-lux)] sm:p-6">
            <header className="grid gap-2 border-b border-[color:var(--border)] pb-4">
              <div className="flex items-center gap-2 text-[color:var(--clinical-accent)]">
                <Heart className="size-icon-md" aria-hidden="true" />
                <span className={cn(eyebrowText, "text-[color:var(--clinical-accent)]")}>My safety plan</span>
              </div>
              <h2 className="text-2xl-minus font-extrabold leading-tight text-[color:var(--text-heading)]">
                Keeping myself safe
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-2xs font-semibold tabular-nums text-[color:var(--text-muted)]">
                <span>Name (add after printing): ________________</span>
                <span>{planDate ? planDate : "Date: ____________"}</span>
              </div>
              <p className="mt-1 text-sm-minus font-medium leading-5 text-[color:var(--text-muted)]">
                When things get hard or I’m having thoughts of suicide, I’ll work through these steps in order. I can
                start anywhere — even one step can help.
              </p>
            </header>

            <ol className="grid gap-4">
              {STEPS.map((def) => (
                <PreviewStep key={def.key} def={def} entries={entries[def.key]} />
              ))}
            </ol>

            {reasons.length ? (
              <div className="grid gap-2 rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] p-4">
                <div className="flex items-center gap-1.5 text-[color:var(--warning)]">
                  <Heart className="size-icon-sm" aria-hidden="true" />
                  <span className={cn(eyebrowText, "text-[color:var(--warning)]")}>My reasons for living</span>
                </div>
                <p className="text-sm-minus font-semibold leading-5 text-[color:var(--text-heading)]">
                  {reasons.map((reason) => reason.primary).join(" · ")}
                </p>
              </div>
            ) : null}

            {/* Emergency escalation */}
            <div className="grid gap-3 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-4">
              <div className="flex items-center gap-1.5 text-[color:var(--clinical-accent-hover)]">
                <PhoneCall className="size-icon-sm" aria-hidden="true" />
                <span className={cn(eyebrowText, "text-[color:var(--clinical-accent-hover)]")}>
                  If I’m not safe right now
                </span>
              </div>
              <a
                href="tel:000"
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg bg-[color:var(--clinical-accent)] px-4 py-3 text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--clinical-accent-hover)]",
                  focusRing,
                )}
              >
                <Phone className="size-icon-lg" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-lg-minus font-extrabold leading-tight">Call 000</span>
                  <span className="block text-2xs font-semibold opacity-90">
                    or go to my nearest Emergency Department
                  </span>
                </span>
              </a>
              <p className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-sm-minus font-semibold text-[color:var(--text-heading)]">
                <PhoneCall className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden="true" />
                <span>
                  24/7 support — <span className="font-extrabold">Lifeline 13 11 14</span> · Suicide Call Back Service
                  1300 659 467
                </span>
              </p>
            </div>

            <footer className={cn("grid gap-1 pt-1", clinicalDivider, "border-t pt-3")}>
              <p className="font-mono text-3xs font-semibold leading-4 text-[color:var(--text-soft)]">
                Based on the Stanley–Brown Safety Planning Intervention (Stanley &amp; Brown, 2012).
              </p>
              <p className="text-3xs font-medium leading-4 text-[color:var(--text-soft)]">
                A supportive plan built collaboratively — not a substitute for clinical risk assessment. Confirm crisis
                numbers for your local service.
              </p>
            </footer>
          </article>

          <p
            data-print-hide
            className="mt-3 flex items-center gap-1.5 px-1 text-2xs font-semibold text-[color:var(--text-soft)]"
          >
            <ChevronRight className="size-icon-xs text-[color:var(--clinical-accent)]" aria-hidden="true" />
            Confirm every contact and crisis number before export, then handle the copy under your approved clinical
            record process.
          </p>
        </div>
      </div>
    </main>
  );
}
