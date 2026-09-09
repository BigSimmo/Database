"use client";

import { useCallback, useId, useMemo, useState } from "react";
import {
  Brain,
  Check,
  HeartPulse,
  Layers,
  ListFilter,
  RotateCcw,
  Shield,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";
import { searchFormulationMechanisms } from "@/lib/formulation";

/**
 * Restyling the shared filter sheet — three style directions, plus the answer to
 * "what is the segmented bar actually for".
 *
 * The specimen is the FORMULATION sheet rather than services, because that is
 * the one whose craft problems are worst and whose content stresses the layout
 * hardest: four domain themes, twelve domains, twelve mechanisms, four presets,
 * thirteen domain chips, and the longest title in the app
 * ("Filter formulation mechanisms" — inside formulation mode, where three of
 * those four words are already implied).
 *
 * Three concrete defects in the shipped sheet drive this, all verifiable:
 *
 *   1. `formulationDomainGroups` ALREADY EXISTS in `src/lib/formulation.ts` —
 *      four themed groups, each with a label and a written description — and the
 *      filter sheet ignores it completely, dumping all twelve domains into one
 *      flat ragged wrap. The structure was authored and then not used.
 *   2. Biological, Social and Cultural are offered as domain chips and match
 *      ZERO of the twelve mechanisms. Three controls that can never return
 *      anything, indistinguishable from the nine that can. Counts expose this on
 *      sight; without them it is invisible.
 *   3. The sheet renders `formulationSearchPresets.slice(0, 4)` of five, so
 *      "If it is not perfect" is silently unreachable from the filter.
 *
 * THE SEGMENT BAR. The previous study used it to pick a verb — narrow vs. start
 * a new search. That was the wrong job for it: a verb switch is a mode you set
 * once and rarely change, so a permanent bar spends the most valuable strip of
 * the sheet on a rare decision. Here it carries SCOPE instead — "these 2" vs
 * "all 12" — which is the decision a reader actually makes repeatedly, and which
 * nothing in the product currently answers:
 *
 *   - Filtering two results by twelve domains is close to pointless; the reader
 *     nearly always wants the full set. Today the only route there is to clear
 *     the search box and start again, losing the query.
 *   - It makes the empty state RECOVERABLE. "No mechanisms match" becomes "no
 *     mechanisms match in these 2 — see 7 in all 12", one tap away, instead of a
 *     dead end that forces a reset.
 *   - Both segments carry live counts, so the control explains itself without a
 *     label and the reader can see the cost of switching before switching.
 *
 * Every count here is real, computed live from the twelve mechanisms in
 * `src/data/formulation-content.json` and their `domains` arrays.
 *
 * Sizing note: these render a 390px phone frame inside a wide page, so viewport
 * `sm:` variants would resolve against the page rather than the frame. Every
 * component takes an explicit `compact` flag instead.
 */

/* ------------------------------------------------------------------------- */
/* Real data — src/data/formulation-content.json                              */
/* ------------------------------------------------------------------------- */

const MECHANISMS: ReadonlyArray<{ name: string; domains: ReadonlyArray<string> }> = [
  { name: "Avoidance", domains: ["Behaviour", "Cognition", "Trauma", "Risk"] },
  { name: "Splitting", domains: ["Defence", "Interpersonal", "Affect", "Attachment"] },
  { name: "Shame", domains: ["Affect", "Trauma", "Attachment", "Interpersonal"] },
  { name: "Emotional dysregulation", domains: ["Affect", "Behaviour", "Interpersonal", "Risk"] },
  { name: "Reassurance seeking", domains: ["Interpersonal", "Attachment", "Cognition", "Behaviour"] },
  { name: "Attachment avoidance", domains: ["Attachment", "Interpersonal", "Developmental", "Defence"] },
  { name: "Negative core beliefs", domains: ["Cognition", "Developmental", "Attachment", "Affect"] },
  { name: "Projection", domains: ["Defence", "Interpersonal", "Affect", "Cognition"] },
  { name: "Rumination", domains: ["Cognition", "Affect", "Behaviour"] },
  { name: "Worry", domains: ["Cognition", "Affect", "Behaviour", "Risk"] },
  { name: "Dissociation", domains: ["Trauma", "Affect", "Behaviour", "Risk"] },
  { name: "Perfectionism", domains: ["Cognition", "Behaviour", "Affect", "Developmental"] },
];

/** The query in the screenshot's band, resolved to the mechanisms it returns. */
export const filterSheetRestyleCurrentQuery = "Worry";
export const filterSheetRestyleCurrentSubset = searchFormulationMechanisms(filterSheetRestyleCurrentQuery).map(
  (result) => result.mechanism.name,
);

/**
 * `formulationDomainGroups`, quoted verbatim from `src/lib/formulation.ts`.
 * The descriptions are the library's own — the sheet has simply never shown them.
 */
const DOMAIN_GROUPS: ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  domains: ReadonlyArray<string>;
}> = [
  {
    id: "meaning",
    label: "Meaning and belief",
    description: "How experience is interpreted and organised.",
    icon: Brain,
    domains: ["Cognition", "Developmental", "Cultural"],
  },
  {
    id: "emotion",
    label: "Emotion and threat",
    description: "Affect, trauma responses, and risk-relevant escalation.",
    icon: HeartPulse,
    domains: ["Affect", "Trauma", "Risk", "Biological"],
  },
  {
    id: "response",
    label: "Coping and action",
    description: "What the person does to manage distress or uncertainty.",
    icon: Sparkles,
    domains: ["Behaviour", "Social"],
  },
  {
    id: "relationship",
    label: "Relationship and protection",
    description: "Attachment strategies, interpersonal patterns, and defences.",
    icon: Users,
    domains: ["Attachment", "Interpersonal", "Defence"],
  },
];

type Scope = "current" | "all";

function scopeMechanisms(scope: Scope) {
  return scope === "all" ? MECHANISMS : MECHANISMS.filter((m) => filterSheetRestyleCurrentSubset.includes(m.name));
}

/** Domains OR together: picking two domains widens, exactly like the services facets. */
function matching(scope: Scope, selected: ReadonlySet<string>) {
  const pool = scopeMechanisms(scope);
  if (selected.size === 0) return pool;
  return pool.filter((m) => m.domains.some((d) => selected.has(d)));
}

function useDomainCounts(scope: Scope, selected: ReadonlySet<string>) {
  return useMemo(() => {
    const pool = scopeMechanisms(scope);
    const total = matching(scope, selected).length;
    const perDomain: Record<string, number> = {};
    for (const group of DOMAIN_GROUPS) {
      for (const domain of group.domains) {
        // INTRINSIC count — how many mechanisms in this scope carry this domain —
        // deliberately NOT the "total if I added this" contract the services study
        // settled on. Domains are a single OR group, so adding one can only widen:
        // with Cognition selected, "total if added" reports the unchanged union
        // total (7) for Cultural, which has no mechanisms at all. That semantic
        // makes an empty domain indistinguishable from a full one, which would
        // hide the single most useful thing these counts have to say. The commit
        // button remains the thing that predicts the outcome.
        perDomain[domain] = pool.filter((m) => m.domains.includes(domain)).length;
      }
    }
    return { total, perDomain, scopeSize: pool.length };
  }, [scope, selected]);
}

/** Counts for the other scope, so the segment can advertise what switching buys. */
function useScopeCounts(selected: ReadonlySet<string>) {
  return useMemo(
    () => ({
      current: matching("current", selected).length,
      all: matching("all", selected).length,
    }),
    [selected],
  );
}

/* ------------------------------------------------------------------------- */
/* Shared craft primitives                                                    */
/* ------------------------------------------------------------------------- */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/**
 * The header the study is really about.
 *
 * Shipped: one heavy 24px string ("Filter formulation mechanisms") beside a
 * boxed ✕ of almost equal visual weight, on flat white, with no indication of
 * what is being filtered or how much of it is left.
 *
 * Here: an accent eyebrow carries the mode so the title need not repeat it, the
 * title drops to the two words that are actually load-bearing, a live line
 * underneath states the result of the current selection, and the close control
 * becomes a quiet ghost circle — present, reachable, no longer competing with
 * the title for first read.
 */
function SheetHeader({
  compact,
  total,
  scopeTotal,
  onClear,
  clearable,
  tone = "tinted",
}: {
  compact: boolean;
  total: number;
  scopeTotal: number;
  onClear: () => void;
  clearable: boolean;
  tone?: "tinted" | "plain" | "accent";
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start gap-3 border-b border-[color:var(--border)] px-4 pb-3 pt-1",
        tone === "tinted" && "bg-[color:var(--surface-subtle)]",
        tone === "accent" && "bg-[color:var(--clinical-accent-soft)]/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
          Formulation
        </span>
        <h4
          className={cn(
            "mt-0.5 font-black tracking-tight text-[color:var(--text-heading)]",
            compact ? "text-lg" : "text-base",
          )}
        >
          Filter mechanisms
        </h4>
        <p className="mt-0.5 text-3xs font-semibold text-[color:var(--text-soft)]">
          <span className="nums tabular-nums text-[color:var(--clinical-accent)]">{total}</span> of{" "}
          <span className="nums tabular-nums">{scopeTotal}</span> match
        </p>
      </div>
      {clearable ? (
        <button
          type="button"
          onClick={onClear}
          className={cn(
            "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-3xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
            focusRing,
          )}
        >
          <RotateCcw aria-hidden className="h-3 w-3" />
          Reset
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Close filter"
        onClick={() => {
          /* Comp only. */
        }}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-raised)] hover:text-[color:var(--text)]",
          focusRing,
        )}
      >
        <X aria-hidden className="size-icon-md" />
      </button>
    </div>
  );
}

/**
 * The segmented bar, carrying SCOPE.
 *
 * Each segment states its own count, so the control needs no label and the
 * reader can price the switch before making it. When the active scope has been
 * filtered to nothing and the other has matches, the inactive segment is given
 * the accent tint — the sheet points at its own way out.
 */
function ScopeSwitch({
  value,
  onChange,
  compact,
  counts,
}: {
  value: Scope;
  onChange: (next: Scope) => void;
  compact: boolean;
  counts: { current: number; all: number };
}) {
  const segments: ReadonlyArray<{ value: Scope; label: string; count: number; icon: LucideIcon }> = [
    { value: "current", label: "These results", count: counts.current, icon: ListFilter },
    { value: "all", label: "All mechanisms", count: counts.all, icon: Layers },
  ];
  const rescue = counts.current === 0 && counts.all > 0;
  return (
    <div
      role="group"
      aria-label="Filter scope"
      className="inline-flex w-full gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1"
    >
      {segments.map((segment) => {
        const active = value === segment.value;
        const points = rescue && segment.value === "all";
        return (
          <button
            key={segment.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(segment.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-2xs font-extrabold transition",
              "motion-reduce:transition-none",
              compact ? "min-h-tap" : "min-h-9",
              focusRing,
              active
                ? "bg-[color:var(--surface)] text-[color:var(--text-heading)] shadow-[var(--e2)]"
                : points
                  ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
            )}
          >
            <segment.icon aria-hidden className="size-icon-sm shrink-0" />
            <span className="truncate">{segment.label}</span>
            <span
              className={cn(
                "nums grid h-[1.125rem] min-w-[1.125rem] shrink-0 place-items-center rounded-full px-1 text-3xs font-black tabular-nums",
                active
                  ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "bg-[color:var(--surface-raised)] text-[color:var(--text-soft)]",
              )}
            >
              {segment.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Uniform chip: checkbox, label, count. Zero-count reads as a different kind of thing. */
function DomainChip({
  domain,
  count,
  selected,
  compact,
  onToggle,
}: {
  domain: string;
  count: number;
  selected: boolean;
  compact: boolean;
  onToggle: () => void;
}) {
  const empty = count === 0 && !selected;
  const emptyId = `${useId()}-empty`;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-describedby={empty ? emptyId : undefined}
      onClick={onToggle}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 text-2xs font-semibold transition",
        "motion-reduce:transition-none",
        compact ? "min-h-tap" : "min-h-9",
        focusRing,
        selected
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
          : empty
            ? "cursor-default border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]"
            : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-icon-sm shrink-0 place-items-center rounded-[0.25rem] border transition-colors",
          selected
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
            : "border-[color:var(--border-strong)] bg-[color:var(--surface)]",
        )}
      >
        {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
      </span>
      <span className="truncate">{domain}</span>
      <span className="nums shrink-0 text-3xs font-bold tabular-nums text-[color:var(--text-soft)]">{count}</span>
      {empty ? (
        <span id={emptyId} className="sr-only">
          No mechanisms in this scope.
        </span>
      ) : null}
    </button>
  );
}

export function filterSheetRestyleDomainProportionPercent(count: number, scopeSize: number) {
  if (scopeSize <= 0) return 0;
  return Math.round((count / scopeSize) * 100);
}

/** Full-width row variant for the dense direction. */
function DomainRow({
  domain,
  count,
  scopeSize,
  selected,
  compact,
  onToggle,
}: {
  domain: string;
  count: number;
  scopeSize: number;
  selected: boolean;
  compact: boolean;
  onToggle: () => void;
}) {
  const empty = count === 0 && !selected;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 text-left transition",
        compact ? "min-h-tap" : "min-h-9",
        focusRing,
        selected ? "bg-[color:var(--clinical-accent-soft)]" : "hover:bg-[color:var(--surface-subtle)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-icon-md shrink-0 place-items-center rounded-[0.3rem] border transition-colors",
          selected
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
            : "border-[color:var(--border-strong)] bg-[color:var(--surface)]",
        )}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3.5} /> : null}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-2xs font-bold",
          selected
            ? "text-[color:var(--clinical-accent)]"
            : empty
              ? "text-[color:var(--text-soft)]"
              : "text-[color:var(--text)]",
        )}
      >
        {domain}
      </span>
      {/* A proportion bar, not just a number: relative weight within the active scope
          is more legible than absolute count alone. */}
      <span
        aria-hidden
        className="hidden h-1 w-10 shrink-0 overflow-hidden rounded-full bg-[color:var(--surface-subtle)] min-[300px]:block"
      >
        <span
          className="block h-full rounded-full bg-[color:var(--clinical-accent)]/45"
          style={{ width: `${filterSheetRestyleDomainProportionPercent(count, scopeSize)}%` }}
        />
      </span>
      <span className="nums w-5 shrink-0 text-right text-3xs font-black tabular-nums text-[color:var(--text-soft)]">
        {count}
      </span>
    </button>
  );
}

/** Live commit. Carries the escape hatch when the active scope is empty. */
function CommitBar({
  compact,
  total,
  scope,
  otherCount,
  onSwitchScope,
}: {
  compact: boolean;
  total: number;
  scope: Scope;
  otherCount: number;
  onSwitchScope: () => void;
}) {
  if (total === 0 && otherCount > 0) {
    return (
      <div className="grid gap-1.5">
        <p className="text-3xs font-semibold text-[color:var(--text-soft)]">
          Nothing matches in {scope === "current" ? "these results" : "all mechanisms"}.
        </p>
        <button
          type="button"
          onClick={onSwitchScope}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[color:var(--clinical-accent)] px-3 text-xs font-extrabold text-white",
            compact ? "min-h-tap" : "min-h-10",
            focusRing,
          )}
        >
          <Layers aria-hidden className="size-icon-sm" />
          Show {otherCount} in {scope === "current" ? "all mechanisms" : "these results"}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-disabled={total === 0 || undefined}
      onClick={() => {
        /* Comp only. */
      }}
      className={cn(
        "inline-flex w-full items-center justify-center rounded-lg px-3 text-xs font-extrabold transition",
        compact ? "min-h-tap" : "min-h-10",
        focusRing,
        total === 0
          ? "cursor-default border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]"
          : "bg-[color:var(--clinical-accent)] text-white hover:brightness-110",
      )}
    >
      {total === 0 ? "No mechanisms match — widen a filter" : `Show ${total} mechanism${total === 1 ? "" : "s"}`}
    </button>
  );
}

/** In-frame phone sheet shell. */
function SheetShell({
  header,
  children,
  footer,
  maxHeight = "max-h-[88%]",
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  maxHeight?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]",
        maxHeight,
      )}
    >
      <div className="flex shrink-0 justify-center pb-1 pt-2" aria-hidden>
        <span className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
      </div>
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">{footer}</div>
    </div>
  );
}

/** The band the sheet opens from, for context in every frame. */
function Band({ compact, count, active }: { compact: boolean; count: number; active: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className={cn("flex items-center gap-2 px-2.5", compact ? "min-h-14" : "min-h-12")}>
        <span className="min-w-0 flex-1 truncate">
          <span className="nums text-sm font-extrabold tabular-nums text-[color:var(--text-heading)]">{count}</span>{" "}
          <span className="text-xs font-bold text-[color:var(--text-muted)]">mechanisms</span>
          <span className="text-xs font-medium text-[color:var(--text-soft)]"> · {filterSheetRestyleCurrentQuery}</span>
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-2xs font-bold",
            compact ? "min-h-tap" : "min-h-9",
            active > 0
              ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
          )}
        >
          <ListFilter aria-hidden className="size-icon-sm" />
          Filter
          {active > 0 ? (
            <span className="nums grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--clinical-accent)]/15 px-1 text-3xs font-black tabular-nums">
              {active}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Style A — Refined clinical                                                 */
/* ------------------------------------------------------------------------- */

function StyleABody({
  selected,
  counts,
  onToggle,
  compact,
}: {
  selected: ReadonlySet<string>;
  counts: { perDomain: Record<string, number> };
  onToggle: (domain: string) => void;
  compact: boolean;
}) {
  return (
    <div className="grid gap-3 px-4 py-3">
      {DOMAIN_GROUPS.map((group) => {
        const chosen = group.domains.filter((d) => selected.has(d)).length;
        return (
          <section key={group.id} className="min-w-0">
            <div className="flex min-h-7 items-center gap-1.5">
              <group.icon aria-hidden className="size-icon-sm shrink-0 text-[color:var(--decoration-soft)]" />
              <h5 className="flex-1 text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
                {group.label}
              </h5>
              {chosen > 0 ? (
                <span className="nums rounded-full bg-[color:var(--clinical-accent-soft)] px-1.5 text-3xs font-black tabular-nums text-[color:var(--clinical-accent)]">
                  {chosen}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {group.domains.map((domain) => (
                <DomainChip
                  key={domain}
                  domain={domain}
                  count={counts.perDomain[domain] ?? 0}
                  selected={selected.has(domain)}
                  compact={compact}
                  onToggle={() => onToggle(domain)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Style B — Themed cards                                                     */
/* ------------------------------------------------------------------------- */

function StyleBBody({
  selected,
  counts,
  onToggle,
  compact,
}: {
  selected: ReadonlySet<string>;
  counts: { perDomain: Record<string, number> };
  onToggle: (domain: string) => void;
  compact: boolean;
}) {
  return (
    <div className={cn("grid gap-2.5 px-4 py-3", !compact && "sm:grid-cols-2")}>
      {DOMAIN_GROUPS.map((group) => {
        const chosen = group.domains.filter((d) => selected.has(d)).length;
        return (
          <section
            key={group.id}
            className={cn(
              "min-w-0 overflow-hidden rounded-xl border transition",
              chosen > 0
                ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/25"
                : "border-[color:var(--border)] bg-[color:var(--surface)]",
            )}
          >
            <div className="flex items-start gap-2 px-2.5 pb-1.5 pt-2">
              <span
                aria-hidden
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-lg",
                  chosen > 0
                    ? "bg-[color:var(--clinical-accent)] text-white"
                    : "bg-[color:var(--surface-subtle)] text-[color:var(--decoration-soft)]",
                )}
              >
                <group.icon className="size-icon-sm" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-2xs font-extrabold leading-4 text-[color:var(--text-heading)]">
                  {group.label}
                </span>
                {/* The library already wrote these descriptions; the shipped
                    sheet has simply never shown them. */}
                <span className="block text-3xs font-medium leading-4 text-[color:var(--text-soft)]">
                  {group.description}
                </span>
              </span>
              {chosen > 0 ? (
                <span className="nums shrink-0 rounded-full bg-[color:var(--clinical-accent)] px-1.5 text-3xs font-black tabular-nums text-white">
                  {chosen}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5 px-2.5 pb-2.5">
              {group.domains.map((domain) => (
                <DomainChip
                  key={domain}
                  domain={domain}
                  count={counts.perDomain[domain] ?? 0}
                  selected={selected.has(domain)}
                  compact={compact}
                  onToggle={() => onToggle(domain)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Style C — Dense list                                                       */
/* ------------------------------------------------------------------------- */

function StyleCBody({
  selected,
  counts,
  onToggle,
  compact,
}: {
  selected: ReadonlySet<string>;
  counts: { perDomain: Record<string, number>; scopeSize: number };
  onToggle: (domain: string) => void;
  compact: boolean;
}) {
  return (
    <div className="min-w-0">
      {DOMAIN_GROUPS.map((group) => (
        <section key={group.id} className="min-w-0 break-inside-avoid px-3 pb-1.5">
          {/* Sticky sub-head: with twelve domain rows the group label must survive the
              scroll, or a reader loses which dimension they are in. */}
          <h5 className="sticky top-0 z-10 flex min-h-7 items-center gap-1.5 bg-[color:var(--surface-raised)] text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
            <group.icon aria-hidden className="size-icon-sm shrink-0 text-[color:var(--decoration-soft)]" />
            {group.label}
          </h5>
          <div className="grid">
            {group.domains.map((domain) => (
              <DomainRow
                key={domain}
                domain={domain}
                count={counts.perDomain[domain] ?? 0}
                scopeSize={counts.scopeSize}
                selected={selected.has(domain)}
                compact={compact}
                onToggle={() => onToggle(domain)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Today — the shipped sheet, reproduced                                      */
/* ------------------------------------------------------------------------- */

const TODAY_DOMAINS = [
  "All domains",
  "Attachment",
  "Trauma",
  "Cognition",
  "Affect",
  "Behaviour",
  "Interpersonal",
  "Defence",
  "Developmental",
  "Biological",
  "Social",
  "Cultural",
  "Risk",
];

function TodaySheet() {
  return (
    <div className="relative h-[36rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
      <Band compact count={2} active={0} />
      <div className="absolute inset-x-0 bottom-0 flex h-[82%] flex-col rounded-t-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]">
        <div className="flex shrink-0 justify-center pb-1 pt-2" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
        </div>
        <div className="flex shrink-0 items-start gap-3 border-b border-[color:var(--border)] p-3.5">
          <h4 className="min-w-0 flex-1 text-lg font-extrabold leading-tight text-[color:var(--text-heading)]">
            Filter formulation mechanisms
          </h4>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[color:var(--border)]">
            <X aria-hidden className="size-icon-md text-[color:var(--text-muted)]" />
          </span>
        </div>
        <div className="flex-1 overflow-hidden p-3.5">
          <h5 className="mb-1.5 text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
            Pattern
          </h5>
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              "Current search",
              "I keep going over it",
              "What if something goes wrong?",
              "Zero to one hundred",
              "I do not need anyone",
            ].map((label, index) => (
              <span
                key={label}
                className={cn(
                  "inline-flex min-h-tap items-center gap-1.5 rounded-md border px-2.5 text-2xs font-semibold",
                  index === 0
                    ? "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                )}
              >
                {index === 0 ? <Check aria-hidden className="h-3 w-3" /> : null}
                {label}
              </span>
            ))}
          </div>
          <h5 className="mb-1.5 text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
            Domain
          </h5>
          <div className="flex flex-wrap gap-2">
            {TODAY_DOMAINS.map((label, index) => (
              <span
                key={label}
                className={cn(
                  "inline-flex min-h-tap items-center gap-1.5 rounded-md border px-2.5 text-2xs font-semibold",
                  index === 0
                    ? "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                )}
              >
                {index === 0 ? <Check aria-hidden className="h-3 w-3" /> : null}
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[color:var(--border)] p-3.5">
          <span className="text-2xs font-semibold text-[color:var(--text-muted)]">2 showing</span>
          <span className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent)]">
            Done
          </span>
        </div>
      </div>
    </div>
  );
}

const TODAY_DEFECTS: ReadonlyArray<{ label: string; detail: string }> = [
  {
    label: "Three chips can never match anything",
    detail:
      "Biological, Social and Cultural are offered as domains and match 0 of the 12 mechanisms. Nothing distinguishes them from the nine that work. Counts expose this on sight.",
  },
  {
    label: "An authored grouping sits unused",
    detail:
      "formulationDomainGroups in src/lib/formulation.ts already sorts the twelve domains into four themes, each with a written description. The sheet ignores it and renders one flat ragged wrap.",
  },
  {
    label: "The title is the loudest thing on screen",
    detail:
      "“Filter formulation mechanisms” inside formulation mode — three of four words are implied. It is set at the same weight as the page H1 and paired with a boxed ✕ of near-equal weight.",
  },
  {
    label: "One preset is unreachable",
    detail:
      "The sheet renders formulationSearchPresets.slice(0, 4) of five, so “If it is not perfect” cannot be selected here at all.",
  },
  {
    label: "No counts, no scope, no commit",
    detail:
      "Every choice is blind, there is no way to filter beyond the 2 current results, and “2 showing” is a passive label beside a low-emphasis “Done”.",
  },
];

/* ------------------------------------------------------------------------- */
/* Study frame                                                                */
/* ------------------------------------------------------------------------- */

type StyleId = "a" | "b" | "c";

function StyleSheet({
  style,
  compact,
  scope,
  onScope,
  selected,
  onToggle,
  onClear,
}: {
  style: StyleId;
  compact: boolean;
  scope: Scope;
  onScope: (next: Scope) => void;
  selected: ReadonlySet<string>;
  onToggle: (domain: string) => void;
  onClear: () => void;
}) {
  const counts = useDomainCounts(scope, selected);
  const scopeCounts = useScopeCounts(selected);
  const scopeTotal = scopeMechanisms(scope).length;
  const otherCount = scope === "current" ? scopeCounts.all : scopeCounts.current;

  const header = (
    <>
      <SheetHeader
        compact={compact}
        total={counts.total}
        scopeTotal={scopeTotal}
        onClear={onClear}
        clearable={selected.size > 0}
        tone={style === "b" ? "accent" : "tinted"}
      />
      <div className="shrink-0 border-b border-[color:var(--border)] px-4 py-2.5">
        <ScopeSwitch value={scope} onChange={onScope} compact={compact} counts={scopeCounts} />
      </div>
    </>
  );

  const body =
    style === "a" ? (
      <StyleABody selected={selected} counts={counts} onToggle={onToggle} compact={compact} />
    ) : style === "b" ? (
      <StyleBBody selected={selected} counts={counts} onToggle={onToggle} compact={compact} />
    ) : (
      <StyleCBody selected={selected} counts={counts} onToggle={onToggle} compact={compact} />
    );

  const footer = (
    <CommitBar
      compact={compact}
      total={counts.total}
      scope={scope}
      otherCount={otherCount}
      onSwitchScope={() => onScope(scope === "current" ? "all" : "current")}
    />
  );

  if (compact) {
    return (
      <div className="relative h-[36rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
        <Band compact count={scopeCounts.current} active={selected.size} />
        <SheetShell header={header} footer={footer}>
          {body}
        </SheetShell>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="min-w-0">
        <Band compact={false} count={scopeCounts.current} active={selected.size} />
        <div className="mt-2 grid content-start gap-1.5">
          {matching(scope, selected)
            .slice(0, 4)
            .map((mechanism) => (
              <div
                key={mechanism.name}
                className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-2xs font-bold text-[color:var(--text)]">{mechanism.name}</span>
                  <span className="block truncate text-3xs font-medium text-[color:var(--text-soft)]">
                    {mechanism.domains.join(" · ")}
                  </span>
                </span>
              </div>
            ))}
          {counts.total === 0 ? (
            <span className="px-1 py-3 text-center text-3xs font-semibold text-[color:var(--text-soft)]">
              No mechanisms match this filter set.
            </span>
          ) : counts.total > 4 ? (
            <span className="px-1 text-3xs font-semibold text-[color:var(--text-soft)]">+ {counts.total - 4} more</span>
          ) : null}
        </div>
      </div>
      <div className="flex max-h-[30rem] flex-col overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

function PreviewFrame({
  label,
  phone = false,
  children,
}: {
  label: string;
  phone?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 max-w-full", phone && "mx-auto w-full max-w-[24.375rem]")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{phone ? "390 px" : "1440 px"}</span>
      </div>
      <div
        className={cn(
          // `w-full max-w-full` is load-bearing: without it the desktop specimen's
          // own `min-w-[46rem]` propagates out through the grid item and scrolls
          // the whole page at 320px instead of scrolling inside this box.
          "w-full max-w-full overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-inset)]",
          phone ? "p-2.5" : "p-4",
        )}
      >
        {/* The desktop specimen's min-width is gated at `sm`. Unconditional, it
            propagates out of the scroll box into the grid track and scrolls the
            whole page ~45px at 320px — the blocking narrow breakpoint — which was
            measured, not assumed. Below `sm` the specimen simply reflows; a
            1440px comp rendered at 320px carries no information anyway. */}
        <div className={cn(!phone && "sm:min-w-[46rem]")}>{children}</div>
      </div>
    </div>
  );
}

function StyleSection({
  id,
  eyebrow,
  title,
  lede,
  strengths,
  style,
  shared,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  strengths: ReadonlyArray<string>;
  style: StyleId;
  shared: {
    scope: Scope;
    onScope: (next: Scope) => void;
    selected: ReadonlySet<string>;
    onToggle: (domain: string) => void;
    onClear: () => void;
  };
}) {
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
    >
      <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <span className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
            {eyebrow}
          </span>
          <h2 id={id} className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">{lede}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:justify-end">
          {strengths.map((strength) => (
            <span
              key={strength}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-bold text-[color:var(--text-muted)]"
            >
              {strength}
            </span>
          ))}
        </div>
      </div>
      <div className="grid items-start gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(21rem,0.7fr)]">
        <PreviewFrame label="Desktop">
          <StyleSheet style={style} compact={false} {...shared} />
        </PreviewFrame>
        <PreviewFrame label="Phone" phone>
          <StyleSheet style={style} compact {...shared} />
        </PreviewFrame>
      </div>
    </section>
  );
}

const craft: ReadonlyArray<{ term: string; detail: string }> = [
  {
    term: "The title stops shouting the obvious",
    detail:
      "“Filter formulation mechanisms” becomes an accent eyebrow (Formulation) over a two-word title (Filter mechanisms) over a live result line. Three ranks of information in less vertical space than the single heavy string it replaces.",
  },
  {
    term: "Close is a ghost, not a box",
    detail:
      "The shipped ✕ is a bordered square at nearly the title's visual weight, so the eye lands on the dismiss control first. A borderless circle keeps the same 48px target and stops competing.",
  },
  {
    term: "The segment carries scope, not a verb",
    detail:
      "“These results 2 / All mechanisms 12”. A verb switch is set once; scope is chosen constantly, and until now the only way to widen past the current search was to clear the query and lose it.",
  },
  {
    term: "Zero-yield options are visibly different",
    detail:
      "Biological, Social and Cultural match nothing. Dashed border plus muted pair rather than opacity, so the distinction survives forced-colors, where border-style is kept and opacity is not.",
  },
  {
    term: "Groups come from the library, not the layout",
    detail:
      "The four themes and their descriptions are formulationDomainGroups, already written and already shipped. Using them costs nothing and replaces a twelve-chip ragged wrap with four labelled sets.",
  },
  {
    term: "The empty state has an exit",
    detail:
      "When a filter set empties the current results, the commit button becomes “Show N in all mechanisms”. The dead end becomes one tap, and the query is never discarded to reach it.",
  },
];

export function FilterSheetRestyleMockupsPage() {
  const [scope, setScope] = useState<Scope>("current");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set<string>(["Cognition"]));

  const toggle = useCallback((domain: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set<string>()), []);
  const shared = { scope, onScope: setScope, selected, onToggle: toggle, onClear: clear };
  const scopeCounts = useScopeCounts(selected);

  return (
    <main className="min-h-dvh bg-[color:var(--surface-inset)] pb-16 text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto grid max-w-[92rem] gap-4 px-4 py-8 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <span className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
              Shared filter sheet · restyle
            </span>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-[color:var(--text-heading)]">
              Three styles, and a real job for the segment bar
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              Drawn on the formulation sheet, which stresses the layout hardest: four domain themes, twelve domains,
              twelve mechanisms, four presets, thirteen domain chips and the longest title in the app. The three
              directions share one set of craft fixes and differ only in how the options are arranged — flat, carded, or
              listed.
            </p>
            <p className="mt-2 max-w-3xl text-xs font-semibold text-[color:var(--text-soft)]">
              Counts are live, from the 12 mechanisms in{" "}
              <code className="font-mono text-3xs">src/data/formulation-content.json</code>. All three frames share one
              selection and one scope, so a domain chosen anywhere updates the whole page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5">
            <Shield aria-hidden className="size-icon-md shrink-0 text-[color:var(--clinical-accent)]" />
            <span className="min-w-0 flex-1 text-xs font-bold text-[color:var(--text)]">
              Scope{" "}
              <span className="font-black text-[color:var(--clinical-accent)]">
                {scope === "all" ? "all mechanisms" : "these results"}
              </span>
              {" · "}
              {selected.size === 0
                ? "no domains selected"
                : `${selected.size} domain${selected.size === 1 ? "" : "s"}`}{" "}
              — {scope === "all" ? scopeCounts.all : scopeCounts.current} match
            </span>
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={clear}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-2xs font-bold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                  focusRing,
                )}
              >
                <RotateCcw aria-hidden className="h-3 w-3" />
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="restyle-today"
          className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
        >
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5">
            <span className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--danger)]">Today</span>
            <h2 id="restyle-today" className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">
              The shipped formulation sheet
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              Reproduced from the live component. The problems are craft, but two of them are also correctness.
            </p>
          </div>
          <div className="grid items-start gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(21rem,0.6fr)_minmax(0,1fr)]">
            <PreviewFrame label="Phone · today" phone>
              <TodaySheet />
            </PreviewFrame>
            <ul className="grid content-start gap-2">
              {TODAY_DEFECTS.map((defect) => (
                <li
                  key={defect.label}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5"
                >
                  <p className="text-2xs font-extrabold text-[color:var(--text-heading)]">{defect.label}</p>
                  <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{defect.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <StyleSection
          id="restyle-style-a"
          eyebrow="Style A"
          title="Refined clinical"
          lede="The shipped structure with the craft fixed. Tinted header band, eyebrow-over-title-over-live-count, ghost close, themed group headings with a selected badge, and one uniform chip with a checkbox and a count. Closest to what exists, so it is the cheapest to adopt and the least likely to surprise anyone."
          strengths={["Cheapest to adopt", "Same shape, better craft", "No new containers"]}
          style="a"
          shared={shared}
        />

        <StyleSection
          id="restyle-style-b"
          eyebrow="Style B"
          title="Themed cards"
          lede="Each of the four themes becomes its own card carrying the icon, the label and the description the library already wrote — and tinting itself when it holds a selection, so an active dimension is visible without reading a single chip. The most structured of the three, and the best answer to a sheet that has to hold twelve domain options without feeling like a word cloud."
          strengths={["Uses the authored descriptions", "Active group visible at a glance", "Best for many options"]}
          style="b"
          shared={shared}
        />

        <StyleSection
          id="restyle-style-c"
          eyebrow="Style C"
          title="Dense list"
          lede="Full-width rows with a checkbox, a proportion bar and a right-aligned count, under sticky group headings that survive the scroll. Trades the chip's compactness for perfect vertical alignment and a scannable count column — the shape a reader can run down quickly when they know which domain they want."
          strengths={["Scannable count column", "Sticky group context", "Highest density"]}
          style="c"
          shared={shared}
        />

        <section
          aria-labelledby="restyle-craft"
          className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
        >
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5">
            <h2 id="restyle-craft" className="text-lg font-extrabold text-[color:var(--text-heading)]">
              The craft fixes, shared by all three
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              These are the parts that are not a matter of taste between the directions.
            </p>
          </div>
          <dl className="grid gap-0 sm:grid-cols-2">
            {craft.map((entry, index) => (
              <div
                key={entry.term}
                className={cn(
                  "border-[color:var(--border)] px-4 py-3.5 sm:px-5",
                  index > 0 && "border-t",
                  index % 2 === 1 && "sm:border-l",
                  index === 1 && "sm:border-t-0",
                )}
              >
                <dt className="text-sm-minus font-bold text-[color:var(--text-heading)]">{entry.term}</dt>
                <dd className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{entry.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="restyle-notes"
          className="rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-4 sm:px-5"
        >
          <h2 id="restyle-notes" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            Before this becomes production
          </h2>
          <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-sm font-medium text-[color:var(--text-muted)]">
            <li>
              <strong className="font-bold text-[color:var(--text)]">
                Biological, Social and Cultural should be fixed, not just labelled.
              </strong>{" "}
              Counts make three dead chips visible, which is an improvement — but the real answer is either to tag
              mechanisms into those domains or to stop offering them. Shipping a permanent “0” is a worse admission than
              shipping nothing.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">Scope needs a home in the URL.</strong> If it is
              not round-tripped, a shared link silently reverts to the current-results scope and the recipient sees a
              different set from the sender.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">The pattern group is still a navigation.</strong>{" "}
              These comps show only the domain dimension restyled; patterns replace the query, so they need the
              separated, arrow-marked treatment from the earlier study rather than a checkbox.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">
                Style C&rsquo;s sticky headings need a scroll-owner check.
              </strong>{" "}
              A sticky element inside the sheet body is a second scroll context on phones — read{" "}
              <code className="font-mono text-xs">docs/search-chrome-behaviour.md</code> before adopting it.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">Mockups skip two gates, not all of them.</strong>{" "}
              Every control here is at <code className="font-mono text-xs">min-h-tap</code> (48px) on phone; do not
              relax to 44px for generic a11y guidance, which reintroduces a known{" "}
              <code className="font-mono text-xs">ui-smoke</code> flake.
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
