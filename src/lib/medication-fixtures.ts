import { loadMedicationSnapshot } from "@/lib/medication-snapshot";
import { recordToRow } from "@/lib/medication-records";

export function defaultMedicationRecords() {
  return loadMedicationSnapshot();
}

export function buildDefaultMedicationRows(ownerId: string) {
  return defaultMedicationRecords().map((record) => recordToRow(record, ownerId));
}
