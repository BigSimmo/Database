import { awstCalendarDay } from "@/lib/caring-contacts/clock";
import type { PatientsDirectoryFilter } from "@/lib/caring-contacts/patients-directory-filter";
import type { PatientNameProjection, PlanRecord } from "@/lib/caring-contacts/repository";

import { PatientsDirectoryClient } from "./patients-directory-client";
import type { PatientsDirectoryRow } from "./patients-directory-row";

export type PatientsDirectoryProps = {
  /** Every plan the server-side read released, before the non-identifying state filter is applied. */
  records: readonly PlanRecord[];
  /** The separate, names-only projection released by its own permission-checked read. */
  patientNames: readonly PatientNameProjection[];
  filter: PatientsDirectoryFilter;
  /** False when the acting role does not include viewing plans. */
  mayViewPlans: boolean;
};

/**
 * Server-owned data-minimisation boundary for the Patients directory.
 *
 * The interactive search needs a small client island so patient names never enter a GET URL. Raw
 * `PlanRecord` objects must not cross with it: they also hold team, pathway, outcome, version and
 * every planned contact. This wrapper derives only the values the directory renders or searches and
 * passes that explicit DTO to the client component.
 */
export function PatientsDirectory({ records, patientNames, filter, mayViewPlans }: PatientsDirectoryProps) {
  const nameByPlan = new Map(
    patientNames.filter((entry) => entry.patientName !== "").map((entry) => [entry.planId, entry.patientName]),
  );
  const rows: PatientsDirectoryRow[] = records.map((record) => {
    const suppressedContactCount = record.contacts.filter((stored) => stored.contact.state === "suppressed").length;
    const absorbedContactCount = record.contacts.filter(
      (stored) => stored.planned.suppressed?.reason === "absorbedByFirstContact",
    ).length;

    return {
      planId: record.plan.id,
      patientId: record.patientId,
      referralId: record.referralId,
      state: record.plan.state,
      patientName: nameByPlan.get(record.plan.id) ?? null,
      dischargeDay: awstCalendarDay(record.dischargeAt),
      scheduledContactCount: record.contacts.length - suppressedContactCount,
      absorbedContactCount,
      otherSuppressedContactCount: suppressedContactCount - absorbedContactCount,
    };
  });

  return <PatientsDirectoryClient rows={rows} filter={filter} mayViewPlans={mayViewPlans} />;
}
