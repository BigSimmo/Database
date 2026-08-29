/**
 * A person, as distinct from a request for a bed or a stay in one.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT AN ADMISSION. The owner's flow is: search for a patient, and
 * if nobody comes up, ADD them, then refer from their own screen. The person being added has never
 * been referred, never moved and never arrived — so a record created by any of those events is too
 * late for the one moment the flow describes.
 *
 * That distinction is easy to lose because the wrong version looks right everywhere it is visible.
 * A patient record created at arrival renders correctly on every screen that shows admitted people,
 * which is every screen anybody would think to check. It fails only at "if nobody comes up, add
 * them", and no test written for the admission path goes near that. So the deciding test for this
 * type is a lifecycle one — a patient with no movement, no referral and no admission, created,
 * searched for and found — and it is in `tests/ward-patient-model.test.ts`.
 *
 * `Admission` is not being replaced. An admission IS the arrival: it is a stay in a particular bed,
 * correctly born when somebody reaches a ward, and it ends when they leave. A patient outlives every
 * one of them. Two records, two lifecycles, and a LINK between them rather than a copy.
 *
 * IDENTITY LIVES HERE AND NOWHERE ELSE. Owner ruling PD-1, 2026-08-30, in his words: "I give
 * explicit permission to update this guard and enable holding a name or record number for patients",
 * "Allow names", and "Either the patient UMRN or the patient Name, Age and DOB. Note to search
 * patients with related name from this."
 *
 * That ruling authorises identity on THIS record. It does not authorise it on `Admission` or on
 * `Referral`, whose own guards stay exactly as they are — an admission links to a patient, and a
 * referral references one. A link is not a copy, and it is what stops one permission becoming three.
 *
 * WHAT IS NOT PERMITTED, and stays denied. `address` and narrative history were not ruled on, so the
 * guard keeps them closed OVER the allowlist: a field called `homeAddress` fails even with a
 * plausible decision id beside it. Silence is not permission, and the one thing a widening must not
 * do is widen by implication.
 */

/** Synthetic and clearly fictional. See `ward-patients-seed.ts` for why the names are shaped the way
 *  they are — name-like enough that related-name search can be demonstrated, implausible enough as a
 *  Perth patient list that nobody in a room can mistake one for a real person or find their own. */
export type Patient = {
  id: string;
  /**
   * The record number a clinician would search by. Synthetic, and one of the two search keys the
   * owner named — the other being name plus date of birth.
   */
  umrn: string;
  givenName: string;
  familyName: string;
  /**
   * ISO `YYYY-MM-DD`. **Age is derived from this and never stored**, which is the one-place-per-fact
   * rule arriving where it is most tempting to break: the owner said "Name, Age and DOB", and
   * holding both would let a record state an age that disagrees with its own date of birth. There is
   * one fact here and `patientAgeYears` reads it.
   */
  dateOfBirth: string;
};

/**
 * The field names, at runtime, so the guard can check the SHAPE rather than the type — a type-only
 * check passes `vitest run` with no `tsc` involved and would let a field through on any run that
 * skipped typecheck.
 */
export const PATIENT_FIELDS = ["id", "umrn", "givenName", "familyName", "dateOfBirth"] as const;

/** Whole years, from the stored date of birth and a supplied "today". Never stored: see the field's
 *  own comment. `today` is passed rather than read so this stays deterministic. */
export function patientAgeYears(patient: Patient, today: Date): number {
  const born = new Date(patient.dateOfBirth);
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) age -= 1;
  return age;
}

/** `Given Family`, the order a name is spoken and written on a board. */
export function patientDisplayName(patient: Patient): string {
  return `${patient.givenName} ${patient.familyName}`;
}

/**
 * Search by record number or by RELATED name — the owner asked for related-name matching
 * specifically, so this is deliberately not exact-match.
 *
 * "Related" is kept to two rules a person can read and check, rather than a similarity score:
 * a fold that removes case, accents, apostrophes and hyphens; and a prefix match on either name
 * part. So "oconnor" finds "O'Connor", "MARIE-CLAIRE" finds "Marie-Claire", and "hal" finds
 * "Halloway".
 *
 * NOT a fuzzy distance metric, and that is a decision rather than a shortcut. A score threshold
 * cannot be reviewed by anybody: it produces a near-miss nobody can explain and hides a miss nobody
 * can find. Two stated rules can be argued with, which is what a clinician needs from a patient
 * search more than they need cleverness.
 */
export function findPatients(patients: readonly Patient[], query: string): Patient[] {
  const needle = fold(query);
  if (needle.length === 0) return [];
  return patients.filter(
    (patient) =>
      fold(patient.umrn) === needle ||
      fold(patient.givenName).startsWith(needle) ||
      fold(patient.familyName).startsWith(needle) ||
      fold(patientDisplayName(patient)).includes(needle),
  );
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’-]/g, "").trim();
}
