"use client";

import { Check, Clock, Scale, Search, ShieldAlert, Target, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Shared vocabulary for the three Therapy-comparison picker directions.
 * Design-scratch only: this directory 404s in production.
 *
 * The subject is the phone selection experience on /therapy-compass/compare,
 * not the comparison table itself. Every direction below answers the same
 * six defects listed in `currentDefects`.
 * ------------------------------------------------------------------ */

export type Device = "phone";

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/** `THERAPY_MAX_COMPARE` in `src/lib/therapy-compass-navigation.ts`. */
export const MAX_COMPARE = 4;
/** `src/data/therapies-index.json` — 205 records across 16 categories. */
export const THERAPY_COUNT = 205;
export const CATEGORY_COUNT = 16;

export type TherapyFixture = {
  slug: string;
  name: string;
  short: string;
  category: string;
  /** Placeholder comparison copy — structural, never a clinical claim. */
  fit: string;
  time: string;
  complexity: string;
  caution: string;
};

/**
 * Ten real catalogue records with placeholder comparison copy. Every record in
 * the shipped catalogue is `needs_review`, so every card here says so too.
 */
export const THERAPIES: TherapyFixture[] = [
  {
    slug: "cognitive-behavioural-therapy-cbt",
    name: "Cognitive Behavioural Therapy (CBT)",
    short: "CBT",
    category: "Standard Talking Therapies",
    fit: "Structured, present-focused work across depression and the anxiety spectrum.",
    time: "12–20 sessions · 50 min",
    complexity: "Trained therapist",
    caution: "Source review required — open the record.",
  },
  {
    slug: "acceptance-and-commitment-therapy-act",
    name: "Acceptance and Commitment Therapy (ACT)",
    short: "ACT",
    category: "Standard Talking Therapies",
    fit: "Avoidance and fusion prominent; values-led behaviour change.",
    time: "8–16 sessions · 50 min",
    complexity: "Trained therapist",
    caution: "Source review required — open the record.",
  },
  {
    slug: "behavioural-activation-ba",
    name: "Behavioural Activation (BA)",
    short: "BA",
    category: "Standard Talking Therapies",
    fit: "Depression with marked withdrawal and loss of routine.",
    time: "8–12 sessions · 30–50 min",
    complexity: "Can be delivered by trained non-specialists",
    caution: "Source review required — open the record.",
  },
  {
    slug: "dialectical-behaviour-therapy-dbt",
    name: "Dialectical Behaviour Therapy (DBT)",
    short: "DBT",
    category: "Personality Disorder Therapies",
    fit: "Recurrent self-harm and emotion dysregulation; programme-based.",
    time: "6–12 months · programme",
    complexity: "Full team and supervision",
    caution: "Source review required — open the record.",
  },
  {
    slug: "mentalisation-based-treatment-mbt",
    name: "Mentalisation-Based Treatment (MBT)",
    short: "MBT",
    category: "Personality Disorder Therapies",
    fit: "Interpersonal instability where mentalising collapses under arousal.",
    time: "12–18 months · programme",
    complexity: "Full team and supervision",
    caution: "Source review required — open the record.",
  },
  {
    slug: "eye-movement-desensitisation-and-reprocessing-emdr",
    name: "Eye Movement Desensitisation and Reprocessing (EMDR)",
    short: "EMDR",
    category: "Trauma Therapies",
    fit: "Single-incident and complex trauma presentations.",
    time: "8–12 sessions · 60–90 min",
    complexity: "Accredited training required",
    caution: "Source review required — open the record.",
  },
  {
    slug: "cognitive-processing-therapy-cpt",
    name: "Cognitive Processing Therapy (CPT)",
    short: "CPT",
    category: "Trauma Therapies",
    fit: "PTSD with prominent stuck points and appraisal distortion.",
    time: "12 sessions · 60 min",
    complexity: "Accredited training required",
    caution: "Source review required — open the record.",
  },
  {
    slug: "interpersonal-psychotherapy-ipt",
    name: "Interpersonal Psychotherapy (IPT)",
    short: "IPT",
    category: "Standard Talking Therapies",
    fit: "Depression framed around role transition, grief or dispute.",
    time: "12–16 sessions · 50 min",
    complexity: "Trained therapist",
    caution: "Source review required — open the record.",
  },
  {
    slug: "exposure-and-response-prevention-erp",
    name: "Exposure and Response Prevention (ERP)",
    short: "ERP",
    category: "OCD & Exposure Therapies",
    fit: "OCD with identifiable compulsions and avoidance hierarchy.",
    time: "12–20 sessions · 60–90 min",
    complexity: "Trained therapist",
    caution: "Source review required — open the record.",
  },
  {
    slug: "motivational-interviewing-mi",
    name: "Motivational Interviewing (MI)",
    short: "MI",
    category: "Substance Use Therapies",
    fit: "Ambivalence about change; often a front end to other therapy.",
    time: "1–4 sessions · 20–50 min",
    complexity: "Can be delivered by trained non-specialists",
    caution: "Source review required — open the record.",
  },
];

export const CATEGORY_FILTERS = [
  "All",
  "Standard Talking Therapies",
  "Trauma Therapies",
  "Personality Disorder Therapies",
  "OCD & Exposure Therapies",
  "Substance Use Therapies",
];

export const SLOT_LETTERS = ["A", "B", "C", "D"];

export function bySlug(slug: string): TherapyFixture | undefined {
  return THERAPIES.find((therapy) => therapy.slug === slug);
}

/* -- Shared selection state -------------------------------------------- */

export function useCompareSet(initial: string[] = []) {
  const [selected, setSelected] = useState<string[]>(initial);

  const add = useCallback((slug: string) => {
    setSelected((current) => (current.includes(slug) || current.length >= MAX_COMPARE ? current : [...current, slug]));
  }, []);

  const remove = useCallback((slug: string) => {
    setSelected((current) => current.filter((entry) => entry !== slug));
  }, []);

  const toggle = useCallback((slug: string) => {
    setSelected((current) => {
      if (current.includes(slug)) return current.filter((entry) => entry !== slug);
      return current.length >= MAX_COMPARE ? current : [...current, slug];
    });
  }, []);

  const clear = useCallback(() => setSelected([]), []);
  const reset = useCallback(() => setSelected(initial), [initial]);

  const items = useMemo(
    () => selected.map((slug) => bySlug(slug)).filter((entry): entry is TherapyFixture => Boolean(entry)),
    [selected],
  );

  return { selected, items, add, remove, toggle, clear, reset, setSelected, full: selected.length >= MAX_COMPARE };
}

/* -- Search ------------------------------------------------------------- */

export function filterTherapies(query: string, category: string): TherapyFixture[] {
  const needle = query.trim().toLowerCase();
  return THERAPIES.filter((therapy) => {
    if (category !== "All" && therapy.category !== category) return false;
    if (!needle) return true;
    return (
      therapy.name.toLowerCase().includes(needle) ||
      therapy.short.toLowerCase().includes(needle) ||
      therapy.category.toLowerCase().includes(needle)
    );
  });
}

/* -- Phone chrome ------------------------------------------------------- */

/** The universal phone header the compare screen sits under, drawn to scale. */
export function PhoneTopBar({ title = "Therapy" }: { title?: string }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color:var(--text-heading)] text-3xs font-black tracking-tight text-[color:var(--surface)]">
        KB
      </span>
      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--text)]">
        <Scale aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" />
        {title}
      </span>
      <span
        aria-hidden="true"
        className="ml-auto h-7 w-7 shrink-0 rounded-full bg-[color:var(--clinical-accent-soft)]"
      />
    </div>
  );
}

/** The edge-to-edge phone search composer every mode page has to live above. */
export function PhoneComposer() {
  return (
    <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 pb-3 pt-2.5">
      <div className="flex h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
        <span className="text-xs text-[color:var(--text-muted)]">Search therapies…</span>
      </div>
    </div>
  );
}

/** A phone viewport at true proportion (390 × 780), with its state called out. */
export function PhoneFrame({
  label,
  note,
  children,
  tall = false,
}: {
  label: string;
  note?: string;
  children: ReactNode;
  tall?: boolean;
}) {
  return (
    <figure className="m-0 min-w-0 max-w-full" style={{ width: "390px" }}>
      <figcaption className="mb-2 text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-soft)]">
        {label}
      </figcaption>
      <div
        className="relative flex flex-col overflow-hidden bg-[color:var(--background)] shadow-[var(--shadow-soft)]"
        style={{
          height: tall ? "46rem" : "42rem",
          borderRadius: "1.6rem",
          border: "6px solid var(--text-heading)",
        }}
      >
        {children}
      </div>
      {note ? <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">{note}</p> : null}
    </figure>
  );
}

/* -- Reusable pieces every direction shares ----------------------------- */

export function ReviewPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--warning-bg)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--warning-text)]">
      <ShieldAlert aria-hidden="true" className="h-3 w-3" />
      Needs review
    </span>
  );
}

export function SlotBadge({ index, muted = false }: { index: number; muted?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black",
        muted
          ? "border border-dashed border-[color:var(--border-strong)] text-[color:var(--text-muted)]"
          : index === 0
            ? "bg-[color:var(--clinical-accent)] text-[color:var(--command-contrast)]"
            : index === 1
              ? "bg-[color:var(--info)] text-[color:var(--command-contrast)]"
              : "bg-[color:var(--text-muted)] text-[color:var(--command-contrast)]",
      )}
    >
      {SLOT_LETTERS[index] ?? index + 1}
    </span>
  );
}

/**
 * The payoff, drawn the same way in all three directions: a per-field stack,
 * not the shipped 720 px-minimum table that a phone can only scroll sideways.
 */
const PREVIEW_ROWS: Array<{
  key: string;
  label: string;
  icon: LucideIcon;
  warn?: boolean;
  get: (t: TherapyFixture) => string;
}> = [
  { key: "caution", label: "When not to use", icon: TriangleAlert, warn: true, get: (t) => t.caution },
  { key: "fit", label: "Best fit", icon: Target, get: (t) => t.fit },
  { key: "time", label: "Time required", icon: Clock, get: (t) => t.time },
  { key: "complexity", label: "Clinician skill", icon: Scale, get: (t) => t.complexity },
];

export function ComparisonPreview({ items }: { items: readonly TherapyFixture[] }) {
  if (items.length < 2) return null;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-[color:var(--text-heading)]">
          {items.map((item) => item.short).join(" vs ")}
        </h3>
        <span className="text-3xs font-bold text-[color:var(--text-muted)]">{items.length} compared</span>
      </div>
      {PREVIEW_ROWS.map((row) => (
        <div
          key={row.key}
          className={cn(
            "rounded-xl border p-3",
            row.warn
              ? "border-[color:var(--border-strong)] bg-[color:var(--warning-bg)]"
              : "border-[color:var(--border)] bg-[color:var(--surface)]",
          )}
        >
          <p
            className={cn(
              "flex items-center gap-1.5 text-3xs font-black uppercase tracking-eyebrow",
              row.warn ? "text-[color:var(--warning-text)]" : "text-[color:var(--text-muted)]",
            )}
          >
            <row.icon aria-hidden="true" className="h-3.5 w-3.5" />
            {row.label}
          </p>
          <dl className="mt-2 space-y-1.5">
            {items.map((item, index) => (
              <div key={item.slug} className="grid gap-2" style={{ gridTemplateColumns: "3.2rem minmax(0, 1fr)" }}>
                <dt className="flex items-center gap-1 text-3xs font-black text-[color:var(--text-heading)]">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      index === 0
                        ? "bg-[color:var(--clinical-accent)]"
                        : index === 1
                          ? "bg-[color:var(--info)]"
                          : "bg-[color:var(--text-muted)]",
                    )}
                  />
                  {item.short}
                </dt>
                <dd
                  className={cn(
                    "text-xs leading-5",
                    row.warn ? "text-[color:var(--warning-text)]" : "text-[color:var(--text)]",
                  )}
                >
                  {row.get(item)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export function AddedToast({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <div
      className="pointer-events-none absolute z-30 flex justify-center"
      style={{ bottom: "6rem", left: "1rem", right: "1rem" }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--text-heading)] px-3 py-1.5 text-xs font-bold text-[color:var(--surface)] shadow-[var(--shadow-soft)]">
        <Check aria-hidden="true" className="h-3.5 w-3.5" />
        {label}
      </span>
    </div>
  );
}

/* -- Page furniture ----------------------------------------------------- */

export function NoteCard({
  title,
  body,
  tone = "plain",
}: {
  title: string;
  body: string;
  tone?: "plain" | "accent" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "accent"
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/30"
          : tone === "warn"
            ? "border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)]"
            : "border-[color:var(--border)] bg-[color:var(--surface)]",
      )}
    >
      <p className="text-xs font-bold text-[color:var(--text-heading)]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{body}</p>
    </div>
  );
}

export function MockupSection({
  id,
  title,
  intro,
  children,
  divider = true,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
  divider?: boolean;
}) {
  return (
    <section aria-labelledby={id} className={cn("mt-10", divider && "border-t border-[color:var(--border)] pt-8")}>
      <h2 id={id} className="text-lg font-semibold text-[color:var(--text-heading)]">
        {title}
      </h2>
      {intro ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">{intro}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const directions = [
  {
    slug: "therapy-compare-progressive",
    letter: "A",
    name: "Add as you go",
    tagline: "No empty slots. One button, then a row per therapy you actually chose.",
  },
  {
    slug: "therapy-compare-sheet",
    letter: "B",
    name: "Build the set in one sheet",
    tagline: "Pick everything in a single full-screen pass, then land on the comparison.",
  },
  {
    slug: "therapy-compare-tray",
    letter: "C",
    name: "Carry a compare tray",
    tagline: "Selection lives in a bottom tray you fill from anywhere, never in the page.",
  },
];

function DirectionSwitcher({ current }: { current: string }) {
  return (
    <nav aria-label="Comparison picker directions" className="mt-6 grid gap-2 sm:grid-cols-3">
      {directions.map((direction) => {
        const active = direction.slug === current;
        return (
          <Link
            key={direction.slug}
            href={`/mockups/${direction.slug}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block rounded-xl border p-3 transition",
              focusRing,
              active
                ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)]",
            )}
          >
            <p className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
              Direction {direction.letter}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[color:var(--text-heading)]">{direction.name}</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{direction.tagline}</p>
          </Link>
        );
      })}
    </nav>
  );
}

export function MockupShell({
  current,
  letter,
  name,
  headline,
  intro,
  children,
}: {
  current: string;
  letter: string;
  name: string;
  headline: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-12 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-8 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
            Therapy comparison · phone picker · Direction {letter} · {name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            {headline}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">{intro}</p>
          <p className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[color:var(--text-muted)]">
            The phone below is live — tap it. Comparison copy is placeholder text for layout only, not clinical content;
            every record in the real catalogue is still <strong>needs review</strong>, which is why each card says so.
          </p>
        </header>
        <DirectionSwitcher current={current} />
        {children}
      </div>
    </main>
  );
}

export const currentDefects: Array<{ title: string; body: string }> = [
  {
    title: "Four empty slots before a single choice",
    body: "The screen opens with A, B, C and D already drawn as cards. Nothing is selected, so all four are dead placeholders that push the only real action — the one that adds a therapy — below the fold. Four is the ceiling, not the plan.",
  },
  {
    title: "Three controls that all do the same thing",
    body: "Each empty slot card is tappable, `Change therapies` sits under them, and `Add therapies to compare` sits under that. Three affordances, one outcome, and the biggest and most prominent of them is the one you reach last.",
  },
  {
    title: "The toolbar is disabled at the moment you see it",
    body: "Comfortable/Dense, Copy set and Clear all render at full strength above the fold with nothing to act on. Density in particular decides how a wide table breathes — a decision that has no meaning until there is a table, and none at all on a 390 px screen.",
  },
  {
    title: "The count is chrome, not feedback",
    body: "`0 of 4 selected` is a static badge in the header, detached from the slots it counts, and in the captured screen it sits partly under the page's own edge control.",
  },
  {
    title: "The slot cards do not fill the phone",
    body: "The strip is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, but on the phone the cards still stop short of the right edge while the buttons beneath them run full width — so the column looks broken rather than deliberate.",
  },
  {
    title: "The payoff is a sideways-scrolling table",
    body: "Once two are chosen, the comparison is a `min-w-[720px]` table inside a horizontal scroller. On a 390 px viewport that is two thirds of a column at a time, with the field labels scrolling away from the values they label.",
  },
];

export function CurrentDefects() {
  return (
    <MockupSection
      id="defects-title"
      title="What the current phone screen gets wrong"
      intro="The same six problems are the brief for all three directions. Each one below answers them differently."
      divider={false}
    >
      <div className="grid gap-2 lg:grid-cols-3">
        {currentDefects.map((defect) => (
          <NoteCard key={defect.title} title={defect.title} body={defect.body} />
        ))}
      </div>
    </MockupSection>
  );
}
