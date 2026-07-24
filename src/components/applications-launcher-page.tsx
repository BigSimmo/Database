"use client";

import Link from "next/link";
import {
  Brain,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  FileText,
  Grid2X2,
  Palette,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { ModeHomeHero, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { useFavouritesAccess } from "@/components/clinical-dashboard/use-favourites-access";
import { cn, toneInfo, toneSuccess, toneWarning } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import { isLocalNoAuthMode, resolveClientDemoMode } from "@/lib/client-env";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { useAuthSession } from "@/lib/supabase/client";
import {
  toolCatalogRecordsForSession,
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

// Categorical identity tones from the token system (--type-*) so icons stay
// legible in dark mode and forced-colors; "safety" is genuinely semantic and
// uses the danger triad.
const iconToneClasses: Record<LauncherArea | "safety" | "medication" | "differentials", string> = {
  assessment:
    "border-[color:var(--type-service-border)] bg-[color:var(--type-service-soft)] text-[color:var(--type-service)]",
  reference: "border-[color:var(--type-table-border)] bg-[color:var(--type-table-soft)] text-[color:var(--type-table)]",
  care: "border-[color:var(--type-document-border)] bg-[color:var(--type-document-soft)] text-[color:var(--type-document)]",
  coordination:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  saved: "border-[color:var(--type-search-border)] bg-[color:var(--type-search-soft)] text-[color:var(--type-search)]",
  safety: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  medication: "border-[color:var(--type-form-border)] bg-[color:var(--type-form-soft)] text-[color:var(--type-form)]",
  differentials:
    "border-[color:var(--type-source-border)] bg-[color:var(--type-source-soft)] text-[color:var(--type-source)]",
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
  "safety-plan": ClipboardList,
  monitoring: Waves,
  favourites: Star,
};

function launcherAppsForSession(canAccessFavourites: boolean): LauncherApp[] {
  return toolCatalogRecordsForSession({
    authenticated: canAccessFavourites,
    demoMode: false,
  }).map((record) => ({
    ...record,
    icon: launcherIconById[record.id] ?? Sparkles,
  }));
}

const toolsLauncherCopy = {
  heading: "Tools",
  description: "Assessment, prescribing, workflows.",
  allSectionLabel: "All tools",
  countNoun: "tools",
  emptyTitle: "No tools match",
  emptyBody: "Clear the search or try another clinical workflow, tool name, or category.",
  searchAriaLabel: "Search tools",
  searchPlaceholder: "Search tools...",
  openSelectedAriaLabel: "Open selected tool",
};

const quickActionsBase = [
  { label: "Ask", desktopLabel: "Ask evidence", icon: Search, id: "clinical-kb-search" },
  { label: "Compare", desktopLabel: "Compare", icon: Brain, id: "differentials" },
  { label: "Prescribe", desktopLabel: "Prescribe", icon: Pill, id: "medication-prescribing" },
  { label: "Safety", desktopLabel: "Safety check", icon: ShieldCheck, id: "risk-safety" },
  { label: "Docs", desktopLabel: "Documents", icon: FileText, id: "documents" },
  { label: "Refer", desktopLabel: "Refer", icon: Users, id: "services" },
  { label: "Forms", desktopLabel: "Forms", icon: FileCheck2, id: "forms" },
  { label: "Saved", desktopLabel: "Favourites", icon: Star, id: "favourites" },
] as const;

const desktopFiltersBase: Array<{ id: LauncherFilter; label: string }> = [
  { id: "all", label: "All tools" },
  { id: "assessment", label: "Assess" },
  { id: "reference", label: "Evidence" },
  { id: "care", label: "Treat" },
  { id: "coordination", label: "Coordinate" },
  { id: "saved", label: "Saved" },
];

const mobileFilters: Array<{ id: LauncherFilter; label: string }> = [
  { id: "all", label: "All tools" },
  { id: "assessment", label: "Assess" },
  { id: "reference", label: "Evidence" },
  { id: "care", label: "Treat" },
  { id: "more", label: "More" },
];

/** Full catalog length (includes Favourites). Prefer session-filtered lists in UI. */
export const applicationsLauncherItemCount = launcherAppsForSession(true).length;

function appById(id: string, apps: LauncherApp[]) {
  return apps.find((app) => app.id === id) ?? apps[0];
}

function initialToolId(query: string | undefined, apps: LauncherApp[]) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return "risk-safety";
  return (
    apps.find((app) =>
      [app.title, app.mobileTitle, app.description, app.bestFor, app.detail, app.area, ...app.keywords]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    )?.id ?? "risk-safety"
  );
}

function quickActionsForSession(canAccessFavourites: boolean) {
  return canAccessFavourites ? quickActionsBase : quickActionsBase.filter((action) => action.id !== "favourites");
}

function desktopFiltersForSession(canAccessFavourites: boolean) {
  return canAccessFavourites ? desktopFiltersBase : desktopFiltersBase.filter((filter) => filter.id !== "saved");
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
      <Icon className={cn(size === "sm" ? "size-icon-lg" : size === "md" ? "h-6 w-6" : "h-7 w-7")} aria-hidden />
    </span>
  );
}

function StatusChip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "source" | "safety" | "high" }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-md border px-2 text-2xs font-bold leading-none",
        tone === "source" && toneSuccess,
        tone === "safety" && toneWarning,
        tone === "high" && toneInfo,
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
      <span className="grid h-tap w-tap place-items-center rounded-full text-[color:var(--clinical-accent)]">
        <Plus className="size-icon-lg" aria-hidden />
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
        <Search className="size-icon-lg" aria-hidden />
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

function QuickActions({
  onSelect,
  mobile,
  apps,
  canAccessFavourites,
}: {
  onSelect: (id: string) => void;
  mobile?: boolean;
  apps: LauncherApp[];
  canAccessFavourites: boolean;
}) {
  const quickActions = quickActionsForSession(canAccessFavourites);
  return (
    <section
      aria-label="Quick tool shortcuts"
      className={cn(mobile ? "grid grid-cols-4 gap-2" : "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6")}
    >
      {quickActions.slice(0, mobile ? 8 : 6).map((action) => {
        const app = appById(action.id, apps);
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
                : "grid min-h-14 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-2.5 py-2.5",
            )}
          >
            <span
              className={cn(
                "grid place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
                appIconTone(app),
                mobile ? "h-7 w-7" : "h-8 w-8",
              )}
            >
              <Icon className={mobile ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate font-bold leading-tight text-[color:var(--text-heading)]",
                  mobile ? "text-2xs" : "text-sm",
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

/**
 * Renders responsive tabs for selecting a tool category.
 *
 * @param activeFilter - The currently selected tool category.
 * @param onFilterChange - Called with the selected category when a tab is activated.
 */
function FilterTabs({
  activeFilter,
  onFilterChange,
  canAccessFavourites,
}: {
  activeFilter: LauncherFilter;
  onFilterChange: (filter: LauncherFilter) => void;
  canAccessFavourites: boolean;
}) {
  const desktopFilters = desktopFiltersForSession(canAccessFavourites);
  return (
    <>
      <div className="hidden flex-wrap items-center gap-2 sm:flex" role="group" aria-label="Filter by tool category">
        {desktopFilters.map((filter) => {
          const active = filter.id === activeFilter || (filter.id === "all" && activeFilter === "more");
          return (
            <button
              key={filter.id}
              type="button"
              id={`launcher-filter-desktop-${filter.id}`}
              aria-pressed={active}
              aria-controls="launcher-results-panel"
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                "inline-flex min-h-tap items-center justify-center whitespace-nowrap rounded-lg border px-4 text-xs font-bold transition",
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
      <div
        className="flex min-w-0 gap-1 overflow-x-auto pb-1 sm:hidden"
        role="group"
        aria-label="Filter by tool category"
      >
        {mobileFilters.map((filter) => {
          const active = filter.id === activeFilter || (filter.id === "all" && activeFilter === "saved");
          return (
            <button
              key={filter.id}
              type="button"
              id={`launcher-filter-mobile-${filter.id}`}
              aria-pressed={active}
              aria-controls="launcher-results-panel"
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                "inline-flex min-h-tap shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-lg border px-2 text-2xs font-bold transition",
                active
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)]",
                focusRing,
              )}
            >
              {filter.label}
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
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`View details for ${app.title}`}
      data-testid={`application-card-${app.id}`}
      onClick={() => onSelect(app.id)}
      className={cn(
        "group grid min-h-[9.25rem] grid-cols-[auto_minmax(0,1fr)_auto] gap-4 rounded-lg border bg-[color:var(--surface-lux)] p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-soft)] motion-reduce:hover:translate-y-0",
        selected
          ? app.id === "risk-safety"
            ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/45"
            : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/50"
          : "border-[color:var(--border)]",
        focusRing,
      )}
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
        Details
        <ChevronRight className="ml-1 inline h-3.5 w-3.5" aria-hidden />
      </span>
    </button>
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
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`View details for ${app.title}`}
      data-testid={`application-row-${app.id}`}
      onClick={() => onSelect(app.id)}
      className={cn(
        "grid min-h-[5.25rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-[color:var(--surface-lux)] px-3 py-3 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)]",
        selected
          ? app.id === "risk-safety"
            ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/45"
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
      <span className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[color:var(--clinical-accent)] px-3 text-2xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
        Details
        <ChevronRight className="ml-1 h-3 w-3" aria-hidden />
      </span>
    </button>
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
        <Icon className="size-icon-lg text-[color:var(--clinical-accent)]" aria-hidden />
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

const mobileDetailSections = [
  { id: "check-first", icon: ShieldCheck, label: "Check first" },
  { id: "needed-input", icon: ClipboardList, label: "Needed input" },
  { id: "output", icon: Waves, label: "Output" },
] as const;

type MobileDetailSectionId = (typeof mobileDetailSections)[number]["id"];

function MobileDetailSections({ app }: { app: LauncherApp }) {
  const [openSection, setOpenSection] = useState<MobileDetailSectionId | null>(null);

  function sectionContent(id: MobileDetailSectionId) {
    if (id === "output") return <p>{app.output}</p>;
    const items = id === "check-first" ? app.checkFirst : app.neededInput;
    return (
      <ul className="list-disc space-y-1 pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
      {mobileDetailSections.map(({ id, icon: Icon, label }) => {
        const expanded = openSection === id;
        const panelId = `launcher-detail-${id}-panel`;
        return (
          <div key={id} className="border-t border-[color:var(--border)] first:border-t-0">
            <button
              type="button"
              onClick={() => setOpenSection(expanded ? null : id)}
              aria-expanded={expanded}
              aria-controls={panelId}
              className={cn(
                "grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 text-left",
                focusRing,
              )}
            >
              <Icon className="size-icon-lg text-[color:var(--clinical-accent)]" aria-hidden />
              <span className="text-sm font-extrabold text-[color:var(--text-heading)]">{label}</span>
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-[color:var(--text-soft)] transition-transform motion-reduce:transition-none",
                  expanded && "rotate-90",
                )}
                aria-hidden
              />
            </button>
            <div id={panelId} hidden={!expanded} className="px-3 pb-3 text-xs leading-5 text-[color:var(--text-muted)]">
              {sectionContent(id)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailDialog({ app, open, onClose }: { app: LauncherApp; open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={app.title}
      closeLabel={`Close ${app.title}`}
      headerLeading={<ToolIcon app={app} size="md" />}
      descriptionContent={<ToolChips app={app} />}
      titleClassName="text-xl font-extrabold sm:text-2xl"
      contentClassName="sm:max-w-[39rem]"
      footer={
        <div className="grid gap-3">
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
            className={cn(
              "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg text-sm font-bold text-[color:var(--clinical-accent)]",
              focusRing,
            )}
          >
            View example
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="sm:hidden">
          <DetailSection icon={Search} title="Best for" compact>
            <p>{app.detail}</p>
          </DetailSection>
          <MobileDetailSections key={app.id} app={app} />
        </div>

        <div className="hidden sm:block">
          <DetailRows app={app} />
        </div>
      </div>
    </Sheet>
  );
}

type ApplicationsLauncherWorkspaceProps = {
  query?: string;
  desktopComposerSlotId?: string;
  className?: string;
  /** Optional override; defaults to the current auth/demo Favourites session gate. */
  canAccessFavourites?: boolean;
};

export function ApplicationsLauncherWorkspace({
  query: controlledQuery,
  desktopComposerSlotId,
  className,
  canAccessFavourites: canAccessFavouritesProp,
}: ApplicationsLauncherWorkspaceProps) {
  const auth = useAuthSession();
  const clientDemoMode = resolveClientDemoMode({
    explicitDemoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
    authUnavailableFallback: !auth.isConfigured,
    localNoAuthMode: isLocalNoAuthMode(),
  });
  const { favouritesAccessible } = useFavouritesAccess(auth.status === "authenticated", clientDemoMode);
  const canAccessFavourites = canAccessFavouritesProp ?? favouritesAccessible;
  const searchCommand = useSearchCommand();
  const [localQuery, setLocalQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<LauncherFilter>("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const copy = toolsLauncherCopy;
  const launcherApps = useMemo(() => launcherAppsForSession(canAccessFavourites), [canAccessFavourites]);
  const desktopFilters = useMemo(() => desktopFiltersForSession(canAccessFavourites), [canAccessFavourites]);
  const query = controlledQuery ?? searchCommand?.query ?? localQuery;
  const normalizedQuery = query.trim().toLowerCase();
  const queryDerivedId = useMemo(() => initialToolId(query, launcherApps), [launcherApps, query]);
  const [selection, setSelection] = useState(() => ({
    queryKey: (controlledQuery ?? "").trim().toLowerCase(),
    id: initialToolId(controlledQuery, launcherAppsForSession(canAccessFavourites)),
  }));
  const selectedId = detailOpen || selection.queryKey === normalizedQuery ? selection.id : queryDerivedId;
  const effectiveFilter: LauncherFilter = activeFilter === "saved" && !canAccessFavourites ? "all" : activeFilter;

  const filteredApps = useMemo(() => {
    return launcherApps.filter((app) => {
      const matchesFilter =
        effectiveFilter === "all"
          ? true
          : effectiveFilter === "more"
            ? app.area === "coordination" || app.area === "saved"
            : effectiveFilter === "saved"
              ? app.area === "saved"
              : app.area === effectiveFilter;
      const matchesQuery =
        !normalizedQuery ||
        [app.title, app.mobileTitle, app.description, app.bestFor, app.detail, areaLabels[app.area], ...app.keywords]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [effectiveFilter, launcherApps, normalizedQuery]);

  const effectiveSelectedId = filteredApps.some((app) => app.id === selectedId)
    ? selectedId
    : (filteredApps[0]?.id ?? selectedId);
  const selectedApp = appById(effectiveSelectedId, launcherApps);
  // Label the results by the selected filter's visible label (mobile-only filters
  // like "More" included) so assistive tech hears which result set is active.
  const activeFilterLabel =
    desktopFilters.find((filter) => filter.id === effectiveFilter)?.label ??
    mobileFilters.find((filter) => filter.id === effectiveFilter)?.label;
  const resultsPanelLabel =
    activeFilterLabel && activeFilterLabel !== copy.allSectionLabel
      ? `${activeFilterLabel} tools`
      : copy.allSectionLabel;

  function updateQuery(nextQuery: string) {
    if (controlledQuery === undefined && !searchCommand) setLocalQuery(nextQuery);
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
      aria-labelledby="tools-home-title"
      className={cn(
        "mx-auto w-full max-w-[90rem] overflow-x-hidden px-4 pb-8 text-[color:var(--text)] sm:px-6 lg:px-8",
        "pt-5 sm:pt-8 lg:pt-10",
        className,
      )}
    >
      <section
        aria-label="Tools home"
        data-testid="tools-home"
        className="mx-auto grid max-w-5xl justify-items-center gap-3 text-center sm:gap-4"
      >
        <ModeHomeHero
          testId="tools-home"
          title={copy.heading}
          subtitle={copy.description}
          icon={Grid2X2}
          headingLevel={1}
        />

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
            <QuickActions onSelect={openTool} apps={launcherApps} canAccessFavourites={canAccessFavourites} />
          </div>
          <div className="sm:hidden">
            <QuickActions onSelect={openTool} apps={launcherApps} canAccessFavourites={canAccessFavourites} mobile />
          </div>
        </div>
      </section>

      <section
        aria-label={copy.allSectionLabel}
        data-testid="tools-all-tools"
        className="mx-auto mt-8 grid max-w-[86rem] grid-cols-1 gap-4 sm:mt-10"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="text-left">
            <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">{copy.allSectionLabel}</h2>
          </div>
          <div className="flex items-center gap-3">
            <FilterTabs
              activeFilter={effectiveFilter}
              onFilterChange={setActiveFilter}
              canAccessFavourites={canAccessFavourites}
            />
            <p className="hidden min-h-10 items-center rounded-lg px-1 text-xs font-bold text-[color:var(--text-muted)] lg:inline-flex">
              Sorted A to Z
            </p>
          </div>
        </div>

        <div id="launcher-results-panel" role="group" aria-label={resultsPanelLabel} className="grid grid-cols-1 gap-4">
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
              <div className="grid grid-cols-1 gap-3 lg:hidden">
                {filteredApps.map((app) => (
                  <MobileToolRow key={app.id} app={app} selected={effectiveSelectedId === app.id} onSelect={openTool} />
                ))}
              </div>
            </>
          )}
        </div>

        <p className="sr-only">
          Showing {filteredApps.length > 0 ? "1" : "0"} to {filteredApps.length} of {launcherApps.length}{" "}
          {copy.countNoun}
        </p>
      </section>

      <div className="mx-auto mt-6 flex w-full max-w-[86rem] justify-center">
        <Link
          href="/reference/colour-coding"
          className={cn(
            "inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
            focusRing,
          )}
        >
          <Palette className="h-3.5 w-3.5" aria-hidden />
          Colour coding reference
        </Link>
      </div>

      <ModeHomeVerificationFooter icon={ShieldCheck} label="Clinical tools" body="Source-backed workflows" />

      <DetailDialog app={selectedApp} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </main>
  );
}

export function ApplicationsLauncherPage({ query }: { query?: string }) {
  return <ApplicationsLauncherWorkspace query={query} desktopComposerSlotId={modeHomeDesktopComposerSlotId} />;
}
