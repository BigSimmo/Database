"use client";

import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { edPressure } from "@/components/ward-management/ward-pressure";

import styles from "./coordinator.module.css";

type PressureStripProps = {
  now: Instant;
  selectedEdId: string | undefined;
  onSelectEd: (edId: string | undefined) => void;
};

/**
 * The coordinator's one-second read on "which emergency department is worst". Worst-first
 * ordering comes from `edPressure` (a passed legal deadline outranks a long wait, which
 * outranks sheer volume) — this component only renders that order, it never re-derives it.
 *
 * The visible label is `ed.siteCode`, never a name shortened by string surgery: `ed.name` is
 * carried as the accessible name and `title` instead, so the unabbreviated hospital reaches a
 * screen reader and a hover without ever displaying a plausible-but-wrong guess.
 */
export function PressureStrip({ now, selectedEdId, onSelectEd }: PressureStripProps) {
  const pressure = edPressure(now);

  return (
    <section className={styles.pressureStrip} aria-label="Emergency department pressure">
      <header className={styles.regionHeader}>
        <h2>Emergency department pressure</h2>
        <span className={styles.regionCount}>{pressure.length} departments</span>
      </header>
      <ul className={styles.pressureList}>
        {pressure.map((row) => {
          const selected = row.ed.id === selectedEdId;
          return (
            <li key={row.ed.id}>
              <button
                type="button"
                data-testid={`ward-ed-${row.ed.id}`}
                className={selected ? styles.pressureCardSelected : styles.pressureCard}
                data-breaching={row.breaching > 0 ? "true" : undefined}
                aria-pressed={selected}
                aria-label={row.ed.name}
                title={row.ed.name}
                onClick={() => onSelectEd(selected ? undefined : row.ed.id)}
              >
                <span className={styles.pressureSiteCode}>{row.ed.siteCode}</span>
                <span className={styles.pressureStats}>
                  {row.waiting} waiting · longest {splitDuration(row.longestWaitMinutes)}
                </span>
                {row.breaching > 0 ? <span className={styles.pressureBreach}>{row.breaching} breaching</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
