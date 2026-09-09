"use client";

import Link from "next/link";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  edStatisticsHref,
  statisticsSectionById,
  wardStatisticsHref,
  STATISTICS_UNIT_CHOOSER_ID,
} from "@/components/ward-management/statistics/statistics-sections";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { EmergencyDepartment, Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { allWardStatistics, type WardStatistics } from "@/components/ward-management/ward-statistics";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";

import styles from "./statistics-sections.module.css";

/**
 * WARD AND ED COMPARISONS — and the chooser that is the only way into the per-unit detail pages.
 *
 * ⚠️ **NO COMPARISON IS SHOWN, AND THE LIST BELOW IS NOT ONE.** The list is navigation: every ward
 * and every emergency department, each a link to its own detail page. It is not a ranking, not a
 * shortlist and not an ordering by anything — the units keep the order the fixture records them in,
 * and the page says so, because a list of units on a page headed "comparisons" is read as a league
 * table unless it denies being one.
 *
 * ⚠️ **THE COMPARISON IS BUILT — TWO TABLES, SINCE 2026-09-05 — AND THIS PARAGRAPH SAID IT WAS NOT
 * UNTIL THE SAME DAY.** It read "the comparison itself is the hard part and it is not built", which
 * was true when written and false from the moment the tables landed a few hundred lines below it.
 * **A "not built yet" note is a claim with an expiry date and nothing connects it to the work that
 * expires it** — the shape this file's sibling `statistics-overview-screen.tsx` warns about in its
 * own words, found here by the owner asking a plain question about which pages were finished.
 *
 * **The reasoning it carried is not stale and is kept, because it still governs every column.**
 * Choosing which measure to set beside every unit decides what the page claims, and a figure shown
 * side by side carries a verdict whether or not one was intended — a ward at the bottom of a column
 * looks like a ward doing badly, when it may simply be the ward taking the people nobody else can.
 * That question is answered per measure, and it is why `Empty-bed time` was removed rather than
 * annotated and why the sixth ward measure is stated in a note rather than given a column.
 *
 * **Why the chooser lives here.** The per-unit detail routes are dynamic — one route serving every
 * ward, one serving every emergency department — so the section has no index page of its own, and
 * a dynamic route with no concrete link anywhere is a page only reachable by typing an address.
 * This is the one page whose subject is the whole set of units, so this is where the way in
 * belongs. `STATISTICS_UNIT_CHOOSER_ID` is the anchor the hub's third section links to.
 *
 * **Wards come from the provider's live `units`**, never from the frozen fixture, which is what
 * `tests/ward-flow-single-source.test.ts` requires of every screen: a surface reading `allUnits()`
 * instead of live state is how a ward that has changed can still be described by its seeded values.
 * This page renders no unit state at all, so it could not show that staleness today — but the rule
 * is structural on purpose, and "this screen's fields never change" is exactly the exemption that
 * would stop it meaning anything. Emergency departments are not in provider state at all (they are
 * identity, not capacity), so they come from `allEmergencyDepartments()`, the same source
 * `ed-screen.tsx` resolves a department from.
 */
export function StatisticsCompareScreen({
  units: unitsOverride,
  emergencyDepartments: edsOverride,
  admissions: admissionsOverride,
}: {
  /** A testing seam only — nothing in the app passes any of them. The route renders this screen with
   *  no props, exactly as `WardIndex` documents on its own override: it exists so a test can render
   *  states the seeded network cannot produce, such as a unit whose site code resolves to nothing. */
  units?: Unit[];
  emergencyDepartments?: EmergencyDepartment[];
  /**
   * ⚠️ **ADDED 2026-09-05 TO CLOSE A COVERAGE GAP A SECOND READER FOUND BY LOOKING AT THE PAGE.**
   * Ward Lead's own ruling names a null average rendered as a number the single most likely way
   * these screens could lie — and **not one ward in the seeded fixture has a null average**, so on
   * the compare screen that branch was rendered by nothing and asserted by nothing. An empty
   * admission list is the state that produces it, and the seed cannot produce that state.
   *
   * The route must never pass this, for the reason `community/[teamId]/page.tsx` records at length:
   * a route that pins a screen to a fixture silently overrides live state, and a duration computed
   * against a frozen seed inflated every wait on two screens in this project.
   */
  admissions?: Admission[];
} = {}) {
  const { units: liveUnits, admissions: liveAdmissions, movements, now } = useWardFlow();
  const admissions = admissionsOverride ?? liveAdmissions;
  const units = unitsOverride ?? liveUnits;
  const emergencyDepartments = edsOverride ?? allEmergencyDepartments();

  const section = statisticsSectionById("compare");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'compare' section");

  const perUnitSection = statisticsSectionById("units");
  if (!perUnitSection) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  return (
    <StatisticsSectionFrame
      section={section}
      subtitle="What this section is for, what has not been built in it yet, and the way in to a single unit."
      testId="ward-statistics-compare-screen"
    >
      <WardPanel title="What this section will hold" testId="ward-statistics-compare-scope">
        <div className={styles.panelBody}>
          <p className={styles.body}>{section.description}</p>
        </div>
      </WardPanel>

      {/*
       * 🔴 **TWO TABLES, BECAUSE THE TWO KINDS ATTRIBUTE FROM DIFFERENT RECORDS.**
       *
       * The rule this page set itself, and both sides pass it: a measure can be set against a
       * named unit only when the record it comes from carries a REQUIRED unit id. A ward figure
       * attributes through `Admission.unitId`; a department figure through `Movement.originEdId`.
       * Both are required and neither is optional, so neither column attributes to only part of
       * its population.
       *
       * ⚠️ **They attribute cleanly and they attribute from DIFFERENT records, which is exactly
       * why they cannot share a table.** One grid with a ward's columns over a department's rows
       * leaves half the cells empty, and a blank cell in a comparison reads as a measured zero —
       * the same defect as a null average rendered as a nought, wearing a different hat.
       */}
      <WardPanel title="Why this is two tables and not one" testId="ward-statistics-compare-why-two">
        <div className={styles.panelBody}>
          <p className={styles.body}>
            A ward is measured by its beds and a department has none in this prototype — no capacity, no occupancy and
            no length of stay. Setting them in one grid would leave half of it blank, and{" "}
            <strong>a blank cell in a comparison reads as a figure that was measured and came to nothing</strong>. So
            each kind is compared against its own kind, on the measures its own records can carry.
          </p>
          <p className={styles.body} data-testid="ward-statistics-compare-attributability-rule">
            <strong>
              A measure can be set against a named ward only when the record it comes from carries a required unit id.
            </strong>{" "}
            That is the test every column here will have to pass, and it is a property of the record rather than a
            judgement about the measure. An admission always carries the ward it is on — every one of them, with no
            exceptions — so anything derived from admissions attributes cleanly. A unit id that is optional attributes
            only to the part of the population where it happens to be set — which is never the whole column, and never
            the part a reader assumes.
          </p>

          <p className={styles.body} data-testid="ward-statistics-compare-declines-example">
            <strong>Declines are the worked example, and the asymmetry in them is the thing to see.</strong> A referral
            decline sits on the referral itself, whose ward destination records the BED&apos;S CRITERIA — the sex it
            must suit, whether it must be secure, whether it must be able to hold somebody involuntarily — and never a
            ward. The one place a ward can be named on that record is filled in only when a ward ACCEPTS. So from a
            single record an acceptance is attributable to a named ward and a decline is not — and in a comparison table
            those two would sit in adjacent columns looking equally solid, one of them counting the whole population and
            the other counting only the part that said yes.
          </p>
          <p className={styles.body} data-testid="ward-statistics-compare-double-count-example">
            <strong>Referrals received is the other one, and it fails differently — it double-counts.</strong> A
            movement records the wards a person has been referred to as a LIST, not a single ward: one person&apos;s
            referral can be live at several wards at once, up to a fixed cap. A per-ward column of referrals received
            would therefore sum to more than the number of referrals that exist, and the more widely a referral is cast
            the wider the gap. It reconciles to nothing, and the arithmetic gets blamed.
          </p>

          <p className={styles.note}>
            Anything keyed to the department a person came from attributes to an emergency department, not to a ward —
            which is a category error rather than a rounding one. Which measures survive all of this, and whether
            setting any of them side by side implies a judgement nobody intends, is the owner&apos;s decision rather
            than an implementer&apos;s.
          </p>
        </div>
      </WardPanel>

      <WardPanel title="Wards">
        <div className={styles.panelBody}>
          <CompareTable
            className={styles.compareWardTable}
            testId="ward-statistics-compare-wards"
            rowHeader="Ward"
            columns={WARD_COLUMNS}
            rows={allWardStatistics(units, admissions, now).map(({ unit, statistics }) => ({
              id: unit.id,
              name: unit.name,
              row: statistics,
            }))}
          />
          <p className={styles.note}>
            {/*
             * The sixth measure is omitted rather than shown as a column of identical absences, and
             * omitting it silently is the thing this note exists to prevent.
             */}
            A sixth ward measure exists and is not a column here. <strong>The average wait after being accepted</strong>{" "}
            is unmeasurable on every ward — nothing on the record marks the moment somebody accepted in principle began
            waiting — so a column of it would carry the same absence twenty-three times and say nothing about any ward.
            The single-ward pages state it in full.
          </p>
        </div>
      </WardPanel>

      <WardPanel title="Emergency departments">
        <div className={styles.panelBody}>
          <CompareTable
            className={styles.compareEdTable}
            testId="ward-statistics-compare-eds"
            rowHeader="Department"
            columns={ED_COLUMNS}
            rows={emergencyDepartments.map((department) => {
              const mine = movements.filter((movement) => movement.originEdId === department.id && isOpen(movement));
              return {
                id: department.id,
                name: department.name,
                row: {
                  onTheList: mine.length,
                  urgent: mine.filter((movement) => movement.flaggedUrgent).length,
                  unplaced: mine.filter((movement) => movement.acceptedUnitId === undefined).length,
                },
              };
            })}
          />
          <p className={styles.note}>
            Every figure here counts <strong>the people standing in a department</strong>, never the department itself.
            How busy a department is cannot be counted at all: its medical staff are not users of this system, their
            request arrives verbally, and an attendance nobody told psychiatry about is outside the model entirely.
          </p>
        </div>
      </WardPanel>
      {/* ⚠️ THE ANCHOR MOVED FROM THE HEADING TO A WRAPPER, AND IT IS THE SAME TARGET. `WardPanel`
          renders the heading itself and takes no id, and `STATISTICS_UNIT_CHOOSER_ID` is a pure
          scroll target — the hub's third section links to `#choose-a-unit` and nothing reads it as
          an `aria-labelledby`. A wrapper lands the reader on the panel rather than inside it, which
          is if anything the better place to arrive. Adding an id prop to the shared primitive for
          one call site would have been the other way, and it is a change to a file four ward
          branches read. */}
      <div id={STATISTICS_UNIT_CHOOSER_ID}>
        <WardPanel title="Choose a ward or emergency department" testId="ward-statistics-compare-chooser">
          <div className={styles.panelBody}>
            <p className={styles.body}>{perUnitSection.description}</p>

            {/*
             * ⚠️ **WHY THE CHOOSER IS HERE, SAID ON THE SCREEN.** Until fix round 1 this reasoning lived
             * only in this file's doc comment, where the reader it is for — somebody who arrives
             * wondering why a list of units is on a page about comparisons — will never look. The
             * arrangement is deliberate and a reader is entitled to know that rather than infer a
             * mistake.
             */}
            <p className={styles.note} data-testid="ward-statistics-compare-chooser-rationale">
              The unit list is on this page because per-unit detail has no page of its own: one route serves every ward
              and another serves every emergency department, so the way in is a choice rather than an index. This is the
              page whose subject is the whole set of units, so this is where that choice belongs.
            </p>

            {/*
             * The denial has to be on the page, not only in the source. A list of every unit under a
             * heading about comparisons is read as an ordering by something; saying plainly that it is
             * the order the units are recorded in costs one sentence and removes the inference.
             */}
            <p className={styles.note} data-testid="ward-statistics-compare-order-note">
              These are in the order the prototype records them in, which carries no meaning. Nothing here is ranked,
              scored, sorted by any measure, or hidden.
            </p>

            <h3 className={styles.subHeading}>Wards</h3>
            {units.length === 0 ? (
              <p className={styles.emptyNote} data-testid="ward-statistics-compare-no-wards">
                No ward is recorded in this prototype, so there is none to choose.
              </p>
            ) : (
              <ul className={styles.unitList} data-testid="ward-statistics-compare-ward-list">
                {units.map((unit) => {
                  const site = siteByCode(unit.siteCode);
                  return (
                    <li key={unit.id} className={styles.unitItem}>
                      <Link href={wardStatisticsHref(unit.id)} className={styles.unitLink}>
                        <span className={styles.unitName}>{unit.name}</span>
                        {/* A ward whose site code resolves to nothing still appears, and says so, rather
                          than vanishing from the list. A unit silently dropped from the only chooser
                          that reaches its detail page is unreachable AND unreported. */}
                        <span className={styles.unitKind}>
                          {site ? site.name : "Its site code matches no site in this prototype."}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <h3 className={styles.subHeading}>Emergency departments</h3>
            {emergencyDepartments.length === 0 ? (
              <p className={styles.emptyNote} data-testid="ward-statistics-compare-no-eds">
                No emergency department is recorded in this prototype, so there is none to choose.
              </p>
            ) : (
              <ul className={styles.unitList} data-testid="ward-statistics-compare-ed-list">
                {emergencyDepartments.map((department) => {
                  const site = siteByCode(department.siteCode);
                  return (
                    <li key={department.id} className={styles.unitItem}>
                      <Link href={edStatisticsHref(department.id)} className={styles.unitLink}>
                        <span className={styles.unitName}>{department.name}</span>
                        <span className={styles.unitKind}>
                          {site ? site.name : "Its site code matches no site in this prototype."}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </WardPanel>
      </div>
    </StatisticsSectionFrame>
  );
}

/**
 * One cell, as the page will actually read it.
 *
 * ⚠️ **`text` IS THE CELL, NOT A LABEL BESIDE IT — AND THAT IS THE WHOLE DESIGN.** The sameness
 * note below asks whether a column separates any two units, and it can only honestly ask that of
 * the thing the reader sees. A column definition carrying a rendered node AND a separate
 * comparison key would be two surfaces answering one question in wording that can drift, which is
 * the defect this repository names as its most reliable. So every cell on both tables is text,
 * and the only decoration is whether that text is an absence.
 */
type CompareCell = { readonly text: string; readonly unmeasured?: boolean };

type CompareColumn<Row> = { readonly header: string; readonly cell: (row: Row) => CompareCell };

type CompareRow<Row> = { readonly id: string; readonly name: string; readonly row: Row };

/** A measured count. Nought is a true and correct answer and renders as one — see `ward-statistics.ts`. */
function count(value: number): CompareCell {
  return { text: String(value) };
}

/** A figure that cannot be FORMED, worded rather than flattened. Never a nought and never a dash. */
function cannotBeFormed(words: string): CompareCell {
  return { text: words, unmeasured: true };
}

const WARD_COLUMNS: readonly CompareColumn<WardStatistics>[] = [
  {
    header: "Average stay",
    /*
     * ⚠️ THIS CELL APPLIED `.toFixed(1)` UNTIL 2026-09-06 AND IT WAS THE THIRD TREATMENT OF ONE
     * FIGURE. The field's own comment said "whole days", nothing rounded, this screen showed one
     * decimal, and the per-ward screen showed all fourteen — so the same average appeared three
     * ways depending on where you read it, and only this screen looked right.
     *
     * 🔴 **THIS SCREEN WAS NOT THE BUG AND REMOVING ITS ROUNDING IS STILL THE FIX.** A correct
     * local repair is what let the defect survive: it made the compare table honest and left the
     * ward pages publishing fourteen decimals, with nothing to notice the disagreement because
     * each screen was self-consistent. Rounding now happens once, at the derivation, so both
     * screens inherit it and a third caller cannot invent a fourth treatment.
     */
    cell: (statistics) =>
      statistics.averageLengthOfStayDays === null
        ? cannotBeFormed("none completed")
        : { text: `${statistics.averageLengthOfStayDays} days` },
  },
  /*
   * 🔴 **`Empty-bed time` IS NOT A COLUMN HERE, AND IT IS NOT BECAUSE THE SEED HAPPENS NOT TO VARY
   * IT. IT IS ARITHMETICALLY INCAPABLE OF VARYING.** Ward Lead's ruling, 2026-09-05, on a stronger
   * diagnosis than the one I brought — I read `300 min` on all twenty-three wards as a fixture with
   * no spread, and it is an identity. Verified in `ward-admissions-seed.ts` rather than inferred:
   *
   *   PULL_TO_ARRIVAL_MINUTES = 5 * 60                      (`:71`)
   *   state "occupied"   pulledAt = arrivedAt - that        (`:278`)  gap === 300, by construction
   *   state "departed"   pulledAt = arrivedAt - that        (`:346`)  gap === 300, by construction
   *   state "pulled"     pulledAt varies, arrivedAt is null (`:245`)  excluded — no gap at all
   *                      pulledAt null                      (`:383`)  excluded
   *
   * `emptyBedMinutes` averages `arrivedAt - pulledAt` over the admissions that have both. **Every
   * member of that set is 300, so the average is 300 for any ward, any subset and any regrowth of
   * this fixture.** There is no arrangement of the seed that makes this column vary.
   *
   * ⚠️ **SO TWENTY-THREE ROWS OF "300 min" WERE NOT A MEASUREMENT WITHOUT SPREAD. THEY WERE THE
   * CONSTANT `PULL_TO_ARRIVAL_MINUTES` PRINTED TWENTY-THREE TIMES WITH WARD NAMES BESIDE IT** — on
   * the one screen whose entire purpose is setting wards against each other, and indistinguishable
   * to a reader from twenty-three wards that genuinely perform alike.
   *
   * ⚠️ **AND A NOTE WAS THE WRONG REMEDY, WHICH IS THE PART I HAD WRONG.** I built one and it read
   * correctly; it still asks a reader to discount a figure the page is presenting at heading weight
   * in a table built for comparison. **This page's own governance sentence forbids that trade in
   * the other direction** — it refuses a blank cell because a blank reads as a measured nothing. A
   * constant reads as a measured sameness. Same distinction, same screen, and a footnote repairs
   * neither.
   *
   * **PARKED, NOT ABANDONED, WITH A NAMED TRIGGER: when the seed varies pull-to-arrival per
   * admission, this column comes back.** Nothing else has to change for that.
   *
   * **It stays on the per-ward screen and that is deliberate.** One figure on one ward's page
   * invites no cross-ward inference, and the registered claim
   * `statistics-ward-screen/computed/average-empty-bed-minutes-is-derived` is about the derivation
   * being real — which it is, and which removing a compare column does not touch.
   */
  /*
   * 🔴 **A NOUGHT IN THESE TWO IS A MEASUREMENT AND MUST LOOK LIKE ONE.** Both are `number`, never
   * `number | null`, and `ward-statistics.ts` says why in its own words: "the count-based figures …
   * are genuine counts, so `0` is a true and correct answer for them when there is no data."
   *
   * ⚠️ They rendered as a muted "none" until 2026-09-05, which is **this page's own governance
   * sentence run backwards.** The page refuses a blank cell because a blank reads as a measured
   * nought; wording a measured nought as an absence destroys the same distinction from the other
   * side. Twelve of the twenty-three wards have nobody ready-to-leave-but-blocked, which is good
   * news about those wards, and it read as "we have nothing for you".
   */
  { header: "Ready, blocked", cell: (statistics) => count(statistics.readyToLeaveCannot) },
  { header: "Long stays", cell: (statistics) => count(statistics.longStays) },
  {
    /*
     * ⚠️ **NEITHER OF THE ABOVE, AND ITS OLD WORDING WAS FALSE.** It said "none written down", and
     * `consideredCount` is `met + missed` — an outcome counts only where the admission has BOTH a
     * date AND has left. **A ward could have twenty written-down discharge dates and nobody yet
     * departed, and this cell said none had been written.** It is not a measured nought either:
     * 0 of 0 is undefined, not zero. So it keeps the absence styling, with wording saying which
     * absence it is.
     */
    header: "Discharge dates",
    cell: ({ dischargeDateOutcomes }) =>
      dischargeDateOutcomes.consideredCount === 0
        ? cannotBeFormed("no outcomes yet")
        : { text: `${dischargeDateOutcomes.met} of ${dischargeDateOutcomes.consideredCount} met` },
  },
];

type EdRow = { readonly onTheList: number; readonly urgent: number; readonly unplaced: number };

/** All three are lengths of a filtered list, so nought is a count and never an absence. */
const ED_COLUMNS: readonly CompareColumn<EdRow>[] = [
  { header: "On the list", cell: (row) => count(row.onTheList) },
  { header: "Marked urgent", cell: (row) => count(row.urgent) },
  { header: "No ward yet", cell: (row) => count(row.unplaced) },
];

/**
 * Which columns give every unit the same answer, and therefore separate nothing.
 *
 * ⚠️ **THIS IS A BACKSTOP, NOT THE REMEDY, AND THE DISTINCTION IS THE RULING.** The remedy for a
 * column that separates nothing is to REMOVE it — `Empty-bed time` was removed above rather than
 * annotated, because a note asks a reader to discount a figure the page is presenting at heading
 * weight in a table built for comparison, and this page's own governance sentence forbids that
 * trade in the other direction. **No column that is uniform on the seeded fixture may ship**, and
 * `ward-statistics-compare-two-tables.dom.test.tsx` fails if one does.
 *
 * What this is for is the case no test can foresee: real data, later, making some column degenerate
 * at runtime where the fixture did not. **A sentence typed into the page cannot cover that** — it is
 * true today and goes false in silence, because nobody re-derives a note when the data changes.
 * Computed, it appears exactly when the condition holds and removes itself when it stops, and it is
 * falsifiable in both directions, which no prose note can be.
 *
 * ⚠️ **AND THE FIX THAT MUST NOT BE MADE, RECORDED HERE BECAUSE IT IS THE FIRST THING ANYONE WILL
 * SUGGEST: DO NOT VARY THE SEED TO MAKE A COLUMN "WORK".** Manufacturing variance on a comparison
 * screen manufactures a ranking out of nothing, and ward A would look better than ward B on a
 * number nobody measured. This product has refused that shape repeatedly — no tier colours, no
 * occupancy ceiling, no sorting by worst. A constant is honest and inert; an invented spread would
 * be dishonest and active. **Varying pull-to-arrival because the model should vary it is a
 * different act with a different reason, and that is the trigger for the column's return.**
 *
 * A single row cannot be uniform in any useful sense, so a one-row table reports nothing.
 */
function columnsThatSeparateNothing<Row>(
  columns: readonly CompareColumn<Row>[],
  rows: readonly CompareRow<Row>[],
): readonly string[] {
  if (rows.length < 2) return [];
  return columns
    .filter((column) => new Set(rows.map(({ row }) => column.cell(row).text)).size === 1)
    .map((column) => column.header);
}

/** English for a list of column names, so the note reads as a sentence rather than as output. */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * One comparison table, plus the note about its own uniform columns.
 *
 * The note is quiet and sits under the table on purpose. A degeneracy made the loudest thing on a
 * clinical screen invents a finding of its own; this is a footnote about the prototype, not a
 * headline about the wards.
 */
function CompareTable<Row>({
  className,
  testId,
  rowHeader,
  columns,
  rows,
}: {
  className: string;
  testId: string;
  rowHeader: string;
  columns: readonly CompareColumn<Row>[];
  rows: readonly CompareRow<Row>[];
}) {
  const uniform = columnsThatSeparateNothing(columns, rows);
  const unit = rowHeader.toLowerCase();
  return (
    <>
      {/*
       * ⚠️ **THE OPT-IN IS THE POINT, AND IT IS WHY THE PROP IS NOT DERIVED.** Whether a table is
       * currently overflowing is a runtime measurement of `scrollWidth` against `clientWidth`, and
       * asking for it would make `WardTable` a client component — a boundary change across eleven
       * tables, on a primitive whose two previous Server/Client defects passed typecheck and 7,500
       * tests and were catchable only by a build or a live request. So the caller that DECLARES a
       * threshold is the caller that asserts the table can be too wide, and it says so here.
       *
       * Both these tables declare one (`--ward-table-min-width`, 35rem and 27.5rem), so both are
       * true. The sentence it renders is about narrow screens generally, not about this render —
       * which is what lets it be honest without measuring anything.
       */}
      <WardTable className={className} testId={testId} hasScrollThreshold>
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            {columns.map((column) => (
              <th key={column.header} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, name, row }) => (
            <tr key={id}>
              <th scope="row">{name}</th>
              {columns.map((column) => {
                const cell = column.cell(row);
                return (
                  <td key={column.header} className={styles.num}>
                    {cell.unmeasured ? <span className={styles.unmeasured}>{cell.text}</span> : cell.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </WardTable>
      {uniform.length > 0 && (
        <p className={styles.note} data-testid={`${testId}-uniform`}>
          <strong>
            {joinNames(uniform)} {uniform.length === 1 ? "gives" : "give"} every {unit} the same answer here, so{" "}
            {uniform.length === 1 ? "it separates" : "they separate"} nothing.
          </strong>{" "}
          That is a property of this prototype&apos;s own data rather than a finding about the {unit}s. It is not
          evidence that they are alike, and the figure is not varied to make the column look useful — an invented spread
          on a comparison screen would be a ranking nobody measured.
        </p>
      )}
    </>
  );
}
