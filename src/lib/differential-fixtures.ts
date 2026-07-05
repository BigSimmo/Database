import differentialSnapshot from "../../data/differentials-snapshot.json";

import {
  diagnosisToRow,
  presentationToRow,
  type DifferentialRecordInsert,
} from "@/lib/differential-records";
import type { DifferentialSnapshot } from "@/lib/differential-snapshot";

let cachedSnapshot: DifferentialSnapshot | null = null;

function assertUsableDifferentialSnapshot(snapshot: DifferentialSnapshot) {
  if (!snapshot.presentations.length || !snapshot.diagnoses.length) {
    throw new Error(
      `Differential snapshot is empty or incomplete: ${snapshot.presentations.length} presentations, ${snapshot.diagnoses.length} diagnoses.`,
    );
  }
}

export function loadDifferentialSnapshot(): DifferentialSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = differentialSnapshot as DifferentialSnapshot;
    assertUsableDifferentialSnapshot(cachedSnapshot);
  }
  return cachedSnapshot;
}

export function buildDefaultDifferentialRows(ownerId: string): DifferentialRecordInsert[] {
  const snapshot = loadDifferentialSnapshot();
  const presentationRows = snapshot.presentations.map((presentation) =>
    presentationToRow(presentation, ownerId, snapshot),
  );
  const diagnosisRows = snapshot.diagnoses.map((diagnosis) => diagnosisToRow(diagnosis, ownerId, snapshot));
  return [...presentationRows, ...diagnosisRows];
}
