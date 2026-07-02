import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  Grid2X2,
  HeartPulse,
  History,
  LayoutDashboard,
  Pill,
  Pin,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

export type ToolsPageMockupVariant = "command-center" | "workflow-board" | "split-pane";

type ToolStatus = "ready" | "review_due" | "recent";
type ToolArea = "reference" | "assessment" | "care" | "coordination" | "personal";

type ToolFixture = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  area: ToolArea;
  status: ToolStatus;
  lastUsed: string;
  primaryAction: string;
  secondary: string;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const tools: ToolFixture[] = [
  {
    id: "clinical-kb-search",
    title: "Clinical KB Search",
    description: "Ask source-backed clinical questions and move straight to evidence.",
    href: "/?mode=answer",
    icon: Search,
    area: "reference",
    status: "ready",
    lastUsed: "Today, 7:30 AM",
    primaryAction: "Ask",
    secondary: "Guidance, answers, source checks",
  },
  {
    id: "documents",
    title: "Documents",
    description: "Search indexed PDFs, policies, guidelines, pages, tables, and images.",
    href: "/?mode=documents",
    icon: FileText,
    area: "reference",
    status: "ready",
    lastUsed: "May 10, 2025",
    primaryAction: "Search",
    secondary: "Library, source PDF, index health",
  },
  {
    id: "differentials",
    title: "Differentials",
    description: "Build and compare diagnostic possibilities with source-aware prompts.",
    href: "/differentials",
    icon: Brain,
    area: "assessment",
    status: "recent",
    lastUsed: "Today, 8:40 AM",
    primaryAction: "Compare",
    secondary: "Assessment, risks, presentation view",
  },
  {
    id: "medication-prescribing",
    title: "Medication Prescribing",
    description: "Review prescribing context, monitoring, interactions, and cautions.",
    href: "/?mode=prescribing",
    icon: Pill,
    area: "care",
    status: "review_due",
    lastUsed: "May 12, 2025",
    primaryAction: "Prescribe",
    secondary: "Monitoring, interactions, templates",
  },
  {
    id: "services",
    title: "Services",
    description: "Open source-backed service records, referral routes, and eligibility.",
    href: "/services",
    icon: ClipboardList,
    area: "coordination",
    status: "review_due",
    lastUsed: "Today, 8:15 AM",
    primaryAction: "Refer",
    secondary: "Access pathways, criteria, contacts",
  },
  {
    id: "forms",
    title: "Forms",
    description: "Find clinical forms and source-backed readiness pathways.",
    href: "/forms",
    icon: FileCheck2,
    area: "coordination",
    status: "ready",
    lastUsed: "Today, 8:05 AM",
    primaryAction: "Open",
    secondary: "Forms, tasks, pathway checks",
  },
  {
    id: "favourites",
    title: "Favourites",
    description: "Return to saved clinical work, sources, and repeated workflows.",
    href: "/favourites",
    icon: Star,
    area: "personal",
    status: "recent",
    lastUsed: "Today, 8:45 AM",
    primaryAction: "Resume",
    secondary: "Saved items, recent work, pins",
  },
];

const areaLabels: Record<ToolArea, string> = {
  assessment: "Assess",
  care: "Treat",
  coordination: "Coordinate",
  personal: "Resume",
  reference: "Reference",
};

const statusLabels: Record<ToolStatus, string> = {
  ready: "Ready",
  recent: "Recent",
  review_due: "Review due",
};

const statusStyles: Record<ToolStatus, string> = {
  ready: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
  recent: "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]",
  review_due: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
};

const variantCopy: Record<
  ToolsPageMockupVariant,
  {
    eyebrow: string;
    title: string;
    body: string;
    recommendedFor: string;
  }
> = {
  "command-center": {
    eyebrow: "Concept 1",
    title: "Tools command center",
    body: "Open a tool directly, resume recent work, or search by clinical task.",
    recommendedFor: "Best default direction",
  },
  "workflow-board": {
    eyebrow: "Concept 2",
    title: "Workflow board",
    body: "Choose by clinical job: assess, reference, treat, coordinate, or resume.",
    recommendedFor: "Best for discoverability",
  },
  "split-pane": {
    eyebrow: "Concept 3",
    title: "Tools directory",
    body: "A compact directory for teams that expect the tool list to grow.",
    recommendedFor: "Best for scale",
  },
};

function toolById(id: string) {
  return tools.find((tool) => tool.id === id) ?? tools[0];
}

function StatusPill({ status }: { status: ToolStatus }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center rounded-md border px-2 text-[11px] font-bold",
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function ToolIcon({ tool, quiet = false }: { tool: ToolFixture; quiet?: boolean }) {
  const Icon = tool.icon;

  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-md border shadow-[var(--shadow-inset)]",
        quiet
          ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
          : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function ShellHeader({ variant, children }: { variant: ToolsPageMockupVariant; children?: ReactNode }) {
  const copy = variantCopy[variant];

  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-extrabold text-[color:var(--clinical-accent)]">
              {copy.eyebrow}
            </span>
            <span className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 text-xs font-bold text-[color:var(--text-muted)]">
              {copy.recommendedFor}
            </span>
          </div>
          <h1 className="mt-3 text-balance text-3xl font-extrabold leading-tight tracking-normal text-[color:var(--text-heading)] sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            {copy.body}
          </p>
        </div>
        {children}
      </div>
    </header>
  );
}

function SearchControl({
  placeholder = "Search tools by clinical job, source, or workflow",
}: {
  placeholder?: string;
}) {
  return (
    <form className="grid min-h-[3.25rem] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2 shadow-[var(--shadow-tight)]">
      <Search className="ml-2 h-5 w-5 text-[color:var(--text-soft)]" aria-hidden="true" />
      <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--text-soft)]">{placeholder}</span>
      <button
        type="button"
        aria-label="Search tools"
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]",
          focusRing,
        )}
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}

function ActionButton({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)] shadow-[var(--shadow-inset)] hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)]",
        focusRing,
      )}
    >
      {Icon ? <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function ToolCard({ tool, selected = false }: { tool: ToolFixture; selected?: boolean }) {
  return (
    <Link
      href={tool.href}
      aria-label={`Open ${tool.title}`}
      className={cn(
        "block rounded-md border bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)]",
        selected
          ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent)]/25"
          : "border-[color:var(--border)]",
        focusRing,
      )}
    >
      <div className="flex items-start gap-3">
        <ToolIcon tool={tool} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2 sm:items-center">
            <h3 className="min-w-0 flex-1 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">
              {tool.title}
            </h3>
            <StatusPill status={tool.status} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
            {tool.description}
          </p>
          <p className="mt-2 truncate text-xs font-bold text-[color:var(--text-soft)]">{tool.secondary}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="nums truncate text-xs font-semibold text-[color:var(--text-muted)]">{tool.lastUsed}</span>
        <span className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
          {tool.primaryAction}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function StatsStrip() {
  const stats = [
    { label: "Tools", value: String(tools.length), icon: Grid2X2 },
    { label: "Review due", value: String(tools.filter((tool) => tool.status === "review_due").length), icon: Clock3 },
    { label: "Recent", value: String(tools.filter((tool) => tool.status === "recent").length), icon: History },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[26rem]">
      {stats.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 shadow-[var(--shadow-inset)]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
              <Icon className="h-4 w-4" aria-hidden="true" />
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

const recentWork = [
  {
    title: "13YARN referral pathway",
    area: "Services",
    status: "recent" as const,
    date: "Today, 8:15 AM",
    icon: ClipboardList,
  },
  {
    title: "Lithium monitoring guideline",
    area: "Documents",
    status: "review_due" as const,
    date: "May 12, 2025",
    icon: FileText,
  },
  {
    title: "Acute confusion comparison",
    area: "Differentials",
    status: "recent" as const,
    date: "May 10, 2025",
    icon: Brain,
  },
];

function RecentWorkList({ compact = false, title = "Recent work" }: { compact?: boolean; title?: string }) {
  return (
    <section className="overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[color:var(--border)] px-3">
        <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">{title}</h2>
        <Link href="/favourites" className={cn("text-xs font-bold text-[color:var(--clinical-accent)]", focusRing)}>
          View all
        </Link>
      </div>
      <div className="divide-y divide-[color:var(--border)]">
        {recentWork.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href="/favourites"
              className={cn(
                "grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 hover:bg-[color:var(--surface-subtle)]",
                focusRing,
              )}
            >
              <span className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">{item.title}</span>
                <span className="block truncate text-xs font-semibold text-[color:var(--text-soft)]">{item.area}</span>
              </span>
              {compact ? (
                <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              ) : (
                <span className="hidden items-center gap-3 sm:flex">
                  <StatusPill status={item.status} />
                  <span className="nums w-24 text-right text-xs font-semibold text-[color:var(--text-muted)]">
                    {item.date}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function WideToolTile({
  tool,
  selected = false,
  compact = false,
}: {
  tool: ToolFixture;
  selected?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={tool.href}
      aria-label={`Open ${tool.title}`}
      className={cn(
        "group grid min-h-[9rem] rounded-md border bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] transition hover:-translate-y-0.5 hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)] hover:shadow-[var(--shadow-soft)]",
        selected
          ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent)]/25"
          : "border-[color:var(--border)]",
        compact && "min-h-[7.75rem]",
        focusRing,
      )}
    >
      <div className="flex items-start gap-3">
        <ToolIcon tool={tool} quiet={!selected} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">
              {tool.title}
            </h3>
            <StatusPill status={tool.status} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
            {tool.description}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <p className="truncate text-xs font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
            {areaLabels[tool.area]}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-[color:var(--text-muted)]">{tool.secondary}</p>
        </div>
        <span className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
          {tool.primaryAction}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function WideAllToolsSection({
  selectedId,
  title = "All tools",
  body = "Every tool opens directly. Pick by task, status, or last-used context.",
  compact = false,
}: {
  selectedId?: string;
  title?: string;
  body?: string;
  compact?: boolean;
}) {
  return (
    <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)] sm:p-4">
      <div className="grid gap-3 border-b border-[color:var(--border)] pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
            <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">{title}</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-[color:var(--text-muted)]">{body}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={Sparkles}>Sort by next action</ActionButton>
          <ActionButton icon={ShieldCheck}>Source-backed</ActionButton>
        </div>
      </div>

      <div className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <WideToolTile key={tool.id} tool={tool} selected={tool.id === selectedId} compact={compact} />
        ))}
      </div>
    </section>
  );
}

function PhoneBrowserPreview({
  title,
  toolIds,
  mode = "launch",
}: {
  title: string;
  toolIds: string[];
  mode?: "launch" | "workflow" | "directory";
}) {
  const featured = toolIds.map(toolById);

  return (
    <aside className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)] xl:sticky xl:top-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Phone browser mode
          </p>
          <h2 className="mt-1 text-base font-extrabold text-[color:var(--text-heading)]">{title}</h2>
        </div>
        <span className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 text-xs font-bold text-[color:var(--clinical-accent)]">
          <Smartphone className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          390px
        </span>
      </div>

      <div className="mx-auto mt-4 max-w-[19rem] rounded-[2rem] border border-[color:var(--border-strong)] bg-[color:var(--surface-chrome)] p-2 shadow-[var(--shadow-lux)]">
        <div className="overflow-hidden rounded-[1.45rem] border border-[color:var(--border)] bg-[color:var(--background)]">
          <div className="flex min-h-11 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3">
            <span className="text-sm font-extrabold text-[color:var(--text-heading)]">Clinical tools</span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="space-y-3 p-3">
            <div className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2">
              <Search className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
              <span className="truncate text-xs font-bold text-[color:var(--text-soft)]">Search tools</span>
              <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
            </div>

            {mode === "workflow" ? (
              <div className="grid grid-cols-2 gap-2">
                {["Assess", "Reference", "Treat", "Coordinate"].map((label) => (
                  <span
                    key={label}
                    className="grid min-h-12 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-xs font-extrabold text-[color:var(--text-heading)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}

            <div className={cn("grid gap-2", mode === "directory" && "rounded-md border border-[color:var(--border)]")}>
              {featured.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    className={cn(
                      "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-[color:var(--surface)] px-2 text-left shadow-[var(--shadow-inset)]",
                      mode === "directory" && "rounded-none border-t border-[color:var(--border)] first:border-t-0",
                      index === 0 && mode !== "directory" && "border border-[color:var(--clinical-accent-border)]",
                      focusRing,
                    )}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-extrabold text-[color:var(--text-heading)]">
                        {tool.title}
                      </span>
                      <span className="block truncate text-[11px] font-semibold text-[color:var(--text-soft)]">
                        {areaLabels[tool.area]}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>

            <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)]">
              <div className="flex min-h-8 items-center justify-between border-b border-[color:var(--border)] px-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
                  Recents
                </span>
                <span className="text-[11px] font-bold text-[color:var(--clinical-accent)]">View</span>
              </div>
              <div className="divide-y divide-[color:var(--border)]">
                {recentWork.slice(0, 2).map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.title}
                      href="/favourites"
                      className={cn(
                        "grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2",
                        focusRing,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-extrabold text-[color:var(--text-heading)]">
                          {item.title}
                        </span>
                        <span className="block truncate text-[10px] font-semibold text-[color:var(--text-soft)]">
                          {item.area}
                        </span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                    </Link>
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

function CommandCenterMockup() {
  const selected = toolById("clinical-kb-search");
  const pinned = ["clinical-kb-search", "documents", "medication-prescribing", "services"].map(toolById);

  return (
    <>
      <ShellHeader variant="command-center">
        <StatsStrip />
      </ShellHeader>
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <section className="grid gap-3">
          <SearchControl />
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={Filter}>All tools</ActionButton>
            <ActionButton icon={Pin}>Pinned</ActionButton>
            <ActionButton icon={Clock3}>Review due</ActionButton>
            <ActionButton icon={ShieldCheck}>Source-backed</ActionButton>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Start here</h2>
                <p className="text-sm font-medium text-[color:var(--text-muted)]">
                  Most-used tools stay one click away.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {pinned.map((tool, index) => (
                <ToolCard key={tool.id} tool={tool} selected={index === 0} />
              ))}
            </div>
          </section>

          <PhoneBrowserPreview
            title="Direct launch layout"
            toolIds={[selected.id, "documents", "medication-prescribing", "services", "favourites"]}
          />
        </section>

        <WideAllToolsSection selectedId={selected.id} />

        <RecentWorkList title="Recents" />
      </main>
    </>
  );
}

function WorkflowLane({
  title,
  body,
  icon: Icon,
  toolIds,
}: {
  title: string;
  body: string;
  icon: LucideIcon;
  toolIds: string[];
}) {
  return (
    <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
      <div className="grid min-h-[6.5rem] grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] p-4">
        <span className="grid h-10 w-10 place-items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">{title}</h2>
          <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">{body}</p>
        </div>
      </div>
      <div className="grid gap-3 p-3">
        {toolIds.map((id) => (
          <ToolCard key={id} tool={toolById(id)} selected={id === "differentials"} />
        ))}
      </div>
    </section>
  );
}

function WorkflowBoardMockup() {
  return (
    <>
      <ShellHeader variant="workflow-board">
        <div className="w-full lg:w-[28rem]">
          <SearchControl placeholder="Search tools, workflows, source status" />
        </div>
      </ShellHeader>
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="grid gap-4 md:grid-cols-2">
            <WorkflowLane
              title="Assess"
              body="Start or refine a clinical view before acting."
              icon={Stethoscope}
              toolIds={["differentials", "clinical-kb-search"]}
            />
            <WorkflowLane
              title="Reference"
              body="Find the source, page, table, or answer."
              icon={BookOpen}
              toolIds={["documents", "clinical-kb-search"]}
            />
            <WorkflowLane
              title="Treat"
              body="Move from evidence to prescribing support."
              icon={HeartPulse}
              toolIds={["medication-prescribing", "documents"]}
            />
            <WorkflowLane
              title="Coordinate"
              body="Connect the next referral, service, or form."
              icon={ClipboardList}
              toolIds={["services", "forms"]}
            />
          </div>

          <aside className="space-y-4">
            <PhoneBrowserPreview
              title="Workflow picker"
              toolIds={["differentials", "clinical-kb-search", "documents", "medication-prescribing"]}
              mode="workflow"
            />

            <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]">
              <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Review queue</h2>
              <div className="mt-3 grid gap-2">
                {tools
                  .filter((tool) => tool.status === "review_due")
                  .map((tool) => {
                    const Icon = tool.icon;

                    return (
                      <Link
                        key={tool.id}
                        href={tool.href}
                        className={cn(
                          "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3",
                          focusRing,
                        )}
                      >
                        <Icon className="h-4 w-4 text-[color:var(--warning)]" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">
                            {tool.title}
                          </span>
                          <span className="block truncate text-xs font-semibold text-[color:var(--warning)]">
                            {tool.lastUsed}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-[color:var(--warning)]" aria-hidden="true" />
                      </Link>
                    );
                  })}
              </div>
            </section>

            <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]">
              <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Daily pins</h2>
              <div className="mt-3 grid gap-2">
                {["clinical-kb-search", "differentials", "favourites"].map((id) => {
                  const tool = toolById(id);
                  const Icon = tool.icon;
                  return (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      className={cn(
                        "grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3",
                        focusRing,
                      )}
                    >
                      <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                      <span className="truncate text-sm font-bold text-[color:var(--text-heading)]">{tool.title}</span>
                      <Pin className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>

        <WideAllToolsSection
          selectedId="differentials"
          title="All tools"
          body="A spacious launch surface below the workflow board, so every tool remains visible without a cramped side rail."
        />

        <RecentWorkList title="Recents" />
      </main>
    </>
  );
}

function SplitPaneMockup() {
  const selected = toolById("services");
  const navItems = [
    { label: "All", count: 7, icon: Grid2X2 },
    { label: "Clinical", count: 4, icon: Stethoscope },
    { label: "Admin", count: 3, icon: Settings2 },
    { label: "Recent", count: 3, icon: History },
    { label: "Review due", count: 2, icon: Clock3 },
  ];

  return (
    <>
      <ShellHeader variant="split-pane">
        <StatsStrip />
      </ShellHeader>
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
            <aside className="space-y-4">
              <SearchControl placeholder="Search tools" />
              <nav
                aria-label="Tool filters"
                className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-2 shadow-[var(--shadow-inset)]"
              >
                {navItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      aria-pressed={index === 0}
                      className={cn(
                        "grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2.5 text-left text-sm font-bold",
                        index === 0
                          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                          : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                        focusRing,
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                      <span className="nums text-xs">{item.count}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="grid content-start gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Launcher overview</h2>
              </div>
              <p className="max-w-2xl text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                Filters sit beside the overview, while the full-width All tools view below carries the main browsing
                weight.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {["clinical-kb-search", selected.id, "medication-prescribing", "favourites"].map((id) => (
                  <ToolCard key={id} tool={toolById(id)} selected={id === selected.id} />
                ))}
              </div>
            </section>
          </div>

          <PhoneBrowserPreview
            title="Pocket directory"
            toolIds={["clinical-kb-search", "documents", "differentials", selected.id, "forms", "favourites"]}
            mode="directory"
          />
        </section>

        <WideAllToolsSection
          selectedId={selected.id}
          title="All tools"
          body="The directory is intentionally wide here: spacious cards, direct actions, and clear task grouping across the page."
          compact
        />

        <RecentWorkList title="Recents" />
      </main>
    </>
  );
}

export function ToolsPageMockupPage({ variant }: { variant: ToolsPageMockupVariant }) {
  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {variant === "command-center" ? <CommandCenterMockup /> : null}
      {variant === "workflow-board" ? <WorkflowBoardMockup /> : null}
      {variant === "split-pane" ? <SplitPaneMockup /> : null}
    </div>
  );
}
