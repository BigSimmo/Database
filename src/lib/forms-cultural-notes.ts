/**
 * Interpreter, Aboriginal-liaison and statutory cultural notes for MHA
 * examination forms.
 *
 * Drafted from the Mental Health Act 2014 (WA) and the WA Health Language
 * Services Policy (MP 0051/17) and its Guidelines — see
 * `data/forms-cultural-notes.json` for the notes themselves. `kind` is
 * `"interpreter"` or `"aboriginal-liaison"` for a note whose cited provision
 * is specifically about interpreters or Aboriginal or Torres Strait Islander
 * persons, and `"statutory"` for every other Act-quote note (e.g. s 6(2)'s
 * list of things that do not, by themselves, make a person mentally ill).
 * The captured source records these notes cite are not in this repository
 * yet: they land in `src/data/source-acquisitions.json` only when the
 * integrator appends this task's `sources-t7b.json` fragment. A note is
 * `status: "drafted"` until the clinical owner signs it with
 * `npm run clinical:review -- --kind cultural-note`, which sets `status: "reviewed"`
 * and adds `reviewedBy`, `reviewedAt` and `reviewedContentSha256` to that note alone.
 */
import notesFile from "../../data/forms-cultural-notes.json";

import { signedOffReviewer } from "@/lib/forms-reference-sign-off";

export type FormCulturalNoteKind = "interpreter" | "aboriginal-liaison" | "statutory";

/**
 * The label the form page prints above each note. The sign-off kind in
 * scripts/lib/signoff-kinds/standards-and-cultural-notes.mjs pins the same labels, and
 * tests/signoff-standards-and-cultural-notes.test.ts keeps the two identical.
 */
export const CULTURAL_NOTE_LABELS: Record<FormCulturalNoteKind, string> = {
  interpreter: "Interpreter",
  "aboriginal-liaison": "Aboriginal liaison",
  statutory: "Mental Health Act",
};

export type FormCulturalNote = {
  formCode: string;
  kind: FormCulturalNoteKind;
  text: string;
  sourceId: string;
  status: "drafted" | "reviewed";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewedContentSha256?: string | null;
};

type FormsCulturalNotesFile = { notes: FormCulturalNote[] };

// Defensive against a missing or malformed file: a broken import here must not
// take down every form page, only leave the cultural-notes block empty.
const allNotes: FormCulturalNote[] = Array.isArray((notesFile as Partial<FormsCulturalNotesFile>)?.notes)
  ? (notesFile as FormsCulturalNotesFile).notes
  : [];

/** The interpreter, Aboriginal-liaison and statutory cultural notes drafted for one form code, if any. */
export function culturalNotesForForm(formCode: string | null | undefined): FormCulturalNote[] {
  if (!formCode) return [];
  return allNotes.filter((note) => note.formCode === formCode);
}

/**
 * The reviewer's name when this note carries a complete, well-formed sign-off; otherwise
 * `null`, and the note keeps its "awaiting clinical review" caveat. An Aboriginal-liaison
 * note, or any note naming Aboriginal, Torres Strait Islander or other Indigenous people,
 * never shows as reviewed: it needs Aboriginal governance review instead.
 */
export function culturalNoteReviewer(note: FormCulturalNote): string | null {
  if (note.kind === "aboriginal-liaison") return null;
  return signedOffReviewer(note, [CULTURAL_NOTE_LABELS[note.kind], note.text]);
}
