import { loadMedicationSnapshot } from "@/lib/medication-snapshot";
<<<<<<< HEAD
=======
import { recordToRow } from "@/lib/medication-records";
>>>>>>> origin/main

export function defaultMedicationRecords() {
  return loadMedicationSnapshot();
}
<<<<<<< HEAD
=======

export function buildDefaultMedicationRows(ownerId: string) {
  return defaultMedicationRecords().map((record) => recordToRow(record, ownerId));
}
>>>>>>> origin/main
