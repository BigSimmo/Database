import differentialSnapshot from "../../data/differentials-snapshot.json";

import { curatedEntryFor } from "@/lib/differential-curated";
import { withholdGeneratedBody } from "@/lib/differential-detail";
import { normalizePresentationWorkflow } from "@/lib/differential-presentation-display";
import { diagnosisToRow, presentationToRow, type DifferentialRecordInsert } from "@/lib/differential-records";
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
    const snapshot = differentialSnapshot as DifferentialSnapshot;
    cachedSnapshot = {
      ...snapshot,
      presentations: snapshot.presentations.map(normalizePresentationWorkflow),
      // The withhold happens here, once, because this is the only door the
      // catalogue comes through. Doing it in the detail page left the same
      // wrong sentence as the record's one-line summary under a search result,
      // as a cross-mode link subtitle, and inside the database row that feeds
      // retrieval. A record whose generated export describes a different
      // diagnosis now loses that body before anything can read it, and records
      // without a withhold are returned by identity.
      diagnoses: snapshot.diagnoses.map((record) => withholdGeneratedBody(record, curatedEntryFor(record.slug))),
    };
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
