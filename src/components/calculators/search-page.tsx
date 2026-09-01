"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, History, Info, LayoutGrid, ListChecks, Rows3, Search, Sigma } from "lucide-react";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";

import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
  resultFilterGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { SearchResultsLayout } from "@/components/clinical-dashboard/search-results-layout";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
  type AppliedFilterChip,
} from "@/components/clinical-dashboard/search-results-header-band";
import { ShowAllChip } from "@/components/show-all-chip";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { appModeIcons } from "@/lib/app-mode-icons";
import { appModeHomeHref } from "@/lib/app-modes";
import { consolidatedModeSearchPath } from "@/lib/consolidated-mode-home-redirect";

import {
  calculatorDomainCandidateCount,
  calculatorProgressCandidateCount,
  calculatorTimeCandidateCount,
  filterCalculatorRecords,
  normalizeCalculatorQuery,
  type CalculatorFilterState,
  type CalculatorProgressFilter,
  type CalculatorTimeFilter,
} from "./calculator-filters";
import {
  calculators,
  domainLabels,
  domainOrder,
  plannedCalculators,
  type CalculatorDomain,
  type CalculatorFixture,
} from "./calculator-fixtures";
import { CalculatorSheet } from "./calculator-sheet";
import {
  MetaPill,
  SeverityPill,
  deriveCalculator,
  focusRing,
  progressLabel,
  toneBar,
  type AnswerMap,
  type DerivedCalculator,
} from "./calculator-ui";

type SessionAnswers = Record<string, AnswerMap>;
type Density = "comfortable" | "compact";

const subscribeNoop = () => () => undefined;

const progressOptions: ReadonlyArray<{ value: CalculatorProgressFilter; label: string }> = [
  { value: "all", label: "Any" },
  { value: "not-started", label: "Not started" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

const timeOptions: ReadonlyArray<{ value: CalculatorTimeFilter; label: string }> = [
  { value: "all", label: "Any" },
  { value: "quick", label: "2 minutes or less" },
  { value: "standard", label: "3–4 minutes" },
  { value: "extended", label: "5+ minutes" },
];

function optionLabel<Value extends string>(options: ReadonlyArray<{ value: Value; label: string }>, value: Value) {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Match context: name / indication hit, or the first matching item text. */
function matchContext(calc: CalculatorFixture, query: string): string | null {
  if (!query) return null;
  const item = calc.items.find((entry) => entry.text.toLowerCase().includes(query));
  return item ? item.text : null;
}

function CalculatorTile({
  calc,
  derived,
  context,
  compact,
  onOpen,
}: {
  calc: CalculatorFixture;
  derived: DerivedCalculator;
  context: string | null;
  compact: boolean;
  onOpen: () => void;
}) {
  const Icon = calc.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${calc.abbrev} — ${calc.name}`}
      className={cn(
        "group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-left shadow-[var(--e2)] transition hover:-translate-y-0.5 hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)] hover:shadow-[var(--shadow-hover)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        focusRing,
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]",
          compact ? "size-10" : "size-tap",
        )}
      >
        <Icon className={compact ? "size-icon-lg" : "size-icon-xl"} aria-hidden="true" />
      </span>

      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base font-extrabold leading-6 text-[color:var(--text-heading)]">{calc.abbrev}</span>
          <span className="inline-flex min-h-5 items-center rounded-md bg-[color:var(--surface-subtle)] px-1.5 text-3xs font-bold uppercase tracking-label text-[color:var(--text-muted)]">
            {domainLabels[calc.domain]}
          </span>
          {derived.started ? (
            <SeverityPill tone={derived.result.tone} label={`${derived.score} · ${derived.result.label}`} />
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
          {calc.name}
        </span>
        {compact ? null : (
          <span className="mt-2 line-clamp-2 block text-sm-minus font-medium leading-5 text-[color:var(--text-muted)]">
            {calc.indication}
          </span>
        )}
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <MetaPill icon={ListChecks} label={`${calc.items.length} items`} />
          <MetaPill icon={Clock3} label={calc.timeEstimate} />
          {compact ? null : <MetaPill icon={Sigma} label={`${calc.minScore}–${calc.maxScore}`} />}
        </span>
        {context ? (
          <span className="mt-2 flex min-w-0 items-center gap-1.5 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
            <Search className="size-icon-xs shrink-0 text-[color:var(--decoration-soft)]" aria-hidden="true" />
            <span className="truncate">
              Matches item: <span className="italic">“{context}”</span>
            </span>
          </span>
        ) : null}
      </span>

      <ArrowRight
        className="size-icon-md shrink-0 self-center text-[color:var(--decoration-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--clinical-accent)] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        aria-hidden="true"
      />
    </button>
  );
}

function DensityControl({ density, onDensity }: { density: Density; onDensity: (next: Density) => void }) {
  return (
    <div
      className="inline-flex shrink-0 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-0.5 shadow-[var(--shadow-inset)]"
      aria-label="Calculator result density"
    >
      {(
        [
          ["comfortable", LayoutGrid, "Comfortable"],
          ["compact", Rows3, "Compact"],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={density === value}
          aria-label={`${label} density`}
          title={`${label} density`}
          onClick={() => onDensity(value)}
          className={cn(
            "grid size-9 place-items-center rounded-md transition motion-reduce:transition-none",
            density === value
              ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
            focusRing,
          )}
        >
          <Icon className="size-icon-md" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function ContinuePanel({
  inProgress,
  onOpen,
}: {
  inProgress: { calc: CalculatorFixture; derived: DerivedCalculator }[];
  onOpen: (calcId: string) => void;
}) {
  if (!inProgress.length) return null;
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--e1)]">
      <h2 className={cn(eyebrowText, "flex items-center gap-1.5 pb-3 text-[color:var(--text-muted)]")}>
        <History className="size-icon-xs" aria-hidden="true" />
        Continue this session
      </h2>
      <div className="grid gap-2">
        {inProgress.map(({ calc, derived }) => (
          <button
            key={calc.id}
            type="button"
            onClick={() => onOpen(calc.id)}
            className={cn(
              "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)]",
              focusRing,
            )}
          >
            <span aria-hidden="true" className={cn("inline-block size-2 rounded-full", toneBar[derived.result.tone])} />
            <span className="min-w-0">
              <span className="block truncate text-sm-minus font-bold text-[color:var(--text-heading)]">
                {calc.abbrev}
                <span className="ml-1.5 font-mono tabular-nums text-[color:var(--text-muted)]">
                  {derived.score}/{calc.maxScore}
                </span>
              </span>
              <span className="block truncate text-2xs font-semibold text-[color:var(--text-muted)]">
                {progressLabel(derived)} · {derived.result.label}
              </span>
            </span>
            <ArrowRight className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

function AboutPanel() {
  return (
    <section className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
      <h2 className="flex items-center gap-1.5 text-sm-minus font-extrabold text-[color:var(--text-heading)]">
        <Info className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden="true" />
        About these tools
      </h2>
      <p className="text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
        Scores support clinical judgement — they never replace a full assessment. Calculator answers remain in this
        browser session and are not intentionally submitted by this calculator interface. Application telemetry and
        clinical-record documentation are governed separately.
      </p>
      <p className="text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
        {plannedCalculators.length} candidate calculators remain governance-gated pending version, rights and workflow
        review.
      </p>
    </section>
  );
}

export function CalculatorsSearchPage({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const searchCommand = useSearchCommand();
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const query = hydrated ? (searchCommand?.query ?? initialQuery) : initialQuery;
  const normalizedQuery = normalizeCalculatorQuery(query);
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<ReadonlySet<CalculatorDomain>>(new Set());
  const [progress, setProgress] = useState<CalculatorProgressFilter>("all");
  const [time, setTime] = useState<CalculatorTimeFilter>("all");
  const [density, setDensity] = useState<Density>("comfortable");
  const [session, setSession] = useState<SessionAnswers>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const records = useMemo(
    () =>
      calculators.map((calc) => ({
        calc,
        derived: deriveCalculator(calc, session[calc.id] ?? {}),
      })),
    [session],
  );
  const filters = useMemo<CalculatorFilterState>(
    () => ({ domains: selectedDomains, progress, time }),
    [progress, selectedDomains, time],
  );
  const results = useMemo(
    () =>
      filterCalculatorRecords(records, query, filters).map((record) => ({
        ...record,
        context: matchContext(record.calc, normalizedQuery),
      })),
    [filters, normalizedQuery, query, records],
  );
  const inProgress = useMemo(() => records.filter((record) => record.derived.started), [records]);
  const activeCalc = openId ? calculators.find((calc) => calc.id === openId) : undefined;
  const activeFilterCount = selectedDomains.size + (progress === "all" ? 0 : 1) + (time === "all" ? 0 : 1);

  useEffect(() => {
    if (!activeCalc) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [activeCalc]);

  function toggleDomain(domain: CalculatorDomain) {
    setSelectedDomains((current) => {
      const next = new Set(current);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function clearFilters() {
    setSelectedDomains(new Set());
    setProgress("all");
    setTime("all");
  }

  const domainGroup = resultFilterFacetGroup({
    id: "clinical-domain",
    label: "Clinical domain",
    selected: selectedDomains,
    options: domainOrder.map((domain) => {
      const count = calculatorDomainCandidateCount(records, query, filters, domain);
      return {
        value: domain,
        label: domainLabels[domain],
        hint: String(count),
        disabled: count === 0 && !selectedDomains.has(domain),
      };
    }),
    onToggle: toggleDomain,
  });
  const progressGroup = resultFilterGroup({
    id: "session-progress",
    label: "Session progress",
    value: progress,
    options: progressOptions.map((option) => {
      const count = calculatorProgressCandidateCount(records, query, filters, option.value);
      return {
        ...option,
        hint: String(count),
        disabled: count === 0 && progress !== option.value,
      };
    }),
    onChange: setProgress,
    note: "one only",
  });
  const timeGroup = resultFilterGroup({
    id: "completion-time",
    label: "Completion time",
    value: time,
    options: timeOptions.map((option) => {
      const count = calculatorTimeCandidateCount(records, query, filters, option.value);
      return {
        ...option,
        hint: String(count),
        disabled: count === 0 && time !== option.value,
      };
    }),
    onChange: setTime,
    note: "one only",
  });

  const appliedFilters: AppliedFilterChip[] = [
    ...domainOrder
      .filter((domain) => selectedDomains.has(domain))
      .map((domain) => ({
        id: `domain-${domain}`,
        groupLabel: "Clinical domain",
        valueLabel: domainLabels[domain],
        onRemove: () => toggleDomain(domain),
      })),
    ...(progress === "all"
      ? []
      : [
          {
            id: `progress-${progress}`,
            groupLabel: "Session progress",
            valueLabel: optionLabel(progressOptions, progress),
            onRemove: () => setProgress("all"),
          },
        ]),
    ...(time === "all"
      ? []
      : [
          {
            id: `time-${time}`,
            groupLabel: "Completion time",
            valueLabel: optionLabel(timeOptions, time),
            onRemove: () => setTime("all"),
          },
        ]),
  ];

  return (
    <>
      <SearchResultsLayout
        testId="calculators-search-page"
        resultsLabel="Calculator results"
        header={
          <>
            <SearchResultsHeaderBand
              modeId="calculators"
              query={query}
              matchCount={results.length}
              headingLevel={1}
              filterLabel="Filter calculator results"
              appliedFilters={appliedFilters}
              onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
              mobileControlsPlacement="inline"
              mobileControls={
                <ResultFilterTrigger
                  panelId={filterPanelId}
                  testId="calculators-filter-trigger-phone"
                  title="Filter calculators"
                  open={filterOpen}
                  activeCount={activeFilterCount}
                  onToggle={() => setFilterOpen((current) => !current)}
                />
              }
              utilityControls={
                <span className="hidden items-center gap-2 sm:inline-flex">
                  <ResultFilterTrigger
                    panelId={filterPanelId}
                    testId="calculators-filter-trigger-desktop"
                    title="Filter calculators"
                    open={filterOpen}
                    activeCount={activeFilterCount}
                    onToggle={() => setFilterOpen((current) => !current)}
                  />
                  <DensityControl density={density} onDensity={setDensity} />
                </span>
              }
            />
            <div className="pt-3">
              <ShowAllChip
                href={consolidatedModeSearchPath("calculators")}
                icon={appModeIcons.calculators}
                ariaLabel="Show all calculators"
                testId="calculators-show-all"
              />
            </div>
            <ResultFilterSheet
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              panelId={filterPanelId}
              testId="calculators-filter-sheet"
              title="Filter calculators"
              description="Choose any clinical domains, then narrow by session progress and completion time."
              groups={[domainGroup, progressGroup, timeGroup]}
              onClearAll={activeFilterCount > 0 ? clearFilters : undefined}
              summary={{ count: results.length, noun: results.length === 1 ? "calculator" : "calculators" }}
              chromeResetKey={query}
            />
          </>
        }
        sidebar={
          <>
            <ContinuePanel inProgress={inProgress} onOpen={setOpenId} />
            <AboutPanel />
          </>
        }
        sidebarMobile={
          <div className="grid gap-4 xl:hidden">
            <ContinuePanel inProgress={inProgress} onOpen={setOpenId} />
            <AboutPanel />
          </div>
        }
      >
        {results.length ? (
          <div className={cn("grid gap-3", density === "compact" ? "sm:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2")}>
            {results.map(({ calc, derived, context }) => (
              <CalculatorTile
                key={calc.id}
                calc={calc}
                derived={derived}
                context={context}
                compact={density === "compact"}
                onOpen={() => setOpenId(calc.id)}
              />
            ))}
          </div>
        ) : (
          <SearchResultsEmptyState
            modeId="calculators"
            query={query}
            appliedFilters={appliedFilters}
            onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
            onClearSearch={() => router.push(appModeHomeHref("calculators", { focus: true }))}
            onTryExample={(example) => router.push(appModeHomeHref("calculators", { query: example, run: true }))}
          />
        )}
      </SearchResultsLayout>

      {activeCalc ? (
        <CalculatorSheet
          calc={activeCalc}
          answers={session[activeCalc.id] ?? {}}
          onAnswersChange={(next) => setSession((current) => ({ ...current, [activeCalc.id]: next }))}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  );
}
