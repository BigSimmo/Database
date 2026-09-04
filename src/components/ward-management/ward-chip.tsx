// src/components/ward-management/ward-chip.tsx
import { Children, type ReactNode } from "react";

import styles from "./ward-chip.module.css";

/**
 * The six states a Ward Flow row can be in. `cancelled` and `enroute` exist because the transport
 * screen needs six legible stage labels and four were not enough — they were added there first and
 * are hoisted here so the seventh screen does not invent a seventh spelling.
 */
export const WARD_CHIP_LEVELS = ["urgent", "routine", "stalled", "accepted", "enroute", "cancelled"] as const;

export type WardChipLevel = (typeof WARD_CHIP_LEVELS)[number];

/**
 * ⚠️ A CHIP MUST CARRY WORDS. `colourOnlyStatusIndicators` is a ratcheted gate here, and a
 * wordless chip is precisely that violation — it renders as a deliberate-looking coloured
 * rectangle, so nothing looks broken and a reader with no colour perception learns nothing.
 * Throwing is deliberate: a build-time failure is cheaper than a screen that silently excludes.
 *
 * ⚠️ THIS USED TO CHECK ONLY `typeof children === "string"`, which is a much narrower guard than
 * it reads as. `{null}`, `{undefined}`, `{false}`, and `{cond && "text"}` when `cond` is false all
 * skipped it entirely and rendered a wordless coloured rectangle — and the conditional is the one
 * that happens in real code, because it looks like it can only ever produce words.
 *
 * ⚠️ AND UNDER FORCED COLOURS A WORDLESS CHIP IS NOT MERELY WEAK, IT IS GONE. The border and the
 * text colour are both overridden to system values, so a chip carrying its state only in colour
 * carries nothing at all.
 *
 * 🔴 WHAT THIS STILL CANNOT CATCH, stated so nobody reads a green as more than it is: a JSX
 * ELEMENT child that renders no text. `<WardChip level="urgent"><Icon /></WardChip>` passes,
 * because whether an element produces words is not knowable here — it depends on that component's
 * own render. Catching it needs a rendered-output assertion, not a props check.
 */
function requireWords(children: ReactNode, component: "WardChip" | "WardKindChip"): void {
  // Children.toArray drops null, undefined and booleans — exactly the values the old check missed.
  const pieces = Children.toArray(children);
  const everyPieceIsText = pieces.every((piece) => typeof piece === "string" || typeof piece === "number");
  if (pieces.length === 0 || (everyPieceIsText && pieces.join("").trim() === "")) {
    throw new Error(`${component} needs text: colour alone cannot carry a state in this app.`);
  }
}

export function WardChip({ level, children }: { level: WardChipLevel; children: ReactNode }) {
  requireWords(children, "WardChip");
  return (
    <span className={styles.chip} data-level={level} data-ward-primitive="chip">
      {children}
    </span>
  );
}

export const WARD_KIND_CHIP_KINDS = ["ward", "community", "ed", "transport"] as const;
export type WardKindChipKind = (typeof WARD_KIND_CHIP_KINDS)[number];

/**
 * What a record IS. Deliberately separate from WardChip, which says what state it is in:
 * a row is routinely both at once, and one merged union would have made that unrepresentable
 * while still type-checking.
 */
export function WardKindChip({ kind, children }: { readonly kind: WardKindChipKind; readonly children: ReactNode }) {
  /*
   * ⚠️ THIS COMPONENT HAD NO CHECK AT ALL, and it is the one where colour carries meaning: its
   * `border-left` is a 3px accent saying WHICH KIND of destination this is. A wordless kind chip
   * is a bare coloured bar and nothing else. It has no production call site today — only the
   * tests construct it — so the guard is arriving before the first consumer rather than after.
   */
  requireWords(children, "WardKindChip");
  return (
    <span className={styles.kindChip} data-kind={kind} data-ward-primitive="kind-chip">
      {children}
    </span>
  );
}
