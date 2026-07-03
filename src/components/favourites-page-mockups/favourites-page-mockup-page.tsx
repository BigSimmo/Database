import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  Filter,
  Folder,
  FolderKanban,
  Grid2X2,
  Heart,
  History,
  LayoutList,
  Library,
  Pill,
  Pin,
  Plus,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

export type FavouritesPageMockupVariant = "command-desk" | "set-board" | "library-view";

type FavouriteStatus = "ready" | "recent" | "review";
type FavouriteKind = "Medication" | "Document" | "Source" | "Saved search";

type FavouriteFixture = {
  id: string;
  title: string;
  kind: FavouriteKind;
  set: string;
  description: string;
  sourceMeta: string;
  lastUsed: string;
  action: string;
  status: FavouriteStatus;
  icon: LucideIcon;
  href: string;
};

type SetFixture = {
  id: string;
  title: string;
  count: number;
  nextAction: string;
  lastUsed: string;
  description: string;
  icon: LucideIcon;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const variantCopy: Record<
  FavouritesPageMockupVariant,
  {
    eyebrow: string;
    title: string;
    body: string;
    recommendation: string;
  }
> = {
  "command-desk": {
    eyebrow: "Concept 1",
    title: "Favourites command desk",
    body: "Resume the safest next clinical action before browsing the whole saved library.",
    recommendation: "Best default direction",
  },
  "set-board": {
    eyebrow: "Concept 2",
    title: "Saved sets board",
    body: "Group saved work by real clinical workflow so ward round, safety, and clinic material stay together.",
    recommendation: "Best for repeated workflows",
  },
  "library-view": {
    eyebrow: "Concept 3",
    title: "Favourites library",
    body: "A dense searchable register for teams whose saved clinical material will keep growing.",
    recommendation: "Best for scale",
  },
};

const favouriteItems: FavouriteFixture[] = [
  {
    id: "acamprosate-renal-screen",
    title: "Acamprosate renal screen",
    kind: "Medication",
    set: "Ward round",
    description: "Medication page with renal cautions and dose notes",
    sourceMeta: "3 sources checked",
    lastUsed: "Today 8:44",
    action: "Open",
    status: "ready",
    icon: Pill,
    href: "/?mode=prescribing&q=acamprosate+renal+dose",
  },
  {
    id: "lithium-monitoring-guideline",
    title: "Lithium monitoring guideline",
    kind: "Document",
    set: "Prescribing safety",
    description: "PDF pages 4-9 with shared-care monitoring table",
    sourceMeta: "PDF / p.4-9",
    lastUsed: "Today 8:20",
    action: "Ask",
    status: "review",
    icon: FileText,
    href: "/?mode=documents&q=lithium+monitoring",
  },
  {
    id: "clozapine-monitoring-table",
    title: "Clozapine monitoring table",
    kind: "Source",
    set: "Clozapine clinic",
    description: "Saved table for ANC monitoring and escalation",
    sourceMeta: "Table source",
    lastUsed: "Yesterday",
    action: "Source",
    status: "ready",
    icon: Quote,
    href: "/?mode=documents&q=clozapine+monitoring+table",
  },
  {
    id: "renal-dose-search",
    title: "Renal dose saved search",
    kind: "Saved search",
    set: "Ward round",
    description: "Runs medicines and documents for eGFR-linked dose cautions",
    sourceMeta: "Saved query",
    lastUsed: "Today 7:55",
    action: "Run",
    status: "recent",
    icon: Search,
    href: "/?mode=answer&q=renal+dose&run=1",
  },
  {
    id: "qt-prolongation-quote",
    title: "QT prolongation quote",
    kind: "Source",
    set: "Prescribing safety",
    description: "Source card for prescribing safety notes",
    sourceMeta: "Quote",
    lastUsed: "Mon",
    action: "Copy",
    status: "ready",
    icon: Quote,
    href: "/?mode=documents&q=QT+prolongation",
  },
];

const favouriteSets: SetFixture[] = [
  {
    id: "ward-round",
    title: "Ward round",
    count: 2,
    nextAction: "Run renal dose search",
    lastUsed: "Today 8:44",
    description: "Medication pages, renal checks, and recurring review prompts.",
    icon: Stethoscope,
  },
  {
    id: "prescribing-safety",
    title: "Prescribing safety",
    count: 2,
    nextAction: "Review lithium monitoring",
    lastUsed: "Today 8:20",
    description: "Dose limits, pregnancy cautions, QT risk, and monitoring.",
    icon: ShieldCheck,
  },
  {
    id: "clozapine-clinic",
    title: "Clozapine clinic",
    count: 1,
    nextAction: "Open ANC table",
    lastUsed: "Yesterday",
    description: "Monitoring, counselling, and clinic source cards.",
    icon: Brain,
  },
];

const statusLabels: Record<FavouriteStatus, string> = {
  ready: "Ready",
  recent: "Recent",
  review: "Review due",
};

const statusStyles: Record<FavouriteStatus, string> = {
  ready: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
  recent: "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]",
  review: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
};

const kindStyles: Record<FavouriteKind, string> = {
  Document: "bg-[color:var(--info-soft)] text-[color:var(--info)] border-[color:var(--info-border)]",
  Medication:
    "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] border-[color:var(--clinical-accent-border)]",
  "Saved search": "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)] border-[color:var(--border)]",
  Source: "bg-[color:var(--warning-soft)] text-[color:var(--warning)] border-[color:var(--warning-border)]",
};

function StatusPill({ status }: { status: FavouriteStatus }) {
  return (
    <span
      className={cn("inline-flex min-h-6 items-center rounded-md border px-2 text-2xs font-bold", statusStyles[status])}
    >
      {statusLabels[status]}
    </span>
  );
}

function KindPill({ kind }: { kind: FavouriteKind }) {
  return (
    <span
      className={cn("inline-flex min-h-6 items-center rounded-md border px-2 text-2xs font-bold", kindStyles[kind])}
    >
      {kind}
    </span>
  );
}

function IconTile({ icon: Icon, quiet = false }: { icon: LucideIcon; quiet?: boolean }) {
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

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--command-hover)]",
        focusRing,
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function GhostButton({ children, pressed = false }: { children: ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold shadow-[var(--shadow-inset)]",
        pressed
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function MockupHeader({ variant, children }: { variant: FavouritesPageMockupVariant; children?: ReactNode }) {
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
              {copy.recommendation}
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

function SearchControl({ placeholder = "Search favourites, sets, source notes" }: { placeholder?: string }) {
  return (
    <form className="grid min-h-[3.25rem] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2 shadow-[var(--shadow-tight)]">
      <Search className="ml-2 h-5 w-5 text-[color:var(--text-soft)]" aria-hidden="true" />
      <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--text-soft)]">{placeholder}</span>
      <button
        type="button"
        aria-label="Search favourites"
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

function FavouritesStats() {
  const stats = [
    { label: "Items", value: String(favouriteItems.length), icon: Heart },
    { label: "Sets", value: String(favouriteSets.length), icon: Folder },
    {
      label: "Ready",
      value: String(favouriteItems.filter((item) => item.status === "ready").length),
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[27rem]">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 shadow-[var(--shadow-inset)]"
          >
            <IconTile icon={Icon} />
            <span className="min-w-0">
              <span className="nums block text-xl font-extrabold leading-none text-[color:var(--text-heading)]">
                {stat.value}
              </span>
              <span className="mt-1 block truncate text-xs font-bold text-[color:var(--text-muted)]">{stat.label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FavouriteRow({ item, dense = false }: { item: FavouriteFixture; dense?: boolean }) {
  const Icon = item.icon;

  return (
    <article
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] py-3 last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_auto]",
        dense ? "min-h-16" : "min-h-[4.75rem]",
      )}
    >
      <IconTile icon={Icon} quiet={item.status !== "recent"} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">{item.title}</h3>
          <KindPill kind={item.kind} />
          <StatusPill status={item.status} />
        </div>
        <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
          {item.description}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[color:var(--text-soft)]">
          <span>{item.set}</span>
          <span aria-hidden="true">/</span>
          <span>{item.sourceMeta}</span>
          <span aria-hidden="true">/</span>
          <span>{item.lastUsed}</span>
        </p>
      </div>
      <div className="col-span-2 flex items-center gap-2 md:col-span-1 md:justify-end">
        <ActionLink href={item.href}>{item.action}</ActionLink>
        <button
          type="button"
          aria-label={`Move ${item.title} to set`}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            focusRing,
          )}
        >
          <Folder className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function SetRow({ set, active = false }: { set: SetFixture; active?: boolean }) {
  const Icon = set.icon;

  return (
    <Link
      href="/favourites"
      className={cn(
        "grid min-h-[4.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-3 py-3 last:border-b-0 hover:bg-[color:var(--surface-subtle)]",
        active && "bg-[color:var(--clinical-accent-soft)]",
        focusRing,
      )}
    >
      <IconTile icon={Icon} quiet={!active} />
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-sm font-extrabold",
            active ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-heading)]",
          )}
        >
          {set.title}
        </span>
        <span className="block truncate text-xs font-semibold text-[color:var(--text-muted)]">
          {set.count} items / {set.lastUsed}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
    </Link>
  );
}

function CommandDeskMockup() {
  const nextItem = favouriteItems[0];
  // Keep the shortcut strip distinct from the resume-next hero (item 0) above it.
  const recentItems = [favouriteItems[3], favouriteItems[1], favouriteItems[4]];

  return (
    <>
      <MockupHeader variant="command-desk">
        <FavouritesStats />
      </MockupHeader>
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-h-7 items-center gap-2 rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-extrabold text-[color:var(--clinical-accent)]">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Resume next
                  </span>
                  <StatusPill status={nextItem.status} />
                </div>
                <h2 className="mt-3 text-2xl font-extrabold leading-tight text-[color:var(--text-heading)]">
                  {nextItem.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                  {nextItem.description}. Keep the ward-round renal check in context with the saved set and source count
                  visible before opening.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <ActionLink href={nextItem.href}>Open item</ActionLink>
                <GhostButton>
                  <FolderKanban className="h-4 w-4" aria-hidden="true" />
                  Ward round set
                </GhostButton>
              </div>
            </div>
            <div className="grid border-t border-[color:var(--border)] md:grid-cols-3">
              {recentItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[color:var(--border)] px-4 py-3 first:border-t-0 hover:bg-[color:var(--surface-subtle)] md:border-l md:border-t-0 md:first:border-l-0",
                      focusRing,
                    )}
                  >
                    <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-[color:var(--text-heading)]">
                        {item.action} {item.kind.toLowerCase()}
                      </span>
                      <span className="block truncate text-xs font-semibold text-[color:var(--text-soft)]">
                        {item.title}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </section>

          <aside className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[color:var(--border)] px-4">
              <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Pinned sets</h2>
              <Link
                href="/favourites"
                className={cn(
                  "inline-flex min-h-10 items-center rounded-md px-1 text-xs font-bold text-[color:var(--clinical-accent)]",
                  focusRing,
                )}
              >
                Manage
              </Link>
            </div>
            {favouriteSets.map((set, index) => (
              <SetRow key={set.id} set={set} active={index === 0} />
            ))}
          </aside>
        </section>

        <section className="grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <SearchControl />
            <div className="flex flex-wrap gap-2">
              <GhostButton pressed>
                <History className="h-4 w-4" aria-hidden="true" />
                Recent
              </GhostButton>
              <GhostButton>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Ready
              </GhostButton>
              <GhostButton>
                <Filter className="h-4 w-4" aria-hidden="true" />
                Type
              </GhostButton>
              <GhostButton>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </GhostButton>
            </div>
          </div>

          <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)] sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[color:var(--border)] pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Saved work</h2>
                <p className="mt-1 text-sm font-medium text-[color:var(--text-muted)]">
                  Primary action, source state, and set context stay visible in every row.
                </p>
              </div>
              <span className="nums rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-xs font-bold text-[color:var(--text-muted)]">
                {favouriteItems.length}
              </span>
            </div>
            <div>
              {favouriteItems.map((item) => (
                <FavouriteRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        </section>
      </main>
    </>
  );
}

function SetBoardColumn({ set, active = false }: { set: SetFixture; active?: boolean }) {
  const setItems = favouriteItems.filter((item) => item.set === set.title);

  return (
    <section
      className={cn(
        "rounded-md border bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]",
        active ? "border-[color:var(--clinical-accent-border)]" : "border-[color:var(--border)]",
      )}
    >
      <div className="grid min-h-[8rem] gap-3 border-b border-[color:var(--border)] p-4">
        <div className="flex items-start justify-between gap-3">
          <IconTile icon={set.icon} quiet={!active} />
          <span className="nums rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-xs font-bold text-[color:var(--text-muted)]">
            {set.count}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">{set.title}</h2>
          <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">{set.description}</p>
        </div>
      </div>
      <div className="grid gap-3 p-3">
        {setItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "grid min-h-[6.75rem] content-between rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)] hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)]",
                focusRing,
              )}
            >
              <span className="flex items-start gap-3">
                <Icon className="mt-1 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">
                    {item.title}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-[color:var(--text-muted)]">
                    {item.description}
                  </span>
                </span>
              </span>
              <span className="mt-3 flex items-center justify-between gap-3">
                <StatusPill status={item.status} />
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--clinical-accent)]">
                  {item.action}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="border-t border-[color:var(--border)] p-3">
        <ActionLink href="/favourites">{set.nextAction}</ActionLink>
      </div>
    </section>
  );
}

function SetBoardMockup() {
  return (
    <>
      <MockupHeader variant="set-board">
        <div className="w-full lg:w-[30rem]">
          <SearchControl placeholder="Search saved sets or material" />
        </div>
      </MockupHeader>
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <section className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <GhostButton pressed>
              <FolderKanban className="h-4 w-4" aria-hidden="true" />
              Sets
            </GhostButton>
            <GhostButton>
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Due today
            </GhostButton>
            <GhostButton>
              <Pin className="h-4 w-4" aria-hidden="true" />
              Pinned
            </GhostButton>
            <GhostButton>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New set
            </GhostButton>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {favouriteSets.map((set, index) => (
              <SetBoardColumn key={set.id} set={set} active={index === 0} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)] sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[color:var(--border)] pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Recent saved items</h2>
                <p className="mt-1 text-sm font-medium text-[color:var(--text-muted)]">
                  Items still remain directly accessible outside set browsing.
                </p>
              </div>
              <GhostButton>
                <LayoutList className="h-4 w-4" aria-hidden="true" />
                List view
              </GhostButton>
            </div>
            {favouriteItems.slice(0, 4).map((item) => (
              <FavouriteRow key={item.id} item={item} dense />
            ))}
          </section>

          <aside className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]">
            <div className="flex items-center gap-3">
              <IconTile icon={ShieldCheck} />
              <div>
                <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Governance glance</h2>
                <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
                  Saved work shows review state before action.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {[
                { label: "Source-backed", value: "5", icon: BookOpen },
                { label: "Review due", value: "1", icon: Clock3 },
                { label: "Pinned sets", value: "3", icon: Pin },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3"
                  >
                    <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                    <span className="truncate text-sm font-bold text-[color:var(--text-heading)]">{item.label}</span>
                    <span className="nums text-sm font-extrabold text-[color:var(--text-muted)]">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}

function LibraryViewMockup() {
  const selected = favouriteItems[1];
  const kindCount = (kind: FavouriteKind) => favouriteItems.filter((item) => item.kind === kind).length;
  const filters = [
    { label: "All favourites", count: favouriteItems.length, icon: Grid2X2, active: true },
    { label: "Medications", count: kindCount("Medication"), icon: Pill },
    { label: "Documents", count: kindCount("Document"), icon: FileText },
    { label: "Sources", count: kindCount("Source"), icon: Quote },
    { label: "Saved searches", count: kindCount("Saved search"), icon: Search },
  ];

  return (
    <>
      <MockupHeader variant="library-view">
        <FavouritesStats />
      </MockupHeader>
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <SearchControl placeholder="Search title, set, document, or saved query" />
          <div className="flex flex-wrap gap-2">
            <GhostButton pressed>
              <Library className="h-4 w-4" aria-hidden="true" />
              Library
            </GhostButton>
            <GhostButton>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Source state
            </GhostButton>
            <GhostButton>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add
            </GhostButton>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[13rem_minmax(0,1fr)_19rem]">
          <nav
            aria-label="Favourite filters"
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-2 shadow-[var(--shadow-inset)]"
          >
            {filters.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.label}
                  type="button"
                  aria-pressed={Boolean(filter.active)}
                  className={cn(
                    "grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2.5 text-left text-sm font-bold",
                    filter.active
                      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                    focusRing,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="truncate">{filter.label}</span>
                  <span className="nums text-xs">{filter.count}</span>
                </button>
              );
            })}
          </nav>

          <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
            <div className="grid min-h-12 grid-cols-[2.5rem_minmax(0,1fr)_5.75rem_4.75rem] items-center gap-3 border-b border-[color:var(--border)] px-4 text-xs font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)] max-md:hidden">
              <span aria-hidden="true" />
              <span>Saved item</span>
              <span>Set</span>
              <span className="text-right">Action</span>
            </div>
            <div>
              {favouriteItems.map((item) => {
                const Icon = item.icon;
                const isSelected = item.id === selected.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "grid min-h-[4.75rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-4 py-3 last:border-b-0 hover:bg-[color:var(--surface-subtle)] md:grid-cols-[auto_minmax(0,1fr)_5.75rem_4.75rem]",
                      isSelected && "bg-[color:var(--clinical-accent-soft)]",
                      focusRing,
                    )}
                  >
                    <IconTile icon={Icon} quiet={!isSelected} />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-sm font-extrabold",
                          isSelected ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-heading)]",
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="mt-1 block truncate text-xs font-semibold text-[color:var(--text-muted)]">
                        {item.description}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-2 md:hidden">
                        <KindPill kind={item.kind} />
                        <StatusPill status={item.status} />
                      </span>
                    </span>
                    <span className="hidden truncate text-xs font-bold text-[color:var(--text-muted)] md:block">
                      {item.set}
                    </span>
                    <span className="inline-flex items-center justify-end gap-1.5 text-xs font-bold text-[color:var(--clinical-accent)]">
                      {item.action}
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <aside className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]">
            <div className="flex items-start gap-3">
              <IconTile icon={selected.icon} />
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold leading-6 text-[color:var(--text-heading)]">{selected.title}</h2>
                <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                  {selected.description}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <div className="flex flex-wrap gap-2">
                <KindPill kind={selected.kind} />
                <StatusPill status={selected.status} />
              </div>
              {[
                ["Set", selected.set],
                ["Source", selected.sourceMeta],
                ["Last used", selected.lastUsed],
                ["Next action", selected.action],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] py-2 text-sm last:border-b-0"
                >
                  <span className="font-bold text-[color:var(--text-soft)]">{label}</span>
                  <span className="font-semibold text-[color:var(--text-heading)]">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              <ActionLink href={selected.href}>{selected.action}</ActionLink>
              <GhostButton>
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Add note
              </GhostButton>
              <GhostButton>
                <Star className="h-4 w-4" aria-hidden="true" />
                Keep pinned
              </GhostButton>
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}

export function FavouritesPageMockupPage({ variant }: { variant: FavouritesPageMockupVariant }) {
  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {variant === "command-desk" ? <CommandDeskMockup /> : null}
      {variant === "set-board" ? <SetBoardMockup /> : null}
      {variant === "library-view" ? <LibraryViewMockup /> : null}
    </div>
  );
}
