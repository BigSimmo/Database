"use client";

import Link from "next/link";
import {
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Grid2X2,
  Globe2,
  ListChecks,
  Mic,
  Menu,
  MoreVertical,
  Pill,
  Pin,
  PinOff,
  Plus,
  Puzzle,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  Stethoscope,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import {
  chatComposerIconButton,
  chatComposerInput,
  chatComposerShell,
  chatSendButton,
  cn,
  sidebarItem,
  sidebarToolTile as sidebarApplicationTile,
  textMuted,
} from "@/components/ui-primitives";
import { toolCatalog } from "@/lib/tools";

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

const sidebarApplicationItems = [
  { label: "Formulation", icon: Brain, href: "/applications" },
  { label: "DSM-5", icon: BookOpen, href: "/applications" },
  { label: "Meds", icon: Pill, href: "/?mode=prescribing" },
  { label: "Diffs", icon: Search, href: "/applications" },
] as const;

function toolById(id: string) {
  return toolCatalog.find((tool) => tool.id === id);
}

function hrefForTool(id: string, fallback: string) {
  return toolById(id)?.href ?? fallback;
}

function isExternalTool(id: string) {
  return toolById(id)?.target === "external";
}

const launcherApps: LauncherApp[] = [
  {
    id: "differential-diagnosis",
    title: "Differential Diagnosis",
    description: "Generate and explore differential diagnoses.",
    detail: "Compare likely differentials, rule-outs, red flags, and competing diagnostic explanations.",
    href: hrefForTool("differentials", "http://127.0.0.1:53375"),
    external: isExternalTool("differentials"),
    icon: Stethoscope,
    category: "recent",
    workflow: "Assessment",
    lastUsed: "Today, 10:24 AM",
    status: "recent",
    sourceToolId: "differentials",
    relatedIds: ["specifiers", "services", "clinical-kb-search"],
    quickActions: ["Start differential", "Review red flags", "Compare rule-outs", "Open assessment history"],
    recentWorkflows: [
      { title: "Chest pain differential", date: "Today, 10:24 AM" },
      { title: "Headache workup", date: "Yesterday, 3:11 PM" },
      { title: "Fatigue assessment", date: "May 10, 2025" },
    ],
  },
  {
    id: "specifiers",
    title: "Specifiers",
    description: "Add clinical specifiers and refine conditions.",
    detail: "Review severity, course, qualifiers, and specifier language for a diagnosis.",
    href: hrefForTool("specifiers", "http://127.0.0.1:58123"),
    external: isExternalTool("specifiers"),
    icon: ListChecks,
    category: "clinical",
    workflow: "Assessment",
    lastUsed: "Yesterday, 4:15 PM",
    status: "ready",
    sourceToolId: "specifiers",
    relatedIds: ["differential-diagnosis", "formulation", "clinical-kb-search"],
    quickActions: ["Open specifier review", "Check course descriptors", "Review severity", "Browse qualifiers"],
    recentWorkflows: [
      { title: "Mood episode specifiers", date: "Yesterday, 4:15 PM" },
      { title: "Anxiety course review", date: "May 11, 2025" },
      { title: "Psychosis qualifiers", date: "May 8, 2025" },
    ],
  },
  {
    id: "services",
    title: "Services",
    description: "Browse and manage clinical services.",
    detail: "Find referral pathways, access points, service matching, and destination options.",
    href: hrefForTool("services", "http://127.0.0.1:53174"),
    external: isExternalTool("services"),
    icon: Users,
    category: "clinical",
    workflow: "Care planning",
    lastUsed: "May 12, 2025",
    status: "ready",
    sourceToolId: "services",
    relatedIds: ["formulation", "documents", "clinical-kb-search"],
    quickActions: ["Find referral pathway", "Browse service options", "Review access criteria", "Open saved pathway"],
    recentWorkflows: [
      { title: "Community referral options", date: "May 12, 2025" },
      { title: "Crisis pathway review", date: "May 9, 2025" },
      { title: "Outpatient access check", date: "May 7, 2025" },
    ],
  },
  {
    id: "formulation",
    title: "Formulation",
    description: "Create and manage clinical formulations.",
    detail: "Structure case formulations to support assessment, conceptualisation, care planning, and team reuse.",
    href: hrefForTool("formulation", "http://localhost:53210"),
    external: isExternalTool("formulation"),
    icon: Puzzle,
    category: "recent",
    workflow: "Care planning",
    lastUsed: "Today, 9:02 AM",
    status: "recent",
    sourceToolId: "formulation",
    relatedIds: ["differential-diagnosis", "medication-prescribing", "documents", "clinical-kb-search"],
    quickActions: ["Create new formulation", "Browse my formulations", "Shared with me", "Formulation templates"],
    recentWorkflows: [
      { title: "Mood & anxiety formulation - Jane D.", date: "Today, 9:02 AM" },
      { title: "Complex case review - M. Smith", date: "May 12, 2025" },
      { title: "Care plan formulation - P. Johnson", date: "May 9, 2025" },
      { title: "Discharge formulation - K. Patel", date: "May 7, 2025" },
    ],
  },
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
    sourceToolId: "medications",
    relatedIds: ["formulation", "documents", "clinical-kb-search"],
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
    relatedIds: ["clinical-kb-search", "favourites", "formulation"],
    quickActions: ["Search documents", "Browse library", "Open source PDF", "Review indexed documents"],
    recentWorkflows: [
      { title: "Lithium monitoring guideline", date: "May 10, 2025" },
      { title: "Safety plan source review", date: "May 9, 2025" },
      { title: "Clozapine monitoring protocol", date: "May 7, 2025" },
    ],
  },
  {
    id: "favourites",
    title: "Favourites",
    description: "View and manage your saved items.",
    detail: "Open saved sources, medications, documents, workflows, and reusable clinical sets.",
    href: "/?mode=favourites",
    external: false,
    icon: Star,
    category: "recent",
    workflow: "Reference",
    lastUsed: "Today, 8:45 AM",
    status: "recent",
    relatedIds: ["documents", "clinical-kb-search", "formulation"],
    quickActions: ["Open saved items", "Manage pinned sets", "Review due favourites", "Add current answer"],
    recentWorkflows: [
      { title: "Ward round set", date: "Today, 8:45 AM" },
      { title: "Prescribing safety set", date: "May 12, 2025" },
      { title: "Document QA set", date: "May 10, 2025" },
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
    relatedIds: ["documents", "favourites", "differential-diagnosis"],
    quickActions: ["Ask clinical question", "Search indexed guidelines", "Open document scope", "Review sources"],
    recentWorkflows: [
      { title: "Lithium monitoring search", date: "Today, 7:30 AM" },
      { title: "Safety plan search", date: "May 12, 2025" },
      { title: "Clozapine source check", date: "May 10, 2025" },
    ],
  },
];

const seedPinnedIds = ["formulation", "differential-diagnosis", "medication-prescribing"];

const recentActivity = [
  { id: "formulation", label: "Formulation opened", date: "Today, 9:02 AM", icon: Puzzle },
  {
    id: "differential-diagnosis",
    label: "Differential Diagnosis launched",
    date: "Today, 10:24 AM",
    icon: Stethoscope,
  },
  { id: "medication-prescribing", label: "Medication Prescribing reviewed", date: "May 12, 2025", icon: Pill },
  { id: "documents", label: "Documents opened", date: "May 10, 2025", icon: FileText },
] as const;

function appById(id: string) {
  return launcherApps.find((app) => app.id === id) ?? launcherApps[0];
}

function StatusPill({ status }: { status: LauncherStatus }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-md border px-2 text-[11px] font-bold",
        statusStyles[status],
      )}
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
        "grid shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]",
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
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-chat-teal)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-tight)] hover:bg-[color:var(--primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
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
                ? "bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]"
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
}: {
  pinnedApps: LauncherApp[];
  selectedId: string;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  return (
    <section
      aria-label="Pinned applications"
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]"
    >
      <div className="flex min-h-10 items-center justify-between border-b border-[color:var(--border)] px-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)]">
          <Pin className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" aria-hidden />
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
                selected && "bg-[color:var(--clinical-chat-teal-soft)]/55",
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
                className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--clinical-chat-teal)]"
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
          "rounded-lg border border-[color:var(--clinical-chat-teal)] bg-[color:var(--clinical-chat-teal-soft)]/55 shadow-[var(--glow-soft)]",
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
        className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--clinical-chat-teal)]"
      >
        <Pin className={cn("h-4 w-4", pinned && "fill-current text-[color:var(--clinical-chat-teal)]")} aria-hidden />
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
        selected &&
          "rounded-lg border border-[color:var(--clinical-chat-teal)] bg-[color:var(--clinical-chat-teal-soft)]/60",
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
  testId = "selected-application-panel",
  variant = "inline",
}: {
  app: LauncherApp;
  pinned: boolean;
  onTogglePin: (id: string) => void;
  onClose?: () => void;
  headingId?: string;
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
      aria-label="Selected application"
    >
      <div className="flex items-start justify-between gap-3">
        <p id={headingId} className="text-sm font-semibold text-[color:var(--text-heading)]">
          Selected application
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTogglePin(app.id)}
            aria-label={`${pinned ? "Unpin" : "Pin"} ${app.title}`}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:text-[color:var(--clinical-chat-teal)]"
          >
            <Pin className={cn("h-4 w-4", pinned && "fill-current text-[color:var(--clinical-chat-teal)]")} />
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close selected application"
              className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Open application options"
              className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]"
            >
              <MoreVertical className="h-4 w-4" />
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
        <h3 className="text-sm font-semibold text-[color:var(--clinical-chat-teal)]">Overview</h3>
        <p className={cn("mt-2 text-sm leading-6", textMuted)}>{app.detail}</p>
      </section>

      <section className="mt-5">
        <h3 className="text-sm font-semibold text-[color:var(--clinical-chat-teal)]">Quick actions</h3>
        <div className="mt-2 divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
          {app.quickActions.map((action) => (
            <button
              key={action}
              type="button"
              className="grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 text-left text-sm font-medium text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]"
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
          <h3 className="text-sm font-semibold text-[color:var(--clinical-chat-teal)]">Recent workflows</h3>
          <button type="button" className="text-xs font-semibold text-[color:var(--clinical-chat-teal)]">
            View all
          </button>
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
          <h3 className="text-sm font-semibold text-[color:var(--clinical-chat-teal)]">Recent activity</h3>
          <button type="button" className="text-xs font-semibold text-[color:var(--clinical-chat-teal)]">
            View all
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {recentActivity.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <Icon className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" aria-hidden />
                <span className="min-w-0 truncate text-[color:var(--text)]">{item.label}</span>
                <span className="nums shrink-0 text-xs font-medium text-[color:var(--text-soft)]">{item.date}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-5">
        <h3 className="text-sm font-semibold text-[color:var(--clinical-chat-teal)]">Related apps</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {related.map((relatedApp) => {
            const Icon = relatedApp.icon;
            return (
              <Link
                key={relatedApp.id}
                href={relatedApp.href}
                target={relatedApp.external ? "_blank" : undefined}
                rel={relatedApp.external ? "noopener noreferrer" : undefined}
                className="flex min-h-10 items-center gap-2 rounded-lg text-xs font-semibold text-[color:var(--clinical-chat-teal)] hover:bg-[color:var(--clinical-chat-teal-soft)]"
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

function ApplicationsMobileMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const recentQueries = ["lithium", "tables", "dosing for lithium", "management of bulimia nervosa"];

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title="Clinical Guide"
      description="Recent chats, applications, help, and settings."
      closeLabel="Close Clinical Guide menu"
      placement="left"
      contentClassName="lg:hidden"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <Link
          href="/"
          onClick={() => onOpenChange(false)}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-chat-teal)] px-3 text-sm font-semibold text-white shadow-[var(--shadow-tight)] hover:bg-[color:var(--primary-strong)]"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Link>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
          <input
            type="search"
            placeholder="Search chats"
            className="h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-9 pr-3 text-sm font-medium text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20"
          />
        </label>

        <section className="min-w-0">
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Recent chats
          </p>
          <div className="grid gap-1">
            {recentQueries.map((recent) => (
              <button key={recent} type="button" className={sidebarItem} onClick={() => onOpenChange(false)}>
                <Search className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">{recent}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Applications
          </p>
          <div className="grid grid-cols-2 gap-2">
            {sidebarApplicationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={sidebarApplicationTile}
                >
                  <Icon className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="mt-auto grid gap-1 border-t border-[color:var(--border)] pt-3">
          <button type="button" className={sidebarItem} onClick={() => onOpenChange(false)}>
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>Guide & help</span>
          </button>
          <button type="button" className={sidebarItem}>
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 shadow-[var(--shadow-inset)]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-chat-teal-soft)] text-xs font-bold text-[color:var(--clinical-chat-teal)]">
              AK
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[color:var(--text)]">Dr A. Khan</span>
              <span className={cn("text-xs", textMuted)}>Ready</span>
            </span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function ApplicationsModeMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const options = [
    {
      label: "Answer",
      description: "Source-backed clinical answer",
      href: "/?mode=answer",
      icon: Sparkles,
      active: false,
    },
    {
      label: "Documents",
      description: "Search indexed PDFs and notes",
      href: "/?mode=documents",
      icon: FileText,
      active: false,
    },
    {
      label: "Favourites",
      description: "Saved sources and workflows",
      href: "/?mode=favourites",
      icon: Star,
      active: false,
    },
    {
      label: "Applications",
      description: "Launch connected applications",
      href: "/applications",
      icon: Grid2X2,
      active: true,
    },
  ] as const;

  if (!open) return null;

  return (
    <div
      role="group"
      aria-label="Choose app mode"
      className="absolute left-1/2 top-[calc(100%+0.5rem)] z-50 w-[min(21rem,calc(100vw-4rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-1.5 text-[color:var(--text)] shadow-[var(--shadow-lux)] ring-1 ring-white/25 backdrop-blur-md dark:ring-white/10 sm:left-0 sm:w-[min(21rem,calc(100vw-2rem))] sm:translate-x-0"
    >
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Link
            key={option.label}
            href={option.href}
            onClick={() => onOpenChange(false)}
            aria-current={option.active ? "page" : undefined}
            className={cn(
              "grid min-h-[3.25rem] w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              option.active
                ? "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
                option.active
                  ? "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--surface)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-raised)]",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{option.label}</span>
              <span className="block truncate text-[11px] font-medium text-[color:var(--text-soft)]">
                {option.description}
              </span>
            </span>
            {option.active ? <Check className="h-4 w-4" /> : null}
          </Link>
        );
      })}
    </div>
  );
}

function ApplicationsHeader({
  mobileMenuOpen,
  modeMenuOpen,
  onMobileMenuOpenChange,
  onModeMenuOpenChange,
}: {
  mobileMenuOpen: boolean;
  modeMenuOpen: boolean;
  onMobileMenuOpenChange: (open: boolean) => void;
  onModeMenuOpenChange: (open: boolean) => void;
}) {
  return (
    <header
      id="search"
      className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)]/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[color:var(--text)] shadow-[var(--shadow-tight)] backdrop-blur-xl sm:px-4 lg:px-6"
    >
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-2">
        <button
          type="button"
          onClick={() => onMobileMenuOpenChange(true)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:hidden"
          aria-label="Open Clinical Guide menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative z-40 mx-auto sm:mx-0">
          <button
            type="button"
            onClick={() => onModeMenuOpenChange(!modeMenuOpen)}
            className="inline-grid h-11 min-w-[10rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-w-[14rem]"
            aria-haspopup="true"
            aria-expanded={modeMenuOpen}
            aria-label="Current app mode: Applications"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]">
              <Grid2X2 className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                Mode
              </span>
              <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
                Applications
              </span>
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 rotate-90 text-[color:var(--text-soft)] transition-transform motion-reduce:transition-none",
                modeMenuOpen && "-rotate-90",
              )}
            />
          </button>
          <ApplicationsModeMenu open={modeMenuOpen} onOpenChange={onModeMenuOpenChange} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/?mode=documents"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            aria-label="Open document scope"
            title="Document scope"
          >
            <Globe2 className="h-5 w-5" />
          </Link>
          <Link
            href="/"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            aria-label="Start a new chat"
            title="New chat"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function ApplicationsLauncherPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof filterOptions)[number]["id"]>("all");
  const [selectedId, setSelectedId] = useState("formulation");
  const [pinnedIds, setPinnedIds] = useState(seedPinnedIds);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

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

  function togglePin(id: string) {
    setPinnedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]));
  }

  function selectApplication(id: string) {
    setSelectedId(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileDetailOpen(true);
    }
  }

  function submitFooterSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstMatch = filteredApps[0];
    if (firstMatch) selectApplication(firstMatch.id);
  }

  return (
    <div className="min-h-screen bg-[color:var(--surface)] text-[color:var(--text)]">
      <ApplicationsHeader
        mobileMenuOpen={mobileMenuOpen}
        modeMenuOpen={modeMenuOpen}
        onMobileMenuOpenChange={setMobileMenuOpen}
        onModeMenuOpenChange={setModeMenuOpen}
      />
      <ApplicationsMobileMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

      <main id="main-content" className="min-w-0 pb-32 lg:pb-28">
        <section className="mx-auto flex min-h-[17rem] max-w-3xl flex-col items-center justify-center px-5 py-10 text-center sm:min-h-[20rem] sm:py-12 lg:min-h-[22rem]">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16">
            <Grid2X2 className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:mt-5 sm:text-4xl">
            Applications
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            Open the clinical applications and connected workflows you use for assessment, formulation, prescribing,
            documents, and saved workflows.
          </p>
          <div className="mt-6">
            <HeaderFilter activeFilter={activeFilter} onFilterChange={setActiveFilter} />
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl gap-4 px-4 pb-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <div className="min-w-0 space-y-4">
            <PinnedSection
              pinnedApps={pinnedApps}
              selectedId={selectedId}
              onSelect={selectApplication}
              onTogglePin={togglePin}
            />

            <section
              aria-label="All applications"
              className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]"
            >
              <div className="flex min-h-12 items-center gap-2 border-b border-[color:var(--border)] px-3">
                <BookOpen className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" aria-hidden />
                <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">All applications</h2>
              </div>

              <div className="hidden grid-cols-[auto_minmax(0,1fr)_7rem_6rem_5.5rem_auto] gap-3 px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] lg:grid">
                <span className="col-span-2">Application</span>
                <span>Last used</span>
                <span>Status</span>
                <span>Action</span>
                <span />
              </div>

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

              <p className="border-t border-[color:var(--border)] px-3 py-3 text-xs font-medium text-[color:var(--text-muted)]">
                Showing {filteredApps.length > 0 ? "1" : "0"} to {filteredApps.length} of {launcherApps.length}{" "}
                applications
              </p>
            </section>

            <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">Recent activity</h2>
                <button type="button" className="text-xs font-semibold text-[color:var(--clinical-chat-teal)]">
                  View all
                </button>
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
                      <Icon className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" aria-hidden />
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
            <DetailPanel app={selectedApp} pinned={pinnedIds.includes(selectedId)} onTogglePin={togglePin} />
          </div>
        </div>
      </main>

      <Sheet
        open={mobileDetailOpen}
        onClose={() => setMobileDetailOpen(false)}
        labelledBy="selected-application-sheet-heading"
        closeLabel="Close selected application"
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
          testId="selected-application-sheet-panel"
          variant="sheet"
        />
      </Sheet>

      <form
        onSubmit={submitFooterSearch}
        className={cn(
          chatComposerShell,
          "fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl sm:bottom-4 lg:left-8 lg:right-8 lg:max-w-3xl",
        )}
      >
        <button
          type="button"
          className={chatComposerIconButton}
          aria-label="Open application actions"
          title="Open application actions"
        >
          <Plus className="h-5 w-5" />
        </button>
        <label className="relative flex min-w-0 flex-1 items-center overflow-hidden">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search applications"
            placeholder="Search applications..."
            className={cn(chatComposerInput, "w-full min-w-0")}
          />
        </label>
        <button type="button" className={chatComposerIconButton} aria-label="Voice input" title="Voice input">
          <Mic className="h-4.5 w-4.5" />
        </button>
        <button
          type="submit"
          disabled={filteredApps.length === 0}
          className={chatSendButton}
          aria-label="Open selected application"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Open</span>
        </button>
      </form>
    </div>
  );
}
