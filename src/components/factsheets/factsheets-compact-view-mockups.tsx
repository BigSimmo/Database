"use client";

import { ChevronRight, LayoutGrid, List, ListCollapse, Rows3 } from "lucide-react";
import { useId, useState } from "react";

import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";
import { ResultFilterTrigger } from "@/components/clinical-dashboard/result-filter-control";
import { categoryTheme, type FactsheetCategory, type FactsheetIconKey } from "@/components/factsheets/factsheets-data";
import { factsheetGlyph } from "@/components/factsheets/factsheets-icons";
import { cn } from "@/components/ui-primitives";

/**
 * Design scratch: ultra-compact Factsheets result density controls.
 *
 * Reuses the live search-results band + category theming so the study matches
 * the shipped Factsheets search chrome. Each option is interactive. Long titles
 * are intentional — compact rows must still wrap cleanly (line-clamp), not
 * truncate mid-word into unreadable single lines.
 */

type LayoutMode = "list" | "cards";
type Density = "comfortable" | "compact";
type CycleMode = "list" | "dense" | "cards";

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

const SPECIMENS: Specimen[] = [
  {
    slug: "sertraline",
    title: "Sertraline",
    brand: "(Zoloft)",
    category: "Medications",
    icon: "capsule",
    audience: "Patients starting an SSRI",
    readTime: "6 min read",
    summary: "What to expect when starting sertraline, common side effects, and when to seek help.",
  },
  {
    slug: "metformin-weight",
    title: "Metformin for antipsychotic-associated weight gain",
    category: "Medications",
    icon: "tablet",
    audience: "Patients on antipsychotics",
    readTime: "8 min read",
    summary: "How metformin can help with weight gain from some antipsychotic medicines.",
  },
  {
    slug: "gad",
    title: "Generalised anxiety disorder: when worry gets out of control",
    category: "Conditions",
    icon: "worry",
    audience: "People with persistent worry",
    readTime: "7 min read",
    summary: "Plain-language overview of GAD symptoms, assessment, and first-line treatments.",
  },
  {
    slug: "cbt",
    title: "Cognitive behaviour therapy (CBT) for depression and anxiety",
    category: "Therapies",
    icon: "chatCheck",
    audience: "People considering talking therapy",
    readTime: "5 min read",
    summary: "What CBT sessions involve and how to prepare for a first appointment.",
  },
  {
    slug: "ecg",
    title: "Electrocardiogram (ECG) before starting certain psychiatric medicines",
    category: "Tests & procedures",
    icon: "heart",
    audience: "Patients starting QT-prolonging medicines",
    readTime: "4 min read",
    summary: "Why an ECG may be needed and what the test involves.",
  },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function ViewSegmented({
  value,
  onChange,
  modes,
}: {
  value: string;
  onChange: (next: string) => void;
  modes: Array<{ id: string; label: string; icon: "list" | "cards" | "dense" }>;
}) {
  return (
    <div
      role="group"
      aria-label="Result view"
      className="inline-flex min-h-tap overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)] sm:min-h-10"
    >
      {modes.map((mode, index) => {
        const isActive = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex min-h-tap items-center gap-1.5 px-2.5 text-xs font-bold capitalize transition sm:min-h-10",
              focusRing,
              index > 0 && "border-l border-[color:var(--border)]",
              isActive
                ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
            )}
          >
            {mode.icon === "list" ? (
              <List className="h-3.5 w-3.5" aria-hidden="true" />
            ) : mode.icon === "cards" ? (
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="max-[389px]:sr-only">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function CompactListRows({ sheets }: { sheets: Specimen[] }) {
  return (
    <section
      aria-label="Factsheet results"
      data-list-variant="compact"
      className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
    >
      {sheets.map((sheet) => {
        const theme = categoryTheme(sheet.category);
        return (
          <button
            key={sheet.slug}
            type="button"
            data-factsheet-result
            className={cn(
              "group flex w-full items-start gap-2.5 border-b border-[color:var(--border)] px-3 py-2.5 text-left transition last:border-b-0 hover:bg-[color:var(--surface-subtle)]",
              focusRing,
              "focus-visible:outline-offset-[-2px]",
            )}
          >
            <span
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg"
              style={{ backgroundColor: theme.soft, color: theme.accent }}
            >
              {factsheetGlyph(sheet.icon, "h-4 w-4")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="line-clamp-2 text-sm font-bold leading-snug text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                  {sheet.title}
                  {sheet.brand ? (
                    <span className="font-medium text-[color:var(--text-muted)]"> {sheet.brand}</span>
                  ) : null}
                </span>
                <span
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-bold"
                  style={{ backgroundColor: theme.soft, color: theme.accent }}
                >
                  {sheet.category}
                </span>
              </span>
            </span>
            <ChevronRight
              className="mt-1 h-4 w-4 shrink-0 text-[color:var(--decoration-soft)] transition group-hover:text-[color:var(--clinical-accent)]"
              aria-hidden="true"
            />
          </button>
        );
      })}
    </section>
  );
}

function CompactCards({ sheets }: { sheets: Specimen[] }) {
  return (
    <section aria-label="Factsheet results" data-card-variant="compact" className="grid grid-cols-2 gap-2.5">
      {sheets.map((sheet) => {
        const theme = categoryTheme(sheet.category);
        return (
          <button
            key={sheet.slug}
            type="button"
            data-factsheet-result
            className={cn(
              "group flex flex-col rounded-xl border border-[color:var(--border)] border-t-[3px] bg-[color:var(--surface)] p-2.5 text-left shadow-[var(--e2)] transition hover:border-[color:var(--border-strong)]",
              focusRing,
            )}
            style={{ borderTopColor: theme.accent }}
          >
            <span className="flex items-start justify-between gap-2">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                style={{ backgroundColor: theme.soft, color: theme.accent }}
              >
                {factsheetGlyph(sheet.icon, "h-3.5 w-3.5")}
              </span>
              <span
                className="rounded-md px-1.5 py-0.5 text-2xs font-bold"
                style={{ backgroundColor: theme.soft, color: theme.accent }}
              >
                {sheet.category}
              </span>
            </span>
            <span className="mt-2 line-clamp-3 text-sm font-bold leading-snug text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
              {sheet.title}
              {sheet.brand ? <span className="font-medium text-[color:var(--text-muted)]"> {sheet.brand}</span> : null}
            </span>
          </button>
        );
      })}
    </section>
  );
}

function ComfortableList({ sheets }: { sheets: Specimen[] }) {
  return (
    <section
      aria-label="Factsheet results"
      data-list-variant="comfortable"
      className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
    >
      {sheets.map((sheet) => {
        const theme = categoryTheme(sheet.category);
        return (
          <div
            key={sheet.slug}
            data-factsheet-result
            className="flex items-start gap-3.5 border-b border-[color:var(--border)] px-4 py-4 last:border-b-0"
          >
            <span
              className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg"
              style={{ backgroundColor: theme.soft, color: theme.accent }}
            >
              {factsheetGlyph(sheet.icon, "h-5 w-5")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base-minus font-bold text-[color:var(--text-heading)]">
                  {sheet.title}
                  {sheet.brand ? (
                    <span className="font-medium text-[color:var(--text-muted)]"> {sheet.brand}</span>
                  ) : null}
                </span>
                <span
                  className="rounded-md px-2 py-0.5 text-2xs font-bold"
                  style={{ backgroundColor: theme.soft, color: theme.accent }}
                >
                  {sheet.category}
                </span>
              </span>
              <span className="mt-1 block text-pretty text-sm-minus leading-5 text-[color:var(--text-muted)]">
                {sheet.summary}
              </span>
              <span className="mt-2 block text-xs font-bold text-[color:var(--text-muted)]">
                {sheet.audience} · {sheet.readTime}
              </span>
            </span>
            <ChevronRight
              className="h-5 w-5 shrink-0 self-center text-[color:var(--decoration-soft)]"
              aria-hidden="true"
            />
          </div>
        );
      })}
    </section>
  );
}

function ComfortableCards({ sheets }: { sheets: Specimen[] }) {
  return (
    <section aria-label="Factsheet results" data-card-variant="comfortable" className="grid gap-3">
      {sheets.map((sheet) => {
        const theme = categoryTheme(sheet.category);
        return (
          <button
            key={sheet.slug}
            type="button"
            data-factsheet-result
            className={cn(
              "group flex flex-col rounded-xl border border-[color:var(--border)] border-t-[3px] bg-[color:var(--surface)] p-4 text-left shadow-[var(--e2)] transition hover:border-[color:var(--border-strong)]",
              focusRing,
            )}
            style={{ borderTopColor: theme.accent }}
          >
            <span className="flex items-start justify-between gap-2">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                style={{ backgroundColor: theme.soft, color: theme.accent }}
              >
                {factsheetGlyph(sheet.icon, "h-5 w-5")}
              </span>
              <span
                className="rounded-md px-2 py-0.5 text-2xs font-bold"
                style={{ backgroundColor: theme.soft, color: theme.accent }}
              >
                {sheet.category}
              </span>
            </span>
            <span className="mt-2 text-base-minus font-bold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
              {sheet.title}
              {sheet.brand ? <span className="font-medium text-[color:var(--text-muted)]"> {sheet.brand}</span> : null}
            </span>
            <span className="mt-1 text-pretty text-sm-minus leading-5 text-[color:var(--text-muted)]">
              {sheet.summary}
            </span>
            <span className="mt-2 text-xs font-bold text-[color:var(--text-muted)]">
              {sheet.audience} · {sheet.readTime}
            </span>
          </button>
        );
      })}
    </section>
  );
}

function OptionFrame({
  id,
  title,
  blurb,
  children,
}: {
  id: string;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <article
      id={id}
      data-testid={id}
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 sm:p-4"
    >
      <header className="mb-3 px-1">
        <p className="text-2xs font-bold uppercase tracking-label text-[color:var(--clinical-accent)]">{title}</p>
        <p className="mt-1 text-sm-minus leading-5 text-[color:var(--text-muted)]">{blurb}</p>
      </header>
      <div className="mx-auto w-full max-w-[24.5rem] rounded-[1.35rem] border border-[color:var(--border-strong)] bg-[color:var(--surface)] p-3 shadow-[var(--e2)]">
        <p className="text-2xs font-bold uppercase tracking-label text-[color:var(--clinical-accent)]">Find a sheet</p>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-[color:var(--text-heading)]">
          Search patient information
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </article>
  );
}

function OptionA() {
  const [view, setView] = useState<"list" | "dense" | "cards">("dense");
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <OptionFrame
      id="option-a"
      title="Option A · 3-way density"
      blurb="List | Dense | Cards as one segmented control — same chrome as today, Dense is a third segment. Long titles wrap to two lines."
    >
      <SearchResultsHeaderBand
        modeId="factsheets"
        query=""
        matchCount={SPECIMENS.length}
        utilityControls={
          <ViewSegmented
            value={view}
            onChange={(next) => setView(next as typeof view)}
            modes={[
              { id: "list", label: "List", icon: "list" },
              { id: "dense", label: "Dense", icon: "dense" },
              { id: "cards", label: "Cards", icon: "cards" },
            ]}
          />
        }
        filterLabel="Filter factsheets by category"
        mobileControlsPlacement="inline"
        mobileControls={
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="mock-filter-a"
            title="Filter factsheets"
            open={filterOpen}
            activeCount={1}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
      />
      <div className="mt-3">
        {view === "list" ? (
          <ComfortableList sheets={SPECIMENS} />
        ) : view === "cards" ? (
          <CompactCards sheets={SPECIMENS} />
        ) : (
          <CompactListRows sheets={SPECIMENS} />
        )}
      </div>
    </OptionFrame>
  );
}

function OptionB() {
  const [layout, setLayout] = useState<LayoutMode>("list");
  const [compact, setCompact] = useState(true);
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <OptionFrame
      id="option-b"
      title="Option B · Compact switch"
      blurb="Keep List | Cards. A separate Compact toggle densifies whichever layout is active. Long titles stay readable via line-clamp."
    >
      <SearchResultsHeaderBand
        modeId="factsheets"
        query=""
        matchCount={SPECIMENS.length}
        utilityControls={
          <div className="flex min-w-0 items-center gap-1.5">
            <ViewSegmented
              value={layout}
              onChange={(next) => setLayout(next as LayoutMode)}
              modes={[
                { id: "list", label: "List", icon: "list" },
                { id: "cards", label: "Cards", icon: "cards" },
              ]}
            />
            <button
              type="button"
              aria-pressed={compact}
              aria-label={compact ? "Compact density on" : "Compact density off"}
              onClick={() => setCompact((current) => !current)}
              className={cn(
                "inline-flex min-h-tap items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition sm:min-h-10",
                focusRing,
                compact
                  ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
              )}
            >
              <ListCollapse className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="max-[389px]:sr-only">Compact</span>
              <span
                aria-hidden="true"
                className={cn(
                  "relative h-4 w-7 rounded-full transition",
                  compact ? "bg-[color:var(--clinical-accent)]" : "bg-[color:var(--border-strong)]",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-3 w-3 rounded-full bg-white transition",
                    compact ? "left-3.5" : "left-0.5",
                  )}
                />
              </span>
            </button>
          </div>
        }
        filterLabel="Filter factsheets by category"
        mobileControlsPlacement="inline"
        mobileControls={
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="mock-filter-b"
            title="Filter factsheets"
            open={filterOpen}
            activeCount={0}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
      />
      <div className="mt-3">
        {!compact && layout === "list" ? (
          <ComfortableList sheets={SPECIMENS} />
        ) : !compact && layout === "cards" ? (
          <ComfortableCards sheets={SPECIMENS} />
        ) : layout === "cards" ? (
          <CompactCards sheets={SPECIMENS} />
        ) : (
          <CompactListRows sheets={SPECIMENS} />
        )}
      </div>
    </OptionFrame>
  );
}

function OptionC() {
  const [mode, setMode] = useState<CycleMode>("dense");
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const labels: Record<CycleMode, string> = { list: "List", dense: "Dense", cards: "Cards" };
  const icons: Record<CycleMode, "list" | "dense" | "cards"> = {
    list: "list",
    dense: "dense",
    cards: "cards",
  };

  const cycle = () => {
    setMode((current) => (current === "list" ? "dense" : current === "dense" ? "cards" : "list"));
  };

  return (
    <OptionFrame
      id="option-c"
      title="Option C · Cycle button"
      blurb="One control cycles List → Dense → Cards. Smallest chrome. Titles still wrap to two lines in Dense."
    >
      <SearchResultsHeaderBand
        modeId="factsheets"
        query=""
        matchCount={SPECIMENS.length}
        utilityControls={
          <button
            type="button"
            onClick={cycle}
            aria-label={`Result view ${labels[mode]}. Tap to cycle.`}
            title="Cycle result view"
            className={cn(
              "inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-bold text-[color:var(--clinical-accent)] transition sm:min-h-10",
              focusRing,
            )}
          >
            {icons[mode] === "list" ? (
              <List className="h-3.5 w-3.5" aria-hidden="true" />
            ) : icons[mode] === "cards" ? (
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{labels[mode]}</span>
          </button>
        }
        filterLabel="Filter factsheets by category"
        mobileControlsPlacement="inline"
        mobileControls={
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="mock-filter-c"
            title="Filter factsheets"
            open={filterOpen}
            activeCount={1}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
      />
      <div className="mt-3">
        {mode === "list" ? (
          <ComfortableList sheets={SPECIMENS} />
        ) : mode === "cards" ? (
          <CompactCards sheets={SPECIMENS} />
        ) : (
          <CompactListRows sheets={SPECIMENS} />
        )}
      </div>
    </OptionFrame>
  );
}

function OptionD() {
  const [layout, setLayout] = useState<LayoutMode>("list");
  const [density, setDensity] = useState<Density>("compact");
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <OptionFrame
      id="option-d"
      title="Option D · Nested density"
      blurb="List | Cards stay primary. A secondary Comfortable | Compact control densifies either layout. Long titles wrap in Compact."
    >
      <SearchResultsHeaderBand
        modeId="factsheets"
        query=""
        matchCount={SPECIMENS.length}
        utilityControls={
          <ViewSegmented
            value={layout}
            onChange={(next) => setLayout(next as LayoutMode)}
            modes={[
              { id: "list", label: "List", icon: "list" },
              { id: "cards", label: "Cards", icon: "cards" },
            ]}
          />
        }
        filterLabel="Filter factsheets by category"
        mobileControlsPlacement="inline"
        mobileControls={
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="mock-filter-d"
            title="Filter factsheets"
            open={filterOpen}
            activeCount={1}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
      />
      <div
        role="group"
        aria-label="Result density"
        className="mt-2 inline-flex min-h-9 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
      >
        {(
          [
            { id: "comfortable", label: "Comfortable" },
            { id: "compact", label: "Compact" },
          ] as const
        ).map((entry, index) => {
          const isActive = density === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setDensity(entry.id)}
              className={cn(
                "inline-flex min-h-9 items-center px-2.5 text-2xs font-bold transition",
                focusRing,
                index > 0 && "border-l border-[color:var(--border)]",
                isActive
                  ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
              )}
            >
              {entry.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        {density === "comfortable" && layout === "list" ? (
          <ComfortableList sheets={SPECIMENS} />
        ) : density === "comfortable" && layout === "cards" ? (
          <ComfortableCards sheets={SPECIMENS} />
        ) : layout === "cards" ? (
          <CompactCards sheets={SPECIMENS} />
        ) : (
          <CompactListRows sheets={SPECIMENS} />
        )}
      </div>
    </OptionFrame>
  );
}

function OptionE() {
  const [view, setView] = useState<"list" | "dense" | "cards">("cards");
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <OptionFrame
      id="option-e"
      title="Option E · Icon triad + compact cards"
      blurb="Icon-only List / Dense / Cards. Compact cards keep a 2-column grid with line-clamped titles so long names still read."
    >
      <SearchResultsHeaderBand
        modeId="factsheets"
        query=""
        matchCount={SPECIMENS.length}
        utilityControls={
          <div
            role="group"
            aria-label="Result view"
            className="inline-flex min-h-tap overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)] sm:min-h-10"
          >
            {(
              [
                { id: "list", label: "List", icon: "list" as const },
                { id: "dense", label: "Dense", icon: "dense" as const },
                { id: "cards", label: "Cards", icon: "cards" as const },
              ] as const
            ).map((mode, index) => {
              const isActive = view === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-label={mode.label}
                  aria-pressed={isActive}
                  title={mode.label}
                  onClick={() => setView(mode.id)}
                  className={cn(
                    "inline-flex min-h-tap min-w-tap items-center justify-center px-2.5 transition sm:min-h-10 sm:min-w-10",
                    focusRing,
                    index > 0 && "border-l border-[color:var(--border)]",
                    isActive
                      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                  )}
                >
                  {mode.icon === "list" ? (
                    <List className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : mode.icon === "cards" ? (
                    <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        }
        filterLabel="Filter factsheets by category"
        mobileControlsPlacement="inline"
        mobileControls={
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="mock-filter-e"
            title="Filter factsheets"
            open={filterOpen}
            activeCount={0}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
      />
      <div className="mt-3">
        {view === "list" ? (
          <ComfortableList sheets={SPECIMENS} />
        ) : view === "dense" ? (
          <CompactListRows sheets={SPECIMENS} />
        ) : (
          <CompactCards sheets={SPECIMENS} />
        )}
      </div>
    </OptionFrame>
  );
}

export function FactsheetsCompactViewMockupsPage() {
  return (
    <div
      data-testid="factsheets-compact-view-mockups"
      className="mx-auto w-full max-w-[72rem] px-4 py-6 pb-8 sm:px-6 sm:py-8 lg:px-8"
    >
      <p className="text-2xs font-bold uppercase tracking-label text-[color:var(--clinical-accent)]">
        Factsheets · design scratch
      </p>
      <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">
        Ultra-compact list / cards options
      </h1>
      <p className="mt-2 max-w-3xl text-sm-minus leading-5 text-[color:var(--text-muted)]">
        Five control patterns for denser Factsheets results. Chrome reuses the live search band, List/Cards segment
        styling, and category tokens. Specimens include long titles so Compact must wrap (2–3 lines), not clip mid-word.
      </p>

      <nav aria-label="Options" className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["#option-a", "A · 3-way"],
            ["#option-b", "B · Switch"],
            ["#option-c", "C · Cycle"],
            ["#option-d", "D · Nested"],
            ["#option-e", "E · Icons"],
          ] as const
        ).map(([href, label]) => (
          <a
            key={href}
            href={href}
            className={cn(
              "inline-flex min-h-tap items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-9",
              focusRing,
            )}
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <OptionA />
        <OptionB />
        <OptionC />
        <OptionD />
        <OptionE />
      </div>
    </div>
  );
}
