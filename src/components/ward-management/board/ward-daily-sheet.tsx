import { dayOf, formatInstant, type Instant } from "@/components/ward-management/ward-clock";

import styles from "./board.module.css";

/**
 * THE WARD'S DAILY SHEET — the page a charge nurse carries into the morning meeting.
 *
 * Spec: D19 ("the printed page is the ward's handover sheet ... who came in, who is going, who is
 * stuck, who is overdue"), DB-10 (the sheet is current at the moment it is printed, and the stamp
 * that says so is load-bearing), DB-11 (nothing is frozen — one live picture, on screen and on
 * paper) and DB-12 (the stamp must read the SAME instant the figures read).
 *
 * **It derives nothing.** Every figure and every row arrives as a prop, already computed by
 * `ward-board.tsx` from the shared derivations (`headlineAvailable`, `constraintSentence`,
 * `sinceYesterday`, `arrowTargets`, `derivedBedReleases`, `daysInBed`, `stayBand`,
 * `isPastExpectedDischarge`). That is deliberate and it is the whole safety property of this file:
 * a sheet that re-counted anything would be a second answer to a number a clinician is holding
 * next to the screen, and the two would disagree the first time either was corrected. The only
 * thing computed here is which of the already-built rows falls into which of D19's four groups —
 * a partition, never an arithmetic.
 *
 * **What it does NOT contain, and why.** D10's editable half — dates typed in a column, shorthand
 * like `+7`, the one "nothing has changed" button — is absent. That half of the daily sheet writes
 * to the model, and this board's exemption to read the admission seed is bounded precisely by its
 * dispatching nothing (spec DB-19); building the editable sheet here would break that boundary and
 * fire the companion assertion. It is a separate piece of work on a surface allowed to emit events.
 * Stated on the sheet itself, so nobody reads its absence as "there is nothing to update".
 */

/** One row on the sheet's person groups. A structural subset of the board's own `Occupant`, named
 *  here so this component states exactly what it reads rather than importing a wider type and
 *  quietly gaining fields. Nothing in it identifies a person: the record holds no name, no date of
 *  birth and no bed, and the sheet must never look as though it does. */
export type DailySheetPerson = {
  key: string;
  days: number | null;
  bandLabel: string | null;
  pastDate: boolean;
  sex: string;
  /** `null` for an admission created by an ED arrival - Task 17, 2026-08-30. The sheet says so in
   *  words; it never omits the person and never guesses a region. */
  homeRegion: string | null;
  /** Already phrased by `tentativeDiagnosisPhrase`, never a bare block code. */
  tentativeDiagnosis: string | null;
  /**
   * Whole hours at an emergency department, or `null` while the person is on the ward.
   *
   * **On the sheet as well as the tile, and the sheet is the half that matters more.** The tile
   * was fixed first and left the paper: a patient at an ED still printed as an ordinary occupant,
   * with a day count and a discharge plan and nothing saying they were not on the ward. **This
   * sheet is read aloud at handover**, which is exactly the moment somebody asks "and where is
   * she?" — and until this, nobody on the page could answer.
   *
   * The paper is also the artefact that leaves the room. A screen is re-read; a printed sheet is
   * carried to a meeting and believed.
   */
  awayAtEdHours: number | null;
  expectedDays: number | null;
  blockReason: string | null;
};

/**
 * AN UNRULED LAYOUT DECISION, NAMED SO IT IS NOT MISTAKEN FOR A SETTLED ONE.
 *
 * D19 fixed the sheet's reading order verbatim — **who came in · who is going · who is stuck · who
 * is overdue** — and "who is off the ward" is a fifth group nobody has ruled on. It is placed LAST
 * rather than inserted into an approved sequence, which is the conservative choice and not
 * necessarily the right one: a handover might want it first, since it changes what every other
 * group's rows mean.
 *
 * **The cost that makes it a real decision rather than a preference:** this sheet already spills to
 * a second page on 22- and 24-bed wards, and a fifth column makes that worse. It was still built,
 * because a patient who is off the ward and printed as an ordinary occupant is a worse failure than
 * a two-page sheet — the same reasoning that refused to truncate the occupant list.
 *
 * `tests/ward-daily-sheet.dom.test.tsx` asserts the placement, so a ruling lands in one edit.
 */
export const AWAY_GROUP_PLACEMENT_UNRESOLVED =
  "Unruled 2026-08-30: where 'Who is off the ward' sits in the sheet's reading order, and whether a " +
  "fifth group is worth the second page on 22- and 24-bed wards. Currently last. See DailySheetGroups.";

export type DailySheetGroups = {
  /** Recorded as held up by something — `BED_RELEASE_BLOCKERS`, an owner-approved list about the
   *  BED, never about the person. */
  heldUp: DailySheetPerson[];
  /** Past the ward's own revisable expected date. Carries no legal or contractual weight. */
  overdue: DailySheetPerson[];
  /** Nobody has said when this person is expected to leave. Kept as its own group rather than
   *  folded into "overdue": an absent plan and a passed plan are different facts, and a meeting
   *  does different things about them. */
  noDate: DailySheetPerson[];
  /**
   * Off the ward at an emergency department, and its own group for a measured reason.
   *
   * **A line on the person's row was not enough, and the measurement is why.** The other three
   * groups are exceptions — stuck, overdue, no date — so a patient who is away but has an ordinary
   * discharge plan and no blocker falls into NONE of them and never printed at all. Measured, not
   * reasoned: the sheet showed **1 of 2** people away on the ward that has them.
   *
   * So being off the ward is its own exception, which is what it always was — it is exactly the
   * question a handover asks ("and where is she?") and exactly the one the sheet could not answer.
   *
   * A person can appear here AND in another group, on purpose, the same way somebody both stuck
   * and overdue appears twice: both facts are true and a meeting acts on both.
   */
  awayFromWard: DailySheetPerson[];
};

/**
 * D19's three "attention" groups, partitioned out of the rows the board already built.
 *
 * **A partition of the SAME array the board renders, not a re-derivation.** `pastDate` is
 * `isPastExpectedDischarge`'s answer and `expectedDays` is the board's own day arithmetic; this
 * function only reads them. Recomputing either from instants here would create a second opinion
 * about whether somebody is overdue, on the one page whose whole job is to be quoted out loud.
 *
 * The groups OVERLAP by design and each says so on screen: somebody can be both held up and past
 * their date, and dropping them from one group to avoid printing them twice would hide exactly the
 * person a flow meeting most needs to discuss. Order is the incoming order, which the board has
 * already sorted soonest-expected-out first — a stable, total order, so the sheet does not
 * reshuffle between two prints of the same picture.
 */
export function dailySheetGroups(people: readonly DailySheetPerson[]): DailySheetGroups {
  return {
    heldUp: people.filter((person) => person.blockReason !== null),
    overdue: people.filter((person) => person.pastDate),
    noDate: people.filter((person) => person.expectedDays === null),
    awayFromWard: people.filter((person) => person.awayAtEdHours !== null),
  };
}

/**
 * The "as at" stamp, and it is the safeguard DB-10 and DB-11 traded the frozen view for.
 *
 * **It reads the instant handed to it — the same `now` every figure on the sheet reads (DB-12).**
 * It must never call `wallClockNow()`: this prototype's screens take their `now` from a shared
 * value that a demo control can move, so a stamp on the wall clock beside figures from a moved
 * clock would assert a moment that is not the moment being shown. A stamp that can lie is worse
 * than no stamp, because the freeze was removed on the strength of it.
 *
 * **There is still no DATE, and that is stated rather than silently dropped — but the SAFEGUARD
 * DB-10 wanted now works.** DB-10 requires date AND time, for a real reason: paper outlives its
 * day, and a sheet stamped `15:22` read the next morning distinguishes nothing from one stamped
 * `15:22` the morning before. Two sheets that are two moments must not look like two claims about
 * one.
 *
 * A calendar date is still not available and is still not invented. But `a3d199fa7` gave an
 * `Instant` a DAY (`dayOf`), so the sheet can now carry which day of the demonstration it was
 * taken on — and that is sufficient for the failure DB-10 actually names, without fabricating the
 * one element the decision made load-bearing. Two sheets from different days are now visibly two
 * moments.
 *
 * **The `+ 1` is presentation and lives only here.** `dayOf` returns 0 for the opening day, and
 * "day 0" reads as a defect to anybody not holding `ward-clock.ts` open. Nothing computes from
 * this string; it is read aloud and pinned to a wall.
 *
 * **THE CALENDAR ARRIVED, AND THE SHEET STILL DOES NOT PRINT A DATE. That is a choice now, not a
 * limitation.** `b1198cf6e` gave the clock a real date (`dayZero` on the provider,
 * `calendarDateOf`), so this sheet COULD say "30 August". It does not, for two reasons, and the
 * second is the one that matters:
 *
 *   1. A reader of a ward sheet is oriented to now, not to a calendar — which is why
 *      `formatInstantWithDay` prefers "yesterday" and "3 days ago" over dates.
 *   2. **A dated sheet invites the reader to believe the FIGURES are dated, and they are not.**
 *      Every number on this page is synthetic. A real date beside invented figures is the one
 *      combination that makes a prototype look like a record.
 *
 * So the old "this prototype holds no calendar date" clause was removed the moment it became
 * false — it was a true statement about a missing capability, and leaving it in place after the
 * capability arrived would have made the sheet lie about the system rather than about the day.
 * What replaced it says what is actually true: the figures are synthetic, whatever the clock knows.
 *
 * A non-finite instant yields no time rather than `NaN:NaN` — the conservative direction this
 * whole feature takes: a sheet that cannot say when it was taken must not appear to.
 */
export function asAtStamp(now: Instant): { time: string | null; dayNote: string } {
  const time = Number.isFinite(now) ? formatInstant(now) : null;
  // A non-finite instant yields no day either: `dayOf(NaN)` is `NaN`, and "day NaN" is exactly the
  // kind of stamp this function's own doc comment refuses. No time, no day, same branch.
  const day = time === null ? null : dayOf(now) + 1;
  return {
    time,
    dayNote:
      day === null
        ? "synthetic figures — not a record of any real day"
        : `day ${day} of this demonstration — synthetic figures, not a record of any real day`,
  };
}

/** One person's line on the sheet. Deliberately shorter than the board's own `PersonEntry`: a
 *  handover sheet is read aloud, so each row is the day count, who they are and the one fact that
 *  put them in this group. The full plan — who set the date, how often it moved, whether the ward
 *  confirmed it — is on the "Who is in these beds" pages that follow, and is not repeated here. */
function SheetPerson({ person, testId }: { person: DailySheetPerson; testId: string }) {
  return (
    <li className={styles.sheetRow} data-testid={testId}>
      <p className={styles.sheetRowLead}>
        {person.days === null ? "No stay yet — not arrived" : `Day ${person.days}`}
        {person.bandLabel !== null && <span className={styles.sheetRowBand}>{person.bandLabel}</span>}
      </p>
      {/*
       * DIRECTLY AFTER THE LEAD, and above everything else about them, because it changes what
       * every line below it means: a day count, a discharge plan and a diagnosis all read
       * differently about somebody who is not on the ward.
       *
       * Only for the people it applies to — two on a twenty-bed ward — rather than a line on every
       * row saying "on the ward". This sheet already spills to a second page at 22 and 24 beds, so
       * a line per occupant would cost a page to state the ordinary case.
       *
       * Says the bed is still theirs in the same breath, as the board's panel does: "away" on a
       * bed sheet otherwise reads as "so the bed is free", and it is not — the ward is holding it.
       */}
      {person.awayAtEdHours !== null && (
        <p className={styles.sheetRowAway} data-testid={`${testId}-away`}>
          {person.awayAtEdHours === 0
            ? "At an emergency department — the bed is still theirs."
            : `At an emergency department, ${person.awayAtEdHours} ${person.awayAtEdHours === 1 ? "hour" : "hours"} — the bed is still theirs.`}
        </p>
      )}
      <p className={styles.sheetRowLine}>
        {person.sex}, {person.homeRegion === null ? "home region not recorded" : `from ${person.homeRegion}`}
      </p>
      {/* "Tentative" leads the line, as it does on the board's own panel and for the same reason: a
        reader scanning a column takes the first words of each row, so a qualification at the end is
        the half that gets skipped — and a broad ICD-10-AM block read as settled is exactly the
        misreading this field had to be justified against. Both states are stated; silence would
        leave a reader unable to tell "nobody wrote one down" from "this sheet does not show them". */}
      <p className={styles.sheetRowLine}>
        {person.tentativeDiagnosis !== null
          ? `Tentative diagnosis: ${person.tentativeDiagnosis}.`
          : "Tentative diagnosis: none recorded."}
      </p>
      {person.blockReason !== null && <p className={styles.sheetRowLine}>Held up by: {person.blockReason}.</p>}
      {person.pastDate && person.expectedDays !== null && (
        <p className={styles.sheetRowLine}>
          {-person.expectedDays} day{person.expectedDays === -1 ? "" : "s"} past the ward&apos;s expected date.
        </p>
      )}
    </li>
  );
}

/** A group with nothing in it says so in words. An empty list under a heading reads as a panel that
 *  failed to load rather than as a ward with nobody in that state — and on a sheet somebody is
 *  reading aloud, "nothing failed to print" is exactly the assurance that has to be explicit. */
function SheetGroup({
  heading,
  headingId,
  testId,
  emptyText,
  people,
  note,
}: {
  heading: string;
  headingId: string;
  testId: string;
  emptyText: string;
  people: readonly DailySheetPerson[];
  note?: string;
}) {
  return (
    <section className={styles.sheetGroup} aria-labelledby={headingId} data-testid={testId}>
      <h3 id={headingId} className={styles.sheetGroupHeading}>
        {heading}
      </h3>
      <p className={styles.sheetGroupCount} data-testid={`${testId}-count`}>
        {people.length === 0 ? emptyText : `${people.length} on this ward.`}
      </p>
      {people.length > 0 && (
        <ol className={styles.sheetList}>
          {people.map((person) => (
            <SheetPerson key={person.key} person={person} testId={`${testId}-${person.key}`} />
          ))}
        </ol>
      )}
      {note !== undefined && <p className={styles.sheetNote}>{note}</p>}
    </section>
  );
}

export type WardDailySheetProps = {
  /** `sinceYesterday`, already scoped to this ward by the board. */
  movement: { discharged: number; pulled: number; datesMoved: number };
  /** How many people are recorded as coming in — the board's own `buildIncoming` length, split by
   *  whether the bed has already gone. */
  incomingPulled: number;
  incomingWaitlisted: number;
  /** How many beds the ward expects to free today, and on which of the two bases — the board's own
   *  `outgoingToday` result and the label it renders for that basis. */
  outgoingCount: number;
  outgoingBasisLabel: string;
  /** `arrowTargets` for this unit: where the people in these beds are expected to head, nearest
   *  first, already limited to the board's display horizon. */
  destinations: readonly { region: string; count: number; nearestDays: number }[];
  /** The board's occupants, in the board's order. */
  people: readonly DailySheetPerson[];
};

/**
 * The sheet itself.
 *
 * Reading order is D19's, verbatim: **who came in · who is going · who is stuck · who is overdue**.
 *
 * The headline number, the sentence that qualifies it (D11) and the "as at" stamp (DB-10) are NOT
 * repeated here: they are in the page heading directly above, which is the top of the same printed
 * page, and a second copy of a figure on one sheet is a figure that can disagree with itself.
 *
 * Nothing here is a control: a sheet is read, not operated, and the board is where anything is
 * done — so there is no button on this component at all, which is also why the global print reset
 * (`header, nav, button { display: none !important }`) can take nothing away from it. That reset is
 * why the sheet is a `<section>` and its title an `<h2>`, never a `<header>`.
 */
export function WardDailySheet({
  movement,
  incomingPulled,
  incomingWaitlisted,
  outgoingCount,
  outgoingBasisLabel,
  destinations,
  people,
}: WardDailySheetProps) {
  const groups = dailySheetGroups(people);
  const incomingTotal = incomingPulled + incomingWaitlisted;

  return (
    <section className={styles.sheet} aria-labelledby="ward-daily-sheet-heading" data-testid="ward-daily-sheet">
      <h2 id="ward-daily-sheet-heading" className={styles.sheetHeading}>
        The ward&apos;s daily sheet
      </h2>
      {/* DB-11: there is no frozen view anywhere — on screen or on paper. The stamp in the heading
        above is what makes that safe (DB-10), so the sheet says out loud which picture it is. */}
      <p className={styles.sheetIntro}>
        Live at the moment stamped above — on screen and on paper, nothing here is held from an earlier hour.
      </p>
      <p className={styles.sheetSince} data-testid="ward-daily-sheet-since">
        Since yesterday: {movement.discharged} left this ward, {movement.pulled} bed
        {movement.pulled === 1 ? "" : "s"} given away, {movement.datesMoved} expected date
        {movement.datesMoved === 1 ? "" : "s"} moved.
      </p>

      <div className={styles.sheetGroups}>
        {/* WHO CAME IN. The two states are kept apart on the sheet exactly as they are on the board:
          a pulled bed is already gone from this ward's count while a waitlisted person holds
          nothing, and one undifferentiated "incoming" number would let a meeting plan against a bed
          that is already spoken for. */}
        <section
          className={styles.sheetGroup}
          aria-labelledby="ward-daily-sheet-in-heading"
          data-testid="ward-daily-sheet-in"
        >
          <h3 id="ward-daily-sheet-in-heading" className={styles.sheetGroupHeading}>
            Who came in
          </h3>
          <p className={styles.sheetGroupCount} data-testid="ward-daily-sheet-in-count">
            {incomingTotal === 0
              ? "Nobody is recorded as coming in to this ward."
              : `${incomingTotal} coming in: ${incomingPulled} with the bed already given away, ${incomingWaitlisted} waiting with no bed given.`}
          </p>
          <p className={styles.sheetNote}>
            No arrival time is shown: the record holds when a bed was given away, and nothing about when anybody will
            get here.
          </p>
        </section>

        {/* WHO IS GOING. Beds first — the figure the ward is judged on — then where the people in
          these beds are expected to head, which is the part a community team is waiting for. */}
        <section
          className={styles.sheetGroup}
          aria-labelledby="ward-daily-sheet-out-heading"
          data-testid="ward-daily-sheet-out"
        >
          <h3 id="ward-daily-sheet-out-heading" className={styles.sheetGroupHeading}>
            Who is going
          </h3>
          {/* The basis is named in WORDS, from the same label the board's toggle prints, because a
            sheet has no toggle on it and "4 beds" without "confirmed" or "expected" is two
            different claims sharing a number. */}
          <p className={styles.sheetGroupCount} data-testid="ward-daily-sheet-out-count">
            {outgoingBasisLabel}: {outgoingCount} bed{outgoingCount === 1 ? "" : "s"} expected to free today.
          </p>
          {destinations.length === 0 ? (
            <p className={styles.sheetRowLine}>
              Nobody in these beds has an expected date inside the board&apos;s window.
            </p>
          ) : (
            <ul className={styles.sheetDestinations} data-testid="ward-daily-sheet-destinations">
              {destinations.map((target) => (
                <li
                  key={target.region}
                  className={styles.sheetRowLine}
                  data-testid={`ward-daily-sheet-destination-${target.region}`}
                >
                  {target.region}: {target.count} {target.count === 1 ? "person" : "people"}, soonest{" "}
                  {target.nearestDays === 0
                    ? "due now or overdue"
                    : `in ${target.nearestDays} day${target.nearestDays === 1 ? "" : "s"}`}
                </li>
              ))}
            </ul>
          )}
          <p className={styles.sheetNote}>
            Beds are not people: a bed release records nothing about who is leaving. The destinations above are where
            the people currently in these beds are expected to head.
          </p>
        </section>

        <SheetGroup
          heading="Who is stuck"
          headingId="ward-daily-sheet-stuck-heading"
          testId="ward-daily-sheet-stuck"
          emptyText="Nobody on this ward is recorded as held up."
          people={groups.heldUp}
          note="Held-up reasons are about the BED, from a fixed list. An absent reason is silence, never a finding that nothing is outstanding."
        />

        <SheetGroup
          heading="Who is overdue"
          headingId="ward-daily-sheet-overdue-heading"
          testId="ward-daily-sheet-overdue"
          emptyText="Nobody on this ward is past the ward's own expected date."
          people={groups.overdue}
          note="The expected date is the ward's own revisable plan. It carries no legal or contractual weight, and being past it is not a breach of anything."
        />

        <SheetGroup
          heading="Nobody has said when they are going"
          headingId="ward-daily-sheet-no-date-heading"
          testId="ward-daily-sheet-no-date"
          emptyText="Everybody in a bed on this ward has an expected date."
          people={groups.noDate}
          note="An absent date means nobody has set one. It never reads as a plan to stay, and the system never guesses one."
        />
      </div>

      {/*
       * OFF THE WARD — A LINE, NOT A COLUMN. Owner, 2026-08-30: "Remove the away column."
       *
       * **The column goes and the FACT stays, and that is not over-caution.** Measured before
       * changing it: of the two people seeded away, one has an ordinary discharge date and no
       * blocker, so they appear in NONE of the four groups above. Deleting the group outright
       * removes them from the printed sheet entirely — and a patient silently absent from the
       * sheet that is read aloud at handover is the one failure nobody in the room can see. An
       * unwanted line, by contrast, costs a line and is deleted in seconds.
       *
       * So it stops being a sixth grid cell and becomes one sentence under the grid. The reading
       * order the owner approved is untouched, the page cost drops from a column to a line, and
       * the handover can still answer "and where is she?".
       *
       * Says the bed is still theirs, as every other rendering of this fact does: "off the ward"
       * on a bed sheet otherwise reads as "so the bed is free", and it is not.
       */}
      <p className={styles.sheetAwayLine} data-testid="ward-daily-sheet-away">
        <strong>Off the ward:</strong>{" "}
        {groups.awayFromWard.length === 0
          ? "none."
          : `${groups.awayFromWard
              .map((person) => `${person.sex}, from ${person.homeRegion}`)
              .join("; ")} — at an emergency department. The bed stays theirs.`}
      </p>

      {/* The honest limit of the sheet, on the sheet. D10's editable half — the ward's one-minute
        update — is not here, and its absence must not read as "there is nothing to update". */}
      <p className={styles.sheetNote} data-testid="ward-daily-sheet-limits">
        This sheet is read-only. Updating a discharge date, or confirming that nothing has changed, is not done from
        here.
      </p>
    </section>
  );
}
