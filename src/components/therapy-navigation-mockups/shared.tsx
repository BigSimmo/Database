"use client";

import {
  ClipboardList,
  Columns3,
  Compass,
  FileText,
  Layers,
  Search,
  Sparkles,
  Timer,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Shared vocabulary for the three Therapy navigation directions.
 * Design-scratch only: this directory 404s in production.
 * ------------------------------------------------------------------ */

export type Device = "desktop" | "tablet" | "phone";

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/* -- Fixtures: every number below is the real shape of the shipped data -- */

/** `src/data/therapies-index.json` — 205 records, 16 categories, all `needs_review`. */
export const THERAPY_COUNT = 205;
export const CATEGORY_COUNT = 16;
/** `public/therapy-compass-data/pathways.json`. */
export const PATHWAY_COUNT = 12;
/** Every record currently carries `reviewStatus: "needs_review"`. */
export const REVIEW_COUNT = 205;
/** `MAX_COMPARE` in `src/components/therapy-compass/bindings.tsx`. */
export const MAX_COMPARE = 4;

export type TherapyFixture = {
  name: string;
  short: string;
  category: string;
  modality: string;
};

export const selectedTherapy: TherapyFixture = {
  name: "Acceptance and Commitment Therapy (ACT)",
  short: "ACT",
  category: "Standard Talking Therapies",
  modality: "CBT",
};

export const compareBasket: TherapyFixture[] = [
  selectedTherapy,
  { name: "Behavioural Activation (BA)", short: "BA", category: "Standard Talking Therapies", modality: "CBT" },
  {
    name: "Cognitive Processing Therapy (CPT)",
    short: "CPT",
    category: "Trauma Therapies",
    modality: "Trauma-focused",
  },
];

export const categories: Array<{ name: string; count: number }> = [
  { name: "Standard Talking Therapies", count: 17 },
  { name: "Child & Adolescent Therapies", count: 16 },
  { name: "Psychosis & Rehabilitation Therapies", count: 16 },
  { name: "Family & Couple Therapies", count: 16 },
  { name: "Humanistic & Meaning-Based Therapies", count: 16 },
  { name: "Substance Use Therapies", count: 15 },
  { name: "Foundational & Engagement Therapies", count: 14 },
  { name: "Trauma Therapies", count: 14 },
  { name: "Personality Disorder Therapies", count: 13 },
  { name: "Community & Casework Support", count: 12 },
  { name: "Self-Help & Digital Therapies", count: 12 },
  { name: "Eating Disorder Therapies", count: 11 },
  { name: "Brain & Body Therapies", count: 10 },
  { name: "OCD & Exposure Therapies", count: 10 },
  { name: "Group IPT", count: 9 },
  { name: "Group CBT", count: 4 },
];

export const pathwayNames = [
  "Anxiety pathway",
  "Mood pathway",
  "Crisis/risk pathway",
  "Psychosis pathway",
  "Trauma pathway",
  "Sleep pathway",
];

/* -- Destination model shared by all three directions -------------------- */

export type DestinationGroup = "library" | "workspace" | "therapy";

export type Destination = {
  id: string;
  label: string;
  icon: LucideIcon;
  group: DestinationGroup;
  /** Right-aligned state: a count, a status, or the record it will act on. */
  meta?: string;
  /** Renders as an explicit disabled placeholder rather than a silent retarget. */
  unavailable?: string;
};

export const destinations: Destination[] = [
  { id: "search", label: "Search", icon: Search, group: "library", meta: `${THERAPY_COUNT}` },
  { id: "browse", label: "Browse by category", icon: Layers, group: "library", meta: `${CATEGORY_COUNT}` },
  { id: "recommend", label: "Recommend", icon: Sparkles, group: "library", meta: "Guided" },
  { id: "pathways", label: "Pathways", icon: Waypoints, group: "library", meta: `${PATHWAY_COUNT}` },
  {
    id: "compare",
    label: "Compare",
    icon: Columns3,
    group: "workspace",
    meta: `${compareBasket.length}/${MAX_COMPARE}`,
  },
  { id: "review", label: "Review queue", icon: ClipboardList, group: "workspace", meta: `${REVIEW_COUNT}` },
  { id: "detail", label: "Overview", icon: Compass, group: "therapy" },
  { id: "brief", label: "Brief intervention", icon: Timer, group: "therapy", meta: "5 · 15 min" },
  { id: "sheets", label: "Patient sheet", icon: FileText, group: "therapy", meta: "Printable" },
];

export const groupLabels: Record<DestinationGroup, string> = {
  library: "Library",
  workspace: "Your workspace",
  therapy: selectedTherapy.short,
};

export const groupCaptions: Record<DestinationGroup, string> = {
  library: `${THERAPY_COUNT} records, ${CATEGORY_COUNT} categories`,
  workspace: "Carries state between screens",
  therapy: "Acts on the selected therapy",
};

export function destinationsIn(group: DestinationGroup): Destination[] {
  return destinations.filter((destination) => destination.group === group);
}

/* -- Chrome ------------------------------------------------------------- */

/** The universal app header the Therapy nav has to sit under, drawn to scale. */
export function UniversalTopBar({ device }: { device: Device }) {
  const phone = device === "phone";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3",
        phone ? "h-12" : "h-14 sm:px-4",
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
        KB
      </span>
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] font-semibold text-[color:var(--text)]",
          phone ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm",
        )}
      >
        <Compass aria-hidden="true" className="h-4 w-4 text-[color:var(--clinical-accent)]" />
        Therapy
      </span>
      <span className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Search aria-hidden="true" className="h-4 w-4" />
      </span>
      <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full bg-[color:var(--clinical-accent-soft)]" />
    </div>
  );
}

/** Neutral content stand-in so the eye stays on the navigation, not the page. */
export function ContentSkeleton({
  title,
  eyebrow,
  blocks = 2,
  compact = false,
}: {
  title: string;
  eyebrow: string;
  blocks?: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("min-w-0 space-y-3", compact ? "p-3" : "p-4")}>
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">{eyebrow}</p>
        <h4 className="mt-0.5 text-sm font-semibold text-[color:var(--text-heading)]">{title}</h4>
        <div className="mt-3 space-y-2 border-t border-[color:var(--border)] pt-3">
          <div className="h-1 rounded-full bg-[color:var(--border-strong)]/55" />
          <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/45" />
          <div className="h-1 w-11/12 rounded-full bg-[color:var(--border-strong)]/40" />
        </div>
      </div>
      {Array.from({ length: blocks }, (_, block) => (
        <div key={block} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          <div className="h-1.5 w-1/2 rounded-full bg-[color:var(--text-heading)]/12" />
          <div className="mt-2.5 space-y-2">
            <div className="h-1 rounded-full bg-[color:var(--border-strong)]/45" />
            <div className="h-1 w-9/12 rounded-full bg-[color:var(--border-strong)]/35" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A device viewport at roughly true proportion, with its width called out. */
export function DeviceFrame({
  device,
  label,
  note,
  children,
  className,
}: {
  device: Device;
  label: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("m-0 min-w-0", device === "phone" ? "w-[340px] max-w-full" : "w-full", className)}>
      <figcaption className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        {label}
      </figcaption>
      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]",
          device === "phone" ? "h-[38rem]" : "h-[28rem]",
          device === "tablet" && "mx-auto w-full max-w-[768px]",
        )}
      >
        {children}
      </div>
      {note ? <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">{note}</p> : null}
    </figure>
  );
}

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

/* -- Page shell + cross-links ------------------------------------------- */

export const directions = [
  {
    slug: "therapy-navigation-rail",
    letter: "A",
    name: "Grouped rail",
    tagline: "Rank the destinations spatially. Structure first.",
  },
  {
    slug: "therapy-navigation-context",
    letter: "B",
    name: "Context row",
    tagline: "One line that says where you are, one sheet that moves you.",
  },
  {
    slug: "therapy-navigation-dock",
    letter: "C",
    name: "Working-set dock",
    tagline: "Navigate what you are carrying, not a menu.",
  },
];

function DirectionSwitcher({ current }: { current: string }) {
  return (
    <nav aria-label="Navigation directions" className="mt-6 grid gap-2 sm:grid-cols-3">
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
            <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
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
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Therapy navigation · Direction {letter} · {name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            {headline}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">{intro}</p>
        </header>
        <DirectionSwitcher current={current} />
        {children}
      </div>
    </main>
  );
}

/* -- The shared critique, restated on every direction ------------------- */

export const currentDefects: Array<{ title: string; body: string }> = [
  {
    title: "Three kinds of destination, one visual rank",
    body: "Search and Recommend are doors into a 205-record library. Compare is a workspace holding a basket of up to four. Pathways is a browse structure over twelve workflows. Brief intervention and Patient sheet are artifacts of whichever therapy is selected. Seven identical pills say all seven are the same kind of thing.",
  },
  {
    title: "It carries no state at all",
    body: "Compare exists to hold up to four therapies and the strip never shows how many are in it. Every one of the 205 records is still `needs_review`, and Review is a real route reachable from the detail and pathway screens — with an active style already computed in bindings — that no button in the strip ever renders.",
  },
  {
    title: "The therapy-scoped destinations retarget silently",
    body: "Brief intervention and Patient sheet fall back to the first therapy in the catalogue that has one when the selected therapy does not. The strip never names whose brief you are about to open, so the swap is invisible.",
  },
  {
    title: "On a phone it is a hidden horizontal scroller",
    body: "Seven pills need roughly 700 px inside a 390 px viewport. Patient sheet sits off-screen with no scroll affordance, no edge fade, and nothing to say how far along the set you are.",
  },
  {
    title: "On a desktop it wastes the width it demanded",
    body: "A fit-content row centred in a full-width sticky glass bar leaves roughly a thousand pixels empty, while the sixteen categories and twelve pathways that would actually help someone move through 205 records get no surface at all.",
  },
  {
    title: "Category is a first-class field with no way in",
    body: "Every record is categorised and the catalogue splits cleanly into sixteen groups from 4 to 17 records. Navigation offers search or nothing.",
  },
];

export function CurrentDefects() {
  return (
    <MockupSection
      id="defects-title"
      title="What the current strip gets wrong"
      intro="The same six problems are the brief for all three directions. Each direction below answers them differently."
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
