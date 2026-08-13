"use client";

import { Check, ChevronDown, Funnel, Search, X } from "lucide-react";
import { type ReactNode, useCallback, useId, useRef, useState } from "react";

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
 * - `ResultFilterSheet` — the shared sheet for every mode's filters, lens and
 *   facet alike. Below the density threshold (`docs/filter-contract.md` §5) a
 *   facet group is a plain chip row; above it, the sheet grows a find-a-filter
 *   field and collapse-by-default per group. Documents (the largest surface —
 *   up to 11 facet groups) converged onto this in PR F; `meterContent` and
 *   `footerOverride` exist because its progress meter and "Show N documents" /
 *   "Browse all sources" footer are richer than every other mode's plain
 *   `footerNote` + "Done".
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
  /** Short annotation beside the group's heading — e.g. "one only". For a lens
      sitting directly beside facet groups in the same sheet, both render as
      chips of near-identical size and colour, so the OR-within/AND-across
      facet model and the lens's own exclusivity have to be told apart by more
      than role alone. Omit for a sheet with no facet groups; the roving
      radiogroup already says "one active" on its own there. */
  note?: string;
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
  note?: string;
}): ResultFilterGroup {
  return {
    kind: "lens",
    id: group.id,
    label: group.label,
    value: group.value,
    options: group.options,
    note: group.note,
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
      <h3 className="flex min-h-9 items-center gap-1.5 text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
        {/* The id is on the label text alone, not the heading — same fix as
            ResultFilterFacetChips' own badge: with the id on the h3 itself, a
            sibling `note` would concatenate into the group's accessible name
            ("Source type" -> "Source type one only"). */}
        <span id={groupLabelId}>{group.label}</span>
        {group.note ? <span className="ml-auto text-[color:var(--clinical-accent)]">{group.note}</span> : null}
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
export function ResultFilterFacetChips({
  group,
  idPrefix,
  disclosure,
}: {
  group: ResultFilterFacetGroup;
  idPrefix: string;
  /** Turns the header into a disclosure control and gates the body on `open` — the dense tier
      `ResultFilterSheet` renders for a mode with more than 3 facet groups or more than 20 total
      options (`docs/filter-contract.md` §5). Omitted by every other caller (e.g. formulation's
      always-open desktop rail), which keeps their header a static label and their body always
      rendered — unchanged from before this prop existed. */
  disclosure?: { open: boolean; onToggle: () => void };
}) {
  const panelId = idPrefix;
  const groupLabelId = `${panelId}-${group.id}-label`;
  const bodyId = `${panelId}-${group.id}-body`;
  const open = !disclosure || disclosure.open;

  return (
    <section className="min-w-0 border-t border-[color:var(--border)] py-1 first:border-t-0">
      {disclosure ? (
        <button
          type="button"
          onClick={disclosure.onToggle}
          aria-expanded={disclosure.open}
          aria-controls={bodyId}
          className={cn(
            "flex min-h-tap w-full items-center gap-1.5 text-left text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)] sm:min-h-9",
            "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          )}
        >
          {/* Same id-on-the-label-text-alone note as the static heading below: the
              accessible name must not include the selection badge. */}
          <span id={groupLabelId} className="truncate">
            {group.label}
          </span>
          {group.selected.size > 0 ? (
            <span className="nums ml-auto text-2xs font-semibold text-[color:var(--clinical-accent)]">
              {group.selected.size} selected
            </span>
          ) : (
            <span className="nums ml-auto text-2xs text-[color:var(--text-muted)]">{group.options.length}</span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-icon-sm shrink-0 text-[color:var(--decoration-soft)] transition-transform motion-reduce:transition-none",
              disclosure.open ? "rotate-0" : "-rotate-90",
            )}
          />
        </button>
      ) : (
        <h3 className="flex min-h-9 items-center gap-1.5 text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
          {/* The id is on the label text alone, not the heading. With the badge
              inside the labelled element the group's accessible name became
              "Domain 1" — the selection count leaking into the dimension's name,
              and changing it on every toggle. Caught by the DOM test. */}
          <span id={groupLabelId}>{group.label}</span>
          {group.selected.size > 0 ? (
            <span className="nums rounded-full bg-[color:var(--clinical-accent-soft)] px-1.5 text-3xs font-black tabular-nums text-[color:var(--clinical-accent)]">
              <span className="sr-only">{group.selected.size} selected</span>
              <span aria-hidden>{group.selected.size}</span>
            </span>
          ) : null}
        </h3>
      )}
      <div
        id={bodyId}
        hidden={!open}
        role="group"
        aria-labelledby={groupLabelId}
        className="flex flex-wrap gap-2 pb-2.5 sm:gap-1.5"
      >
        {group.options.map((option) => {
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
 * A single-choice filter sheet: one radio group per dimension.
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
  resetKey,
  scopeControl,
  meterContent,
  footerOverride,
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
  /** Result-set identity for the dense tier's transient chrome (find-a-filter needle, per-group
      collapse). A new submit must not carry over a stale needle or collapsed-group state —
      mirrors `document-search-results.tsx`'s `chrome.query` keying. Omit when the sheet's groups
      never trip the dense tier (below 4 facet groups and 21 total options); the chrome then
      never renders and this prop is inert. */
  resetKey?: string;
  /** The scope segment (`docs/filter-contract.md` §4) — `These results N | All items N` — for a
      mode whose catalogue is meaningfully larger than its current result set. Rendered at the top
      of the sheet body, above the find-a-filter field. Omit when the mode does not qualify. */
  scopeControl?: ReactNode;
  /** Content rendered first in the body, above `scopeControl` and the find-a-filter field —
      documents' `N of M documents shown` progress meter. No other mode needs this; omit
      otherwise. */
  meterContent?: ReactNode;
  /** Replaces the entire default footer (the `footerNote` span plus the "Done" button) rather
      than composing with it. For a mode whose commit action needs its own label/count (documents'
      "Show N documents") or a secondary action beside it (its "Browse all sources"), supplying
      those loses nothing the default footer offered. `footerNote` is ignored when this is set. */
  footerOverride?: ReactNode;
}) {
  const searchId = useId();
  const resetKeyValue = resetKey ?? "";
  const [chrome, setChrome] = useState<{
    key: string;
    needle: string;
    expanded: ReadonlySet<string>;
    collapsed: ReadonlySet<string>;
  }>(() => ({ key: resetKeyValue, needle: "", expanded: new Set(), collapsed: new Set() }));
  if (chrome.key !== resetKeyValue) {
    setChrome({ key: resetKeyValue, needle: "", expanded: new Set(), collapsed: new Set() });
  }
  // Prefer the scoped values even on the transitional render before the setState above
  // commits — otherwise a typed needle from the previous result set can flash in for one frame.
  const needle = chrome.key === resetKeyValue ? chrome.needle : "";
  const expanded = chrome.key === resetKeyValue ? chrome.expanded : new Set<string>();
  const collapsed = chrome.key === resetKeyValue ? chrome.collapsed : new Set<string>();
  const setNeedle = (value: string) => setChrome((current) => ({ ...current, key: resetKeyValue, needle: value }));
  const setExpanded = (update: (current: ReadonlySet<string>) => ReadonlySet<string>) =>
    setChrome((current) => ({
      ...current,
      key: resetKeyValue,
      expanded: update(current.key === resetKeyValue ? current.expanded : new Set()),
    }));
  const setCollapsed = (update: (current: ReadonlySet<string>) => ReadonlySet<string>) =>
    setChrome((current) => ({
      ...current,
      key: resetKeyValue,
      collapsed: update(current.key === resetKeyValue ? current.collapsed : new Set()),
    }));

  if (groups.length === 0) return null;

  const facetGroups = groups.filter(isFacetGroup);
  const totalFacetOptions = facetGroups.reduce((sum, group) => sum + group.options.length, 0);
  // Thresholds match `docs/filter-contract.md` §5 and the rule `document-search-results.tsx`
  // already ships (`dense = groups.length > 3`) — same trigger, generalized to option count too
  // since a mode can trip the ">20 options" half of §5 with 3 or fewer groups.
  const dense = facetGroups.length > 3 || totalFacetOptions > 20;
  const showNeedle = dense;
  const activeNeedle = showNeedle ? needle.trim().toLowerCase() : "";

  const displayGroups = groups
    .map((group) => {
      if (!isFacetGroup(group) || !activeNeedle) return group;
      return {
        ...group,
        options: group.options.filter(
          (option) =>
            // A selected option must stay reachable while searching: hiding it because its
            // label does not match the needle leaves an active constraint the reader cannot
            // untoggle without clearing the field first.
            group.selected.has(option.value) ||
            option.label.toLowerCase().includes(activeNeedle) ||
            group.label.toLowerCase().includes(activeNeedle),
        ),
      };
    })
    .filter((group) => !isFacetGroup(group) || group.options.length > 0);
  const matchedFacets = activeNeedle
    ? displayGroups.filter(isFacetGroup).reduce((sum, group) => sum + group.options.length, 0)
    : 0;

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
        footerOverride ?? (
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
        )
      }
    >
      <div className="grid min-w-0 gap-1">
        {meterContent ? <div className="min-w-0">{meterContent}</div> : null}
        {scopeControl ? <div className="min-w-0 pb-2.5">{scopeControl}</div> : null}
        {showNeedle ? (
          <div className="min-w-0 pb-2">
            <label htmlFor={searchId} className="sr-only">
              Find a filter
            </label>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]">
              <Search aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--decoration-soft)]" />
              <input
                id={searchId}
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
              {activeNeedle ? `${matchedFacets} filter${matchedFacets === 1 ? "" : "s"} match “${needle.trim()}”` : ""}
            </p>
          </div>
        ) : null}
        {displayGroups.map((group) => {
          if (!isFacetGroup(group)) return <FilterRadioGroup key={group.id} group={group} panelId={panelId} />;
          // A live needle forces every matched group open and owns openness — see the note on
          // the equivalent branch in `document-search-results.tsx`. Below the density threshold
          // every group is open and permanently so, and a disclosure control advertising a
          // collapse that never happens is a control that does nothing.
          const isOpen =
            !dense ||
            Boolean(activeNeedle) ||
            (!collapsed.has(group.id) && (expanded.has(group.id) || group.selected.size > 0));
          return (
            <ResultFilterFacetChips
              key={group.id}
              group={group}
              idPrefix={panelId}
              disclosure={
                dense && !activeNeedle
                  ? {
                      open: isOpen,
                      onToggle: () => {
                        setExpanded((current) => {
                          const next = new Set(current);
                          if (isOpen) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        });
                        setCollapsed((current) => {
                          const next = new Set(current);
                          if (isOpen) next.add(group.id);
                          else next.delete(group.id);
                          return next;
                        });
                      },
                    }
                  : undefined
              }
            />
          );
        })}
        {activeNeedle && displayGroups.filter(isFacetGroup).length === 0 ? (
          <p className="border-t border-[color:var(--border)] py-4 text-center text-xs font-semibold text-[color:var(--text-muted)]">
            No filter matches “{needle.trim()}”.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
