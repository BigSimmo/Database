"use client";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { OverrideEntry } from "@/components/ward-management/ward-derivations";
import type { Unit } from "@/components/ward-management/ward-model";

import styles from "./override-register.module.css";

/**
 * THE READ SIDE OF THE OVERRIDE REGISTER — one presentation, two audiences, and it cannot tell
 * which one it is serving.
 *
 * Owner decision OD-3: a coordinator may overrule a failing bed-matching gate, the reason is kept
 * on `Movement.overrides`, and the record is **visible to the party overridden**. Until this
 * component existed, every caller of `allOverrides` and `overridesAgainstUnit` was a test — an
 * accountability record nobody could read, which is an audit trail wearing the other name.
 *
 * ⚠️ **THIS COMPONENT RECEIVES AN ALREADY-SCOPED LIST AND HAS NO WAY TO NARROW ONE.** It takes
 * `OverrideEntry[]` and never calls a derivation, so it cannot be handed the whole register "and
 * filter for the ward" — the construction OD-3 exists to forbid. The scoping decision is made
 * before anything reaches here: the coordinator screen calls `allOverrides`, the ward screen calls
 * `overridesAgainstUnit`, and neither fact is visible from inside this file. That is deliberate.
 * A component that knew which view it was serving could be *asked* to hide a row, and a hidden row
 * is one stylesheet away from a shown one.
 *
 * `tests/ward-override-register-render.dom.test.tsx` guards both halves: the rendered behaviour,
 * and — structurally, so no future column can undo it — that `ward-screen.tsx` never so much as
 * names `allOverrides`.
 */

/**
 * The empty state, in ONE place because both screens say it and a second copy is how two screens
 * start disagreeing about what an empty register means. It states that nothing has been recorded
 * rather than rendering an empty box: "no rows" and "this surface is not wired up" look identical
 * on screen, and only one of them is true.
 */
export const NO_OVERRIDE_RECORDED_NOTICE = "No override has been recorded.";

type OverrideRegisterProps = {
  /**
   * Already scoped by the caller. This component neither filters nor re-reads it — see the file
   * comment above for why that is the whole design.
   */
  entries: OverrideEntry[];
  /** Only for naming a unit id. Unit names are network-wide and public — the ward index lists
   *  every one of them — so this carries no scope of its own. */
  units: Unit[];
  now: Instant;
};

export function OverrideRegister({ entries, units, now }: OverrideRegisterProps) {
  if (entries.length === 0) {
    return (
      <p className={styles.placeholder} data-testid="ward-override-register-empty">
        {NO_OVERRIDE_RECORDED_NOTICE}
      </p>
    );
  }

  // Newest first: an override register is read to find out what has just been decided. Sorted on a
  // copy, because `allOverrides` returns entries in movement order and a derivation's own array
  // must not be reordered under it.
  const newestFirst = [...entries].sort((a, b) => b.override.at - a.override.at);

  return (
    <ul className={styles.list} data-testid="ward-override-register">
      {newestFirst.map((entry, index) => (
        // A movement can be overridden more than once (the reducer appends rather than replaces),
        // so the movement id alone is not a key. The index is over the sorted copy, which is
        // stable for a given render.
        <li
          key={`${entry.movement.id}-${entry.override.at}-${index}`}
          className={styles.entry}
          data-testid={`ward-override-entry-${entry.movement.id}`}
        >
          <div className={styles.entryHeader}>
            <strong>{entry.movement.id}</strong>
            <span className={styles.entryMeta}>{formatInstantWithDay(entry.override.at, now)}</span>
          </div>
          {/*
            ⚠️ A ROLE, NEVER A PERSON. `Override.by` is written by the reducer from
            `WARD_FLOW_ROLE_LABELS[event.role]` and holds a role label such as "Flow coordinator".
            The wording below must never imply a named individual — "Decided by" plus a role reads
            as the role deciding, which is what happened.
          */}
          <span className={styles.entryMeta} data-testid={`ward-override-by-${entry.movement.id}`}>
            Decided by {entry.override.by}
          </span>
          {/*
            The reason is rendered verbatim from `OVERRIDE_REASONS`. It is a whole sentence chosen
            from the owner's fixed list, so there is nothing here to relabel, expand or prefix — a
            second wording of a governance reason is a second reason.
          */}
          <span className={styles.entryReason} data-testid={`ward-override-reason-${entry.movement.id}`}>
            {entry.override.reason}
          </span>
          <span className={styles.entryMeta} data-testid={`ward-override-units-${entry.movement.id}`}>
            {/* "Referred despite the gate", not "overridden ward": the unit was not overruled about
                anything it had decided — the match gate against it was. */}
            Referred despite a failing gate to{" "}
            {entry.override.unitIds
              // An id the live unit list cannot name still says the id rather than being dropped:
              // a missing row would understate the record, and inventing a name is worse than
              // showing the raw identifier.
              .map((unitId) => units.find((unit) => unit.id === unitId)?.name ?? unitId)
              .join(", ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
