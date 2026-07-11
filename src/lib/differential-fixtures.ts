import differentialSnapshot from "../../data/differentials-snapshot.json";

import { diagnosisToRow, presentationToRow, type DifferentialRecordInsert } from "@/lib/differential-records";
import {
  isDifferentialMetadataArtifactTitle,
  type DifferentialPresentationWorkflow,
  type DifferentialSnapshot,
} from "@/lib/differential-snapshot";

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

/** The presentations that ship to the app and the seed: excludes export
 *  artifacts where a titleless entry file surfaced a metadata row (e.g.
 *  "Urgency: urgent") as its title. Single source of truth for the runtime
 *  catalogue, the seed rows, and stale-row pruning. */
export function usableDifferentialPresentations(snapshot: DifferentialSnapshot): DifferentialPresentationWorkflow[] {
  return snapshot.presentations.filter((presentation) => !isDifferentialMetadataArtifactTitle(presentation.title));
}

export function buildDefaultDifferentialRows(ownerId: string): DifferentialRecordInsert[] {
  const snapshot = loadDifferentialSnapshot();
  const presentationRows = usableDifferentialPresentations(snapshot).map((presentation) =>
    presentationToRow(presentation, ownerId, snapshot),
  );
  const diagnosisRows = snapshot.diagnoses.map((diagnosis) => diagnosisToRow(diagnosis, ownerId, snapshot));
  return [...presentationRows, ...diagnosisRows];
}
