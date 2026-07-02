"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChevronRight,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  Grid2X2,
  History,
  MoreVertical,
  Pill,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { ModeHomeHero } from "@/components/mode-home-template";
import { Sheet } from "@/components/ui/sheet";
import {
  chatComposerIconButton,
  chatComposerInput,
  chatComposerShell,
  chatSendButton,
  cn,
  textMuted,
} from "@/components/ui-primitives";
type LauncherStatus = "ready" | "recent" | "review_due";
type LauncherCategory = "clinical" | "admin" | "recent";

type LauncherApp = {
  id: string;
  title: string;
  shortTitle?: string;
  description: string;
  detail: string;
  href: string;
  external: boolean;
  icon: LucideIcon;
  category: LauncherCategory;
  workflow: string;
  lastUsed: string;
  status: LauncherStatus;
  areaLabel: string;
  primaryAction: string;
  sourceBacked: boolean;
  sourceToolId?: string;
  relatedIds: string[];
  quickActions: string[];
  recentWorkflows: Array<{ title: string; date: string }>;
};

const statusStyles: Record<LauncherStatus, string> = {
  ready: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
  recent: "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]",
  review_due: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
};

const statusLabels: Record<LauncherStatus, string> = {
  ready: "Ready",
  recent: "Recent",
  review_due: "Review due",
};

const filterOptions = [
  { id: "all", label: "All" },
  { id: "clinical", label: "Clinical" },
  { id: "admin", label: "Admin" },
  { id: "recent", label: "Recent" },
] as const;

const dashboardFilterOptions = [
  { id: "all", label: "All tools", icon: Filter },
  { id: "pinned", label: "Pinned", icon: Pin },
  { id: "review_due", label: "Review due", icon: Clock3 },
  { id: "source_backed", label: "Source-backed", icon: ShieldCheck },
] as const;

const launcherApps: LauncherApp[] = [
  {
    id: "medication-prescribing",
    title: "Medication Prescribing",
    shortTitle: "Medication",
    description: "Search, prescribe and review medications.",
    detail: "Check prescribing context, monitoring, interactions, and medication-specific safety issues.",
    href: "/?mode=prescribing",
    external: false,
    icon: Pill,
    category: "clinical",
    workflow: "Care planning",
    lastUsed: "May 12, 2025",
    status: "review_due",
    areaLabel: "Treatment",
    primaryAction: "Prescribe",
    sourceBacked: true,
    sourceToolId: "medications",
    relatedIds: ["documents", "services", "clinical-kb-search"],
    quickActions: ["Create new prescription", "Browse formulary", "Review interactions", "Medication templates"],
    recentWorkflows: [
      { title: "Medication review - Sam T.", date: "May 12, 2025" },
      { title: "Repeat prescription - Atorvastatin 20mg", date: "May 9, 2025" },
      { title: "Renal dose screen", date: "May 8, 2025" },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    description: "Access and manage clinical documents.",
    detail: "Search indexed PDFs, guidelines, policies, notes, and source documents.",
    href: "/?mode=documents",
    external: false,
    icon: FileText,
    category: "admin",
    workflow: "Reference",
    lastUsed: "May 10, 2025",
    status: "ready",
    areaLabel: "Reference",
    primaryAction: "Search",
    sourceBacked: true,
    relatedIds: ["clinical-kb-search", "services", "medication-prescribing"],
    quickActions: ["Search documents", "Browse library", "Open source PDF", "Review indexed documents"],
    recentWorkflows: [
      { title: "Lithium monitoring guideline", date: "May 10, 2025" },
      { title: "Safety plan source review", date: "May 9, 2025" },
      { title: "Clozapine monitoring protocol", date: "May 7, 2025" },
    ],
  },
  {
    id: "services",
    title: "Services",
    description: "Review source-backed service records and access pathways.",
    detail:
      "Open service records with contact routes, eligibility, cost, referral criteria, verification, and source status.",
    href: "/services",
    external: false,
    icon: ClipboardList,
    category: "clinical",
    workflow: "Referral",
    lastUsed: "Today, 8:15 AM",
    status: "review_due",
    areaLabel: "Coordination",
    primaryAction: "Refer",
    sourceBacked: true,
    relatedIds: ["clinical-kb-search", "documents", "medication-prescribing"],
    quickActions: ["Open services home", "Review referral criteria", "Copy contact pathway", "Check source status"],
    recentWorkflows: [
      { title: "13YARN referral pathway", date: "Today, 8:15 AM" },
      { title: "Regional mental health service check", date: "May 12, 2025" },
      { title: "Crisis support contact review", date: "May 10, 2025" },
    ],
  },
  {
    id: "forms",
    title: "Forms",
    description: "Find clinical forms and source-backed form pathways.",
    detail: "Open the forms home for form search, readiness checks, pathway tasks, and source-backed records.",
    href: "/forms",
    external: false,
    icon: FileText,
    category: "admin",
    workflow: "Forms",
    lastUsed: "Today, 8:05 AM",
    status: "ready",
    areaLabel: "Coordination",
    primaryAction: "Open",
    sourceBacked: true,
    relatedIds: ["services", "documents", "clinical-kb-search"],
    quickActions: ["Open forms home", "Search forms", "Review readiness checks", "Browse form pathways"],
    recentWorkflows: [
      { title: "Assessment form pathway", date: "Today, 8:05 AM" },
      { title: "Transfer form check", date: "May 12, 2025" },
      { title: "Treatment form source review", date: "May 10, 2025" },
    ],
  },
  {
    id: "clinical-kb-search",
    title: "Clinical KB Search",
    description: "Search the knowledge base content.",
    detail: "Search the Clinical KB for source-backed guidance, answers, and evidence.",
    href: "/?mode=answer",
    external: false,
    icon: Search,
    category: "clinical",
    workflow: "Reference",
    lastUsed: "Today, 7:30 AM",
    status: "ready",
    areaLabel: "Reference",
    primaryAction: "Ask",
    sourceBacked: true,
    relatedIds: ["documents", "services", "medication-prescribing"],
    quickActions: ["Ask clinical question", "Search indexed guidelines", "Open document scope", "Review sources"],
    recentWorkflows: [
      { title: "Lithium monitoring search", date: "Today, 7:30 AM" },
      { title: "Safety plan search", date: "May 12, 2025" },
      { title: "Clozapine source check", date: "May 10, 2025" },
    ],
  },
  {
    id: "differentials",
    title: "Differentials",
    description: "Build and compare diagnostic possibilities.",
    detail: "Open the differentials workspace for source-aware comparison, risk review, and presentation support.",
    href: "/differentials",
    external: false,
    icon: Brain,
    category: "clinical",
    workflow: "Assessment",
    lastUsed: "Today, 8:40 AM",
    status: "recent",
    areaLabel: "Assessment",
    primaryAction: "Compare",
    sourceBacked: true,
    relatedIds: ["clinical-kb-search", "documents", "medication-prescribing"],
    quickActions: ["Compare diagnoses", "Search presentations", "Open diagnosis map", "Review clinical clues"],
    recentWorkflows: [
      { title: "Acute confusion comparison", date: "Today, 8:40 AM" },
      { title: "Mood differential map", date: "May 12, 2025" },
      { title: "Psychosis presentation review", date: "May 10, 2025" },
    ],
  },
  {
    id: "favourites",
    title: "Favourites",
    description: "Return to saved clinical work and sources.",
    detail: "Open saved clinical items, pinned sources, repeated workflows, and recent reference sets.",
    href: "/favourites",
    external: false,
    icon: Star,
    category: "admin",
    workflow: "Saved work",
    lastUsed: "Today, 8:45 AM",
    status: "recent",
    areaLabel: "Saved",
    primaryAction: "Resume",
    sourceBacked: false,
    relatedIds: ["clinical-kb-search", "documents", "services"],
    quickActions: ["Open saved items", "Review pinned sources", "Resume recent work", "Browse saved sets"],
    recentWorkflows: [
      { title: "Saved lithium sources", date: "Today, 8:45 AM" },
      { title: "Referral source set", date: "May 12, 2025" },
      { title: "Medication monitoring saves", date: "May 10, 2025" },
    ],
  },
];

const seedPinnedIds = ["clinical-kb-search", "services", "medication-prescribing", "documents"];

const recentActivity = [
  { id: "clinical-kb-search", label: "Clinical KB Search opened", date: "Today, 7:30 AM", icon: Search },
  { id: "services", label: "13YARN referral pathway reviewed", date: "Today, 8:15 AM", icon: ClipboardList },
  { id: "medication-prescribing", label: "Medication Prescribing reviewed", date: "May 12, 2025", icon: Pill },
  { id: "documents", label: "Documents opened", date: "May 10, 2025", icon: FileText },
  { id: "documents", label: "Saved items reviewed", date: "Today, 8:45 AM", icon: Star },
] as const;

export const applicationsLauncherItemCount = launcherApps.length;

type LauncherVariant = "standalone" | "dashboard-tools";

type LauncherCopy = {
  heading: string;
  description: string;
  searchAriaLabel: string;
  searchPlaceholder: string;
  actionsAriaLabel: string;
  openSelectedAriaLabel: string;
  selectedLabel: string;
  closeSelectedLabel: string;
  optionsAriaLabel: string;
  pinnedAriaLabel: string;
  allSectionLabel: string;
  allColumnLabel: string;
  countNoun: string;
  relatedHeading: string;
  emptyTitle: string;
  emptyBody: string;
};

const standaloneLauncherCopy: LauncherCopy = {
  heading: "Applications",
  description:
    "Open the clinical applications and connected workflows you use for assessment, formulation, prescribing, documents, and saved workflows.",
  searchAriaLabel: "Search applications",
  searchPlaceholder: "Search applications...",
  actionsAriaLabel: "Open application actions",
  openSelectedAriaLabel: "Open selected application",
  selectedLabel: "Selected application",
  closeSelectedLabel: "Close selected application",
  optionsAriaLabel: "Open application options",
  pinnedAriaLabel: "Pinned applications",
  allSectionLabel: "All applications",
  allColumnLabel: "Application",
  countNoun: "applications",
  relatedHeading: "Related apps",
  emptyTitle: "No applications match",
  emptyBody: "Clear the search or try another clinical workflow, app name, or category.",
};

const dashboardToolsLauncherCopy: LauncherCopy = {
  heading: "Tools",
  description:
    "Open the clinical tools and connected workflows you use for assessment, prescribing, documents, and saved work.",
  searchAriaLabel: "Search tools",
  searchPlaceholder: "Search tools...",
  actionsAriaLabel: "Open tool actions",
  openSelectedAriaLabel: "Open selected tool",
  selectedLabel: "Selected tool",
  closeSelectedLabel: "Close selected tool",
  optionsAriaLabel: "Open tool options",
  pinnedAriaLabel: "Pinned tools",
  allSectionLabel: "All tools",
  allColumnLabel: "Tool",
  countNoun: "tools",
  relatedHeading: "Related tools",
  emptyTitle: "No tools match",
  emptyBody: "Clear the search or try another clinical workflow, tool name, or category.",
};

function appById(id: string) {
  return launcherApps.find((app) => app.id === id) ?? launcherApps[0];
}

function StatusPill({ status }: { status: LauncherStatus }) {
  return (
    <span
      className={cn("inline-flex min-h-6 items-center rounded-md border px-2 text-2xs font-bold", statusStyles[status])}
    >
      {statusLabels[status]}
    </span>
  );
}

function AppIcon({ app, compact = false }: { app: LauncherApp; compact?: boolean }) {
  const Icon = app.icon;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]",
        compact ? "h-9 w-9" : "h-11 w-11",
      )}
    >
      <Icon className={compact ? "h-4.5 w-4.5" : "h-5 w-5"} aria-hidden />
    </span>
  );
}

function LaunchLink({ app, compact = false, className }: { app: LauncherApp; compact?: boolean; className?: string }) {
  const label = `Launch ${app.title}`;
  const classes = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-4 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
    compact && "min-h-9 px-3 text-xs",
    className,
  );

  if (app.external) {
    return (
      <a href={app.href} target="_blank" rel="noopener noreferrer" aria-label={label} className={classes}>
        Launch
        <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    );
  }

  return (
    <Link href={app.href} aria-label={label} className={classes}>
      Launch
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function HeaderFilter({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: (typeof filterOptions)[number]["id"];
  onFilterChange: (filter: (typeof filterOptions)[number]["id"]) => void;
}) {
  return (
    <div className="inline-grid grid-cols-4 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
      {filterOptions.map((option) => {
        const active = option.id === activeFilter;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onFilterChange(option.id)}
            className={cn(
              "min-h-11 px-4 text-xs font-semibold transition sm:min-w-[5.25rem]",
              active
                ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]"
                : "border-l border-[color:var(--border)] text-[color:var(--text-muted)] first:border-l-0 hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PinnedSection({
  pinnedApps,
  selectedId,
  onSelect,
  onTogglePin,
  copy,
}: {
  pinnedApps: LauncherApp[];
  selectedId: string;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  copy: LauncherCopy;
}) {
  return (
    <section
      aria-label={copy.pinnedAriaLabel}
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]"
    >
      <div className="flex min-h-10 items-center justify-between border-b border-[color:var(--border)] px-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)]">
          <Pin className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
          Pinned
        </div>
        <span className="nums text-xs font-semibold text-[color:var(--text-soft)]">{pinnedApps.length} pinned</span>
      </div>
      <div className="divide-y divide-[color:var(--border)]">
        {pinnedApps.map((app) => {
          const selected = selectedId === app.id;
          return (
            <div
              key={app.id}
              className={cn(
                "grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-3 text-left transition hover:bg-[color:var(--surface-subtle)] sm:gap-3",
                selected && "bg-[color:var(--clinical-accent-soft)]/55",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(app.id)}
                className="contents text-left"
                aria-label={`Select ${app.title}`}
              >
                <AppIcon app={app} compact />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
                    {app.title}
                  </span>
                  <span className={cn("hidden truncate text-xs sm:block", textMuted)}>{app.description}</span>
                </span>
              </button>
              <StatusPill status={app.status} />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePin(app.id);
                }}
                aria-label={`Unpin ${app.title}`}
                className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--clinical-accent)]"
              >
                <PinOff className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ApplicationRow({
  app,
  selected,
  pinned,
  onSelect,
  onTogglePin,
}: {
  app: LauncherApp;
  selected: boolean;
  pinned: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)_7rem_6rem_5.5rem_auto] items-center gap-3 border-t border-[color:var(--border)] px-3 py-3 transition first:border-t-0",
        selected &&
          "rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]/55 shadow-[var(--glow-soft)]",
        !selected && "hover:bg-[color:var(--surface-subtle)]",
      )}
      data-testid={`application-row-${app.id}`}
    >
      <button type="button" onClick={() => onSelect(app.id)} className="contents text-left">
        <AppIcon app={app} compact />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{app.title}</span>
          <span className={cn("block truncate text-xs leading-5", textMuted)}>{app.description}</span>
        </span>
        <span className="nums text-xs font-semibold text-[color:var(--text-muted)]">{app.lastUsed}</span>
        <StatusPill status={app.status} />
      </button>
      <LaunchLink app={app} compact />
      <button
        type="button"
        onClick={() => onTogglePin(app.id)}
        aria-label={`${pinned ? "Unpin" : "Pin"} ${app.title}`}
        className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--clinical-accent)]"
      >
        <Pin className={cn("h-4 w-4", pinned && "fill-current text-[color:var(--clinical-accent)]")} aria-hidden />
      </button>
    </div>
  );
}

function MobileApplicationRow({
  app,
  selected,
  onSelect,
}: {
  app: LauncherApp;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(app.id)}
      data-testid={`mobile-application-row-${app.id}`}
      className={cn(
        "grid min-h-[62px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[color:var(--border)] px-3 py-2.5 text-left first:border-t-0",
        selected && "rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]/60",
      )}
    >
      <AppIcon app={app} compact />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{app.title}</span>
        <span className="nums block truncate text-xs text-[color:var(--text-soft)]">{app.lastUsed}</span>
      </span>
      <span className="flex items-center gap-2">
        <StatusPill status={app.status} />
        <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
      </span>
    </button>
  );
}

function DetailPanel({
  app,
  pinned,
  onTogglePin,
  onClose,
  headingId,
  copy,
  testId = "selected-application-panel",
  variant = "inline",
}: {
  app: LauncherApp;
  pinned: boolean;
  onTogglePin: (id: string) => void;
  onClose?: () => void;
  headingId?: string;
  copy: LauncherCopy;
  testId?: string;
  variant?: "inline" | "sheet";
}) {
  const related = app.relatedIds.map(appById);

  return (
    <aside
      data-testid={testId}
      className={cn(
        variant === "inline"
          ? "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] lg:sticky lg:top-4"
          : "bg-transparent p-0",
      )}
      aria-label={copy.selectedLabel}
    >
      <div className="flex items-start justify-between gap-3">
        <p id={headingId} className="text-sm font-semibold text-[color:var(--text-heading)]">
          {copy.selectedLabel}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTogglePin(app.id)}
            aria-label={`${pinned ? "Unpin" : "Pin"} ${app.title}`}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:text-[color:var(--clinical-accent)]"
          >
            <Pin className={cn("h-4 w-4", pinned && "fill-current text-[color:var(--clinical-accent)]")} />
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.closeSelectedLabel}
              className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              aria-label={copy.optionsAriaLabel}
              className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Options unavailable</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3">
        <AppIcon app={app} />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-7 text-[color:var(--text-heading)]">{app.title}</h2>
          <p className={cn("mt-1 text-sm leading-5", textMuted)}>{app.description}</p>
          <div className="mt-2">
            <StatusPill status={app.status} />
          </div>
        </div>
      </div>

      <LaunchLink app={app} className="mt-4 w-full" />

      <section className="mt-5 border-t border-[color:var(--border)] pt-4">
        <h3 className="text-sm font-semibold text-[color:var(--clinical-accent)]">Overview</h3>
        <p className={cn("mt-2 text-sm leading-6", textMuted)}>{app.detail}</p>
      </section>

      <section className="mt-5">
        <h3 className="text-sm font-semibold text-[color:var(--clinical-accent)]">Quick actions</h3>
        <div className="mt-2 divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
          {app.quickActions.map((action) => (
            <button
              key={action}
              type="button"
              disabled
              aria-label={`${action} coming soon`}
              className="grid min-h-11 w-full cursor-not-allowed grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 text-left text-sm font-medium text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardList className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
              <span>{action}</span>
              <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[color:var(--clinical-accent)]">Recent workflows</h3>
          <span className="text-xs font-semibold text-[color:var(--clinical-accent)]">View all</span>
        </div>
        <div className="mt-2 space-y-2">
          {app.recentWorkflows.slice(0, 4).map((workflow) => (
            <div key={`${workflow.title}:${workflow.date}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-[color:var(--text)]">{workflow.title}</span>
              <span className="nums shrink-0 text-xs font-medium text-[color:var(--text-soft)]">{workflow.date}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[color:var(--clinical-accent)]">Recent activity</h3>
          <span className="text-xs font-semibold text-[color:var(--clinical-accent)]">View all</span>
        </div>
        <div className="mt-2 space-y-2">
          {recentActivity.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
                <span className="min-w-0 truncate text-[color:var(--text)]">{item.label}</span>
                <span className="nums shrink-0 text-xs font-medium text-[color:var(--text-soft)]">{item.date}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-5">
        <h3 className="text-sm font-semibold text-[color:var(--clinical-accent)]">{copy.relatedHeading}</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {related.map((relatedApp) => {
            const Icon = relatedApp.icon;
            return (
              <Link
                key={relatedApp.id}
                href={relatedApp.href}
                target={relatedApp.external ? "_blank" : undefined}
                rel={relatedApp.external ? "noopener noreferrer" : undefined}
                className="flex min-h-10 items-center gap-2 rounded-lg text-xs font-semibold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{relatedApp.shortTitle ?? relatedApp.title}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

type DashboardFilterId = (typeof dashboardFilterOptions)[number]["id"];

function DashboardStatsStrip({ apps }: { apps: LauncherApp[] }) {
  const stats = [
    { label: "Tools", value: String(apps.length), icon: Grid2X2 },
    { label: "Review due", value: String(apps.filter((app) => app.status === "review_due").length), icon: Clock3 },
    { label: "Recent", value: String(apps.filter((app) => app.status === "recent").length), icon: History },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[24rem]">
      {stats.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 shadow-[var(--shadow-inset)]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="nums block text-xl font-extrabold text-[color:var(--text-heading)]">{item.value}</span>
              <span className="text-xs font-bold text-[color:var(--text-muted)]">{item.label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DashboardSearchControl({ query, onQueryChange }: { query: string; onQueryChange: (query: string) => void }) {
  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="grid min-h-[3.25rem] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2 shadow-[var(--shadow-tight)]"
    >
      <Search className="ml-2 h-5 w-5 text-[color:var(--text-soft)]" aria-hidden />
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        aria-label="Search tools by clinical job, source, or workflow"
        placeholder="Search tools..."
        className="min-w-0 bg-transparent text-sm font-semibold text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
      />
      {query.trim() ? (
        <button
          type="button"
          onClick={() => onQueryChange("")}
          aria-label="Clear tool search"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[color:var(--border)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      )}
    </form>
  );
}

function DashboardFilterBar({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: DashboardFilterId;
  onFilterChange: (filter: DashboardFilterId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {dashboardFilterOptions.map((option) => {
        const Icon = option.icon;
        const active = option.id === activeFilter;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onFilterChange(option.id)}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold shadow-[var(--shadow-inset)] transition",
              active
                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)]",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function DashboardToolCard({ app, selected = false }: { app: LauncherApp; selected?: boolean }) {
  return (
    <Link
      href={app.href}
      target={app.external ? "_blank" : undefined}
      rel={app.external ? "noopener noreferrer" : undefined}
      aria-label={`Open ${app.title}`}
      className={cn(
        "group block rounded-lg border bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)]",
        selected
          ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent)]/25"
          : "border-[color:var(--border)]",
      )}
    >
      <div className="flex items-start gap-3">
        <AppIcon app={app} compact />
        <div className="min-w-0 flex-1">
          <div className="grid gap-2">
            <h3 className="text-base font-extrabold leading-6 text-[color:var(--text-heading)]">{app.title}</h3>
            <StatusPill status={app.status} />
          </div>
          <p className={cn("mt-1 line-clamp-2 text-sm font-medium leading-5", textMuted)}>{app.description}</p>
          <p className="mt-2 truncate text-xs font-bold text-[color:var(--text-soft)]">{app.detail}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="nums truncate text-xs font-semibold text-[color:var(--text-muted)]">{app.lastUsed}</span>
        <span className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-3 text-xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
          {app.primaryAction}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function DashboardWideToolTile({ app, selected = false }: { app: LauncherApp; selected?: boolean }) {
  return (
    <Link
      href={app.href}
      target={app.external ? "_blank" : undefined}
      rel={app.external ? "noopener noreferrer" : undefined}
      aria-label={`Open ${app.title}`}
      data-testid={`application-row-${app.id}`}
      className={cn(
        "group grid min-h-[8.75rem] rounded-lg border bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] transition hover:-translate-y-0.5 hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)] hover:shadow-[var(--shadow-soft)]",
        selected
          ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent)]/25"
          : "border-[color:var(--border)]",
      )}
    >
      <div className="flex items-start gap-3">
        <AppIcon app={app} compact />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <h3 className="min-w-0 flex-1 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">
              {app.title}
            </h3>
            <StatusPill status={app.status} />
          </div>
          <p className={cn("mt-1 line-clamp-2 text-sm font-medium leading-5", textMuted)}>{app.description}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <p className="truncate text-xs font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
            {app.areaLabel}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-[color:var(--text-muted)]">{app.workflow}</p>
        </div>
        <span className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-3 text-xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
          {app.primaryAction}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function DashboardPhonePreview({ apps }: { apps: LauncherApp[] }) {
  const phoneApps = apps.length ? apps.slice(0, 5) : launcherApps.slice(0, 5);
  const phoneRecents = recentActivity.slice(0, 2);

  return (
    <aside className="hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)] xl:sticky xl:top-4 xl:block">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Phone browser mode
          </p>
          <h2 className="mt-1 text-base font-extrabold text-[color:var(--text-heading)]">Direct launch layout</h2>
        </div>
        <span className="inline-flex min-h-7 items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 text-xs font-bold text-[color:var(--clinical-accent)]">
          <Smartphone className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          390px
        </span>
      </div>

      <div className="mx-auto mt-4 max-w-[19rem] rounded-[2rem] border border-[color:var(--border-strong)] bg-[color:var(--surface-chrome)] p-2 shadow-[var(--shadow-lux)]">
        <div className="overflow-hidden rounded-[1.45rem] border border-[color:var(--border)] bg-[color:var(--background)]">
          <div className="flex min-h-11 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3">
            <span className="text-sm font-extrabold text-[color:var(--text-heading)]">Clinical tools</span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
              <Search className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
          <div className="space-y-3 p-3">
            <div className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2">
              <Search className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
              <span className="truncate text-xs font-bold text-[color:var(--text-soft)]">Search tools</span>
              <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
            </div>

            <div className="grid gap-2">
              {phoneApps.map((app, index) => {
                const Icon = app.icon;
                return (
                  <Link
                    key={app.id}
                    href={app.href}
                    target={app.external ? "_blank" : undefined}
                    rel={app.external ? "noopener noreferrer" : undefined}
                    className={cn(
                      "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[color:var(--surface)] px-2 text-left shadow-[var(--shadow-inset)]",
                      index === 0 && "border border-[color:var(--clinical-accent-border)]",
                    )}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-extrabold text-[color:var(--text-heading)]">
                        {app.title}
                      </span>
                      <span className="block truncate text-2xs font-semibold text-[color:var(--text-soft)]">
                        {app.areaLabel}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
                  </Link>
                );
              })}
            </div>

            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)]">
              <div className="flex min-h-8 items-center justify-between border-b border-[color:var(--border)] px-2">
                <span className="text-2xs font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
                  Recents
                </span>
                <span className="text-2xs font-bold text-[color:var(--clinical-accent)]">View</span>
              </div>
              <div className="divide-y divide-[color:var(--border)]">
                {phoneRecents.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className="grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 text-left"
                    >
                      <Icon className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-2xs font-extrabold text-[color:var(--text-heading)]">
                          {item.label}
                        </span>
                        <span className="block truncate text-3xs font-semibold text-[color:var(--text-soft)]">
                          {item.date}
                        </span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function DashboardRecents({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[color:var(--border)] px-3">
        <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Recents</h2>
        <span className="text-xs font-bold text-[color:var(--clinical-accent)]">View all</span>
      </div>
      <div className="divide-y divide-[color:var(--border)]">
        {recentActivity.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const app = appById(item.id);
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onSelect(item.id)}
              className="grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left hover:bg-[color:var(--surface-subtle)]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">{item.label}</span>
                <span className="block truncate text-xs font-semibold text-[color:var(--text-soft)]">
                  {app.areaLabel}
                </span>
              </span>
              <span className="hidden items-center gap-3 sm:flex">
                <StatusPill status={app.status} />
                <span className="nums w-24 text-right text-xs font-semibold text-[color:var(--text-muted)]">
                  {item.date}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DashboardToolsCommandCenter({
  query,
  onQueryChange,
  activeFilter,
  onFilterChange,
  filteredApps,
  pinnedApps,
  selectedId,
  onSelect,
  desktopComposerSlotId,
  className,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  activeFilter: DashboardFilterId;
  onFilterChange: (filter: DashboardFilterId) => void;
  filteredApps: LauncherApp[];
  pinnedApps: LauncherApp[];
  selectedId: string;
  onSelect: (id: string) => void;
  desktopComposerSlotId?: string;
  className?: string;
}) {
  const startApps = seedPinnedIds.map(appById);

  return (
    <div data-testid="tools-hub" className={cn("mx-auto w-full max-w-7xl overflow-x-hidden", className)}>
      <section className="grid gap-5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-extrabold text-[color:var(--clinical-accent)]">
              Recommended direction
            </span>
            <span className="inline-flex min-h-7 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 text-xs font-bold text-[color:var(--text-muted)]">
              Launcher first
            </span>
          </div>
          <h1 className="mt-3 text-balance text-3xl font-extrabold leading-tight tracking-normal text-[color:var(--text-heading)] sm:text-4xl">
            Tools command center
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Open a tool directly, resume recent work, or search by clinical task.
          </p>
        </div>
        <DashboardStatsStrip apps={launcherApps} />
      </section>

      <main className="grid gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        {desktopComposerSlotId ? <div id={desktopComposerSlotId} className="hidden" /> : null}

        <section className="grid gap-3">
          <DashboardSearchControl query={query} onQueryChange={onQueryChange} />
          <DashboardFilterBar activeFilter={activeFilter} onFilterChange={onFilterChange} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="grid content-start gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Start here</h2>
              <p className="text-sm font-medium text-[color:var(--text-muted)]">Most-used tools stay one click away.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {startApps.map((app, index) => (
                <DashboardToolCard key={app.id} app={app} selected={index === 0} />
              ))}
            </div>
          </section>

          <DashboardPhonePreview apps={filteredApps.length ? filteredApps : pinnedApps} />
        </section>

        <section
          aria-label="All tools"
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)] sm:p-4"
        >
          <div className="grid gap-3 border-b border-[color:var(--border)] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
                <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">All tools</h2>
              </div>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                Every tool opens directly. Pick by task, status, or last-used context.
              </p>
            </div>
            <div className="text-xs font-bold text-[color:var(--text-muted)]">
              Showing {filteredApps.length} of {launcherApps.length}
            </div>
          </div>

          {filteredApps.length ? (
            <div className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredApps.map((app) => (
                <DashboardWideToolTile key={app.id} app={app} selected={app.id === selectedId} />
              ))}
            </div>
          ) : (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">No tools match</p>
              <p className={cn("mx-auto mt-1 max-w-md text-sm leading-6", textMuted)}>
                Clear the search or try another clinical workflow, tool name, or category.
              </p>
            </div>
          )}
        </section>

        <DashboardRecents onSelect={onSelect} />
      </main>
    </div>
  );
}

type ApplicationsLauncherWorkspaceProps = {
  variant?: LauncherVariant;
  query?: string;
  onQueryChange?: (query: string) => void;
  desktopComposerSlotId?: string;
  className?: string;
};

export function ApplicationsLauncherWorkspace({
  variant = "standalone",
  query: controlledQuery,
  onQueryChange,
  desktopComposerSlotId,
  className,
}: ApplicationsLauncherWorkspaceProps) {
  const [uncontrolledQuery, setUncontrolledQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof filterOptions)[number]["id"]>("all");
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilterId>("all");
  const [selectedId, setSelectedId] = useState("clinical-kb-search");
  const [pinnedIds, setPinnedIds] = useState(seedPinnedIds);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const isDashboardTools = variant === "dashboard-tools";
  const copy = isDashboardTools ? dashboardToolsLauncherCopy : standaloneLauncherCopy;
  const query = controlledQuery ?? uncontrolledQuery;

  const normalizedQuery = query.trim().toLowerCase();
  const pinnedApps = pinnedIds.map(appById);
  const selectedApp = appById(selectedId);

  const filteredApps = useMemo(() => {
    return launcherApps.filter((app) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "recent"
          ? app.status === "recent" || app.category === "recent"
          : app.category === activeFilter);
      const matchesQuery =
        !normalizedQuery ||
        [app.title, app.description, app.workflow, app.detail].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, normalizedQuery]);

  const dashboardFilteredApps = useMemo(() => {
    return launcherApps.filter((app) => {
      const matchesFilter =
        dashboardFilter === "all" ||
        (dashboardFilter === "pinned"
          ? pinnedIds.includes(app.id)
          : dashboardFilter === "review_due"
            ? app.status === "review_due"
            : app.sourceBacked);
      const matchesQuery =
        !normalizedQuery ||
        [app.title, app.description, app.workflow, app.detail, app.areaLabel].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      return matchesFilter && matchesQuery;
    });
  }, [dashboardFilter, normalizedQuery, pinnedIds]);

  function togglePin(id: string) {
    setPinnedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]));
  }

  function selectApplication(id: string) {
    setSelectedId(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileDetailOpen(true);
    }
  }

  function updateQuery(nextQuery: string) {
    if (controlledQuery === undefined) {
      setUncontrolledQuery(nextQuery);
    }
    onQueryChange?.(nextQuery);
  }

  function submitFooterSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstMatch = filteredApps[0];
    if (firstMatch) selectApplication(firstMatch.id);
  }

  if (isDashboardTools) {
    return (
      <DashboardToolsCommandCenter
        query={query}
        onQueryChange={updateQuery}
        activeFilter={dashboardFilter}
        onFilterChange={setDashboardFilter}
        filteredApps={dashboardFilteredApps}
        pinnedApps={pinnedApps}
        selectedId={selectedId}
        onSelect={selectApplication}
        desktopComposerSlotId={desktopComposerSlotId}
        className={className}
      />
    );
  }

  const workspace = (
    <>
      {isDashboardTools ? (
        <section className="mx-auto grid w-full max-w-5xl gap-4 pt-4 sm:pt-7">
          <div className="grid justify-items-center gap-5 text-center sm:gap-6">
            <ModeHomeHero
              testId="tools-home"
              title={copy.heading}
              subtitle={copy.description}
              icon={Grid2X2}
              headingLevel={2}
            />
            {desktopComposerSlotId ? (
              <div id={desktopComposerSlotId} className="hidden w-full max-w-[52rem] lg:block" />
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-3">
            <HeaderFilter activeFilter={activeFilter} onFilterChange={setActiveFilter} />
            {normalizedQuery ? (
              <button
                type="button"
                onClick={() => updateQuery("")}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear search
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="mx-auto flex min-h-[14rem] max-w-3xl flex-col items-center justify-center px-5 py-7 text-center sm:min-h-[16rem] sm:py-8 lg:min-h-[17rem]">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16">
            <Grid2X2 className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:mt-5 sm:text-4xl">
            {copy.heading}
          </h1>
          <p className="mt-3 max-w-xl text-base-minus leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            {copy.description}
          </p>
          <div className="mt-6">
            <HeaderFilter activeFilter={activeFilter} onFilterChange={setActiveFilter} />
          </div>
          <form onSubmit={submitFooterSearch} className={cn(chatComposerShell, "mt-5 w-full max-w-2xl")}>
            <button
              type="button"
              className={cn(chatComposerIconButton, "disabled:cursor-not-allowed")}
              aria-label={copy.actionsAriaLabel}
              title={copy.actionsAriaLabel}
              disabled
            >
              <Plus className="h-5 w-5" />
            </button>
            <label className="relative flex min-w-0 flex-1 items-center overflow-hidden">
              <input
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                aria-label={copy.searchAriaLabel}
                placeholder={copy.searchPlaceholder}
                className={cn(chatComposerInput, "w-full min-w-0")}
              />
            </label>
            <button
              type="submit"
              disabled={filteredApps.length === 0}
              className={chatSendButton}
              aria-label={copy.openSelectedAriaLabel}
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Open</span>
            </button>
          </form>
        </section>
      )}

      <div
        className={cn(
          "mx-auto grid gap-4 pb-6 lg:items-start",
          isDashboardTools
            ? "w-full max-w-6xl lg:grid-cols-[minmax(0,1fr)_23rem]"
            : "max-w-7xl px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem]",
        )}
      >
        <div className="min-w-0 space-y-4">
          <PinnedSection
            pinnedApps={pinnedApps}
            selectedId={selectedId}
            onSelect={selectApplication}
            onTogglePin={togglePin}
            copy={copy}
          />

          <section
            aria-label={copy.allSectionLabel}
            className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]"
          >
            <div className="flex min-h-12 items-center gap-2 border-b border-[color:var(--border)] px-3">
              <BookOpen className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
              <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">{copy.allSectionLabel}</h2>
            </div>

            <div className="hidden grid-cols-[auto_minmax(0,1fr)_7rem_6rem_5.5rem_auto] gap-3 px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] lg:grid">
              <span className="col-span-2">{copy.allColumnLabel}</span>
              <span>Last used</span>
              <span>Status</span>
              <span>Action</span>
              <span />
            </div>

            {filteredApps.length === 0 ? (
              <div className="border-t border-[color:var(--border)] px-3 py-8 text-center">
                <p className="text-sm font-semibold text-[color:var(--text-heading)]">{copy.emptyTitle}</p>
                <p className={cn("mx-auto mt-1 max-w-md text-sm leading-6", textMuted)}>{copy.emptyBody}</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  {filteredApps.map((app) => (
                    <ApplicationRow
                      key={app.id}
                      app={app}
                      selected={selectedId === app.id}
                      pinned={pinnedIds.includes(app.id)}
                      onSelect={selectApplication}
                      onTogglePin={togglePin}
                    />
                  ))}
                </div>

                <div className="lg:hidden">
                  {filteredApps.map((app) => (
                    <MobileApplicationRow
                      key={app.id}
                      app={app}
                      selected={selectedId === app.id}
                      onSelect={selectApplication}
                    />
                  ))}
                </div>
              </>
            )}

            <p className="border-t border-[color:var(--border)] px-3 py-3 text-xs font-medium text-[color:var(--text-muted)]">
              Showing {filteredApps.length > 0 ? "1" : "0"} to {filteredApps.length} of {launcherApps.length}{" "}
              {copy.countNoun}
            </p>
          </section>

          <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">Recent activity</h2>
              <span className="text-xs font-semibold text-[color:var(--clinical-accent)]">View all</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {recentActivity.slice(0, 3).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => selectApplication(item.id)}
                    className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-left shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <Icon className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
                        {item.label}
                      </span>
                      <span className="nums block truncate text-xs text-[color:var(--text-soft)]">{item.date}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="hidden lg:block">
          <DetailPanel app={selectedApp} pinned={pinnedIds.includes(selectedId)} onTogglePin={togglePin} copy={copy} />
        </div>
      </div>

      <Sheet
        open={mobileDetailOpen}
        onClose={() => setMobileDetailOpen(false)}
        labelledBy="selected-application-sheet-heading"
        closeLabel={copy.closeSelectedLabel}
        contentClassName="lg:hidden rounded-t-[1.75rem] bg-[color:var(--surface-lux)]"
        bodyClassName="px-5 pb-6 pt-4 sm:px-5"
        portal
      >
        <DetailPanel
          app={selectedApp}
          pinned={pinnedIds.includes(selectedId)}
          onTogglePin={togglePin}
          onClose={() => setMobileDetailOpen(false)}
          headingId="selected-application-sheet-heading"
          copy={copy}
          testId="selected-application-sheet-panel"
          variant="sheet"
        />
      </Sheet>
    </>
  );

  if (isDashboardTools) {
    return (
      <div
        data-testid="tools-hub"
        className={cn("mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden sm:space-y-5", className)}
      >
        {workspace}
      </div>
    );
  }

  return <main className={cn("min-w-0 pb-8 text-[color:var(--text)] lg:pb-10", className)}>{workspace}</main>;
}

export function ApplicationsLauncherPage() {
  return <ApplicationsLauncherWorkspace variant="standalone" />;
}
