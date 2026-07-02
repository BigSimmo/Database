"use client";

import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Grid2X2,
  Globe2,
  Mic,
  Menu,
  MoreVertical,
  Pill,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import {
  appBackdrop,
  chatComposerIconButton,
  chatComposerInput,
  chatComposerShell,
  chatSendButton,
  cn,
  sidebarItem,
  sidebarToolTile as sidebarApplicationTile,
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
  { label: "Answer", icon: Sparkles, href: "/?mode=answer" },
  { label: "Documents", icon: FileText, href: "/?mode=documents" },
  { label: "Services", icon: ClipboardList, href: "/services" },
  { label: "Forms", icon: FileText, href: "/forms" },
  { label: "Meds", icon: Pill, href: "/?mode=prescribing" },
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
    relatedIds: ["documents", "services", "medication-prescribing"],
    quickActions: ["Ask clinical question", "Search indexed guidelines", "Open document scope", "Review sources"],
    recentWorkflows: [
      { title: "Lithium monitoring search", date: "Today, 7:30 AM" },
      { title: "Safety plan search", date: "May 12, 2025" },
      { title: "Clozapine source check", date: "May 10, 2025" },
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
      contentClassName="font-sans lg:hidden"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <Link
          href="/"
          onClick={() => onOpenChange(false)}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-3 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--clinical-accent-hover)]"
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
                  <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" />
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
          <button
            type="button"
            className={cn(sidebarItem, "disabled:cursor-not-allowed disabled:opacity-60")}
            disabled
            aria-label="Settings coming soon"
            title="Settings coming soon"
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 shadow-[var(--shadow-inset)]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-xs font-bold text-[color:var(--clinical-accent)]">
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
      label: "Services",
      description: "Service records and referral pathways",
      href: "/services",
      icon: ClipboardList,
      active: false,
    },
    {
      label: "Forms",
      description: "Clinical forms and pathways",
      href: "/forms",
      icon: FileText,
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
                ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
                option.active
                  ? "border-[color:var(--clinical-accent)]/25 bg-[color:var(--surface)]"
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
      className="edge-glass-header sticky top-0 z-30 border-b border-[color:var(--border)] py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[color:var(--text)] shadow-[var(--shadow-tight)] backdrop-blur-xl"
    >
      <div className="mx-auto flex h-12 min-w-0 max-w-7xl items-center gap-2">
        <button
          type="button"
          onClick={() => onMobileMenuOpenChange(true)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:hidden"
          aria-label="Open Clinical Guide menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative z-40 mx-auto min-w-0 flex-1 sm:mx-0 sm:flex-none">
          <button
            type="button"
            onClick={() => onModeMenuOpenChange(!modeMenuOpen)}
            className="inline-grid h-11 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:w-auto sm:min-w-[14rem]"
            aria-haspopup="true"
            aria-expanded={modeMenuOpen}
            aria-label="Current app mode: Applications"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
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
  const [selectedId, setSelectedId] = useState("clinical-kb-search");
  const [pinnedIds, setPinnedIds] = useState(seedPinnedIds);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
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

  const workspace = (
    <>
      {isDashboardTools ? (
        <section className="mx-auto grid w-full max-w-5xl gap-4 pt-4 sm:pt-7">
          <div className="grid justify-items-center gap-3 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-lg border border-[color:var(--clinical-accent)]/15 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16">
              <Grid2X2 className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
            </span>
            <div className="max-w-2xl space-y-2">
              <h2 className="text-3xl font-bold tracking-normal text-[color:var(--text-heading)] sm:text-4xl">
                {copy.heading}
              </h2>
              <p className="text-sm leading-6 text-[color:var(--text-muted)] sm:text-[15px]">{copy.description}</p>
            </div>
            {desktopComposerSlotId ? (
              <div id={desktopComposerSlotId} className="mt-2 hidden w-full max-w-3xl lg:block" />
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
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
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
              type="button"
              className={cn(chatComposerIconButton, "disabled:cursor-not-allowed")}
              aria-label="Voice input unavailable"
              title="Voice input unavailable"
              disabled
            >
              <Mic className="h-4.5 w-4.5" />
            </button>
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

  return (
    <div className={cn(appBackdrop, "min-h-[100dvh] text-[color:var(--text)]", className)}>
      <ApplicationsHeader
        mobileMenuOpen={mobileMenuOpen}
        modeMenuOpen={modeMenuOpen}
        onMobileMenuOpenChange={setMobileMenuOpen}
        onModeMenuOpenChange={setModeMenuOpen}
      />
      <ApplicationsMobileMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

      <main id="main-content" className="min-w-0 pb-8 lg:pb-10">
        {workspace}
      </main>
    </div>
  );
}

export function ApplicationsLauncherPage() {
  return <ApplicationsLauncherWorkspace variant="standalone" />;
}
