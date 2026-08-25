"use client";

import { BookOpenText, ChevronDown, ChevronRight, Menu, MessageSquarePlus, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  categoryTheme,
  factsheetsGroupedByCategory,
  type FactsheetCategory,
  type FactsheetIconKey,
} from "@/components/factsheets/factsheets-data";
import { factsheetGlyph } from "@/components/factsheets/factsheets-icons";
import { FACTSHEET_CATEGORY_IDENTITY } from "@/lib/category-identity";
import { categoryGlyph } from "@/lib/category-identity-icons";
import { interactiveRowBase } from "@/components/ui/interactive-row";
import { cn } from "@/components/ui-primitives";

/**
 * Design scratch: phone Factsheets Topics browse.
 *
 * Variant A is the production target — a stacked topic directory, one topic
 * open at a time, Search then Topics ModeNav. B keeps every topic expanded.
 * C stresses extra topics and a long Medications list.
 */

type VariantId = "directory" | "expanded" | "dense";

type Specimen = {
  slug: string;
  title: string;
  brand?: string;
  category: string;
  icon: FactsheetIconKey;
  audience: string;
  readTime: string;
  summary: string;
};

const EXTRA_CATEGORIES = ["Sleep", "Substance use", "Carers", "Safety"] as const;

const EXTRA_MEDICATIONS = [
  "Fluoxetine",
  "Venlafaxine",
  "Mirtazapine",
  "Duloxetine",
  "Quetiapine",
  "Olanzapine",
  "Aripiprazole",
  "Lamotrigine",
  "Valproate",
  "Melatonin",
] as const;

const variants: ReadonlyArray<{
  id: VariantId;
  number: string;
  name: string;
  recommended?: boolean;
  summary: string;
  cost: string;
}> = [
  {
    id: "directory",
    number: "A",
    name: "Topic directory",
    recommended: true,
    summary: "Production target. Four topic rows in one list. Tap a topic to open its sheets; the others stay closed.",
    cost: "Comparing two topics takes two taps. That is the point on a phone: one topic at a time.",
  },
  {
    id: "expanded",
    number: "B",
    name: "All topics open",
    summary: "The same directory, with every topic expanded. A study for desktop length, not the phone default.",
    cost: "Eight demonstration sheets already scroll past the fold. Rejected for production on phone.",
  },
  {
    id: "dense",
    number: "C",
    name: "Hundred-item stress",
    summary:
      "Extra topics become more rows in the same list. Medications shows eight sheets, then Show all. No chip rail.",
    cost: "Dense rows drop the summary to prove the collapse control, not a production density change.",
  },
];

function liveSpecimens(): Specimen[] {
  return factsheetsGroupedByCategory().flatMap((group) =>
    group.sheets.map((sheet) => ({
      slug: sheet.slug,
      title: sheet.title,
      brand: sheet.brand,
      category: sheet.category,
      icon: sheet.icon,
      audience: sheet.audience,
      readTime: sheet.readTime,
      summary: sheet.summary,
    })),
  );
}

function denseSpecimens(): Specimen[] {
  const extraMedications: Specimen[] = EXTRA_MEDICATIONS.map((title, index) => ({
    slug: `mock-${title.toLowerCase()}`,
    title,
    category: "Medications",
    icon: "capsule",
    audience: "Patients starting treatment",
    readTime: "5 min read",
    summary: `Demonstration extra sheet ${index + 1} so the Medications list crosses the eight-row collapse threshold.`,
  }));
  const extraTopics: Specimen[] = EXTRA_CATEGORIES.map((category) => ({
    slug: `mock-${category.toLowerCase().replace(/\s+/g, "-")}`,
    title: `${category} overview`,
    category,
    icon: "layers",
    audience: "Patients and carers",
    readTime: "4 min read",
    summary: `Demonstration extra topic so a growing catalogue adds a directory row, not a scrolling chip.`,
  }));
  return [...liveSpecimens(), ...extraMedications, ...extraTopics];
}

export function FactsheetsTopicsPhoneMockupsPage() {
  return (
    <main
      data-testid="factsheets-topics-phone-mockups"
      className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]"
    >
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-mockup-wide px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Factsheets · Topics · phone
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-display text-[color:var(--text-heading)] sm:text-4xl">
            Topics on a 390 px phone
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Search stays first in ModeNav. Topics is a stacked directory: tap a topic to open its sheets. No second
            search field, no horizontal chip rail.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-mockup-wide gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        {variants.map((variant) => (
          <article key={variant.id} className="min-w-0">
            <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
              {variant.number}
              {variant.recommended ? " · recommended" : ""}
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">{variant.name}</h2>
            <p className="mt-1.5 text-sm leading-5 text-[color:var(--text-muted)]">{variant.summary}</p>
            <p className="mt-1.5 text-xs leading-5 text-[color:var(--text-soft)]">{variant.cost}</p>
            <div className="mt-4">
              <PhoneFrame label={`390 × 844 · ${variant.number}`} variant={variant.id} />
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function PhoneFrame({ label, variant }: { label: string; variant: VariantId }) {
  return (
    <figure className="mx-auto w-full max-w-phone-frame">
      <figcaption className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">scrollable</span>
      </figcaption>
      <div className="relative flex h-phone-frame flex-col overflow-hidden rounded-phone-frame border border-[color:var(--border)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]">
        <StatusBar />
        <PhoneChrome />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TopicsPhoneStudy variant={variant} />
        </div>
        <PhoneComposer />
      </div>
    </figure>
  );
}

function StatusBar() {
  return (
    <div className="flex h-9 items-center justify-between px-6 text-3xs font-bold text-[color:var(--text-heading)]">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-4 rounded-sm bg-[color:var(--text-heading)]" />
        <span className="h-2 w-2 rounded-full bg-[color:var(--text-heading)]" />
      </span>
    </div>
  );
}

function PhoneChrome() {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)]">
          <Menu className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-extrabold text-[color:var(--text-heading)]">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
            <BookOpenText className="h-3 w-3" aria-hidden="true" />
          </span>
          Factsheets
          <ChevronDown className="h-3 w-3 text-[color:var(--text-muted)]" aria-hidden="true" />
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)]">
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="flex gap-6 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4">
        {[
          { label: "Search", active: false },
          { label: "Topics", active: true },
        ].map((tab) => (
          <span
            key={tab.label}
            className={cn(
              "border-b-2 py-2.5 text-xs font-bold",
              tab.active
                ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                : "border-transparent text-[color:var(--text-muted)]",
            )}
          >
            {tab.label}
          </span>
        ))}
      </div>
    </>
  );
}

function PhoneComposer() {
  return (
    <div className="z-10 shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 pb-4 pt-2">
      <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
        <Plus className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" />
        <span className="flex-1 text-xs font-medium text-[color:var(--text-soft)]">Search a factsheet…</span>
        <Search className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
      </div>
    </div>
  );
}

function topicLook(category: string) {
  if (category in FACTSHEET_CATEGORY_IDENTITY) {
    const key = category as FactsheetCategory;
    return { identity: FACTSHEET_CATEGORY_IDENTITY[key], theme: categoryTheme(key) };
  }
  return {
    identity: undefined,
    theme: { soft: "var(--surface-subtle)", accent: "var(--text-muted)" },
  };
}

function TopicsPhoneStudy({ variant }: { variant: VariantId }) {
  const sheets = useMemo(() => (variant === "dense" ? denseSpecimens() : liveSpecimens()), [variant]);
  const groups = useMemo(() => {
    const order = [
      ...factsheetsGroupedByCategory().map((group) => group.category),
      ...(variant === "dense" ? EXTRA_CATEGORIES : []),
    ];
    return order
      .map((category) => ({
        category,
        sheets: sheets.filter((sheet) => sheet.category === category),
      }))
      .filter((group) => group.sheets.length > 0);
  }, [sheets, variant]);
  const previewLimit = 8;
  const [openTopic, setOpenTopic] = useState<string | undefined>(variant === "expanded" ? undefined : "Medications");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="px-4 py-4">
      <p className="text-2xs font-bold uppercase tracking-label text-[color:var(--clinical-accent)]">
        Patient information
      </p>
      <h3 className="mt-1 text-xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Topics</h3>
      <p className="mt-1 text-xs font-medium text-[color:var(--text-muted)]">
        <span className="nums font-bold text-[color:var(--text-heading)]">{groups.length}</span> topics ·{" "}
        <span className="nums font-bold text-[color:var(--text-heading)]">{sheets.length}</span> sheets
      </p>

      <ul className="mt-4 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
        {groups.map((group) => {
          const isOpen = variant === "expanded" || openTopic === group.category;
          const { identity, theme } = topicLook(group.category);
          const isExpanded = Boolean(expanded[group.category]);
          const shown =
            isExpanded || group.sheets.length <= previewLimit ? group.sheets : group.sheets.slice(0, previewLimit);
          const canCollapse = group.sheets.length > previewLimit;

          return (
            <li key={group.category} className="border-b border-[color:var(--border)] last:border-b-0">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => {
                  if (variant === "expanded") return;
                  setOpenTopic((current) => (current === group.category ? undefined : group.category));
                }}
                className={cn(
                  interactiveRowBase,
                  "w-full gap-3 rounded-none border-0 px-3.5 py-3",
                  isOpen && "bg-[color:var(--clinical-accent-soft)]",
                )}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: theme.soft, color: theme.accent }}
                >
                  {identity ? categoryGlyph(identity.icon, "h-5 w-5") : factsheetGlyph("layers", "h-5 w-5")}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-extrabold text-[color:var(--text-heading)]">
                    {group.category}
                  </span>
                  <span className="block text-xs font-bold" style={{ color: theme.accent }}>
                    <span className="nums">{group.sheets.length}</span> sheets
                  </span>
                </span>
                {variant === "expanded" ? null : (
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-[color:var(--text-muted)] motion-safe:transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                )}
              </button>
              {isOpen ? (
                <div className="border-t border-[color:var(--border)]">
                  {shown.map((sheet) => (
                    <StudyRow
                      key={sheet.slug}
                      sheet={sheet}
                      dense={variant === "dense"}
                      selected={picked === sheet.slug}
                      onSelect={() => setPicked(sheet.slug)}
                    />
                  ))}
                  {canCollapse ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [group.category]: !current[group.category],
                        }))
                      }
                      className={cn(
                        interactiveRowBase,
                        "w-full justify-center rounded-none border-0 bg-[color:var(--surface-subtle)] text-sm font-bold text-[color:var(--clinical-accent)]",
                      )}
                    >
                      {isExpanded
                        ? `Show fewer in ${group.category}`
                        : `Show all ${group.sheets.length} in ${group.category}`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StudyRow({
  sheet,
  dense,
  selected,
  onSelect,
}: {
  sheet: Specimen;
  dense: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { theme } = topicLook(sheet.category);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 border-b border-[color:var(--border)] text-left last:border-b-0 hover:bg-[color:var(--surface-subtle)]",
        interactiveRowBase,
        "rounded-none border-x-0 border-t-0",
        dense ? "px-3 py-2.5" : "px-3.5 py-3",
        selected && "bg-[color:var(--clinical-accent-soft)]",
      )}
    >
      <span
        className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg"
        style={{ backgroundColor: theme.soft, color: theme.accent }}
      >
        {factsheetGlyph(sheet.icon, "h-4 w-4")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[color:var(--text-heading)]">
          {sheet.title}
          {sheet.brand ? <span className="font-medium text-[color:var(--text-muted)]"> {sheet.brand}</span> : null}
        </span>
        {dense ? null : (
          <span className="mt-0.5 block text-xs leading-4 text-[color:var(--text-muted)]">{sheet.summary}</span>
        )}
        <span className="mt-1 block text-2xs font-bold text-[color:var(--text-soft)]">
          {sheet.audience} · {sheet.readTime}
        </span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--decoration-soft)]" aria-hidden="true" />
    </button>
  );
}
