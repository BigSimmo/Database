// The card layer.
//
// Every list-item card in the product used to write its own Tailwind string,
// and they had drifted on every axis at once. Measured across four peers that
// sit side by side in the same shell:
//
//   ToolCard        rounded-lg  --shadow-card   p-4        accent border + tint + hover lift
//   ServiceCard     rounded-xl  --shadow-inset  p-3 sm:p-4 accent border + ring/35
//   CalculatorCard  rounded-lg  --shadow-inset  p-4        accent border + --shadow-soft
//   Factsheet card  rounded-xl  --shadow-card   —          inline-style border-t-[3px]
//
// Three radii decisions, three resting elevations, four "this one is selected"
// encodings — three of them expressed as unreviewable fractional opacity on a
// token colour. Plus two byte-identical private forks of `raisedCard`, in
// `specifier-ui.tsx` and `formulation-ui.tsx`.
//
// Recipes rather than a registered component, for two reasons the repo already
// documents. COMPONENTS.md §0.4 measures 157 production importers of
// `ui-primitives.tsx` against 31 product imports across the whole 54-component
// registry, so a recipe is what surfaces actually pick up; and ledger #266 says
// adoption is demand-driven, "never a race to 54/54". A function also avoids
// re-solving element polymorphism: these cards are variously `<article>`,
// `<button>` and `<Link>`, and a component would have to take that on.
//
// A separate module rather than more of `ui-primitives.tsx`: COMPONENTS.md §0.4
// already lists that file as an over-budget module slated to split.

import { cn } from "@/components/ui-primitives";

/**
 * The one focus affordance, exported once.
 *
 * This exact string is redeclared as a local `focusRing` const in a dozen
 * component files and inline in dozens more. Nothing is wrong with any single
 * copy — the cost is that a change to the focus contract has to find them all.
 */
export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/**
 * Resting in-flow card.
 *
 * Border + `--e1`, per SPEC §4.7: in-flow cards carry a border, floating
 * surfaces use ring + shadow, and a card never carries a heavier `--eN` than
 * the panel containing it.
 *
 * Deliberately NOT `--shadow-inset`. That token is the design-system bevel, not
 * a card elevation; pairing it with a border puts two edge treatments on one
 * surface, which is what made the services and calculator cards read flatter
 * than the tool cards sitting beside them.
 */
export const cardSurface =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--e1)] forced-colors:border";

/**
 * Card that is itself the control — the whole surface navigates or opens.
 *
 * Hover moves the border and the shadow only. The launcher's
 * `hover:-translate-y-0.5` is deliberately not carried over: in a dense grid a
 * lift shimmers under trackpad scrolling as the pointer crosses cards, and it
 * is the one hover treatment of the four that could not be expressed in the
 * other three. Press uses the same `active:translate-y-px` as `controlBase`, so
 * a card and a button answer a click the same way.
 */
export const cardInteractive = cn(
  cardSurface,
  "group transition hover:border-[color:var(--cat-border)] hover:shadow-[var(--e3)] active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0",
  focusRing,
);

/**
 * Widens a row's existing link to cover the whole row, so a click or tap
 * anywhere in the row that is not another control opens the result.
 *
 * A pseudo-element on the one link already in the row, rather than a second
 * overlay anchor or a click handler on the container. Three reasons, and all
 * three are constraints rather than preferences:
 *
 * - The row stays a real link, so a tap activates it natively — no synthetic
 *   events, no `touch-action` plumbing — and long-press "open in new tab" and
 *   cmd/ctrl-click keep working. A container `onClick` breaks all of that.
 * - Assistive technology still hears one link per row, named by the result. A
 *   duplicate anchor would double the length of every screen-reader link list.
 * - Nothing is nested inside a link, so the row keeps its `<article>`/`<tr>`
 *   element and its sibling controls stay siblings. `docs/design-system/
 *   sweep-2026-08-29-structure.md` records that this repo has zero nested
 *   interactive elements and re-verifies it.
 *
 * Three things the caller must do:
 *
 * 1. The row container needs `relative` (and `group`, if the row hover-styles
 *    its children), or the stretch resolves against the wrong ancestor.
 * 2. Every other control in the row needs `relative z-10`, or it falls under
 *    the stretch layer and stops being clickable.
 * 3. Do not paint a focus ring on the pseudo-element. The `:focus-visible`
 *    rule in `globals.css` is unlayered, so it wins over any `outline-none`
 *    here, and a second ring would stack — which is exactly what the "focus is
 *    singular" assertion in `tests/ui-smoke.spec.ts` forbids. Focus stays on
 *    the link itself, at its own size.
 *
 * The pseudo-element paints nothing, so it needs no radius of its own — and a
 * `rounded-[inherit]` arbitrary value is a raw radius literal that the
 * design-system contract ratchet counts against the calling file.
 */
export const stretchedRowLinkClass = "after:absolute after:inset-0 after:z-0 after:content-['']";

/**
 * The single selected/active encoding.
 *
 * Replaces four: a tinted fill at `/45`, `/50` and `/55`, a `ring-…/35`, and a
 * shadow bump. Full-strength tokens, no opacity suffixes — an alpha applied to
 * a token colour is unreviewable, because the contrast it lands on depends on
 * whatever surface happens to be behind it in each theme.
 *
 * Reads the category accent, so a selected card is emphatically *its own*
 * category rather than the product blue every selected thing shares.
 */
export const cardSelected = "border-[color:var(--cat-border)] bg-[color:var(--cat-soft)] shadow-[var(--e2)]";

/**
 * Selected state for a card whose subject is genuinely a safety concern.
 *
 * This is the narrow, legitimate use of the semantic palette on a card: not
 * "this card belongs to the safety family" — that is identity, and identity
 * uses `cardSelected` — but "the thing you have selected is the safety tool".
 * Reach for it only where a semantic tone would be correct on a badge.
 */
export const cardSelectedDanger =
  "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] shadow-[var(--e2)]";

/**
 * Optional 3px category edge along the top of a card.
 *
 * The factsheet cards did this with an inline `style={{ borderTopColor }}`,
 * which bypasses the theme contract: an inline value cannot be remapped by the
 * dark or forced-colors blocks. Driven from `--cat-border` it is remapped like
 * anything else.
 */
export const cardAccentEdge = "border-t-[3px] border-t-[color:var(--cat-accent)]";

/** Padding steps. Named so a card's density is a choice rather than a literal. */
export const cardPadding = {
  /** Dense rows and compact list items. */
  compact: "p-3",
  /** The default card. */
  standard: "p-4",
} as const;
