import type { ReactNode } from "react";

import { WardChip, type WardChipLevel } from "./ward-chip";
import styles from "./ward-record-row.module.css";

export type WardRecordTone = "danger" | "warning" | "good" | "neutral";

/**
 * The one record row for Delays, Capacity and Movements.
 *
 * Counted 2026-09-05 across the 41 Ward Flow stylesheets: 53 distinct `*Row` classes and 26
 * distinct `*Note` classes. This is one of each, for these three screens; nothing outside them is
 * migrated here.
 *
 * ⚠️ **`tone` DRAWS A COLOURED LEFT EDGE AND NOTHING ELSE**, so a toned row with no state word is a
 * coloured stripe carrying meaning on its own — the exact defect `WardChip`'s own word requirement
 * refuses one level down. An UNTONED row with no states is fine: it makes no claim, and a test
 * asserts that case too, so this guard cannot be satisfied by banning both.
 *
 * The edge is on the LEFT rather than across the top. A left edge survives a row wrapping onto four
 * lines, and it does not compete with the panel heading directly above it.
 */
export function WardRecordRow({
  id,
  tone = "neutral",
  states,
  clock,
  attributes,
  reason,
  annotation,
  actions,
}: {
  id: string;
  tone?: WardRecordTone;
  states: { level: WardChipLevel; text: string }[];
  clock?: { value: string; sub: string; urgent?: boolean };
  attributes: string[];
  reason?: { level: "danger" | "warning" | "ok"; text: string };
  /**
   * Structured detail belonging to this record that is not a state, not an attribute and not a
   * reason — the escalation facts are the case it was added for. `reason` takes a string because a
   * reason is one sentence; this takes nodes because the thing being carried has parts, and parts
   * a screen may need to find individually.
   */
  annotation?: ReactNode;
  actions?: ReactNode;
}) {
  if (tone !== "neutral" && states.length === 0) {
    throw new Error(
      `WardRecordRow ${id} is toned "${tone}" with no state word: colour alone cannot carry a state in this app.`,
    );
  }
  return (
    <li className={styles.row} data-tone={tone} data-ward-primitive="record-row">
      <span className={styles.line}>
        <span className={styles.id} data-ward-primitive="record-id">
          {id}
        </span>
        {states.map((state) => (
          <WardChip key={state.text} level={state.level}>
            {state.text}
          </WardChip>
        ))}
        {clock ? (
          <span className={styles.clock} data-urgent={clock.urgent ? "true" : undefined}>
            {clock.value}
            <small className={styles.clockSub}>{clock.sub}</small>
          </span>
        ) : null}
      </span>
      <span className={styles.attrs}>
        {attributes.map((attribute, index) => (
          <span key={attribute} className={styles.attr}>
            {index > 0 ? (
              <span className={styles.sep} aria-hidden="true">
                {" · "}
              </span>
            ) : null}
            {attribute}
          </span>
        ))}
      </span>
      {annotation ? <span className={styles.annotation}>{annotation}</span> : null}
      {reason ? (
        <span className={styles.reason} data-level={reason.level} data-ward-primitive="record-reason">
          {reason.text}
        </span>
      ) : null}
      {actions ? <span className={styles.actions}>{actions}</span> : null}
    </li>
  );
}

/**
 * ⚠️ **`people`, NEVER a row count.** A patient carries several delays at once and appears under the
 * longest-running one; counting rows double-counts the sickest people on the page. The prop is
 * named for its unit so a caller passing `items.length` has to notice it is doing so.
 *
 * A count of nought throws. A heading over an empty group is the "absence is stated, never blank"
 * rule's failure case: it reads as a category that exists and is fine, when nothing was measured.
 */
export function WardGroupHeading({
  title,
  people,
  note,
  tone = "neutral",
}: {
  title: string;
  people: number;
  note?: string;
  tone?: WardRecordTone;
}) {
  if (people <= 0) {
    throw new Error(
      `WardGroupHeading "${title}" was given a count of nought. An empty group is stated in words ("nobody is waiting on transport today"), never headed — a heading over nothing reads as a category that exists and is fine.`,
    );
  }
  return (
    <div className={styles.groupHeading} data-tone={tone} data-ward-primitive="group-heading">
      <h3 className={styles.groupTitle}>{title}</h3>
      <span className={styles.groupCount}>{people === 1 ? "1 person" : `${people} people`}</span>
      {note ? <span className={styles.groupNote}>{note}</span> : null}
    </div>
  );
}

export function WardRecordList({ children }: { children: ReactNode }) {
  return (
    <ul className={styles.list} data-ward-primitive="record-list">
      {children}
    </ul>
  );
}
