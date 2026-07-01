"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  Brain,
  CalendarDays,
  Gauge,
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

import {
  appBackdrop,
  cn,
  toneDanger,
  toneInfo,
  toneNeutral,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";

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

// Badge tone key: clinical = action/instruction, success = verified/access, danger = stop/avoid, warning = adjust/check, neutral = passive metadata, info = process.
type ClinicalBadgeTone = "clinical" | "success" | "danger" | "warning" | "neutral" | "info";

type ClinicalBadgeItem = {
  label: string;
  tone?: ClinicalBadgeTone;
  icon?: LucideIcon;
};

type DetailRow = {
  label: string;
  icon: LucideIcon;
  summary?: string;
  body?: string | string[];
  columns?: Array<{ label: string; value: string; meta?: string; metaTone?: ClinicalBadgeTone }>;
  columnStyle?: "ledger" | "systems";
  badges?: ClinicalBadgeItem[];
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

function ClinicalBadge({
  label,
  tone = "neutral",
  icon: Icon,
  compact = false,
}: ClinicalBadgeItem & { compact?: boolean }) {
  const toneClassName: Record<ClinicalBadgeTone, string> = {
    clinical:
      "border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]",
    success: toneSuccess,
    danger: toneDanger,
    warning: toneWarning,
    neutral: toneNeutral,
    info: toneInfo,
  };

  return (
    <span
      title={label}
      className={cn(
        "inline-flex h-[1.375rem] max-w-full shrink-0 items-center gap-1 rounded-md border px-1.5 text-[10px] font-semibold leading-none shadow-[var(--shadow-inset)]",
        compact && "h-5 px-1.5 text-[9.5px]",
        toneClassName[tone],
      )}
    >
      {Icon ? <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

const clinicalBadgeTonePriority: Record<ClinicalBadgeTone, number> = {
  danger: 6,
  warning: 5,
  clinical: 4,
  success: 3,
  neutral: 2,
  info: 1,
};

function BadgeCluster({
  items,
  compact = false,
  limit,
  showOverflowCount = false,
  className,
}: {
  items?: ClinicalBadgeItem[];
  compact?: boolean;
  limit?: number;
  showOverflowCount?: boolean;
  className?: string;
}) {
  if (!items?.length) return null;
  const orderedItems =
    typeof limit === "number"
      ? [...items].sort(
          (a, b) => clinicalBadgeTonePriority[b.tone ?? "neutral"] - clinicalBadgeTonePriority[a.tone ?? "neutral"],
        )
      : items;
  const visibleItems = typeof limit === "number" ? orderedItems.slice(0, limit) : orderedItems;
  const hiddenCount = typeof limit === "number" ? Math.max(0, items.length - visibleItems.length) : 0;

  return (
    <div className={cn("flex min-w-0 flex-wrap gap-1", className)}>
      {visibleItems.map((item, index) => (
        <ClinicalBadge key={`${item.label}-${item.tone ?? "neutral"}-${index}`} compact={compact} {...item} />
      ))}
      {showOverflowCount && hiddenCount ? (
        <ClinicalBadge label={`+${hiddenCount}`} tone="neutral" compact={compact} />
      ) : null}
    </div>
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
  desktopComposerSlotId,
}: Omit<MedicationPrescribingWorkspaceProps, "query"> & { desktopComposerSlotId?: string }) {
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

      {desktopComposerSlotId ? (
        <div id={desktopComposerSlotId} className="hidden w-full max-w-3xl lg:block" />
      ) : null}

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
        "min-h-[4.05rem] rounded-lg border bg-[color:var(--surface-raised)] px-2.5 py-2.5 shadow-[var(--shadow-inset)] sm:min-h-[4.2rem] sm:px-3 sm:py-3",
        danger ? "border-red-500/35 bg-red-50/30 dark:bg-red-950/10" : "border-[color:var(--border)]",
      )}
    >
      <div className="flex items-start gap-2">
        <IconTile icon={icon} tone={danger ? "danger" : "teal"} className="h-7 w-7" />
        <div className="min-w-0 space-y-1">
          <p
            className={cn(
              "text-[11px] font-semibold leading-4",
              danger ? "text-red-600 dark:text-red-300" : "text-[color:var(--text-heading)]",
            )}
          >
            {label}
          </p>
          <p className="text-[13px] font-semibold leading-5 text-[color:var(--text-heading)]">{value}</p>
          {meta ? <p className="text-[11px] font-medium leading-4 text-[color:var(--text-muted)]">{meta}</p> : null}
        </div>
      </div>
    </div>
  );
}

function DetailRowBlock({ row }: { row: DetailRow }) {
  const Icon = row.icon;
  const body = row.body ? (Array.isArray(row.body) ? row.body : [row.body]) : [];
  const columnStyle = row.columnStyle ?? "ledger";

  return (
    <div
      data-medication-section={medicationSectionIdForLabel(row.label)}
      className={cn(
        "scroll-mt-16 grid gap-3 border-b border-[color:var(--border)] px-4 py-3 last:border-b-0 sm:grid-cols-[11.75rem_minmax(0,1fr)] sm:px-5",
        row.compact && "items-center",
      )}
    >
      <div className="flex items-center gap-3">
        <IconTile icon={Icon} tone={row.tone === "danger" ? "danger" : "teal"} className="h-8 w-8" />
        <p
          className={cn(
            "text-[13px] font-semibold sm:text-sm",
            row.tone === "danger" ? "text-red-600 dark:text-red-300" : "text-[color:var(--text-heading)]",
          )}
        >
          {row.label}
        </p>
      </div>
      <div className="min-w-0 text-[13px] leading-5 text-[color:var(--text-heading)] sm:text-sm">
        <BadgeCluster items={row.badges} compact limit={row.tone === "danger" ? 4 : 3} className="mb-2" />
        {row.columns ? (
          <div
            className={cn(
              "grid divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]",
              columnStyle === "ledger" && (row.columns.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3"),
              columnStyle === "ledger" && "md:divide-x md:divide-y-0",
              columnStyle === "systems" && "text-[color:var(--text-muted)]",
            )}
          >
            {row.columns.map((column) => (
              <div key={column.label} className="min-w-0 py-2.5 md:px-3 first:md:pl-0 last:md:pr-0">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <p className="text-[11px] font-semibold text-[color:var(--text-muted)]">{column.label}</p>
                  {column.meta ? (
                    <ClinicalBadge label={column.meta} tone={column.metaTone ?? "neutral"} compact />
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] font-semibold leading-5 text-[color:var(--text-heading)] sm:text-sm">
                  {column.value}
                </p>
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
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3.5 shadow-[var(--shadow-inset)]">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-4.5 w-4.5 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-[color:var(--text-heading)]">{section.title}</h4>
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
                  <p className="text-[13px] font-semibold leading-5 text-[color:var(--text-heading)]">{item.label}</p>
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
    <div className="sticky top-[3.55rem] z-10 mb-3 bg-[color:var(--surface)]/90 py-1.5 backdrop-blur-xl sm:hidden">
      <div
        className="grid grid-cols-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1 text-center shadow-[var(--shadow-inset)]"
        role="tablist"
        aria-label="Medication detail sections"
      >
        {medicationSummaryTabs.map((item) => (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={activeSection === item.target}
            onClick={() => onSectionChange(item.target)}
            className={cn(
              "min-h-8 rounded-md px-2 text-xs font-semibold text-[color:var(--text-muted)] transition hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              activeSection === item.target &&
                "bg-[color:var(--surface-raised)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-tight)]",
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
  return <BadgeCluster items={medicationIdentityBadges} className="mt-2" />;
}

function AccessPanel() {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3.5 shadow-[var(--shadow-inset)]">
      <div className="mb-2.5 flex items-center gap-2">
        <Lock className="h-4.5 w-4.5 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-[color:var(--text-heading)]">Access</h4>
      </div>
      <BadgeCluster items={accessBadges} compact limit={3} className="mb-2.5" />
      <dl className="grid gap-2 text-[13px]">
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
        Australian Product Information, PBS, DACAS, Australian Prescriber.
      </div>
    </details>
  );
}

function MobileDetailCard({ row, compact = false }: { row: DetailRow; compact?: boolean }) {
  const Icon = row.icon;
  const body = row.body ? (Array.isArray(row.body) ? row.body : [row.body]) : [];
  const columnStyle = row.columnStyle ?? "ledger";

  return (
    <article
      data-medication-section={medicationSectionIdForLabel(row.label)}
      className="flex scroll-mt-16 w-full items-start gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2.5 text-left last:border-b-0"
    >
      <IconTile icon={Icon} tone={row.tone === "danger" ? "danger" : "teal"} className="h-7 w-7" />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] font-semibold leading-4",
            row.tone === "danger" ? "text-red-600 dark:text-red-300" : "text-[color:var(--text-heading)]",
          )}
        >
          {row.label}
        </p>
        <BadgeCluster items={row.badges} compact limit={row.tone === "danger" ? 4 : 2} className="mt-1.5" />
        {compact && row.summary ? (
          <p className="mt-1.5 text-xs leading-5 text-[color:var(--text-muted)]">{row.summary}</p>
        ) : null}
        {row.columns && !compact ? (
          <div
            className={cn(
              "mt-2 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]",
              columnStyle === "ledger" &&
                "min-[460px]:grid min-[460px]:grid-cols-2 min-[460px]:divide-x min-[460px]:divide-y-0",
            )}
          >
            {row.columns.map((column) => (
              <div
                key={column.label}
                className="min-w-0 py-2 min-[460px]:px-2 first:min-[460px]:pl-0 last:min-[460px]:pr-0"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <p className="text-[10.5px] font-semibold text-[color:var(--text-muted)]">{column.label}</p>
                  {column.meta ? (
                    <ClinicalBadge label={column.meta} tone={column.metaTone ?? "neutral"} compact />
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs font-semibold leading-[1.35] text-[color:var(--text-heading)]">
                  {column.value}
                </p>
              </div>
            ))}
          </div>
        ) : !compact && body.length ? (
          <div className="mt-2 grid gap-1.5 text-xs leading-5 text-[color:var(--text-muted)]">
            {body.map((item) => (
              <p key={item} className={cn(row.tone === "danger" && "flex gap-2")}>
                {row.tone === "danger" ? (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                ) : null}
                <span>{item}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

type MobileDisclosurePanelData = {
  label: string;
  icon: LucideIcon;
  badges?: ClinicalBadgeItem[];
  body: string[];
};

function MobileDisclosurePanel({ panel }: { panel: MobileDisclosurePanelData }) {
  const Icon = panel.icon;

  return (
    <details className="group scroll-mt-16 border-b border-[color:var(--border)] last:border-b-0">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-left text-[13px] font-semibold text-[color:var(--text-heading)] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-[color:var(--clinical-chat-teal)]" aria-hidden="true" />
          <span className="truncate">{panel.label}</span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="px-3 pb-3">
        <BadgeCluster items={panel.badges} compact limit={panel.label === "Access" ? 3 : 2} className="mb-2" />
        <ul className="divide-y divide-[color:var(--border)] text-xs leading-5 text-[color:var(--text-muted)]">
          {panel.body.map((item) => {
            const separatorIndex = item.indexOf(": ");
            const label = separatorIndex >= 0 ? item.slice(0, separatorIndex) : null;
            const value = separatorIndex >= 0 ? item.slice(separatorIndex + 2) : item;

            return (
              <li key={item} className="grid gap-0.5 py-1.5 first:pt-0 last:pb-0">
                {label ? <span className="font-semibold text-[color:var(--text-heading)]">{label}</span> : null}
                <span>{value}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

function MobileDetailList({ activeSection }: { activeSection: MedicationSectionId }) {
  const rowsBySection: Record<MedicationSectionId, DetailRow[]> = {
    summary: detailRows.filter((row) => ["Prescribing answer", "Dosing", "Do not use"].includes(row.label)),
    dosing: detailRows.filter((row) => ["Dosing", "Administration"].includes(row.label)),
    safety: detailRows.filter((row) => ["Do not use", "Populations", "Key risks"].includes(row.label)),
    more: detailRows.filter((row) => row.label === "Pearls / PK"),
  };
  const morePanels: MobileDisclosurePanelData[] = [
    {
      label: "Checks and monitoring",
      icon: Activity,
      badges: [
        { label: "Renal function", tone: "clinical", icon: Droplet },
        { label: "Mood monitor", tone: "clinical", icon: Brain },
        { label: "Adherence", tone: "neutral", icon: ClipboardCheck },
      ],
      body: sideSections[0].items.map((item) => `${item.label}: ${item.body}`),
    },
    {
      label: "Interactions",
      icon: ArrowLeftRight,
      badges: [{ label: "PK interactions limited", tone: "neutral" }],
      body: sideSections[1].items.map((item) => `${item.label}: ${item.body}`),
    },
    {
      label: "Access",
      icon: Lock,
      badges: accessBadges,
      body: ["Brand: Campral", "PBS status: PBS streamlined", "PBS item: 8357W"],
    },
  ];

  return (
    <div data-medication-section={activeSection} className="space-y-3 sm:hidden">
      <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)]">
        {rowsBySection[activeSection].map((row) => (
          <MobileDetailCard key={row.label} row={row} compact={activeSection === "summary" || row.compact} />
        ))}
      </section>

      {activeSection === "more" ? (
        <>
          <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
            {morePanels.map((panel) => (
              <MobileDisclosurePanel key={panel.label} panel={panel} />
            ))}
          </section>

          <SourcesDisclosure mobile />
        </>
      ) : null}
    </div>
  );
}

function MedicationDetail() {
  const [clinicalDetailView, setClinicalDetailView] = useState<ClinicalDetailView>("core");
  const [activeMobileSection, setActiveMobileSection] = useState<MedicationSectionId>("summary");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 py-1 sm:py-2">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-3.5">
          <section data-medication-section="summary" className="scroll-mt-16 px-1 sm:px-0">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <IconTile icon={Pill} tone="teal" className="h-11 w-11 sm:h-14 sm:w-14" />
              <div className="min-w-0 flex-1">
                <h3 className="text-2xl font-semibold leading-tight tracking-normal text-[color:var(--text-heading)] sm:text-[2rem]">
                  Acamprosate
                </h3>
                <p className="mt-1 text-[13px] font-medium leading-5 text-[color:var(--text-muted)] sm:text-sm">
                  Alcohol abstinence maintenance <span className="mx-1.5 text-[color:var(--text-soft)]">·</span>{" "}
                  GABA/glutamate modulator
                </p>
                <MedicationBadges />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            <DetailTile icon={CheckCircle2} label="Prescribing answer" value="Maintenance" meta="after withdrawal" />
            <DetailTile icon={CalendarDays} label="Dosing" value="666 mg TID" meta="2 x 333 mg" />
            <DetailTile icon={Gauge} label="Dose ceiling" value="1,998 mg/day" meta="MAX" />
            <DetailTile icon={AlertTriangle} label="Avoid" value="Cr >120" meta="micromol/L" danger />
          </section>

          <MedicationSummaryTabs activeSection={activeMobileSection} onSectionChange={setActiveMobileSection} />

          <DetailLedger view={clinicalDetailView} onViewChange={setClinicalDetailView} />

          <MobileDetailList activeSection={activeMobileSection} />
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
      className={cn(appBackdrop, "min-h-[100dvh] text-[color:var(--text)]")}
      data-testid="acamprosate-medication-page"
    >
      <header className="edge-glass-header sticky top-0 z-30 border-b border-[color:var(--border)] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 sm:gap-3">
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
