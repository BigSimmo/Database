"use client";

import { ChevronRight } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { cn, textMuted } from "@/components/ui-primitives";

/**
 * The body typography for a disclosure's copy — exported so a caller rendering the
 * panel content cannot pick a different size from the collapsed preview.
 *
 * That drift was a real defect: the preview was `text-xs` here while the forms
 * detail page set `text-sm leading-6` on the panel, so an `extendDescription` row
 * visibly re-sized the SAME sentence the moment it was opened. Import this rather
 * than restating it.
 */
export const disclosureBodyText = "text-sm leading-6";

/**
 * Trigger and panel share one grid template so the label, the collapsed preview and
 * the expanded body land on a single left edge. Both strings are written out in full
 * because Tailwind scans source text — a template literal assembled at runtime would
 * never be emitted.
 */
const TRIGGER_GRID_WITH_ICON = "grid-cols-[var(--spacing-disclosure-icon)_minmax(0,1fr)_auto] gap-x-3";
const TRIGGER_GRID_PLAIN = "grid-cols-[minmax(0,1fr)_auto] gap-x-3";
/** No trailing column: body copy runs to the edge rather than stopping under the chevron. */
const PANEL_GRID_WITH_ICON = "grid grid-cols-[var(--spacing-disclosure-icon)_minmax(0,1fr)] gap-x-3";

export type DisclosureSurface = "card" | "flush";

export type DisclosureProps = {
  title: ReactNode;
  children: ReactNode;
  /**
   * Leading glyph, rendered in its own grid column. A prop rather than something folded
   * into `title` for three reasons: it stays out of the accessible name, the panel can
   * align to the text column beside it, and it escapes the title's `truncate` box — a
   * tile nested in that box was clipped along with a long label.
   *
   * Pass the bare glyph. This component draws the tile around it, so the tile's width
   * and its grid track always resolve from the same token and cannot desync.
   */
  icon?: ReactNode;
  /** Right-aligned summary that stays visible while collapsed — a count, a status. */
  meta?: ReactNode;
  description?: ReactNode;
  /** Replace the collapsed preview with the panel when open, so the copy reads as one continuous answer. */
  extendDescription?: boolean;
  defaultOpen?: boolean;
  /** Controlled mode. Omit both to let the component own its state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * `card` is the standalone bordered box. `flush` drops the border, radius and fill for
   * a row inside a grouped container that owns the edge itself — SPEC §4.7, one edge
   * owner. This is a prop and not a `className` override because `cn()` joins strings
   * and does not resolve Tailwind conflicts: `rounded-none` passed against the base
   * `rounded-lg` resolves by stylesheet order, not class order.
   */
  surface?: DisclosureSurface;
  className?: string;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
};

/**
 * Expand/collapse, built once instead of five times.
 *
 * The trigger is a real `<button>` carrying BOTH `aria-expanded` and
 * `aria-controls`. `aria-expanded` alone says something opened but never what —
 * that exact gap was the `AccessibleTable` expander defect.
 *
 * **Layout.** The trigger is a grid, not a flex row, and the panel repeats its
 * template. That is load-bearing rather than stylistic: as a flex row the trigger
 * carried horizontal padding only, so a wrapped preview sat hard against the top and
 * bottom borders, and the panel's own `px-3` put the expanded body to the LEFT of the
 * label it belonged to. `items-start` keeps the tile and chevron on the first line of a
 * wrapped row instead of floating them mid-paragraph, and `py-2.5` around a 28px
 * first-line band lands a single-line row exactly on the 48px tap floor.
 *
 * The collapsed preview clamps to two lines. Letting it wrap freely made the row a
 * duplicate of the panel — on a wide viewport the whole value was already on screen, so
 * opening a row did nothing but re-flow it — and left a stack of rows at wildly
 * different heights.
 *
 * The panel stays mounted and uses the author-level `hidden` utility while
 * collapsed rather than the HTML `hidden` attribute. On screen the utility is
 * `display:none`, so a collapsed panel is genuinely out of the accessibility
 * tree and out of Ctrl-F — that is correct for a control the reader can open.
 *
 * Print is the case where it is NOT correct. A printed page has no disclosure to
 * open, so a collapsed section prints as if the guideline never mentioned it —
 * exactly the failure this component is supposed to prevent, made permanent on
 * paper and unnoticeable, because the reader holding the printout has no way to
 * tell a section was omitted. `print:block` overrides the author-level collapse
 * utility and expands every collapsed section for print; the
 * chevron is dropped, since a rotated arrow means nothing on paper.
 *
 * No height animation. Animating `height` or `grid-template-rows` forces layout
 * every frame and is a measurable CLS contributor; the chevron rotates on
 * `transform` instead, which is free.
 */
export function Disclosure({
  title,
  children,
  icon,
  meta,
  description,
  extendDescription = false,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  surface = "card",
  className,
  headingLevel = 3,
}: DisclosureProps) {
  const id = useId();
  const panelId = `${id}-panel`;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";

  function toggle() {
    const next = !open;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  const dataState = open ? "expanded" : "collapsed";
  const hasIcon = Boolean(icon);

  return (
    <div
      data-testid="disclosure"
      data-state={dataState}
      data-surface={surface}
      className={cn(
        surface === "card"
          ? "overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
          : "bg-transparent",
        // A print-expanded panel must not be clipped by the collapsed-height
        // container it was sized for.
        "print:overflow-visible",
        className,
      )}
    >
      <Heading className="m-0">
        <button
          type="button"
          id={`${id}-trigger`}
          data-state={dataState}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className={cn(
            // py-2.5 + the 28px first-line band + py-2.5 = exactly 48px, so a
            // single-line row sits ON the tap floor rather than having min-h-tap
            // silently stretch it. `items-start` then keeps the tile, meta and
            // chevron on that first band instead of floating them against three
            // lines of wrapped copy; `content-center` only ever matters if a row
            // renders shorter than the floor.
            "grid w-full min-h-tap items-start content-center px-3 py-2.5 text-left transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus)] print:hidden sm:px-4",
            hasIcon ? TRIGGER_GRID_WITH_ICON : TRIGGER_GRID_PLAIN,
          )}
        >
          {hasIcon ? (
            <span
              aria-hidden="true"
              className="grid size-disclosure-icon shrink-0 place-items-center self-start rounded-md bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
            >
              {icon}
            </span>
          ) : null}
          <span className="min-w-0">
            {/* leading-7 IS the 28px first-line band the tile and chevron align to.
                `truncate` still applies — the box stays display:block. */}
            <span className="block truncate text-sm font-semibold leading-7 text-[color:var(--text-heading)]">
              {title}
            </span>
            {/* Visual preview only: keep it out of the accessible name so the
                trigger stays label-sized. Full copy lives in the panel for SR
                once expanded. Two lines at every width — enough to judge whether
                the row is worth opening, never so much that the panel is a repeat. */}
            {description && !(extendDescription && open) ? (
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 block line-clamp-2",
                  // When the preview IS the body, it must look like the body: the
                  // same sentence must not change size on open.
                  extendDescription ? cn(disclosureBodyText, "print:hidden") : "text-xs leading-5",
                  textMuted,
                )}
              >
                {description}
              </span>
            ) : null}
          </span>
          {/* Meta and chevron share one cell. As separate columns an `auto` track
              with no meta still collected the column gap, so rows without meta
              drew a phantom 12px gutter beside the chevron. */}
          {/* The first-line band as a FLOOR, not a fixed height. A `meta` that is
              exactly 28px (metadataPillDensity.standard, which the on-call rows use)
              centres on the label line; a taller one grows the cluster instead of
              overflowing it. */}
          <span className="flex min-h-disclosure-icon shrink-0 items-center gap-2 self-start">
            {meta ? <span className="nums text-xs text-[color:var(--text-muted)]">{meta}</span> : null}
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "size-icon-md shrink-0 text-[color:var(--text-muted)] transition-transform duration-[var(--duration-fast)]",
                "motion-reduce:transition-none print:hidden",
                open && "rotate-90",
              )}
            />
          </span>
        </button>
        {/* Print has no disclosure to operate, and global print CSS hides every
            `button`, so the heading and review meta have to live outside the
            trigger or they vanish on paper while the panel still prints. */}
        <span aria-hidden="true" className="hidden items-center gap-2 px-3 py-3 print:flex sm:px-4">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
          </span>
          {meta ? <span className="nums shrink-0 text-xs text-[color:var(--text-muted)]">{meta}</span> : null}
        </span>
      </Heading>
      <div
        id={panelId}
        role="region"
        aria-labelledby={`${id}-trigger`}
        data-open={open ? "true" : "false"}
        data-state={dataState}
        className={cn(
          "px-3 pb-3 print:block sm:px-4",
          hasIcon && PANEL_GRID_WITH_ICON,
          !open && "hidden",
          extendDescription ? "pt-0" : "border-t border-[color:var(--border)] pt-3",
        )}
      >
        {/* Column 2 of the trigger's own template, so the body starts exactly under
            the label rather than beneath the tile or out at the container edge. */}
        {hasIcon ? <div className="col-start-2 min-w-0">{children}</div> : children}
      </div>
    </div>
  );
}

export type DisclosureGroupVariant = "stack" | "list";

export type DisclosureGroupProps = {
  items: Array<{
    id: string;
    title: ReactNode;
    icon?: ReactNode;
    description?: ReactNode;
    extendDescription?: boolean;
    meta?: ReactNode;
    content: ReactNode;
  }>;
  exclusive?: boolean;
  /**
   * `stack` keeps each row in its own bordered card. `list` draws ONE bordered
   * container with divided rows, which is what a long reference set wants — thirteen
   * separate boxes of unequal height read as noise, not as one object.
   */
  variant?: DisclosureGroupVariant;
  className?: string;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
};

/**
 * A stack of disclosures. `exclusive` makes it an accordion (one open at a time);
 * the default lets several stay open, which is usually right for reference
 * content where a reader compares two sections.
 */
export function DisclosureGroup({
  items,
  exclusive = false,
  variant = "stack",
  className,
  headingLevel = 3,
}: DisclosureGroupProps) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const grouped = variant === "list";

  return (
    <div
      data-testid="disclosure-group"
      data-variant={variant}
      className={cn(
        grouped
          ? // The container owns the edge; its rows carry only a divider. Same
            // print-clipping caveat as a single card.
            "divide-y divide-[color:var(--border)] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] print:overflow-visible"
          : "flex flex-col gap-2",
        className,
      )}
    >
      {items.map((item) => (
        <Disclosure
          key={item.id}
          title={item.title}
          icon={item.icon}
          description={item.description}
          extendDescription={item.extendDescription}
          meta={item.meta}
          surface={grouped ? "flush" : "card"}
          headingLevel={headingLevel}
          open={openIds.includes(item.id)}
          onOpenChange={(next) =>
            setOpenIds((current) => {
              if (!next) return current.filter((id) => id !== item.id);
              return exclusive ? [item.id] : [...current, item.id];
            })
          }
        >
          {item.content}
        </Disclosure>
      ))}
    </div>
  );
}
