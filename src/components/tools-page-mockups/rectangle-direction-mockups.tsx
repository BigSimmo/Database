"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  HeartPulse,
  Pill,
  Pin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";
import { appModeIcons } from "@/lib/app-mode-icons";

import { areaLabels, pinnedToolIds, toolById, tools, type ToolFixture } from "./tool-fixtures";
import { useToolFilter, type ToolFilterId } from "./use-tool-filter";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function IconTile({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-md border shadow-[var(--shadow-inset)]",
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder = "Search tools by clinical job, source, or workflow",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="grid min-h-[3.25rem] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2 shadow-[var(--shadow-tight)]"
    >
      <Search className="ml-2 h-5 w-5 text-[color:var(--text-soft)]" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search tools"
        className="min-w-0 bg-transparent text-sm font-semibold text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Search tools"
        className={cn(
          "grid h-10 w-10 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]",
          focusRing,
        )}
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}

function CompactHeader({
  title,
  body,
  query,
  onQueryChange,
  children,
}: {
  title: string;
  body: string;
  query: string;
  onQueryChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold leading-tight tracking-normal text-[color:var(--text-heading)]">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
              {body}
            </p>
          </div>
          {children}
        </div>
        <SearchBar value={query} onChange={onQueryChange} />
      </div>
    </header>
  );
}

function ActionPill({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function RectangleToolCard({
  tool,
  featured = false,
  dense = false,
}: {
  tool: ToolFixture;
  featured?: boolean;
  dense?: boolean;
}) {
  return (
    <Link
      href={tool.href}
      aria-label={`Open ${tool.title}`}
      className={cn(
        "group grid min-w-0 gap-3 rounded-md border bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] transition hover:-translate-y-0.5 hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)] hover:shadow-[var(--shadow-soft)]",
        featured
          ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent)]/25"
          : "border-[color:var(--border)]",
        dense ? "min-h-[6.75rem]" : "min-h-[8.25rem]",
        dense ? "lg:min-h-[8.75rem]" : "lg:min-h-[9.5rem]",
        focusRing,
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <IconTile icon={tool.icon} active={featured} />
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">
            {tool.title}
          </h3>
          <p className="mt-1 line-clamp-3 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
            {tool.description}
          </p>
        </div>
        <ActionPill label={tool.primaryAction} />
      </div>
      <div className="grid gap-2 border-t border-[color:var(--border)] pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <p className="line-clamp-2 text-xs font-bold leading-4 text-[color:var(--text-soft)]">{tool.secondary}</p>
        <span className="inline-flex w-fit min-h-6 items-center gap-1 rounded-md bg-[color:var(--surface-subtle)] px-2 text-2xs font-bold text-[color:var(--text-muted)]">
          {featured ? <Sparkles className="h-3 w-3 text-[color:var(--clinical-accent)]" aria-hidden="true" /> : null}
          {featured ? "Suggested" : areaLabels[tool.area]}
        </span>
      </div>
    </Link>
  );
}

function SavedWorkPanel() {
  const saved = [
    { title: "Lithium monitoring plan", tool: "Documents", icon: FileText },
    { title: "Medication review draft", tool: "Medication", icon: Pill },
    { title: "13YARN referral pathway", tool: "Services", icon: appModeIcons.services },
  ];

  return (
    <aside className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] xl:sticky xl:top-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Saved work</h2>
        <Link href="/favourites" className={cn("text-xs font-bold text-[color:var(--clinical-accent)]", focusRing)}>
          View all
        </Link>
      </div>
      <div className="mt-3 divide-y divide-[color:var(--border)] rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]">
        {saved.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href="/favourites"
              className={cn(
                "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 hover:bg-[color:var(--surface-subtle)]",
                focusRing,
              )}
            >
              <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">{item.title}</span>
                <span className="block truncate text-xs font-semibold text-[color:var(--text-soft)]">{item.tool}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

function QuickStartPanel() {
  const quickStarts = [
    { label: "Ask a question", href: "/?mode=answer", icon: Search },
    { label: "Compare differentials", href: "/differentials", icon: Stethoscope },
    { label: "Prepare prescribing", href: "/?mode=prescribing", icon: Pill },
  ];

  return (
    <div className="hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 lg:block">
      <div className="grid gap-2">
        {quickStarts.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "grid min-h-10 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 text-sm font-bold text-[color:var(--text-heading)] hover:bg-[color:var(--surface)]",
                focusRing,
              )}
            >
              <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
              <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function PhonePreview({ toolIds, title }: { toolIds: string[]; title: string }) {
  const phoneTools = toolIds.map(toolById);

  return (
    <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Phone</p>
          <h2 className="mt-1 text-base font-extrabold text-[color:var(--text-heading)]">{title}</h2>
        </div>
        <span className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 text-xs font-bold text-[color:var(--clinical-accent)]">
          390px
        </span>
      </div>
      <div className="mx-auto mt-4 max-w-[19rem] rounded-[2rem] border border-[color:var(--border-strong)] bg-[color:var(--surface-chrome)] p-2 shadow-[var(--shadow-lux)]">
        <div className="overflow-hidden rounded-[1.45rem] border border-[color:var(--border)] bg-[color:var(--background)]">
          <div className="flex min-h-11 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3">
            <span className="text-sm font-extrabold text-[color:var(--text-heading)]">Tools</span>
            <Search className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
          </div>
          <div className="grid gap-2 p-3">
            <div className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2">
              <Search className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
              <span className="truncate text-xs font-bold text-[color:var(--text-soft)]">Search clinical tools</span>
              <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
            </div>
            {phoneTools.map((tool, index) => (
              <Link
                key={tool.id}
                href={tool.href}
                className={cn(
                  "grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border bg-[color:var(--surface)] px-2.5 py-2 shadow-[var(--shadow-inset)]",
                  index === 0 ? "border-[color:var(--clinical-accent-border)]" : "border-[color:var(--border)]",
                  focusRing,
                )}
              >
                <IconTile icon={tool.icon} active={index === 0} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-extrabold text-[color:var(--text-heading)]">
                    {tool.title}
                  </span>
                  <span className="mt-1 block truncate text-2xs font-semibold text-[color:var(--text-soft)]">
                    {tool.primaryAction}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const workflowGroups = [
  {
    id: "assess",
    title: "Assess",
    body: "Start or refine a clinical view before acting.",
    icon: Stethoscope,
    toolIds: ["differentials", "clinical-kb-search"],
  },
  {
    id: "reference",
    title: "Reference",
    body: "Find the source, page, table, or answer.",
    icon: BookOpen,
    toolIds: ["documents", "clinical-kb-search"],
  },
  {
    id: "treat",
    title: "Treat",
    body: "Move from evidence to prescribing support.",
    icon: HeartPulse,
    toolIds: ["medication-prescribing", "documents"],
  },
  {
    id: "coordinate",
    title: "Coordinate",
    body: "Connect the next referral, service, or form.",
    icon: ClipboardList,
    toolIds: ["services", "forms"],
  },
];

function WorkflowLane({ group }: { group: (typeof workflowGroups)[number] }) {
  const Icon = group.icon;

  return (
    <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)] sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
        <IconTile icon={Icon} active />
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">{group.title}</h2>
          <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">{group.body}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {group.toolIds.map((id, index) => (
          <RectangleToolCard key={id} tool={toolById(id)} featured={index === 0} dense />
        ))}
      </div>
    </section>
  );
}

export function ToolsClinicalLanesMockup() {
  const filter = useToolFilter(tools);

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <CompactHeader
        title="Tools"
        body="Choose the tool by the clinical job you are doing."
        query={filter.query}
        onQueryChange={filter.setQuery}
      >
        <QuickStartPanel />
      </CompactHeader>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="grid gap-4">
            {workflowGroups.map((group) => (
              <WorkflowLane key={group.id} group={group} />
            ))}
          </div>
          <div className="grid content-start gap-4">
            <SavedWorkPanel />
            <PhonePreview
              title="Lane layout"
              toolIds={["differentials", "clinical-kb-search", "documents", "services"]}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

const workbenchFilters: { id: ToolFilterId; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All", icon: CheckCircle2 },
  { id: "clinical", label: "Clinical", icon: Stethoscope },
  { id: "admin", label: "Workflow", icon: ClipboardList },
  { id: "pinned", label: "Pinned", icon: Pin },
];

function FilterBar({ filterId, onToggle }: { filterId: ToolFilterId; onToggle: (filterId: ToolFilterId) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {workbenchFilters.map((item) => {
        const Icon = item.icon;
        const active = filterId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(item.id)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-bold",
              active
                ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
              focusRing,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ContinueStrip() {
  return (
    <section className="grid gap-3 rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <IconTile icon={Clock3} active />
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Continue medication review</h2>
        <p className="mt-1 truncate text-sm font-medium text-[color:var(--text-muted)]">
          Medication Prescribing · Monitoring plan review · May 12, 2025
        </p>
      </div>
      <Link
        href="/?mode=prescribing"
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-sm font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]",
          focusRing,
        )}
      >
        Resume
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function ToolsActionWorkbenchMockup() {
  const filter = useToolFilter(tools);
  const visibleTools = filter.filtered.length ? filter.filtered : tools;

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <CompactHeader
        title="Tools"
        body="Open the workspace that matches what you need to do now."
        query={filter.query}
        onQueryChange={filter.setQuery}
      >
        <Link
          href="/favourites"
          className={cn(
            "hidden min-h-11 items-center justify-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)] shadow-[var(--shadow-inset)] hover:border-[color:var(--clinical-accent-border)] lg:inline-flex",
            focusRing,
          )}
        >
          <Star className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
          Saved work
        </Link>
      </CompactHeader>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8">
        <FilterBar filterId={filter.filterId} onToggle={filter.toggleFilter} />
        <ContinueStrip />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="grid content-start gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Tool workbench</h2>
              <p className="mt-1 text-sm font-medium text-[color:var(--text-muted)]">
                Start with a focused task, source lookup, referral, form, or prescribing workflow.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {visibleTools.map((tool) => (
                <RectangleToolCard key={tool.id} tool={tool} featured={pinnedToolIds.some((id) => id === tool.id)} />
              ))}
            </div>
          </div>

          <div className="grid content-start gap-4">
            <section className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Useful shortcuts</h2>
              </div>
              <div className="mt-3 grid gap-2">
                {[
                  ["Ask a clinical question", "/?mode=answer"],
                  ["Find a source document", "/?mode=documents"],
                  ["Compare differentials", "/differentials"],
                  ["Prepare a prescription", "/?mode=prescribing"],
                ].map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className={cn(
                      "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)]",
                      focusRing,
                    )}
                  >
                    <span className="truncate">{label}</span>
                    <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
            <PhonePreview
              title="Workbench layout"
              toolIds={["clinical-kb-search", "documents", "medication-prescribing", "favourites"]}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
