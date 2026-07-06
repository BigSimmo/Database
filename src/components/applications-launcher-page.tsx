"use client";

import Link from "next/link";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  FileText,
  Grid2X2,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { cn } from "@/components/ui-primitives";
import {
  toolCatalogRecords,
  type ToolCatalogArea,
  type ToolCatalogRecord,
  type ToolCatalogStatus,
} from "@/lib/tools-catalog";

type LauncherStatus = ToolCatalogStatus;
type LauncherArea = ToolCatalogArea;
type LauncherFilter = "all" | LauncherArea | "more";

type LauncherApp = ToolCatalogRecord & { icon: LucideIcon };

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const areaLabels: Record<LauncherArea, string> = {
  assessment: "Assess",
  reference: "Evidence",
  care: "Treat",
  coordination: "Coordinate",
  saved: "Saved",
};

const statusLabels: Record<LauncherStatus, string> = {
  ready: "Ready",
  recent: "Recent",
  review_due: "Review due",
};

const iconToneClasses: Record<LauncherArea | "safety" | "medication" | "differentials", string> = {
  assessment: "border-cyan-200 bg-cyan-50 text-cyan-700",
  reference: "border-emerald-200 bg-emerald-50 text-emerald-700",
  care: "border-sky-200 bg-sky-50 text-sky-700",
  coordination:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  saved: "border-blue-200 bg-blue-50 text-blue-700",
  safety: "border-red-200 bg-red-50 text-red-600",
  medication: "border-amber-200 bg-amber-50 text-amber-600",
  differentials: "border-violet-200 bg-violet-50 text-violet-700",
};

// Presentation-only mapping: the shared tools catalog is icon-free so it can be used by
// server code (universal search); icons are attached at the UI boundary.
const launcherIconById: Record<string, LucideIcon> = {
  "clinical-kb-search": Search,
  differentials: Brain,
  documents: FileText,
  guidelines: ShieldCheck,
  "risk-safety": ShieldCheck,
  "medication-prescribing": Pill,
  services: Users,
  forms: FileCheck2,
  "care-plans": ClipboardCheck,
  monitoring: Waves,
  favourites: Star,
};

const launcherApps: LauncherApp[] = toolCatalogRecords.map((record) => ({
  ...record,
  icon: launcherIconById[record.id] ?? Sparkles,
}));

const toolsLauncherCopy = {
  heading: "Tools",
  description:
    "Open the clinical tools and connected workflows you use for assessment, prescribing, documents, and saved work.",
  allSectionLabel: "All tools",
  countNoun: "tools",
  emptyTitle: "No tools match",
  emptyBody: "Clear the search or try another clinical workflow, tool name, or category.",
  searchAriaLabel: "Search tools",
  searchPlaceholder: "Search tools...",
  openSelectedAriaLabel: "Open selected tool",
};

const quickActions = [
  { label: "Ask", desktopLabel: "Ask evidence", icon: Search, id: "clinical-kb-search" },
  { label: "Compare", desktopLabel: "Compare", icon: Brain, id: "differentials" },
  { label: "Prescribe", desktopLabel: "Prescribe", icon: Pill, id: "medication-prescribing" },
  { label: "Safety", desktopLabel: "Safety check", icon: ShieldCheck, id: "risk-safety" },
  { label: "Docs", desktopLabel: "Documents", icon: FileText, id: "documents" },
  { label: "Refer", desktopLabel: "Refer", icon: Users, id: "services" },
  { label: "Forms", desktopLabel: "Forms", icon: FileCheck2, id: "forms" },
  { label: "More", desktopLabel: "More", icon: Sparkles, id: "favourites" },
] as const;

const desktopFilters: Array<{ id: LauncherFilter; label: string }> = [
  { id: "all", label: "All tools" },
  { id: "assessment", label: "Assess" },
  { id: "reference", label: "Evidence" },
  { id: "care", label: "Treat" },
  { id: "coordination", label: "Coordinate" },
  { id: "saved", label: "Saved" },
];

const mobileFilters: Array<{ id: LauncherFilter; label: string; hasMenu?: boolean }> = [
  { id: "all", label: "All tools" },
  { id: "assessment", label: "Assess" },
  { id: "reference", label: "Evidence" },
  { id: "care", label: "Treat" },
  { id: "more", label: "More", hasMenu: true },
];

export const applicationsLauncherItemCount = launcherApps.length;

function appById(id: string) {
  return launcherApps.find((app) => app.id === id) ?? launcherApps[0];
}

function initialToolId(query: string | undefined) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return "risk-safety";
  return (
    launcherApps.find((app) =>
      [app.title, app.mobileTitle, app.description, app.bestFor, app.detail, app.area, ...app.keywords]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    )?.id ?? "risk-safety"
  );
}

function appIconTone(app: LauncherApp) {
  if (app.id === "risk-safety") return iconToneClasses.safety;
  if (app.id === "medication-prescribing") return iconToneClasses.medication;
  if (app.id === "differentials" || app.id === "forms") return iconToneClasses.differentials;
  return iconToneClasses[app.area];
}

function ToolIcon({ app, size = "md" }: { app: LauncherApp; size?: "sm" | "md" | "lg" }) {
  const Icon = app.icon;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
        appIconTone(app),
        size === "sm" && "h-9 w-9",
        size === "md" && "h-12 w-12",
        size === "lg" && "h-14 w-14",
      )}
    >
      <Icon className={cn(size === "sm" ? "h-4.5 w-4.5" : size === "md" ? "h-6 w-6" : "h-7 w-7")} aria-hidden />
    </span>
  );
}

function StatusChip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "source" | "safety" | "high" }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-bold leading-none",
        tone === "source" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "safety" && "border-orange-200 bg-orange-50 text-orange-700",
        tone === "high" && "border-blue-200 bg-blue-50 text-blue-700",
        tone === "neutral" &&
          "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
      )}
    >
      {tone === "source" ? <ShieldCheck className="h-3 w-3" aria-hidden /> : null}
      {tone === "safety" ? <Sparkles className="h-3 w-3" aria-hidden /> : null}
      {label}
    </span>
  );
}

function ToolSearch({
  value,
  onChange,
  onSubmit,
  copy,
  className,
}: {
  value: string;
  onChange: (query: string) => void;
  onSubmit: () => void;
  copy: typeof toolsLauncherCopy;
  className?: string;
}) {
  return (
    <form
      role="search"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
      className={cn(
        "grid min-h-13 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-lux)] text-left shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--clinical-accent)]">
        <Plus className="h-4.5 w-4.5" aria-hidden />
      </span>
      <label className="min-w-0">
        <span className="sr-only">{copy.searchAriaLabel}</span>
        <input
          data-testid="tools-local-search-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="w-full min-w-0 bg-transparent text-sm font-medium text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none"
        />
      </label>
      <button
        type="submit"
        aria-label={copy.openSelectedAriaLabel}
        className={cn(
          "mr-1 grid h-10 w-10 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--clinical-accent-hover)]",
          focusRing,
        )}
      >
        <Search className="h-4.5 w-4.5" aria-hidden />
      </button>
    </form>
  );
}

function ToolChips({ app, includeStatus = false }: { app: LauncherApp; includeStatus?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {includeStatus ? <StatusChip label={statusLabels[app.status]} /> : null}
      {app.sourceBacked ? <StatusChip label="Source-backed" tone="source" /> : <StatusChip label="Private" />}
      {app.safetyFirst ? (
        <StatusChip label="Safety-first" tone="safety" />
      ) : app.highYield ? (
        <StatusChip label="High yield" tone="high" />
      ) : null}
    </span>
  );
}

function QuickActions({ onSelect, mobile }: { onSelect: (id: string) => void; mobile?: boolean }) {
  return (
    <section
      aria-label="Quick tool shortcuts"
      className={cn(mobile ? "grid grid-cols-4 gap-2" : "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6")}
    >
      {quickActions.slice(0, mobile ? 8 : 6).map((action) => {
        const app = appById(action.id);
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            aria-label={`Open ${action.desktopLabel}`}
            data-testid={`tool-shortcut-${action.id}`}
            onClick={() => onSelect(action.id)}
            className={cn(
              "group border border-[color:var(--border)] bg-[color:var(--surface-lux)] text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)]",
              focusRing,
              mobile
                ? "grid h-14 min-w-0 place-items-center gap-0.5 rounded-lg px-1 py-1.5 text-center"
                : "grid min-h-14 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 rounded-lg px-3 py-2.5",
            )}
          >
            <span
              className={cn(
                "grid place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
                appIconTone(app),
                mobile ? "h-7 w-7" : "h-9 w-9",
              )}
            >
              <Icon className={mobile ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate font-bold leading-tight text-[color:var(--text-heading)]",
                  mobile ? "text-[10px]" : "text-sm",
                )}
              >
                {mobile ? action.label : action.desktopLabel}
              </span>
              {!mobile ? (
                <span className="mt-0.5 block truncate text-xs font-medium text-[color:var(--text-muted)]">
                  {app.bestFor}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </section>
  );
}

function FilterTabs({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: LauncherFilter;
  onFilterChange: (filter: LauncherFilter) => void;
}) {
  return (
    <>
      <div className="hidden flex-wrap items-center gap-2 sm:flex" role="tablist" aria-label="Tool category">
        {desktopFilters.map((filter) => {
          const active = filter.id === activeFilter || (filter.id === "all" && activeFilter === "more");
          return (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                "inline-flex min-h-9 items-center justify-center rounded-lg border px-4 text-xs font-bold transition",
                active
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)]",
                focusRing,
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
      <div className="flex min-w-0 gap-1 overflow-x-auto pb-1 sm:hidden" role="tablist" aria-label="Tool category">
        {mobileFilters.map((filter) => {
          const active = filter.id === activeFilter || (filter.id === "all" && activeFilter === "saved");
          return (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                "inline-flex min-h-7 shrink-0 items-center justify-center gap-0.5 rounded-lg border px-2 text-[9px] font-bold transition",
                active
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)]",
                focusRing,
              )}
            >
              {filter.label}
              {filter.hasMenu ? <ChevronDown className="h-3 w-3" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ToolCard({
  app,
  selected,
  onSelect,
}: {
  app: LauncherApp;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const externalProps = app.external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <a
      href={app.href}
      aria-label={`Launch ${app.title}`}
      data-testid={`application-card-${app.id}`}
      onClick={(event) => {
        event.preventDefault();
        onSelect(app.id);
      }}
      className={cn(
        "group grid min-h-[9.25rem] grid-cols-[auto_minmax(0,1fr)_auto] gap-4 rounded-lg border bg-[color:var(--surface-lux)] p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-soft)] motion-reduce:hover:translate-y-0",
        selected
          ? app.id === "risk-safety"
            ? "border-red-200 bg-red-50/45"
            : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/50"
          : "border-[color:var(--border)]",
        focusRing,
      )}
      {...externalProps}
    >
      <ToolIcon app={app} size="lg" />
      <span className="min-w-0">
        <span className="block text-base font-extrabold leading-5 text-[color:var(--text-heading)]">{app.title}</span>
        <span className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
          {app.description}
        </span>
        <span className="mt-3 block text-xs font-bold text-[color:var(--text-heading)]">
          Best for: <span className="font-medium text-[color:var(--text-muted)]">{app.bestFor}</span>
        </span>
        <span className="mt-3 block">
          <ToolChips app={app} />
        </span>
      </span>
      <span className="self-end rounded-lg bg-[color:var(--clinical-accent)] px-3 py-2 text-xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
        {app.actionLabel}
        <ChevronRight className="ml-1 inline h-3.5 w-3.5" aria-hidden />
      </span>
    </a>
  );
}

function MobileToolRow({
  app,
  selected,
  onSelect,
}: {
  app: LauncherApp;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <a
      href={app.href}
      aria-label={`Launch ${app.title}`}
      data-testid={`application-row-${app.id}`}
      onClick={(event) => {
        event.preventDefault();
        onSelect(app.id);
      }}
      className={cn(
        "grid min-h-[5.25rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-[color:var(--surface-lux)] px-3 py-3 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)]",
        selected
          ? app.id === "risk-safety"
            ? "border-red-200 bg-red-50/45"
            : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/55"
          : "border-[color:var(--border)]",
        focusRing,
      )}
    >
      <ToolIcon app={app} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold text-[color:var(--text-heading)]">{app.title}</span>
        <span className="mt-1 line-clamp-2 text-xs font-medium leading-4 text-[color:var(--text-muted)]">
          {app.description}
        </span>
      </span>
      <span className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[color:var(--clinical-accent)] px-3 text-[11px] font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
        {app.actionLabel}
        <ChevronRight className="ml-1 h-3 w-3" aria-hidden />
      </span>
    </a>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-extrabold text-[color:var(--text-heading)]">
        <Icon className="h-4.5 w-4.5 text-[color:var(--clinical-accent)]" aria-hidden />
        {title}
      </div>
      <div className={cn("mt-2 text-sm leading-6 text-[color:var(--text-muted)]", compact && "text-xs leading-5")}>
        {children}
      </div>
    </section>
  );
}

function DetailRows({ app }: { app: LauncherApp }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailSection icon={Search} title="Best for">
        <p>{app.detail}</p>
      </DetailSection>
      <DetailSection icon={ShieldCheck} title="Check first">
        <ul className="list-disc space-y-1 pl-4">
          {app.checkFirst.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </DetailSection>
      <DetailSection icon={ClipboardList} title="Needed input">
        <ul className="list-disc space-y-1 pl-4">
          {app.neededInput.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </DetailSection>
      <DetailSection icon={Waves} title="Output">
        <p>{app.output}</p>
      </DetailSection>
    </div>
  );
}

function DetailDialog({ app, open, onClose }: { app: LauncherApp; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/15 px-0 pt-8 backdrop-blur-[1px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="selected-application-sheet-heading"
        className="flex max-h-[76dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-[color:var(--text)] shadow-[var(--shadow-elevated)] sm:max-h-[calc(100dvh-4rem)] sm:w-[39rem] sm:rounded-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-[color:var(--border-strong)] sm:hidden" />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4 sm:p-6">
          <div className="grid gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <ToolIcon app={app} size="md" />
                <div className="min-w-0">
                  <h2
                    id="selected-application-sheet-heading"
                    className="text-xl font-extrabold leading-7 text-[color:var(--text-heading)] sm:text-2xl"
                  >
                    {app.title}
                  </h2>
                  <div className="mt-2">
                    <ToolChips app={app} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${app.title}`}
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)]",
                  focusRing,
                )}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="sm:hidden">
              <DetailSection icon={Search} title="Best for" compact>
                <p>{app.detail}</p>
              </DetailSection>
              <div className="mt-3 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
                {[
                  { icon: ShieldCheck, label: "Check first" },
                  { icon: ClipboardList, label: "Needed input" },
                  { icon: Waves, label: "Output" },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    type="button"
                    className="grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[color:var(--border)] px-3 text-left first:border-t-0"
                  >
                    <Icon className="h-4.5 w-4.5 text-[color:var(--clinical-accent)]" aria-hidden />
                    <span className="text-sm font-extrabold text-[color:var(--text-heading)]">{label}</span>
                    <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden sm:block">
              <DetailRows app={app} />
            </div>
          </div>
        </div>
        <div className="grid shrink-0 gap-3 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-5">
          <Link
            href={app.href}
            target={app.external ? "_blank" : undefined}
            rel={app.external ? "noopener noreferrer" : undefined}
            className={cn(
              "inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-[color:var(--clinical-accent)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--clinical-accent-hover)]",
              focusRing,
            )}
          >
            {app.id === "risk-safety"
              ? "Open safety check"
              : app.actionLabel === "Ask"
                ? "Ask a question"
                : `${app.actionLabel} ${app.mobileTitle ?? app.title}`.trim()}
            {app.external ? (
              <ExternalLink className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden />
            )}
          </Link>
          <Link
            href={app.href}
            className="inline-flex min-h-9 items-center justify-center gap-2 text-sm font-bold text-[color:var(--clinical-accent)]"
          >
            View example
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}

type ApplicationsLauncherWorkspaceProps = {
  query?: string;
  desktopComposerSlotId?: string;
  className?: string;
};

export function ApplicationsLauncherWorkspace({
  query: controlledQuery,
  desktopComposerSlotId,
  className,
}: ApplicationsLauncherWorkspaceProps) {
  const [localQuery, setLocalQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<LauncherFilter>("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const copy = toolsLauncherCopy;
  const query = controlledQuery ?? localQuery;
  const normalizedQuery = query.trim().toLowerCase();
  const queryDerivedId = useMemo(() => initialToolId(query), [query]);
  const [selection, setSelection] = useState(() => ({
    queryKey: (controlledQuery ?? "").trim().toLowerCase(),
    id: initialToolId(controlledQuery),
  }));
  const selectedId = detailOpen || selection.queryKey === normalizedQuery ? selection.id : queryDerivedId;

  const filteredApps = useMemo(() => {
    return launcherApps.filter((app) => {
      const matchesFilter =
        activeFilter === "all" ||
        activeFilter === "more" ||
        (activeFilter === "saved" ? app.area === "saved" : app.area === activeFilter);
      const matchesQuery =
        !normalizedQuery ||
        [app.title, app.mobileTitle, app.description, app.bestFor, app.detail, areaLabels[app.area], ...app.keywords]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, normalizedQuery]);

  const effectiveSelectedId = filteredApps.some((app) => app.id === selectedId)
    ? selectedId
    : (filteredApps[0]?.id ?? selectedId);
  const selectedApp = appById(effectiveSelectedId);

  function updateQuery(nextQuery: string) {
    if (controlledQuery === undefined) setLocalQuery(nextQuery);
  }

  function openTool(id: string) {
    setSelection({ queryKey: normalizedQuery, id });
    setDetailOpen(true);
  }

  function submitSearch() {
    if (filteredApps[0]) openTool(filteredApps[0].id);
  }

  return (
    <main
      data-testid="tools-hub"
      aria-labelledby="tools-home-heading"
      className={cn(
        "mx-auto w-full max-w-[90rem] overflow-x-hidden px-4 pb-8 text-[color:var(--text)] sm:px-6 lg:px-8",
        "pb-[calc(12rem+env(safe-area-inset-bottom))] sm:pb-8",
        "pt-7 sm:pt-10 lg:pt-14",
        className,
      )}
    >
      <section
        aria-label="Tools home"
        data-testid="tools-home"
        className="mx-auto grid max-w-5xl justify-items-center gap-5 text-center sm:gap-6"
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16">
          <Grid2X2 className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
        </span>
        <div className="grid gap-2">
          <h1
            id="tools-home-heading"
            className="text-balance text-[2rem] font-extrabold leading-none tracking-normal text-[color:var(--text-heading)] sm:text-[2.7rem]"
          >
            {copy.heading}
          </h1>
          <p className="mx-auto max-w-xl text-pretty text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            {copy.description}
          </p>
        </div>

        {desktopComposerSlotId ? (
          <div
            id={desktopComposerSlotId}
            className="mode-home-composer-slot hidden w-full max-w-3xl [&:not(:empty)]:block"
          />
        ) : (
          <ToolSearch
            value={query}
            onChange={updateQuery}
            onSubmit={submitSearch}
            copy={copy}
            className="w-full max-w-3xl"
          />
        )}

        <div className="w-full max-w-6xl" data-testid="tools-shortcuts">
          <div className="hidden sm:block">
            <QuickActions onSelect={openTool} />
          </div>
          <div className="sm:hidden">
            <QuickActions onSelect={openTool} mobile />
          </div>
        </div>
      </section>

      <section
        aria-label={copy.allSectionLabel}
        data-testid="tools-all-tools"
        className="mx-auto mt-8 grid max-w-[86rem] gap-4 sm:mt-10"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="text-left">
            <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">{copy.allSectionLabel}</h2>
          </div>
          <div className="flex items-center gap-3">
            <FilterTabs activeFilter={activeFilter} onFilterChange={setActiveFilter} />
            <div className="hidden min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 text-xs font-bold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] sm:inline-flex">
              Sort by
              <span className="text-[color:var(--text-heading)]">A to Z</span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </div>
          </div>
        </div>

        {filteredApps.length === 0 ? (
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 py-10 text-center shadow-[var(--shadow-inset)]">
            <p className="text-sm font-extrabold text-[color:var(--text-heading)]">{copy.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--text-muted)]">{copy.emptyBody}</p>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-2 gap-4 lg:grid xl:grid-cols-3">
              {filteredApps.map((app) => (
                <ToolCard key={app.id} app={app} selected={effectiveSelectedId === app.id} onSelect={openTool} />
              ))}
            </div>
            <div className="grid gap-3 lg:hidden">
              {filteredApps.map((app) => (
                <MobileToolRow key={app.id} app={app} selected={effectiveSelectedId === app.id} onSelect={openTool} />
              ))}
            </div>
          </>
        )}

        <p className="sr-only">
          Showing {filteredApps.length > 0 ? "1" : "0"} to {filteredApps.length} of {launcherApps.length}{" "}
          {copy.countNoun}
        </p>
      </section>

      <ModeHomeVerificationFooter icon={ShieldCheck} label="Clinical tools" body="Source-backed workflows" />

      <DetailDialog app={selectedApp} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </main>
  );
}

export function ApplicationsLauncherPage() {
  return <ApplicationsLauncherWorkspace />;
}
