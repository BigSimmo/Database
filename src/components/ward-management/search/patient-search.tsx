"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type { Movement, MovementStage, Unit } from "@/components/ward-management/ward-model";
import {
  elapsedLabel,
  searchPatients,
  type PatientSearchResult,
  stageCopy,
  type MovementSearchQuery,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { findPatients, patientDisplayName, type Patient } from "@/components/ward-management/ward-patients";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";
import { allEmergencyDepartments, edById } from "@/components/ward-management/ward-sites";

import styles from "./search.module.css";

/**
 * Task 7 (spec item 5): patient search — a live filter over the open caseload, on its own page
 * (product owner's choice: "its own page, reached from the left-hand menu" over a box on the
 * coordinator screen).
 *
 * ONE SEARCH COMPOSER PER PAGE (`docs/search-chrome-behaviour.md`): this page owns its own text
 * field, a stage `<select>` and a department `<select>` as the page's single composer, and it must
 * not also mount the shared global shell composer. It does not need to actively avoid one — every
 * Ward Flow route (see `handover-page.tsx`, `escalation-board.tsx`, `ward-management-console.tsx`)
 * renders only `ClinicalRail` plus its own `<main>`; none of them mount `GlobalSearchShell` /
 * `MasterSearchHeader` at all (`src/app/mockups/ward-flow/layout.tsx` wraps every route in
 * `WardFlowProvider` alone, nothing chrome-related). So this page's own search field is the ONLY
 * composer on the page by construction, the same way it already is on every other Ward Flow route.
 *
 * Query state lives in this component (`useState`), `searchMovements` itself stays a pure
 * derivation with no clock read (see its own doc comment in `ward-derivations.ts`) — this page
 * calls it fresh on every render against the LIVE `movements`/`units` from `useWardFlow()`, so a
 * movement that closes or changes stage while a coordinator is searching drops out or updates
 * immediately, exactly like the escalation board and the shift handover. (The handover froze at
 * mount until owner decision OD-4, 2026-08-30; every board now reads live.)
 *
 * The department select's options are the fixed, synthetic emergency-department reference list
 * (`allEmergencyDepartments()`) — a static catalogue of real departments, not live capacity, so
 * reading it once rather than through the live provider state is correct here (the same choice
 * `ESCALATION_CONTACTS` and every other fixed-list select in this prototype makes).
 *
 * Conservative failure (spec constraint 4): "No matches" renders as its own explicit sentence,
 * never a bare empty table with no explanation.
 */
export function PatientSearchPage() {
  // Both sides of the merge, and neither replaces the other: the board line taught this screen to
  // search REFERRALS as well as movements, and this line taught it to search PEOPLE. A referral is
  // somebody awaiting a decision, a movement is somebody whose decision was made, and a patient is
  // the person all of that happens to.
  const { movements, referrals, units, now, patients } = useWardFlow();
  const [text, setText] = useState("");
  const [stage, setStage] = useState<MovementStage | "">("");
  const [edId, setEdId] = useState("");

  const query: MovementSearchQuery = useMemo(
    () => ({
      text,
      stage: stage === "" ? undefined : stage,
      edId: edId === "" ? undefined : edId,
    }),
    [text, stage, edId],
  );

  const results = useMemo(
    () => searchPatients(movements, referrals, units, query),
    [movements, referrals, units, query],
  );

  /**
   * PEOPLE, not movements — and this is the half the old search structurally could not do.
   *
   * `searchMovements` applies `isOpen` first and unconditionally, so it can only ever find somebody
   * mid-journey. A patient who has been referred but not moved, one who has arrived on a ward, and
   * one who has just been added and has nothing attached at all are all invisible to it — and the
   * last of those is the case the owner's flow turns on: "search a patient, and if nobody comes up,
   * ADD them." You cannot know nobody came up if the search can only see people already in transit.
   */
  const people = useMemo(() => findPatients(patients, text), [patients, text]);

  return (
    <div className={styles.screen} data-testid="ward-patient-search">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-patient-search-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          {/* PLACEHOLDER WORDING — owner has not chosen this. Only the enumeration clause changed
              here (the box now also finds a person by name or record number); the "not a medical
              device" sentence, the "never assesses risk, acuity or treatment" clause and the
              closed/arrived caveat are safety language and are carried over verbatim. */}
          <p>
            This search is <strong>not a medical device</strong>. It looks up people already known to this synthetic
            system by name or record number, and open movements by id, department, destination, stage and owner — it
            never assesses a patient&apos;s risk, acuity or treatment, and a movement that has already left the system
            (closed or arrived) never appears here.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Patient search</h1>
          {/* PLACEHOLDER WORDING — owner has not chosen this. */}
          <p className={styles.pageSubtitle}>
            Find a person by name or record number, or an open movement by id, department, destination, stage or owner.
          </p>
        </header>

        <form className={styles.filters} onSubmit={(event) => event.preventDefault()}>
          <label className={styles.field} htmlFor="ward-patient-search-text">
            Search
            <input
              id="ward-patient-search-text"
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              // PLACEHOLDER WORDING — owner has not chosen this.
              placeholder="Name, record number, or movement id…"
            />
          </label>
          <label className={styles.field} htmlFor="ward-patient-search-stage">
            Stage
            <select
              id="ward-patient-search-stage"
              value={stage}
              onChange={(event) => setStage(event.target.value as MovementStage | "")}
            >
              <option value="">All stages</option>
              {MOVEMENT_STAGES.map((value) => (
                <option key={value} value={value}>
                  {stageCopy[value].label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field} htmlFor="ward-patient-search-department">
            Department
            <select id="ward-patient-search-department" value={edId} onChange={(event) => setEdId(event.target.value)}>
              <option value="">All departments</option>
              {allEmergencyDepartments().map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.name} ({ed.siteCode})
                </option>
              ))}
            </select>
          </label>
        </form>

        <PeopleSection people={people} query={text} />

        <ResultsSection results={results} units={units} now={now} />
      </main>
    </div>
  );
}

/**
 * The people the search found, listed before the movements because a person is the subject and a
 * movement is something that happened to them.
 *
 * Deliberately shows a patient with NOTHING attached. An entry here is not evidence of a referral,
 * a bed or a journey — it says this person is known to the system, which is exactly the question
 * being asked before somebody decides to add them.
 */
export function PeopleSection({ people, query }: { people: Patient[]; query: string }) {
  const searched = query.trim().length > 0;
  /**
   * Carries what the clinician already typed into `AddPatientForm`, so agreeing "add this person"
   * from this empty state does not throw the search away and force a retype.
   *
   * THE JUDGEMENT CALL: this search box holds ONE string, and the add-patient form has TWO name
   * fields (`givenName`, `familyName`). Splitting the string on a space is not safe — "Mary Anne"
   * and "van der Berg" both break a naive split, and a wrong split lands wrong words in a clinical
   * identity record, which is worse than an empty field a clinician notices and fills in
   * themselves. So the whole string lands in `givenName` alone (see `initialDraft` in
   * `add-patient.tsx`) and `familyName` is left blank rather than guessed.
   *
   * This assumes the typed string was a name. `findPatients` also matches on `umrn` (a partial
   * record number can land here too, since 2026-09-02's fix to that function), and a record number
   * prefilled into "Given name" would be wrong in a different way — but distinguishing the two
   * cases would itself be a guess, which is exactly what this decision is trying to avoid making.
   */
  const addPersonHref = `${WARD_ADD_PERSON_HREF}?name=${encodeURIComponent(query.trim())}`;
  return (
    <WardPanel title={people.length === 1 ? "1 person" : `${people.length} people`} testId="ward-patient-search-people">
      {!searched ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-people-idle">
          Search by record number or name to find a person. Related spellings are found too — searching
          &ldquo;hallow&rdquo; finds both Halloway and Hallowin.
        </p>
      ) : people.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-people-empty">
          Nobody of that name or record number is known to this system. If the person in front of you is real, they need
          adding before they can be referred.{" "}
          <Link
            className={styles.emptyNoteLink}
            href={addPersonHref}
            data-testid="ward-patient-search-people-empty-add"
          >
            Add this person
          </Link>
        </p>
      ) : (
        <ul className={styles.peopleList} data-testid="ward-patient-search-people-list">
          {/*
            Each person opens their own screen. Until 2026-08-30 these were bare `<li>`s: a search
            result you could click and nothing happened, silently — the third instance of that shape
            found in this prototype in one day. They had nowhere to point, because a person had no
            screen and `/patients/[patientId]` was a MOVEMENT workspace wearing a patient's name —
            since moved to `/mockups/ward-flow/movements/[movementId]`.
          */}
          {people.map((patient) => (
            <li key={patient.id} data-testid={`ward-patient-search-person-${patient.id}`}>
              <Link className={styles.personLink} href={`/mockups/ward-flow/people/${patient.id}`}>
                <strong>{patientDisplayName(patient)}</strong> · {patient.umrn} · born {patient.dateOfBirth}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WardPanel>
  );
}

export function ResultsSection({
  results,
  units,
  now,
}: {
  results: PatientSearchResult[];
  units: Unit[];
  now: number;
}) {
  /*
   * Split rather than rendered as one list, because the two records genuinely have different
   * columns: a movement has a stage, a department, a destination and a time since arrival; a
   * referral has none of those, because nobody has accepted it — which is the whole reason it is
   * still a referral. Forcing both into the movement table would put four empty cells on every
   * referral row, and an empty cell reads as missing data rather than as inapplicable.
   */
  const referralResults = results.filter((result) => result.kind === "referral");
  const movementResults = results.filter((result) => result.kind === "movement");

  return (
    <WardPanel
      title={results.length === 1 ? "1 match" : `${results.length} matches`}
      testId="ward-patient-search-results"
    >
      {/*
       * REFERRALS FIRST, and it is not cosmetic ordering. A referral is somebody still waiting for
       * a decision; a movement is somebody whose decision has been made. The person an ED
       * psychiatrist can still act on goes at the top.
       *
       * Each row says in words that nobody has accepted them yet, because "referral" alone does not
       * carry that to a reader who has just typed a name into a search box and is scanning for
       * where their patient is.
       */}
      {referralResults.length > 0 && (
        <ul className={styles.referralList} data-testid="ward-patient-search-referrals">
          {referralResults.map(({ referral }) => (
            <li
              key={referral.id}
              className={styles.referralRow}
              data-testid={`ward-patient-search-referral-${referral.id}`}
            >
              <span className={styles.referralId}>{referral.id}</span>
              <span className={styles.referralNote}>
                Referral from {referral.originSiteCode} · {referral.ageBand} · {referral.homeRegion} — waiting for a
                decision, no bed accepted yet.
              </span>
            </li>
          ))}
        </ul>
      )}

      {results.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-empty">
          No matches — no open movement or waiting referral fits the current search.
        </p>
      ) : movementResults.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-no-movements">
          No open movement fits the current search. The waiting referrals above have not been accepted anywhere yet.
        </p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Movement</th>
                <th scope="col">Stage</th>
                <th scope="col">Department</th>
                <th scope="col">Destination</th>
                {/*
                 * 🔴 "Open for", NOT "Since arrival". `elapsedLabel` measures from
                 * `movement.openedAt` (`ward-derivations.ts:195`), and `Movement` holds NO arrival
                 * instant at all — `arrivedAt` was deliberately deleted (`ward-model.ts`, Phase 8
                 * Task 2R). `Referral.triagedAt`'s doc comment states the rule in terms: "TRIAGE IS
                 * NOT ARRIVAL, AND NO SCREEN MAY WORD IT AS ONE." A patient arrives, waits, and is
                 * triaged some time later; on a busy night that gap is not small, so a header
                 * saying "arrival" over an opened-at clock understates every wait on the screen.
                 *
                 * ⚠️ THE SAME TWO WORDS ARE CORRECT ON THE OUT-OF-AREA LEDGER and must stay there.
                 * That column is fed by `sinceArrivalLabel`, which reads a real admission and says
                 * "Arrival not recorded" when it has none. Identical wording, different source,
                 * only one of them a claim the record cannot support — which is why this one
                 * survived review: it reads as house style rather than as an assertion.
                 * `tests/ui-ward-referrals.spec.ts` pins that ledger's four headers; it does not
                 * cover this table, so nothing there needed relaxing to make this change.
                 *
                 * "Open for" is safe across every row because `searchMovements` filters `isOpen`
                 * first and unconditionally, so a closed movement can never reach this column and
                 * be described as still open.
                 */}
                <th scope="col">Open for</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {movementResults.map(({ movement }) => (
                <ResultRow key={movement.id} movement={movement} units={units} now={now} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WardPanel>
  );
}

/*
 * 🔴 THE DESTINATION COLUMN READS `acceptedUnitId` DIRECTLY AND NEVER `destinationUnit`.
 *
 * `destinationUnit` is `movement.acceptedUnitId ?? movement.referredUnitIds[0]`
 * (`ward-derivations.ts:261`) — the fallback lives INSIDE the helper. So a patient with no
 * acceptance and two open referrals had one of them, chosen arbitrarily by array order, printed
 * to a coordinator under a column headed "Destination". Nothing on the row said the ward had not
 * agreed to take them. That is not a display bug: it is the screen asserting a bed exists.
 *
 * ⚠️ THE HELPER KEEPS ITS FALLBACK AND SHOULD. The board and the network want a provisional
 * destination to lay out, and this is not a repair to `destinationUnit`. It is a statement that a
 * SEARCH RESULT is a record, and a record may not round a referral up to a destination.
 *
 * Ward Lead repaired the identical defect on the movement workspace; this is that fix, same shape.
 * `flow-diagram.tsx:491` refused the helper for this reason AND for a second one — it only ever
 * reads `referredUnitIds[0]`, so a second parallel referral is invisible. Reading `acceptedUnitId`
 * closes both here, because an acceptance is singular by construction.
 *
 * ⚠️ KNOWN AND DELIBERATE ASYMMETRY: `searchMovements`' haystack (`ward-derivations.ts:1073`)
 * still matches on `destinationUnit`, so searching a ward's name can return a patient merely
 * REFERRED there, whose Destination cell then reads "No destination chosen". That looks odd and is
 * true. The opposite — matching the search to the column by showing the referred ward — is the
 * false statement this comment exists to prevent. Raised with Ward Lead rather than settled here.
 */
function ResultRow({ movement, units, now }: { movement: Movement; units: Unit[]; now: number }) {
  /*
   * ACCEPTED-ONLY, never `destinationUnit` — see the note on the handover screen's own column.
   * `destinationUnit` is `acceptedUnitId ?? referredUnitIds[0]`, so it presents the first ward
   * ASKED as the destination on a movement nobody has accepted.
   *
   * "No destination chosen" was not a blank cell and was never the defect here; it was TRUE for a
   * movement with nothing recorded and FALSE by omission for one with referrals outstanding,
   * because the fallback could not tell those apart and the helper hid the difference by
   * answering with a candidate.
   */
  const destination = movement.acceptedUnitId
    ? units.find((candidate) => candidate.id === movement.acceptedUnitId)
    : undefined;
  /*
   * THE WARDS ASKED ARE NAMED HERE, AND THAT IS THE "MATCHED ON" FIX — not a new column.
   *
   * ⚠️ **MY OWN REPAIR CREATED THIS.** `searchMovements`' haystack includes the destination's
   * NAME, resolved through `destinationUnit` — which is `acceptedUnitId ?? referredUnitIds[0]`.
   * So typing a ward's name has always matched movements merely REFERRED there. Before my change
   * this cell printed that ward's name, wrongly, as the destination: the row was false but it did
   * at least explain itself. After it, the cell read "1 ward asked, none has accepted" — true, and
   * the ward the coordinator typed had vanished from the row entirely, leaving a result that looked
   * arbitrary. **The row went from wrong-but-legible to right-but-inexplicable, and neither is what
   * a person searching needs.**
   *
   * Naming the wards restores the match's explanation while keeping the status honest: the cell
   * says nobody has accepted AND shows who was asked, so the same string answers both "what is the
   * destination" and "why is this row here".
   *
   * The owner's ruling was to keep the haystack as it is — a coordinator typing a ward name almost
   * certainly does want the movements referred there, and hiding a live referral to the ward they
   * just typed would be the worse defect. The bug was never the match; it was the silence about why.
   */
  const askedNames = movement.referredUnitIds
    .map((id) => units.find((candidate) => candidate.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  const destinationCell = destination
    ? destination.name
    : movement.referredUnitIds.length > 0
      ? `${movement.referredUnitIds.length} ward${movement.referredUnitIds.length === 1 ? "" : "s"} asked, none has accepted${askedNames.length > 0 ? ` — ${askedNames.join(", ")}` : ""}`
      : "No destination chosen";
  return (
    <tr>
      <td>{movement.id}</td>
      <td>{stageCopy[movement.stage].label}</td>
      <td>{departmentLabel(movement)}</td>
      <td>{destinationCell}</td>
      <td>{elapsedLabel(movement, now)}</td>
      <td>
        <Link className={styles.resultLink} href={`/mockups/ward-flow/movements/${movement.id}`}>
          Open
        </Link>
      </td>
    </tr>
  );
}

/** Mirrors `handover-page.tsx`'s and `escalation-board.tsx`'s own origin-department fallback
 * exactly — a raw id is a real fact about the record, never a fabricated substitute for one. */
function departmentLabel(movement: Movement) {
  const originEd = edById(movement.originEdId);
  return originEd
    ? `${originEd.name} (${originEd.siteCode})`
    : `No synthetic department matches "${movement.originEdId}"`;
}
