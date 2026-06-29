"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  Brain,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Droplet,
  FileText,
  FlaskConical,
  Lock,
  Pill,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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

type DetailRow = {
  label: string;
  icon: LucideIcon;
  body?: string | string[];
  columns?: Array<{ label: string; value: string; meta?: string }>;
  tone?: "default" | "danger";
  compact?: boolean;
};

type SideSection = {
  title: string;
  icon: LucideIcon;
  items: Array<{ label: string; body: string; icon?: LucideIcon }>;
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

const medicationResults: MedicationResult[] = [
  {
    id: "acamprosate",
    name: "Acamprosate",
    indication: "Alcohol abstinence maintenance",
    match: "Exact renal dose match",
    dose: "666 mg TID",
    ceiling: "1,998 mg/day",
    action: "Check renal function; avoid if serum creatinine >120 micromol/L.",
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
    body: [
      "Use for maintenance of abstinence after detox when renal function is acceptable and psychosocial support is in place.",
      "Start after withdrawal and continue if relapse occurs. Not for use in acute withdrawal.",
    ],
  },
  {
    label: "Dosing",
    icon: CalendarDays,
    columns: [
      { label: "Usual dose", value: "666 mg (2 x 333 mg) TID with meals" },
      { label: "Dose ceiling", value: "1,998 mg/day", meta: "MAX" },
      { label: "Under 60 kg", value: "2 tablets morning, 1 midday, 1 night" },
      { label: "Treatment duration", value: "Around 1 year" },
    ],
  },
  {
    label: "Administration",
    icon: Pill,
    body: ["Take with food. Swallow EC tablets whole with water.", "Do not crush or chew."],
  },
  {
    label: "Do not use",
    icon: AlertTriangle,
    tone: "danger",
    body: [
      "Renal insufficiency: serum creatinine >120 micromol/L (contraindicated)",
      "Severe hepatic failure (Child-Pugh C) (contraindicated)",
      "Pregnancy (DO NOT USE)",
      "Breastfeeding (DO NOT USE)",
    ],
  },
  {
    label: "Populations",
    icon: UserRound,
    body: "Avoid in children/adolescents under 18 years and in adults over 65 years: safety and efficacy not established.",
  },
  {
    label: "Key risks",
    icon: ShieldCheck,
    columns: [
      { label: "GI", value: "Diarrhea, nausea, flatulence (high)" },
      { label: "Dermatologic", value: "Rash, pruritus" },
      { label: "Neuropsychiatric", value: "Mood swings, depression" },
    ],
  },
  {
    label: "Pearls / PK",
    icon: FlaskConical,
    compact: true,
    body: "Mechanism not fully established  -  Not metabolized; excreted unchanged in urine  -  Half-life 13-28.4 h  -  Minimal protein binding",
  },
];

const sideSections: SideSection[] = [
  {
    title: "Checks and monitoring",
    icon: Activity,
    items: [
      { label: "Renal", body: "Check baseline and periodically", icon: Droplet },
      { label: "Hepatic (severe disease)", body: "Assess if severe liver disease suspected", icon: ShieldCheck },
      { label: "Mood / suicidality", body: "Monitor, especially early treatment", icon: Brain },
      { label: "Adherence", body: "Reinforce adherence and support", icon: ClipboardCheck },
    ],
  },
  {
    title: "Interactions",
    icon: ArrowLeftRight,
    items: [
      { label: "Diazepam, disulfiram, imipramine", body: "No major PK interactions." },
      { label: "Naltrexone", body: "Increases acamprosate exposure; no dose adjustment required." },
      { label: "Other psychotropics", body: "Not well studied." },
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

function scrollToMedicationSection(section: MedicationSectionId) {
  if (typeof document === "undefined") return;
  const targets = Array.from(document.querySelectorAll<HTMLElement>(`[data-medication-section="${section}"]`));
  const target = targets.find((item) => item.offsetParent !== null) ?? targets[0];
  if (!target) return;
  const stickyOffset = window.innerWidth < 640 ? 118 : 72;
  const rect = target.getBoundingClientRect();
  if (rect.top >= stickyOffset && rect.bottom <= window.innerHeight - 16) return;
  const top = Math.max(0, rect.top + window.scrollY - stickyOffset);
  window.scrollTo({ top, behavior: "auto" });
}

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
          "border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]",
        tone === "blue" && "border-blue-500/15 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
        tone === "slate" &&
          "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
        tone === "danger" && "border-red-500/25 bg-red-50 text-red-600 dark:bg-red-950/25 dark:text-red-300",
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
    ? "Private medication search is waiting for sign-in."
    : apiUnavailable
      ? "Medication search is using the local mockup while the API is unavailable."
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
      <Pill className="h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
      <span className="min-w-0 truncate">{query}</span>
    </span>
  );
}

function CapabilityGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "grid w-full max-w-3xl overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)]/80 shadow-[var(--shadow-inset)]",
        compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {medicationCapabilities.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              "min-h-[4.35rem] px-3 py-2.5",
              index > 0 && !compact && "sm:border-l sm:border-[color:var(--border)]",
              index % 2 === 1 && "border-l border-[color:var(--border)] sm:border-l",
              index > 1 && "border-t border-[color:var(--border)] sm:border-t-0",
            )}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <Icon className="h-4.5 w-4.5 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">{item.label}</p>
            </div>
            <p className="text-[11px] leading-4 text-[color:var(--text-muted)]">{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function MedicationHome({
  loading,
  realDataReady,
  authUnavailable,
  apiUnavailable,
  setupWarning,
  onSuggestedSearch,
}: Omit<MedicationPrescribingWorkspaceProps, "query">) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-17rem)] w-full max-w-4xl flex-col items-center gap-5 px-1 pb-8 pt-[clamp(3rem,8vh,6.5rem)] sm:gap-6">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16">
        <Pill className="h-7 w-7" aria-hidden="true" />
      </div>

      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">Medication search</p>
        <h3 className="text-3xl font-semibold text-[color:var(--text-heading)] sm:text-4xl">Medication prescribing</h3>
        <p className="mx-auto max-w-xl text-sm leading-6 text-[color:var(--text-muted)] sm:text-base">
          Search a medication or prescribing question.
        </p>
      </div>

      <CapabilityGrid />

      <div className="mx-auto grid w-full max-w-xl gap-2">
        {medicationPrompts.map((prompt) => {
          const Icon = prompt.icon;
          return (
            <button
              key={prompt.label}
              type="button"
              data-testid={`medication-prompt-${prompt.label.split(" ")[0]}`}
              onClick={() => onSuggestedSearch(prompt.label)}
              disabled={loading}
              className="group flex min-h-12 w-full items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-left text-sm font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-teal)]/35 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-wait disabled:opacity-60"
            >
              <IconTile icon={Icon} tone="teal" className="h-8 w-8" />
              <span className="min-w-0 flex-1 truncate">{prompt.label}</span>
              <ChevronRight
                className="h-4 w-4 text-[color:var(--text-soft)] transition group-hover:text-[color:var(--clinical-chat-teal)]"
                aria-hidden="true"
              />
            </button>
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

function resultMatchesFilter(result: MedicationResult, filter: MedicationResultFilter) {
  if (filter === "best") return true;
  if (filter === "indication") return result.indication.toLowerCase().includes("alcohol");
  if (filter === "safety") return result.action.toLowerCase().includes("check") || result.action.includes("renal");
  return result.id === "acamprosate" || result.id === "baclofen";
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
            "min-h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:px-3 sm:text-xs",
            activeFilter === filter.id
              ? "border-[color:var(--clinical-chat-teal)] bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
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
        "inline-flex min-h-6 w-fit items-center gap-1.5 rounded-md px-2 text-2xs font-semibold",
        result.tone === "teal" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
        result.tone === "blue" && "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
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
    <span className="inline-flex min-h-6 w-fit items-center gap-1.5 text-[11px] font-semibold text-[color:var(--text-muted)]">
      <span className="rounded border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
        Ceiling
      </span>
      <span className="text-[color:var(--text-heading)]">{value}</span>
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
  const [activeFilter, setActiveFilter] = useState<MedicationResultFilter>("best");
  const visibleMedicationResults = medicationResults.filter((result) => resultMatchesFilter(result, activeFilter));
  const resultCount = visibleMedicationResults.length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 py-0 sm:py-2">
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
                ? "bg-[color:var(--clinical-chat-teal-soft)]/35 ring-1 ring-inset ring-[color:var(--clinical-chat-teal)]/35"
                : result.href
                  ? "hover:bg-[color:var(--surface-subtle)]"
                  : "cursor-default opacity-80",
            );
            const rowContent = (
              <>
                <span className="flex min-w-0 items-center gap-2.5">
                  <ResultToneIcon result={result} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-[color:var(--text-heading)]">
                      {result.name}
                    </span>
                    <span className="block truncate text-xs font-medium text-[color:var(--text-muted)]">
                      {result.indication}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <ResultMatchBadge result={result} />
                    </span>
                  </span>
                </span>
                <span className="text-[13px] font-semibold text-[color:var(--text-heading)]">{result.dose}</span>
                <DoseCeiling value={result.ceiling} />
                <span className="text-[13px] font-medium leading-[1.4] text-[color:var(--text-heading)]">
                  {result.action}
                </span>
                {result.href ? (
                  <ChevronRight className="h-4 w-4 justify-self-end text-[color:var(--text-soft)]" aria-hidden="true" />
                ) : (
                  <span className="justify-self-end text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
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
              <article key={result.id} data-testid={`medication-result-${result.id}-desktop`} className={rowClassName}>
                {rowContent}
              </article>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 md:hidden">
        {visibleMedicationResults.map((result) => {
          const selected = result.id === "acamprosate";
          const cardClassName = cn(
            "w-full rounded-lg border bg-[color:var(--surface-raised)] p-2 text-left shadow-[var(--shadow-inset)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
            selected
              ? "border-[color:var(--clinical-chat-teal)] bg-[color:var(--clinical-chat-teal-soft)]/35"
              : result.href
                ? "border-[color:var(--border)] hover:border-[color:var(--border-strong)]"
                : "border-[color:var(--border)] opacity-80",
          );
          const cardContent = (
            <div className="flex items-start gap-2.5">
              <ResultToneIcon result={result} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold leading-5 text-[color:var(--text-heading)]">
                      {result.name}
                    </p>
                    <p className="truncate text-xs font-medium text-[color:var(--text-muted)]">{result.indication}</p>
                  </div>
                  {result.href ? (
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
                  ) : (
                    <span className="mt-1 rounded-md bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                      Soon
                    </span>
                  )}
                </div>
                <span className="flex flex-wrap gap-1.5">
                  <ResultMatchBadge result={result} />
                </span>
                <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-[color:var(--text-heading)]">
                  <span>{result.dose}</span>
                  <DoseCeiling value={result.ceiling} />
                </div>
                <p className="text-xs leading-[1.45] text-[color:var(--text-muted)]">{result.action}</p>
              </div>
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

function DetailTile({
  icon,
  label,
  value,
  meta,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  meta?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-h-[5rem] rounded-lg border bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)] sm:min-h-[5.45rem] sm:p-3.5",
        danger
          ? "border-red-500/35 bg-red-50/30 dark:bg-red-950/10"
          : "border-[color:var(--border)] hover:border-[color:var(--border-strong)]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <IconTile icon={icon} tone={danger ? "danger" : "teal"} className="h-8 w-8 sm:h-9 sm:w-9" />
        <div className="min-w-0 space-y-1">
          <p
            className={cn(
              "text-xs font-semibold leading-4 sm:text-sm sm:leading-5",
              danger ? "text-red-600 dark:text-red-300" : "text-[color:var(--text-heading)]",
            )}
          >
            {label}
          </p>
          <p className="text-xs leading-5 text-[color:var(--text-heading)] sm:text-sm">{value}</p>
          {meta ? (
            <p
              className={cn(
                "text-xs font-medium leading-4 text-[color:var(--text-muted)]",
                meta === "MAX" && "text-[0.66rem] uppercase tracking-[0.08em]",
              )}
            >
              {meta}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailRowBlock({ row }: { row: DetailRow }) {
  const Icon = row.icon;
  const body = row.body ? (Array.isArray(row.body) ? row.body : [row.body]) : [];

  return (
    <div
      data-medication-section={medicationSectionIdForLabel(row.label)}
      className={cn(
        "scroll-mt-16 grid gap-3 border-b border-[color:var(--border)] px-4 py-2.5 last:border-b-0 sm:grid-cols-[12.5rem_minmax(0,1fr)] sm:px-5",
        row.compact && "items-center",
      )}
    >
      <div className="flex items-center gap-3">
        <IconTile icon={Icon} tone={row.tone === "danger" ? "danger" : "teal"} className="h-9 w-9" />
        <p
          className={cn(
            "text-sm font-semibold",
            row.tone === "danger" ? "text-red-600 dark:text-red-300" : "text-[color:var(--text-heading)]",
          )}
        >
          {row.label}
        </p>
      </div>
      <div className="min-w-0 text-sm leading-6 text-[color:var(--text-heading)]">
        {row.columns ? (
          <div className={cn("grid gap-3", row.columns.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
            {row.columns.map((column) => (
              <div
                key={column.label}
                className="border-t border-[color:var(--border)] pt-2 md:border-l md:border-t-0 md:pl-4 md:pt-0 first:md:border-l-0 first:md:pl-0"
              >
                <p className="text-xs font-semibold text-[color:var(--text-heading)]">{column.label}</p>
                <p className="mt-1 text-sm leading-5 text-[color:var(--text-heading)]">{column.value}</p>
                {column.meta ? (
                  <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                    {column.meta}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : row.tone === "danger" ? (
          <ul className="grid gap-1.5">
            {body.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={cn("space-y-1", row.compact && "flex items-center justify-between gap-3")}>
            <div className="space-y-1">
              {body.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            {row.compact ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ClinicalViewToggle({
  value,
  onChange,
}: {
  value: ClinicalDetailView;
  onChange: (value: ClinicalDetailView) => void;
}) {
  const options: Array<{ value: ClinicalDetailView; label: string }> = [
    { value: "core", label: "Core" },
    { value: "full", label: "Full" },
  ];

  return (
    <div
      className="inline-grid grid-cols-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1 shadow-[var(--shadow-inset)]"
      aria-label="Clinical detail density"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-8 rounded-md px-3 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              active
                ? "bg-[color:var(--surface-raised)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-tight)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function DetailLedger({
  view,
  onViewChange,
}: {
  view: ClinicalDetailView;
  onViewChange: (value: ClinicalDetailView) => void;
}) {
  const coreRows = detailRows.filter((row) => coreDetailLabels.has(row.label));
  const secondaryRows = detailRows.filter((row) => !coreDetailLabels.has(row.label));
  const visibleRows = view === "core" ? coreRows : detailRows;

  return (
    <section className="hidden overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:block">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Clinical summary</p>
          <p className="mt-0.5 text-xs font-medium text-[color:var(--text-muted)]">
            {view === "core" ? "High-yield prescribing information" : "Full medication reference"}
          </p>
        </div>
        <ClinicalViewToggle value={view} onChange={onViewChange} />
      </div>

      {visibleRows.map((row) => (
        <DetailRowBlock key={row.label} row={row} />
      ))}

      {view === "core" ? (
        <details className="group border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)]/55">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-semibold text-[color:var(--text-heading)] [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-[color:var(--clinical-chat-teal)] transition group-open:rotate-180"
                aria-hidden="true"
              />
              <span className="truncate">Additional populations, risks and PK</span>
            </span>
            <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
              {secondaryRows.length} sections
            </span>
          </summary>
          <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-raised)]">
            {secondaryRows.map((row) => (
              <DetailRowBlock key={row.label} row={row} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function SidePanel({ section }: { section: SideSection }) {
  const Icon = section.icon;
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-inset)]">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4.5 w-4.5 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
        <h4 className="text-base font-semibold text-[color:var(--text-heading)]">{section.title}</h4>
      </div>
      <div className="divide-y divide-[color:var(--border)]">
        {section.items.map((item) => {
          const ItemIcon = item.icon;
          return (
            <div key={item.label} className="py-3 first:pt-0 last:pb-0">
              <div className={cn("flex gap-3", ItemIcon ? "items-start" : "items-baseline")}>
                {ItemIcon ? (
                  <IconTile icon={ItemIcon} tone="teal" className="mt-0.5 h-8 w-8" />
                ) : (
                  <span
                    className="mt-2 h-2 w-2 shrink-0 rounded-full border border-[color:var(--clinical-chat-teal)]/30 bg-[color:var(--clinical-chat-teal-soft)]"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--text-heading)]">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-[color:var(--text-muted)]">{item.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MedicationSummaryTabs({
  activeSection,
  onSectionChange,
}: {
  activeSection: MedicationSectionId;
  onSectionChange: (section: MedicationSectionId) => void;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-3 mb-3 border-y border-[color:var(--border)] bg-[color:var(--surface)] px-3 sm:hidden">
      <div className="grid grid-cols-4 text-center">
        {medicationSummaryTabs.map((item) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={activeSection === item.target}
            onClick={() => {
              onSectionChange(item.target);
              scrollToMedicationSection(item.target);
            }}
            className={cn(
              "relative min-h-10 px-2 py-3 text-xs font-semibold text-[color:var(--text-muted)] transition hover:text-[color:var(--text-heading)]",
              activeSection === item.target &&
                "text-[color:var(--clinical-chat-teal)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[color:var(--clinical-chat-teal)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MedicationBadges() {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
      {["333 mg EC tablet", "PBS streamlined", "Reviewed"].map((badge, index) => (
        <span
          key={badge}
          className={cn(
            "inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold shadow-[var(--shadow-inset)] sm:min-h-7 sm:text-xs",
            index === 2
              ? "border-emerald-500/20 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
          )}
        >
          {index === 2 ? <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {badge}
        </span>
      ))}
    </div>
  );
}

function AccessPanel() {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-inset)]">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-4.5 w-4.5 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
        <h4 className="text-base font-semibold text-[color:var(--text-heading)]">Access</h4>
      </div>
      <dl className="grid gap-2 text-sm">
        {[
          ["Brand", "Campral"],
          ["PBS status", "PBS streamlined"],
          ["PBS item", "8357W"],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={cn("flex justify-between gap-3", index < 2 && "border-b border-[color:var(--border)] pb-2")}
          >
            <dt className="font-semibold text-[color:var(--text-muted)]">{label}</dt>
            <dd className="font-medium text-[color:var(--text-heading)]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SourcesDisclosure({ mobile = false }: { mobile?: boolean }) {
  return (
    <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-[color:var(--text-muted)] [&::-webkit-details-marker]:hidden",
          mobile ? "min-h-11" : "min-h-12",
        )}
      >
        <span className="flex items-center gap-2">
          <FileText className="h-4.5 w-4.5" aria-hidden="true" />
          Sources and provenance
        </span>
        <ChevronDown className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
      </summary>
      <div className="border-t border-[color:var(--border)] px-4 py-3 text-xs leading-5 text-[color:var(--text-muted)]">
        Australian PI, PBS, DACAS, Australian Prescriber.
      </div>
    </details>
  );
}

function MobileDetailCard({ row }: { row: DetailRow }) {
  const Icon = row.icon;
  const firstColumn = row.columns?.[0];
  const summary =
    row.columns
      ?.map((column) => `${column.label}: ${column.value}${column.meta ? ` ${column.meta}` : ""}`)
      .join("; ") ?? (Array.isArray(row.body) ? row.body.join(" ") : (row.body ?? ""));

  return (
    <article
      data-medication-section={medicationSectionIdForLabel(row.label)}
      className="flex scroll-mt-16 w-full items-start gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2.5 text-left last:border-b-0"
    >
      <IconTile icon={Icon} tone={row.tone === "danger" ? "danger" : "teal"} className="h-7 w-7" />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-xs font-semibold",
            row.tone === "danger" ? "text-red-600 dark:text-red-300" : "text-[color:var(--text-heading)]",
          )}
        >
          {row.label}
        </span>
        <span className="mt-1 block text-[11px] leading-[1.45] text-[color:var(--text-muted)]">
          {row.label === "Dosing" && firstColumn ? summary.replace("Usual dose: ", "") : summary}
        </span>
      </span>
    </article>
  );
}

function MobileDetailList() {
  const summaryRows = detailRows.slice(0, 5);
  const compactRows = [
    {
      label: "Key risks",
      icon: ShieldCheck,
      section: "safety" as const,
      body: ["GI: diarrhea, nausea, flatulence", "Dermatologic: rash, pruritus", "Neuropsychiatric: mood swings"],
    },
    {
      label: "Interactions",
      icon: ArrowLeftRight,
      section: "more" as const,
      body: sideSections[1].items.map((item) => `${item.label}: ${item.body}`),
    },
    {
      label: "Access",
      icon: Lock,
      section: "more" as const,
      body: ["Campral", "PBS streamlined", "PBS item 8357W"],
    },
  ];

  return (
    <div className="space-y-3 sm:hidden">
      <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)]">
        {summaryRows.map((row) => (
          <MobileDetailCard key={row.label} row={row} />
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
        {compactRows.map(({ label, icon: Icon, section, body }) => (
          <details
            key={label}
            data-medication-section={section}
            className="group scroll-mt-16 border-b border-[color:var(--border)] last:border-b-0"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-left text-sm font-semibold text-[color:var(--text-heading)] [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="h-4.5 w-4.5 shrink-0 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <ul className="grid gap-1.5 px-10 pb-3 text-[11px] leading-5 text-[color:var(--text-muted)]">
              {body.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      <SourcesDisclosure mobile />
    </div>
  );
}

function MedicationDetail() {
  const [clinicalDetailView, setClinicalDetailView] = useState<ClinicalDetailView>("core");
  const [activeMobileSection, setActiveMobileSection] = useState<MedicationSectionId>("summary");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 py-1 sm:py-2">
      <Link
        href="/?mode=prescribing&q=acamprosate%20renal%20dose"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:inline-flex focus:min-h-9 focus:items-center focus:gap-2 focus:rounded-lg focus:border focus:border-[color:var(--border)] focus:bg-[color:var(--surface-raised)] focus:px-3 focus:text-sm focus:font-semibold focus:text-[color:var(--text-muted)] focus:shadow-[var(--shadow-inset)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[color:var(--focus)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to medication matches
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-3.5">
          <section data-medication-section="summary" className="scroll-mt-16 px-1 sm:px-0">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <IconTile icon={Pill} tone="teal" className="h-14 w-14 sm:h-18 sm:w-18" />
              <div className="min-w-0 flex-1">
                <h3 className="text-2xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-4xl">
                  Acamprosate
                </h3>
                <p className="mt-1 text-sm font-medium text-[color:var(--text-muted)] sm:text-base">
                  Alcohol abstinence maintenance <span className="mx-1.5 text-[color:var(--text-soft)]">·</span> GABA /
                  glutamate modulator
                </p>
                <MedicationBadges />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
            <DetailTile
              icon={CheckCircle2}
              label="Prescribing answer"
              value="Maintenance after detox"
              meta="with psychosocial support"
            />
            <DetailTile icon={CalendarDays} label="Dosing" value="666 mg TID" meta="2 x 333 mg" />
            <DetailTile icon={ChartNoAxesColumnIncreasing} label="Dose ceiling" value="1,998 mg/day" meta="MAX" />
            <DetailTile icon={AlertTriangle} label="Avoid" value="Cr >120 micromol/L" danger />
          </section>

          <MedicationSummaryTabs activeSection={activeMobileSection} onSectionChange={setActiveMobileSection} />

          <DetailLedger view={clinicalDetailView} onViewChange={setClinicalDetailView} />

          <MobileDetailList />
        </div>

        <aside className="hidden space-y-3 lg:block lg:self-start lg:pt-[6.6rem]">
          {sideSections.map((section) => (
            <SidePanel key={section.title} section={section} />
          ))}
          <AccessPanel />
          <SourcesDisclosure />
        </aside>
      </div>
    </div>
  );
}

export function AcamprosateMedicationPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-[color:var(--surface)] text-[color:var(--text)]"
      data-testid="acamprosate-medication-page"
    >
      <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)]/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 lg:px-8">
          <Link
            href="/?mode=prescribing&q=acamprosate%20renal%20dose"
            className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-sm font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Medication search</span>
            <span className="sm:hidden">Search</span>
          </Link>
          <div className="text-center text-sm font-semibold text-[color:var(--text-heading)] sm:text-base">
            Clinical KB
          </div>
          <div className="flex justify-end">
            <span className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--clinical-chat-teal-soft)] px-3 text-xs font-semibold text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
              <Pill className="h-3.5 w-3.5" aria-hidden="true" />
              Medication
            </span>
          </div>
        </div>
      </header>
      <div className="px-3 py-3 sm:px-6 lg:px-8">
        <MedicationDetail />
      </div>
      <footer className="mx-auto max-w-7xl px-4 pb-4 text-center text-[10px] font-medium text-[color:var(--text-soft)] opacity-70">
        Clinical KB provides evidence summaries, not medical advice. Verify clinical decisions.
      </footer>
    </main>
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
}: MedicationPrescribingWorkspaceProps) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return (
      <MedicationHome
        loading={loading}
        realDataReady={realDataReady}
        authUnavailable={authUnavailable}
        apiUnavailable={apiUnavailable}
        setupWarning={setupWarning}
        onSuggestedSearch={onSuggestedSearch}
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
