"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import type { InboxItem } from "@/components/ward-management/ward-derivations";

import styles from "./coordinator.module.css";

type ExceptionDrawerProps = {
  items: InboxItem[];
  open: boolean;
  onToggle: () => void;
  onSelectMovement: (movementId: string) => void;
};

/**
 * Task 8: the coordinator's work list, not a report — every item `buildActionInbox` returns
 * renders as its own row, and selecting one drives the same movement selection the priority
 * queue drives (`onSelectMovement` is the same setter passed to `PriorityQueue`'s `onSelect`),
 * so the explainable shortlist follows.
 *
 * Ruling 2: this renders exactly what `buildActionInbox` returns — never an invented category.
 * Spec §6 names six exception categories; the model only computes three (breached legal timing,
 * exhausted parallel referrals, transport accepted but not departed). The other three need new
 * derivations over capacity freshness and holds that this task does not own; inventing them here
 * would put computation in a component. See the task report for that gap.
 *
 * Ruling 3: the toggle's count is `items.length` — the exact same array the rows below are
 * mapped from, never a number computed independently of what actually renders (the "48 open
 * movements" defect in miniature is a header count that disagrees with the rows beneath it).
 */
export function ExceptionDrawer({ items, open, onToggle, onSelectMovement }: ExceptionDrawerProps) {
  return (
    <div className={styles.exceptionsDrawer} data-open={open}>
      <button type="button" className={styles.exceptionsToggle} aria-expanded={open} onClick={onToggle}>
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        <span>Exceptions</span>
        <span className={styles.exceptionsToggleCount}>{items.length}</span>
      </button>
      {open ? (
        <section className={styles.exceptionsPanel} aria-label="Exceptions">
          {items.length === 0 ? (
            <p className={styles.placeholder}>No exceptions right now.</p>
          ) : (
            <ul className={styles.exceptionsList}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid={`ward-exception-${item.id}`}
                      data-tone={item.tone}
                      className={styles.exceptionRow}
                      onClick={() => onSelectMovement(item.movementId)}
                    >
                      <Icon
                        aria-hidden="true"
                        className={item.tone === "danger" ? styles.exceptionIconDanger : styles.exceptionIconWarning}
                      />
                      <span className={styles.exceptionRowBody}>
                        <span className={styles.exceptionTitle}>{item.title}</span>
                        <span className={styles.exceptionDetail}>{item.detail}</span>
                        <span className={styles.exceptionOwner}>{item.owner}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
