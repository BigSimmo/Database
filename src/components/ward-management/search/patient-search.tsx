"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type { Movement, MovementStage, Unit } from "@/components/ward-management/ward-model";
import {
  destinationUnit,
  elapsedLabel,
  searchPatients,
  type PatientSearchResult,
  stageCopy,
  type MovementSearchQuery,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { findPatients, patientDisplayName, type Patient } from "@/components/ward-management/ward-patients";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
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
 * immediately, exactly like the escalation board (never frozen, unlike the shift handover).
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
          <p>
            This search is <strong>not a medical device</strong>. It looks up open movements already in this synthetic
            system by id, department, destination, stage and owner — it never assesses a patient&apos;s risk, acuity or
            treatment, and a movement that has already left the system (closed or arrived) never appears here.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Patient search</h1>
          <p className={styles.pageSubtitle}>Find an open movement by id, department, destination, stage or owner.</p>
        </header>

        <form className={styles.filters} onSubmit={(event) => event.preventDefault()}>
          <label className={styles.field} htmlFor="ward-patient-search-text">
            Search
            <input
              id="ward-patient-search-text"
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Movement id, destination, owner…"
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
  return (
    <section className={styles.section} data-testid="ward-patient-search-people">
      <h2 className={styles.resultsHeading}>{people.length === 1 ? "1 person" : `${people.length} people`}</h2>
      {!searched ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-people-idle">
          Search by record number or name to find a person. Related spellings are found too — searching
          &ldquo;hallow&rdquo; finds both Halloway and Hallowin.
        </p>
      ) : people.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-people-empty">
          Nobody of that name or record number is known to this system. If the person in front of you is real, they need
          adding before they can be referred.
        </p>
      ) : (
        <ul className={styles.peopleList} data-testid="ward-patient-search-people-list">
          {people.map((patient) => (
            <li key={patient.id} data-testid={`ward-patient-search-person-${patient.id}`}>
              <strong>{patientDisplayName(patient)}</strong> · {patient.umrn} · born {patient.dateOfBirth}
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <section className={styles.section} data-testid="ward-patient-search-results">
      <h2 className={styles.resultsHeading}>{results.length === 1 ? "1 match" : `${results.length} matches`}</h2>
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
                <th scope="col">Since arrival</th>
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
    </section>
  );
}

function ResultRow({ movement, units, now }: { movement: Movement; units: Unit[]; now: number }) {
  const destination = destinationUnit(movement, units);
  return (
    <tr>
      <td>{movement.id}</td>
      <td>{stageCopy[movement.stage].label}</td>
      <td>{departmentLabel(movement)}</td>
      <td>{destination?.name ?? "No destination chosen"}</td>
      <td>{elapsedLabel(movement, now)}</td>
      <td>
        <Link className={styles.resultLink} href={`/mockups/ward-flow/patients/${movement.id}`}>
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
