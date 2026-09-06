// src/components/ward-management/ed/ed-service-bands.tsx
import Link from "next/link";

import { splitDuration } from "@/components/ward-management/ward-clock";
import { WardChip, type WardChipLevel } from "@/components/ward-management/ward-chip";
import { ED_ACCESS_TARGET_MINUTES } from "@/components/ward-management/ward-model";
import { WardPanel } from "@/components/ward-management/ward-panel";

import { type EdSummary, type ServiceBand } from "./ed-home-derivations";
import styles from "./ed-service-bands.module.css";

/**
 * How close to the access target counts as "approaching" it — three quarters of the way there.
 * A department that has not yet breached the target still deserves a worded warning rather than
 * the same "Routine" every quiet department gets.
 *
 * ⚠️ Carries no chip about referral state ("declined by every ward" / "nobody looking") —
 * corrected ruling, 2026-09-04: see `ed-home-derivations.ts`'s own note on why this screen counts
 * nothing from `referredUnitIds`/`declines`.
 */
const APPROACHING_ACCESS_TARGET_FRACTION = 0.75;

function rowChip(summary: EdSummary): { level: WardChipLevel; label: string } {
  if (summary.pastAccessTarget > 0) {
    return { level: "urgent", label: "Past 24 hours" };
  }
  if (summary.longestWaitMinutes >= ED_ACCESS_TARGET_MINUTES * APPROACHING_ACCESS_TARGET_FRACTION) {
    return { level: "routine", label: "Approaching 24 hours" };
  }
  return { level: "routine", label: "Routine" };
}

function detainedMeta(summary: EdSummary): string {
  if (summary.detained === 0) return "None detained";
  return `${summary.detained} detained under the Act`;
}

/**
 * The population statement this band's own count needs — WardPanel's `blurb`, so every panel
 * carrying a count states in words what it counted, not just the totals strip above it.
 */
function bandBlurb(worstInBand: EdSummary | undefined): string {
  const population = "Waiting counts patients physically present at each department, not referrals raised for them.";
  return worstInBand ? `${population} ${worstInBand.siteName} is shown above.` : population;
}

/**
 * The remaining departments, grouped by health service, East then North then South. The one
 * department already shown as the hero is excluded from its own band's list — Task 6's own guard
 * asserts every real department appears exactly once across the hero and these three bands
 * combined, never zero times and never twice.
 */
export function EdServiceBands({ bands, worstEdId }: { bands: ServiceBand[]; worstEdId: string | undefined }) {
  return (
    <div className={styles.bands}>
      {bands.map((band) => {
        const worstInBand = band.departments.find((summary) => summary.ed.id === worstEdId);
        const listed = band.departments.filter((summary) => summary.ed.id !== worstEdId);
        return (
          <WardPanel
            key={band.service}
            title={band.service}
            count={`${band.departments.length} department${band.departments.length === 1 ? "" : "s"}${
              worstInBand ? ` · ${worstInBand.siteName} shown above` : ""
            }`}
            blurb={bandBlurb(worstInBand)}
          >
            {listed.length === 0 ? (
              <p className={styles.empty}>No other department in this health service.</p>
            ) : (
              <ul className={styles.rows}>
                {listed.map((summary) => {
                  const chip = rowChip(summary);
                  return (
                    <li key={summary.ed.id}>
                      <Link className={styles.row} href={`/mockups/ward-flow/ed/${summary.ed.id}`}>
                        <span className={styles.rowTop}>
                          <span className={styles.name}>{summary.ed.name}</span>
                          <span className={styles.wait}>
                            {summary.waiting === 0
                              ? "No movement open"
                              : `${splitDuration(summary.longestWaitMinutes)} longest wait`}
                          </span>
                        </span>
                        <span className={styles.rowChips}>
                          <WardChip level={chip.level}>{chip.label}</WardChip>
                        </span>
                        <span className={styles.meta}>
                          <span>{summary.waiting} waiting — patients physically present here</span>
                          <span>{detainedMeta(summary)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </WardPanel>
        );
      })}
    </div>
  );
}
