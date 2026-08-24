"use client";

import { BookOpenText, ChevronDown, ChevronRight, Menu, MessageSquarePlus, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import {
  categoryTheme,
  factsheetsGroupedByCategory,
  topicChipOverflow,
  type FactsheetCategory,
  type FactsheetIconKey,
} from "@/components/factsheets/factsheets-data";
import { factsheetGlyph } from "@/components/factsheets/factsheets-icons";
import { FACTSHEET_CATEGORY_IDENTITY } from "@/lib/category-identity";
import { categoryGlyph } from "@/lib/category-identity-icons";
import { cn } from "@/components/ui-primitives";

/**
 * Design scratch: phone Factsheets Topics browse.
 *
 * Variant A is the production target — sticky in-flow chips, collapsed sections,
 * Search then Topics ModeNav. B tries a one-open accordion. C stresses hundreds
 * of sheets and a topic index that overflows the chip budget.
 */

type VariantId = "chips" | "accordion" | "dense";

type Specimen = {
  slug: string;
  title: string;
  brand?: string;
  category: FactsheetCategory;
  icon: FactsheetIconKey;
  audience: string;
  readTime: string;
  summary: string;
};

const EXTRA_CATEGORIES = ["Sleep", "Substance use", "Carers", "Safety", "Young people", "Older adults"] as const;

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
  "Zopiclone",
  "Propranolol",
] as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const variants: ReadonlyArray<{
  id: VariantId;
  number: string;
  name: string;
  recommended?: boolean;
  summary: string;
  cost: string;
}> = [
  {
    id: "chips",
    number: "A",
    name: "Chips + collapsed sections",
    recommended: true,
    summary:
      "Production target. Search then Topics. Sticky in-flow chips jump or isolate a topic. Sections stay collapsed after eight rows.",
    cost: "Four topics fit the chip row today; More only appears once the catalogue grows past eight.",
  },
  {
    id: "accordion",
    number: "B",
    name: "One topic open",
    summary: "The same chips, but only one section is expanded at a time. Tapping a heading swaps the open topic.",
    cost: "Comparing two topics takes two taps. Rejected for production unless A proves too long on a real catalogue.",
  },
  {
    id: "dense",
    number: "C",
    name: "Hundred-item stress",
    summary:
      "Synthetic extra sheets and extra topics. The chip row keeps seven topics plus More. Medications shows eight rows, then Show all.",
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
  const extras: Specimen[] = EXTRA_MEDICATIONS.map((title, index) => ({
    slug: `mock-${title.toLowerCase()}`,
    title,
    category: "Medications" as const,
    icon: "capsule" as const,
    audience: "Patients starting treatment",
    readTime: "5 min read",
    summary: `Demonstration extra sheet ${index + 1} so the Medications list crosses the eight-row collapse threshold.`,
  }));
  return [...liveSpecimens(), ...extras];
}

export function FactsheetsTopicsPhoneMockupsPage() {
  return (
    <main
      data-testid="factsheets-topics-phone-mockups"
      className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]"
    >
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Factsheets · Topics · phone
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Topics on a 390 px phone
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Search stays first in ModeNav. Topics is a browse page: sticky chips, no second search field, and a Show all
            control so hundreds of sheets do not dump one list. Accordion and dense stress are studies only.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        {variants.map((variant) => (
          <article key={variant.id} className="min-w-0">
            <p className="text-3xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
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
    <figure className="mx-auto w-full max-w-[390px]">
      <figcaption className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">scrollable</span>
      </figcaption>
      <div className="relative h-[844px] overflow-hidden rounded-[1.85rem] border border-[color:var(--border)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]">
        <StatusBar />
        <PhoneChrome />
        <div className="h-[calc(844px-2.25rem)] overflow-y-auto overscroll-contain pb-24">
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
    <div className="absolute inset-x-0 bottom-0 z-10 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 pb-4 pt-2">
      <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
        <Plus className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" />
        <span className="flex-1 text-xs font-medium text-[color:var(--text-soft)]">Search a factsheet…</span>
        <Search className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
      </div>
    </div>
  );
}

function TopicsPhoneStudy({ variant }: { variant: VariantId }) {
  const sheets = useMemo(() => (variant === "dense" ? denseSpecimens() : liveSpecimens()), [variant]);
  const categories = useMemo(() => {
    const live = factsheetsGroupedByCategory().map((group) => group.category);
    return variant === "dense" ? ([...live, ...EXTRA_CATEGORIES] as string[]) : live;
  }, [variant]);
  const previewLimit = 8;
  const chipLimit = 8;
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [openTopic, setOpenTopic] = useState<string | undefined>(variant === "accordion" ? "Medications" : undefined);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const { visible, overflow } = topicChipOverflow(categories, chipLimit);
  const groups = categories
    .filter((category) => !selected || category === selected)
    .map((category) => ({
      category,
      sheets: sheets.filter((sheet) => sheet.category === category),
    }))
    .filter((group) => group.sheets.length > 0);

  return (
    <div className="relative px-4 py-4">
      <p className="text-2xs font-bold uppercase tracking-label text-[color:var(--clinical-accent)]">
        Patient information
      </p>
      <h3 className="mt-1 text-xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Topics</h3>
      <p className="mt-1 text-xs font-medium text-[color:var(--text-muted)]">
        <span className="nums font-bold text-[color:var(--text-heading)]">
          {selected ? sheets.filter((sheet) => sheet.category === selected).length : sheets.length}
        </span>{" "}
        sheets{selected ? ` in ${selected}` : " organised by topic"}
      </p>

      <div className="sticky top-0 z-10 -mx-4 mt-3 border-b border-[color:var(--border)] bg-[color:var(--surface)]/95 px-4 py-2 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ChipButton current={!selected} onClick={() => setSelected(undefined)} label="All topics" />
          {visible.map((category) => (
            <ChipButton
              key={category}
              current={selected === category}
              onClick={() => setSelected(category)}
              label={category}
              count={sheets.filter((sheet) => sheet.category === category).length || undefined}
            />
          ))}
          {overflow.length > 0 ? (
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
              className={cn(
                "inline-flex min-h-12 shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] px-3.5 text-sm font-bold text-[color:var(--text-muted)]",
                focusRing,
              )}
            >
              More
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {groups.map((group) => {
          const category = group.category as FactsheetCategory;
          const theme = categoryTheme(category);
          const identity = FACTSHEET_CATEGORY_IDENTITY[category];
          const accordionOpen = variant !== "accordion" || openTopic === group.category;
          const isExpanded = Boolean(expanded[group.category]) || Boolean(selected);
          const shown =
            variant === "accordion" && !accordionOpen
              ? []
              : isExpanded || group.sheets.length <= previewLimit
                ? group.sheets
                : group.sheets.slice(0, previewLimit);
          const canCollapse = variant !== "accordion" && group.sheets.length > previewLimit;

          return (
            <section key={group.category}>
              <button
                type="button"
                onClick={() => {
                  if (variant === "accordion") {
                    setOpenTopic((current) => (current === group.category ? undefined : group.category));
                    return;
                  }
                  setSelected(group.category);
                }}
                className={cn("mb-2 flex w-full items-center gap-3 text-left", focusRing)}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                  style={{ backgroundColor: theme.soft, color: theme.accent }}
                >
                  {categoryGlyph(identity.icon, "h-5 w-5")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold text-[color:var(--text-heading)]">
                    {group.category}
                  </span>
                  <span className="block text-xs font-bold" style={{ color: theme.accent }}>
                    <span className="nums">{group.sheets.length}</span> sheets
                  </span>
                </span>
                {variant === "accordion" ? (
                  <ChevronDown
                    className={cn("h-4 w-4 text-[color:var(--text-muted)]", accordionOpen && "rotate-180")}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
              {accordionOpen ? (
                <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
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
                        "flex min-h-12 w-full items-center justify-center border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-sm font-bold text-[color:var(--clinical-accent)]",
                        focusRing,
                      )}
                    >
                      {isExpanded
                        ? `Show fewer in ${group.category}`
                        : `Show all ${group.sheets.length} in ${group.category}`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {moreOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-[color:var(--overlay-backdrop)]">
          <button type="button" aria-label="Close more topics" className="flex-1" onClick={() => setMoreOpen(false)} />
          <div className="rounded-t-2xl border-t border-[color:var(--border)] bg-[color:var(--surface)] px-4 pb-6 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-extrabold text-[color:var(--text-heading)]">More topics</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className={cn("grid h-11 w-11 place-items-center rounded-lg", focusRing)}
                aria-label="Close more topics"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ul className="grid gap-1">
              {overflow.map((category) => (
                <li key={category}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(category);
                      setMoreOpen(false);
                    }}
                    className={cn(
                      "flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-sm font-bold text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)]",
                      focusRing,
                    )}
                  >
                    {category}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChipButton({
  current,
  onClick,
  label,
  count,
}: {
  current: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={current}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold",
        focusRing,
        current
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] text-[color:var(--text-muted)]",
      )}
    >
      {label}
      {typeof count === "number" && count > 0 ? <span className="nums text-xs">{count}</span> : null}
    </button>
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
  const theme = categoryTheme(sheet.category);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 border-b border-[color:var(--border)] text-left last:border-b-0 hover:bg-[color:var(--surface-subtle)]",
        focusRing,
        dense ? "px-3 py-2.5" : "px-4 py-3.5",
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
