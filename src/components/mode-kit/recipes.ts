/**
 * The mode kit's shared class recipes, in one place so a mode page never
 * hard-wires a size, colour or radius of its own (mode design standard §4).
 * Every value is a token or a step on the 4px grid; a later visual pass changes
 * them here, once, for every mode.
 *
 *   gutter / inner padding   12px (`px-3`, `p-3`)
 *   module gap               12px (`gap-3`)
 *   group gap                20px (`gap-5`), eyebrow 8px above (`mb-2`)
 *   single-line row          48px (`min-h-12`), two-line row 52px (`min-h-13`)
 *   in-row control           48px tap (`min-h-12 min-w-12`), 34px visible shape
 *                            (`size-8.5`) at the control radius (`rounded-md`, 10px)
 *   module                   `--surface-raised`, hairline `--border`, e1, 12px radius
 */

/** One bordered module card. Rows inside draw their own inset hairlines. */
export const modeModuleSurface =
  "overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--e1)] forced-colors:border";

/** Row heights on the 48/52 rule; a row grows only when its text wraps. */
export const modeRowHeight = { single: "min-h-12", double: "min-h-13" } as const;

/**
 * A hairline inset to the text (12px from the module edge), drawn above every
 * row but the first, so the list reads as one card and not a stack of boxes.
 */
export const modeInsetHairline =
  "relative before:pointer-events-none before:absolute before:left-3 before:right-0 before:top-0 before:h-px before:bg-[color:var(--border)] before:content-[''] first:before:hidden";

/** A pressed row darkens one surface step within 100ms (standard §4). */
export const modePressable =
  "transition-colors duration-[var(--duration-instant)] active:bg-[color:var(--surface-wash)]";

/** The 48px tap area around a compact in-row control. */
export const modeTapArea = "inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center";

/** The compact visible shape inside that tap area: 34px, the control radius. */
export const modeControlShape = {
  neutral:
    "grid size-8.5 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text)]",
  command: "grid size-8.5 place-items-center rounded-md bg-[color:var(--command)] text-[color:var(--command-contrast)]",
} as const;

/**
 * A disabled control is encoded, not faded (the `controlDisabled` rule in
 * `primitive-recipes/recipes.ts`): the shape flattens to the subtle surface and
 * the glyph moves to `--disabled`. Read from the tap-area button through
 * `group`, because the visible shape is the inner span.
 */
export const modeControlDisabled =
  "group-disabled:border-[color:var(--border)] group-disabled:bg-[color:var(--surface-subtle)] group-disabled:text-[color:var(--disabled)]";

/** The round call disc: neutral command fill, 36px, inside a 48px tap. */
export const modeCallDiscShape = {
  neutral: "grid size-9 place-items-center rounded-full bg-[color:var(--command)] text-[color:var(--command-contrast)]",
  /** Quiet red, for an emergency number only (standard §3). */
  emergency:
    "grid size-9 place-items-center rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
} as const;

/** A status or emergency dot: 6px, never larger (standard §3). */
export const modeDot = "inline-block size-1.5 shrink-0 rounded-full";

/**
 * The "dash of colour" (standard §3): a module header icon tile and the one
 * featured module per screen. These read `--mode-identity*`, so the element
 * must carry `data-mode-identity="<mode>"` itself; nothing around it is
 * repainted. A mode with no identity block falls back to the product accent.
 */
export const modeIconTile =
  "grid size-6 shrink-0 place-items-center rounded-md border border-[color:var(--mode-identity-border)] bg-[color:var(--mode-identity-soft)]";
export const modeIdentityIcon = "size-icon-md text-[color:var(--mode-identity)]";
export const modeFeaturedSurface = "border-[color:var(--mode-identity-border)] bg-[color:var(--mode-identity-soft)]";

/** Raised hairline card for anything taller than 48px: never the command fill (standard §10). */
export const modeRaisedCard =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-heading)] shadow-[var(--e1)]";

/**
 * The dark summary panel a mode home may build its hero from (standard §4,
 * `--surface-summary*` tokens in `globals.css`). There is no shared hero
 * component: each home composes its own from these.
 */
export const modeSummarySurface =
  "rounded-lg border border-[color:var(--surface-summary-line)] bg-[color:var(--surface-summary)] text-[color:var(--surface-summary-ink)] shadow-[var(--e1)] forced-colors:border";
export const modeSummaryMutedText = "text-[color:var(--surface-summary-muted)]";
export const modeSummaryHairline = "border-[color:var(--surface-summary-line)]";
