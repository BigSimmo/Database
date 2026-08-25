"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type { Movement, MovementStage, Unit } from "@/components/ward-management/ward-model";
import {
  destinationUnit,
  elapsedLabel,
  searchMovements,
  stageCopy,
  type MovementSearchQuery,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
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
  const { movements, units, now } = useWardFlow();
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

  const results = useMemo(() => searchMovements(movements, units, query), [movements, units, query]);

  return (
    <div className={styles.screen} data-testid="ward-patient-search">
      <ClinicalRail />
      <main className={styles.main}>
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

        <ResultsSection results={results} units={units} now={now} />
      </main>
    </div>
  );
}

export function ResultsSection({ results, units, now }: { results: Movement[]; units: Unit[]; now: number }) {
  return (
    <section className={styles.section} data-testid="ward-patient-search-results">
      <h2 className={styles.resultsHeading}>{results.length === 1 ? "1 match" : `${results.length} matches`}</h2>
      {results.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-empty">
          No matches — no open movement fits the current search.
        </p>
      ) : (
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
            {results.map((movement) => (
              <ResultRow key={movement.id} movement={movement} units={units} now={now} />
            ))}
          </tbody>
        </table>
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
