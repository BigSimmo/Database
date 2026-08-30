"use client";

import Link from "next/link";

import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { patientAgeYears, patientDisplayName } from "@/components/ward-management/ward-patients";

import styles from "./person.module.css";

/**
 * A PERSON'S OWN SCREEN. The subject is the PERSON, not a request for a bed.
 *
 * The owner's flow is *search for a patient, and if nobody comes up, add them, then refer from
 * their own screen.* The last step had nowhere to happen: `/mockups/ward-flow/patients/[patientId]`
 * looks a `Movement` up by id, so the route named after people is about requests, and every one of
 * its seven inbound links passes a movement id (checked, not assumed — the variable is called
 * `patient` in several of them, which is where the confusion lives). Clicking a person in search
 * results did nothing at all, because there was nowhere for the tile to point.
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
 * **WHAT IT SHOWS IS EXACTLY WHAT `PD-1` PERMITS AND NOTHING ELSE:** name, record number, date of
 * birth, and age DERIVED from that date rather than stored beside it. `address` and narrative
 * history were never ruled on and stay denied — silence is not permission.
 */
export function PersonScreen({ patientId }: { patientId: string }) {
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
            nothing here has been checked against a real record.
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

            <section className={styles.identity} data-testid="ward-person-identity">
              <h2 className={styles.sectionHeading}>Who this is</h2>
              <dl className={styles.factList}>
                <div className={styles.fact}>
                  <dt>Name</dt>
                  <dd>{patientDisplayName(person)}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Record number</dt>
                  <dd>{person.umrn}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Date of birth</dt>
                  <dd>{person.dateOfBirth}</dd>
                </div>
                <div className={styles.fact}>
                  {/*
                    Derived, never stored. `patientAgeYears` reads the date of birth and is the one
                    place this project computes an age — holding both would let a record state an
                    age that disagrees with its own date of birth.
                  */}
                  <dt>Age</dt>
                  <dd>{patientAgeYears(person, dayZero)} years</dd>
                </div>
              </dl>
            </section>

            <section className={styles.actions}>
              <h2 className={styles.sectionHeading}>What you can do</h2>
              <Link
                className={styles.primaryButton}
                href="/mockups/ward-flow/referrals/new"
                data-testid="ward-person-refer"
              >
                Refer this person
              </Link>
              {/*
                The honest half of the button. A referral raised from here is NOT joined to this
                record, because `Referral` carries no patient link — `patientId` is named in
                `ALLOWED_REFERRAL_FIELDS`' own comment as a field its guard exists to catch, so
                adding one is a governance decision rather than an implementation one.

                Saying so is the conservative-failure rule arriving where it is most tempting to
                skip: a button that implied the referral would carry this person's identity would be
                the screen making a claim the model cannot keep, and nobody would find out until
                somebody went looking for the person's referral and it was not there.
              */}
              <p className={styles.note} data-testid="ward-person-refer-note">
                A referral started here is not yet attached to this person. This prototype has no way to join the two,
                so the referral will carry only the facts you enter on it.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
