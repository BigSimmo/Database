/**
 * Slot letter identity for every compare surface.
 *
 * This lives outside `compare-slot-strip.tsx` on purpose: that file is a client
 * component, so server-rendered compare pages (the DSM comparison table, for one)
 * cannot call a function exported from it. Keeping the tokens in a plain module
 * lets both sides share one definition of what "slot B" looks like.
 */

/**
 * Shared A/B/C/D identity colours — soft tint, never a solid block or edge strip.
 * The tones are the non-semantic identity triads, so a slot letter never borrows
 * the status palette: a category is not a status.
 */
const SLOT_BADGE_TONES = [
  // A — the product accent, so the first slot reads as the page's own colour.
  "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  // B — plum. The furthest non-semantic hue from the accent, so an A/B pair never
  // reads as two shades of the same blue.
  "border-[color:var(--tone-rose-border)] bg-[color:var(--tone-rose-soft)] text-[color:var(--tone-rose)]",
  // C — violet.
  "border-[color:var(--tone-purple-border)] bg-[color:var(--tone-purple-soft)] text-[color:var(--tone-purple)]",
  // D — slate.
  "border-[color:var(--tone-slate-border)] bg-[color:var(--tone-slate-soft)] text-[color:var(--tone-slate)]",
] as const;

const SLOT_BADGE_EMPTY =
  "border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]";

export function compareSlotBadgeClass(index: number, filled = true) {
  if (!filled) return SLOT_BADGE_EMPTY;
  return SLOT_BADGE_TONES[index] ?? SLOT_BADGE_EMPTY;
}

/** Geometry for a slot letter, so pips outside the strip match the tiles exactly. */
export const compareSlotBadgeBase =
  "grid shrink-0 place-items-center rounded-full border font-extrabold tabular-nums transition-colors";
