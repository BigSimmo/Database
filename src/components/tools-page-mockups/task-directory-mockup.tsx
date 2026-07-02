"use client";

// Self-contained "Concept 4 — Task directory" hybrid mockup: Concept 2's task
// grouping rendered with Concept 3's row density. Kept in its own file so it adds
// the concept without touching the other concepts' shared component file.

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Clock3,
  Filter,
  HeartPulse,
  Search,
  Settings2,
  Star,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

import { statusLabels, statusStyles, tools, type ToolArea, type ToolFixture, type ToolStatus } from "./tool-fixtures";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

type FilterId = "all" | "clinical" | "admin" | "review_due";

// Derived from `area` so the Clinical / Admin filters map to real tool data.
const categoryByArea: Record<ToolArea, "clinical" | "admin"> = {
  reference: "clinical",
  assessment: "clinical",
  care: "clinical",
  coordination: "admin",
  personal: "admin",
};

const predicates: Record<FilterId, (tool: ToolFixture) => boolean> = {
  all: () => true,
  clinical: (tool) => categoryByArea[tool.area] === "clinical",
  admin: (tool) => categoryByArea[tool.area] === "admin",
  review_due: (tool) => tool.status === "review_due",
};

const groups: { area: ToolArea; title: string; icon: LucideIcon }[] = [
  { area: "assessment", title: "Assess", icon: Stethoscope },
  { area: "reference", title: "Reference", icon: BookOpen },
  { area: "care", title: "Treat", icon: HeartPulse },
  { area: "coordination", title: "Coordinate", icon: ClipboardList },
  { area: "personal", title: "Resume", icon: Star },
];

const chips: { id: FilterId; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All", icon: Filter },
  { id: "clinical", label: "Clinical", icon: Stethoscope },
  { id: "admin", label: "Admin", icon: Settings2 },
  { id: "review_due", label: "Review due", icon: Clock3 },
];

function matchesQuery(tool: ToolFixture, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [tool.title, tool.description, tool.secondary].some((field) => field.toLowerCase().includes(needle));
}

function StatusPill({ status }: { status: ToolStatus }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center rounded-md border px-2 text-2xs font-bold",
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function SearchControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className={cn(
        "grid min-h-[3.25rem] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2 shadow-[var(--shadow-tight)]",
        "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]",
      )}
    >
      <Search className="ml-2 h-5 w-5 text-[color:var(--text-soft)]" aria-hidden="true" />
      <label htmlFor="task-directory-search" className="sr-only">
        Search tools by clinical job or source
      </label>
      <input
        id="task-directory-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search tools by clinical job or source"
        data-testid="tools-search-input"
        className="min-w-0 border-0 bg-transparent text-sm font-semibold text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
      />
      <button
        type="submit"
        aria-label="Search tools"
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]",
          focusRing,
        )}
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}

function FilterChip({
  active,
  onClick,
  icon: Icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold shadow-[var(--shadow-inset)]",
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)]",
        focusRing,
      )}
    >
      <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
      {children}
      {typeof count === "number" ? <span className="nums text-xs opacity-80">{count}</span> : null}
    </button>
  );
}

function ToolRow({ tool }: { tool: ToolFixture }) {
  const Icon = tool.icon;
  return (
    <Link
      href={tool.href}
      aria-label={`Open ${tool.title}`}
      data-testid={`tool-row-${tool.id}`}
      className={cn(
        "grid min-h-[4.75rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[color:var(--border)] px-3 py-3 transition first:border-t-0 hover:bg-[color:var(--surface-subtle)]",
        focusRing,
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-extrabold text-[color:var(--text-heading)]">
            {tool.title}
          </h3>
          <StatusPill status={tool.status} />
        </div>
        <p className="mt-1 line-clamp-1 text-sm font-medium text-[color:var(--text-muted)]">{tool.description}</p>
        <p className="mt-1 truncate text-xs font-bold text-[color:var(--text-soft)]">{tool.secondary}</p>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <span className="nums w-28 text-right text-xs font-bold text-[color:var(--text-muted)]">{tool.lastUsed}</span>
        <span className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
          {tool.primaryAction}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <span className="grid h-10 w-10 place-items-center rounded-md text-[color:var(--clinical-accent)] sm:hidden">
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div
      data-testid="tools-empty-state"
      className="grid place-items-center gap-2 rounded-md border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] p-8 text-center"
    >
      <p className="text-sm font-extrabold text-[color:var(--text-heading)]">No tools match your search</p>
      <p className="max-w-sm text-sm font-medium text-[color:var(--text-muted)]">
        Try a different term, or clear the filters to see every tool.
      </p>
      <button
        type="button"
        onClick={onReset}
        className={cn(
          "mt-1 inline-flex min-h-11 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)] hover:border-[color:var(--clinical-accent-border)]",
          focusRing,
        )}
      >
        Clear filters
      </button>
    </div>
  );
}

export function ToolsTaskDirectoryMockup() {
  const [query, setQuery] = useState("");
  const [filterId, setFilterId] = useState<FilterId>("all");

  const filtered = useMemo(
    () => tools.filter((tool) => predicates[filterId](tool) && matchesQuery(tool, query)),
    [filterId, query],
  );
  const counts = useMemo(() => {
    const count = (id: FilterId) => tools.filter(predicates[id]).length;
    return { all: count("all"), clinical: count("clinical"), admin: count("admin"), review_due: count("review_due") };
  }, []);

  const reset = () => {
    setQuery("");
    setFilterId("all");
  };
  const toggle = (id: FilterId) => setFilterId((current) => (current === id && id !== "all" ? "all" : id));

  const visibleGroups = groups
    .map((group) => ({ ...group, items: filtered.filter((tool) => tool.area === group.area) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-extrabold text-[color:var(--clinical-accent)]">
              Concept 4
            </span>
            <span className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 text-xs font-bold text-[color:var(--text-muted)]">
              Recommended build direction
            </span>
          </div>
          <h1 className="mt-3 text-balance text-3xl font-extrabold leading-tight text-[color:var(--text-heading)] sm:text-4xl">
            Task directory
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Grouped by clinical job and listed for scale — Concept 2&apos;s task grouping with Concept 3&apos;s row
            density.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <SearchControl value={query} onChange={setQuery} />
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <FilterChip
              key={chip.id}
              active={filterId === chip.id}
              onClick={() => toggle(chip.id)}
              icon={chip.icon}
              count={chip.id === "all" ? undefined : counts[chip.id]}
            >
              {chip.label}
            </FilterChip>
          ))}
        </div>
        <span
          data-testid="tools-visible-count"
          aria-live="polite"
          className="nums block text-xs font-bold text-[color:var(--text-muted)]"
        >
          Showing {filtered.length} of {tools.length} tools
        </span>

        {visibleGroups.length === 0 ? (
          <EmptyState onReset={reset} />
        ) : (
          visibleGroups.map((group) => {
            const Icon = group.icon;
            return (
              <section
                key={group.area}
                className="overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]"
              >
                <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[color:var(--border)] px-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">{group.title}</h2>
                  </div>
                  <span className="nums text-xs font-bold text-[color:var(--text-muted)]">{group.items.length}</span>
                </div>
                {group.items.map((tool) => (
                  <ToolRow key={tool.id} tool={tool} />
                ))}
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
