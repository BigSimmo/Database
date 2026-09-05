"use client";

import { unitHasLockedBeds, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { WardBar, type WardBarSegment } from "@/components/ward-management/ward-bar";
import { WardChip, type WardChipLevel } from "@/components/ward-management/ward-chip";
import { WardFilters } from "@/components/ward-management/ward-controls";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  bedKindGaps,
  bedKindTotals,
  freeingCellText,
  networkTotals,
  networkWardRows,
  releasesBeyondToday,
  type BedKindGap,
  type NetworkWardRow,
} from "./capacity-derivations";
import styles from "./capacity.module.css";

/**
 * MERGE 02 — the ward-confirmed capacity view and the morning bed-state board fold into one screen.
 *
 * ⚠️ **IT ANSWERS "WHERE IS THE MISMATCH", NEVER "WHERE COULD THIS PERSON GO."** The owner rejected
 * an earlier single-patient matcher design in exactly those words, and `capacity-derivations.ts`'s
 * own file header repeats the same boundary for the numbers this screen renders. Nothing here may
 * rank a ward for a patient, and nothing here may read a per-patient eligibility surface.
 *
 * ⚠️ **THE SCREEN COMPUTES NOTHING BEYOND PRESENTATION.** Every figure comes from `bedKindGaps`,
 * `bedKindTotals`, `networkWardRows` or `networkTotals`. The only arithmetic that happens here is
 * summing rows those functions already returned (e.g. the locked/open split of a total the
 * derivations already handed back) — never a second computation of a fact they already own.
 *
 * ⚠️ **`NetworkWardRow.freeing` IS `undefined` ON EVERY ROW TODAY, AND THAT IS NOT A BUG TO PAPER
 * OVER.** Read `capacity-derivations.ts`'s own doc comment on the field: a future discharge is not a
 * fact any `Unit` carries, so there is no honest number to show. The design lock (§ layout, item 2)
 * asks for a "Freeing today" bar beside "Ready now" — but `WardBar` itself refuses an all-zero bar
 * for the same honesty reason, and rendering a fabricated zero here would be the exact false claim
 * the derivations file's comment warns against. So this screen renders the real "Ready now" bar and,
 * wherever "freeing" would appear, states the absence in words (design lock § behaviour, rule 2)
 * rather than drawing a bar or a count that does not exist. Every place `freeing` is used below
 * checks whether ANY row actually carries a number first, so a future change that starts returning
 * real figures renders correctly without this file needing to change.
 */
export function CapacityScreen() {
  const { movements, units, bedReleases, now, dispatch } = useWardFlow();

  const gapRows = bedKindGaps(movements, units, now);
  const gapTotals = bedKindTotals(gapRows);
  const shortfalls = gapRows.filter((row) => row.gap < 0);

  // ⚠️ `bedReleases` PASSED DELIBERATELY. "Expected to free today" is not a fact `Unit` carries —
  // it lives in reducer state — so `networkWardRows` returns `undefined` for it unless the releases
  // are handed in. Omitting them is not a neutral default: it renders every ward as "not tracked"
  // while the data exists. The derivation still answers `undefined` rather than 0 when they are
  // absent, because 0 would tell a coordinator nothing is freeing today, which is worse than blank.
  const networkRows = networkWardRows(units, now, bedReleases);
  const netTotals = networkTotals(networkRows);
  const totalLockedReady = networkRows.reduce((sum, row) => sum + row.lockedReady, 0);
  const totalOpenReady = netTotals.ready - totalLockedReady;

  // See the file-level warning above: `freeing` is only ever a real number on a row where the
  // derivation actually produced one. Deriving `freeingTracked` from the data, rather than assuming
  // it is always absent, is what lets this screen start showing real figures the day a future change
  // to `networkWardRows` starts returning them.
  const freeingValues = networkRows.map((row) => row.freeing).filter((value): value is number => value !== undefined);
  const freeingTracked = freeingValues.length > 0;
  const totalFreeing = freeingValues.reduce((sum, value) => sum + value, 0);
  const freeingWards = networkRows.filter((row) => (row.freeing ?? 0) > 0);
  // Restored 2026-09-05. See `releasesBeyondToday`: a bed freeing beyond today is correctly left
  // out of every figure on this screen, and saying so is a different act from counting it.
  const excludedBeyondToday = releasesBeyondToday(bedReleases, now);

  return (
    <div className={styles.screen} data-testid="ward-capacity-page">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        {/*
          🔴 **THE SYNTHETIC-DATA DISCLOSURE, ADDED 2026-09-06.** This screen shipped without
          one and showed invented figures under real Perth hospital names with nothing saying
          so. Twenty-four other ward screens carried it; the three that did not were the three
          the 2026-09-05 merges created.

          ⚠️ **IT IS OPT-IN PER SCREEN, WHICH IS WHY THEY MISSED IT.** There is no shared
          component and no layout providing it, so a new screen gets none by default and
          nothing reported the absence. `tests/ward-prototype-disclosure.test.ts` now walks
          every ward ROUTE and requires the tree it renders to disclose somewhere — a route is
          what a reader opens, and a component nothing routes to cannot disclose to anybody.
        */}
        <div className={styles.governanceBanner}>
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            Every bed count, ward name and waiting patient on this screen is invented. No figure here describes a real
            hospital, and nothing on it is a clinical record.
          </p>
        </div>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Capacity</h1>
          <p className={styles.pageSubtitle}>
            Where the network's bed kinds fall short of who is waiting for them — the whole board asked one question,
            not one patient asked of the whole board.
          </p>
        </header>

        <div className={styles.columns}>
          <div className={styles.primary}>
            <WardPanel
              title="Ready now"
              count={
                netTotals.pendingPreparation !== undefined && netTotals.pendingPreparation > 0
                  ? `${netTotals.ready} of ${netTotals.beds} beds · ${netTotals.pendingPreparation} still being made ready`
                  : `${netTotals.ready} of ${netTotals.beds} beds`
              }
            >
              <div className={styles.bar}>
                {netTotals.ready > 0 ? (
                  <WardBar
                    segments={
                      [
                        { label: "Locked ready", value: totalLockedReady, tone: "accent" },
                        { label: "Open ready", value: totalOpenReady, tone: "good" },
                      ] satisfies WardBarSegment[]
                    }
                    /* ⚠️ THIS READ `${netTotals.ready} of ${netTotals.beds} beds ready` UNTIL 2026-09-06, AND THE
                       BAR DREW ONLY THE FIRST NUMBER. A stacked bar is always full, so naming the network total
                       beside a rail that divides the ready beds invited the eye to read a full rail as full
                       capacity — 27 of 303 is nine per cent, drawn as complete, on the scarcity screen. The
                       denominator has not been lost: the panel header above still reads "27 of 303 beds", which
                       is where a total belongs. `WardBar` now refuses the old caption by name. */
                    caption={`${netTotals.ready} beds ready across the network`}
                  />
                ) : (
                  <p className={styles.absent}>No ward in the network reports a ready bed right now.</p>
                )}
              </div>
            </WardPanel>

            {/*
             * 🔴 A SECOND "FREEING TODAY" PANEL STOOD HERE UNTIL 2026-09-06 AND IT WAS A DUPLICATE.
             *
             * It carried `count={totalFreeing}` in its header and, as its entire body, a ONE-SEGMENT
             * `WardBar` of the same number — a rail at 100% whatever the value, restating the count
             * printed six characters above it. The panel titled "Beds freeing today" further down this
             * same screen carries the same total AND says which wards, which is the informative version.
             * Two panels, one figure, near-identical titles, one screen.
             *
             * ⚠️ **THE SINGLE-SEGMENT BAR IS WHY THIS WAS LOOKED AT, AND DELETING THE PANEL IS THE
             * ANSWER RATHER THAN RE-DRAWING THE BAR.** `WardBar` now refuses a one-segment bar, and the
             * tempting response to that refusal is to invent a second category ("freeing" against "not
             * freeing") so the rail passes. That would be a bar built to satisfy a guard: the second
             * category is not a thing this screen measures — `NetworkWardRow.freeing` is undefined on
             * every row where nothing was derived, which is exactly why `freeingTracked` exists — and a
             * bar drawn from an invented denominator is the defect one layer down.
             *
             * 🔴 **AND DELETING IT BROKE A LIVE CROSS-REFERENCE, WHICH I ASSERTED IT WOULD NOT.** The
             * first version of this note said the untracked explanation "is on the surviving panel below".
             * It was not. That panel said *"see the 'Freeing today' panel above for why"* — a pointer at
             * the very panel being removed. The reason has been moved into it, so the absence is stated
             * where it is shown rather than one hop away. **Nothing would have gone red on the dangling
             * pointer: it is prose naming prose**, and I only found it because I went and read the
             * surviving panel instead of trusting my own sentence about it.
             */}

            <WardPanel
              title="Where the mismatch is"
              count={`${gapTotals.waiting} waiting, ${gapTotals.bedsThatFit} beds that fit`}
            >
              <WardTable className={styles.gapTable} testId="ward-capacity-gap-table">
                <thead>
                  <tr>
                    <th scope="col">What&apos;s needed</th>
                    <th scope="col">Waiting</th>
                    <th scope="col">Beds that fit</th>
                    <th scope="col">Gap</th>
                    <th scope="col">What that means</th>
                  </tr>
                </thead>
                <tbody>
                  {gapRows.map((row) => (
                    <GapRow key={row.id} row={row} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.totalRow} data-testid="ward-capacity-gap-total">
                    <th scope="row">All four together</th>
                    <td data-testid="ward-capacity-waiting">{gapTotals.waiting}</td>
                    <td data-testid="ward-capacity-beds-that-fit">{gapTotals.bedsThatFit}</td>
                    <td data-testid="ward-capacity-gap-value">
                      <GapWord gap={gapTotals.gap} />{" "}
                      <span className={styles.gapNumber}>{formatGap(gapTotals.gap)}</span>
                    </td>
                    <td>{totalsSentence(gapTotals)}</td>
                  </tr>
                </tfoot>
              </WardTable>
              <p className={styles.foot}>
                <strong>
                  This table says where a bed KIND is short across the network — it never says which ward should take
                  which person.
                </strong>{" "}
                A shortfall row is a fact about supply and demand in aggregate; the judgement of who goes where, and
                every eligibility check that judgement depends on, stays on the movement and shortlist surfaces that
                already carry it.
              </p>
            </WardPanel>

            <WardPanel
              title="Every ward in the network"
              count={`${networkRows.length} ${networkRows.length === 1 ? "ward" : "wards"}`}
            >
              {/*
                🔴 **EVERY FIGURE IN THIS GROUP COUNTS WARDS. THE BAR ABOVE COUNTS BEDS. THEY USED
                THE SAME WORDS.**

                Found by Ward Verifier, 2026-09-06, by sweeping for the label rather than by eye,
                then confirmed by arithmetic on the table below:

                    "Ready now" bar key   Locked ready  8   -> 8 locked BEDS
                    this filter chip      Locked ready  7   -> 7 WARDS holding one

                **Both were on screen at the same time, in the same words, and nothing
                distinguished them.** A coordinator reading "Locked ready 7" under a bar reading
                "Locked ready 8" has no way to know the two are different quantities rather than a
                figure that has drifted — and "the number disagrees with itself" is precisely what
                this screen exists to help them notice elsewhere.

                ⚠️ **THE FIX IS THE LABEL, NOT THE NUMBER. Both figures are correct.** The chip is
                now phrased like its own sibling, "Has a bed ready", which was already unambiguously
                ward-shaped — so the whole group reads as one unit and the odd one out is gone. The
                legend names the unit once for assistive technology, which reads the group's label
                before any chip in it.
              */}
              <div className={styles.filters}>
                <WardFilters
                  legend="Show which wards"
                  activeId="all"
                  onChange={() => {}}
                  options={[
                    { id: "all", label: "All", count: networkRows.length },
                    { id: "ready", label: "Has a bed ready", count: networkRows.filter((row) => row.ready > 0).length },
                    {
                      id: "locked-ready",
                      label: "Has a locked bed ready",
                      count: networkRows.filter((row) => row.lockedReady > 0).length,
                    },
                    {
                      id: "needs-confirming",
                      label: "Needs confirming",
                      count: networkRows.filter((row) => !isConfirmationFresh(row.unit, now)).length,
                    },
                  ]}
                />
              </div>
              <WardTable className={styles.networkTable} testId="ward-capacity-network-table">
                <thead>
                  <tr>
                    <th scope="col">Ward</th>
                    <th scope="col">Bed kinds</th>
                    <th scope="col">Ready</th>
                    <th scope="col">Locked</th>
                    <th scope="col">Freeing</th>
                    <th scope="col">Mental Health Act</th>
                    <th scope="col">Confirmed</th>
                    <th scope="col">Ask for an update</th>
                  </tr>
                </thead>
                <tbody>
                  {networkRows.map((row) => (
                    <NetworkRow
                      key={row.unit.id}
                      row={row}
                      now={now}
                      onRequestRefresh={() =>
                        dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: row.unit.id })
                      }
                    />
                  ))}
                </tbody>
              </WardTable>
            </WardPanel>
          </div>

          <aside className={styles.secondary} aria-label="Capacity details">
            <WardPanel title="Beds freeing today" count={freeingTracked ? `${totalFreeing}` : "not tracked here"}>
              {/*
               * ⚠️ THE UNTRACKED SENTENCE BELOW POINTED AT ANOTHER PANEL — *"see the 'Freeing today' panel
               * above for why"* — AND THAT PANEL WAS DELETED ON 2026-09-06 as a duplicate. The reason now
               * lives in the sentence itself, in the one place that states the absence, rather than being
               * one hop away from it. A cross-reference to a sibling panel is a dangling pointer the moment
               * either moves, and nothing here would have gone red on it: it is prose naming prose.
               */}
              {!freeingTracked ? (
                <p className={styles.absent}>
                  This screen does not track which beds will free up before the day ends, and a number here would be a
                  guess rather than a fact: that is a planned-discharge figure, while this screen reads a ward&apos;s
                  current allocatable count and nothing else. A zero would claim nothing is freeing today, which would
                  be false as often as it is true. The discharge board carries the real figure instead.
                </p>
              ) : freeingWards.length === 0 ? (
                <p className={styles.absent}>No ward reports a bed freeing today.</p>
              ) : (
                <ul className={styles.attention}>
                  {freeingWards.map((row) => (
                    <li key={row.unit.id} className={styles.attentionItem}>
                      <span className={styles.attentionWho}>{row.unit.name}</span>
                      {row.freeing} freeing today.
                    </li>
                  ))}
                </ul>
              )}
              {excludedBeyondToday > 0 ? (
                <p className={styles.excluded} data-testid="ward-capacity-excluded-beyond-today">
                  <strong>{excludedBeyondToday}</strong>{" "}
                  {excludedBeyondToday === 1 ? "bed is expected" : "beds are expected"} to free up after today, and{" "}
                  {excludedBeyondToday === 1 ? "is" : "are"} deliberately not counted in any figure above. Shown here
                  rather than dropped in silence.
                </p>
              ) : null}
            </WardPanel>

            <WardPanel
              title="Worth your attention"
              count={shortfalls.length === 0 ? "none" : `${shortfalls.length} of ${gapRows.length}`}
            >
              {shortfalls.length === 0 ? (
                <p className={styles.absent}>
                  No bed kind is short right now — every row in the mismatch table is zero or positive.
                </p>
              ) : (
                <ul className={styles.attention}>
                  {shortfalls.map((row) => (
                    <li key={row.id} className={styles.attentionItem}>
                      <span className={styles.attentionWho}>{row.need}</span>
                      {Math.abs(row.gap)} short — {row.waiting} waiting, {row.bedsThatFit} that fit.
                    </li>
                  ))}
                </ul>
              )}
            </WardPanel>
          </aside>
        </div>
      </main>
    </div>
  );
}

/**
 * Mirrors `capacityIsFresh` in `ward-eligibility.ts` (private there, so not importable) rather than
 * exporting a second copy of the same one-line rule under a new name: a ward's confirmed count is
 * fresh while less time has passed than the ward itself said the figure is good for.
 */
/**
 * ⚠️ **A DELIBERATE SECOND COPY OF `capacityIsFresh` (`ward-eligibility.ts`), AND THE REASON IS
 * WRITTEN DOWN RATHER THAN LEFT SILENT.** The two predicates are character-for-character identical
 * today. That is not an accident to tidy away, but it IS a drift risk: if the placement gate's
 * definition of stale ever changes and this does not, **the screen would print "fresh" about a
 * figure the gate calls stale** — the screen and the refusal disagreeing about the same ward.
 *
 * It is copied rather than imported because `capacityIsFresh` is module-private to
 * `ward-eligibility.ts`, and widening a shared clinical module's surface is not this screen's call
 * to make. **The better fix is to export that one function and delete this** — raised with Ward
 * Lead 2026-09-05. Follows the `communityTeamKey` precedent, which duplicates deliberately and
 * says so.
 */
function isConfirmationFresh(unit: Unit, now: Instant): boolean {
  return now - unit.allocatable.confirmedAt <= unit.allocatable.staleAfterMinutes;
}

/**
 * A plain-words label for which of the four bed kinds (`BedKindId` in `capacity-derivations.ts`)
 * this ward can offer — computed directly from `Unit`'s own locked/open designation helpers, the
 * same ones `bedKindGaps` itself reduces over. Older-adult and youth wards are not split by lock
 * state anywhere else in this product (see `bedKindOfMovement`'s own comment in the derivations
 * file), so neither is this label.
 */
function bedKindsServed(unit: Unit): string {
  if (unit.cohort !== "Adult") return unit.cohort;
  const kinds: string[] = [];
  if (unitHasLockedBeds(unit)) kinds.push("Locked adult");
  if (unitHasOpenBeds(unit)) kinds.push("Open adult");
  return kinds.length > 0 ? kinds.join(" & ") : "Adult (no beds)";
}

function formatGap(gap: number): string {
  return gap > 0 ? `+${gap}` : `${gap}`;
}

/**
 * ⚠️ STATE IS A WORD BEFORE IT IS A COLOUR (design lock § behaviour, rule 1). A negative gap must
 * read as a shortfall in the row's own words, never only as a minus sign or a tinted number — this
 * is the one thing this whole merge's design lock names by section number.
 */
function GapWord({ gap }: { gap: number }) {
  const word = gapWord(gap);
  return <WardChip level={word.level}>{word.text}</WardChip>;
}

function gapWord(gap: number): { level: WardChipLevel; text: string } {
  if (gap < 0) return { level: "urgent", text: "Shortfall" };
  if (gap === 0) return { level: "routine", text: "Exactly enough" };
  return { level: "accepted", text: "Spare capacity" };
}

function GapRow({ row }: { row: BedKindGap }) {
  return (
    <tr data-testid={`ward-capacity-gap-row-${row.id}`}>
      <td>
        <strong>{row.need}</strong>
        <div className={styles.who}>{row.who}</div>
      </td>
      <td data-testid="ward-capacity-waiting">{row.waiting}</td>
      <td data-testid="ward-capacity-beds-that-fit">{row.bedsThatFit}</td>
      <td data-testid="ward-capacity-gap-value">
        <GapWord gap={row.gap} /> <span className={styles.gapNumber}>{formatGap(row.gap)}</span>
      </td>
      <td>{rowSentence(row)}</td>
    </tr>
  );
}

/**
 * ⚠️ EVERY WORD HERE COMES FROM THE ROW'S OWN FIELDS. No count in this sentence is written in —
 * `waiting`, `bedsThatFit` and the magnitude of `gap` are read straight off `row`, so a fixture
 * change changes this sentence by construction rather than leaving it stale and confidently wrong.
 */
function rowSentence(row: BedKindGap): string {
  const magnitude = Math.abs(row.gap);
  const bedWord = row.bedsThatFit === 1 ? "bed" : "beds";
  const who = row.who.charAt(0).toLowerCase() + row.who.slice(1);
  if (row.gap < 0) {
    return `${row.waiting} waiting (${who}), only ${row.bedsThatFit} ${bedWord} that fit — ${magnitude} short.`;
  }
  if (row.gap === 0) {
    return `${row.waiting} waiting (${who}), exactly ${row.bedsThatFit} ${bedWord} that fit — nobody goes without today.`;
  }
  return `${row.bedsThatFit} ${bedWord} that fit, more than the ${row.waiting} waiting (${who}) — ${magnitude} spare.`;
}

function totalsSentence(totals: { waiting: number; bedsThatFit: number; gap: number }): string {
  const magnitude = Math.abs(totals.gap);
  if (totals.gap < 0) {
    return `Across all four bed kinds, ${totals.waiting} people are waiting and only ${totals.bedsThatFit} beds fit any of their needs — ${magnitude} short overall.`;
  }
  if (totals.gap === 0) {
    return `Across all four bed kinds, ${totals.waiting} people are waiting and exactly ${totals.bedsThatFit} beds fit — nobody goes without today.`;
  }
  return `Across all four bed kinds, ${totals.bedsThatFit} beds fit, more than the ${totals.waiting} people waiting — ${magnitude} spare overall.`;
}

function NetworkRow({
  row,
  now,
  onRequestRefresh,
}: {
  row: NetworkWardRow;
  now: Instant;
  onRequestRefresh: () => void;
}) {
  const site = siteByCode(row.unit.siteCode);
  // Wards are always named, never shown as a bare code — mirrors `edById`'s own missing-lookup
  // fallback in `delays-screen.tsx` rather than inventing a second wording for the same case.
  const siteLabel = site ? site.name : `No site matches "${row.unit.siteCode}"`;
  return (
    <tr data-testid={`ward-capacity-network-row-${row.unit.id}`}>
      <td>
        <strong>{row.unit.name}</strong>
        <div className={styles.who}>{siteLabel}</div>
      </td>
      <td>{bedKindsServed(row.unit)}</td>
      {/*
        🔴 THE CLEANING COUNT SITS BESIDE THE FIGURE, AND THE FIGURE ITSELF DOES NOT MOVE.
        Owner ruling 2026-09-05. "Ready" counted beds the application refuses to admit a patient
        into — the reducer rejects PULL_PATIENT with "every free bed at X is still being made
        ready" — so a coordinator could commit two patients and have the second refused at the
        moment of action, after the ward had been told. He ruled to SHOW the pending count rather
        than subtract it, because an earlier ruling of his avoids the figure lurching as cleaning
        starts and stops. Absence stated in words, never a bare 0 for "we were not told".
      */}
      <td data-testid="ward-capacity-network-ready">
        {/*
          🔴 A POSSIBLE-ZERO IS STATED IN WORDS, NEVER THE DIGIT — restored 2026-09-05, and this
          screen was already obeying the rule two columns over ("Not tracked here" for an untracked
          freeing figure) while contradicting it here. Three wards rendered a bare "0"; the census
          at docs/ward-flow/bed-figure-wording-census-2026-09-04.md §7 has the render evidence and
          the counter-argument the owner decided against.

          ⚠️ The word REPLACES the digit and never sits beside it. A cell reading "0 none" passes a
          careless assertion and is worse than either alone.
        */}
        {row.ready === 0 ? <span className={styles.notTracked}>none</span> : row.ready}
        {row.pendingPreparation !== undefined && row.pendingPreparation > 0 ? (
          <small className={styles.beingMadeReady} data-testid="ward-capacity-network-pending">
            {row.pendingPreparation} still being made ready
          </small>
        ) : null}
        {/*
          🔴 **THE SEX-MIX SIGNAL — Ward Lead ruling 2026-09-05, built here 2026-09-06.**

          A ward whose recorded male/female total disagrees with its occupancy is mid-update:
          `RELEASE_BED` raises `allocatable` and `empty` together and cannot touch `sexMix`, because
          nothing in the model knows which sex left and guessing would invent a fact about a person.
          `allocatable` is what `ready` reads, so the figure beside this note has just moved.

          ⚠️ **THE SIGNAL, NOT THE DATA.** No sex mix appears here and none should: whether those
          counts belong on a network view is still an open question for the owner. What is said is
          only what a coordinator needs and what is safe to state.

          ⚠️ It renders ONLY when the two genuinely disagree. At seed every ward holds the identity,
          so this is silent on a settled board — an always-visible caution would be ignored within a
          day and would make every figure look doubtful.
        */}
        {row.bedRecordsMidUpdate ? (
          <small className={styles.midUpdate} data-testid={`ward-capacity-mid-update-${row.unit.id}`}>
            This ward&rsquo;s bed records are mid-update — this figure may not be settled.
          </small>
        ) : null}
      </td>
      <td data-testid="ward-capacity-network-locked">{row.lockedReady}</td>
      <td
        data-testid="ward-capacity-network-freeing"
        className={row.freeing === undefined ? styles.notTracked : undefined}
      >
        {freeingCellText(row.freeing)}
      </td>
      {/*
        🔴 WHETHER THIS WARD MAY LAWFULLY HOLD A DETAINED PATIENT — restored to the NETWORK view
        2026-09-05. It was never wholly lost: `ward/ward-screen.tsx` and `coordinator/flow-diagram.tsx`
        both render it. What the fold lost is seeing it for every ward AT ONCE, which is the question
        a capacity board answers and a per-ward page cannot.

        ⚠️ Rendering the flag is not a legal claim — it is `Unit.authorised`, the ward's own recorded
        statutory fact, in the codebase's existing wording. Nothing here decides eligibility;
        `ward-eligibility.ts` owns that and still refuses at the point of action.
      */}
      <td data-testid={`ward-capacity-authorised-${row.unit.id}`}>
        {row.unit.authorised ? "MHA-authorised" : "not MHA-authorised"}
      </td>
      <td>
        {/*
          🔴 WHO CONFIRMED IT, RESTORED 2026-09-05 — MY FOLD DROPPED IT AND A GREEN TEST HID THAT.
          The old capacity view passed `confirmedByRole` and `derived`; this screen replaced it and
          passed neither, so every ward read a bare "Confirmed 10:32" where it used to read
          "Confirmed 10:32 · NUM Armadale". The distinction is not decoration: `source === "ward"`
          means the WARD ITSELF confirmed the figure, and anything else means it was derived from a
          feed nobody stood behind. A coordinator ringing a ward about its own number needs to know
          which of those they are looking at.

          ⚠️ It survived because `ward-capacity-freshness-source.dom.test.tsx` still renders the OLD
          mode, which no route reaches any more — a clinical guard passing forever about a screen
          nobody can open, while a reader counting green ticks concludes THIS screen has attribution.
          Found by Ward Lead after the fold.
        */}
        <WardFreshness
          confirmedAt={row.confirmedAt}
          confirmedByRole={row.unit.allocatable.source === "ward" ? `NUM ${row.unit.name}` : undefined}
          derived={row.unit.allocatable.source !== "ward"}
          now={now}
        />
      </td>
      {/*
        🔴 THE COORDINATOR'S ONE PERMITTED ACTION ON THIS BOARD, RESTORED 2026-09-05.

        ⚠️ **THIS WAS A CAPABILITY LOST BY ACCIDENT, NOT BY DECISION.** `REQUEST_CAPACITY_REFRESH`
        was dispatched from exactly ONE place in the codebase — the capacity view MERGE 02 retired —
        while the event type, the reducer case, the provider list and the ward-side DISPLAY of a
        request all kept working. So no coordinator could ask a ward to restate its numbers, and
        `ward/ward-screen.tsx` carried a mark for something nothing could produce: a field with no
        producer, invisible to every gate because each half was individually correct.

        ⚠️ It moves NO bed figure, and that is the whole point of it. The reducer appends to
        `refreshRequests` and touches nothing else — it records that somebody asked.
      */}
      <td>
        <button
          type="button"
          className={styles.refreshButton}
          data-testid={`ward-capacity-refresh-${row.unit.id}`}
          onClick={onRequestRefresh}
        >
          Ask this ward to restate its numbers
        </button>
      </td>
    </tr>
  );
}
