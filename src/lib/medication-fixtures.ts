import { loadMedicationSnapshot } from "@/lib/medication-snapshot";

export function defaultMedicationRecords() {
  return loadMedicationSnapshot();
}
