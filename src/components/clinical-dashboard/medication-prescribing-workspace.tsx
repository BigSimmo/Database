"use client";

import {
  Activity,
  Ban,
  CalendarDays,
  CircleCheck,
  ChevronRight,
  Lock,
  Pill,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import { considerationSummaryBadge } from "@/components/clinical-dashboard/medication-considerations";
import { usePatientProfile } from "@/components/clinical-dashboard/patient-profile-context";
import { PatientProfilePanel } from "@/components/clinical-dashboard/patient-profile-panel";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { useMedicationCatalog } from "@/components/clinical-dashboard/use-medication-catalog";
import { evaluatePatientAlerts } from "@/lib/medication-patient-alerts";
import {
  BadgeCluster,
  ClinicalBadge,
  type ClinicalBadgeItem,
  type ClinicalBadgeTone,
} from "@/components/clinical-dashboard/clinical-badge";
import { medicationIdentityBadges, type MedicationRecord } from "@/lib/medications";
import { medicationMatchesCommandScopes } from "@/lib/search-command-surface";
import { SEMANTIC_TONE_META } from "@/lib/semantic-tone";
import { isDeployedClinicalKb } from "@/lib/deployed-app";
import { cn, EmptyState, pageContainer } from "@/components/ui-primitives";

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
  actionTone: "danger" | "warning" | "neutral";
  tone: "teal" | "blue" | "slate";
  href?: string;
};

type MedicationRow = {
  result: MedicationResult;
  badges: ClinicalBadgeItem[];
  /** Per-medication (drug-class) identity accent hex, for a subtle icon tint. */
  accent?: string;
};

type MedicationResultFilter = "best" | "indication" | "safety" | "monitoring";

const medicationResultFilters: Array<{ id: MedicationResultFilter; label: string; icon: LucideIcon }> = [
  { id: "best", label: "Best", icon: Sparkles },
  { id: "indication", label: "Indication", icon: Target },
  { id: "safety", label: "Safety", icon: ShieldAlert },
  { id: "monitoring", label: "Monitor", icon: Activity },
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
    description: "Contraindications and cautions",
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
  className,
}: Pick<
  MedicationPrescribingWorkspaceProps,
  "realDataReady" | "authUnavailable" | "apiUnavailable" | "setupWarning"
> & {
  className?: string;
}) {
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
    <div
      className={cn(
        "mx-auto max-w-2xl rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-center text-xs font-medium text-[color:var(--text-muted)]",
        className,
      )}
    >
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
      title="Medication"
      subtitle="Medication dosing and safety."
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
  // actionTone is source-derived (contraindication vs caution vs monitoring content),
  // so it is a stronger signal than the text heuristics — any row whose action shows
  // a safety icon (danger or warning) must be reachable through the Safety chip. The
  // chips are lenses, not partitions, so warning rows may also appear under Monitor.
  if (filter === "safety") {
    return result.actionTone !== "neutral" || /check|avoid|caution|ceiling|max/i.test(result.action);
  }
  return (
    result.actionTone === "warning" ||
    /monitor|level|review|renal|hepatic/i.test(`${result.action} ${result.dose} ${result.ceiling}`)
  );
}

function FilterStrip({
  activeFilter,
  counts,
  onFilterChange,
}: {
  activeFilter: MedicationResultFilter;
  counts: Record<MedicationResultFilter, number>;
  onFilterChange: (filter: MedicationResultFilter) => void;
}) {
  return (
    <div
      className="medication-filter-strip answer-suggestion-row-scroll flex gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
      aria-label="Medication result filters"
    >
      {medicationResultFilters.map((filter) => {
        const active = activeFilter === filter.id;
        const Icon = filter.icon;
        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={active}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-2xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:px-3 sm:text-xs",
              active
                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)]",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {filter.label}
            <span
              className={cn("nums text-2xs font-semibold", active ? "opacity-80" : "text-[color:var(--text-muted)]")}
            >
              {counts[filter.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ResultToneIcon({ result, accent }: { result: MedicationResult; accent?: string }) {
  const tone = result.tone === "teal" ? "teal" : result.tone === "blue" ? "blue" : "slate";
  if (accent) {
    // Decorative per-medication (class) accent tint; a soft wash + border keeps
    // it legible in light and dark without carrying semantic meaning.
    return (
      <span
        aria-hidden="true"
        style={{
          background: `color-mix(in srgb, ${accent} 12%, var(--surface))`,
          borderColor: `color-mix(in srgb, ${accent} 34%, var(--surface))`,
          color: accent,
        }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)]"
      >
        <Pill className="h-[54%] w-[54%]" aria-hidden="true" />
      </span>
    );
  }
  return <IconTile icon={Pill} tone={tone} className="h-9 w-9" />;
}

const matchBadgeTone: Record<MedicationResult["tone"], ClinicalBadgeTone> = {
  teal: "clinical",
  blue: "info",
  slate: "neutral",
};

function ResultMatchBadge({ result }: { result: MedicationResult }) {
  return <ClinicalBadge label={result.match} tone={matchBadgeTone[result.tone]} icon={CircleCheck} />;
}

// Small leading icon for the prescribing-action text: contraindication content is
// a quiet stop signal (Ban, danger colour), monitoring content a check-first
// caution (TriangleAlert, warning colour). The text itself stays heading-coloured
// so red remains reserved and readable per the badge governance guide.
function ActionToneIcon({ tone, className }: { tone: MedicationResult["actionTone"]; className?: string }) {
  if (tone === "neutral") return null;
  const Icon = tone === "danger" ? Ban : TriangleAlert;
  return (
    <>
      <span className="sr-only">{SEMANTIC_TONE_META[tone].ariaPrefix}: </span>
      <Icon
        className={cn(
          "shrink-0",
          tone === "danger" ? "text-[color:var(--danger-text)]" : "text-[color:var(--warning-text)]",
          className,
        )}
        aria-hidden="true"
      />
    </>
  );
}

// Highlight the first query token inside the medication name when it is a plain
// substring match; synonym/expanded matches simply render unhighlighted.
function HighlightedName({ text, term }: { text: string; term: string }) {
  const token = term.trim().split(/\s+/)[0] ?? "";
  if (token.length < 2) return <>{text}</>;
  const index = text.toLowerCase().indexOf(token.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-[color:var(--clinical-accent-soft)] px-0.5 text-inherit">
        {text.slice(index, index + token.length)}
      </mark>
      {text.slice(index + token.length)}
    </>
  );
}

function DoseCeiling({ value }: { value: string }) {
  return (
    <span className="inline-flex min-h-6 w-fit items-center gap-1.5 text-2xs font-semibold text-[color:var(--text-muted)]">
      <span className="rounded border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-2xs uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
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
  // Ranking only needs identity fields; `fields=index` keeps keystroke fetches ~100KB
  // instead of the full ~2.5MB catalogue. Patient alerts that need section rows still
  // run on the medication detail page (full record).
  const catalog = useMedicationCatalog(query, { fields: "index" });
  const { profile, isEmpty: profileEmpty } = usePatientProfile();
  const [activeFilter, setActiveFilter] = useState<MedicationResultFilter>("best");
  const { rows, counts, totalAvailable } = useMemo(() => {
    const governance = catalog.data?.governance;
    const toRow = (result: MedicationResult, medication?: MedicationRecord): MedicationRow => {
      const badges = medication ? medicationIdentityBadges(medication, governance?.[medication.slug]) : [];
      const accent = medication?.accent;
      // Prepend a per-patient alert badge so the highest-severity consideration
      // surfaces first in the row's badge cluster (priority-sorted by tone).
      if (medication && !profileEmpty) {
        const alerts = evaluatePatientAlerts(medication, profile);
        const alertBadge = considerationSummaryBadge(alerts.considerations.length, alerts.highestTone);
        if (alertBadge) return { result, badges: [alertBadge, ...badges], accent };
      }
      return { result, badges, accent };
    };
    const sourceRows =
      catalog.data?.matches?.map((match) => toRow(match.result, match.medication)) ??
      (catalog.data?.records ?? []).slice(0, 12).map((record) =>
        toRow(
          {
            id: record.slug,
            name: record.name,
            indication: record.subclass || record.category,
            match: "Catalogue match",
            dose: "See reference",
            ceiling: "See reference",
            action: "Open full prescribing reference.",
            actionTone: "neutral" as const,
            tone: "slate" as const,
            href: `/medications/${record.slug}`,
          },
          record,
        ),
      );
    const scopes = command?.commandScopes ?? [];
    const scoped = scopes.length
      ? sourceRows.filter((row) => medicationMatchesCommandScopes(row.result, scopes))
      : sourceRows;
    const filterCounts: Record<MedicationResultFilter, number> = { best: 0, indication: 0, safety: 0, monitoring: 0 };
    for (const row of scoped) {
      for (const filter of medicationResultFilters) {
        if (resultMatchesFilter(row.result, filter.id)) filterCounts[filter.id] += 1;
      }
    }
    return {
      rows: scoped.filter((row) => resultMatchesFilter(row.result, activeFilter)),
      counts: filterCounts,
      totalAvailable: scoped.length,
    };
  }, [activeFilter, catalog.data, command?.commandScopes, profile, profileEmpty]);
  const resultCount = rows.length;
  // The match-quality badge only earns its slot when it differentiates: hide it on
  // "Exact clinical fit" rows when every visible row says the same thing.
  const showMatchBadge = useMemo(() => new Set(rows.map((row) => row.result.match)).size > 1, [rows]);
  const activeFilterLabel = medicationResultFilters.find((filter) => filter.id === activeFilter)?.label ?? "filtered";

  return (
    <div className={cn(pageContainer, "medication-results-workspace space-y-3 py-0 sm:py-2")}>
      <div className="hidden lg:block">
        <SearchResultsHeaderBand modeId="prescribing" query={query} matchCount={resultCount} />
      </div>
      <div className="medication-results-inset min-w-0 space-y-2 sm:flex sm:items-end sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">Medication search</p>
          <h3 className="text-2xl font-semibold leading-tight text-[color:var(--text-heading)] sm:text-3xl-minus">
            {resultCount} prescribing matches
          </h3>
        </div>
        <div className="min-w-0 sm:pb-0.5">
          <QueryChip query={query} />
        </div>
      </div>

      <PatientProfilePanel variant="compact" className="medication-patient-strip" />

      <FilterStrip activeFilter={activeFilter} counts={counts} onFilterChange={setActiveFilter} />

      {catalog.loading || catalog.error ? (
        <div className="medication-results-inset">
          {catalog.loading ? (
            <p className="text-sm text-[color:var(--text-muted)]">Loading medication catalogue…</p>
          ) : (
            <p className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger)]">
              {catalog.error}
            </p>
          )}
        </div>
      ) : null}

      {!catalog.loading && !catalog.error && resultCount === 0 ? (
        totalAvailable > 0 ? (
          <div className="medication-results-inset space-y-2">
            <EmptyState
              icon={SearchX}
              title={`No ${activeFilterLabel.toLowerCase()} matches for this search`}
              body="None of the current results carry this signal. Show all matches to keep browsing."
            />
            <button
              type="button"
              onClick={() => setActiveFilter("best")}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-semibold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              Show all {totalAvailable} matches
            </button>
          </div>
        ) : (
          <div className="medication-results-inset">
            <EmptyState
              icon={SearchX}
              title="No prescribing matches"
              body="Try a different medication name, class, or indication."
            />
          </div>
        )
      ) : null}

      {!catalog.loading && !catalog.error && resultCount > 0 ? (
        <div className="hidden overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)] lg:block">
          <div className="grid grid-cols-[minmax(16rem,1.15fr)_minmax(6.5rem,0.42fr)_minmax(8rem,0.48fr)_minmax(16rem,1fr)_2rem] border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-2 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            <span>Medication</span>
            <span>Dose</span>
            <span>Ceiling</span>
            <span>Prescribing action</span>
            <span className="sr-only">Open</span>
          </div>
          <div className="divide-y divide-[color:var(--border)]">
            {rows.map((row, index) => {
              const result = row.result;
              const selected = index === 0 && Boolean(query.trim());
              const rowClassName = cn(
                "group grid w-full grid-cols-[minmax(16rem,1.15fr)_minmax(6.5rem,0.42fr)_minmax(8rem,0.48fr)_minmax(16rem,1fr)_2rem] items-center gap-2.5 px-4 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[color:var(--focus)]",
                selected
                  ? "bg-[color:var(--clinical-accent-soft)]/35 shadow-[var(--shadow-rail-active)] ring-1 ring-inset ring-[color:var(--clinical-accent)]/35"
                  : result.href
                    ? "hover:bg-[color:var(--surface-subtle)]"
                    : "cursor-default opacity-80",
              );
              const rowContent = (
                <>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ResultToneIcon result={result} accent={row.accent} />
                    <div className="min-w-0">
                      <span className="block break-words text-base-minus font-semibold text-[color:var(--text-heading)]">
                        <HighlightedName text={result.name} term={query} />
                      </span>
                      <span className="line-clamp-1 break-words text-xs font-medium text-[color:var(--text-muted)]">
                        {result.indication}
                      </span>
                      {showMatchBadge || result.match !== "Exact clinical fit" || row.badges.length > 0 ? (
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                          {showMatchBadge || result.match !== "Exact clinical fit" ? (
                            <ResultMatchBadge result={result} />
                          ) : null}
                          <BadgeCluster items={row.badges} compact limit={3} showOverflowCount />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <span className="nums line-clamp-2 text-sm-minus font-semibold text-[color:var(--text-heading)]">
                    {result.dose}
                  </span>
                  <DoseCeiling value={result.ceiling} />
                  <span className="flex min-w-0 items-start gap-1.5 text-sm-minus font-medium leading-[1.4] text-[color:var(--text-heading)]">
                    <ActionToneIcon tone={result.actionTone} className="mt-0.5 h-3.5 w-3.5" />
                    <span className="line-clamp-2 min-w-0 break-words">{result.action}</span>
                  </span>
                  {result.href ? (
                    <ChevronRight
                      className="h-4 w-4 justify-self-end text-[color:var(--text-soft)] group-hover:text-[color:var(--clinical-accent)] motion-safe:transition motion-safe:group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="justify-self-end text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
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

      <div className="medication-mobile-results grid gap-2 lg:hidden">
        {rows.map((row, index) => {
          const result = row.result;
          const selected = index === 0 && Boolean(query.trim());
          const cardClassName = cn(
            "medication-mobile-result min-w-0 w-full rounded-lg border bg-[color:var(--surface-raised)] p-2 text-left shadow-[var(--shadow-inset)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
            selected
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]/35"
              : result.href
                ? "border-[color:var(--border)] hover:border-[color:var(--border-strong)]"
                : "border-[color:var(--border)] opacity-80",
          );
          const cardContent = (
            <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-2.5">
              <ResultToneIcon result={result} accent={row.accent} />
              <div className="min-w-0 space-y-1.5">
                <div className="min-w-0">
                  <p className="line-clamp-2 break-words text-base-minus font-semibold leading-5 text-[color:var(--text-heading)]">
                    <HighlightedName text={result.name} term={query} />
                  </p>
                  <p className="line-clamp-1 break-words text-xs font-medium text-[color:var(--text-muted)]">
                    {result.indication}
                  </p>
                </div>
                {showMatchBadge || result.match !== "Exact clinical fit" || row.badges.length > 0 ? (
                  <div className="flex max-w-full flex-wrap items-center gap-1.5">
                    {showMatchBadge || result.match !== "Exact clinical fit" ? (
                      <ResultMatchBadge result={result} />
                    ) : null}
                    <BadgeCluster items={row.badges} compact limit={2} showOverflowCount />
                  </div>
                ) : null}
                <div className="flex max-w-full flex-wrap items-center gap-1.5 text-sm-minus font-semibold text-[color:var(--text-heading)]">
                  <span className="nums line-clamp-2 break-words">{result.dose}</span>
                  <DoseCeiling value={result.ceiling} />
                </div>
                <p className="line-clamp-2 break-words text-pretty text-xs leading-[1.45] text-[color:var(--text-muted)]">
                  <ActionToneIcon tone={result.actionTone} className="mr-1 inline-block h-3.5 w-3.5 align-[-0.15em]" />
                  {result.action}
                </p>
              </div>
              {result.href ? (
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
              ) : (
                <span className="mt-1 shrink-0 rounded-md bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
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
                data-selected={selected ? "true" : "false"}
                className={cardClassName}
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <article
              key={result.id}
              data-testid={`medication-result-${result.id}-phone`}
              data-selected={selected ? "true" : "false"}
              className={cardClassName}
            >
              {cardContent}
            </article>
          );
        })}
      </div>

      <UniversalSearchAlsoMatches modeId="prescribing" query={query} className="medication-also-matches" />

      <StatusNotice
        realDataReady={realDataReady}
        authUnavailable={authUnavailable}
        apiUnavailable={apiUnavailable}
        setupWarning={setupWarning}
        className="medication-results-inset"
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
