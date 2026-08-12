"use client";

import { Check, ChevronDown, Funnel, Search, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui-primitives";

/**
 * The phone filter idiom, shared.
 *
 * Every search mode used to hand the ribbon a `w-full` native `<select>` on
 * phones. That control cost a mode its whole second band line, could not show
 * more than one filter dimension without a two-column grid of selects, could not
 * report how many filters were active without spending label width on it, and —
 * because `globals.css` pins every native select to 16px below `sm` to stop iOS
 * zooming on focus — rendered its value at the same size as the query heading it
 * sat under. Documents replaced it with a badged trigger that opens a sheet, the
 * band collapsed to one line, and that is the design every mode now uses.
 *
 * Two pieces:
 * - `ResultFilterTrigger` — the compact badged control that goes in the ribbon's
 *   `mobileControls` slot (with `mobileControlsPlacement="inline"`, which is what
 *   makes the one-line band legal — see `search-results-header-band.tsx`).
 * - `ResultFilterSheet` — a single-choice sheet for the modes whose filters are
 *   one-of-N per dimension. Documents keeps its own panel: its filters are
 *   multi-select facet groups with counts, a find-a-filter field and
 *   collapse-by-default, none of which a radio sheet can express.
 *
 * Desktop is untouched. The ribbon renders `filterControls` from `sm` up and
 * `mobileControls` below it, never both, so each mode keeps the chip row or tab
 * strip it already had on a wide screen.
 */

export type ResultFilterOption<Value extends string> = {
  value: Value;
  label: string;
  /** Trailing detail — a count, a qualifier. Never the only thing distinguishing two options. */
  hint?: string;
  /** Renders as a dead end: focusable and explained, but not selectable. */
  disabled?: boolean;
};

/**
 * A dimension the sheet can render, discriminated by what it MEANS rather than
 * by how it should look.
 *
 * `lens` — one-of-N. The options partition the result set and exactly one is
 * active: differentials' All/Presentations/Diagnoses, medication's
 * Best/Indication/Safety/Monitor. This is the shape every call site uses today,
 * so it is the default and `kind` may be omitted.
 *
 * `facet` — many-of-N, OR within the group and AND across groups. Formulation's
 * domains and the documents tag groups are facets; rendering them as radios (as
 * formulation does today) claims a reader cannot hold two domains at once,
 * which is false.
 *
 * There is deliberately no `navigate` kind. Options that replace the query
 * rather than narrowing the result set do not belong in a control called
 * "Filter" — see `docs/filter-contract.md`.
 */
export type ResultFilterGroupKind = "lens" | "facet";

type ResultFilterGroupBase = {
  /** Stable within one sheet; used for the group's own labelling ids. */
  id: string;
  label: string;
  options: ReadonlyArray<ResultFilterOption<string>>;
};

export type ResultFilterLensGroup = ResultFilterGroupBase & {
  kind?: "lens";
  value: string;
  onChange: (value: string) => void;
};

export type ResultFilterFacetGroup = ResultFilterGroupBase & {
  kind: "facet";
  /** Selected option values. Empty means the group imposes no constraint. */
  selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
};

export type ResultFilterGroup = ResultFilterLensGroup | ResultFilterFacetGroup;

export function isFacetGroup(group: ResultFilterGroup): group is ResultFilterFacetGroup {
  return group.kind === "facet";
}

/**
 * Builds a type-checked group for `ResultFilterSheet`.
 *
 * The sheet holds groups of different value unions in one array, which no single
 * generic parameter can express. This narrows at the call site — `value`,
 * `options[].value` and `onChange` are checked against one `Value` — and erases
 * once. The erasure is sound because the sheet only ever invokes `onChange` with
 * a value taken from that same group's `options`, so nothing outside `Value` can
 * reach the callback.
 */
export function resultFilterGroup<Value extends string>(group: {
  id: string;
  label: string;
  value: Value;
  options: ReadonlyArray<ResultFilterOption<Value>>;
  onChange: (value: Value) => void;
}): ResultFilterGroup {
  return {
    kind: "lens",
    id: group.id,
    label: group.label,
    value: group.value,
    options: group.options,
    // The one narrowing, isolated here rather than repeated at seven call sites.
    onChange: (value) => group.onChange(value as Value),
  };
}

/**
 * Builds a type-checked multi-select facet group.
 *
 * Same erasure argument as `resultFilterGroup`: `selected`, `options[].value`
 * and `onToggle` are checked against one `Value` at the call site and widen to
 * `string` once, and the sheet only ever passes back a value taken from this
 * group's own options.
 *
 * Counts belong in `option.hint` and must be produced by the same predicate as
 * the filter — "how many would I have if I ticked this as well" — because under
 * OR-within-group, adding to an already-selected group *widens*. The companion
 * rule is that the option list is derived from the data rather than declared,
 * which is what stops a permanently empty option ever reaching this function.
 * Both rules and the reasoning are in `docs/filter-contract.md`.
 */
export function resultFilterFacetGroup<Value extends string>(group: {
  id: string;
  label: string;
  selected: ReadonlySet<Value>;
  options: ReadonlyArray<ResultFilterOption<Value>>;
  onToggle: (value: Value) => void;
  // Returns the narrow facet type, not the union: a mode hands the same group
  // to `ResultFilterSheet` (which takes the union) and to
  // `ResultFilterFacetChips` for its desktop rail (which does not).
}): ResultFilterFacetGroup {
  return {
    kind: "facet",
    id: group.id,
    label: group.label,
    selected: group.selected as ReadonlySet<string>,
    options: group.options,
    onToggle: (value) => group.onToggle(value as Value),
  };
}

/**
 * Opens a filter panel and reports how many filters are active.
 *
 * Faithfully the control documents shipped, lifted here so seven modes cannot
 * drift apart. Written out rather than composed from `floatingControl`: this is
 * the band's own control recipe — the same one `Save search` and `Retry` use — so
 * a trigger sitting flush against the sort group is structurally the same
 * component rather than a near-match.
 */
export function ResultFilterTrigger({
  panelId,
  testId,
  open,
  activeCount,
  onToggle,
  title,
  label = "Filter",
}: {
  panelId: string;
  /** Distinct per slot when a page renders the trigger more than once: both
      copies are in the DOM, so a shared id makes every `getByTestId` lookup
      ambiguous under Playwright strict mode even though only one is displayed. */
  testId: string;
  open: boolean;
  activeCount: number;
  onToggle: () => void;
  /** Pointer tooltip, e.g. "Filter services". The accessible name comes from the
      visible label plus the state note below, so this is decoration. */
  title: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls={open ? panelId : undefined}
      data-testid={testId}
      title={title}
      className={cn(
        // 10px leading, 11px trailing. Symmetric padding measures right and looks
        // wrong here: a filled pill reads flush to its own edge while a stroked
        // funnel reads inset from its box, so equal values put the badge visibly
        // closer to the border than the glyph is.
        "search-band-ghost inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center gap-1.5 rounded-lg border pl-2.5 pr-[0.6875rem] transition-colors motion-reduce:transition-none sm:min-h-10 sm:min-w-10",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        // Mutually exclusive branches rather than a base plus an override. `cn`
        // merges now, so a later utility would win deterministically — but
        // collapsing these changes which classes render at all, and that is a
        // visual change rather than a dependency swap.
        activeCount > 0
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
      )}
    >
      <Funnel aria-hidden="true" className="size-icon-md shrink-0" />
      {/* The label is the first thing to go when the line is tight — but only
          where the line is actually tight. Below 414px the band gives the
          utilities their own row, and on that row there is room for the wordmark
          several times over. 414–429px is the one band that is genuinely
          single-line and short of width; there a funnel carrying a badge is
          unambiguous. The accessible name is unchanged at every width. */}
      <span className="min-[414px]:max-[429px]:sr-only">{label}</span>
      {activeCount > 0 ? (
        // A tinted pill, not a solid disc: a saturated filled circle is the single
        // loudest signal on a bar that is otherwise hairlines and type, and it
        // reads as an alert rather than as a count.
        <span className="search-band-badge nums grid h-[1.0625rem] min-w-[1.0625rem] place-items-center rounded-full bg-[color:var(--search-band-badge-bg)] px-1 text-2xs font-bold text-[color:var(--clinical-accent)]">
          {activeCount}
        </span>
      ) : null}
      <span className="sr-only">
        {activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} active` : "No filters active"}
      </span>
    </button>
  );
}

/**
 * A single radio group inside the filter sheet.
 *
 * Implements the roving-tabIndex pattern (Arrow keys + Home/End, single tab
 * stop) so the group behaves like a real radio group for keyboard users —
 * consistent with `SegmentedControl` and matching the `role="radiogroup"` it
 * exposes to AT. Announcing "radio, 1 of 4" and then not answering an arrow key
 * would be worse than exposing no role at all, because the role is what promises
 * the interaction.
 *
 * Arrow keys select as they move, which is the ARIA default and also what the
 * native `<select>` this replaced already did on desktop. That matters for the
 * groups whose `onChange` navigates (services' quick filters, formulation's
 * patterns): arrowing commits, exactly as it did before, so the role introduces
 * no new hazard there.
 *
 * A dead-end option stays on the arrow path but is never selected by it. That is
 * the ARIA guidance for a disabled radio, and it is the only arrangement that
 * satisfies both halves of the problem: a keyboard reader can reach the option
 * and hear its "Not selectable from here" note, while the group keeps the single
 * tab stop the radio contract requires. Giving dead ends `tabIndex={0}` instead
 * would make them reachable — and would add a second, third and fourth tab stop
 * to a control whose whole point is having one.
 *
 * No call site produces a dead end today: `deadEnd` is `disabled && !selected`,
 * and every placeholder this component ships with (services' "Current search" /
 * "All services", formulation's "Current search") is rendered only while it is
 * the *selected* option. This path is therefore defensive, and is asserted in the
 * DOM tests so it cannot rot before the first mode needs it.
 */
function FilterRadioGroup({ group, panelId }: { group: ResultFilterLensGroup; panelId: string }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const groupLabelId = `${panelId}-${group.id}-label`;

  const isDeadEnd = (option: ResultFilterOption<string>) => Boolean(option.disabled) && option.value !== group.value;
  // Every option is on the arrow path, dead ends included — moving to one is how
  // its explanation gets announced. Only *selection* is withheld.
  const selectable = group.options.filter((option) => !isDeadEnd(option));
  // The roving tab stop is the selected option; fall back to the first
  // selectable one when the value matches no option (a stale URL param, or a
  // catalogue that dropped a category between renders).
  const tabStopValue = selectable.some((o) => o.value === group.value) ? group.value : selectable[0]?.value;

  const moveTo = useCallback(
    (next: ResultFilterOption<string> | undefined) => {
      if (!next) return;
      // Focus always moves; selection only follows for an option that can hold
      // it. Arrowing onto a dead end must not silently commit the option before
      // it, and must not leave focus behind either.
      refs.current.get(next.value)?.focus();
      if (Boolean(next.disabled) && next.value !== group.value) return;
      group.onChange(next.value);
    },
    [group],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const options = group.options;
      if (!options.length) return;
      const currentValue = (event.target as HTMLElement).dataset.radioValue;
      const current = Math.max(
        options.findIndex((o) => o.value === currentValue),
        0,
      );
      let next: number | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % options.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        next = (current - 1 + options.length) % options.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = options.length - 1;
      if (next == null) return;
      // The sheet scrolls and the chips wrap, so without this Arrow/Home/End
      // would also scroll the panel out from under the option being moved to.
      event.preventDefault();
      moveTo(options[next]);
    },
    [group.options, moveTo],
  );

  return (
    <section className="min-w-0 border-t border-[color:var(--border)] py-1 first:border-t-0">
      <h3
        id={groupLabelId}
        className="flex min-h-9 items-center text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]"
      >
        {group.label}
      </h3>
      <div
        role="radiogroup"
        aria-labelledby={groupLabelId}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-2 pb-2.5 sm:gap-1.5"
      >
        {group.options.map((option) => {
          const selected = option.value === group.value;
          const deadEnd = Boolean(option.disabled) && !selected;
          const deadEndDescId = `${panelId}-${group.id}-${option.value.replace(/[^A-Za-z0-9_-]/g, "-")}-note`;
          return (
            <button
              key={option.value}
              ref={(node) => {
                if (node) refs.current.set(option.value, node);
                else refs.current.delete(option.value);
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              // Without this the label and hint spans concatenate to "All8" in
              // the accessible name — the name computation normalises the
              // inter-element whitespace away, so a text-node separator cannot
              // fix it. Same defect and same fix as SegmentedControl, which is
              // what lets one shared option array announce identically on the
              // desktop rail and in this sheet.
              aria-label={option.hint ? `${option.label} (${option.hint})` : undefined}
              // `aria-disabled` rather than `disabled`: a real disabled
              // button leaves the tab order, so a keyboard or screen-reader
              // user loses the option entirely and never learns why. Kept
              // focusable and explained, with the click guarded instead —
              // the disabled-affordance pattern in docs/wiring-conventions.md.
              aria-disabled={deadEnd || undefined}
              aria-describedby={deadEnd ? deadEndDescId : undefined}
              // One tab stop for the whole group — the radio contract. Without it
              // a reader Tabs through every option of every dimension to reach
              // Done. A dead end is never `tabStopValue` (it is filtered out of
              // `selectable`, which is where that value comes from), so it always
              // lands on -1 here; see the note on this component about the
              // announcement that costs.
              tabIndex={option.value === tabStopValue ? 0 : -1}
              data-radio-value={option.value}
              onClick={() => {
                if (deadEnd) return;
                group.onChange(option.value);
              }}
              className={cn(
                // The tap floor is the token, relaxing to compact density
                // from `sm` where a pointer is likely. Same recipe as the
                // documents facet chips, so the two sheets read as one
                // component family.
                "inline-flex min-h-tap max-w-full items-center gap-1.5 rounded-md border px-2.5 text-2xs font-semibold shadow-[var(--shadow-inset)] transition motion-reduce:transition-none sm:min-h-9 sm:gap-1 sm:px-2 lg:min-h-8",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                selected
                  ? "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : deadEnd
                    ? // Not `opacity-50`. Transparency multiplies against an
                      // already-muted foreground; a real muted pair plus a
                      // dashed border reads as a different KIND of thing
                      // rather than a faded one, and survives forced colors,
                      // where border-style is preserved and opacity is not.
                      "cursor-default border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
                    : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
              )}
            >
              {selected ? <Check aria-hidden="true" className="h-3 w-3 shrink-0" /> : null}
              <span className="truncate">{option.label}</span>
              {option.hint ? <span className="nums text-[color:var(--text-muted)]">{option.hint}</span> : null}
              {deadEnd ? (
                <span id={deadEndDescId} className="sr-only">
                  Not selectable from here.
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * A multi-select facet group, exported so a mode renders the SAME control in
 * its desktop rail as in its phone sheet.
 *
 * The lens modes converge on `SegmentedControl` at both breakpoints; facets had
 * no such primitive, and the alternative was a second hand-rolled chip row per
 * mode — which is exactly how the breakpoints came to disagree in the first
 * place. `idPrefix` scopes the labelling ids, so the two copies can coexist in
 * one page without colliding.
 *
 * Deliberately NOT a radio group. `aria-pressed` toggles inside a
 * `role="group"` are the honest reading of many-of-N: each control is
 * independently on or off, and nothing claims the options are mutually
 * exclusive. That also means no roving tabindex — a reader must be able to
 * reach every toggle, and arrow-to-select would commit constraints they did not
 * ask for. The single tab stop the lens groups use is correct there precisely
 * because arrowing *replaces* rather than accumulates.
 *
 * A zero-count option is a dead end: still focusable and explained, never
 * silently dropped, because a reader who has just narrowed to nothing needs to
 * see which of their choices did it. Under the derived-option-list rule such an
 * option can only appear as a consequence of the current selection, never as a
 * permanent fixture of the catalogue.
 */
/**
 * Present only when the sheet is dense (see `ResultFilterSheet`) and the
 * reader is not mid-search: the group becomes a disclosure, collapsed unless
 * it holds a selection or has been explicitly opened. A live needle owns
 * openness instead (every matched group is forced open) — see
 * `ResultFilterSheet` for why a control that never gets to act is worse than
 * none at all.
 */
type FacetGroupDisclosure = { open: boolean; onToggle: () => void; contentId: string };

export function ResultFilterFacetChips({
  group,
  idPrefix,
  options,
  disclosure,
}: {
  group: ResultFilterFacetGroup;
  idPrefix: string;
  /** Needle-filtered subset; defaults to every option in the group. */
  options?: ReadonlyArray<ResultFilterOption<string>>;
  disclosure?: FacetGroupDisclosure;
}) {
  const panelId = idPrefix;
  const groupLabelId = `${panelId}-${group.id}-label`;
  const visibleOptions = options ?? group.options;

  return (
    <section className="min-w-0 border-t border-[color:var(--border)] py-1 first:border-t-0">
      <h3 className="flex min-h-9 items-center gap-1.5 text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
        {/* The id is on the label text alone, not the heading. With the badge
            inside the labelled element the group's accessible name became
            "Domain 1" — the selection count leaking into the dimension's name,
            and changing it on every toggle. Caught by the DOM test. */}
        {disclosure ? (
          <button
            type="button"
            aria-expanded={disclosure.open}
            aria-controls={disclosure.contentId}
            onClick={disclosure.onToggle}
            className={cn(
              "flex min-h-tap w-full items-center gap-1.5 text-left text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)] sm:min-h-10",
              "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus)]",
            )}
          >
            <span id={groupLabelId} className="truncate">
              {group.label}
            </span>
            {group.selected.size > 0 ? (
              <span className="nums ml-auto text-2xs font-semibold text-[color:var(--clinical-accent)]">
                {group.selected.size} selected
              </span>
            ) : null}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-icon-sm shrink-0 text-[color:var(--decoration-soft)] transition-transform motion-reduce:transition-none",
                group.selected.size > 0 ? "ml-1.5" : "ml-auto",
                disclosure.open ? "rotate-0" : "-rotate-90",
              )}
            />
          </button>
        ) : (
          <>
            <span id={groupLabelId}>{group.label}</span>
            {group.selected.size > 0 ? (
              <span className="nums rounded-full bg-[color:var(--clinical-accent-soft)] px-1.5 text-3xs font-black tabular-nums text-[color:var(--clinical-accent)]">
                <span className="sr-only">{group.selected.size} selected</span>
                <span aria-hidden>{group.selected.size}</span>
              </span>
            ) : null}
          </>
        )}
      </h3>
      <div
        id={disclosure?.contentId}
        hidden={disclosure ? !disclosure.open : false}
        role="group"
        aria-labelledby={groupLabelId}
        className="flex flex-wrap gap-2 pb-2.5 sm:gap-1.5"
      >
        {visibleOptions.map((option) => {
          const selected = group.selected.has(option.value);
          const deadEnd = Boolean(option.disabled) && !selected;
          const deadEndDescId = `${panelId}-${group.id}-${option.value.replace(/[^A-Za-z0-9_-]/g, "-")}-note`;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              aria-disabled={deadEnd || undefined}
              aria-describedby={deadEnd ? deadEndDescId : undefined}
              // Same concatenation defect as the lens chips above: a facet
              // count would otherwise be announced as "Crisis12".
              aria-label={option.hint ? `${option.label} (${option.hint})` : undefined}
              onClick={() => {
                if (deadEnd) return;
                group.onToggle(option.value);
              }}
              className={cn(
                // Same recipe and the same tap floor as the lens chips, so the
                // two kinds read as one component family at every breakpoint.
                "inline-flex min-h-tap max-w-full items-center gap-1.5 rounded-md border px-2.5 text-2xs font-semibold shadow-[var(--shadow-inset)] transition motion-reduce:transition-none sm:min-h-9 sm:gap-1 sm:px-2 lg:min-h-8",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                selected
                  ? "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : deadEnd
                    ? "cursor-default border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
                    : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
              )}
            >
              {/* A box rather than a tick-only cue: the empty state has to be as
                  legible as the checked one for a control that accumulates. */}
              <span
                aria-hidden
                className={cn(
                  "grid size-icon-sm shrink-0 place-items-center rounded-xs border transition-colors",
                  selected
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
                    : "border-[color:var(--border-strong)] bg-[color:var(--surface)]",
                )}
              >
                {selected ? <Check aria-hidden="true" className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
              </span>
              <span className="truncate">{option.label}</span>
              {option.hint ? <span className="nums text-[color:var(--text-muted)]">{option.hint}</span> : null}
              {deadEnd ? (
                <span id={deadEndDescId} className="sr-only">
                  No matches with your current filters.
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * A single-choice filter sheet: one radio group per dimension, plus
 * many-of-N facet groups.
 *
 * `role="radiogroup"` with real radio semantics rather than the `aria-pressed`
 * toggles the desktop chip rows use, because these dimensions are genuinely
 * one-of-N — a reader who has selected "Presentations" cannot also be on
 * "Diagnoses", and a bank of independent pressed-states says they could.
 *
 * `Sheet` returns null when `open` is false (unmounted), so it holds no chrome
 * state of its own that could survive a new search. Selection lives in the page,
 * exactly where the desktop control already reads and writes it, which is what
 * keeps the two breakpoints in agreement.
 *
 * **Density.** More than three facet groups (docs/filter-contract.md section
 * 5 — the same threshold document-search-results.tsx already uses) adds a
 * find-a-filter field and collapses every facet group by default. Below that
 * threshold every group renders exactly as before this was added — no mode
 * with three or fewer facet groups (formulation has one) sees any change.
 * A group holding a selection opens itself; an explicit collapse beats that;
 * a live needle owns openness instead and forces every matched group open,
 * because a disclosure that cannot act while search is filtering its content
 * is worse than no disclosure at all. A selected option always survives the
 * needle — filtering it out would make an active constraint un-untoggleable
 * without first clearing the field.
 */
export function ResultFilterSheet({
  open,
  onClose,
  panelId,
  testId,
  title,
  description,
  groups,
  onClearAll,
  footerNote,
  /** Result-set identity for the dense-mode chrome below (the find-a-filter
      text and per-group collapse state). Changing it clears that chrome, so a
      new search or scope change cannot leave a stale needle filtering a list
      it no longer describes. Only meaningful once a sheet goes dense (more
      than three facet groups); a sheet that never does can omit it. */
  chromeResetKey = "",
  /** The scope segment (docs/filter-contract.md section 4) — "These results
      N | All items N" — rendered above the groups when the calling mode has
      a catalogue meaningfully larger than its current result set. Built by
      the caller from `SegmentedControl` rather than owned here: the sheet
      only reserves the slot, since "meaningfully larger" and what the two
      counts mean are per-mode judgements, not something a shared filter
      renderer can decide. */
  scopeControl,
}: {
  open: boolean;
  onClose: () => void;
  panelId: string;
  testId: string;
  title: string;
  description?: string;
  groups: ReadonlyArray<ResultFilterGroup>;
  /** Omit to hide the header's Clear. A control that advertises an action must
      perform one, so pass this only when something is actually clearable. */
  onClearAll?: () => void;
  footerNote?: ReactNode;
  chromeResetKey?: string;
  scopeControl?: ReactNode;
}) {
  // Hooks run unconditionally — the empty-groups early return happens below,
  // after every hook the render needs has already been declared.
  const [chrome, setChrome] = useState<{
    key: string;
    needle: string;
    expanded: ReadonlySet<string>;
    collapsed: ReadonlySet<string>;
  }>(() => ({ key: chromeResetKey, needle: "", expanded: new Set(), collapsed: new Set() }));
  // Reset the chrome state when the reset key changes. Using an effect avoids
  // calling setState during render (which React warns against and can cause
  // loops under Strict Mode / concurrent rendering). The `scoped` fallback
  // below already returns empty values when the key is stale, so there is no
  // visible flash on the transitional render before the effect fires.
  useEffect(() => {
    setChrome({ key: chromeResetKey, needle: "", expanded: new Set(), collapsed: new Set() });
  }, [chromeResetKey]);
  // Prefer the scoped values even on the transitional render before the
  // setState above commits, so a stale needle cannot flash for one frame.
  const scoped = chrome.key === chromeResetKey;
  const needle = scoped ? chrome.needle : "";
  const expanded = scoped ? chrome.expanded : new Set<string>();
  const collapsed = scoped ? chrome.collapsed : new Set<string>();
  const setNeedle = (value: string) => setChrome((current) => ({ ...current, key: chromeResetKey, needle: value }));
  const toggleGroupOpen = (groupId: string, isOpen: boolean) => {
    setChrome((current) => {
      const nextExpanded = new Set(current.key === chromeResetKey ? current.expanded : []);
      const nextCollapsed = new Set(current.key === chromeResetKey ? current.collapsed : []);
      if (isOpen) {
        nextExpanded.delete(groupId);
        nextCollapsed.add(groupId);
      } else {
        nextExpanded.add(groupId);
        nextCollapsed.delete(groupId);
      }
      return {
        key: chromeResetKey,
        needle: current.key === chromeResetKey ? current.needle : "",
        expanded: nextExpanded,
        collapsed: nextCollapsed,
      };
    });
  };

  if (groups.length === 0) return null;

  const facetGroupCount = groups.filter(isFacetGroup).length;
  const dense = facetGroupCount > 3;
  const trimmedNeedle = needle.trim().toLowerCase();
  const activeNeedle = dense ? trimmedNeedle : "";
  const findFieldId = `${panelId}-find`;

  // Needle-filtered option lists per facet group, computed once so both the
  // render and the "N filters match" live region agree. A selected option
  // always survives — see the density note above.
  const facetOptionsById = new Map<string, ReadonlyArray<ResultFilterOption<string>> | undefined>();
  let matchedOptionCount = 0;
  let anyFacetGroupVisible = false;
  for (const group of groups) {
    if (!isFacetGroup(group)) continue;
    if (!activeNeedle) {
      facetOptionsById.set(group.id, undefined);
      anyFacetGroupVisible = true;
      continue;
    }
    const filtered = group.options.filter(
      (option) =>
        group.selected.has(option.value) ||
        option.label.toLowerCase().includes(activeNeedle) ||
        group.label.toLowerCase().includes(activeNeedle),
    );
    facetOptionsById.set(group.id, filtered);
    matchedOptionCount += filtered.length;
    if (filtered.length > 0) anyFacetGroupVisible = true;
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      portal
      id={panelId}
      testId={testId}
      headerActions={
        onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            data-testid={`${testId}-clear`}
            className={cn(
              "search-band-ghost inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-2xs font-bold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-8",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
            )}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Clear filters
          </button>
        ) : null
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 text-2xs font-semibold text-[color:var(--text-muted)]">{footerNote}</span>
          <button
            type="button"
            onClick={onClose}
            data-testid={`${testId}-done`}
            className={cn(
              "inline-flex min-h-tap shrink-0 items-center justify-center rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent)] sm:min-h-9",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
            )}
          >
            Done
          </button>
        </div>
      }
    >
      <div className="grid min-w-0 gap-1">
        {scopeControl ? (
          <div className="min-w-0 border-b border-[color:var(--border)] pb-2.5">{scopeControl}</div>
        ) : null}
        {dense ? (
          <div className="min-w-0 pb-2.5">
            <label htmlFor={findFieldId} className="sr-only">
              Find a filter
            </label>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]">
              <Search aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--decoration-soft)]" />
              <input
                id={findFieldId}
                type="search"
                value={needle}
                onChange={(event) => setNeedle(event.target.value)}
                placeholder="Find a filter…"
                data-testid={`${testId}-find`}
                className="min-h-tap min-w-0 flex-1 bg-transparent text-xs font-semibold text-[color:var(--text)] outline-none placeholder:font-medium placeholder:text-[color:var(--text-placeholder)] sm:min-h-9"
              />
              {needle ? (
                <button
                  type="button"
                  onClick={() => setNeedle("")}
                  aria-label="Clear the filter search"
                  className="grid min-h-tap min-w-tap place-items-center text-[color:var(--decoration-soft)] hover:text-[color:var(--text)] sm:min-h-8 sm:min-w-8"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <p aria-live="polite" className="sr-only">
              {activeNeedle
                ? `${matchedOptionCount} filter${matchedOptionCount === 1 ? "" : "s"} match "${needle.trim()}"`
                : ""}
            </p>
          </div>
        ) : null}
        {groups.map((group) => {
          if (!isFacetGroup(group)) {
            return <FilterRadioGroup key={group.id} group={group} panelId={panelId} />;
          }
          const filteredOptions = facetOptionsById.get(group.id);
          // A needle that matched nothing in this group hides it entirely,
          // matching document-search-results.tsx: a heading over zero options
          // is a section with nothing to disclose.
          if (activeNeedle && (filteredOptions?.length ?? 0) === 0) return null;
          const selectedCount = group.options.filter((option) => group.selected.has(option.value)).length;
          const isOpen =
            !dense ||
            Boolean(activeNeedle) ||
            (!collapsed.has(group.id) && (expanded.has(group.id) || selectedCount > 0));
          return (
            <ResultFilterFacetChips
              key={group.id}
              group={group}
              idPrefix={panelId}
              options={filteredOptions}
              disclosure={
                dense && !activeNeedle
                  ? {
                      open: isOpen,
                      onToggle: () => toggleGroupOpen(group.id, isOpen),
                      contentId: `${panelId}-${group.id}-content`,
                    }
                  : undefined
              }
            />
          );
        })}
        {activeNeedle && !anyFacetGroupVisible ? (
          <p className="border-t border-[color:var(--border)] py-4 text-center text-xs font-semibold text-[color:var(--text-muted)]">
            No filter matches &ldquo;{needle.trim()}&rdquo;.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
