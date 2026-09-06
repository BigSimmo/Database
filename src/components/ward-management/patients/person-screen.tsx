"use client";

import Link from "next/link";

import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { type PatientId, patientAgeYears, patientDisplayName } from "@/components/ward-management/ward-patients";
import sharedStyles from "@/components/ward-management/ward-shared.module.css";

import styles from "./person.module.css";

/**
 * A PERSON'S OWN SCREEN. The subject is the PERSON, not a request for a bed.
 *
 * The owner's flow is *search for a patient, and if nobody comes up, add them, then refer from
 * their own screen.* The last step had nowhere to happen: `/patients/[patientId]`
 * (since moved to `/mockups/ward-flow/movements/[movementId]`) looked a `Movement` up by id, so the
 * route named after people was about requests, and every one of its seven inbound links passed a
 * movement id (checked, not assumed — the variable is called `patient` in several of them, which is
 * where the confusion lives). Clicking a person in search results did nothing at all, because there
 * was nowhere for the tile to point.
 *
 * ⚠️ **`FD-23` BINDS THIS SCREEN AND THIS SCREEN MOST OF ALL.** A ward may not see where else a
 * patient has been referred; the coordinator may. The owner's reason: so a ward does not take its
 * time over a patient who has been referred elsewhere. The ledger's warning is aimed here — *every
 * instinct in a patient-centred design says a patient screen shows everything known about that
 * patient, so the omission looks like an incomplete implementation rather than a decision, and a
 * later reader will add it helpfully.* **If you came to this file to add "their current referrals",
 * that is the addition, and it needs the owner rather than a commit.**
 *
 * `tests/ward-person-screen.dom.test.tsx` guards it twice, deliberately. One assertion checks no
 * unit name reaches the screen. The other reads this source and fails if it consults the referral
 * list at all — because the first one passes today for a reason that has nothing to do with
 * `FD-23`: `Referral` carries no patient link, so this screen COULD not show referrals even if it
 * tried. A guard resting on that would go quiet the day the link lands, which is precisely the day
 * it is needed.
 *
 * **WHAT IT SHOWS: `PD-1`'s four identity facts (name, record number, date of birth, age DERIVED
 * from it rather than stored beside it), plus the nine fields `R-2026-09-04-A` (2026-09-04,
 * `docs/ward-flow/owner-rulings-2026-09-04.md` section A) added — address, suburb, GP, catchment
 * community team, legal status, interpreter/preferred language, Aboriginal or Torres Strait
 * Islander status, sex/gender and preferred name.** Everything else in the approved mockup below
 * stays out: risk flags, diagnosis, next of kin, medication, "open to the team" and the whole
 * history panel were each asked about or considered and none is authorised here. Widening
 * `PATIENT_FIELDS` again needs its own ruling and its own line in
 * `tests/ward-patient-model.test.ts`'s `PLACEMENT_FIELDS` map — not a passing test.
 *
 * ⚠️ **TWO OF THE NINE ARE HELD BUT NOT SETTLED FOR DISPLAY.** Whether Aboriginal or Torres Strait
 * Islander status and interpreter/preferred language belong on a screen at all remains open with
 * the Aboriginal health review; `R-2026-09-04-A` rules only that the record may HOLD them. They are
 * rendered below because the mockup already resolved a real defect in their placement (next
 * paragraph) and hiding them entirely would re-litigate a decision nobody has reopened — but do not
 * read their presence here as the review's answer.
 *
 * ⚠️ **THE PLACEMENT RULE, AND WHY IT HAS TWO HALVES.** The two sensitive fields must not sit
 * adjacent to each other, and neither may sit directly above the psychiatric history panel. An
 * earlier version of this fix satisfied only the first half — it moved Aboriginal status out of
 * that position and pushed interpreter language into it, and the single non-adjacency test passed
 * throughout. `SensitiveIdentityField` below is ONE function with two named slots
 * (`"aboriginalOrTorresStraitIslander"` and `"interpreterLanguage"`), rendered at two separate
 * points in the "Placement details" panel — Aboriginal status early, beside the other demographic
 * facts; interpreter language later, beside GP among the contact facts — with GENERAL PRACTITIONER
 * and LEGAL STATUS between and after them respectively, so neither half of the rule depends on the
 * other holding. `tests/ward-patient-placement-fields.dom.test.tsx` asserts both, separately, each
 * proved by its own mutation.
 *
 * ⚠️ **A NOTE FOR WHOEVER MEETS `docs/ward-flow/design/prototypes/mockup-patient.html` NEXT.** That
 * mockup's "Identity and key facts" panel additionally shows "open to the team" and, in a panel
 * below it, past psychiatric history, current medications, past medical history and referral
 * history. NONE of that is a missing render on this screen — it is a field set `R-2026-09-04-A`
 * did not authorise `Patient` to hold, or (the history panel) a link the model does not carry.
 *
 * ⚠️ **THE HISTORY PANEL IS A SEPARATE, DEEPER GAP AND IS UNBUILDABLE RATHER THAN UNBUILT.**
 * `Movement` (`ward-model.ts`) carries no `patientId` — only `Referral` does, since the pointer work
 * for `FD-23` — so there is no link by which a person's past admissions could be found at all. A
 * "Past psychiatric history: None" state built against that absence would not be an honest empty
 * state; it would state, of every patient, a clinical fact nobody has checked. That is the reasoning
 * behind leaving it out here rather than a missing step.
 *
 * Building any further field set or the history link is an owner decision, not a layout one. This
 * comment exists so the next reader inherits the reasoning rather than re-deriving it.
 */
/** A plain fact row: label, value, or "Not recorded" when the value is absent. Every one of
 *  R-2026-09-04-A's nine fields is optional — a person just added via search-then-add has none of
 *  them yet — so this is the one place "no value" becomes an honest sentence instead of a blank
 *  `<dd>` a reader might mistake for a rendering bug. */
function Fact({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className={`${sharedStyles.field} ${styles.fact}`}>
      <dt>{label}</dt>
      <dd className={value === undefined ? sharedStyles.pending : undefined}>{value ?? "Not recorded"}</dd>
    </div>
  );
}

/**
 * ⚠️ ONE MODULE, TWO NAMED SLOTS — read the placement-rule paragraph in this file's header comment
 * before touching this function.
 *
 * Aboriginal or Torres Strait Islander status and interpreter/preferred language are the two fields
 * the placement rule binds: not adjacent to each other, and neither directly above a psychiatric
 * history panel. Both render through this ONE function, so a change to how a sensitive field looks
 * or behaves applies to both identically (removability), but each CALL sits wherever `PersonScreen`
 * places it (non-adjacency) — the two calls below are deliberately far apart in the JSX rather than
 * looped from one array, which is what lets one move without dragging the other with it.
 *
 * `data-sensitive-slot` names which slot this is, so
 * `tests/ward-patient-placement-fields.dom.test.tsx` can find both by slot rather than by label text
 * or DOM position — position is exactly what that test is checking, so it must not be how the test
 * locates the elements.
 */
function SensitiveIdentityField({
  slot,
  label,
  value,
}: {
  slot: "aboriginalOrTorresStraitIslander" | "interpreterLanguage";
  label: string;
  value: string | undefined;
}) {
  return (
    <div className={`${sharedStyles.field} ${styles.fact}`} data-sensitive-slot={slot}>
      <dt>{label}</dt>
      <dd className={value === undefined ? sharedStyles.pending : undefined}>{value ?? "Not recorded"}</dd>
    </div>
  );
}

/**
 * ⚠️ **THIS ONE REALLY DOES TAKE A PERSON**, and its prop is typed `PatientId` to say so. The pair
 * matters more than either half: `WardPatientWorkspace` next door is named for a patient and holds
 * a MOVEMENT, and while both props were a bare `string` nothing could tell the two apart. Now the
 * compiler refuses a movement id here and a patient id there.
 */
export function PersonScreen({ patientId }: { patientId: PatientId }) {
  const { patients, dayZero } = useWardFlow();
  const person = patients.find((candidate) => candidate.id === patientId);

  return (
    <div className={styles.screen} data-testid="ward-person-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-person-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This screen is <strong>not a medical device</strong>. Every person in this prototype is invented, and
            nothing here has been checked against a real record. Their suburb and its paired community team are the
            exception: those are real places and real pairings, taken from this repository&apos;s own catchment table.
          </p>
        </div>

        {person === undefined ? (
          /*
           * Conservative failure. The specific mistake this shape exists to prevent is rendering
           * `patients[0]` for an unrecognised id: that looks like a working screen and it is a
           * different human being. A gap is only useful if you can see it, so the gap is what is
           * rendered.
           */
          <section className={styles.missing} data-testid="ward-person-missing">
            <h1 className={styles.pageTitle}>No such person</h1>
            <p>
              No person in this prototype has that record. Nobody has been substituted for them — search again, or add
              them if the person in front of you is real.
            </p>
            <Link className={styles.secondaryButton} href="/mockups/ward-flow/search">
              Back to search
            </Link>
          </section>
        ) : (
          <>
            <header className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>{patientDisplayName(person)}</h1>
              <p className={styles.pageSubtitle}>This person&apos;s own record.</p>
            </header>

            {/*
              A plain wrapper, not the panel itself: `WardPanel` does not forward arbitrary props,
              so the `ward-person-identity` testid — asserted by `tests/ward-person-screen.dom.test.tsx`
              both for its content and for its absence on an unknown person — lives here instead.
            */}
            <div data-testid="ward-person-identity">
              <WardPanel title="Who this is">
                <dl className={styles.factList}>
                  <div className={`${sharedStyles.field} ${styles.fact}`}>
                    <dt>Name</dt>
                    <dd>{patientDisplayName(person)}</dd>
                  </div>
                  {/* R-2026-09-04-A: a dignity fact, not a clinical one. No inference attaches to it. */}
                  <Fact label="Preferred name" value={person.preferredName} />
                  <div className={`${sharedStyles.field} ${styles.fact}`}>
                    <dt>Record number</dt>
                    <dd>{person.umrn}</dd>
                  </div>
                  <div className={`${sharedStyles.field} ${styles.fact}`}>
                    <dt>Date of birth</dt>
                    <dd>{person.dateOfBirth}</dd>
                  </div>
                </dl>
                <WardFigureStrip>
                  <WardFigure label="Age" value={String(patientAgeYears(person, dayZero))} unit="years" />
                </WardFigureStrip>
                {/*
                  Derived, never stored. `patientAgeYears` reads the date of birth above and is the
                  one place this project computes an age — holding both would let a record state an
                  age that disagrees with its own date of birth. Said in words, not only in this
                  comment, because a figure with no explanation invites somebody to "fix" it into a
                  stored field of its own later.
                */}
                <p className={sharedStyles.hint}>
                  Age is calculated from the date of birth above and is not stored on its own.
                </p>
              </WardPanel>
            </div>

            {/*
              R-2026-09-04-A's nine placement fields. A plain wrapper for the same reason as
              `ward-person-identity` above: `WardPanel` does not forward arbitrary props.

              ⚠️ ORDER IS THE PLACEMENT RULE, NOT DECORATION. Sex/gender, address and suburb come
              first; then Aboriginal or Torres Strait Islander status, EARLY in this demographic
              group rather than last; then GP; then interpreter/preferred language, sitting WITH GP
              among the contact facts rather than beside the field above; then catchment team; then
              legal status LAST. That keeps the two sensitive fields separated by GP (non-adjacency)
              and keeps legal status — not either sensitive field — the item that would sit directly
              above a psychiatric history panel if one is ever built here. Reordering this list back
              toward alphabetical or "tidier" would reopen exactly the adjacency this fixes.
            */}
            <div data-testid="ward-person-placement-details">
              <WardPanel title="Placement details">
                <dl className={styles.factList}>
                  <Fact label="Sex / gender" value={person.sexOrGender} />
                  <Fact label="Address" value={person.address} />
                  <Fact label="Suburb" value={person.suburb} />
                  <SensitiveIdentityField
                    slot="aboriginalOrTorresStraitIslander"
                    label="Aboriginal or Torres Strait Islander status"
                    value={person.aboriginalOrTorresStraitIslanderStatus}
                  />
                  <Fact label="GP" value={person.generalPractitioner} />
                  <SensitiveIdentityField
                    slot="interpreterLanguage"
                    label="Interpreter / preferred language"
                    value={person.interpreterLanguage}
                  />
                  <Fact label="Catchment community team" value={person.catchmentCommunityTeam} />
                  <Fact label="Legal status" value={person.legalStatus} />
                </dl>
                <p className={sharedStyles.hint}>
                  “Not recorded” is an honest gap for a person just added to this prototype — not a missing screen.
                </p>
              </WardPanel>
            </div>

            <section className={styles.actions}>
              <h2 className={styles.sectionHeading}>What you can do</h2>
              <Link
                className={styles.primaryButton}
                href={`/mockups/ward-flow/referrals/new?patientId=${encodeURIComponent(person.id)}`}
                data-testid="ward-person-refer"
              >
                {/* "Refer Patient" is the owner's wording, ruling 9, 2026-09-03. It replaced
                    "Refer this person". */}
                Refer Patient
              </Link>
              {/*
                ⚠️ THIS PARAGRAPH SAID THE OPPOSITE UNTIL 2026-09-02, AND IT CHANGED IN THE SAME
                COMMIT THAT MADE IT FALSE — which is the only moment it could have.

                It read: "A referral started here is not yet attached to this person. This prototype
                has no way to join the two." That was true, careful and honest, and the instant the
                button above began carrying `patientId` it became a lie. ⚠️ NOTHING WOULD HAVE
                FAILED. No test asserts this sentence, and a screen quietly telling a clinician that
                a link does not exist while the link is being written is worse than never having
                said anything.

                Owner ruling 2026-09-02: a referral may remember its patient. A POINTER, never a
                copy — no name, date of birth or record number travels with it.

                ⚠️ AND IT PROMISES NO HISTORY, DELIBERATELY. Whether a ward may see where else a
                person has been referred is `FD-23` and its mechanism does not exist. Writing the
                pointer and displaying a person's referrals are two decisions and only the first has
                been made, so this says what is true today and offers nothing that is not built.
              */}
              <p className={styles.note} data-testid="ward-person-refer-note">
                A referral started here is recorded against this person. It carries the link only — their name, date of
                birth and record number stay on this record and are not copied onto the referral. This screen does not
                show a person&apos;s referral history.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
