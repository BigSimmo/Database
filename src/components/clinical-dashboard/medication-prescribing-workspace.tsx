"use client";

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Lock,
  Pill,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { useMedicationCatalog } from "@/components/clinical-dashboard/use-medication-catalog";
import { medicationMatchesCommandScopes } from "@/lib/search-command-surface";
import { isDeployedClinicalKb } from "@/lib/deployed-app";
import { cn } from "@/components/ui-primitives";

type MedicationPrescribingWorkspaceProps = {
  query: string;
  loading: boolean;
  realDataReady: boolean;
  authUnavailable: boolean;
  apiUnavailable: boolean;
  setupWarning: string | null;
  onSuggestedSearch: (searchText: string) => void;
};

type Capability = {
  label: string;
  description: string;
  query: string;
  icon: LucideIcon;
};

type MedicationResult = {
  id: string;
  name: string;
  indication: string;
  match: string;
  dose: string;
  ceiling: string;
  action: string;
  tone: "teal" | "blue" | "slate";
  href?: string;
};

type MedicationResultFilter = "best" | "indication" | "safety" | "monitoring";

const medicationResultFilters: Array<{ id: MedicationResultFilter; label: string }> = [
  { id: "best", label: "Best" },
  { id: "indication", label: "Indication" },
  { id: "safety", label: "Safety" },
  { id: "monitoring", label: "Monitor" },
];

const medicationCapabilities: Capability[] = [
  {
    label: "Dose",
    description: "Dosing and adjustment",
    query: "medication dose adjustment",
    icon: CalendarDays,
  },
  {
    label: "Safety",
    description: "Avoid and cautions",
    query: "medication contraindications and cautions",
    icon: ShieldCheck,
  },
  {
    label: "Monitoring",
    description: "Baseline and follow-up",
    query: "medication baseline and follow-up monitoring",
    icon: Activity,
  },
  {
    label: "Access",
    description: "PBS and brand",
    query: "medication PBS access and brand availability",
    icon: Lock,
  },
];

const medicationPrompts = [
  {
    label: "acamprosate renal dose",
    description: "Check renal dosing and contraindications.",
    icon: Pill,
  },
  {
    label: "naltrexone opioid use",
    description: "Review opioid-use precautions before prescribing.",
    icon: UserRound,
  },
  {
    label: "sertraline max dose",
    description: "Check maximum dose and titration guidance.",
    icon: ShieldCheck,
  },
];

function IconTile({
  icon: Icon,
  tone = "teal",
  className,
}: {
  icon: LucideIcon;
  tone?: "teal" | "blue" | "slate" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
        tone === "teal" &&
          "border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
        tone === "blue" &&
          "border-[color:var(--info-border)]/60 bg-[color:var(--info-bg)] text-[color:var(--info-text)]",
        tone === "slate" &&
          "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
        tone === "danger" &&
          "border-[color:var(--danger-border)]/70 bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]",
        className,
      )}
    >
      <Icon className="h-[54%] w-[54%]" aria-hidden="true" />
    </span>
  );
}

function StatusNotice({
  realDataReady,
  authUnavailable,
  apiUnavailable,
  setupWarning,
}: Pick<MedicationPrescribingWorkspaceProps, "realDataReady" | "authUnavailable" | "apiUnavailable" | "setupWarning">) {
  if (realDataReady && !authUnavailable && !apiUnavailable && !setupWarning) return null;
  const message = authUnavailable
    ? isDeployedClinicalKb()
      ? "Sign in to search your private medication library."
      : "Private medication search is waiting for sign-in."
    : apiUnavailable
      ? isDeployedClinicalKb()
        ? "Medication search is temporarily unavailable. Try again shortly."
        : "Medication search is using the local mockup while the API is unavailable."
      : setupWarning || "Medication search setup is still warming up.";

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-center text-xs font-medium text-[color:var(--text-muted)]">
      {message}
    </div>
  );
}

function QueryChip({ query }: { query: string }) {
  return (
    <span className="inline-flex min-h-tap max-w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
      <Pill className="h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden="true" />
      <span className="min-w-0 truncate">{query}</span>
    </span>
  );
}

function MedicationHome({
  loading,
  realDataReady,
  authUnavailable,
  apiUnavailable,
  setupWarning,
  onSuggestedSearch,
  desktopComposerSlotId,
}: Omit<MedicationPrescribingWorkspaceProps, "query"> & { desktopComposerSlotId?: string }) {
  return (
    <ModeHomeTemplate
      testId="medication-home"
      title="Medication prescribing"
      subtitle="Search a medication or prescribing question."
      icon={Pill}
      headingLevel={2}
      desktopComposerSlotId={desktopComposerSlotId}
      actionsLabel="Medication prompts"
      actions={medicationPrompts.map((prompt) => ({
        title: prompt.label,
        description: prompt.description,
        icon: prompt.icon,
        onClick: () => onSuggestedSearch(prompt.label),
        disabled: loading,
        testId: `medication-prompt-${prompt.label.split(" ")[0]}`,
      }))}
      pillsTitle="Medication checks"
      pills={medicationCapabilities.map((item) => ({
        label: item.label,
        icon: item.icon,
        onClick: () => onSuggestedSearch(item.query),
      }))}
      footer={
        <div className="grid gap-3">
          <StatusNotice
            realDataReady={realDataReady}
            authUnavailable={authUnavailable}
            apiUnavailable={apiUnavailable}
            setupWarning={setupWarning}
          />
          <ModeHomeVerificationFooter icon={ShieldCheck} label="Prescribing support" body="Confirm against source" />
        </div>
      }
    />
  );
}

function resultMatchesFilter(result: MedicationResult, filter: MedicationResultFilter) {
  if (filter === "best") return true;
  if (filter === "indication") return result.match !== "Related match";
  if (filter === "safety") return /check|avoid|caution|ceiling|max/i.test(result.action);
  return /monitor|level|review|renal|hepatic/i.test(`${result.action} ${result.dose} ${result.ceiling}`);
}

function FilterStrip({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: MedicationResultFilter;
  onFilterChange: (filter: MedicationResultFilter) => void;
}) {
  return (
    <div
      className="answer-suggestion-row-scroll flex gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
      aria-label="Medication result filters"
    >
      {medicationResultFilters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          aria-pressed={activeFilter === filter.id}
          onClick={() => onFilterChange(filter.id)}
          className={cn(
            "min-h-tap shrink-0 rounded-lg border px-2.5 text-2xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:px-3 sm:text-xs",
            activeFilter === filter.id
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)]",
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function ResultToneIcon({ result }: { result: MedicationResult }) {
  const tone = result.tone === "teal" ? "teal" : result.tone === "blue" ? "blue" : "slate";
  return <IconTile icon={Pill} tone={tone} className="h-9 w-9" />;
}

function ResultMatchBadge({ result }: { result: MedicationResult }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 w-fit items-center gap-1.5 rounded-md px-2 text-2xs font-semibold tracking-[0.06em]",
        result.tone === "teal" &&
          "border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
        result.tone === "blue" &&
          "border border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--info)]",
        result.tone === "slate" && "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
      )}
    >
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      {result.match}
    </span>
  );
}

function DoseCeiling({ value }: { value: string }) {
  return (
    <span className="inline-flex min-h-6 w-fit items-center gap-1.5 text-2xs font-semibold text-[color:var(--text-muted)]">
      <span className="rounded border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-3xs uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
        Ceiling
      </span>
      <span className="nums break-words text-[color:var(--text-heading)] md:whitespace-nowrap">{value}</span>
    </span>
  );
}

function MedicationResults({
  query,
  realDataReady,
  authUnavailable,
  apiUnavailable,
  setupWarning,
}: Pick<
  MedicationPrescribingWorkspaceProps,
  "query" | "realDataReady" | "authUnavailable" | "apiUnavailable" | "setupWarning"
>) {
  const command = useSearchCommand();
  const catalog = useMedicationCatalog(query);
  const [activeFilter, setActiveFilter] = useState<MedicationResultFilter>("best");
  const visibleMedicationResults = useMemo(() => {
    const sourceResults =
      catalog.data?.matches?.map((match) => match.result) ??
      (catalog.data?.records ?? []).slice(0, 12).map((record) => ({
        id: record.slug,
        name: record.name,
        indication: record.subclass || record.category,
        match: "Catalogue match",
        dose: "See reference",
        ceiling: "See reference",
        action: "Open full prescribing reference.",
        tone: "slate" as const,
        href: `/medications/${record.slug}`,
      }));
    const filtered = sourceResults.filter((result) => resultMatchesFilter(result, activeFilter));
    const scopes = command?.commandScopes ?? [];
    if (!scopes.length) return filtered;
    return filtered.filter((result) => medicationMatchesCommandScopes(result, scopes));
  }, [activeFilter, catalog.data, command?.commandScopes]);
  const resultCount = visibleMedicationResults.length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 py-0 sm:py-2">
      <div className="hidden lg:block">
        <SearchResultsHeaderBand modeId="prescribing" query={query} matchCount={resultCount} />
      </div>
      <div className="min-w-0 space-y-2 sm:flex sm:items-end sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">Medication search</p>
          <h3 className="text-2xl font-semibold leading-tight text-[color:var(--text-heading)] sm:text-[1.65rem]">
            {resultCount} prescribing matches
          </h3>
        </div>
        <div className="min-w-0 sm:pb-0.5">
          <QueryChip query={query} />
        </div>
      </div>

      <FilterStrip activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {catalog.loading ? (
        <p className="text-sm text-[color:var(--text-muted)]">Loading medication catalogueâ€¦</p>
      ) : catalog.error ? (
        <p className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger)]">
          {catalog.error}
        </p>
      ) : null}

      {!catalog.loading && !catalog.error ? (
        <div className="hidden overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)] md:block">
          <div className="grid grid-cols-[minmax(16rem,1.15fr)_minmax(6.5rem,0.42fr)_minmax(8rem,0.48fr)_minmax(16rem,1fr)_2rem] border-b border-[color:var(--border)] px-4 py-2 text-xs font-semibold text-[color:var(--text-muted)]">
            <span>Medication</span>
            <span>Dose</span>
            <span>Ceiling</span>
            <span>Prescribing action</span>
            <span className="sr-only">Open</span>
          </div>
          <div className="divide-y divide-[color:var(--border)]">
            {visibleMedicationResults.map((result, index) => {
              const selected = index === 0 && Boolean(query.trim());
              const rowClassName = cn(
                "grid w-full grid-cols-[minmax(16rem,1.15fr)_minmax(6.5rem,0.42fr)_minmax(8rem,0.48fr)_minmax(16rem,1fr)_2rem] items-center gap-2.5 px-4 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[color:var(--focus)]",
                selected
                  ? "bg-[color:var(--clinical-accent-soft)]/35 ring-1 ring-inset ring-[color:var(--clinical-accent)]/35"
                  : result.href
                    ? "hover:bg-[color:var(--surface-subtle)]"
                    : "cursor-default opacity-80",
              );
              const rowContent = (
                <>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <ResultToneIcon result={result} />
                    <span className="min-w-0">
                      <span className="block break-words text-base-minus font-semibold text-[color:var(--text-heading)]">
                        {result.name}
                      </span>
                      <span className="block break-words text-xs font-medium text-[color:var(--text-muted)]">
                        {result.indication}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <ResultMatchBadge result={result} />
                      </span>
                    </span>
                  </span>
                  <span className="text-sm-minus font-semibold text-[color:var(--text-heading)]">{result.dose}</span>
                  <DoseCeiling value={result.ceiling} />
                  <span className="break-words text-sm-minus font-medium leading-[1.4] text-[color:var(--text-heading)]">
                    {result.action}
                  </span>
                  {result.href ? (
                    <ChevronRight
                      className="h-4 w-4 justify-self-end text-[color:var(--text-soft)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="justify-self-end text-3xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                      Soon
                    </span>
                  )}
                </>
              );

              if (result.href) {
                return (
                  <Link
                    key={result.id}
                    href={result.href}
                    data-testid={`medication-result-${result.id}-desktop`}
                    className={rowClassName}
                  >
                    {rowContent}
                  </Link>
                );
              }

              return (
                <article
                  key={result.id}
                  data-testid={`medication-result-${result.id}-desktop`}
                  className={rowClassName}
                >
                  {rowContent}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 md:hidden">
        {visibleMedicationResults.map((result, index) => {
          const selected = index === 0 && Boolean(query.trim());
          const cardClassName = cn(
            "min-w-0 w-full rounded-lg border bg-[color:var(--surface-raised)] p-2 text-left shadow-[var(--shadow-inset)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
            selected
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]/35"
              : result.href
                ? "border-[color:var(--border)] hover:border-[color:var(--border-strong)]"
                : "border-[color:var(--border)] opacity-80",
          );
          const cardContent = (
            <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-2.5">
              <ResultToneIcon result={result} />
              <div className="min-w-0 space-y-1.5">
                <div className="min-w-0">
                  <p className="line-clamp-2 break-words text-base-minus font-semibold leading-5 text-[color:var(--text-heading)]">
                    {result.name}
                  </p>
                  <p className="break-words text-xs font-medium text-[color:var(--text-muted)]">{result.indication}</p>
                </div>
                <span className="flex max-w-full flex-wrap gap-1.5">
                  <ResultMatchBadge result={result} />
                </span>
                <div className="flex max-w-full flex-wrap items-center gap-1.5 text-sm-minus font-semibold text-[color:var(--text-heading)]">
                  <span className="break-words">{result.dose}</span>
                  <DoseCeiling value={result.ceiling} />
                </div>
                <p className="break-words text-pretty text-xs leading-[1.45] text-[color:var(--text-muted)]">
                  {result.action}
                </p>
              </div>
              {result.href ? (
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
              ) : (
                <span className="mt-1 shrink-0 rounded-md bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-3xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Soon
                </span>
              )}
            </div>
          );

          if (result.href) {
            return (
              <Link
                key={result.id}
                href={result.href}
                data-testid={`medication-result-${result.id}-phone`}
                className={cardClassName}
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <article key={result.id} data-testid={`medication-result-${result.id}-phone`} className={cardClassName}>
              {cardContent}
            </article>
          );
        })}
      </div>

      <StatusNotice
        realDataReady={realDataReady}
        authUnavailable={authUnavailable}
        apiUnavailable={apiUnavailable}
        setupWarning={setupWarning}
      />
    </div>
  );
}
export function MedicationPrescribingWorkspace({
  query,
  loading,
  realDataReady,
  authUnavailable,
  apiUnavailable,
  setupWarning,
  onSuggestedSearch,
  showHome = false,
  desktopComposerSlotId,
}: MedicationPrescribingWorkspaceProps & { showHome?: boolean; desktopComposerSlotId?: string }) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery || showHome) {
    return (
      <MedicationHome
        loading={loading}
        realDataReady={realDataReady}
        authUnavailable={authUnavailable}
        apiUnavailable={apiUnavailable}
        setupWarning={setupWarning}
        onSuggestedSearch={onSuggestedSearch}
        desktopComposerSlotId={desktopComposerSlotId}
      />
    );
  }

  return (
    <MedicationResults
      query={trimmedQuery}
      realDataReady={realDataReady}
      authUnavailable={authUnavailable}
      apiUnavailable={apiUnavailable}
      setupWarning={setupWarning}
    />
  );
}
