"use client";

import { useId, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  ClipboardList,
  FileText,
  Grid2X2,
  Menu,
  MessageSquare,
  Search,
  Sparkles,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";

/**
 * Design scratch for the phone Category filter used on Tools (and shared via
 * `MobileResultFilterControl`). The shipped control wraps a native `<select>`;
 * on mobile that paints a harsh system-blue selection/focus rectangle over the
 * value text that fights the rest of the Clinical White surface.
 *
 * Every direction below replaces the native select with a custom control so
 * focus and selection stay inside the design-token system. Mockups 404 in
 * production and sit outside wiring/reachability gates; controls are still
 * interactive so a direction can be judged while using it.
 */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

type CategoryId = "all" | "assessment" | "reference" | "care" | "coordination" | "saved";

const CATEGORIES: ReadonlyArray<{ id: CategoryId; label: string; short: string }> = [
  { id: "all", label: "All tools", short: "All" },
  { id: "assessment", label: "Assess", short: "Assess" },
  { id: "reference", label: "Evidence", short: "Evidence" },
  { id: "care", label: "Treat", short: "Treat" },
  { id: "coordination", label: "Coordinate", short: "Coord." },
  { id: "saved", label: "Saved", short: "Saved" },
];

const TOOL_ROWS = [
  {
    title: "Clinical KB Search",
    body: "Ask a clinical question with cited sources.",
    icon: Search,
  },
  {
    title: "Differentials",
    body: "Compare likely diagnoses side by side.",
    icon: ClipboardList,
  },
  {
    title: "Documents",
    body: "Browse and open indexed guidelines.",
    icon: FileText,
  },
] as const;

function categoryLabel(id: CategoryId) {
  return CATEGORIES.find((item) => item.id === id)?.label ?? "All tools";
}

/* -------------------------------------------------------------------------
   Shared phone chrome — enough context to judge the filter in situ, without
   copying the full Tools page.
   ------------------------------------------------------------------------- */

function PhoneChrome({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] shadow-[var(--shadow-lift)]">
      <header className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-lg text-[color:var(--text-muted)]">
          <Menu className="h-5 w-5" aria-hidden />
        </span>
        <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-bold text-[color:var(--clinical-accent)]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Tools
        </span>
        <span className="grid h-10 w-10 place-items-center rounded-lg text-[color:var(--text-muted)]">
          <MessageSquare className="h-5 w-5" aria-hidden />
        </span>
      </header>
      <div className="bg-[color:var(--surface-subtle)] px-3.5 pb-4 pt-5">{children}</div>
    </div>
  );
}

function ToolsHero() {
  return (
    <div className="mb-4 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Grid2X2 className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="text-2xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)]">Tools</h3>
      <p className="mt-1 text-sm font-medium text-[color:var(--text-muted)]">Assessment, prescribing, workflows.</p>
    </div>
  );
}

function SearchStub() {
  return (
    <div className="mb-4">
      <div className="flex min-h-12 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 shadow-[var(--shadow-inset)]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--surface-inset)] text-[color:var(--text-soft)]">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text-soft)]">
          Search tools…
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
      </div>
      <p className="mt-2 text-center text-2xs font-semibold text-[color:var(--warning)]">
        Do not enter patient identifiable information.
      </p>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { label: "Ask", tone: "text-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]" },
    { label: "Compare", tone: "text-[color:var(--type-service)] bg-[color:var(--type-service-soft)]" },
    { label: "Prescribe", tone: "text-[color:var(--type-document)] bg-[color:var(--type-document-soft)]" },
    { label: "Safety", tone: "text-[color:var(--danger)] bg-[color:var(--danger-soft)]" },
  ] as const;
  return (
    <div className="mb-5 grid grid-cols-4 gap-2" aria-hidden>
      {actions.map((action) => (
        <div
          key={action.label}
          className="grid gap-1.5 justify-items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-1 py-2.5 shadow-[var(--shadow-inset)]"
        >
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg", action.tone)}>
            <span className="h-2.5 w-2.5 rounded-sm bg-current opacity-70" />
          </span>
          <span className="text-2xs font-bold text-[color:var(--text-heading)]">{action.label}</span>
        </div>
      ))}
    </div>
  );
}

function ResultsHeader({ filter }: { filter: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h4 className="text-base font-extrabold text-[color:var(--text-heading)]">All tools</h4>
        <span className="text-2xs font-bold tabular-nums text-[color:var(--text-soft)]">12</span>
      </div>
      {filter}
    </div>
  );
}

function ToolList() {
  return (
    <div className="grid gap-2" aria-hidden>
      {TOOL_ROWS.map((row) => {
        const Icon = row.icon;
        return (
          <div
            key={row.title}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3 shadow-[var(--shadow-inset)]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-[color:var(--text-heading)]">
                {row.title}
              </span>
              <span className="mt-0.5 block truncate text-2xs font-medium text-[color:var(--text-muted)]">
                {row.body}
              </span>
            </span>
            <span className="inline-flex min-h-9 items-center rounded-lg bg-[color:var(--clinical-accent)] px-2.5 text-2xs font-bold text-[color:var(--clinical-accent-contrast)]">
              Details
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PhoneScene({ filter }: { filter: ReactNode }) {
  return (
    <PhoneChrome>
      <ToolsHero />
      <SearchStub />
      <QuickActions />
      <ResultsHeader filter={filter} />
      <ToolList />
    </PhoneChrome>
  );
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="shrink-0">
      <p className="mb-2 flex justify-between gap-4 text-3xs font-bold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        <span>{label}</span>
        <span>390 px</span>
      </p>
      <div className="w-[24.375rem]">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Direction controls
   ------------------------------------------------------------------------- */

/** Baseline: mirrors the shipped native select + focus-within ring. */
function BaselineNativeSelect({
  value,
  onChange,
  showHighlight,
}: {
  value: CategoryId;
  onChange: (next: CategoryId) => void;
  showHighlight?: boolean;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex min-h-tap w-full min-w-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-2.5 pr-7 text-xs font-bold shadow-[var(--shadow-inset)]",
        showHighlight
          ? "outline outline-2 outline-offset-2 outline-[color:var(--focus)]"
          : "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]",
      )}
    >
      <span className="shrink-0 text-[color:var(--text-soft)]">Category</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as CategoryId)}
        aria-label="Filter by tool category"
        className={cn(
          "h-tap min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent text-xs font-semibold text-[color:var(--text)] outline-none [-webkit-appearance:none]",
          showHighlight &&
            "rounded-sm bg-[color:var(--clinical-accent-soft)] ring-2 ring-[color:var(--clinical-accent)] ring-offset-1",
        )}
      >
        {CATEGORIES.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-2 size-icon-sm text-[color:var(--text-soft)]"
        aria-hidden
      />
    </label>
  );
}

/** A — Soft value button + bottom sheet. */
function SoftSheetFilter({ value, onChange }: { value: CategoryId; onChange: (next: CategoryId) => void }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const filtered = value !== "all";

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex min-h-tap w-full items-center gap-2 rounded-xl border px-3 text-left transition",
          focusRing,
          filtered || open
            ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
            : "border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]",
        )}
      >
        <span className="shrink-0 text-2xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
          Category
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-bold",
            filtered || open ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-heading)]",
          )}
        >
          {categoryLabel(value)}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]"
        >
          <div className="border-b border-[color:var(--border)] px-3 py-2.5">
            <p id={titleId} className="text-xs font-extrabold text-[color:var(--text-heading)]">
              Choose a category
            </p>
          </div>
          <div role="listbox" aria-label="Tool categories" className="max-h-64 overflow-y-auto p-1.5">
            {CATEGORIES.map((option) => {
              const active = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-tap w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold transition",
                    focusRing,
                    active
                      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
                  )}
                >
                  {option.label}
                  {active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** B — Horizontal chip rail (desktop language on phone). */
function ChipRailFilter({ value, onChange }: { value: CategoryId; onChange: (next: CategoryId) => void }) {
  return (
    <div
      className="polished-scroll -mx-0.5 flex items-center gap-1.5 overflow-x-auto px-0.5 pb-0.5"
      role="group"
      aria-label="Filter by tool category"
    >
      <span className="sr-only">Category</span>
      {CATEGORIES.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex min-h-tap shrink-0 items-center rounded-full border px-3.5 text-xs font-bold transition",
              focusRing,
              active
                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)]",
            )}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );
}

/** C — Custom listbox trigger (DSM-style), soft focus only. */
function ListboxFilter({ value, onChange }: { value: CategoryId; onChange: (next: CategoryId) => void }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const filtered = value !== "all";

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "grid min-h-tap w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-[color:var(--surface)] px-3 text-left shadow-[var(--shadow-inset)] transition",
          focusRing,
          open || filtered ? "border-[color:var(--clinical-accent-border)]" : "border-[color:var(--border)]",
        )}
      >
        <span className="text-2xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
          Category
        </span>
        <span className="truncate text-sm font-bold text-[color:var(--text-heading)]">{categoryLabel(value)}</span>
        <span
          className={cn(
            "grid h-7 w-7 place-items-center rounded-lg",
            open || filtered
              ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "bg-[color:var(--surface-inset)] text-[color:var(--text-soft)]",
          )}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Tool categories"
          className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-10 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-soft)]"
        >
          {CATEGORIES.map((option) => {
            const active = option.id === value;
            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-tap w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm font-semibold",
                    focusRing,
                    active
                      ? "bg-[color:var(--surface-subtle)] text-[color:var(--clinical-accent)]"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                  )}
                >
                  {option.label}
                  {active ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** D — Primary segments + overflow sheet for the long tail. */
function SegmentOverflowFilter({ value, onChange }: { value: CategoryId; onChange: (next: CategoryId) => void }) {
  const primary = CATEGORIES.filter(
    (item) => item.id === "all" || item.id === "assessment" || item.id === "reference" || item.id === "care",
  );
  const overflow = CATEGORIES.filter((item) => item.id === "coordination" || item.id === "saved");
  const inOverflow = overflow.some((item) => item.id === value);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div
        role="group"
        aria-label="Filter by tool category"
        className="flex min-h-tap overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
      >
        {primary.map((option, index) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className={cn(
                "min-h-tap min-w-0 flex-1 truncate px-1.5 text-2xs font-bold transition sm:text-xs",
                index > 0 && "border-l border-[color:var(--border)]",
                focusRing,
                active
                  ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
              )}
            >
              {option.short}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={inOverflow}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "inline-flex min-h-tap shrink-0 items-center gap-0.5 border-l border-[color:var(--border)] px-2.5 text-2xs font-bold",
            focusRing,
            inOverflow || open
              ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
          )}
        >
          {inOverflow ? categoryLabel(value) : "More"}
          <ChevronDown className={cn("h-3.5 w-3.5", open && "rotate-180")} aria-hidden />
        </button>
      </div>

      {open ? (
        <ul
          role="listbox"
          aria-label="More categories"
          className="absolute right-0 top-[calc(100%+0.4rem)] z-10 min-w-[10rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-soft)]"
        >
          {overflow.map((option) => {
            const active = option.id === value;
            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-tap w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm font-semibold",
                    focusRing,
                    active
                      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                  )}
                >
                  {option.label}
                  {active ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** E — Quiet field with left accent rail; focus is a soft glow, never a blue box on the text. */
function QuietRailFilter({ value, onChange }: { value: CategoryId; onChange: (next: CategoryId) => void }) {
  const [open, setOpen] = useState(false);
  const filtered = value !== "all";

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "relative inline-flex min-h-tap w-full items-center gap-2.5 overflow-hidden rounded-xl border bg-[color:var(--surface)] pl-3.5 pr-3 text-left transition",
          focusRing,
          open
            ? "border-[color:var(--clinical-accent-border)] shadow-[var(--shadow-focus)]"
            : "border-[color:var(--border)] shadow-[var(--shadow-inset)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-2 left-1.5 w-1 rounded-full transition-colors",
            filtered || open ? "bg-[color:var(--clinical-accent)]" : "bg-[color:var(--border-strong)]",
          )}
        />
        <span className="pl-2 text-2xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
          Category
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--text-heading)]">
          {categoryLabel(value)}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Tool categories"
          className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-10 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-soft)]"
        >
          {CATEGORIES.map((option) => {
            const active = option.id === value;
            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-tap w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-semibold",
                    focusRing,
                    active
                      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-2 w-2 rounded-full",
                      active ? "bg-[color:var(--clinical-accent)]" : "bg-[color:var(--border-strong)]",
                    )}
                  />
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Page chrome
   ------------------------------------------------------------------------- */

function Direction({
  name,
  recommended,
  thesis,
  works,
  costs,
  children,
}: {
  name: string;
  recommended?: boolean;
  thesis: string;
  works: string[];
  costs: string[];
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-3xl-minus font-[560] tracking-[-0.03em] text-[color:var(--text-heading)]">{name}</h2>
        {recommended ? (
          <span className="rounded-full border border-[color:var(--clinical-accent)] px-2.5 py-0.5 text-3xs font-[540] uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
            Recommended
          </span>
        ) : null}
      </div>
      <p className="mt-3 max-w-[48ch] text-lg-minus font-[450] leading-[1.5] text-[color:var(--text)]">{thesis}</p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 sm:gap-10">
        <div>
          <p className="mb-3 border-b border-[color:var(--border-strong)] pb-2 text-3xs font-[540] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
            Why it works
          </p>
          <ul className="grid gap-2.5">
            {works.map((item) => (
              <li key={item} className="text-sm leading-[1.55] text-[color:var(--text-muted)]">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 border-b border-[color:var(--border-strong)] pb-2 text-3xs font-[540] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
            Trade-offs
          </p>
          <ul className="grid gap-2.5">
            {costs.map((item) => (
              <li key={item} className="text-sm leading-[1.55] text-[color:var(--text-muted)]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto pb-2">
        <div className="flex gap-6">{children}</div>
      </div>
    </section>
  );
}

function StatefulFrame({
  label,
  render,
}: {
  label: string;
  render: (value: CategoryId, setValue: (next: CategoryId) => void) => ReactNode;
}) {
  const [value, setValue] = useState<CategoryId>("all");
  return <Frame label={label}>{render(value, setValue)}</Frame>;
}

export function CategoryFilterDirectionsMockupsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-[52ch]">
        <p className="text-3xs font-bold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
          Design study · phone category filter
        </p>
        <h1 className="mt-2 text-4xl font-[600] tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-5xl">
          Replace the blue select highlight
        </h1>
        <p className="mt-4 text-lg-minus font-[450] leading-[1.55] text-[color:var(--text-muted)]">
          On Tools (and every other phone results band that uses{" "}
          <code className="text-sm font-semibold text-[color:var(--text)]">MobileResultFilterControl</code>), the
          Category field is a native{" "}
          <code className="text-sm font-semibold text-[color:var(--text)]">&lt;select&gt;</code>. When focused, the
          system paints a bright blue rectangle over the value text. These five directions keep the same job — pick a
          category — without that highlight.
        </p>
      </header>

      <section className="mt-10 rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/40 p-5">
        <p className="text-3xs font-bold uppercase tracking-[0.12em] text-[color:var(--warning)]">
          Problem · shipped today
        </p>
        <p className="mt-2 max-w-[52ch] text-sm leading-[1.55] text-[color:var(--text)]">
          The outer field already has a token focus ring. Inside it, the native select still draws its own selection
          chrome — a thick blue box on &ldquo;All tools&rdquo; that does not match Details buttons, chips, or the search
          field above.
        </p>
        <div className="mt-5 overflow-x-auto pb-1">
          <StatefulFrame
            label="Baseline · native select (highlight forced on)"
            render={(value, setValue) => (
              <PhoneScene filter={<BaselineNativeSelect value={value} onChange={setValue} showHighlight />} />
            )}
          />
        </div>
      </section>

      <div className="mt-4 grid gap-10">
        <Direction
          name="A · Soft value button"
          recommended
          thesis="Promote the whole field to a button. Soft accent wash marks an open or filtered state; options live in a custom panel — never a native select."
          works={[
            "No system selection chrome: the value is ordinary text inside a button.",
            "Open and filtered states share one soft accent language already used on desktop chips.",
            "Scales to long category labels without truncating mid-word inside a select box.",
          ]}
          costs={[
            "Needs a dismissible panel (or bottom sheet) instead of the free OS picker.",
            "Slightly more tap target chrome than a bare select.",
          ]}
        >
          <StatefulFrame
            label="Resting · All tools"
            render={(value, setValue) => <PhoneScene filter={<SoftSheetFilter value={value} onChange={setValue} />} />}
          />
          <StatefulFrame
            label="Try opening the panel"
            render={(value, setValue) => <PhoneScene filter={<SoftSheetFilter value={value} onChange={setValue} />} />}
          />
        </Direction>

        <Direction
          name="B · Chip rail"
          thesis="Drop the Category field entirely on phone. Use the same pressed chips desktop already shows — one tap, no dropdown, no highlight."
          works={[
            "Parity with the desktop Tools filter language.",
            "Selection is a filled chip, not a boxed string of text.",
            "Zero nested focus: each chip owns its own focus-visible ring.",
          ]}
          costs={[
            "Horizontal scroll when categories grow past ~6.",
            "Less room for a long category name than a full-width field.",
          ]}
        >
          <StatefulFrame
            label="Chip rail · scroll sideways"
            render={(value, setValue) => <PhoneScene filter={<ChipRailFilter value={value} onChange={setValue} />} />}
          />
        </Direction>

        <Direction
          name="C · Custom listbox"
          thesis="Keep the Category + value layout, but render the value with a custom listbox. Focus rings the whole field; the chevron glyph soft-fills when open."
          works={[
            "Closest visual cousin to the shipped control — easiest migration.",
            "Check mark + soft row replace the blue text box as the selected cue.",
            "Works for any surface that currently mounts MobileResultFilterControl.",
          ]}
          costs={[
            "Still a two-step open-then-pick interaction.",
            "Must implement keyboard listbox behaviour the native select got for free.",
          ]}
        >
          <StatefulFrame
            label="Listbox · open to compare"
            render={(value, setValue) => <PhoneScene filter={<ListboxFilter value={value} onChange={setValue} />} />}
          />
        </Direction>

        <Direction
          name="D · Segments + More"
          thesis="Put the most-used categories on a segmented rail. Park the long tail behind a More menu so the primary choices never need a dropdown."
          works={[
            "One-tap for All / Assess / Evidence / Treat.",
            "Selected segment uses soft accent fill — never a text highlight.",
            "More stays compact even if the catalog gains categories later.",
          ]}
          costs={[
            "Requires a product call on which categories stay primary.",
            "Overflow labels can feel hidden compared with a full chip rail.",
          ]}
        >
          <StatefulFrame
            label="Segments · try More"
            render={(value, setValue) => (
              <PhoneScene filter={<SegmentOverflowFilter value={value} onChange={setValue} />} />
            )}
          />
        </Direction>

        <Direction
          name="E · Quiet accent rail"
          thesis="Keep a full-width field, but signal state with a left accent bar and a soft outer glow — never a rectangle drawn around the value text."
          works={[
            "Focus and filter state are geometric (rail + glow), not a text selection.",
            "Reads as a refined form field rather than a chip strip.",
            "Matches the calm inset fields used in search composers.",
          ]}
          costs={[
            "Accent rail is a new motif — needs reuse elsewhere or it looks one-off.",
            "Still a panel open for choosing, like A and C.",
          ]}
        >
          <StatefulFrame
            label="Quiet rail · open the menu"
            render={(value, setValue) => <PhoneScene filter={<QuietRailFilter value={value} onChange={setValue} />} />}
          />
        </Direction>
      </div>

      <footer className="mt-12 border-t border-[color:var(--border)] pt-6 text-sm text-[color:var(--text-muted)]">
        <p>
          Recommendation lean: ship <strong className="font-semibold text-[color:var(--text)]">A</strong> as the shared{" "}
          <code className="text-xs font-semibold">MobileResultFilterControl</code> replacement (soft button + panel), or{" "}
          <strong className="font-semibold text-[color:var(--text)]">B</strong> on Tools only if phone should match the
          desktop chip row exactly. C is the lowest-risk visual swap if the Category label must stay.
        </p>
      </footer>
    </main>
  );
}
