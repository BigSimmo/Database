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
<<<<<<< HEAD
import { medicationMatchesCommandScopes } from "@/lib/search-command-surface";
import { cn, toneDanger, toneInfo, toneNeutral, toneSuccess, toneWarning } from "@/components/ui-primitives";
=======
import { useMedicationCatalog } from "@/components/clinical-dashboard/use-medication-catalog";
import { medicationMatchesCommandScopes } from "@/lib/search-command-surface";
import { isDeployedClinicalKb } from "@/lib/deployed-app";
import { cn } from "@/components/ui-primitives";
>>>>>>> origin/main

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
    icon: CalendarDays,
  },
  {
    label: "Safety",
    description: "Avoid and cautions",
    icon: ShieldCheck,
  },
  {
    label: "Monitoring",
    description: "Baseline and follow-up",
    icon: Activity,
  },
  {
    label: "Access",
    description: "PBS and brand",
    icon: Lock,
  },
];

const medicationPrompts = [
  { label: "acamprosate renal dose", icon: Pill },
  { label: "naltrexone opioid use", icon: UserRound },
  { label: "sertraline max dose", icon: ShieldCheck },
];

<<<<<<< HEAD
const medicationIdentityBadges: ClinicalBadgeItem[] = [
  { label: "333 mg EC tablet", tone: "neutral" },
  { label: "PBS streamlined", tone: "success" },
  { label: "Reviewed", tone: "success", icon: BadgeCheck },
];

const accessBadges: ClinicalBadgeItem[] = [
  { label: "Campral", tone: "neutral", icon: Pill },
  { label: "PBS streamlined", tone: "success" },
  { label: "Item 8357W", tone: "neutral" },
];

const medicationResults: MedicationResult[] = [
  {
    id: "acamprosate",
    name: "Acamprosate",
    indication: "Alcohol abstinence maintenance",
    match: "Exact renal dose match",
    dose: "666 mg TID",
    ceiling: "1,998 mg/day",
    action: "Contraindicated in renal insufficiency (serum creatinine >120 micromol/L).",
    tone: "teal",
    href: "/medications/acamprosate",
  },
  {
    id: "naltrexone",
    name: "Naltrexone",
    indication: "Alcohol use disorder treatment",
    match: "Good clinical fit",
    dose: "50 mg daily",
    ceiling: "50 mg/day",
    action: "Check opioid use; risk of precipitated withdrawal.",
    tone: "blue",
  },
  {
    id: "disulfiram",
    name: "Disulfiram",
    indication: "Alcohol use disorder treatment",
    match: "Caution fit",
    dose: "250 mg daily",
    ceiling: "500 mg/day",
    action: "Counsel on alcohol reaction; check liver function.",
    tone: "slate",
  },
  {
    id: "baclofen",
    name: "Baclofen",
    indication: "Alcohol use disorder treatment (off-label)",
    match: "Lower clinical fit",
    dose: "5 mg TID",
    ceiling: "80 mg/day",
    action: "Specialist use; reduce dose in renal impairment; monitor sedation.",
    tone: "slate",
  },
];

const detailRows: DetailRow[] = [
  {
    label: "Prescribing answer",
    icon: ClipboardList,
    summary: "Maintenance of alcohol abstinence after withdrawal, with renal function checked and support in place.",
    body: [
      "Use for maintenance of alcohol abstinence once withdrawal is complete and the patient is abstinent.",
      "Use alongside psychosocial support and relapse prevention. Not for acute alcohol withdrawal.",
    ],
    badges: [
      { label: "Abstinence maintenance", tone: "clinical", icon: CheckCircle2 },
      { label: "After withdrawal", tone: "neutral" },
      { label: "Psychosocial support", tone: "neutral" },
    ],
  },
  {
    label: "Dosing",
    icon: CalendarDays,
    summary: "666 mg TID with meals. Dose ceiling 1,998 mg/day.",
    columnStyle: "ledger",
    columns: [
      { label: "Usual dose", value: "666 mg (2 x 333 mg) TID with meals" },
      { label: "Dose ceiling", value: "1,998 mg/day", meta: "MAX", metaTone: "neutral" },
      { label: "Under 60 kg", value: "2 tablets morning, 1 midday, 1 night" },
      { label: "Treatment duration", value: "Around 1 year" },
    ],
    badges: [
      { label: "666 mg TID", tone: "clinical", icon: CalendarDays },
      { label: "Max 1,998 mg/day", tone: "neutral", icon: Gauge },
      { label: "Reduce <60 kg", tone: "warning", icon: UserRound },
      { label: "Around 1 year", tone: "neutral" },
    ],
  },
  {
    label: "Administration",
    icon: Pill,
    summary: "Take with food. Swallow enteric-coated tablets whole.",
    body: ["Take with food. Swallow EC tablets whole with water.", "Do not crush or chew."],
    badges: [
      { label: "Take with food", tone: "clinical" },
      { label: "Swallow whole", tone: "clinical" },
      { label: "Do not crush", tone: "warning" },
    ],
  },
  {
    label: "Do not use",
    icon: AlertTriangle,
    tone: "danger",
    summary: "Avoid if serum creatinine >120 micromol/L, Child-Pugh C, pregnancy, or breastfeeding.",
    body: [
      "Known hypersensitivity to acamprosate or excipients.",
      "Renal insufficiency: serum creatinine >120 micromol/L (contraindicated)",
      "Severe hepatic failure (Child-Pugh C) (contraindicated)",
      "Pregnancy (DO NOT USE)",
      "Breastfeeding (DO NOT USE)",
    ],
    badges: [
      { label: "Cr >120 avoid", tone: "danger", icon: Droplet },
      { label: "Child-Pugh C", tone: "danger", icon: ShieldCheck },
      { label: "Pregnancy", tone: "danger" },
      { label: "Breastfeeding", tone: "danger" },
    ],
  },
  {
    label: "Populations",
    icon: UserRound,
    summary: "Avoid under 18 years and over 65 years because safety and efficacy are not established.",
    body: "Avoid use in children/adolescents under 18 years and adults over 65 years: safety and efficacy are not established.",
    badges: [
      { label: "Avoid <18 years", tone: "warning", icon: UserRound },
      { label: "Avoid >65 years", tone: "warning" },
    ],
  },
  {
    label: "Key risks",
    icon: ShieldCheck,
    summary: "Adverse effects grouped by system; separate from contraindications and do-not-use criteria.",
    columnStyle: "systems",
    columns: [
      {
        label: "Gastrointestinal",
        value: "Diarrhoea; nausea, vomiting, abdominal pain, flatulence",
        meta: "Very common / common",
        metaTone: "warning",
      },
      { label: "Skin", value: "Rash and pruritus", meta: "Common", metaTone: "neutral" },
      {
        label: "Sexual function",
        value: "Reduced libido, impotence or frigidity",
        meta: "Common",
        metaTone: "neutral",
      },
      {
        label: "Neuropsychiatric",
        value: "Mood change, depression, suicidal ideation: monitor clinically",
        meta: "Monitor",
        metaTone: "clinical",
      },
    ],
    badges: [
      { label: "Very common GI", tone: "warning" },
      { label: "Mood monitor", tone: "clinical" },
      { label: "Not contraindications", tone: "neutral" },
    ],
  },
  {
    label: "Pearls / PK",
    icon: FlaskConical,
    compact: true,
    summary: "Renally excreted unchanged; half-life 13-28.4 hours.",
    body: [
      "Mechanism is not fully established.",
      "Not metabolised; excreted unchanged in urine.",
      "Apparent half-life 13-28.4 h; minimal plasma protein binding.",
    ],
    badges: [
      { label: "Renal excretion", tone: "neutral" },
      { label: "Half-life 13-28.4 h", tone: "neutral" },
      { label: "Low protein binding", tone: "neutral" },
    ],
  },
];

const sideSections: SideSection[] = [
  {
    title: "Checks and monitoring",
    icon: Activity,
    items: [
      { label: "Renal function", body: "Check baseline and periodically.", icon: Droplet },
      { label: "Hepatic status", body: "Avoid in severe hepatic failure; assess if suspected.", icon: ShieldCheck },
      { label: "Mood / suicidality", body: "Monitor, especially early in treatment.", icon: Brain },
      { label: "Adherence", body: "Reinforce regular dosing and psychosocial support.", icon: ClipboardCheck },
    ],
  },
  {
    title: "Interactions",
    icon: ArrowLeftRight,
    items: [
      { label: "Diazepam, disulfiram, imipramine", body: "No major PK interactions." },
      { label: "Naltrexone", body: "Increases acamprosate exposure; no dose adjustment required." },
      { label: "Other psychotropics", body: "Evidence is limited; monitor clinically." },
    ],
  },
];

type MedicationSectionId = "summary" | "dosing" | "safety" | "more";
type ClinicalDetailView = "core" | "full";

const medicationSummaryTabs: Array<{ label: string; target: MedicationSectionId }> = [
  { label: "Summary", target: "summary" },
  { label: "Dosing", target: "dosing" },
  { label: "Safety", target: "safety" },
  { label: "More", target: "more" },
];

const coreDetailLabels = new Set(["Prescribing answer", "Dosing", "Administration", "Do not use"]);

function medicationSectionIdForLabel(label: string): MedicationSectionId {
  if (label === "Dosing") return "dosing";
  if (label === "Do not use" || label === "Key risks") return "safety";
  if (label === "Populations" || label === "Pearls / PK") return "more";
  return "summary";
}

=======
>>>>>>> origin/main
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
    <span className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
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
        description: "Open a prescribing-focused search.",
        icon: prompt.icon,
        onClick: () => onSuggestedSearch(prompt.label),
        disabled: loading,
        testId: `medication-prompt-${prompt.label.split(" ")[0]}`,
      }))}
      pillsTitle="Medication checks"
      pills={medicationCapabilities.map((item) => ({
        label: item.label,
        icon: item.icon,
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
      className="flex gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
      aria-label="Medication result filters"
    >
      {medicationResultFilters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          aria-pressed={activeFilter === filter.id}
          onClick={() => onFilterChange(filter.id)}
          className={cn(
            "min-h-8 shrink-0 rounded-lg border px-2.5 text-2xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:px-3 sm:text-xs",
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
<<<<<<< HEAD
  const [activeFilter, setActiveFilter] = useState<MedicationResultFilter>("best");
  const visibleMedicationResults = useMemo(() => {
    const filtered = medicationResults.filter((result) => resultMatchesFilter(result, activeFilter));
    const scopes = command?.commandScopes ?? [];
    if (!scopes.length) return filtered;
    return filtered.filter((result) => medicationMatchesCommandScopes(result, scopes));
  }, [activeFilter, command?.commandScopes]);
=======
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
>>>>>>> origin/main
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

<<<<<<< HEAD
      <div className="hidden overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)] md:block">
        <div className="grid grid-cols-[minmax(16rem,1.15fr)_minmax(6.5rem,0.42fr)_minmax(8rem,0.48fr)_minmax(16rem,1fr)_2rem] border-b border-[color:var(--border)] px-4 py-2 text-xs font-semibold text-[color:var(--text-muted)]">
          <span>Medication</span>
          <span>Dose</span>
          <span>Ceiling</span>
          <span>Prescribing action</span>
          <span className="sr-only">Open</span>
        </div>
        <div className="divide-y divide-[color:var(--border)]">
          {visibleMedicationResults.map((result) => {
            const selected = result.id === "acamprosate";
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
                  <ChevronRight className="h-4 w-4 justify-self-end text-[color:var(--text-soft)]" aria-hidden="true" />
                ) : (
                  <span className="justify-self-end text-3xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                    Soon
=======
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
>>>>>>> origin/main
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
