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
 * WHAT IS NOT PERMITTED, and stays denied. Narrative history stays closed OVER the allowlist: a
 * field called `nextOfKinContact` or `progressNotes` fails even with a plausible decision id beside
 * it. Silence is not permission, and the one thing a widening must not do is widen by implication.
 *
 * OWNER RULING R-2026-09-04-A, 2026-09-04 (`docs/ward-flow/owner-rulings-2026-09-04.md` section A),
 * widened the record beyond PD-1's five fields: address, suburb, GP, catchment community team,
 * legal status, interpreter/preferred language, Aboriginal or Torres Strait Islander status, plus
 * two the owner delegated and were selected narrowly — sex/gender (already carried on the
 * referral's ward arm, so this records something the system holds rather than collecting something
 * new) and preferred name (a dignity fact, no clinical inference attaches). Risk flags, diagnosis,
 * next of kin and medication were explicitly asked about and explicitly refused — each is a larger
 * clinical surface than the nine approved fields, and "any others you think may be clinically
 * relevant" was not read as authorising them. Those nine fields are OPTIONAL: the owner's
 * add-patient flow (`ward-flow-reducer.ts`, `ADD_PATIENT`) still collects only identity, so a
 * freshly added person legitimately has none of them recorded yet.
 *
 * ⚠️ TWO OF THE NINE ARE NOT SETTLED FOR DISPLAY. Whether Aboriginal or Torres Strait Islander
 * status and interpreter/preferred language belong on a screen at all remains open with the
 * Aboriginal health review — the ruling is only that the record may HOLD them. Where a screen does
 * render them, the placement rule from the ruling stands: not adjacent to each other, and neither
 * directly above a past-psychiatric-history panel. See `person-screen.tsx`.
 */

/** Synthetic and clearly fictional. See `ward-patients-seed.ts` for why the names are shaped the way
 *  they are — name-like enough that related-name search can be demonstrated, implausible enough as a
 *  Perth patient list that nobody in a room can mistake one for a real person or find their own. */
/**
 * A PERSON's id, distinct from `MovementId` at the type level so the two cannot be interchanged.
 * See `MovementId` in `ward-model.ts` for why. Every patient id in the fixture is `PT-###`.
 */
export type PatientId = `PT-${string}`;

export type Patient = {
  id: PatientId;
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

  // ── R-2026-09-04-A. All nine OPTIONAL — see the file header for why. ──────────────────────────

  /** A dignity fact, not a clinical one: how this person wants to be addressed. No inference
   *  attaches to it. */
  preferredName?: string;
  /** Free text rather than a fixed enum, deliberately: bed allocation depends on this, and a closed
   *  list picked without clinical input would be a second decision riding on this one's back. */
  sexOrGender?: string;
  /** Street-level only; the record is not a mailing system. */
  address?: string;
  /** The key a catchment lookup would use (see `ward-catchment.ts`) — not wired to one here. */
  suburb?: string;
  /** Name and, where known, clinic — free text, same reasoning as `sexOrGender`. */
  generalPractitioner?: string;
  /** Which community mental health team covers this person, by name. Not derived from `suburb`:
   *  that derivation is a separate decision `ward-catchment.ts` exists to make carefully, and this
   *  field holds whatever a clinician has actually recorded. */
  catchmentCommunityTeam?: string;
  /** Under the Mental Health Act 2014 (WA) or otherwise — free text; no status machine attaches. */
  legalStatus?: string;
  /** ⚠️ NOT SETTLED FOR DISPLAY. The record may hold it; whether a screen may show it is open with
   *  the Aboriginal health review — see `person-screen.tsx`. */
  aboriginalOrTorresStraitIslanderStatus?: string;
  /** ⚠️ NOT SETTLED FOR DISPLAY, same review, same caveat as the field above. */
  interpreterLanguage?: string;
};

/**
 * The field names, at runtime, so the guard can check the SHAPE rather than the type — a type-only
 * check passes `vitest run` with no `tsc` involved and would let a field through on any run that
 * skipped typecheck.
 */
export const PATIENT_FIELDS = [
  "id",
  "umrn",
  "givenName",
  "familyName",
  "dateOfBirth",
  "preferredName",
  "sexOrGender",
  "address",
  "suburb",
  "generalPractitioner",
  "catchmentCommunityTeam",
  "legalStatus",
  "aboriginalOrTorresStraitIslanderStatus",
  "interpreterLanguage",
] as const;

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
 *
 * The record number matches as a SUBSTRING too, the same as the name fields — nothing in this
 * file's own history or the owner's ruling above says the record number must be typed in full.
 * Before this was a substring match, "100001" found nobody while "UM100001" found Talia Halloway,
 * which is backwards from how a clinician actually remembers a record number: the digits are the
 * part they recall, "UM" is the part they don't bother with.
 */
export function findPatients(patients: readonly Patient[], query: string): Patient[] {
  const needle = fold(query);
  if (needle.length === 0) return [];
  return patients.filter(
    (patient) =>
      fold(patient.umrn).includes(needle) ||
      fold(patient.givenName).startsWith(needle) ||
      fold(patient.familyName).startsWith(needle) ||
      fold(patientDisplayName(patient)).includes(needle),
  );
}

/**
 * Names that differ from what was typed by ONE KEYSTROKE — offered only to a clinician the search
 * has already told "nobody is known", and never as a match.
 *
 * ⚠️ THIS FILE ALREADY REFUSED A FUZZY DISTANCE METRIC, AND THAT REFUSAL STANDS. `findPatients`'s
 * own comment says a score threshold "cannot be reviewed by anybody: it produces a near-miss nobody
 * can explain and hides a miss nobody can find". That objection is right about a SEARCH, whose
 * answer is authoritative — "found" and "not found" are conclusions a clinician acts on.
 *
 * This is not a search and it asserts nothing. It offers names for a human to compare, and the
 * human decides. The asymmetry is what makes it safe: a suggestion this MISSES leaves the clinician
 * exactly where they are today, while a suggestion it WRONGLY offers is bounded, because it is
 * never presented as a match and every candidate is shown with the record number and date of birth
 * that distinguish it.
 *
 * ⚠️ AND THE THRESHOLD IS NOT TUNED — IT IS ONE KEYSTROKE, which is a rule a clinician can read and
 * argue with, exactly the standard `findPatients` set. A letter added, a letter removed, a letter
 * changed, or two adjacent letters swapped. "Halowin" reaches "Hallowin"; "Marowby" reaches
 * "Marrowby"; nothing reaches a different person's name, because real names do not sit one
 * keystroke apart by accident.
 *
 * ⚠️ NEVER MATCHES THE RECORD NUMBER, and this is the sharpest rule here. A record number one
 * keystroke away from another IS ANOTHER PATIENT — there is no near-miss to be helpful about, and
 * suggesting one would invite the exact misattribution this whole feature exists to prevent.
 *
 * Returns candidates in the order the patient list holds them. ⚠️ Deliberately UNRANKED: presenting
 * a "best" match is an invitation, and on this screen an invitation is the hazard. If two names are
 * equally near, the clinician compares two records rather than being nudged at one.
 */
export function nearPatients(patients: readonly Patient[], terms: readonly string[]): Patient[] {
  // ⚠️ A LIST OF TERMS, NOT ONE STRING, AND THE REASON IS THE CASE THIS EXISTS FOR. The search
  // screen supplies one term. The add-patient screen supplies two — and on the exact journey that
  // creates a duplicate, the FAMILY NAME BOX IS EMPTY and the surname is sitting in the forename
  // box, because the prefill puts the whole typed string into `givenName`. A matcher that compared
  // a caller's given name against seeded given names would find nothing for "Halowin". So every
  // term is compared against BOTH name fields of every patient, in both directions.
  //
  // The alternative — one string, called twice, merged by the caller — puts dedupe logic outside
  // this function and lets two result sets disagree about who is nearby. One matcher, one call,
  // one answer.
  const needles = terms.map(fold).filter((needle) => needle.length >= 4);
  if (needles.length === 0) return [];
  return patients.filter((patient) => {
    const names = [fold(patient.givenName), fold(patient.familyName)];
    // ⚠️ THERE IS NO "ALREADY FOUND" GUARD HERE, AND ITS REMOVAL IS THE FIX FOR A REAL DEFECT.
    //
    // One stood here: drop a patient when any term exactly matches any of their name fields, on the
    // premise that an exact hit means `findPatients` already showed them. TRUE OF THE SEARCH SCREEN,
    // which passes one term. FALSE OF THE ADD SCREEN, which passes two, because the search that
    // brought the clinician there used only one of them.
    //
    // What it cost: the prefill drops "Halowin" into the given-name box and the warning fires; the
    // clinician does the obvious tidy-up, moving the surname across and typing "Marcus" — and the
    // warning VANISHED, because "marcus" exactly matches a real given name. Right first name,
    // misspelt surname, is the commonest real duplicate there is, and it was the one shape that
    // produced nothing. Found by Ward Builder Two verifying this contract as the caller rather than
    // reading it as a reviewer.
    //
    // Removing it is safe because it was never load-bearing: `withinOneKeystroke` already returns
    // false for identical strings, so a term that exactly matches a name yields no near hit on its
    // own. The guard could only ever subtract, and the only thing it subtracted was this.
    //
    // ⚠️ CONSEQUENCE FOR CALLERS, STATED BECAUSE IT IS A HOLE IF NOBODY OWNS IT: this function
    // cannot report an EXACT duplicate, by construction. `["Marcus", "Hallowin"]` — a clinician
    // re-entering somebody already in the system — returns nothing here and always will. That is
    // correct for a NEAR-spelling matcher, and it means a creation screen needs its own exact-match
    // check beside this one.
    return needles.some((needle) => names.some((name) => name.length >= 4 && withinOneKeystroke(name, needle)));
  });
}

/**
 * True when two strings differ by a single keystroke: one insertion, one deletion, one substitution,
 * or one transposition of adjacent characters (Damerau-Levenshtein distance of exactly 1).
 *
 * Written out rather than imported so the rule the clinician is told about and the rule the code
 * applies are the same thing, readable side by side.
 */
function withinOneKeystroke(a: string, b: string): boolean {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;

  if (a.length === b.length) {
    const differing: number[] = [];
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) differing.push(i);
      if (differing.length > 2) return false;
    }
    if (differing.length === 1) return true; // one letter changed
    if (differing.length === 2) {
      const [x, y] = differing;
      // two adjacent letters swapped
      return y === x + 1 && a[x] === b[y] && a[y] === b[x];
    }
    return false;
  }

  // One is exactly one character longer: it must be the shorter one with a single letter inserted.
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    i += 1;
  }
  return true;
}

/** The identity fields the add-patient form collects, and the only ones a duplicate check reads. */
export type PatientIdentityDraft = {
  umrn: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
};

/**
 * Everything a creation screen needs to know about who this person might already be, in ONE call
 * and ONE answer, with each claim arriving already distinguished.
 *
 * ⚠️ THE TIERS ARE DIFFERENT CLAIMS, NOT DEGREES OF CONFIDENCE, and they are kept apart because a
 * screen must be able to say each one flatly. A caller that had to work out WHY somebody was
 * returned would be re-implementing this matcher in its renderer, and the two would drift.
 *
 * ⚠️ AND `nearSpelling` HERE EXCLUDES ANYONE ALREADY NAMED ABOVE. A person listed twice in one
 * notice — "this may be the same person" under a heading that already said "this IS that record" —
 * teaches a reader to skim both. Done here rather than left to the caller, because a rule that
 * depends on somebody remembering to subtract is a rule that eventually is not applied.
 */
export type DuplicateCandidates = {
  /**
   * ⚠️ NOT A RESEMBLANCE. A record number is unique by definition, so a typed one that already
   * exists is a COLLISION: either it is the same person, or somebody mistyped. There is no third
   * reading in which a new patient legitimately holds that number.
   */
  recordNumberCollision: Patient[];
  /** Given name, family name and date of birth all match. */
  sameNameSameBirthDate: Patient[];
  /**
   * Given and family name match and the date of birth DOES NOT CONFIRM they are the same person.
   * ⚠️ NAMED FOR WHAT IT KNOWS RATHER THAN "different date of birth", because it also covers a
   * draft with NO date of birth typed yet — and "different" would be a false statement about a
   * blank field. The clinician's action is the same either way: open the record and look. The
   * caller's wording has to be true of both, so the tier name is too.
   */
  sameNameBirthDateNotMatched: Patient[];
  /** One keystroke away — see `nearPatients`. Never anyone already named above. */
  nearSpelling: Patient[];
};

/**
 * ⚠️ THIS DOES NOT BLOCK AND MUST NEVER BE BUILT AS A GATE. A clinician who cannot proceed types a
 * DIFFERENT record number, which puts a knowingly wrong identifier into a clinical record — worse
 * than the duplicate this exists to prevent. It reports; the human decides.
 */
export function duplicateCandidates(patients: readonly Patient[], draft: PatientIdentityDraft): DuplicateCandidates {
  const umrn = fold(draft.umrn);
  const given = fold(draft.givenName);
  const family = fold(draft.familyName);
  const born = draft.dateOfBirth.trim();

  const recordNumberCollision = umrn.length === 0 ? [] : patients.filter((patient) => fold(patient.umrn) === umrn);

  const sameName =
    given.length === 0 || family.length === 0
      ? []
      : patients.filter((patient) => fold(patient.givenName) === given && fold(patient.familyName) === family);

  const sameNameSameBirthDate = born.length === 0 ? [] : sameName.filter((patient) => patient.dateOfBirth === born);
  const sameNameBirthDateNotMatched = sameName.filter((patient) => !sameNameSameBirthDate.includes(patient));

  const alreadyNamed = new Set<Patient>([
    ...recordNumberCollision,
    ...sameNameSameBirthDate,
    ...sameNameBirthDateNotMatched,
  ]);

  return {
    recordNumberCollision,
    sameNameSameBirthDate,
    sameNameBirthDateNotMatched,
    // ⚠️ The record number is deliberately NOT a term here. `nearPatients` never near-matches a
    // record number, and passing one in would be asking it to try.
    nearSpelling: nearPatients(patients, [draft.givenName, draft.familyName]).filter(
      (patient) => !alreadyNamed.has(patient),
    ),
  };
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’-]/g, "").trim();
}
