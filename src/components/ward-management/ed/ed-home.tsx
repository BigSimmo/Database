// src/components/ward-management/ed/ed-home.tsx
"use client";

import Link from "next/link";

import { splitDuration } from "@/components/ward-management/ward-clock";
import { WardChip } from "@/components/ward-management/ward-chip";
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

import {
  type EdSummary,
  ED_HOME_POPULATION_NOTE,
  edHomeSummaries,
  edHomeTotals,
  groupByHealthService,
  ofPopulation,
  worstEdSummary,
} from "./ed-home-derivations";
import { EdServiceBands } from "./ed-service-bands";
import styles from "./ed-home.module.css";

/**
 * A generated sentence, never a template with a number dropped in — every clause is conditional
 * on whether the fact it names is actually true of `worst`, so a department with nobody detained
 * or nobody past the access target does not get a sentence claiming otherwise.
 *
 * ⚠️ Carries no claim about referral state (nobody "looking" or "not looking" for a bed) —
 * corrected ruling, 2026-09-04: see `ed-home-derivations.ts`'s own note on why this screen counts
 * nothing from `referredUnitIds`/`declines`.
 */
function heroLede(worst: EdSummary, isHighestWaiting: boolean): string {
  const peopleClause =
    worst.waiting === 1
      ? "One person is waiting here for a psychiatric bed"
      : `${worst.waiting} people are waiting here for a psychiatric bed`;
  const sentences: string[] = [
    `${peopleClause}${isHighestWaiting ? " — more than anywhere else in the network" : ""}.`,
  ];

  if (worst.pastAccessTarget > 0) {
    sentences.push(
      `${worst.pastAccessTarget} ${worst.pastAccessTarget === 1 ? "has" : "have"} now passed the department's own 24-hour access target.`,
    );
  }

  if (worst.detained > 0) {
    sentences.push(
      `${worst.detained} of the ${worst.waiting} ${worst.waiting === 1 ? "patient" : "patients"} waiting here ${worst.detained === 1 ? "is" : "are"} detained under the Mental Health Act, which narrows which wards can take ${worst.detained === 1 ? "them" : "them"}.`,
    );
  }

  return sentences.join(" ");
}

/**
 * The coordinator's all-departments home. Approved design:
 * docs/ward-flow/design/prototypes/mockup-ed-home.html.
 *
 * ⚠️ Every figure below is derived from `useWardFlow()` state via `ed-home-derivations.ts` —
 * nothing here is a literal. See that module's own note on why the population counted is
 * MOVEMENTS, never referrals, and why that choice is reported rather than assumed to be settled.
 *
 * Renders its own `<h1>` and `<main>` because the navigation shell (`WardGround`/
 * `WardShellHeader`) renders neither — see the navigation-shell plan's stated interface.
 */
export function EdHome() {
  const { movements, now } = useWardFlow();
  const summaries = edHomeSummaries(movements, now);
  const totals = edHomeTotals(summaries, now);
  const worst = worstEdSummary(summaries);
  const bands = groupByHealthService(summaries);

  const allEds = allEmergencyDepartments();
  const serviceCount = new Set(summaries.map((summary) => summary.service)).size;
  const isHighestWaiting = worst !== undefined && worst.waiting === Math.max(...summaries.map((s) => s.waiting));

  const departmentsPastTargetNames = totals.departmentsPastAccessTarget.map((summary) => summary.siteName);

  return (
    <main className={styles.screen}>
      <div className={styles.masthead}>
        <div>
          <span className={styles.eyebrow}>Coordinator</span>
          <h1 className={styles.title}>Emergency departments — every site</h1>
          <p className={styles.covers}>
            <b>
              {allEds.length} emergency department{allEds.length === 1 ? "" : "s"}
            </b>{" "}
            across {serviceCount} health service{serviceCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <p className={styles.modelLimit} data-testid="ed-home-model-limit">
        <b>The emergency department record itself holds almost nothing.</b> The model&rsquo;s{" "}
        <code>EmergencyDepartment</code> type carries only an id, a site code and a name — no bed count, no waiting
        count, no capacity figure. {ED_HOME_POPULATION_NOTE}
      </p>

      <div data-testid="ed-home-totals">
        <WardFigureStrip>
          <WardFigure
            label="Waiting for a psychiatric bed, all sites"
            value={String(totals.waiting)}
            sub="Patients physically present in an emergency department, network-wide"
          />
          <WardFigure
            label="Longest single wait"
            value={totals.longestWait ? splitDuration(totals.longestWait.waitMinutes) : "0m"}
            flagged
            sub={
              totals.longestWait
                ? `${totals.longestWait.movement.id} · ${totals.longestWait.summary.siteName}`
                : "Nobody is currently waiting"
            }
          />
          <WardFigure
            label="Detained under the Mental Health Act, waiting"
            value={String(totals.detained)}
            unit={ofPopulation(totals.waiting, "patient")}
            sub="Narrows which wards can take them"
          />
          <WardFigure
            label="Detained, and past the access target"
            value={String(totals.detainedAndPastAccessTarget)}
            unit={ofPopulation(totals.waiting, "patient")}
            flagged
            sub="Both at once: an authorised bed, and urgently"
          />
          <WardFigure
            label="Departments past their access target"
            value={String(totals.departmentsPastAccessTarget.length)}
            unit={ofPopulation(allEds.length, "department")}
            sub={departmentsPastTargetNames.length > 0 ? departmentsPastTargetNames.join(", ") : "None currently"}
          />
        </WardFigureStrip>
      </div>
      <p className={styles.populationNote}>
        Every figure above counts patients physically present in an emergency department, waiting for a bed — never a
        referral raised for them. A department&rsquo;s own hub may show a different figure for the same day if it counts
        referrals instead.
      </p>

      {worst ? (
        <WardPanel
          title={worst.ed.name}
          count={`${worst.waiting} waiting`}
          blurb="Counts patients physically present in this department, waiting for a bed — not referrals raised for them."
        >
          <div className={styles.heroBody}>
            <WardChip level="urgent">Worst department right now</WardChip>
            <p className={styles.heroLede}>{heroLede(worst, isHighestWaiting)}</p>
          </div>
          <div className={styles.heroFiguresGrid} data-testid="ed-home-hero-figures">
            <WardFigure
              label="Waiting for a bed"
              value={String(worst.waiting)}
              sub={isHighestWaiting ? "Highest of any department" : "Patients physically present here"}
            />
            <WardFigure
              label="Longest wait"
              value={splitDuration(worst.longestWaitMinutes)}
              sub={worst.pastAccessTarget > 0 ? "Past the 24-hour access target" : "Not yet past the access target"}
            />
            <WardFigure
              label="Detained under the Act"
              value={String(worst.detained)}
              unit={ofPopulation(worst.waiting, "patient")}
              sub={worst.detained > 0 ? "Only an authorised bed can take them" : "None currently detained here"}
            />
            <WardFigure
              label="Detained, and past 24 hours"
              value={String(worst.detainedAndPastAccessTarget)}
              unit={ofPopulation(worst.waiting, "patient")}
              sub="Both at once: an authorised bed, and urgently"
            />
            <WardFigure
              label="Past 24 hours"
              value={String(worst.pastAccessTarget)}
              unit={ofPopulation(worst.waiting, "patient")}
              sub="The department's own access measure, not a legal deadline"
            />
          </div>
          <Link className={styles.heroOpen} href={`/mockups/ward-flow/ed/${worst.ed.id}`}>
            Open {worst.ed.name} hub →
          </Link>
        </WardPanel>
      ) : null}

      <EdServiceBands bands={bands} worstEdId={worst?.ed.id} />
    </main>
  );
}
