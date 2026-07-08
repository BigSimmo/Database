import medicationsSnapshot from "../../data/medications-snapshot.json";

import { normalizeMedicationSlug, normalizeRecord, type MedicationRecord } from "@/lib/medications";

let cachedSnapshot: MedicationRecord[] | null = null;

export function loadMedicationSnapshot(): MedicationRecord[] {
  if (cachedSnapshot) return cachedSnapshot;
  const raw = medicationsSnapshot as MedicationRecord[];
  cachedSnapshot = raw.map(normalizeRecord).sort((left, right) => left.name.localeCompare(right.name));
  return cachedSnapshot;
}

export function getMedicationRecord(slug: string): MedicationRecord | undefined {
  const normalized = normalizeMedicationSlug(slug);
  return loadMedicationSnapshot().find((record) => record.slug === normalized);
}
