import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  Folder,
  Heart,
  History,
  LayoutList,
  Library,
  MessageSquare,
  MoreHorizontal,
  Pill,
  Pin,
  Plus,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";

export type FavouritesLibraryRedesignVariant = "command-console" | "review-console" | "set-navigator";

type FavouriteKind = "Medication" | "Document" | "Source" | "Saved search";
type ReviewState = "current" | "review-due" | "recent";

type FavouriteRecord = {
  id: string;
  title: string;
  kind: FavouriteKind;
  set: string;
  summary: string;
  provenance: string;
  lastUsed: string;
  action: string;
  href: string;
  reviewState: ReviewState;
  reviewLabel: string;
  icon: LucideIcon;
};

type FavouriteSet = {
  title: string;
  count: number;
  summary: string;
  lastUsed: string;
  reviewDue: number;
  icon: LucideIcon;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e7490]";

const favouriteRecords: FavouriteRecord[] = [
  {
    id: "acamprosate-renal-screen",
    title: "Acamprosate renal screen",
    kind: "Medication",
    set: "Ward round",
    summary: "Medication page / renal cautions / dose notes",
    provenance: "3 sources",
    lastUsed: "Today 08:44",
    action: "Open",
    href: "/?mode=prescribing&q=acamprosate+renal+dose",
    reviewState: "current",
    reviewLabel: "Source-backed",
    icon: Pill,
  },
  {
    id: "lithium-monitoring-guideline",
    title: "Lithium monitoring guideline",
    kind: "Document",
    set: "Prescribing safety",
    summary: "PDF pages 4-9 / monitoring table",
    provenance: "Verified PDF",
    lastUsed: "Today 08:20",
    action: "Ask",
    href: "/?mode=documents&q=lithium+monitoring",
    reviewState: "review-due",
    reviewLabel: "Review due",
    icon: FileText,
  },
  {
    id: "clozapine-monitoring-table",
    title: "Clozapine monitoring table",
    kind: "Source",
    set: "Clozapine clinic",
    summary: "Saved table / ANC monitoring",
    provenance: "Table source",
    lastUsed: "Yesterday",
    action: "Source",
    href: "/?mode=documents&q=clozapine+monitoring+table",
    reviewState: "current",
    reviewLabel: "Source-backed",
    icon: Quote,
  },
  {
    id: "renal-dose-search",
    title: "renal dose saved search",
    kind: "Saved search",
    set: "Ward round",
    summary: "Medicines plus documents / eGFR cautions",
    provenance: "Query",
    lastUsed: "Today 07:55",
    action: "Run",
    href: "/?mode=answer&q=renal+dose&run=1",
    reviewState: "recent",
    reviewLabel: "Recently run",
    icon: Search,
  },
  {
    id: "qt-prolongation-quote",
    title: "QT prolongation quote",
    kind: "Source",
    set: "Prescribing safety",
    summary: "Source card / prescribing safety",
    provenance: "Quote",
    lastUsed: "Mon",
    action: "Copy",
    href: "/?mode=documents&q=QT+prolongation",
    reviewState: "current",
    reviewLabel: "Source-backed",
    icon: Quote,
  },
];

const favouriteSets: FavouriteSet[] = [
  {
    title: "Ward round",
    count: 2,
    summary: "Renal checks, recurring review prompts, and medication pages.",
    lastUsed: "Today 08:44",
    reviewDue: 0,
    icon: Stethoscope,
  },
  {
    title: "Prescribing safety",
    count: 2,
    summary: "Dose limits, QT risk, monitoring, and source quotes.",
    lastUsed: "Today 08:20",
    reviewDue: 1,
    icon: ShieldCheck,
  },
  {
    title: "Clozapine clinic",
    count: 1,
    summary: "ANC monitoring table, clinic source cards, counselling.",
    lastUsed: "Yesterday",
    reviewDue: 0,
    icon: BookOpen,
  },
];

const variants: Record<
  FavouritesLibraryRedesignVariant,
  {
    label: string;
    eyebrow: string;
    title: string;
    description: string;
    selectedId: string;
    accent: string;
    pageClassName: string;
    commandClassName: string;
    resumeTitle: string;
    resumeBody: string;
    primaryFilter: string;
  }
> = {
  "command-console": {
    label: "Command console",
    eyebrow: "Mockup 1",
    title: "Favourites command library",
    description: "A scalable library console with the action-first confidence of the command desk.",
    selectedId: "acamprosate-renal-screen",
    accent: "#007c89",
    pageClassName: "bg-[color:var(--surface-lux)] text-[color:var(--text-heading)]",
    commandClassName:
      "bg-[color:var(--clinical-accent)] text-white shadow-[0_14px_34px_rgba(0,124,137,0.24)] hover:bg-[color:var(--clinical-accent-hover)]",
    resumeTitle: "Resume Acamprosate renal screen",
    resumeBody: "Open the ward-round renal caution page with source count, set context, and next action visible.",
    primaryFilter: "Recent",
  },
  "review-console": {
    label: "Review console",
    eyebrow: "Mockup 2",
    title: "Favourites review console",
    description: "A governance-heavy version for source state, review due work, and selected-item inspection.",
    selectedId: "lithium-monitoring-guideline",
    accent: "#1d4ed8",
    pageClassName: "bg-[color:var(--surface-raised)] text-[color:var(--text-heading)]",
    commandClassName:
      "bg-[color:var(--primary)] text-white shadow-[0_14px_34px_rgba(29,78,216,0.22)] hover:bg-[color:var(--primary-hover)]",
    resumeTitle: "Review lithium monitoring guideline",
    resumeBody: "Check pages 4-9, mark the PDF as reviewed, then ask against the document if needed.",
    primaryFilter: "Review due",
  },
  "set-navigator": {
    label: "Set navigator",
    eyebrow: "Mockup 3",
    title: "Favourites set navigator",
    description: "A library-first page that makes workflow sets the fastest way into saved material.",
    selectedId: "renal-dose-search",
    accent: "#047857",
    pageClassName: "bg-[color:var(--surface-lux)] text-[color:var(--text-heading)]",
    commandClassName:
      "bg-[color:var(--success)] text-white shadow-[0_14px_34px_rgba(4,120,87,0.24)] hover:bg-[color:var(--success-hover)]",
    resumeTitle: "Run renal dose saved search",
    resumeBody: "Restart the ward-round saved query across medicines and documents before opening individual items.",
    primaryFilter: "Ward round",
  },
};

const variantRoutes: Array<{ id: FavouritesLibraryRedesignVariant; href: string }> = [
  { id: "command-console", href: "/mockups/favourites-command-console" },
  { id: "review-console", href: "/mockups/favourites-review-console" },
  { id: "set-navigator", href: "/mockups/favourites-set-navigator" },
];

function statusClassName(state: ReviewState) {
  if (state === "review-due")
    return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  if (state === "recent")
    return "border-[color:var(--type-document-border)] bg-[color:var(--type-document-soft)] text-[color:var(--type-document)]";
  return "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]";
}

function kindClassName(kind: FavouriteKind) {
  if (kind === "Medication")
    return "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]";
  if (kind === "Document")
    return "border-[color:var(--type-document-border)] bg-[color:var(--type-document-soft)] text-[color:var(--type-document)]";
  if (kind === "Source")
    return "border-[color:var(--type-source-border)] bg-[color:var(--type-source-soft)] text-[color:var(--type-source)]";
  return "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";
}

function ShellPill({
  children,
  active = false,
  icon: Icon,
}: {
  children: React.ReactNode;
  active?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]",
        active
          ? "border-[color:var(--border)] bg-white text-[color:var(--text-muted)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-highlight)] text-[color:var(--text-muted)]",
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

function IconTile({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-lg border",
        active
          ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
          : "border-[color:var(--border)] bg-white text-[color:var(--text-muted)]",
      )}
    >
      <Icon className="h-4.5 w-4.5" aria-hidden />
    </span>
  );
}

function CommandButton({ children, href, className }: { children: React.ReactNode; href: string; className: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition",
        focusRing,
        className,
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function VariantSwitch({ active }: { active: FavouritesLibraryRedesignVariant }) {
  return (
    <nav aria-label="Favourites redesign mockups" className="flex flex-wrap gap-2">
      {variantRoutes.map((route) => {
        const config = variants[route.id];
        const isActive = route.id === active;
        return (
          <Link
            key={route.id}
            href={route.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-extrabold transition",
              focusRing,
              isActive
                ? "border-[color:var(--border)] bg-white text-[color:var(--text-muted)] shadow-[0_10px_26px_rgba(15,31,44,0.08)]"
                : "border-[color:var(--border)] bg-[color:var(--surface-highlight)] text-[color:var(--text-muted)] hover:bg-white",
            )}
          >
            {config.eyebrow}: {config.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PageHeader({ variant, selected }: { variant: FavouritesLibraryRedesignVariant; selected: FavouriteRecord }) {
  const config = variants[variant];
  return (
    <header className="grid gap-4 rounded-xl border border-white/80 bg-white/74 p-4 shadow-[0_18px_50px_rgba(16,32,51,0.08)] backdrop-blur-xl lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <VariantSwitch active={variant} />
        <div className="mt-4 flex min-w-0 items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
            style={{ color: config.accent }}
          >
            <Heart className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
              {config.eyebrow}
            </p>
            <h1 className="mt-1 text-balance text-3xl font-black leading-tight tracking-normal text-[color:var(--text-muted)] sm:text-4xl">
              {config.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[color:var(--text-muted)]">
              {config.description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:min-w-[34rem]">
        <form className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[color:var(--border)] bg-white px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_14px_30px_rgba(15,31,44,0.06)]">
          <Search className="h-5 w-5 text-[color:var(--text-muted)]" aria-hidden />
          <span className="truncate text-sm font-bold text-[color:var(--text-muted)]">
            Search favourites, sets, source notes or saved searches...
          </span>
          <kbd className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-1 text-xs font-bold text-[color:var(--text-muted)]">
            Ctrl K
          </kbd>
        </form>
        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          <CommandButton href={selected.href} className={config.commandClassName}>
            {selected.action} selected
          </CommandButton>
          <button
            type="button"
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-white px-3 text-sm font-extrabold text-[color:var(--text-muted)] shadow-[0_10px_24px_rgba(15,31,44,0.06)] transition hover:bg-[color:var(--surface-subtle)]",
              focusRing,
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add favourite
          </button>
        </div>
      </div>
    </header>
  );
}

function ResumeBand({ variant, selected }: { variant: FavouritesLibraryRedesignVariant; selected: FavouriteRecord }) {
  const config = variants[variant];
  const stats = [
    { label: "Source-backed", value: "5", icon: CheckCircle2 },
    { label: "Review due", value: "1", icon: Clock3 },
    { label: "Pinned sets", value: "3", icon: Pin },
    { label: "Total items", value: "5", icon: Library },
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-white shadow-[0_18px_50px_rgba(16,32,51,0.08)]">
        <div className="grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <IconTile icon={selected.icon} active />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ShellPill active icon={Sparkles}>
                Resume next
              </ShellPill>
              <span
                className={cn(
                  "inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-extrabold",
                  statusClassName(selected.reviewState),
                )}
              >
                {selected.reviewLabel}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-normal text-[color:var(--text-muted)]">
              {config.resumeTitle}
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[color:var(--text-muted)]">
              {config.resumeBody}
            </p>
            <p className="mt-3 text-xs font-bold text-[color:var(--text-muted)]">
              {selected.set} / {selected.provenance} / {selected.lastUsed}
            </p>
          </div>
          <CommandButton href={selected.href} className={config.commandClassName}>
            {selected.action}
          </CommandButton>
        </div>
        <div className="grid border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] sm:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-t border-[color:var(--border)] px-4 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[color:var(--text-muted)] shadow-[inset_0_0_0_1px_var(--border)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xl font-black leading-none text-[color:var(--text-muted)]">
                    {stat.value}
                  </span>
                  <span className="mt-1 block truncate text-xs font-bold text-[color:var(--text-muted)]">
                    {stat.label}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <ReviewQueue variant={variant} />
    </section>
  );
}

function ReviewQueue({ variant }: { variant: FavouritesLibraryRedesignVariant }) {
  const dueItem = favouriteRecords.find((item) => item.reviewState === "review-due") ?? favouriteRecords[1];
  return (
    <aside className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4 shadow-[0_18px_50px_rgba(119,72,0,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
            Review queue
          </p>
          <h2 className="mt-1 text-xl font-black text-[color:var(--text-muted)]">1 item needs confirmation</h2>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--border)] bg-white text-[color:var(--text-muted)]">
          <Clock3 className="h-4.5 w-4.5" aria-hidden />
        </span>
      </div>
      <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-white p-3">
        <div className="flex items-start gap-3">
          <IconTile icon={dueItem.icon} active={variant === "review-console"} />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[color:var(--text-muted)]">{dueItem.title}</p>
            <p className="mt-1 text-xs font-bold text-[color:var(--text-muted)]">
              {dueItem.set} / {dueItem.provenance}
            </p>
            <p className="mt-2 text-xs font-extrabold text-[color:var(--text-muted)]">Clinical review due in 7 days</p>
          </div>
        </div>
      </div>
      <button
        type="button"
        className={cn(
          "mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-white px-3 text-sm font-extrabold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)]",
          focusRing,
        )}
      >
        Open review queue
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </aside>
  );
}

function FilterRail({ variant }: { variant: FavouritesLibraryRedesignVariant }) {
  const config = variants[variant];
  const filters = [
    { label: "All favourites", value: "5", icon: Heart },
    { label: "Medications", value: "1", icon: Pill },
    { label: "Documents", value: "1", icon: FileText },
    { label: "Sources", value: "2", icon: Quote },
    { label: "Saved searches", value: "1", icon: Search },
  ];

  return (
    <aside className="min-w-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-3 shadow-[0_16px_40px_rgba(15,31,44,0.06)]">
      <div className="flex items-center justify-between gap-2 px-1 py-2">
        <h2 className="text-base font-black text-[color:var(--text-muted)]">Filters</h2>
        <button type="button" className={cn("text-xs font-extrabold text-[color:var(--text-muted)]", focusRing)}>
          Reset
        </button>
      </div>
      <div className="mt-2 grid gap-1">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const active = filter.label === "All favourites" || filter.label === config.primaryFilter;
          return (
            <button
              key={filter.label}
              type="button"
              aria-pressed={active}
              className={cn(
                "grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 text-left text-sm font-extrabold transition",
                focusRing,
                active
                  ? "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
                  : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-muted)]",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="truncate">{filter.label}</span>
              <span className="tabular-nums">{filter.value}</span>
            </button>
          );
        })}
      </div>
      <div className="my-4 border-t border-[color:var(--border)]" />
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-sm font-black text-[color:var(--text-muted)]">Saved sets</h3>
        <button type="button" className={cn("text-xs font-extrabold text-[color:var(--text-muted)]", focusRing)}>
          New set
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {favouriteSets.map((set) => {
          const Icon = set.icon;
          const active = variant === "set-navigator" && set.title === "Ward round";
          return (
            <button
              key={set.title}
              type="button"
              aria-pressed={active}
              className={cn(
                "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 text-left transition",
                focusRing,
                active
                  ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
                  : "border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{set.title}</span>
                <span className="block text-xs font-bold opacity-80">{set.count} items</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function SetNavigatorStrip({ variant }: { variant: FavouritesLibraryRedesignVariant }) {
  if (variant !== "set-navigator") return null;

  return (
    <section className="grid gap-3 lg:grid-cols-3">
      {favouriteSets.map((set) => {
        const Icon = set.icon;
        const active = set.title === "Ward round";
        return (
          <article
            key={set.title}
            className={cn(
              "rounded-xl border bg-white p-4 shadow-[0_16px_40px_rgba(15,31,44,0.06)]",
              active
                ? "border-[color:var(--border)] ring-2 ring-[color:var(--clinical-accent-border)]"
                : "border-[color:var(--border)]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-xl",
                  active
                    ? "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
                    : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-1 text-xs font-black text-[color:var(--text-muted)]">
                {set.count} items
              </span>
            </div>
            <h2 className="mt-4 text-lg font-black text-[color:var(--text-muted)]">{set.title}</h2>
            <p className="mt-1 min-h-10 text-sm font-semibold leading-5 text-[color:var(--text-muted)]">
              {set.summary}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[color:var(--text-muted)]">
              <span>Last used {set.lastUsed}</span>
              <span
                className={cn(
                  "text-right",
                  set.reviewDue ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-muted)]",
                )}
              >
                {set.reviewDue ? `${set.reviewDue} review due` : "No review due"}
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function LibraryTable({ variant, selected }: { variant: FavouritesLibraryRedesignVariant; selected: FavouriteRecord }) {
  const config = variants[variant];

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--border)] bg-white shadow-[0_18px_50px_rgba(15,31,44,0.08)]">
      <div className="grid gap-3 border-b border-[color:var(--border)] bg-white p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-[color:var(--text-muted)]">All favourites</h2>
            <span className="rounded-md bg-[color:var(--surface-subtle)] px-2 py-1 text-xs font-black text-[color:var(--text-muted)]">
              5 items
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-[color:var(--text-muted)]">
            Primary action, source state, set context, and review state stay visible.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ShellPill active={variant !== "review-console"} icon={History}>
            {config.primaryFilter}
          </ShellPill>
          <ShellPill icon={Filter}>Type</ShellPill>
          <ShellPill icon={LayoutList}>Table</ShellPill>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[38rem]">
          <div className="grid min-h-12 grid-cols-[4.25rem_minmax(8.5rem,1.2fr)_5rem_5.5rem_5.75rem_5rem] items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-xs font-black uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            <span aria-hidden />
            <span>Name</span>
            <span>Type</span>
            <span>Set</span>
            <span>Source</span>
            <span className="text-right">Action</span>
          </div>
          {favouriteRecords.map((record) => {
            const isSelected = record.id === selected.id;
            const Icon = record.icon;
            return (
              <Link
                key={record.id}
                href={record.href}
                className={cn(
                  "grid min-h-[5.5rem] grid-cols-[4.25rem_minmax(8.5rem,1.2fr)_5rem_5.5rem_5.75rem_5rem] items-center gap-2 border-b border-[color:var(--border)] px-3 py-3 last:border-b-0 transition",
                  focusRing,
                  isSelected
                    ? "bg-[color:var(--surface-subtle)] shadow-[inset_3px_0_0_var(--clinical-accent)]"
                    : "hover:bg-[color:var(--surface-subtle)]",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded border",
                      isSelected
                        ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
                        : "border-[color:var(--border)] bg-white",
                    )}
                  >
                    {isSelected ? <CheckCircle2 className="h-3.5 w-3.5 text-white" aria-hidden /> : null}
                  </span>
                  <IconTile icon={Icon} active={isSelected} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[color:var(--text-muted)]">
                    {record.title}
                  </span>
                  <span className="mt-1 block truncate text-xs font-bold text-[color:var(--text-muted)]">
                    {record.summary}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className={cn(
                        "inline-flex min-h-6 items-center rounded-md border px-2 text-2xs font-black",
                        statusClassName(record.reviewState),
                      )}
                    >
                      {record.reviewLabel}
                    </span>
                    <span className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--border)] bg-white px-2 text-2xs font-black text-[color:var(--text-muted)]">
                      {record.lastUsed}
                    </span>
                  </span>
                </span>
                <span
                  className={cn("w-fit rounded-md border px-2 py-1 text-xs font-black", kindClassName(record.kind))}
                >
                  {record.kind}
                </span>
                <span className="truncate text-xs font-bold text-[color:var(--text-muted)]">{record.set}</span>
                <span className="truncate text-xs font-bold text-[color:var(--text-muted)]">{record.provenance}</span>
                <span className="flex justify-end gap-1.5">
                  <span
                    className={cn(
                      "inline-flex min-h-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-white px-2 text-xs font-black text-[color:var(--text-muted)]",
                      isSelected && "border-[color:var(--border)] text-[color:var(--text-muted)]",
                    )}
                  >
                    {record.action}
                  </span>
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border)] bg-white text-[color:var(--text-muted)]">
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Inspector({ selected, variant }: { selected: FavouriteRecord; variant: FavouritesLibraryRedesignVariant }) {
  const config = variants[variant];
  const related = favouriteRecords.filter((item) => item.id !== selected.id).slice(0, 3);

  return (
    <aside className="min-w-0 rounded-xl border border-[color:var(--border)] bg-white shadow-[0_18px_50px_rgba(15,31,44,0.08)]">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[color:var(--border)] px-4">
        <h2 className="text-sm font-black text-[color:var(--text-muted)]">Selected item</h2>
        <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <IconTile icon={selected.icon} active />
          <div className="min-w-0">
            <h3 className="text-xl font-black leading-tight text-[color:var(--text-muted)]">{selected.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={cn(
                  "inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-black",
                  kindClassName(selected.kind),
                )}
              >
                {selected.kind}
              </span>
              <span
                className={cn(
                  "inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-black",
                  statusClassName(selected.reviewState),
                )}
              >
                {selected.reviewLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Source details</p>
          <dl className="mt-3 grid gap-2 text-sm">
            {[
              ["Set", selected.set],
              ["Provenance", selected.provenance],
              ["Last used", selected.lastUsed],
              ["Next action", selected.action],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
                <dt className="font-bold text-[color:var(--text-muted)]">{label}</dt>
                <dd className="min-w-0 truncate font-extrabold text-[color:var(--text-muted)]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden />
            <div>
              <p className="text-sm font-black text-[color:var(--text-muted)]">
                {selected.reviewState === "review-due" ? "Clinical review due" : "Governance note"}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
                Keep source state visible before opening, asking, copying, or running saved material.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <CommandButton href={selected.href} className={config.commandClassName}>
            {selected.action} this item
          </CommandButton>
          {[
            { label: "Ask a question", icon: MessageSquare },
            { label: "Open source details", icon: ExternalLink },
            { label: "Copy citation note", icon: Copy },
            { label: "Move to set", icon: Folder },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                className={cn(
                  "inline-flex min-h-10 items-center justify-start gap-2 rounded-lg border border-[color:var(--border)] bg-white px-3 text-sm font-extrabold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)]",
                  focusRing,
                )}
              >
                <Icon className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
                {action.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 border-t border-[color:var(--border)] pt-4">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Related items</p>
          <div className="mt-3 grid gap-2">
            {related.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-white px-2.5 transition hover:bg-[color:var(--surface-subtle)]",
                  focusRing,
                )}
              >
                <IconTile icon={item.icon} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black text-[color:var(--text-muted)]">{item.title}</span>
                  <span className="block truncate text-2xs font-bold text-[color:var(--text-muted)]">{item.set}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[color:var(--text-muted)]" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function FavouritesLibraryRedesignPage({ variant }: { variant: FavouritesLibraryRedesignVariant }) {
  const config = variants[variant];
  const selected = favouriteRecords.find((item) => item.id === config.selectedId) ?? favouriteRecords[0];

  return (
    <main
      data-testid={`favourites-${variant}`}
      className={cn("min-h-screen overflow-x-hidden px-3 py-4 sm:px-5 lg:px-6", config.pageClassName)}
    >
      <div className="mx-auto grid max-w-[96rem] gap-4">
        <PageHeader variant={variant} selected={selected} />
        <ResumeBand variant={variant} selected={selected} />
        <SetNavigatorStrip variant={variant} />

        <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_22rem]">
          <FilterRail variant={variant} />
          <LibraryTable variant={variant} selected={selected} />
          <Inspector variant={variant} selected={selected} />
        </div>
      </div>
    </main>
  );
}
