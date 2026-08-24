"use client";

/**
 * Design-scratch: Calculators home “Show all” control.
 *
 * Tools ships a centered outline pill under the hero (`applications-launcher-page.tsx`).
 * The grammar is right — a compact launcher into the unfiltered directory — but the
 * chip itself is optically left-heavy: a 14px accent icon, heading-coloured label,
 * equal 12px padding, and an inset shadow. These directions keep that launcher
 * placement on a Calculators home and rebuild the chip so icon, label, and padding
 * share one colour, one tap height, and a designed interior.
 *
 * Shared mockup chrome is suppressed (`mockups-layout-client.tsx`) because every
 * phone frame draws its own top bar and composer. Per `mockups/README.md`, shared
 * chrome is inherited or suppressed, never forked into the page.
 */

import {
  ArrowLeft,
  Calculator,
  ChevronDown,
  Clock3,
  Menu,
  MessageSquarePlus,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, useId, useMemo, useState } from "react";

import { cn } from "@/components/ui-primitives";

import { calculators, plannedCalculators, type CalculatorFixture } from "./calculator-fixtures";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

type DirectionId = "baseline" | "wordmark" | "well" | "pair";
type FrameView = "home" | "directory";

const READY_COUNT = calculators.length;
const DIRECTORY_COUNT = READY_COUNT + plannedCalculators.length;

const shortcuts = calculators.slice(0, 8).map((calc) => ({
  id: calc.id,
  label: calc.abbrev === "AUDIT-C" ? "AUDIT" : calc.abbrev === "SAD PERSONS" ? "SAD" : calc.abbrev,
  icon: calc.icon,
}));

const directions: Array<{
  id: DirectionId;
  number: string;
  name: string;
  summary: string;
  strengths: string[];
  recommended?: boolean;
}> = [
  {
    id: "baseline",
    number: "01",
    name: "Tools transplant",
    summary:
      "The shipping Tools chip, with a calculator glyph. Documents the imbalance: mixed colours, a 14px icon, equal padding, and an inset shadow.",
    strengths: ["Known grammar", "Shows the defect"],
  },
  {
    id: "wordmark",
    number: "02",
    name: "Matched wordmark",
    summary:
      "Icon and label become one mark: shared accent colour, button-scale glyph, tight gap, and extra trailing padding so the pair sits optically centred.",
    strengths: ["Same recipe", "One colour", "Optical padding"],
  },
  {
    id: "well",
    number: "03",
    name: "Icon-well capsule",
    summary:
      "The calculator sits in a circular well that matches the remaining pill height. Left inset equals the well’s own padding; the label gets a designed trailing cap.",
    strengths: ["Designed interior", "Clear hit area", "Reads as a chip"],
    recommended: true,
  },
  {
    id: "pair",
    number: "04",
    name: "Symmetric pair",
    summary:
      "Matching wells on both ends — calculator left, count right — so the label is truly centred. The count answers “show all of what?”",
    strengths: ["Bilateral symmetry", "Honest count", "Strongest object"],
  },
];

function ShowAllButton({ direction, onOpen }: { direction: DirectionId; onOpen: () => void }) {
  const describedBy = useId();

  if (direction === "baseline") {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Show all calculators"
        className={cn(
          "inline-flex min-h-tap items-center justify-center gap-2 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--clinical-accent-soft)] sm:text-sm lg:min-h-9",
          focusRing,
        )}
      >
        <Calculator
          className="size-icon-sm text-[color:var(--clinical-accent)]"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        Show all
      </button>
    );
  }

  if (direction === "wordmark") {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Show all calculators"
        className={cn(
          "inline-flex h-tap min-h-tap items-center justify-center gap-1.5 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] pl-5 pr-6 text-sm font-semibold tracking-[-0.01em] text-[color:var(--clinical-accent)] transition hover:border-[color:var(--clinical-accent)]",
          focusRing,
        )}
      >
        <Calculator className="size-icon-md" strokeWidth={1.75} aria-hidden="true" />
        Show all
      </button>
    );
  }

  if (direction === "well") {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Show all calculators"
        aria-describedby={describedBy}
        className={cn(
          "inline-flex h-tap min-h-tap items-center gap-2 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-1 pr-4 text-sm font-semibold tracking-[-0.01em] text-[color:var(--clinical-accent)] transition hover:border-[color:var(--clinical-accent)]",
          focusRing,
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--surface)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
          <Calculator className="size-icon-md" strokeWidth={1.75} aria-hidden="true" />
        </span>
        Show all
        <span id={describedBy} className="sr-only">
          Opens the unfiltered calculators directory
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Show all ${DIRECTORY_COUNT} calculators`}
      className={cn(
        "inline-flex h-tap min-h-tap items-center gap-2 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-1 text-sm font-semibold tracking-[-0.01em] text-[color:var(--clinical-accent)] transition hover:border-[color:var(--clinical-accent)]",
        focusRing,
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--surface)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
        <Calculator className="size-icon-md" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-[4.5rem] text-center">Show all</span>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--surface)] text-xs font-bold tabular-nums text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
        {DIRECTORY_COUNT}
      </span>
    </button>
  );
}

function PhoneChrome() {
  return (
    <header className="grid h-12 shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3">
      <span className="grid size-10 place-items-center text-[color:var(--text-heading)]">
        <Menu className="size-icon-lg" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text)]">
        <Calculator
          className="size-icon-sm text-[color:var(--clinical-accent)]"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="truncate">Calculators</span>
        <ChevronDown className="size-icon-sm shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
      </span>
      <span className="grid size-10 place-items-center text-[color:var(--text-muted)]">
        <MessageSquarePlus className="size-icon-lg" strokeWidth={1.75} aria-hidden="true" />
      </span>
    </header>
  );
}

function Hero() {
  return (
    <div className="grid justify-items-center gap-3 text-center">
      <span className="grid size-hero-medallion place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
        <Calculator className="size-icon-xl" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="grid gap-1">
        <h3 className="text-balance text-hero font-semibold leading-display tracking-normal text-[color:var(--text-heading)]">
          Calculators
        </h3>
        <p className="text-pretty text-sm font-medium leading-5 text-[color:var(--text-muted)]">
          Scores, screening, risk.
        </p>
      </div>
    </div>
  );
}

function HomeComposer({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      role="search"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
      className="grid min-h-13 w-full grid-cols-[var(--spacing-tap)_minmax(0,1fr)_var(--spacing-tap)] items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-card)]"
    >
      <span className="grid h-tap w-tap place-items-center text-[color:var(--clinical-accent)]">
        <Plus className="size-icon-lg" aria-hidden="true" />
      </span>
      <label className="min-w-0">
        <span className="sr-only">Search calculators</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search calculators..."
          className="w-full min-w-0 bg-transparent text-sm font-medium text-[color:var(--text)] placeholder:text-[color:var(--text-placeholder)] focus:outline-none"
        />
      </label>
      <button
        type="submit"
        aria-label="Search calculators"
        className={cn(
          "grid h-tap w-tap place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)]",
          focusRing,
        )}
      >
        <Search className="size-icon-lg" aria-hidden="true" />
      </button>
    </form>
  );
}

function ShortcutTile({
  label,
  icon: Icon,
  selected,
  onSelect,
}: {
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Open ${label}`}
      onClick={onSelect}
      className={cn(
        "grid h-14 min-w-0 place-items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center shadow-[var(--shadow-inset)] transition",
        focusRing,
        selected
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-lux)] hover:border-[color:var(--clinical-accent-border)]",
      )}
    >
      <span className="grid size-7 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon className="size-icon-md" aria-hidden="true" />
      </span>
      <span className="w-full truncate text-2xs font-semibold text-[color:var(--text-heading)]">{label}</span>
    </button>
  );
}

function DirectoryRow({
  abbrev,
  name,
  icon: Icon,
  meta,
  comingSoon,
  selected,
  onSelect,
}: {
  abbrev: string;
  name: string;
  icon: LucideIcon;
  meta?: string;
  comingSoon?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={comingSoon ? `${abbrev} — coming soon` : `Open ${abbrev}`}
      className={cn(
        "grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2.5 text-left shadow-[var(--shadow-inset)] transition",
        focusRing,
        selected
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--clinical-accent-border)]",
        comingSoon && "opacity-70",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon className="size-icon-lg" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[color:var(--text-heading)]">{abbrev}</span>
          {comingSoon ? (
            <span className="rounded-md bg-[color:var(--surface-subtle)] px-1.5 text-3xs font-bold uppercase tracking-label text-[color:var(--text-muted)]">
              Coming soon
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-2xs font-medium text-[color:var(--text-muted)]">{name}</span>
        {meta ? (
          <span className="mt-1 inline-flex items-center gap-1 text-3xs font-semibold text-[color:var(--text-soft)]">
            <Clock3 className="size-icon-xs" aria-hidden="true" />
            {meta}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function matchesQuery(query: string, ...values: string[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => value.toLowerCase().includes(needle));
}

function PhoneHome({
  direction,
  query,
  selectedId,
  onQueryChange,
  onOpenDirectory,
  onSelect,
}: {
  direction: DirectionId;
  query: string;
  selectedId: string | null;
  onQueryChange: (next: string) => void;
  onOpenDirectory: () => void;
  onSelect: (id: string) => void;
}) {
  const visibleShortcuts = shortcuts.filter((tile) => matchesQuery(query, tile.label, tile.id));

  return (
    <div className="grid justify-items-center gap-3 px-4 pb-6 pt-5">
      <Hero />
      <ShowAllButton direction={direction} onOpen={onOpenDirectory} />
      <HomeComposer
        value={query}
        onChange={onQueryChange}
        onSubmit={() => {
          if (visibleShortcuts.length === 1) onSelect(visibleShortcuts[0].id);
          else onOpenDirectory();
        }}
      />
      <div className="grid w-full grid-cols-4 gap-2" aria-label="Calculator shortcuts">
        {visibleShortcuts.map((tile) => (
          <ShortcutTile
            key={tile.id}
            label={tile.label}
            icon={tile.icon}
            selected={selectedId === tile.id}
            onSelect={() => onSelect(tile.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PhoneDirectory({
  query,
  selectedId,
  onQueryChange,
  onBack,
  onSelect,
}: {
  query: string;
  selectedId: string | null;
  onQueryChange: (next: string) => void;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const ready = calculators.filter((calc) => matchesQuery(query, calc.abbrev, calc.name, calc.indication));
  const planned = plannedCalculators.filter((calc) => matchesQuery(query, calc.abbrev, calc.name, calc.indication));

  return (
    <div className="grid gap-3 px-4 pb-6 pt-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to calculators home"
          className={cn(
            "grid size-tap shrink-0 place-items-center rounded-full text-[color:var(--text-heading)]",
            focusRing,
          )}
        >
          <ArrowLeft className="size-icon-lg" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[color:var(--text-heading)]">All calculators</h3>
          <p className="text-2xs font-medium text-[color:var(--text-muted)]">
            {ready.length} ready · {planned.length} planned
          </p>
        </div>
      </div>
      <HomeComposer value={query} onChange={onQueryChange} onSubmit={() => undefined} />
      <div className="grid gap-2" aria-label="All calculators">
        {ready.map((calc: CalculatorFixture) => (
          <DirectoryRow
            key={calc.id}
            abbrev={calc.abbrev}
            name={calc.name}
            icon={calc.icon}
            meta={calc.timeEstimate}
            selected={selectedId === calc.id}
            onSelect={() => onSelect(calc.id)}
          />
        ))}
        {planned.map((calc) => (
          <DirectoryRow
            key={calc.abbrev}
            abbrev={calc.abbrev}
            name={calc.name}
            icon={calc.icon}
            comingSoon
            selected={selectedId === calc.abbrev}
            onSelect={() => onSelect(calc.abbrev)}
          />
        ))}
      </div>
    </div>
  );
}

function PhoneFrame({ direction }: { direction: DirectionId }) {
  const [view, setView] = useState<FrameView>("home");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const caption = directions.find((item) => item.id === direction)?.name ?? direction;

  return (
    <figure className="m-0 w-full max-w-[24.375rem]">
      <figcaption className="mb-2 flex items-center justify-between gap-2">
        <span className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {caption} · phone
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">390 px</span>
      </figcaption>
      <div
        data-testid={`calculators-show-all-frame-${direction}`}
        data-view={view}
        className="flex h-[46rem] flex-col overflow-hidden rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--background)] shadow-[var(--shadow-soft)]"
      >
        <PhoneChrome />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "home" ? (
            <PhoneHome
              direction={direction}
              query={query}
              selectedId={selectedId}
              onQueryChange={setQuery}
              onOpenDirectory={() => setView("directory")}
              onSelect={setSelectedId}
            />
          ) : (
            <PhoneDirectory
              query={query}
              selectedId={selectedId}
              onQueryChange={setQuery}
              onBack={() => setView("home")}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </div>
    </figure>
  );
}

function ButtonStrip() {
  const [opened, setOpened] = useState<DirectionId | null>(null);

  return (
    <section
      aria-labelledby="calculators-show-all-strip-title"
      className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
    >
      <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5">
        <p className="text-3xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
          Close-up
        </p>
        <h2
          id="calculators-show-all-strip-title"
          className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]"
        >
          Four chips, one placement
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Each control opens the unfiltered directory. The recommended well keeps the Tools grammar and rebuilds the
          interior so the icon is a designed mass, not a leftover glyph.
        </p>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
        {directions.map((direction) => (
          <div
            key={direction.id}
            className="grid justify-items-center gap-3 rounded-xl bg-[color:var(--background)] p-4"
          >
            <p className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              {direction.number} {direction.name}
            </p>
            <ShowAllButton direction={direction.id} onOpen={() => setOpened(direction.id)} />
            {opened === direction.id ? (
              <p role="status" className="text-2xs font-semibold text-[color:var(--clinical-accent)]">
                Opens {DIRECTORY_COUNT} calculators
              </p>
            ) : (
              <p className="text-2xs font-medium text-[color:var(--text-soft)]">Tap to preview the action</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Anatomy() {
  return (
    <div className="grid gap-2 rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/50 p-3">
      <p className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
        Well geometry
      </p>
      <p className="text-xs font-medium leading-5 text-[color:var(--text-muted)]">
        48px tap height. 4px padding around a 32px well. 8px gap to the label. 16px trailing cap. Icon and label share{" "}
        <span className="font-semibold text-[color:var(--clinical-accent)]">--clinical-accent</span>. No inset shadow on
        the pill itself — the well carries the depth.
      </p>
    </div>
  );
}

export function CalculatorsShowAllDirectionsMockup() {
  const readyIds = useMemo(() => calculators.map((calc) => calc.id), []);

  return (
    <main
      data-testid="calculators-show-all-study"
      className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]"
    >
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Calculators home
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            A Show all chip that sits still
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Tools already proved the placement: hero, then a compact launcher, then search. These frames keep that stack
            for Calculators and rebuild the chip so the icon and label share a colour, a tap height, and a designed
            interior. {READY_COUNT} ready scores, {plannedCalculators.length} planned.
          </p>
          <p className="sr-only">{readyIds.join(", ")}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <ButtonStrip />

        {directions.map((direction) => (
          <section
            key={direction.id}
            aria-labelledby={`${direction.id}-title`}
            className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
          >
            <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 gap-3">
                <span className="pt-0.5 text-xs font-extrabold tabular-nums text-[color:var(--clinical-accent)]">
                  {direction.number}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id={`${direction.id}-title`}
                      className="text-lg font-extrabold text-[color:var(--text-heading)]"
                    >
                      {direction.name}
                    </h2>
                    {direction.recommended ? (
                      <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
                    {direction.summary}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {direction.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-bold text-[color:var(--text-muted)]"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid justify-items-center gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <PhoneFrame direction={direction.id} />
              <div className="grid w-full max-w-[24.375rem] content-start gap-3 lg:max-w-none">
                {direction.id === "well" ? <Anatomy /> : null}
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
                  <p className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                    What changed vs Tools
                  </p>
                  <ul className="mt-2 grid gap-1.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                    {direction.id === "baseline" ? (
                      <>
                        <li>Icon is accent; label is heading colour — two competing weights.</li>
                        <li>Equal 12px padding cannot balance a left glyph.</li>
                        <li>Inset shadow on the whole pill makes the top-left read lighter.</li>
                      </>
                    ) : null}
                    {direction.id === "wordmark" ? (
                      <>
                        <li>Icon steps up to the button glyph token (`size-icon-md`).</li>
                        <li>Label joins the accent, so the pair reads as one mark.</li>
                        <li>Trailing padding is 4px wider than the leading padding.</li>
                      </>
                    ) : null}
                    {direction.id === "well" ? (
                      <>
                        <li>The glyph lives in a 32px well, not as a loose 14px orphan.</li>
                        <li>Soft fill replaces white-plus-inset-shadow.</li>
                        <li>Tap height stays 48px at every breakpoint — Tools shrinks on desktop.</li>
                      </>
                    ) : null}
                    {direction.id === "pair" ? (
                      <>
                        <li>Left and right wells are the same 32px object.</li>
                        <li>The label is centred between them, not optically guessed.</li>
                        <li>The count is the directory size, including planned scores.</li>
                      </>
                    ) : null}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
