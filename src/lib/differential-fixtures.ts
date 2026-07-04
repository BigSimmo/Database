import { readFileSync } from "node:fs";
import path from "node:path";

import {
  diagnosisToRow,
  presentationToRow,
  type DifferentialRecordInsert,
} from "@/lib/differential-records";
import type { DifferentialSnapshot } from "@/lib/differential-snapshot";

let cachedSnapshot: DifferentialSnapshot | null = null;

function snapshotPath() {
  return path.join(process.cwd(), "data", "differentials-snapshot.json");
}

export function loadDifferentialSnapshot(): DifferentialSnapshot {
  if (cachedSnapshot) return cachedSnapshot;
  const raw = readFileSync(snapshotPath(), "utf8");
  cachedSnapshot = JSON.parse(raw) as DifferentialSnapshot;
  return cachedSnapshot;
}

export function defaultDifferentialCatalog() {
  return loadDifferentialSnapshot();
}

export function buildDefaultDifferentialRows(ownerId: string): DifferentialRecordInsert[] {
  const snapshot = loadDifferentialSnapshot();
  return [
    ...snapshot.presentations.map((presentation) => presentationToRow(presentation, ownerId, snapshot)),
    ...snapshot.diagnoses.map((diagnosis) => diagnosisToRow(diagnosis, ownerId, snapshot)),
  ];
}
