import type { Instant } from "@/components/ward-management/ward-clock";
import { formatInstant } from "@/components/ward-management/ward-clock";

import styles from "./ward-freshness.module.css";

/**
 * Task 4. Spec D7: every Ward Flow board must state when its data was last true. This is the
 * ONE shared stamp every board renders rather than each inventing its own wording.
 *
 * Three renderings, chosen in this order, and no fourth:
 *
 * 1. `derived` is true → "As at 10:42" — the screen's own statement that the figure it is
 *    showing is computed rather than confirmed by anyone. This is a prop rather than something
 *    inferred from `confirmedAt`/`confirmedByRole` because spec D7's third case ("where the
 *    screen shows derived rather than confirmed data") is a property of the SCREEN, not of the
 *    data passed in — a screen can have nothing confirmed and still not be showing a derived
 *    figure (see case 3 below), so only the screen itself can say which situation it is in.
 * 2. Both `confirmedAt` and `confirmedByRole` are present → "Confirmed 10:22 · RPH Adult Secure".
 * 3. Otherwise → "Never confirmed". This is the floor: a board with nothing to report never
 *    renders a blank or a dash, both of which would be claims this component must not make.
 *
 * Never reads a clock itself — `now` (and `confirmedAt`) always arrive from the caller, per
 * `ward-clock.ts`'s rule that it is the only module permitted to read the wall clock.
 */
export function WardFreshness({
  confirmedAt,
  confirmedByRole,
  now,
  derived,
}: {
  confirmedAt?: Instant | null;
  confirmedByRole?: string | null;
  now: Instant;
  /** The screen's own statement that this figure is computed rather than confirmed by anyone. */
  derived?: boolean;
}) {
  const label = derived
    ? `As at ${formatInstant(now)}`
    : confirmedAt != null && confirmedByRole
      ? `Confirmed ${formatInstant(confirmedAt)} · ${confirmedByRole}`
      : "Never confirmed";

  return <span className={styles.stamp}>{label}</span>;
}
