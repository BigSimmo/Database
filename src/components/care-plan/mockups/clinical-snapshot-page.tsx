"use client";

import { useEffect, useMemo, useRef } from "react";

import { EmptyState } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import { buildPatientSnapshot, getCurrentManagementPlanVersion } from "./domain";
import { PROTOTYPE_NOW } from "./fixtures";
import { PatientDirectory } from "./patient-directory";
import { PatientWorkspace } from "./patient-workspace";
import { useCarePlanPrototype } from "./prototype-provider";
import { CARE_PLAN_ROUTES } from "./routes";
import type { CmhtContact, Patient, PatientSnapshot, PrototypeScenario, SyntheticId } from "./types";

export type ClinicalSnapshotVariant = "home" | "patients" | "patient";

/**
 * The Clinical Snapshot surface behind Home, Patients, and a patient's Overview.
 *
 * Home and Patients own their own in-flow directory search — the shell composer
 * stands down on those two routes, so there is never a second search field on
 * one page. A patient route derives its patient from the address rather than
 * from the selection, so a deep link always opens the record it names.
 */
export function ClinicalSnapshotSurface({
  variant,
  patientId,
  scenario,
}: {
  variant: ClinicalSnapshotVariant;
  patientId?: string;
  scenario: PrototypeScenario;
}) {
  const { state, dispatch } = useCarePlanPrototype();

  const resolvedPatientId: SyntheticId | null =
    variant === "patient" ? ((patientId as SyntheticId | undefined) ?? null) : state.selectedPatientId;

  const snapshot: PatientSnapshot | null = useMemo(
    () => (resolvedPatientId === null ? null : buildPatientSnapshot(state, resolvedPatientId, PROTOTYPE_NOW)),
    [state, resolvedPatientId],
  );

  function planStatusFor(patient: Patient): { label: string; tone: "success" | "warning" | "neutral" } {
    const current = getCurrentManagementPlanVersion(state.managementPlanVersions, patient.managementPlanId);
    if (current !== null) return { label: `Current version ${current.version}`, tone: "success" };
    const withdrawn = state.managementPlanVersions.some(
      (version) => version.planId === patient.managementPlanId && version.state === "withdrawn",
    );
    return withdrawn ? { label: "Withdrawn", tone: "warning" } : { label: "No plan in use", tone: "neutral" };
  }

  function recordContactIntent(contact: CmhtContact, channel: "email" | "call") {
    if (snapshot === null) return;
    dispatch({ type: "record-contact-intent", patientId: snapshot.patient.id, cmhtId: contact.id, channel });
  }

  const workspaceRef = useRef<HTMLElement>(null);
  const hasSettled = useRef(false);
  const directorySurface = variant !== "patient";

  // Choosing a patient from the directory changes no address, so the shell's
  // route-heading focus never fires. Without this the workspace appears in the
  // next column on a desktop, and below the whole directory list on a phone,
  // with no focus move and nothing announced. Focusing the region announces its
  // accessible name — the same mechanism the shell uses for the route heading,
  // rather than a second live region that would double-announce.
  //
  // The first pass moves nothing: on mount the shell owns focus, and stealing it
  // would make every page load jump past the heading that says where you are.
  //
  // The effect's dependency on `resolvedPatientId` is what makes it a
  // selection-change effect rather than a render effect — an extra
  // "did the id change" guard inside the body would be unreachable, and a
  // positive control confirmed removing one changed no behaviour at all.
  useEffect(() => {
    if (!directorySurface) return;
    if (!hasSettled.current) {
      hasSettled.current = true;
      return;
    }
    if (resolvedPatientId === null) return;
    workspaceRef.current?.focus();
  }, [directorySurface, resolvedPatientId]);

  const workspace =
    snapshot === null ? (
      <EmptyState
        testId="care-plan-no-selection"
        title="No patient is open."
        body="Search by synthetic name, MRN, or date of birth, then choose a record to read its Clinical Snapshot."
      />
    ) : (
      <PatientWorkspace
        ref={workspaceRef}
        snapshot={snapshot}
        users={state.users}
        scenario={scenario}
        outcome={state.lastOutcome}
        // Only a patient address is itself the Overview section. Home and
        // Patients embed the workspace, so no patient link is the current page.
        activeSection={variant === "patient" ? "overview" : null}
        reviewsHref={CARE_PLAN_ROUTES.reviews}
        onRecordContactIntent={recordContactIntent}
        showFullRecordLink={variant !== "patient"}
      />
    );

  if (variant === "patient") return workspace;

  return (
    <div className={styles.snapshotSplit}>
      <PatientDirectory
        patients={state.patients}
        presentations={state.edPresentations}
        now={PROTOTYPE_NOW}
        selectedPatientId={state.selectedPatientId}
        onSelectPatient={(id) => dispatch({ type: "select-patient", patientId: id })}
        reviewsHref={CARE_PLAN_ROUTES.reviews}
        listAllWhenEmpty={variant === "patients"}
        planStatusFor={planStatusFor}
      />
      <div className={styles.snapshotWorkspaceColumn}>{workspace}</div>
    </div>
  );
}
