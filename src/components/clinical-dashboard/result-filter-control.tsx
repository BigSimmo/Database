"use client";

import { Check, Funnel, X } from "lucide-react";
import { type ReactNode, useCallback, useRef } from "react";

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

export type ResultFilterGroup = {
  /** Stable within one sheet; used for the group's own labelling ids. */
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<ResultFilterOption<string>>;
  onChange: (value: string) => void;
};

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
    id: group.id,
    label: group.label,
    value: group.value,
    options: group.options,
    // The one narrowing, isolated here rather than repeated at seven call sites.
    onChange: (value) => group.onChange(value as Value),
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
function FilterRadioGroup({ group, panelId }: { group: ResultFilterGroup; panelId: string }) {
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
}) {
  if (groups.length === 0) return null;

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
        {groups.map((group) => (
          <FilterRadioGroup key={group.id} group={group} panelId={panelId} />
        ))}
      </div>
    </Sheet>
  );
}
