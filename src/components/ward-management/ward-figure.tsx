// src/components/ward-management/ward-figure.tsx
import { Children, isValidElement, type ReactNode } from "react";

import styles from "./ward-figure.module.css";

export function WardFigure({
  label,
  value,
  unit,
  sub,
  flagged = false,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  flagged?: boolean;
}) {
  return (
    <div className={styles.figure} data-flagged={flagged ? "true" : undefined} data-ward-primitive="figure">
      <dt className={styles.figureLabel}>{label}</dt>
      <dd className={styles.figureBody}>
        <span className={styles.figureValue}>{value}</span>
        {unit ? <span className={styles.figureUnit}>{unit}</span> : null}
      </dd>
      {sub ? <span className={styles.figureSub}>{sub}</span> : null}
    </div>
  );
}

/**
 * ⚠️ AT MOST TWO TILES MAY BE FLAGGED. Amber means "look here", and a strip where everything is
 * amber directs the eye nowhere — which is a total failure of the component's only job, and one
 * that looks completely fine in a screenshot. Counting it here is the only place it can be caught.
 */
export function WardFigureStrip({ children }: { children: ReactNode }) {
  const flagged = Children.toArray(children).filter(
    (child) => isValidElement<{ flagged?: boolean }>(child) && child.props.flagged === true,
  ).length;
  if (flagged > 2) {
    throw new Error(
      `A figure strip may flag at most two tiles; this one flags ${flagged}. Amber means "look here" and stops meaning anything when everything carries it.`,
    );
  }
  return (
    <dl className={styles.figureStrip} data-ward-primitive="figure-strip">
      {children}
    </dl>
  );
}
