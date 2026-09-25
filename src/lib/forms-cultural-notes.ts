/**
 * Interpreter and Aboriginal-liaison cultural notes for MHA examination forms.
 *
 * Drafted from the Mental Health Act 2014 (WA), the WA Health Language Services
 * Policy and Chief Psychiatrist guidance — see `data/forms-cultural-notes.json`
 * and its citing entries in `src/data/source-acquisitions.json`. Every note is
 * `status: "drafted"`; none has been clinically reviewed.
 */
import notesFile from "../../data/forms-cultural-notes.json";

export type FormCulturalNoteKind = "interpreter" | "aboriginal-liaison";

export type FormCulturalNote = {
  formCode: string;
  kind: FormCulturalNoteKind;
  text: string;
  sourceId: string;
  status: "drafted" | "reviewed";
};

type FormsCulturalNotesFile = { notes: FormCulturalNote[] };

// Defensive against a missing or malformed file: a broken import here must not
// take down every form page, only leave the cultural-notes block empty.
const allNotes: FormCulturalNote[] = Array.isArray((notesFile as Partial<FormsCulturalNotesFile>)?.notes)
  ? (notesFile as FormsCulturalNotesFile).notes
  : [];

/** The interpreter and Aboriginal-liaison cultural notes drafted for one form code, if any. */
export function culturalNotesForForm(formCode: string | null | undefined): FormCulturalNote[] {
  if (!formCode) return [];
  return allNotes.filter((note) => note.formCode === formCode);
}
