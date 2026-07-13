"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ClipboardList,
  Clock3,
  FileText,
  Grid2X2,
  HeartPulse,
  History,
  LayoutDashboard,
  Pin,
  Search,
  SearchX,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Stethoscope,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

import {
  areaLabels,
  pinnedToolIds,
  statusLabels,
  statusStyles,
  toolById,
  tools,
  type ToolFixture,
  type ToolStatus,
} from "./tool-fixtures";
import { useToolFilter, type ToolFilterId } from "./use-tool-filter";

export type ToolsPageMockupVariant = "command-center" | "workflow-board" | "split-pane";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const DEFAULT_SEARCH_PLACEHOLDER = "Search tools by name, task, or source";

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

function StatusPill({ status }: { status: ToolStatus }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 w-fit shrink-0 items-center rounded-md border px-2 text-2xs font-bold",
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function SuggestedBadge() {
  return (
    <span className="inline-flex min-h-6 w-fit shrink-0 items-center gap-1 rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 text-2xs font-bold text-[color:var(--clinical-accent)]">
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      Suggested
    </span>
  );
}

function SourceBackedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex min-h-6 w-fit shrink-0 items-center gap-1 rounded-md border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-2 text-2xs font-bold text-[color:var(--success)]">
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      {compact ? "Source" : "Source-backed"}
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

function AccentIconTile({
  icon: Icon,
  className,
  iconClassName = "h-4 w-4",
}: {
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "grid place-items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
        className,
      )}
    >
      <Icon className={iconClassName} aria-hidden="true" />
    </span>
  );
}

function PrimaryActionChip({ label, arrowClassName = "h-4 w-4" }: { label: string; arrowClassName?: string }) {
  return (
    <span className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
      {label}
      <ArrowRight className={arrowClassName} aria-hidden="true" />
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
  value,
  onChange,
  onClear,
  placeholder = DEFAULT_SEARCH_PLACEHOLDER,
  label = "Search tools",
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="grid min-h-[3.25rem] min-w-0 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2 shadow-[var(--shadow-tight)] focus-within:border-[color:var(--clinical-accent-border)]"
    >
      <Search className="ml-2 h-5 w-5 text-[color:var(--text-soft)]" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 bg-transparent text-sm font-semibold text-[color:var(--text)] placeholder:font-semibold placeholder:text-[color:var(--text-soft)] focus:outline-none"
      />
      <div className="flex items-center gap-1">
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={onClear}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-soft)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
              focusRing,
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="submit"
          aria-label={label}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]",
            focusRing,
          )}
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

function FilterChip({
  label,
  icon: Icon,
  count,
  pressed,
  onClick,
}: {
  label: string;
  icon?: LucideIcon;
  count?: number;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold shadow-[var(--shadow-inset)]",
        pressed
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)]",
        focusRing,
      )}
    >
      {Icon ? <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" /> : null}
      {label}
      {typeof count === "number" ? (
        <span className="nums text-xs font-semibold text-[color:var(--text-muted)]">{count}</span>
      ) : null}
    </button>
  );
}

function ToolCard({ tool, suggested = false }: { tool: ToolFixture; suggested?: boolean }) {
  return (
    <Link
      href={tool.href}
      aria-label={`Open ${tool.title}${suggested ? " (suggested)" : ""}`}
      className={cn(
        "flex min-w-0 max-w-full flex-col rounded-md border bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)]",
        suggested
          ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent)]/25"
          : "border-[color:var(--border)]",
        focusRing,
      )}
    >
      <div className="flex flex-1 items-start gap-3">
        <ToolIcon tool={tool} />
        <div className="min-w-0 flex-1">
          <div className="grid gap-2">
            <h3 className="text-base font-extrabold leading-6 text-[color:var(--text-heading)]">{tool.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {suggested ? <SuggestedBadge /> : null}
              <StatusPill status={tool.status} />
              {tool.sourceBacked ? <SourceBackedBadge compact /> : null}
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
            {tool.description}
          </p>
          <p className="mt-2 truncate text-xs font-bold text-[color:var(--text-soft)]">{tool.secondary}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="nums truncate text-xs font-semibold text-[color:var(--text-muted)]">{tool.lastUsed}</span>
        <PrimaryActionChip label={tool.primaryAction} />
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
            <AccentIconTile icon={Icon} className="h-9 w-9" />
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
        <Link
          href="/favourites"
          className={cn(
            "inline-flex min-h-10 items-center rounded-md px-1 text-xs font-bold text-[color:var(--clinical-accent)]",
            focusRing,
          )}
        >
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
              <AccentIconTile icon={Icon} className="h-8 w-8" />
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
  suggested = false,
  compact = false,
  selected = false,
  onSelect,
}: {
  tool: ToolFixture;
  suggested?: boolean;
  compact?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const className = cn(
    "group grid min-h-[9rem] min-w-0 max-w-full content-between rounded-md border bg-[color:var(--surface)] p-4 text-left shadow-[var(--shadow-inset)] transition hover:-translate-y-0.5 hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)] hover:shadow-[var(--shadow-soft)]",
    selected || suggested
      ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent)]/25"
      : "border-[color:var(--border)]",
    compact && "min-h-[7.75rem]",
    focusRing,
  );

  const content = (
    <>
      <div className="flex items-start gap-3">
        <ToolIcon tool={tool} quiet={!suggested && !selected} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">
              {tool.title}
            </h3>
            {suggested ? <SuggestedBadge /> : null}
            <StatusPill status={tool.status} />
            {tool.sourceBacked ? <SourceBackedBadge compact /> : null}
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
        <PrimaryActionChip
          label={onSelect ? "Preview" : tool.primaryAction}
          arrowClassName="h-4 w-4 transition group-hover:translate-x-0.5"
        />
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button type="button" aria-pressed={selected} onClick={onSelect} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={tool.href} aria-label={`Open ${tool.title}${suggested ? " (suggested)" : ""}`} className={className}>
      {content}
    </Link>
  );
}

function AllToolsEmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="mt-4 grid place-items-center gap-3 rounded-md border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] px-6 py-10 text-center">
      <AccentIconTile icon={SearchX} className="h-11 w-11" iconClassName="h-5 w-5" />
      <div className="grid gap-1">
        <p className="text-sm font-extrabold text-[color:var(--text-heading)]">
          {query.trim() ? `No tools match “${query.trim()}”` : "No tools match this filter"}
        </p>
        <p className="max-w-sm text-sm font-medium leading-5 text-[color:var(--text-muted)]">
          Try a different term or clear the filters to see every tool again.
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-sm font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]",
          focusRing,
        )}
      >
        Clear filters
      </button>
    </div>
  );
}

function WideAllToolsSection({
  visibleTools,
  totalCount,
  query,
  onClearFilters,
  suggestedId,
  title = "All tools",
  body = "Every tool opens directly. Pick by task, status, or last-used context.",
  compact = false,
  selectedToolId,
  onSelectTool,
}: {
  visibleTools: ToolFixture[];
  totalCount: number;
  query: string;
  onClearFilters: () => void;
  suggestedId?: string;
  title?: string;
  body?: string;
  compact?: boolean;
  selectedToolId?: string;
  onSelectTool?: (tool: ToolFixture) => void;
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
        <p
          aria-live="polite"
          className="nums inline-flex min-h-8 items-center self-start rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 text-xs font-bold text-[color:var(--text-muted)] lg:self-auto"
        >
          Showing {visibleTools.length} of {totalCount}
        </p>
      </div>

      {visibleTools.length > 0 ? (
        <div className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleTools.map((tool) => (
            <WideToolTile
              key={tool.id}
              tool={tool}
              suggested={tool.id === suggestedId}
              compact={compact}
              selected={selectedToolId === tool.id}
              onSelect={onSelectTool ? () => onSelectTool(tool) : undefined}
            />
          ))}
        </div>
      ) : (
        <AllToolsEmptyState query={query} onClear={onClearFilters} />
      )}
    </section>
  );
}

function PhoneBrowserPreview({
  title,
  toolIds,
  mode = "launch",
  selectedTool,
  onSelectTool,
  onBackToDirectory,
}: {
  title: string;
  toolIds: string[];
  mode?: "launch" | "workflow" | "directory";
  selectedTool?: ToolFixture;
  onSelectTool?: (tool: ToolFixture) => void;
  onBackToDirectory?: () => void;
}) {
  const featured = toolIds.map(toolById);
  const SelectedIcon = selectedTool?.icon;

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
            {selectedTool && SelectedIcon ? (
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={onBackToDirectory}
                  className={cn(
                    "inline-flex min-h-9 w-fit items-center gap-1 rounded-md px-1 text-xs font-bold text-[color:var(--clinical-accent)]",
                    focusRing,
                  )}
                >
                  <ArrowRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
                  All tools
                </button>

                <section className="rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
                  <AccentIconTile icon={SelectedIcon} className="h-10 w-10" />
                  <h3 className="mt-3 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">
                    {selectedTool.title}
                  </h3>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
                    {selectedTool.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill status={selectedTool.status} />
                    {selectedTool.sourceBacked ? <SourceBackedBadge compact /> : null}
                  </div>
                  <dl className="mt-3 grid gap-2 border-t border-[color:var(--border)] pt-3">
                    <div>
                      <dt className="text-3xs font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
                        Best for
                      </dt>
                      <dd className="mt-0.5 text-xs font-bold leading-4 text-[color:var(--text-heading)]">
                        {selectedTool.secondary}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-3xs font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
                        Last used
                      </dt>
                      <dd className="mt-0.5 text-xs font-bold text-[color:var(--text-heading)]">
                        {selectedTool.lastUsed}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    href={selectedTool.href}
                    className={cn(
                      "mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]",
                      focusRing,
                    )}
                  >
                    Open {selectedTool.primaryAction.toLowerCase()}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </section>

                <RecentWorkList compact title="Related work" />
              </div>
            ) : null}

            {!selectedTool ? (
              <>
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

                <div
                  className={cn("grid gap-2", mode === "directory" && "rounded-md border border-[color:var(--border)]")}
                >
                  {featured.map((tool, index) => {
                    const Icon = tool.icon;
                    const interactive = typeof onSelectTool === "function";
                    const rowClassName = cn(
                      "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-[color:var(--surface)] px-2 text-left shadow-[var(--shadow-inset)]",
                      mode === "directory" && "rounded-none border-t border-[color:var(--border)] first:border-t-0",
                      index === 0 && mode !== "directory" && "border border-[color:var(--clinical-accent-border)]",
                      focusRing,
                    );
                    const rowContent = (
                      <>
                        <AccentIconTile icon={Icon} className="h-8 w-8" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-extrabold text-[color:var(--text-heading)]">
                            {tool.title}
                          </span>
                          <span className="block truncate text-2xs font-semibold text-[color:var(--text-soft)]">
                            {areaLabels[tool.area]}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          {tool.sourceBacked ? (
                            <ShieldCheck
                              className="h-3.5 w-3.5 text-[color:var(--success)]"
                              aria-label="Source-backed"
                            />
                          ) : null}
                          <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                        </span>
                      </>
                    );

                    if (interactive) {
                      return (
                        <button key={tool.id} type="button" onClick={() => onSelectTool(tool)} className={rowClassName}>
                          {rowContent}
                        </button>
                      );
                    }

                    return (
                      <Link key={tool.id} href={tool.href} className={rowClassName}>
                        {rowContent}
                      </Link>
                    );
                  })}
                </div>

                <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)]">
                  <div className="flex min-h-8 items-center justify-between border-b border-[color:var(--border)] px-2">
                    <span className="text-2xs font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
                      Recent work
                    </span>
                    <span className="text-2xs font-bold text-[color:var(--clinical-accent)]">View</span>
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
                            <span className="block truncate text-2xs font-extrabold text-[color:var(--text-heading)]">
                              {item.title}
                            </span>
                            <span className="block truncate text-3xs font-semibold text-[color:var(--text-soft)]">
                              {item.area}
                            </span>
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

const commandCenterFilters: { id: ToolFilterId; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All tools", icon: Grid2X2 },
  { id: "pinned", label: "Pinned", icon: Pin },
  { id: "review_due", label: "Review due", icon: Clock3 },
  { id: "source_backed", label: "Source-backed", icon: ShieldCheck },
];

function CommandCenterMockup() {
  const filter = useToolFilter(tools);
  const suggestedId = "clinical-kb-search";
  const pinned = pinnedToolIds.map(toolById);

  return (
    <>
      <ShellHeader variant="command-center">
        <StatsStrip />
      </ShellHeader>
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <section className="grid gap-3">
          <SearchControl value={filter.query} onChange={filter.setQuery} onClear={() => filter.setQuery("")} />
          <div className="flex flex-wrap gap-2">
            {commandCenterFilters.map((chip) => (
              <FilterChip
                key={chip.id}
                label={chip.label}
                icon={chip.icon}
                count={filter.counts[chip.id]}
                pressed={filter.filterId === chip.id}
                onClick={() => filter.toggleFilter(chip.id)}
              />
            ))}
          </div>
        </section>

        {!filter.isFiltering && (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <section className="grid content-start gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Start here</h2>
                  <p className="text-sm font-medium text-[color:var(--text-muted)]">
                    Most-used tools stay one click away.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                {pinned.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} suggested={tool.id === suggestedId} />
                ))}
              </div>
            </section>

            <PhoneBrowserPreview
              title="Direct launch layout"
              toolIds={[suggestedId, "documents", "medication-prescribing", "services", "favourites"]}
            />
          </section>
        )}

        <WideAllToolsSection
          visibleTools={filter.filtered}
          totalCount={tools.length}
          query={filter.query}
          onClearFilters={filter.reset}
          suggestedId={suggestedId}
        />

        {!filter.isFiltering && <RecentWorkList />}
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
    <section className="min-w-0 overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
      <div className="grid min-h-[6.5rem] grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] p-4">
        <AccentIconTile icon={Icon} className="h-10 w-10" iconClassName="h-5 w-5" />
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">{title}</h2>
          <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">{body}</p>
        </div>
      </div>
      <div className="grid gap-3 p-3">
        {toolIds.map((id) => (
          <ToolCard key={id} tool={toolById(id)} suggested={id === "differentials"} />
        ))}
      </div>
    </section>
  );
}

function WorkflowBoardMockup() {
  const filter = useToolFilter(tools);

  return (
    <>
      <ShellHeader variant="workflow-board">
        <div className="w-full lg:w-[28rem]">
          <SearchControl
            value={filter.query}
            onChange={filter.setQuery}
            onClear={() => filter.setQuery("")}
            placeholder="Search tools, workflows, or source status"
          />
        </div>
      </ShellHeader>
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        {!filter.isFiltering && (
          <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
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
              <WorkflowLane
                title="Resume"
                body="Return to saved work, pins, and recent sources."
                icon={Star}
                toolIds={["favourites"]}
              />
            </div>

            <aside className="min-w-0 space-y-4">
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
                        <span className="truncate text-sm font-bold text-[color:var(--text-heading)]">
                          {tool.title}
                        </span>
                        <Pin className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            </aside>
          </section>
        )}

        <WideAllToolsSection
          visibleTools={filter.filtered}
          totalCount={tools.length}
          query={filter.query}
          onClearFilters={filter.reset}
          suggestedId="differentials"
          title="All tools"
          body="A spacious launch surface below the workflow board, so every tool remains visible without a cramped side rail."
        />

        {!filter.isFiltering && <RecentWorkList />}
      </main>
    </>
  );
}

const splitPaneFilters: { id: ToolFilterId; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All tools", icon: Grid2X2 },
  { id: "pinned", label: "Pinned", icon: Pin },
  { id: "review_due", label: "Review due", icon: Clock3 },
  { id: "source_backed", label: "Source-backed", icon: ShieldCheck },
  { id: "recent", label: "Recent", icon: History },
];

function SplitPaneMockup() {
  const filter = useToolFilter(tools);
  const suggestedId = "services";
  const [selectedToolId, setSelectedToolId] = useState(suggestedId);
  const selectedTool = selectedToolId ? toolById(selectedToolId) : undefined;

  return (
    <>
      <ShellHeader variant="split-pane">
        <StatsStrip />
      </ShellHeader>
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
            <aside className="min-w-0 space-y-4">
              <SearchControl
                value={filter.query}
                onChange={filter.setQuery}
                onClear={filter.reset}
                placeholder="Search tools"
              />
              <nav
                aria-label="Tool filters"
                className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-2 shadow-[var(--shadow-inset)]"
              >
                {splitPaneFilters.map((item) => {
                  const Icon = item.icon;
                  const pressed = filter.filterId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => filter.toggleFilter(item.id)}
                      className={cn(
                        "grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2.5 text-left text-sm font-bold",
                        pressed
                          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                          : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                        focusRing,
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                      <span className="nums text-xs">{filter.counts[item.id]}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="grid min-w-0 content-start gap-3 overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]">
              {filter.isFiltering ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                      <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Results</h2>
                    </div>
                    <p
                      aria-live="polite"
                      className="nums inline-flex min-h-8 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 text-xs font-bold text-[color:var(--text-muted)]"
                    >
                      Showing {filter.filtered.length} of {tools.length}
                    </p>
                  </div>
                  {filter.filtered.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {filter.filtered.map((tool) => (
                        <WideToolTile
                          key={tool.id}
                          tool={tool}
                          suggested={tool.id === suggestedId}
                          compact
                          selected={selectedToolId === tool.id}
                          onSelect={() => setSelectedToolId(tool.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <AllToolsEmptyState query={filter.query} onClear={filter.reset} />
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                    <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Launcher overview</h2>
                  </div>
                  <p className="max-w-2xl text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                    Filters sit beside the overview, while the full-width All tools view below carries the main browsing
                    weight.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {["clinical-kb-search", suggestedId, "medication-prescribing", "favourites"].map((id) => (
                      <ToolCard key={id} tool={toolById(id)} suggested={id === suggestedId} />
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>

          <PhoneBrowserPreview
            title="Pocket directory"
            toolIds={["clinical-kb-search", "documents", "differentials", suggestedId, "forms", "favourites"]}
            mode="directory"
            selectedTool={selectedTool}
            onSelectTool={(tool) => setSelectedToolId(tool.id)}
            onBackToDirectory={() => setSelectedToolId("")}
          />
        </section>

        {!filter.isFiltering && (
          <WideAllToolsSection
            visibleTools={filter.filtered}
            totalCount={tools.length}
            query={filter.query}
            onClearFilters={filter.reset}
            suggestedId={suggestedId}
            title="All tools"
            body="Click any tool to preview it in the phone frame, then open the actual tool from the phone action."
            compact
            selectedToolId={selectedToolId}
            onSelectTool={(tool) => setSelectedToolId(tool.id)}
          />
        )}

        {!filter.isFiltering && <RecentWorkList />}
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
