"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/components/ui-primitives";

import { areaLabels, statusLabels, tools, type ToolFixture } from "./tool-fixtures";

type RefinedVariant = "clinical-brief" | "safety-deck" | "compact-sheet";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const variantCopy: Record<
  RefinedVariant,
  {
    title: string;
    body: string;
    defaultToolId: string;
    accent: string;
    detailTitle: string;
    phoneTitle: string;
  }
> = {
  "clinical-brief": {
    title: "Tools clinical brief",
    body: "Select a clinical tool, scan the important context, then open the workspace when it is the right fit.",
    defaultToolId: "clinical-kb-search",
    accent: "Current task",
    detailTitle: "Clinical brief",
    phoneTitle: "Mobile brief",
  },
  "safety-deck": {
    title: "Tools safety deck",
    body: "Put source confidence, review status, and clinical use cases directly beside the tool list.",
    defaultToolId: "medication-prescribing",
    accent: "Safety first",
    detailTitle: "Use safely",
    phoneTitle: "Mobile safety sheet",
  },
  "compact-sheet": {
    title: "Tools compact sheet",
    body: "A lean split-pane directory with the mobile popup as the main decision surface.",
    defaultToolId: "services",
    accent: "Fast path",
    detailTitle: "Tool sheet",
    phoneTitle: "Mobile action sheet",
  },
};

const clinicalNotes: Record<
  string,
  {
    when: string[];
    checks: string[];
    outputs: string[];
  }
> = {
  "clinical-kb-search": {
    when: ["Point-of-care clinical question", "Need cited source context", "Clarify guideline or policy wording"],
    checks: ["Source-backed answer", "Citation trail", "Escalate if evidence is thin"],
    outputs: ["Referenced answer", "Source snippets", "Follow-up search"],
  },
  documents: {
    when: [
      "Find a policy, table, image, or PDF page",
      "Check local guideline wording",
      "Open supporting source material",
    ],
    checks: ["Document provenance", "Page and chunk context", "Index health"],
    outputs: ["Source document", "Relevant page", "Reusable source link"],
  },
  differentials: {
    when: ["Compare diagnostic possibilities", "Structure uncertainty", "Review risk and presentation fit"],
    checks: ["Red flags", "Supporting and opposing features", "Next-step questions"],
    outputs: ["Differential set", "Comparison table", "Clinical prompts"],
  },
  "medication-prescribing": {
    when: ["Review medication context", "Check monitoring or interactions", "Prepare prescribing support"],
    checks: ["Contraindications", "Monitoring requirements", "Interaction cautions"],
    outputs: ["Prescribing context", "Monitoring plan", "Caution list"],
  },
  services: {
    when: ["Find referral route", "Check eligibility", "Confirm service contact or pathway"],
    checks: ["Catchment", "Referral criteria", "Source-backed contact details"],
    outputs: ["Referral pathway", "Eligibility notes", "Service record"],
  },
  forms: {
    when: ["Find a clinical form", "Check readiness tasks", "Complete pathway paperwork"],
    checks: ["Form currency", "Required fields", "Linked service pathway"],
    outputs: ["Form link", "Completion checklist", "Readiness note"],
  },
  favourites: {
    when: ["Resume saved clinical work", "Return to repeated workflows", "Open pinned sources"],
    checks: ["Saved context", "Last-used status", "Review due markers"],
    outputs: ["Saved item", "Pinned source", "Recent workflow"],
  },
};

function IconBox({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-md border",
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function StatusBadge({ tool }: { tool: ToolFixture }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 text-2xs font-extrabold text-[color:var(--text-muted)]">
      {statusLabels[tool.status]}
    </span>
  );
}

function SourceBadge({ tool }: { tool: ToolFixture }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-md border px-2 text-2xs font-extrabold",
        tool.sourceBacked
          ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
      )}
    >
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      {tool.sourceBacked ? "Source" : "Saved"}
    </span>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 shadow-[var(--shadow-inset)]"
    >
      <Search className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
      <input
        value={value}
        type="search"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search tools"
        aria-label="Search tools"
        className="min-w-0 bg-transparent text-sm font-semibold text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none"
      />
    </form>
  );
}

function ToolList({
  selectedId,
  onSelect,
  query,
  onQueryChange,
  variant,
}: {
  selectedId: string;
  onSelect: (tool: ToolFixture) => void;
  query: string;
  onQueryChange: (value: string) => void;
  variant: RefinedVariant;
}) {
  const visibleTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tools;
    return tools.filter((tool) =>
      [tool.title, tool.description, tool.secondary, areaLabels[tool.area]]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  return (
    <aside className="grid min-h-0 content-start gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
      <SearchBar value={query} onChange={onQueryChange} />
      <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-bold [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {["All", "Assess", "Reference", "Treat", "Coordinate"].map((label) => (
          <span
            key={label}
            className="inline-flex min-h-8 shrink-0 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-[color:var(--text-muted)]"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid gap-2">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;
          const active = selectedId === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(tool)}
              className={cn(
                "grid min-h-[5.25rem] grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border p-3 text-left transition",
                active
                  ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] shadow-[var(--shadow-tight)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)]",
                variant === "compact-sheet" && "min-h-[4.5rem]",
                focusRing,
              )}
            >
              <IconBox icon={Icon} active={active} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold text-[color:var(--text-heading)]">
                  {tool.title}
                </span>
                <span className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-[color:var(--text-muted)]">
                  {tool.description}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge tool={tool} />
                  <SourceBadge tool={tool} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function ClinicalChecklist({ tool, variant }: { tool: ToolFixture; variant: RefinedVariant }) {
  const notes = clinicalNotes[tool.id] ?? clinicalNotes["clinical-kb-search"];
  const iconMap: Record<keyof typeof notes, LucideIcon> = {
    checks: ShieldCheck,
    outputs: ClipboardList,
    when: Stethoscope,
  };
  const labels: Record<keyof typeof notes, string> = {
    checks: variant === "safety-deck" ? "Safety checks" : "Check before opening",
    outputs: "What you get",
    when: "Use when",
  };

  return (
    <div className="grid gap-3">
      {(["when", "checks", "outputs"] as const).map((key) => {
        const Icon = iconMap[key];
        return (
          <section
            key={key}
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">{labels[key]}</h3>
            </div>
            <ul className="mt-3 grid gap-2">
              {notes[key].map((item) => (
                <li
                  key={item}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-xs font-semibold leading-4 text-[color:var(--text-muted)]"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function DetailPanel({ tool, variant }: { tool: ToolFixture; variant: RefinedVariant }) {
  const copy = variantCopy[variant];
  const Icon = tool.icon;

  return (
    <section className="grid min-w-0 content-start gap-4 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
          <IconBox icon={Icon} active />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-7 items-center rounded-md bg-[color:var(--clinical-accent)] px-2 text-2xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent-contrast)]">
                {copy.detailTitle}
              </span>
              <StatusBadge tool={tool} />
              <SourceBadge tool={tool} />
            </div>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight text-[color:var(--text-heading)]">
              {tool.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
              {tool.description}
            </p>
          </div>
        </div>
        <Link
          href={tool.href}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]",
            focusRing,
          )}
        >
          {tool.primaryAction}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <ClinicalChecklist tool={tool} variant={variant} />

      <section className="grid gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">Clinical handling</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
            Keep source context visible, confirm recency, and move into the tool only when the task matches the clinical
            intent.
          </p>
        </div>
        <div className="grid gap-2">
          {["Source context visible", "Review status shown", "Mobile action mirrors desktop"].map((item) => (
            <span
              key={item}
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-xs font-bold text-[color:var(--text-muted)]"
            >
              <CheckCircle2 className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
      </section>
    </section>
  );
}

function PhonePopup({
  tool,
  variant,
  open,
  onOpen,
  onClose,
  onSelectTool,
}: {
  tool: ToolFixture;
  variant: RefinedVariant;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelectTool: (tool: ToolFixture) => void;
}) {
  const copy = variantCopy[variant];
  const Icon = tool.icon;
  const notes = clinicalNotes[tool.id] ?? clinicalNotes["clinical-kb-search"];

  return (
    <aside className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] xl:sticky xl:top-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Phone</p>
          <h2 className="mt-1 text-base font-extrabold text-[color:var(--text-heading)]">{copy.phoneTitle}</h2>
        </div>
        <span className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 text-xs font-bold text-[color:var(--clinical-accent)]">
          390px
        </span>
      </div>

      <div className="mx-auto mt-4 max-w-[19rem] rounded-[2rem] border border-[color:var(--border-strong)] bg-[color:var(--surface-chrome)] p-2 shadow-[var(--shadow-lux)]">
        <div className="relative min-h-[34rem] overflow-hidden rounded-[1.45rem] border border-[color:var(--border)] bg-[color:var(--background)]">
          <div className="flex min-h-11 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3">
            <Menu className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" />
            <span className="text-sm font-extrabold text-[color:var(--text-heading)]">Tools</span>
            <Search className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
          </div>
          <div className="grid gap-2 p-3">
            {tools.slice(0, 5).map((item) => {
              const ItemIcon = item.icon;
              const active = item.id === tool.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTool(item)}
                  className={cn(
                    "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border bg-[color:var(--surface)] px-2 text-left shadow-[var(--shadow-inset)]",
                    active ? "border-[color:var(--clinical-accent-border)]" : "border-[color:var(--border)]",
                    focusRing,
                  )}
                >
                  <IconBox icon={ItemIcon} active={active} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-extrabold text-[color:var(--text-heading)]">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-2xs font-semibold text-[color:var(--text-soft)]">
                      {item.primaryAction}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div
            className={cn(
              "absolute inset-x-2 bottom-2 rounded-[1rem] border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-lux)] transition-transform",
              open ? "translate-y-0" : "translate-y-[calc(100%-4.25rem)]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <IconBox icon={Icon} active />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-[color:var(--text-heading)]">
                    {tool.title}
                  </span>
                  <span className="mt-1 block truncate text-xs font-semibold text-[color:var(--text-muted)]">
                    {copy.accent}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={open ? onClose : onOpen}
                aria-label={open ? "Close mobile tool preview" : "Open mobile tool preview"}
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
                  focusRing,
                )}
              >
                {open ? (
                  <X className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ArrowRight className="h-4 w-4 -rotate-90" aria-hidden="true" />
                )}
              </button>
            </div>

            {open ? (
              <div className="mt-3 grid gap-3">
                <p className="text-xs font-semibold leading-5 text-[color:var(--text-muted)]">{tool.description}</p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tool={tool} />
                  <SourceBadge tool={tool} />
                </div>
                <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2">
                  <p className="text-3xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                    Use when
                  </p>
                  <p className="mt-1 text-xs font-bold leading-4 text-[color:var(--text-heading)]">{notes.when[0]}</p>
                </div>
                <Link
                  href={tool.href}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]",
                    focusRing,
                  )}
                >
                  {tool.primaryAction}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileViewportSheet({
  tool,
  variant,
  open,
  onClose,
}: {
  tool: ToolFixture;
  variant: RefinedVariant;
  open: boolean;
  onClose: () => void;
}) {
  const copy = variantCopy[variant];
  const Icon = tool.icon;
  const notes = clinicalNotes[tool.id] ?? clinicalNotes["clinical-kb-search"];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 xl:hidden" role="presentation">
      <button
        type="button"
        aria-label="Close tool preview"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/25"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-tool-sheet-title"
        className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[1.25rem] border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-lux)]"
      >
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-[color:var(--border-strong)]" />
        <div className="grid gap-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
            <IconBox icon={Icon} active />
            <div className="min-w-0">
              <p className="text-2xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                {copy.phoneTitle}
              </p>
              <h2 id="mobile-tool-sheet-title" className="mt-1 text-xl font-extrabold text-[color:var(--text-heading)]">
                {tool.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tool preview"
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
                focusRing,
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">{tool.description}</p>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tool={tool} />
            <SourceBadge tool={tool} />
          </div>

          <div className="grid gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">Use when</h3>
            </div>
            <ul className="grid gap-2">
              {notes.when.slice(0, 2).map((item) => (
                <li
                  key={item}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-xs font-semibold leading-4 text-[color:var(--text-muted)]"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">Check first</h3>
            </div>
            <p className="text-xs font-semibold leading-5 text-[color:var(--text-muted)]">{notes.checks.join(", ")}</p>
          </div>

          <Link
            href={tool.href}
            className={cn(
              "inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]",
              focusRing,
            )}
          >
            {tool.primaryAction}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export function ToolsSplitPaneRefinedMockup({ variant }: { variant: RefinedVariant }) {
  const copy = variantCopy[variant];
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(copy.defaultToolId);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const selectedTool = tools.find((tool) => tool.id === selectedId) ?? tools[0];

  function selectTool(tool: ToolFixture) {
    setSelectedId(tool.id);
    setPhoneOpen(true);
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-7 items-center rounded-md bg-[color:var(--clinical-accent)] px-2 text-xs font-extrabold text-[color:var(--clinical-accent-contrast)]">
                  Concept 3
                </span>
                <span className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 text-xs font-bold text-[color:var(--text-muted)]">
                  <Sparkles className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                  {copy.accent}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight text-[color:var(--text-heading)]">
                {copy.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
                {copy.body}
              </p>
            </div>
            <div className="grid min-w-[17rem] gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[color:var(--text-heading)]">
                <Clock3 className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                Continue medication review
              </div>
              <p className="truncate text-xs font-semibold text-[color:var(--text-muted)]">
                Monitoring plan review · May 12, 2025
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-28 text-[color:var(--text)] sm:px-6 lg:px-8 xl:grid-cols-[18rem_minmax(0,1fr)_21rem]">
        <ToolList
          selectedId={selectedTool.id}
          onSelect={selectTool}
          query={query}
          onQueryChange={setQuery}
          variant={variant}
        />
        <DetailPanel tool={selectedTool} variant={variant} />
        <PhonePopup
          tool={selectedTool}
          variant={variant}
          open={phoneOpen}
          onOpen={() => setPhoneOpen(true)}
          onClose={() => setPhoneOpen(false)}
          onSelectTool={selectTool}
        />
      </main>
      <MobileViewportSheet tool={selectedTool} variant={variant} open={phoneOpen} onClose={() => setPhoneOpen(false)} />
    </div>
  );
}
