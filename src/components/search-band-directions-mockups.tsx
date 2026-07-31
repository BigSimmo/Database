"use client";

import { useState } from "react";
import { ArrowDownUp, Bookmark, ChevronDown, CircleAlert, LayoutList, LoaderCircle, Table2, X } from "lucide-react";

import { cn } from "@/components/ui-primitives";

/**
 * Design scratch for the search results band, round four.
 *
 * Round three ("Stacked, refined") asked how to make a second row earn its
 * place. This study argues that was the wrong question — it accepted the row,
 * and behind it the card. Both directions here delete the container, put the
 * count first, name the subject the count is counting, and never grow a second
 * row. They disagree on exactly one thing: whether sort/view/save stay visible
 * while you read, or fold into a single control that displays its own value.
 *
 * Mockups are design scratch: this route 404s in production and sits outside
 * the button-wiring and route-reachability gates. Every control below is still
 * wired, because an unwired control cannot be judged.
 */

type BandStatus = "ready" | "searching" | "empty" | "failed";
type SortValue = "relevance" | "alpha";
type ViewValue = "table" | "list";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/**
 * The band's subject comes from the mode, not from the word "matches". Round
 * three removed the query from the header (correctly — the composer holds it)
 * but never replaced the anchor, leaving "6 matches" matching nothing you can
 * name. `appModeSearchConfig(modeId).resultHeading` already carries this.
 */
const MODES = [
  {
    id: "prescribing",
    label: "Prescribing",
    plural: "prescribing documents",
    singular: "prescribing document",
    base: 6,
  },
  { id: "documents", label: "Documents", plural: "documents", singular: "document", base: 24 },
  { id: "dsm", label: "DSM", plural: "DSM diagnoses", singular: "DSM diagnosis", base: 3 },
] as const;

type ModeId = (typeof MODES)[number]["id"];

const FILTERS = ["Lithium", "Renal", "2024–"] as const;

const STATUSES: Array<{ id: BandStatus; label: string }> = [
  { id: "ready", label: "Ready" },
  { id: "searching", label: "Searching" },
  { id: "empty", label: "No matches" },
  { id: "failed", label: "Failed" },
];

function modeOf(id: ModeId) {
  return MODES.find((mode) => mode.id === id) ?? MODES[0];
}

/** Filtering narrows the set, so the count has to follow the chips it sits beside. */
function countFor(status: BandStatus, modeId: ModeId, filters: number) {
  if (status === "empty") return 0;
  const base = modeOf(modeId).base;
  if (filters === 0) return base;
  if (filters === 1) return Math.max(1, Math.round(base * 0.5));
  return Math.max(1, Math.round(base * 0.25));
}

function nounFor(modeId: ModeId, count: number) {
  const mode = modeOf(modeId);
  return count === 1 ? mode.singular : mode.plural;
}

/* -------------------------------------------------------------------------
   Shared control primitives.

   Sizes follow the shipped band, not the specimen sheet: `min-h-tap` (44 px)
   below `sm` and `min-h-10` (40 px) from `sm`. Drawing these at a tidier 34 px
   makes the band look 6 px shorter than it can ever actually be.
   ------------------------------------------------------------------------- */

function ToolGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex min-h-tap shrink-0 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)] sm:min-h-10"
    >
      {children}
    </div>
  );
}

function SortControl({ value, onChange }: { value: SortValue; onChange: (next: SortValue) => void }) {
  return (
    <ToolGroup label="Sort results">
      {(
        [
          ["relevance", "Relevance"],
          ["alpha", "A–Z"],
        ] as Array<[SortValue, string]>
      ).map(([id, label], index) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "min-h-tap whitespace-nowrap px-3 text-xs font-[470] sm:min-h-10",
            index > 0 && "border-l border-[color:var(--border)]",
            focusRing,
            value === id
              ? "bg-[color:var(--clinical-accent-soft)] font-[560] text-[color:var(--clinical-accent)]"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
          )}
        >
          {label}
        </button>
      ))}
    </ToolGroup>
  );
}

function ViewControl({ value, onChange }: { value: ViewValue; onChange: (next: ViewValue) => void }) {
  return (
    <ToolGroup label="Results view">
      {(
        [
          ["table", Table2, "Table view"],
          ["list", LayoutList, "List view"],
        ] as Array<[ViewValue, typeof Table2, string]>
      ).map(([id, Icon, label], index) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "grid min-h-tap min-w-tap place-items-center sm:min-h-10 sm:min-w-10",
            index > 0 && "border-l border-[color:var(--border)]",
            focusRing,
            value === id
              ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </ToolGroup>
  );
}

/* -------------------------------------------------------------------------
   Direction one — Ledger.
   One line, always. The count is the headline, the filters are its clause, the
   tools sit quiet at the far edge. No second row exists, so no second row can
   appear, so applying a filter moves nothing.
   ------------------------------------------------------------------------- */

function LedgerBand({
  status,
  modeId,
  filters,
  onRemoveFilter,
  onRetry,
  phone,
}: {
  status: BandStatus;
  modeId: ModeId;
  filters: number;
  onRemoveFilter: () => void;
  onRetry: () => void;
  phone: boolean;
}) {
  const [sort, setSort] = useState<SortValue>("relevance");
  const [view, setView] = useState<ViewValue>("table");
  const count = countFor(status, modeId, filters);
  const faulted = status === "failed";
  const active = FILTERS.slice(0, filters);
  // Beyond two chips the desktop line collapses the tail into one token rather
  // than letting the row grow. On a phone the chips become a swipe rail, which
  // is the honest weak point: the third chip is discoverable, not visible.
  const shown = !phone && active.length > 2 ? active.slice(0, 2) : active;
  const overflow = active.length - shown.length;

  return (
    <section
      aria-label="Search results"
      aria-busy={status === "searching"}
      data-status={status}
      className={cn("border-t-2", faulted ? "border-[color:var(--warning)]" : "border-[color:var(--clinical-accent)]")}
    >
      <div className="flex min-h-[3.25rem] min-w-0 items-center gap-2 px-0.5 py-1 sm:gap-2.5">
        {faulted ? (
          <>
            <div role="alert" className="flex min-w-0 items-center gap-2 text-[color:var(--warning)]">
              <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate text-base-minus font-[520]">Couldn&rsquo;t search {modeOf(modeId).plural}</span>
            </div>
            <span className="min-w-2 flex-1" aria-hidden />
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "inline-flex min-h-tap shrink-0 items-center rounded-lg border border-[color:var(--warning-border)] px-3 text-xs font-[480] text-[color:var(--warning)] sm:min-h-10",
                focusRing,
              )}
            >
              Retry
            </button>
          </>
        ) : status === "searching" ? (
          <>
            <span
              role="status"
              className="flex items-center gap-2 text-sm font-[470] text-[color:var(--clinical-accent)]"
            >
              <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
              Searching {modeOf(modeId).plural}…
            </span>
            <span className="min-w-2 flex-1" aria-hidden />
          </>
        ) : (
          <>
            <span role="status" aria-live="polite" aria-atomic="true" className="contents">
              <span
                data-zero={count === 0 ? "true" : undefined}
                className={cn(
                  "shrink-0 text-2xl leading-none tracking-[-0.02em] tabular-nums",
                  count === 0
                    ? "font-[470] text-[color:var(--text-muted)]"
                    : "font-[580] text-[color:var(--text-heading)]",
                )}
              >
                {count}
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-sm font-[430] text-[color:var(--text-muted)]">
              {nounFor(modeId, count)}
            </span>

            {active.length > 0 ? (
              <div
                className={cn(
                  "flex min-w-0 items-center gap-1.5",
                  phone && "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                )}
              >
                {shown.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onRemoveFilter}
                    aria-label={`Remove ${label} filter`}
                    className={cn(
                      "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-[500] text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)]",
                      focusRing,
                    )}
                  >
                    <span className="truncate">{label}</span>
                    <X className="h-3 w-3 shrink-0" aria-hidden />
                  </button>
                ))}
                {overflow > 0 ? (
                  <span className="inline-flex min-h-8 shrink-0 items-center rounded-full border border-dashed border-[color:var(--clinical-accent-border)] px-2.5 text-xs font-[500] text-[color:var(--clinical-accent)]">
                    +{overflow}
                  </span>
                ) : null}
              </div>
            ) : null}

            <span className="min-w-2 flex-1" aria-hidden />
            <div className="flex shrink-0 items-center gap-1.5">
              <SortControl value={sort} onChange={setSort} />
              <ViewControl value={view} onChange={setView} />
              {!phone ? (
                <button
                  type="button"
                  onClick={() => undefined}
                  className={cn(
                    "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs font-[480] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-10",
                    focusRing,
                  )}
                >
                  <Bookmark className="h-3.5 w-3.5" aria-hidden />
                  Save
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   Direction two — Statement.
   The band says one sentence, and every tool folds into a single control that
   displays the value it holds. Success and failure share a shape, so the
   transition is a word change rather than a re-layout.
   ------------------------------------------------------------------------- */

function OneControl({
  sort,
  onSort,
  view,
  onView,
}: {
  sort: SortValue;
  onSort: (next: SortValue) => void;
  view: ViewValue;
  onView: (next: ViewValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = sort === "relevance" ? "Relevance" : "A–Z";

  return (
    <div className="relative shrink-0">
      {/* The control states its own value rather than showing an ellipsis, so
          the current sort is readable without opening anything — which is most
          of what the segmented control was there for. */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prior) => !prior)}
        className={cn(
          "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs font-[480] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-10",
          focusRing,
        )}
      >
        <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
        {label}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <>
          {/* Dismissal is the whole risk in this direction: five working
              controls have been traded for one, so it has to close on Escape
              and on an outside press, and return focus when it does. */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
            className="absolute right-0 top-[calc(100%+0.375rem)] z-20 w-56 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface)] p-1.5 shadow-[var(--shadow-elevated)]"
          >
            <p className="px-2 pb-1 pt-2 text-3xs font-[540] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              Sort
            </p>
            {(
              [
                ["relevance", "Relevance"],
                ["alpha", "A–Z"],
              ] as Array<[SortValue, string]>
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={sort === id}
                onClick={() => {
                  onSort(id);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-tap w-full items-center rounded-lg px-2 text-left text-sm-minus font-[460] hover:bg-[color:var(--surface-subtle)] sm:min-h-10",
                  focusRing,
                  sort === id ? "font-[540] text-[color:var(--clinical-accent)]" : "text-[color:var(--text-muted)]",
                )}
              >
                {text}
              </button>
            ))}
            <hr className="my-1 border-[color:var(--border)]" />
            <p className="px-2 pb-1 pt-2 text-3xs font-[540] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              View
            </p>
            {(
              [
                ["table", "Table"],
                ["list", "List"],
              ] as Array<[ViewValue, string]>
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={view === id}
                onClick={() => {
                  onView(id);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-tap w-full items-center rounded-lg px-2 text-left text-sm-minus font-[460] hover:bg-[color:var(--surface-subtle)] sm:min-h-10",
                  focusRing,
                  view === id ? "font-[540] text-[color:var(--clinical-accent)]" : "text-[color:var(--text-muted)]",
                )}
              >
                {text}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatementBand({
  status,
  modeId,
  filters,
  onRemoveFilter,
  onRetry,
}: {
  status: BandStatus;
  modeId: ModeId;
  filters: number;
  onRemoveFilter: () => void;
  onRetry: () => void;
}) {
  const [sort, setSort] = useState<SortValue>("relevance");
  const [view, setView] = useState<ViewValue>("table");
  const count = countFor(status, modeId, filters);
  const faulted = status === "failed";
  const active = FILTERS.slice(0, filters);

  return (
    <section
      aria-label="Search results"
      aria-busy={status === "searching"}
      data-status={status}
      className={cn("border-t-2", faulted ? "border-[color:var(--warning)]" : "border-[color:var(--clinical-accent)]")}
    >
      <div className="flex min-h-[3.25rem] min-w-0 items-center gap-2 px-0.5 py-1 sm:gap-3">
        {faulted ? (
          <>
            <p role="alert" className="min-w-0 text-base-minus font-[500] text-[color:var(--warning)]">
              Couldn&rsquo;t search {modeOf(modeId).plural}.
            </p>
            <span className="min-w-2 flex-1" aria-hidden />
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "inline-flex min-h-tap shrink-0 items-center rounded-lg border border-[color:var(--warning-border)] px-3 text-xs font-[480] text-[color:var(--warning)] sm:min-h-10",
                focusRing,
              )}
            >
              Retry
            </button>
          </>
        ) : status === "searching" ? (
          <>
            <span
              role="status"
              className="flex min-w-0 items-center gap-2 text-sm font-[470] text-[color:var(--clinical-accent)]"
            >
              <LoaderCircle className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" aria-hidden />
              Searching {modeOf(modeId).plural}…
            </span>
            <span className="min-w-2 flex-1" aria-hidden />
            <OneControl sort={sort} onSort={setSort} view={view} onView={setView} />
          </>
        ) : (
          <>
            <p
              role="status"
              aria-live="polite"
              className="min-w-0 flex-1 text-base-minus font-[430] leading-[1.5] text-[color:var(--text-muted)]"
            >
              {count === 0 ? (
                <>
                  No <span className="font-[450]">{modeOf(modeId).plural}</span> match this search.
                </>
              ) : (
                <>
                  <span className="text-lg-minus font-[570] tabular-nums tracking-[-0.015em] text-[color:var(--text-heading)]">
                    {count}
                  </span>{" "}
                  <span className="font-[500] text-[color:var(--text-heading)]">{nounFor(modeId, count)}</span>
                  {active.length > 0 ? (
                    <>
                      <span className="px-0.5 text-[color:var(--text-soft)]"> · </span>
                      narrowed by{" "}
                      {active.map((label, index) => (
                        <span key={label}>
                          {index > 0 ? (index === active.length - 1 ? " and " : ", ") : ""}
                          <button
                            type="button"
                            onClick={onRemoveFilter}
                            aria-label={`Remove ${label} filter`}
                            className={cn(
                              "border-b border-[color:var(--clinical-accent-border)] font-[520] text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)]",
                              focusRing,
                            )}
                          >
                            {label}
                            <span className="pl-0.5 text-2xs opacity-70" aria-hidden>
                              ×
                            </span>
                          </button>
                        </span>
                      ))}
                    </>
                  ) : null}
                </>
              )}
            </p>
            <OneControl sort={sort} onSort={setSort} view={view} onView={setView} />
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function ResultRows({ status, count, rows }: { status: BandStatus; count: number; rows: number }) {
  if (status === "failed") return null;
  if (count === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-5 text-center">
        <p className="text-sm font-[550] text-[color:var(--text-heading)]">Nothing matched</p>
        <p className="mt-0.5 text-xs font-[440] text-[color:var(--text-muted)]">
          Relax a filter, or try a broader term.
        </p>
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "mt-3 divide-y divide-[color:var(--border)] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]",
        status === "searching" && "opacity-45",
      )}
    >
      {Array.from({ length: Math.min(rows, Math.max(1, count)) }).map((_, index) => (
        <div key={index} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3">
          <span className="h-8 w-8 rounded-lg bg-[color:var(--surface-inset)]" />
          <span className="space-y-1.5">
            <span
              className={cn("block h-2.5 rounded-md bg-[color:var(--surface-inset)]", index % 2 ? "w-1/2" : "w-2/3")}
            />
            <span className="block h-2 w-1/3 rounded-md bg-[color:var(--surface-inset)] opacity-70" />
          </span>
          <span className="h-5 w-12 rounded-md bg-[color:var(--surface-inset)]" />
        </div>
      ))}
    </div>
  );
}

function Frame({ label, width, children }: { label: string; width: "desktop" | "phone"; children: React.ReactNode }) {
  return (
    <div className="shrink-0">
      <p className="mb-2 flex justify-between gap-4 text-3xs font-[540] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        <span>{label}</span>
        <span>{width === "desktop" ? "760 px" : "390 px"}</span>
      </p>
      <div
        className={cn(
          "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3.5 shadow-[var(--shadow-lift)]",
          width === "desktop" ? "w-[47.5rem]" : "w-[24.375rem]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Segmented<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: ReadonlyArray<{ value: Value; label: string }>;
  onChange: (next: Value) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-3xs font-[540] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-9 whitespace-nowrap px-2.5 text-xs font-[470]",
              index > 0 && "border-l border-[color:var(--border)]",
              focusRing,
              value === option.value
                ? "bg-[color:var(--clinical-accent-soft)] font-[560] text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  children: React.ReactNode;
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
      <p className="mt-3 max-w-[46ch] text-lg-minus font-[450] leading-[1.5] text-[color:var(--text)]">{thesis}</p>

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
          <p className="mb-3 border-b border-[color:var(--warning-border)] pb-2 text-3xs font-[540] uppercase tracking-[0.14em] text-[color:var(--warning)]">
            What it costs
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

      <div className="mt-7 overflow-x-auto rounded-xl bg-[color:var(--surface-inset)] p-5">
        <div className="flex min-w-min items-start gap-6">{children}</div>
      </div>
    </section>
  );
}

export function SearchBandDirectionsMockupsPage() {
  const [status, setStatus] = useState<BandStatus>("ready");
  const [filters, setFilters] = useState(0);
  const [modeId, setModeId] = useState<ModeId>("prescribing");
  const count = countFor(status, modeId, filters);
  const removeFilter = () => setFilters((prior) => Math.max(0, prior - 1));
  const retry = () => setStatus("ready");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      <p className="text-3xs font-[540] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
        Search results band · round four · two directions
      </p>
      <h1 className="mt-4 max-w-[20ch] text-3xl font-[560] leading-[1.05] tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
        The band should assert one thing, and assert it well
      </h1>
      <p className="mt-5 max-w-[62ch] text-lg-minus leading-[1.6] text-[color:var(--text-muted)]">
        Round three asked how to make a second row earn its place. That accepted the row, and behind it the card. Since
        the &ldquo;across 4 documents&rdquo; clause was removed, the band has been a container looking for contents.
        Both directions delete the container and keep one assertion. They differ on a single axis: how much tooling
        stays visible while you read.
      </p>

      <div className="sticky top-0 z-30 -mx-4 mt-8 flex flex-wrap gap-x-8 gap-y-3 border-y border-[color:var(--border)] bg-[color:var(--surface)]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Segmented
          label="Result"
          value={status}
          options={STATUSES.map((s) => ({ value: s.id, label: s.label }))}
          onChange={setStatus}
        />
        <Segmented
          label="Filters"
          value={String(filters)}
          options={[
            { value: "0", label: "None" },
            { value: "1", label: "One" },
            { value: "3", label: "Three" },
          ]}
          onChange={(next) => setFilters(Number(next))}
        />
        <Segmented
          label="Mode"
          value={modeId}
          options={MODES.map((m) => ({ value: m.id, label: m.label }))}
          onChange={setModeId}
        />
      </div>

      <div className="mt-10 grid gap-12">
        <Direction
          name="Ledger"
          recommended
          thesis="One line, always. The count is the headline, the filters are its clause, and the tools sit quiet at the far edge where they cannot compete with the number."
          works={[
            "The count names its own subject — “6 prescribing documents”, not “6 matches” — so the number stays anchored on a deep link or 600 px down the page. The mode config already carries the noun.",
            "Filters sit on the count’s baseline because a filter modifies the count. The grammar of the layout now matches the grammar of the data.",
            "There is no second row to grow, conditionally or otherwise, so applying a filter moves nothing below it. That is the 48 px Adaptive spent on its most common interaction.",
            "The band holds one height in every state, so it simply pins when scrolled. Nothing collapses, so nothing can collapse into a fragment over the status bar.",
            "A failed search loses the chrome, not just the number: tokens and tools both go, and one Retry takes the right edge.",
          ]}
          costs={[
            "Three filters at 390 px is a swipe rail — the third chip is discoverable, not visible. The honest weak point.",
            "Deleting the card removes a boundary, so where the result list starts with its own bordered table the two can read as one object. The gap between them becomes load-bearing.",
            "Long mode nouns lengthen line one. Switch the mode above to see “DSM diagnoses” against “documents”.",
            "The overflow token is a new primitive: four or more filters collapse into “+2”, and that popover has to handle focus, Escape and outside-press or it is worse than the row it replaced.",
          ]}
        >
          <Frame label="Desktop" width="desktop">
            <LedgerBand
              status={status}
              modeId={modeId}
              filters={filters}
              onRemoveFilter={removeFilter}
              onRetry={retry}
              phone={false}
            />
            <ResultRows status={status} count={count} rows={4} />
          </Frame>
          <Frame label="Phone" width="phone">
            <LedgerBand
              status={status}
              modeId={modeId}
              filters={filters}
              onRemoveFilter={removeFilter}
              onRetry={retry}
              phone
            />
            <ResultRows status={status} count={count} rows={3} />
          </Frame>
        </Direction>

        <Direction
          name="Statement"
          thesis="The band says one sentence. Every tool folds into a single control that displays the value it holds, so the band carries language where it used to carry chrome."
          works={[
            "The one control states its own value — it reads “Relevance”, not “⋯” — so the current sort is legible without opening anything.",
            "Success and failure are the same sentence in the same place at the same size, so the transition is a word change rather than a re-layout. That is what you want at the moment something has gone wrong.",
            "Empty stops being a zero: “No prescribing documents match this search” says more than “0” can, and can never be mistaken for a failure.",
            "Chrome drops from five controls to one, which at zero filters starts the result list higher up a phone screen than anything else here.",
          ]}
          costs={[
            "It reflows further than Adaptive did. Measured on the specimen sheet the band runs 50 → 70 → 92 px across zero, one and three filters — a 42 px shift against the 48 px that ruled Adaptive out. This was written up as an advantage until it was measured.",
            "View costs a tap, and view is a spatial choice flipped repeatedly while reading. Sort is persisted and set about once a session, so hiding that is cheap; hiding view is not.",
            "Even “Searching…” wraps at 390 px once the control is beside it, so the band twitches on every search. Ledger holds its height because it renders no controls in that state.",
            "The popover is the whole design. Five working controls have been traded for one, so focus return, Escape and outside-press have to be right. There is no partial credit.",
          ]}
        >
          <Frame label="Desktop" width="desktop">
            <StatementBand
              status={status}
              modeId={modeId}
              filters={filters}
              onRemoveFilter={removeFilter}
              onRetry={retry}
            />
            <ResultRows status={status} count={count} rows={4} />
          </Frame>
          <Frame label="Phone" width="phone">
            <StatementBand
              status={status}
              modeId={modeId}
              filters={filters}
              onRemoveFilter={removeFilter}
              onRetry={retry}
            />
            <ResultRows status={status} count={count} rows={3} />
          </Frame>
        </Direction>
      </div>

      <section className="mt-14 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-6 sm:p-8">
        <p className="text-3xs font-[540] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">Recommendation</p>
        <h2 className="mt-3 text-2xl-minus font-[560] tracking-[-0.02em] text-[color:var(--text-heading)]">
          Ledger, with one graft from Statement
        </h2>
        <p className="mt-3 max-w-[68ch] text-base-minus leading-[1.6] text-[color:var(--text-muted)]">
          The two objections do not overlap. Everything wrong with Statement is about the ready state — tools behind a
          tap while you are reading, and a sentence that grows 42 px as filters accumulate. Everything wrong with Ledger
          is about empty and failed: a bare <code>0</code> beside a full bank of controls with nothing left to act on.
          Empty and failed carry no filters — the shipped band already drops them when faulted — so grafting the
          sentence into exactly those two states imports the clarity and leaves the reflow behind.
        </p>
        <ol className="mt-5 grid list-decimal gap-2.5 pl-5 text-sm leading-[1.55] text-[color:var(--text-muted)] marker:font-[600] marker:text-[color:var(--clinical-accent)]">
          <li>
            Add the mode&rsquo;s result noun to the band and replace &ldquo;N matches&rdquo; with &ldquo;N
            &lt;noun&gt;&rdquo;. Pure copy, no new state, ships alone.
          </li>
          <li>
            Replace the card with the hairline rule and move to the Ledger type scale. Behaviour unchanged, so the
            existing DOM tests hold and rollback is one CSS block.
          </li>
          <li>
            Move filter chips onto the count&rsquo;s baseline with the swipe rail. This is the commit that deletes the
            layout shift.
          </li>
          <li>Pin the band and delete the collapse behaviour that produced the status-bar fragment.</li>
          <li>
            Swap empty and failed to sentences and drop the tools in those two states. Last, because it is the only step
            that changes what the failure surface says.
          </li>
          <li>
            Build the overflow popover only once four filters actually occur in a real mode. Until then the rail is
            enough, and an untested popover is a liability.
          </li>
        </ol>
      </section>

      <p className="mt-10 max-w-[80ch] text-xs leading-[1.7] text-[color:var(--text-soft)]">
        Controls here use the shipped band&rsquo;s own tap sizes — <code>min-h-tap</code> (44 px) below <code>sm</code>,{" "}
        <code>min-h-10</code> (40 px) from <code>sm</code> — rather than the tidier 34 px the specimen sheet drew, so
        the heights on this page are the heights the band can actually reach. Colour, radius and shadow come from the{" "}
        <code>@theme</code> tokens in <code>globals.css</code>. Nothing here has been run against the real component.
      </p>
    </div>
  );
}
