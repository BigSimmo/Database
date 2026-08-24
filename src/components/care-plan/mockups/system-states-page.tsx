"use client";

import Link from "next/link";

import styles from "./care-plan.module.css";
import { useCarePlanPrototype } from "./prototype-provider";
import { getPrototypeMutationBlockReason } from "./prototype-state";
import { DefinitionRow, SectionFrame, StatusMark, SyntheticMarker } from "./prototype-ui";
import { CARE_PLAN_ROUTES, carePlanRoute } from "./routes";
import type { PrototypeScenario } from "./types";

/**
 * Every degraded state this application has, as a reconstructable specimen.
 *
 * The controls here are **links**, and that is the whole design. Naming the
 * specimen in the address is what makes it shareable, bookmarkable and
 * reloadable — most of what this screen is for — and the shell already holds a
 * guarded effect that dispatches `apply-scenario` only when the scenario named
 * in the URL differs from the one the reducer holds. A control that dispatched
 * as well would apply the specimen twice, and `apply-scenario` rebuilds the
 * fixtures, so the second application would discard whatever the first left.
 *
 * That is also why every card says so out loud: choosing a specimen is not a
 * display toggle. It rebuilds the synthetic world, and anything written in the
 * session goes with it.
 */

type Specimen = {
  scenario: PrototypeScenario;
  title: string;
  happened: string;
  means: string;
  available: string;
};

/**
 * Every specimen, keyed by the scenario it reconstructs, in the order they are
 * offered: the ordinary world, then the states a reader is most likely to meet,
 * then the ones that stop a change.
 *
 * Keyed rather than listed so the **compiler** requires one entry per
 * `PrototypeScenario`. As a plain array this was cast to shape, and a
 * thirteenth scenario would have shipped with no card, no address, and nothing
 * failing — a runtime assertion cannot notice a case nobody wrote down.
 */
const SPECIMEN_DETAIL = {
  normal: {
    title: "Everything working",
    happened: "Rowan Sample has a Current Plan that is within its review date, and nothing is degraded.",
    means: "Every action is offered to whoever the signed-in responsibility carries it.",
    available: "Read the Clinical Snapshot, record an ED Presentation, or work a queue in Reviews.",
  },
  empty: {
    title: "Nothing open",
    happened: "No synthetic person is selected.",
    means:
      "The workspace has nothing to show. It says so in words rather than leaving a blank column that could be read as a person with no plan.",
    available: "Search by synthetic name, MRN, date of birth, or alias, then choose a record.",
  },
  "no-current-plan": {
    title: "No Current Plan",
    happened: "Jordan Test has never had a Management Plan agreed.",
    means:
      "Nothing has been agreed for him in this prototype. Assess and treat as you would for anyone else; the absence of a plan is not a finding about him.",
    available: "Refer him for Identification Review with a stated reason, or start a draft plan.",
  },
  "overdue-plan": {
    title: "Review overdue",
    happened: "Mira Example's Current Plan passed the review date recorded on it.",
    means:
      "It is still the Current Plan and still the approach the team agreed. It is not expired, not hidden, and not downgraded to a draft — an overdue plan is a plan somebody has to look at, not a plan that stopped applying.",
    available: "Read it as normal, and arrange a review.",
  },
  "withdrawn-plan": {
    title: "Plan withdrawn",
    happened: "Evelyn Demo's Current Plan was deliberately taken out of use with a recorded reason.",
    means:
      "She has no Current Plan, and no earlier version was restored in its place. The withdrawal, its reason, and the clinician who made it stay on the record, so a withdrawn plan never reads like a person who never had one.",
    available: "Read the withdrawal reason and the superseded versions. A new version has to be written and approved.",
  },
  "unverified-contact": {
    title: "Team contact details not confirmed",
    happened: "Wandoo District CMHT's displayed mailbox, number, and hours have not been confirmed for a long time.",
    means:
      "The details stay on screen with the date beside them, so they can still be tried. Nothing here says the team can be reached on them.",
    available: "Try them anyway, and record a check in the Contact Verification worklist once somebody has looked.",
  },
  "identity-uncertain": {
    title: "Not confirmed as the right person",
    happened: "The open record has not been confirmed as the person in front of you.",
    means:
      "No plan, episode, or history is shown at all. A nearby person's record is never offered as a fallback, because showing the wrong person's plan is worse than showing none.",
    available: "Return to search and choose the record again.",
  },
  "version-conflict": {
    title: "A newer version exists",
    happened: "The synthetic prototype holds a newer version of this record than the one being worked on.",
    means:
      "Both are kept. Nothing is overwritten and nothing is decided for you; the two have to be compared by a person.",
    available: "Compare the two versions, then decide which one should stand.",
  },
  offline: {
    title: "This device is offline",
    happened: "The specimen puts the prototype into its offline state.",
    means:
      "What is on screen is the last synthetic state held in memory. No record can be changed while this specimen is displayed, and nothing is queued to happen later.",
    available: "Read everything as normal, and print. Opening a print view changes no record.",
  },
  "permission-unavailable": {
    title: "Permission could not be confirmed",
    happened: "The specimen puts the prototype into the state where permission for an action cannot be confirmed.",
    means:
      "Reading is unaffected. Nothing that would change a record proceeds, and nothing is changed in the background instead.",
    available: "Read the record. Ask whoever holds the responsibility to make the change.",
  },
  "launch-failure": {
    title: "The external application would not open",
    happened: "An email or telephone link was activated on Rowan Sample's record and nothing opened.",
    means:
      "Nothing was sent and no call was placed. The application never held any evidence that anything was, so nothing about the failure changes what is on the record.",
    available:
      "The contact details stay exactly where they were. Use the displayed mailbox or number directly. Open Rowan's record and try a contact control to see it.",
  },
  "print-failure": {
    title: "The print view would not open",
    happened: "A print action was taken and the browser's print view did not open.",
    means: "Nothing reached a printer, and the document is unchanged.",
    available:
      "The plan stays fully readable on screen. Try the browser's own print action again from the print route.",
  },
} satisfies Record<PrototypeScenario, Omit<Specimen, "scenario">>;

/** One card per specimen, in the order `SPECIMEN_DETAIL` declares them. */
const SPECIMENS: readonly Specimen[] = (Object.keys(SPECIMEN_DETAIL) as PrototypeScenario[]).map((scenario) => ({
  scenario,
  ...SPECIMEN_DETAIL[scenario],
}));

function scenarioLabel(scenario: PrototypeScenario): string {
  return SPECIMEN_DETAIL[scenario].title;
}

/** `normal` is the absence of a specimen, so its address carries no query at
 *  all rather than `?scenario=normal`. */
function specimenHref(scenario: PrototypeScenario): string {
  return scenario === "normal" ? CARE_PLAN_ROUTES.systemStates : carePlanRoute.scenario(scenario);
}

export function SystemStatesSurface({ scenario }: { scenario: PrototypeScenario }) {
  const { state } = useCarePlanPrototype();

  const patient = state.patients.find(({ id }) => id === (state.selectedPatientId ?? "")) ?? state.patients[0] ?? null;

  /**
   * The mutation funnel's own account, probed with an action every synthetic
   * responsibility carries — so what is reported here is the specimen's effect
   * rather than the signed-in role's.
   */
  const blockedReason =
    patient === null
      ? null
      : getPrototypeMutationBlockReason(state, {
          type: "record-contact-intent",
          patientId: patient.id,
          cmhtId: patient.cmhtId,
          channel: "email",
        });

  /**
   * Printing is deliberately exempt from the connectivity block: the browser
   * print dialogue opens either way, so refusing to record the request would
   * mean paper could leave the building while the record said nothing happened.
   * Reported separately rather than folded into one sentence, because a blanket
   * "everything is unavailable" would be untrue in exactly that case.
   */
  const printBlockedReason =
    patient === null
      ? null
      : getPrototypeMutationBlockReason(state, {
          type: "record-management-plan-print-intent",
          patientId: patient.id,
        });

  const active = SPECIMENS.find((specimen) => specimen.scenario === scenario) ?? SPECIMENS[0];

  return (
    <section aria-label="Degraded-state specimens" className={styles.workspace}>
      <div className={styles.identityBand}>
        <SyntheticMarker />
        <p className={styles.sectionDescription}>
          Every degraded state this application has, each one reconstructable from its own address. Opening a specimen
          rebuilds the synthetic world from the fixtures, so anything written in this session is discarded — that is
          what makes a specimen deterministic, and it is also why it is not a display toggle.
        </p>
      </div>

      <SectionFrame
        id="care-plan-specimen-active"
        heading={active.title}
        tone="boundary"
        testId="care-plan-specimen-active"
        description="The specimen currently on display, in the same three parts every error in this application uses."
      >
        <div className={styles.metadataMarks}>
          <StatusMark tone={scenario === "normal" ? "success" : "warning"} label={`Specimen: ${active.title}`} />
        </div>
        <dl className={styles.definitionGrid}>
          <DefinitionRow term="What happened">{active.happened}</DefinitionRow>
          <DefinitionRow term="What it means">{active.means}</DefinitionRow>
          <DefinitionRow term="What you can do">{active.available}</DefinitionRow>
        </dl>

        {blockedReason === null ? (
          <p data-testid="care-plan-specimen-available" className={styles.contactVerified}>
            <StatusMark tone="success" label="Every action available" /> Nothing is degraded in this specimen, so every
            action is offered to whoever the signed-in responsibility carries it.
          </p>
        ) : (
          <>
            <p role="alert" data-testid="care-plan-specimen-blocked" className={styles.contactWarning}>
              <strong>Every action that would change a record is unavailable.</strong> {blockedReason}
            </p>
            {printBlockedReason === null ? (
              <p data-testid="care-plan-specimen-print-available" className={styles.contactBoundary}>
                Opening a print view is still available, because it changes no record and the browser&rsquo;s print
                dialogue opens either way. Recording that request is how the account of what this application did stays
                truthful.
              </p>
            ) : null}
          </>
        )}
      </SectionFrame>

      <SectionFrame
        id="care-plan-specimen-index"
        heading="Every specimen"
        description="Each one is an address. Copy it, bookmark it, or reload it, and the same world comes back."
      >
        <ul data-testid="care-plan-specimen-list" className={styles.specimenList}>
          {SPECIMENS.map((specimen) => (
            <li
              key={specimen.scenario}
              className={
                specimen.scenario === scenario
                  ? `${styles.specimenEntry} ${styles.specimenEntryActive}`
                  : styles.specimenEntry
              }
            >
              <h3 className={styles.specimenTitle}>{specimen.title}</h3>
              <p className={styles.sectionDescription}>{specimen.happened}</p>
              <Link
                href={specimenHref(specimen.scenario)}
                aria-current={specimen.scenario === scenario ? "page" : undefined}
                className={styles.specimenLink}
              >
                {specimen.scenario === scenario ? `${specimen.title} — on display now` : `Open ${specimen.title}`}
              </Link>
            </li>
          ))}
        </ul>
      </SectionFrame>

      <SectionFrame id="care-plan-specimen-boundary" heading="What a specimen is not" tone="secondary">
        <ul className={styles.contentList}>
          <li>
            It is not a real condition. Nothing here watches the network, the browser&rsquo;s permissions, or any
            device state — a specimen is a named starting world and nothing else.
          </li>
          <li>
            {`It is not a display filter. Opening ${scenarioLabel(active.scenario)} or any other specimen rebuilds the whole synthetic world, and anything written in this session is discarded.`}
          </li>
          <li>
            It is not saved. There is no storage of any kind, so reloading any address in this prototype starts over.
          </li>
        </ul>
      </SectionFrame>
    </section>
  );
}
