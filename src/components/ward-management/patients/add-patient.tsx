"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";

import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { duplicateCandidates } from "@/components/ward-management/ward-patients";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";

import styles from "./add-patient.module.css";

/**
 * ADD A PATIENT — the second half of the owner's front door: "search for somebody, and if
 * nobody comes up, they need adding before they can be referred." `patient-search.tsx`'s own
 * empty state (`ward-patient-search-people-empty`) says exactly that and, until this file, had
 * nowhere to send a clinician who agreed.
 *
 * Modelled on `referrals/referral-intake.tsx` — same draft/answered-draft split, same
 * unavailable-Send shape, same `aria-disabled` + inert-handler wiring — because that is this
 * repository's established idiom for a front-door form, and a second form built a different way
 * would read as a second product on the one journey that is supposed to feel like one.
 *
 * FOUR FIELDS, NOTHING ELSE. `ADD_PATIENT`'s payload is exactly the identity `Patient` carries
 * under owner ruling PD-1 (`ward-patients.ts`'s own top comment): record number, given name,
 * family name, date of birth. No picker, no destination, no clinical fact of any kind — the
 * reducer's own case for this event is deliberately short, because adding a patient links to
 * nothing (no movement, no referral, no unit, no admission).
 *
 * ⚠️ **THE DISPATCHED ROLE IS `"coordinator"`, AND THAT IS A JUDGEMENT CALL, NOT A FACT READ OFF
 * THE MODEL.** `EVENT_ROLE.ADD_PATIENT` permits `ed`, `community` and `coordinator` — "anyone at
 * the front door may add a patient who is not yet known" (`ward-flow-events.ts`'s own comment) —
 * but this screen is reached from `patient-search.tsx`, a role-neutral page with no fixed
 * identity of its own (unlike `ed-screen.tsx` or `community-screen.tsx`, which dispatch as their
 * own role because they ARE that role's screen). `coordinator` is chosen because it is this
 * codebase's own precedent for exactly that situation: every other dispatch from a screen with no
 * single owning role (`shortlist-panel.tsx`, `referral-match.tsx`, `morning-tour.tsx`,
 * `ward-management-console.tsx`) uses `role: "coordinator"`. The choice has no effect on what is
 * recorded — the reducer's `ADD_PATIENT` case reads `event.role` only for the permission check
 * above the switch and stores nothing about who added the person — so a different permitted
 * choice would change nothing a clinician can see. If that stops being true (a future field
 * records who added a patient), this becomes a real decision and needs the owner, not an
 * implementer.
 */
type PatientDraft = {
  umrn: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
};

/** Every field this form asks, in the order they are asked, with the name the unavailability note
 *  calls each one. Mirrors `referral-intake.tsx`'s own `REQUIRED_FIELDS` shape. */
const REQUIRED_FIELDS: readonly { readonly key: keyof PatientDraft; readonly name: string }[] = [
  { key: "umrn", name: "Record number" },
  { key: "givenName", name: "Given name" },
  { key: "familyName", name: "Family name" },
  { key: "dateOfBirth", name: "Date of birth" },
];

/** Text fields need no separate sentinel — unlike `referral-intake.tsx`'s pickers, `""` is not
 *  already load-bearing here as a valid-but-wrong answer, so an empty (or whitespace-only)
 *  string is unambiguously "not answered yet".
 *
 *  `prefillGivenName` carries what a clinician already typed into `patient-search.tsx`'s search
 *  box, forwarded here as the `?name=` query parameter — see that file's own comment on
 *  `addPersonHref` for the judgement call on why the whole string lands in THIS one field and
 *  `familyName` stays blank rather than guessed. */
function initialDraft(prefillGivenName = ""): PatientDraft {
  return { umrn: "", givenName: prefillGivenName, familyName: "", dateOfBirth: "" };
}

function unansweredFieldNames(draft: PatientDraft): string[] {
  return REQUIRED_FIELDS.filter((field) => draft[field.key].trim() === "").map((field) => field.name);
}

type AnsweredDraft = PatientDraft;

/** The draft as `ADD_PATIENT` would take it, or `undefined` while any question is unanswered —
 *  the same single gate `referral-intake.tsx`'s `answeredDraft` is, trimmed to four fields. */
function answeredDraft(draft: PatientDraft): AnsweredDraft | undefined {
  const umrn = draft.umrn.trim();
  const givenName = draft.givenName.trim();
  const familyName = draft.familyName.trim();
  const dateOfBirth = draft.dateOfBirth.trim();
  if (umrn === "" || givenName === "" || familyName === "" || dateOfBirth === "") return undefined;
  return { umrn, givenName, familyName, dateOfBirth };
}

/** The id `aria-describedby` on Add patient points at while it is unavailable. */
const UNAVAILABLE_REASON_ID = "ward-add-patient-unavailable-reason";

/**
 * The `?name=` query parameter — carried here from `patient-search.tsx`'s empty state.
 *
 * ⚠️ **`useSearchParams`, NOT a hand-rolled `useSyncExternalStore`.** A prior version of this file
 * read `window.location.search` through `useSyncExternalStore` with a subscribe function that
 * never notified — so a `?name=` change that did not remount this component (browser back/forward,
 * or any future in-place navigation to this same route) was silently never picked up. Next 16's own
 * `useSearchParams` docs describe exactly the property that hook was standing in for: it "is
 * re-rendered on the client with the latest `searchParams`". Read it at
 * `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` before
 * touching this again.
 *
 * No `<Suspense>` boundary wraps this screen (`src/app/mockups/ward-flow/people/new/page.tsx`,
 * outside this file's editable scope). The docs describe a build-time failure for a *static* route
 * that calls this hook with no boundary — this repository has not opted into Cache Components
 * validation (no `cacheComponents` / `instantInsights` / `instant` in `next.config.ts`), and these
 * are mockup routes for which prerendering buys nothing, so `npm run build` is what actually proves
 * whether that applies here rather than either assumption.
 */
function readNamePrefill(searchParams: ReturnType<typeof useSearchParams>): string {
  return searchParams.get("name")?.trim() ?? "";
}

/**
 * The add-patient form. Reached from `patient-search.tsx`'s empty state and from nowhere else
 * today (`tests/route-reachability.test.ts` is what proves that link exists and resolves).
 *
 * On a successful add, this screen navigates to the new person's own screen
 * (`/mockups/ward-flow/people/<id>`) rather than staying put or bouncing back to search — the
 * owner's flow is "add them, THEN refer from their own screen" (`person-screen.tsx`'s own top
 * comment), so landing anywhere else would strand a clinician one screen short of where the flow
 * actually goes next.
 *
 * ⚠️ **THE NEW ID IS READ BACK FROM LIVE STATE, NEVER PREDICTED.** `wardFlowReducer`'s
 * `ADD_PATIENT` case mints `PT-A${state.patientSequence + 1}` — a formula this component cannot
 * reproduce, because `patientSequence` is reducer-internal and is not one of the fields
 * `WardFlowContextValue` exposes (only the resulting `patients` array is). Predicting the id from
 * `patients.length` would be wrong the moment a second `ADD_PATIENT` happens anywhere in the same
 * session, fixture-seeded patients included. So this effect does the same thing
 * `referral-intake.tsx`'s own success effect does for a rejection count: it snapshots `patients`
 * immediately before dispatching, and on the next render diffs the live array against that
 * snapshot to find the row the reducer actually added, by identity rather than by arithmetic.
 */
/**
 * ⚠️ THE SAME FLOOR `nearPatients` APPLIES TO A TERM, RESTATED HERE BECAUSE IT IS NOT EXPORTED —
 * AND PINNED BY A TEST RATHER THAN BY THIS COMMENT.
 *
 * The matcher ignores any term shorter than this, so below it the check has NOT RUN and this
 * screen must say so rather than report a clear result. A number copied from another file decays
 * the moment that file changes and nothing local ever fails — the exact defect this project has
 * been finding all day. So `tests/ward-add-patient.dom.test.tsx` asserts the coupling directly:
 * a term one character below this must produce no matches, and one at this length must be capable
 * of producing them. If Three moves its floor, that test goes red here rather than this screen
 * quietly telling a clinician nobody similar exists when nobody looked.
 */
const NEAR_MATCH_MINIMUM_TERM_LENGTH = 4;

export function AddPatientForm() {
  const { now, dispatch, patients } = useWardFlow();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<PatientDraft>(initialDraft);
  const [lastRejection, setLastRejection] = useState<string | undefined>(undefined);
  // Gates the unanswered-fields notice below between a static hint (present from mount, because
  // every field starts blank) and an announced one (see that render's own comment for why).
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // The patient list as it stood immediately before the most recent submit — `undefined` until a
  // first submit happens, so the effect below never fires on mount against a snapshot nobody took.
  const priorPatientsRef = useRef<typeof patients | undefined>(undefined);

  const answered = answeredDraft(draft);
  const outstanding = unansweredFieldNames(draft);

  /**
   * ⚠️ THE DUPLICATE CHECK, AND IT RUNS LIVE RATHER THAN ON SUBMIT — WHICH IS THE WHOLE DESIGN.
   *
   * The journey this exists for: a clinician searches "Halowin", is told nobody of that name is
   * known, presses the Add link the empty state offers, and lands here with "Halowin" already in
   * Given name. Marcus HALLOWIN is in the system. `b273dc96b` made that journey QUICKER by
   * carrying the typed text forward — before it, the clinician had to retype the name and might
   * have typed it correctly. This is what stands in the way now.
   *
   * ⚠️ SO IT MUST BE ON SCREEN AT THE SAME MOMENT AS THE PREFILL, not after a submit attempt. The
   * prefill is present on first paint; a submit-time warning arrives once the record number and
   * the date of birth have been typed, which is exactly when nobody re-reads the top of a form
   * they have just filled in.
   *
   * ⚠️ BOTH FIELDS, AS TERMS, BECAUSE OF WHERE THE PREFILL PUTS THINGS. On the case above the
   * FAMILY NAME BOX IS EMPTY and the surname sits in the forename box. `nearPatients` compares
   * every term against both name fields of every patient, in both directions, which is why this
   * can pass them as a pair and let the matcher decide.
   *
   * ⚠️ AND IT NEVER BLOCKS. Two people really can have near-identical names. A hard stop here
   * would eventually be worked around by typing a name that does not collide — which puts a
   * deliberately wrong name into an identity record, and that is worse than the duplicate it
   * prevented. The system states what it knows; the clinician decides.
   */
  const candidates = useMemo(() => duplicateCandidates(patients, draft), [patients, draft]);
  const nearMatches = candidates.nearSpelling;
  /**
   * ⚠️ THREE STATES, NOT TWO, AND I DEMANDED THIS OF THE SEARCH SCREEN BEFORE APPLYING IT HERE.
   *
   * "No similar names" said over a blank form is a reassurance nobody earned — the check has not
   * run, because `nearPatients` needs four characters before it will look at a term at all. A
   * screen that reports an empty result and a screen that has not looked are giving different
   * answers, and only one of them is entitled to sound settled.
   *
   * `hasCheckableName` mirrors the matcher's own four-character floor rather than restating a
   * number: if that floor ever moves, this says "not yet checked" for exactly as long as the
   * matcher declines to look, instead of claiming a clear result the matcher never produced.
   */
  /**
   * ⚠️ HAS ANY TIER ACTUALLY LOOKED? Each one has its own precondition, taken from
   * `duplicateCandidates`' own body rather than guessed: the record-number check runs on a
   * non-empty record number; the same-name checks need BOTH name fields; the near-spelling check
   * needs a term at the matcher's floor. Below all three, nothing has been examined and this
   * screen must say so — reporting "no existing record matches" when nothing was compared is a
   * reassurance nobody earned, and it is the same three-state discipline I asked of the search
   * screen before applying it here.
   */
  const hasCheckedAnything =
    draft.umrn.trim().length > 0 ||
    (draft.givenName.trim().length > 0 && draft.familyName.trim().length > 0) ||
    [draft.givenName, draft.familyName].some((term) => term.trim().length >= NEAR_MATCH_MINIMUM_TERM_LENGTH);
  /**
   * ⚠️ DEDUPLICATED, AND MY OWN TEST CAUGHT ME NOT DOING IT.
   *
   * `duplicateCandidates` guarantees nobody appears in both an exact tier and `nearSpelling`. It
   * does NOT guarantee uniqueness ACROSS the three exact tiers, and it should not: one person can
   * legitimately be BOTH a record-number collision and a same-name-same-birth-date match, and each
   * of those is a separate true claim worth stating. The tiers are different assertions about
   * different evidence.
   *
   * ⚠️ But the LIST beneath them is one list of people, and a person named twice in it is the
   * defect I quoted at Three an hour ago: a screen that says the same thing twice trains a reader
   * to skim both. So the claims stay separate and the roll-call is deduplicated by identity —
   * never by name, which is the one field that cannot distinguish these people.
   */
  const exactMatches = [
    ...candidates.recordNumberCollision,
    ...candidates.sameNameSameBirthDate,
    ...candidates.sameNameBirthDateNotMatched,
  ].filter((patient, index, all) => all.findIndex((other) => other.id === patient.id) === index);
  const foundSomething = exactMatches.length > 0 || nearMatches.length > 0;

  // See `readNamePrefill`'s own comment above: `useSearchParams` re-renders this component on the
  // client with the latest `?name=`, so this is live rather than a one-shot read.
  const namePrefillFromUrl = readNamePrefill(searchParams);
  // Applies that prefill to Given name exactly once, the moment it first becomes non-empty — see
  // `initialDraft`'s own comment for the judgement call on why the whole string lands in THIS one
  // field. Calling `setDraft` here, DURING RENDER rather than inside a `useEffect`, is the pattern
  // React documents for "adjusting state when a derived value changes"
  // (react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes): React
  // discards the stale render and immediately re-renders with the corrected state, rather than
  // committing a stale paint and only fixing it a tick later from an effect. `appliedNamePrefill`
  // is the guard that makes this run once — without it, `namePrefillFromUrl` is now LIVE (unlike
  // the old inert `useSyncExternalStore` read), so a later `?name=` change — or a render triggered
  // by any OTHER change, such as typing in a field — would see it still non-empty and fire again,
  // overwriting whatever the clinician has since typed. The guard is what keeps this a one-time
  // prefill rather than a value that fights the user's own edits.
  const [appliedNamePrefill, setAppliedNamePrefill] = useState(false);
  if (!appliedNamePrefill && namePrefillFromUrl !== "") {
    setAppliedNamePrefill(true);
    setDraft((current) => (current.givenName === "" ? { ...current, givenName: namePrefillFromUrl } : current));
  }

  useEffect(() => {
    const prior = priorPatientsRef.current;
    if (prior === undefined) return; // Nothing submitted yet.
    if (patients.length <= prior.length) {
      // The reducer refused the event (role check) rather than adding anyone. Surfaced rather
      // than silently doing nothing, exactly as `referral-intake.tsx`'s own rejection path is.
      setLastRejection("ADD_PATIENT was not accepted. No new person was added — nothing on this screen changed.");
      priorPatientsRef.current = undefined;
      return;
    }
    // Found by IDENTITY (an id absent from the prior snapshot), never by position or by count —
    // `patients` can carry fixture-seeded rows this form never touched, so "the last element" is
    // not a safe stand-in for "the one this submit created".
    const priorIds = new Set(prior.map((patient) => patient.id));
    const added = patients.filter((patient) => !priorIds.has(patient.id));
    // Precondition asserted rather than assumed: `patients.length > prior.length` above already
    // guarantees this is non-empty, so a silent no-op here would mean the guarantee broke, not
    // that there is nothing to do.
    if (added.length === 0) {
      throw new Error("AddPatientForm: patients grew but no new id was found against the prior snapshot.");
    }
    priorPatientsRef.current = undefined;
    router.push(`/mockups/ward-flow/people/${added[0].id}`);
  }, [patients, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The keyboard route to the same guard the inert button below enforces for a tap.
    if (!answered) {
      setAttemptedSubmit(true);
      return;
    }
    setLastRejection(undefined);
    priorPatientsRef.current = patients;
    dispatch({
      type: "ADD_PATIENT",
      role: "coordinator",
      now,
      umrn: answered.umrn,
      givenName: answered.givenName,
      familyName: answered.familyName,
      dateOfBirth: answered.dateOfBirth,
    });
  }

  /** The inert activation for an unavailable "Add patient" (`docs/wiring-conventions.md`'s
   *  stated-reason shape) — identical in shape to `referral-intake.tsx`'s own
   *  `ignoreUnavailableActivation`. */
  function ignoreUnavailableActivation(event: MouseEvent<HTMLButtonElement>) {
    if (answered) return;
    event.preventDefault();
    setAttemptedSubmit(true);
  }

  return (
    <div className={styles.screen} data-testid="ward-add-patient-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-add-patient-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This form is <strong>not a medical device</strong>. It records only the four identity facts a person is
            permitted to carry in this prototype &mdash; record number, given name, family name and date of birth
            &mdash; and links them to nothing: no referral, no movement, no bed.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Add a patient</h1>
          <p className={styles.pageSubtitle}>
            For someone not yet known to this system. Adding them creates no referral, movement or bed &mdash; those are
            separate steps from their own screen, once they exist here.
          </p>
        </header>

        {/*
          ⚠️ ABOVE THE FIELDS, NOT BESIDE THE SUBMIT BUTTON, because it has to be readable at the
          same moment as the prefilled name — see the computation's own comment. It is deliberately
          NOT DISMISSIBLE: a dismiss control on a notice that updates as you type becomes a thing
          clicked once and never seen again while the names go on matching. It stops being there
          when the names stop matching anybody, and not before.

          ⚠️ AND IT STATES; IT DOES NOT NAVIGATE. A link to the existing person is the obvious next
          step and it is a different feature — following it abandons a part-typed record, and what
          should happen to that draft is a decision nobody has taken. Offering it here would take
          that decision by implementing it.
        */}
        <section
          className={styles.duplicateNotice}
          aria-label="Possible existing records"
          data-testid="ward-add-patient-duplicate-check"
        >
          {!hasCheckedAnything ? (
            <p className={styles.duplicateIdle} data-testid="ward-add-patient-duplicate-unchecked">
              Existing records have not been checked yet — type a record number, or a name of at least{" "}
              {NEAR_MATCH_MINIMUM_TERM_LENGTH} letters.
            </p>
          ) : !foundSomething ? (
            <p className={styles.duplicateIdle} data-testid="ward-add-patient-duplicate-none">
              No existing record matches this record number or name.
            </p>
          ) : (
            <>
              {/*
                ⚠️ FOUR CLAIMS, EACH SAYING WHICH IT IS, AND THE ORDER IS NOT A RANKING. These are
                different assertions about different evidence, not degrees of one. Within any of
                them nobody is ranked, and `duplicateCandidates` guarantees no person appears in
                more than one — so a reader is never told the same thing twice about one patient.
              */}
              {candidates.recordNumberCollision.length > 0 ? (
                <p className={styles.duplicateLead} data-testid="ward-add-patient-duplicate-umrn">
                  {/*
                    ⚠️ FLAT, NOT HEDGED, AND THAT IS THE POINT. A record number is unique by
                    definition, so this is a COLLISION rather than a resemblance: either it is the
                    same person or somebody has mistyped. There is no third reading in which a new
                    patient legitimately holds this number, so "might be" would be a weaker claim
                    than the evidence supports.
                  */}
                  {draft.umrn.trim()} already belongs to{" "}
                  {candidates.recordNumberCollision
                    .map((patient) => `${patient.givenName} ${patient.familyName} (born ${patient.dateOfBirth})`)
                    .join(", ")}
                  .
                </p>
              ) : null}
              {candidates.sameNameSameBirthDate.length > 0 ? (
                <p className={styles.duplicateLead} data-testid="ward-add-patient-duplicate-same-name-same-dob">
                  Already in this system with the same name AND the same date of birth — almost certainly the same
                  person.
                </p>
              ) : null}
              {candidates.sameNameBirthDateNotMatched.length > 0 ? (
                <p className={styles.duplicateLead} data-testid="ward-add-patient-duplicate-same-name">
                  {/*
                    ⚠️ TRUE OF A BLANK DATE OF BIRTH AS WELL AS A DIFFERENT ONE, and that is why it
                    is worded this way. This screen reaches this tier with the date of birth not yet
                    typed EVERY time, because the notice renders live from first paint — so
                    "different date of birth" would be a false statement about an empty field, on a
                    clinical record. `duplicateCandidates` names the tier the same way for the same
                    reason, and the clinician's next action is identical either way: open the record
                    and look.
                  */}
                  Already in this system with the same name. The date of birth does not confirm it either way — open the
                  record and check.
                </p>
              ) : null}
              {exactMatches.length > 0 ? (
                <ul className={styles.duplicateList}>
                  {exactMatches.map((candidate) => (
                    <li
                      key={candidate.id}
                      className={styles.duplicateItem}
                      data-testid={`ward-add-patient-duplicate-${candidate.id}`}
                    >
                      <strong>
                        {candidate.givenName} {candidate.familyName}
                      </strong>
                      {" · "}
                      {candidate.umrn}
                      {" · born "}
                      {candidate.dateOfBirth}
                    </li>
                  ))}
                </ul>
              ) : null}
              {nearMatches.length > 0 ? (
                <p className={styles.duplicateLead} data-testid="ward-add-patient-duplicate-lead">
                  {nearMatches.length === 1
                    ? "A person already in this system has"
                    : "People already in this system have"}{" "}
                  {nearMatches.length === 1 ? "a name" : "names"} one keystroke from this one. Check whether this is the
                  same person before adding a second record.
                </p>
              ) : null}
              {nearMatches.length > 0 ? (
                <>
                  {/*
                ⚠️ THE RECORD NUMBER AND DATE OF BIRTH ARE NOT DECORATION. By construction every
                name here LOOKS like what was typed — that is why it is listed — so the name is the
                one thing that cannot distinguish these people. The identifier is.

                ⚠️ AND THEY ARE NOT RANKED. `nearPatients` returns them in the seed's own order and
                this renders that order untouched. A "closest match" shown first is an invitation,
                and on a screen that creates identity records an invitation to accept the wrong
                person is worse than the duplicate being prevented.
              */}
                  <ul className={styles.duplicateList}>
                    {nearMatches.map((candidate) => (
                      <li
                        key={candidate.id}
                        className={styles.duplicateItem}
                        data-testid={`ward-add-patient-duplicate-${candidate.id}`}
                      >
                        <strong>
                          {candidate.givenName} {candidate.familyName}
                        </strong>
                        {" · "}
                        {candidate.umrn}
                        {" · born "}
                        {candidate.dateOfBirth}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </section>
        <form className={styles.form} onSubmit={handleSubmit} data-testid="ward-add-patient-form">
          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-add-patient-umrn">
              Record number
            </label>
            <input
              id="ward-add-patient-umrn"
              data-testid="ward-add-patient-umrn"
              className={styles.input}
              type="text"
              autoComplete="off"
              value={draft.umrn}
              onChange={(event) => setDraft((current) => ({ ...current, umrn: event.target.value }))}
            />
          </div>

          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-add-patient-given-name">
              Given name
            </label>
            <input
              id="ward-add-patient-given-name"
              data-testid="ward-add-patient-given-name"
              className={styles.input}
              type="text"
              autoComplete="off"
              value={draft.givenName}
              onChange={(event) => setDraft((current) => ({ ...current, givenName: event.target.value }))}
            />
          </div>

          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-add-patient-family-name">
              Family name
            </label>
            <input
              id="ward-add-patient-family-name"
              data-testid="ward-add-patient-family-name"
              className={styles.input}
              type="text"
              autoComplete="off"
              value={draft.familyName}
              onChange={(event) => setDraft((current) => ({ ...current, familyName: event.target.value }))}
            />
          </div>

          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-add-patient-date-of-birth">
              Date of birth
            </label>
            <input
              id="ward-add-patient-date-of-birth"
              data-testid="ward-add-patient-date-of-birth"
              className={styles.input}
              type="date"
              value={draft.dateOfBirth}
              onChange={(event) => setDraft((current) => ({ ...current, dateOfBirth: event.target.value }))}
            />
          </div>

          {lastRejection ? (
            <p className={styles.rejection} data-testid="ward-add-patient-rejection" role="alert">
              {lastRejection}
            </p>
          ) : null}

          <button
            type="submit"
            className={styles.submit}
            data-testid="ward-add-patient-submit"
            aria-disabled={answered ? undefined : "true"}
            aria-describedby={answered ? undefined : UNAVAILABLE_REASON_ID}
            onClick={ignoreUnavailableActivation}
          >
            Add patient
          </button>

          {answered ? null : (
            /*
             * THE JUDGEMENT CALL: `ward-screen.tsx` has two house patterns for an unavailable
             * control's reason, and this notice needs both, at different moments.
             *
             * `aria-describedby` (wired below unconditionally, `ward-screen.tsx:1222`/`1261`'s own
             * pattern) is the right shape for the ordinary case — every field starts blank, so this
             * text is present from mount, not a new message appearing. A bare `role="alert"` from
             * mount would announce it the instant the page loads, before the clinician has done
             * anything, which is worse than saying nothing.
             *
             * `role="alert"` (`ward-screen.tsx:1276`'s own pattern, used there for a message that
             * only ever appears after a real event) is added ONLY once `attemptedSubmit` is true —
             * i.e. once the clinician has actually tried to submit while a field is still
             * unanswered. At that point it stops being a static hint and becomes exactly the kind
             * of new, event-triggered content `role="alert"` exists for, so a screen-reader user
             * hears what is missing at the moment they tried to act, and hears it again if it
             * changes as they fill fields in.
             */
            <p
              className={styles.unavailableReason}
              id={UNAVAILABLE_REASON_ID}
              data-testid="ward-add-patient-unavailable"
              role={attemptedSubmit ? "alert" : undefined}
            >
              Not yet answered: {outstanding.join(", ")}. Add patient stays unavailable until each has an answer.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
