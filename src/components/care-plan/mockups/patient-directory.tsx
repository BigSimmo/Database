"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { SearchField } from "@/components/ui/text-field";
import { EmptyState, cn } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import { PRESENTATION_ACTIVITY_WINDOW_MONTHS, countPresentationActivity, searchPatients } from "./domain";
import { StatusMark, formatPerthDate } from "./prototype-ui";
import type { EdPresentation, Patient, SyntheticId } from "./types";

/** How many recent patients the resting state offers before anything is typed. */
const RECENT_PATIENT_LIMIT = 3;

export type PatientDirectoryProps = {
  patients: readonly Patient[];
  presentations: readonly EdPresentation[];
  /** The prototype's single fixed clock, passed in. Nothing here reads a clock. */
  now: string;
  selectedPatientId: SyntheticId | null;
  onSelectPatient: (patientId: SyntheticId) => void;
  reviewsHref: string;
  /** A shell search handed to the directory without putting record data in the URL. */
  initialQuery?: string;
  /**
   * The Patients route lists the whole synthetic directory at rest; Home offers
   * a short recent list instead, so the first screen is search rather than a
   * roll of everybody who has a record.
   */
  listAllWhenEmpty?: boolean;
  /** Rendered per row so a reader can see which plan state they are opening. */
  planStatusFor: (patient: Patient) => { label: string; tone: "success" | "warning" | "neutral" };
};

/**
 * Search-first patient directory.
 *
 * Search state is local to this component; the selected patient lives in the
 * prototype provider, so every route reads one selection rather than keeping a
 * copy of its own.
 *
 * There is deliberately no control that sorts or ranks this list by presentation
 * count. Ranking everyone by how often they attend is the banned label without
 * the word for it; that ordering exists only inside the Identification Review
 * workflow, where finding people who attend often is the stated, governed
 * purpose of the screen.
 */
export function PatientDirectory({
  patients,
  presentations,
  now,
  selectedPatientId,
  onSelectPatient,
  reviewsHref,
  initialQuery = "",
  listAllWhenEmpty = false,
  planStatusFor,
}: PatientDirectoryProps) {
  const [query, setQuery] = useState(initialQuery);
  const trimmed = query.trim();

  /** Most recently seen first. Recency is not a ranking by how often someone
   *  attends: it puts the record you are most likely to want within one tap. */
  const recentPatients = useMemo(() => {
    const lastSeen = new Map<SyntheticId, number>();
    for (const presentation of presentations) {
      const arrived = Date.parse(presentation.arrivedAt);
      const known = lastSeen.get(presentation.patientId);
      if (known === undefined || arrived > known) lastSeen.set(presentation.patientId, arrived);
    }
    return [...patients]
      .filter((patient) => lastSeen.has(patient.id))
      .sort((left, right) => (lastSeen.get(right.id) ?? 0) - (lastSeen.get(left.id) ?? 0))
      .slice(0, RECENT_PATIENT_LIMIT);
  }, [patients, presentations]);

  const results = useMemo(() => (trimmed === "" ? [] : searchPatients(patients, trimmed)), [patients, trimmed]);

  const restingList = listAllWhenEmpty ? patients : recentPatients;
  const restingHeading = listAllWhenEmpty ? "All synthetic patients" : "Recent patients";
  const showingResults = trimmed !== "";
  const listed = showingResults ? results : restingList;

  return (
    <section aria-label="Synthetic patient directory" className={styles.directory}>
      <form role="search" data-print-hide="true" onSubmit={(event: FormEvent) => event.preventDefault()}>
        <SearchField
          label="Search synthetic patients"
          hideLabel={false}
          hint="Search by synthetic name, preferred name, alias, MRN, or date of birth. Plan and presentation content is never searched."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder="Name, MRN, or date of birth"
        />
      </form>

      <div data-testid="care-plan-directory-results" className={styles.directoryResults}>
        <h2 className={styles.directoryHeading}>{showingResults ? "Search results" : restingHeading}</h2>
        {showingResults && results.length === 0 ? (
          <EmptyState
            testId="care-plan-directory-no-results"
            title={`No synthetic patient matches ${trimmed}.`}
            body="Check the MRN, or try a different spelling. Only synthetic records exist in this prototype, and search reaches synthetic name, preferred name, alias, MRN, and date of birth only."
          />
        ) : (
          <ul className={styles.directoryList}>
            {listed.map((patient) => {
              const activity = countPresentationActivity(presentations, patient.id, now);
              const planStatus = planStatusFor(patient);
              return (
                <li key={patient.id}>
                  <button
                    type="button"
                    aria-label={`Open ${patient.fullName}`}
                    aria-current={selectedPatientId === patient.id ? "true" : undefined}
                    onClick={() => onSelectPatient(patient.id)}
                    className={cn(styles.directoryRow, selectedPatientId === patient.id && styles.directoryRowSelected)}
                  >
                    <span className={styles.directoryRowName}>{patient.fullName}</span>
                    <span className={styles.directoryRowDetail}>
                      {`${patient.mrn} · ${formatPerthDate(patient.dateOfBirth)} · ${patient.homeHealthService}`}
                    </span>
                    <span className={styles.directoryRowMarks}>
                      <StatusMark tone={planStatus.tone} label={planStatus.label} />
                      <span className={styles.directoryRowCount}>
                        {`${activity.total} recorded ${activity.total === 1 ? "presentation" : "presentations"}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={styles.directoryFooter}>
        <p className={styles.directoryNote}>
          {`Presentation counts are an objective observation in the ${PRESENTATION_ACTIVITY_WINDOW_MONTHS} months to ${formatPerthDate(now)}. Counts describe what happened. They do not determine eligibility for a Management Plan.`}
        </p>
        <p className={styles.directoryNote}>
          No eligibility rule exists in this prototype. An authorised clinician refers a person with a stated reason.{" "}
          <Link href={reviewsHref} className={styles.inlineLink}>
            Refer someone for Identification Review
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
