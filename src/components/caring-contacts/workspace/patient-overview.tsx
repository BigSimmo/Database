import { CalendarClock, EyeOff } from "lucide-react";
import Link from "next/link";

import { CARING_CONTACTS_ROUTES, patientPlanRoute } from "@/lib/caring-contacts-routes";
import { awstCalendarDay } from "@/lib/caring-contacts/clock";
import type { Episode } from "@/lib/caring-contacts/episode";
import { contactSendability, type ContactState, type MessageType, type PlanState } from "@/lib/caring-contacts/model";
import {
  summariseStoredContacts,
  type PatientNameProjection,
  type PlanOutcome,
  type PlanRecord,
  type StoredContact,
  type StoredContactSummary,
} from "@/lib/caring-contacts/repository";

import { AutomatedState } from "./automated-state";
import { ListEmptyState } from "./list-empty-state";
import { UnavailableDestination } from "./unavailable-destination";

/**
 * One patient's caring-contact episode -- who they are, which plan is running, what has happened
 * on it, and what is still to come.
 *
 * THE SCREEN IS SCOPED TO ONE PLAN AND NEVER PICKS WHICH (Ruling 97)
 * -----------------------------------------------------------------
 * The route is keyed by PATIENT and every read in this domain is keyed by PLAN. One patient can
 * honestly hold two episodes -- `repository.ts` says so, and `markRetentionCleared` clears detail
 * per plan, so two plans for one person can legitimately differ in what they still hold. So this
 * component takes a `view` that has ALREADY been decided by the page:
 *
 *   * `"no-plan"` -- this team holds no plan for this patient. Deliberately the same answer the
 *     screen gives when the plan belongs to another team: `getPlan` gives one answer for both so
 *     that nobody can find out a record exists by being refused it, and this screen must not
 *     become the one that tells them apart.
 *   * `"not-permitted"` -- the acting role may not view plans at all. A fact about the ACTOR,
 *     decided by the page from the actor rather than inferred here from an empty list, exactly as
 *     `PatientsDirectory` decides `mayViewPlans`. `listPlans` answers such an actor with `[]`, the
 *     same answer it gives a patient with no plan, so a screen that only counted rows would tell
 *     an auditor this patient has no plan -- a false statement about a clinical record.
 *   * `"choose"` -- more than one plan and nothing in the URL naming one. The clinician picks. A
 *     screen that picked for them would put one plan's schedule under a heading carrying this
 *     patient's name, which is the error that matters most here.
 *   * `"episode"` -- one plan, and the episode the page read for it.
 *
 * WHAT THE EPISODE VIEW SHOWS OF THE PERSON
 * ----------------------------------------
 * `getEpisode` is the one read that releases the name, the mobile number, the identifiers and the
 * cultural identity together, and this is the one screen permitted to make it. All four are shown:
 * they are what makes the record this person's rather than somebody else's, the cultural identity
 * is what a caring-contact pathway is chosen against, and the mobile number is the destination the
 * whole plan is aimed at.
 *
 * The mobile number was withheld in the first version of this screen and the owner reversed that
 * (review round 1). It is on the identity strip beside the name rather than in a detail row, since
 * it is being shown deliberately and a reader looking for it should find it where identity lives.
 *
 * THE LICENCE DOES NOT TRAVEL. This screen may see the number because it already made the read
 * that releases it; nothing else in the workspace may. The caseload uses `listPatientNames`, whose
 * two-field return type structurally cannot carry a number, and no other surface calls
 * `getEpisode`. Do not add a read for it elsewhere, and do not widen one.
 *
 * It is rendered as TEXT, never as a `tel:` link. Nothing in this workspace dials anybody, every
 * number in it is invented, and a control that looked dialable would be the one thing on this
 * screen a reader might act on. The label says so in place.
 *
 * A BLANK NAME IS NOT A NAME, AND HERE THE CAUSE IS KNOWABLE
 * ---------------------------------------------------------
 * `CLEARED_PATIENT_DETAIL` is what both stores write once a retention clearance is recorded, so a
 * blank `patientName` means no name is held. `PatientsDirectory` cannot say WHY a name is missing,
 * because a role restriction and a cleared episode arrive there identically. This screen can: an
 * actor who could not read an episode receives no `Episode` at all, so a blank name on a released
 * episode is the clearance, not the role. The note says so.
 *
 * THE COUNT IS DERIVED, THE CLOSING MESSAGE IS ITS OWN KIND (Ruling 98)
 * --------------------------------------------------------------------
 * The approved mockup hard-codes "10 contacts over 12 months" and an `aria-label` of "Ten-contact
 * continuity". Both are wrong as literals. The cadence is Day 1, Week 1, then months 1, 2, 3, 4,
 * 6, 8, 10 and 12; Week 1 is SUPPRESSED exactly when the coordinator set the first contact to
 * discharge + 7, because two caring contacts must never land on one day, which makes that plan
 * nine sendable messages rather than ten; and the last entry is a CLOSING message, a different
 * kind from a caring contact. So every number on this screen is counted from `record.contacts`,
 * and the closing message is labelled as what it is.
 *
 * Sendability is keyed off `contact.state`, never off `planned.suppressed`, for the reason
 * `PatientsDirectory` records: the schedule's absorption is not the only way a contact becomes
 * suppressed -- `applyContactTransition`'s `suppress` action can move any live contact there
 * later, and such a contact carries no `planned.suppressed` marker. Counting the plan rather than
 * the outcome would leave those with no explanation at all.
 *
 * `Episode.counts.contactsScheduled` is deliberately NOT used for that number. It counts entries
 * whose `planned.suppressed` is undefined, so after a later `suppress` transition it would report
 * a message as still to be sent that never will be. `contactsSent` and `contactsDelivered` are
 * keyed off contact state and are used as the module's own.
 *
 * EVERY SYSTEM-REACHED STATE STATES ITS REASON IN PLACE (spec 4.4)
 * ---------------------------------------------------------------
 * A suppressed entry and a moved first contact are both things the reader will otherwise have to
 * account for by guessing. Each carries its reason beside it, in plain words, on the same screen.
 * The moved first contact's RECORDED reason is now held with the plan and shown here verbatim
 * (Ruling 105): it travels on the episode rather than on the plan record, because it is free text
 * a clinician wrote about this patient. When none is held the screen says WHICH absence it is
 * looking at — a role that may not read the episode, a retention clearance, or a plan older than
 * the field — rather than reporting one absence for three different facts. See `FirstContact`.
 *
 * A Server Component with no hooks and no client boundary (Ruling 13). The chooser is a set of
 * `<Link>`s that put the choice in the URL; nothing on this screen needs JavaScript to work, and
 * the only client component it renders is `UnavailableDestination`, which the shell's navigation
 * already ships on every screen.
 */

const PLAN_STATE_LABELS: Readonly<Record<PlanState, string>> = Object.freeze({
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
  completed: "Completed",
});

const PLAN_OUTCOME_LABELS: Readonly<Record<PlanOutcome, string>> = Object.freeze({
  inProgress: "In progress",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
  completed: "Completed",
});

/**
 * What each kind of message in the schedule is called.
 *
 * The closing message has its own label because it is its own kind: it ends the plan and is not
 * one more caring contact. Naming it "Caring contact" would overstate the plan by one.
 */
const MESSAGE_TYPE_LABELS: Readonly<Record<MessageType, string>> = Object.freeze({
  first: "First message",
  standard: "Caring contact",
  closing: "Closing message",
});

/**
 * Plain words for a contact's state.
 *
 * Every provider-reported state is labelled as a transport receipt, because that is the whole of
 * what it is: "Delivered" says the message provider accepted and reported the message, and says
 * nothing whatever about the patient. It is never a patient-state label.
 */
const CONTACT_STATE_LABELS: Readonly<Record<ContactState, string>> = Object.freeze({
  scheduled: "Scheduled",
  processing: "Being sent",
  sent: "Sent",
  delivered: "Delivered (transport receipt)",
  notDelivered: "Not delivered (transport receipt)",
  numberInvalid: "Number invalid (transport receipt)",
  contactChanged: "Number changed (transport receipt)",
  statusUnavailable: "Transport receipt unavailable",
  missed: "Missed",
  suppressed: "Suppressed",
  cancelled: "Cancelled",
});

/** The programme's usual first contact: the day after discharge. */
const DEFAULT_FIRST_CONTACT_OFFSET_DAYS = 1;
const MILLISECONDS_PER_DAY = 86_400_000;

export type PatientOverviewView =
  | { kind: "no-plan" }
  | { kind: "not-permitted" }
  | {
      kind: "choose";
      /** Every plan this team holds for this patient, in the order the read released them. */
      plans: readonly PlanRecord[];
      /** The names-only read (Ruling 91). A chooser does not need a mobile number. */
      patientNames: readonly PatientNameProjection[];
    }
  | {
      kind: "episode";
      record: PlanRecord;
      /**
       * Null when the acting role may not read an episode -- decided by the page from the actor,
       * never inferred here. The plan is still shown; the person is not.
       */
      episode: Episode | null;
      /** How many OTHER plans this team holds for this patient, so the reader knows this is one of several. */
      otherPlanCount: number;
    };

export type PatientOverviewProps = {
  /** The synthetic patient identifier from the URL, already decoded by the framework. */
  patientId: string;
  view: PatientOverviewView;
};

export function PatientOverview({ patientId, view }: PatientOverviewProps) {
  if (view.kind === "not-permitted") {
    return (
      <section className="min-w-0">
        <ListEmptyState
          kind="not-permitted"
          heading="Plans are not visible in this role"
          because="Viewing plans is not part of the role you are acting in. This says nothing about whether this team holds a plan for this patient: a read you may not make and a patient with no plan look identical on purpose, so that nobody can find out a record exists by being refused it."
          changedBy="Nothing on this screen changes it, and there is no control for it anywhere in this workspace yet. The role this demonstration acts in is set outside the interface; a coordinator sees this team's plans."
          action={<BackToPatients />}
        />
      </section>
    );
  }

  if (view.kind === "no-plan") {
    return (
      <section className="min-w-0">
        <ListEmptyState
          kind="no-data"
          heading="No plan for this patient"
          explanation={`This team holds no caring-contact plan for ${patientId}. If another team holds one for this person, this screen answers exactly as it does when no plan exists anywhere, so that nobody can find out a record exists by being refused it.`}
          action={<BackToPatients />}
        />
      </section>
    );
  }

  if (view.kind === "choose") {
    return <PlanChooser patientId={patientId} plans={view.plans} patientNames={view.patientNames} />;
  }

  return (
    <EpisodeOverview
      patientId={patientId}
      record={view.record}
      episode={view.episode}
      otherPlanCount={view.otherPlanCount}
    />
  );
}

function BackToPatients() {
  return (
    <Link
      href={CARING_CONTACTS_ROUTES.patients}
      data-internal-link="true"
      className="inline-flex min-h-tap items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-semibold text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border-[CanvasText]"
    >
      Back to this team&rsquo;s plans
    </Link>
  );
}

const cardClass =
  "min-w-0 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 forced-colors:border-[CanvasText]";

const rowLinkClass =
  "flex min-h-tap min-w-0 flex-col justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border-[CanvasText]";

/**
 * More than one plan, and nothing in the URL naming one.
 *
 * The name comes from `listPatientNames` (Ruling 91), never from `getEpisode`: choosing between
 * two plans needs a name to recognise the person by and nothing else, and `getEpisode` would
 * release four identifying fields to answer a question about which plan to open. It is also
 * keyed by PLAN, and that matters here more than anywhere else in the workspace -- a retention
 * clearance is recorded per plan, so one of this patient's two plans can hold a name while the
 * other does not, and the chooser shows each row's own answer rather than one name for both.
 */
function PlanChooser({
  patientId,
  plans,
  patientNames,
}: {
  patientId: string;
  plans: readonly PlanRecord[];
  patientNames: readonly PatientNameProjection[];
}) {
  // A cleared plan's name is the empty string both stores write for a removed one, so it is
  // dropped here rather than at each row: an empty name is "no name held", never a name.
  const nameByPlan = new Map(
    patientNames.filter((entry) => entry.patientName !== "").map((entry) => [entry.planId, entry.patientName]),
  );
  const anyName = plans.map((record) => nameByPlan.get(record.plan.id)).find((name) => name !== undefined) ?? null;

  return (
    <section aria-labelledby="caring-contacts-plan-chooser-heading" className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
        {anyName === null ? "Synthetic patient identifier" : "Patient"}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-heading)]">{anyName ?? patientId}</p>
      <h2
        id="caring-contacts-plan-chooser-heading"
        className="mt-4 text-base font-semibold text-[color:var(--text-heading)]"
      >
        This patient has more than one plan
      </h2>
      <p className="mt-2 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        Choose which plan to open. This screen shows one plan at a time and will not choose for you: two plans for one
        person can hold different things, because a retention clearance is recorded against a plan rather than against a
        patient, and one plan&rsquo;s schedule shown under this patient&rsquo;s name without saying which plan it is
        would be the worst mistake this screen could make.
      </p>

      <ul className="mt-4 flex min-w-0 flex-col gap-3">
        {plans.map((record) => {
          const name = nameByPlan.get(record.plan.id) ?? null;
          return (
            <li key={record.plan.id} className="min-w-0">
              <Link
                href={patientPlanRoute(patientId, record.plan.id)}
                data-internal-link="true"
                className={rowLinkClass}
              >
                <span className="truncate text-sm font-semibold text-[color:var(--text-heading)]">
                  Plan {record.plan.id}
                </span>
                <span className="mt-0.5 truncate text-sm text-[color:var(--text-muted)]">
                  {PLAN_STATE_LABELS[record.plan.state]} &middot; discharged {awstCalendarDay(record.dischargeAt)}{" "}
                  (AWST) &middot; {name === null ? "no name held for this plan" : name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-5">
        <BackToPatients />
      </div>
    </section>
  );
}

function EpisodeOverview({
  patientId,
  record,
  episode,
  otherPlanCount,
}: {
  patientId: string;
  record: PlanRecord;
  episode: Episode | null;
  otherPlanCount: number;
}) {
  const name = episode !== null && episode.patientName !== "" ? episode.patientName : null;
  const entries = [...record.contacts].sort((left, right) => left.planned.sequence - right.planned.sequence);
  // The counts come from the domain (`summariseStoredContacts` -> `contactSendability`), not from
  // a predicate written here. The first version of this screen counted "not suppressed" as "will
  // be sent", which is narrower than the truth and wrong on a path ordinary writes reach:
  // `withdrawPlan` and `recordHospitalStatusEvent` cancel every unsent contact, so a withdrawn
  // plan -- or one stopped by a recorded death -- was announced as ten messages still to come.
  const summary = summariseStoredContacts(entries);
  const firstContact = entries.find((entry) => entry.planned.messageType === "first") ?? entries[0];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section aria-labelledby="caring-contacts-patient-heading" className={cardClass}>
        <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
          {name === null ? "Synthetic patient identifier" : "Patient"}
        </p>
        <h2
          id="caring-contacts-patient-heading"
          className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-heading)]"
        >
          {name ?? patientId}
        </h2>
        {name === null ? null : (
          <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">Synthetic identifier: {patientId}</p>
        )}

        {/*
          Beside the name, not in a detail row below: the number is shown deliberately, so it sits
          where identity lives. Text, never a `tel:` link -- see the module note.

          A blank is the retention clearance's own value (`CLEARED_PATIENT_DETAIL`), exactly as a
          blank name is, so it is stated as "no number held" rather than rendered as an empty gap
          that a reader would have to interpret. `episode === null` is the role case and prints
          nothing at all here; the notice below says why.
        */}
        {episode === null ? null : (
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Mobile number: </span>
            {episode.patientMobileNumber === "" ? (
              "no number held for this episode"
            ) : (
              <>
                {episode.patientMobileNumber}{" "}
                <span className="text-xs">&mdash; invented, and nothing in this workspace is ever sent to it</span>
              </>
            )}
          </p>
        )}

        {episode === null ? (
          <div className="mt-3 min-w-0">
            <EpisodeNotPermittedNotice />
          </div>
        ) : null}
        {episode !== null && episode.patientName === "" ? (
          <div className="mt-3 min-w-0">
            <NoNameHeldNotice />
          </div>
        ) : null}

        {episode !== null && episode.patientIdentifiers.length > 0 ? (
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Other identifiers: </span>
            {episode.patientIdentifiers.join(", ")}
          </p>
        ) : null}
        {episode !== null && episode.culturalIdentity !== null ? (
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Cultural identity: </span>
            {episode.culturalIdentity}
          </p>
        ) : null}
        <p className="mt-2 max-w-[var(--measure)] text-xs leading-5 text-[color:var(--text-muted)]">
          This patient is invented, and so is every identifier and number held against them.
        </p>
      </section>

      <section aria-labelledby="caring-contacts-plan-heading" className={cardClass}>
        <h2 id="caring-contacts-plan-heading" className="text-base font-semibold text-[color:var(--text-heading)]">
          This plan
        </h2>
        <div data-testid="caring-contacts-plan-summary" className="mt-2 min-w-0">
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Plan: </span>
            {record.plan.id}
          </p>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Plan state: </span>
            {PLAN_STATE_LABELS[record.plan.state]}
          </p>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Outcome: </span>
            {PLAN_OUTCOME_LABELS[record.outcome]}
          </p>
          {/*
            Every date in the schedule hangs off the AWST discharge DAY, never off UTC and never
            off the first contact, so this is the anchor a clinician checks the rest against.
          */}
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Discharged: </span>
            {awstCalendarDay(record.dischargeAt)} (AWST)
          </p>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Ended: </span>
            {record.completedAt === null
              ? "not yet — this episode is still open"
              : `${awstCalendarDay(record.completedAt)} (AWST)`}
          </p>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Pathway version: </span>
            {record.pathwayVersionId}
          </p>
          {episode === null ? null : (
            <p className="text-sm leading-6 text-[color:var(--text-muted)]">
              <span className="font-medium text-[color:var(--text)]">Transport so far: </span>
              {plural(episode.counts.contactsSent, "message sent", "messages sent")}, of which{" "}
              {plural(episode.counts.contactsDelivered, "carries a delivery receipt", "carry a delivery receipt")}.
            </p>
          )}
        </div>

        {otherPlanCount > 0 ? (
          <p className="mt-3 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
            This team holds {plural(otherPlanCount, "other plan", "other plans")} for this patient.{" "}
            <Link
              href={CARING_CONTACTS_ROUTES.patients}
              data-internal-link="true"
              className="underline decoration-[color:var(--border-strong)] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              This team&rsquo;s plans
            </Link>{" "}
            lists them.
          </p>
        ) : null}

        {firstContact === undefined ? null : (
          <div data-testid="caring-contacts-first-contact" className="mt-3 min-w-0">
            <FirstContact record={record} episode={episode} firstContact={firstContact} />
          </div>
        )}
      </section>

      <section aria-labelledby="caring-contacts-schedule-heading" className={cardClass}>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2
              id="caring-contacts-schedule-heading"
              className="text-base font-semibold text-[color:var(--text-heading)]"
            >
              Twelve-month schedule
            </h2>
            {/*
              Counted from the plan's own entries every render (Ruling 98). The approved mockup
              says "10 contacts over 12 months"; that is true only while nothing is suppressed,
              and a plan whose first contact is discharge + 7 has nine sendable messages.
            */}
            <p
              data-testid="caring-contacts-schedule-summary"
              className="mt-2 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]"
            >
              {scheduleSummarySentence(summary)}
            </p>
          </div>
          {/*
            `label` is a destination NOUN, not an instruction: `UnavailableDestination` renders its
            screen-reader note as "<label> is not built yet."
          */}
          <UnavailableDestination
            id={`plan-detail-${record.plan.id}`}
            label={`The plan detail for ${record.plan.id}`}
            reason="Every message in this plan with the decisions still waiting on it, and the controls that change them."
            className="inline-flex min-h-tap min-w-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-medium text-[color:var(--text-muted)] sm:shrink-0"
          >
            <span className="truncate">Plan detail &mdash; {record.plan.id}</span>
          </UnavailableDestination>
        </div>

        <ul aria-label="Twelve-month schedule" className="mt-4 flex min-w-0 flex-col gap-3">
          {entries.map((entry) => (
            <ScheduleEntry key={entry.contact.id} entry={entry} plan={record} />
          ))}
        </ul>

        <p className="mt-4 max-w-[var(--measure)] text-xs leading-5 text-[color:var(--text-muted)]">
          A delivery receipt is what the message provider reported about the message. It says nothing about the patient,
          and nothing here is ever sent to a real number.
        </p>
      </section>

      <div>
        <BackToPatients />
      </div>
    </div>
  );
}

/**
 * The first contact date, and — when it is not the programme's usual day — why it moved.
 *
 * Ruling 96 puts the CONTROL on the review-and-activation screen (Tasks 7-9) and the DISPLAY here.
 * Spec 4.4 makes the display a contract: wherever an earlier decision has moved something, the
 * surface stating it must also state why, in plain words, where the reader is looking. So the
 * reason is rendered IN PLACE beside the date — a reason reachable only by hovering has not been
 * stated.
 *
 * THE REASON COMES FROM THE EPISODE, WHICH IS WHY THIS TAKES ONE (Ruling 105)
 * ---------------------------------------------------------------------------
 * It is free text a clinician wrote about this patient, so it is held with the name, the mobile
 * number and the identifiers, and released by the one read that releases those. It is deliberately
 * NOT on `PlanRecord`: that is what the caseload renders for every patient in the team, and a
 * clinical note has no business being fetched for a list screen. `record` therefore cannot answer
 * this question and `episode` can, which is exactly the shape the placement was chosen for.
 *
 * FOUR CASES, AND THEY ARE DIFFERENT FACTS (Ruling 108)
 * ----------------------------------------------------
 * A moved date with nothing beside it has more than one cause, and this screen states which one it
 * is holding rather than picking the tidiest:
 *
 *   * the date is the usual day — no reason was ever required, so none is missing;
 *   * a reason is held — show it, verbatim, beside the date;
 *   * the episode was not released to this role — the plan is visible and the person is not, so the
 *     reason is not this screen's to show and its absence says nothing about whether one exists;
 *   * the episode was released and holds no reason — either a retention clearance removed it with
 *     the rest of the patient detail, which this screen can tell from the blank name exactly as
 *     `NoNameHeldNotice` does, or the plan predates the reason being kept at all.
 *
 * That last case is real and will persist: plans created before this field existed hold null
 * forever, and no placeholder was migrated into them. It is stated as the record's own history, not
 * as a coordinator having failed to give a reason — one WAS required and given, because
 * `buildApprovedSchedule` refuses any offset other than discharge + 1 without a non-blank one.
 * There was simply nowhere to keep it.
 */
function FirstContact({
  record,
  episode,
  firstContact,
}: {
  record: PlanRecord;
  episode: Episode | null;
  firstContact: StoredContact;
}) {
  const day = firstContact.planned.calendarDay;
  const offset = calendarDaysBetween(awstCalendarDay(record.dischargeAt), day);

  if (offset === DEFAULT_FIRST_CONTACT_OFFSET_DAYS) {
    return (
      <p className="text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">First contact: </span>
        {day} (AWST) — the day after discharge, which is this programme&rsquo;s usual first contact.
      </p>
    );
  }

  const heading = "First contact moved from the usual day";
  const moved = `This plan's first contact is ${day}, ${plural(offset, "day", "days")} after discharge rather than the usual one.`;

  return (
    <>
      <p className="text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">First contact: </span>
        {day} (AWST)
      </p>
      <div
        role="note"
        aria-label={heading}
        className="mt-2 flex min-w-0 flex-col gap-1 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 forced-colors:border-[CanvasText]"
      >
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)]">
          <CalendarClock aria-hidden="true" className="size-icon-md shrink-0" />
          <span className="min-w-0">{heading}</span>
        </p>
        <FirstContactReason moved={moved} episode={episode} />
      </div>
    </>
  );
}

/**
 * The "Why" and "What changes it" pair inside the moved-first-contact note.
 *
 * Split out so each of the four cases is one branch returning one pair, rather than a nest of
 * conditionals inside the markup. The wording of each is the point of this component: they are four
 * different statements about what the record holds, and collapsing any two of them would make the
 * screen say something it does not know.
 */
function FirstContactReason({ moved, episode }: { moved: string; episode: Episode | null }) {
  const reason = episode === null ? null : episode.firstContactReason;

  // A reason is held. It is a clinician's own words, so it is rendered verbatim and attributed,
  // never paraphrased or summarised into the sentence around it.
  if (reason !== null) {
    return (
      <>
        <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
          <span className="font-medium text-[color:var(--text)]">Why: </span>
          {moved} The coordinator who created it gave this reason: &ldquo;{reason}&rdquo;
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
          <span className="font-medium text-[color:var(--text)]">What changes it: </span>
          Nothing on this screen. The date and its reason are set when the plan is created, and the rest of the
          twelve-month schedule hangs off the discharge day rather than off this date, so moving it moves this message
          alone.
        </p>
      </>
    );
  }

  // The role may list plans but may not read an episode, so the reason was never released to this
  // screen. Its absence is a fact about the ACTOR and says nothing about what the plan holds --
  // decided by the page from the actor, exactly as `EpisodeNotPermittedNotice` above is.
  if (episode === null) {
    return (
      <>
        <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
          <span className="font-medium text-[color:var(--text)]">Why: </span>
          {moved} A coordinator has to give a reason before a plan can be created with a moved first contact. That
          reason is part of this patient&rsquo;s record, which is not visible in the role you are acting in, so this
          screen is not showing it — that says nothing about whether one is held.
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
          <span className="font-medium text-[color:var(--text)]">What changes it: </span>
          Nothing on this screen, and there is no control for it anywhere in this workspace yet. The role this
          demonstration acts in is set outside the interface.
        </p>
      </>
    );
  }

  // The episode WAS released and holds no reason. A blank name is the retention clearance's own
  // value, and this screen may read it as the clearance for the same reason `NoNameHeldNotice`
  // does: an actor who may not read an episode receives no episode at all, so a blank name here can
  // only be the clearance.
  if (episode.patientName === "") {
    return (
      <>
        <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
          <span className="font-medium text-[color:var(--text)]">Why: </span>
          {moved} A coordinator has to give a reason before a plan can be created with a moved first contact, and one
          was given for this plan. A retention clearance has since removed it, along with the name, the mobile number,
          the identifiers and the cultural identity — the reason is a clinician&rsquo;s free text about this patient, so
          it is removed with the rest of them.
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
          <span className="font-medium text-[color:var(--text)]">What changes it: </span>
          Nothing, here or anywhere. A clearance is not reversible, and the date above is what the record still holds.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">Why: </span>
        {moved} A coordinator has to give a reason before a plan can be created with a moved first contact, and one was
        given for this plan. It is not held: this plan was created before reasons were kept with the plan, so there was
        nowhere to put it. Nobody failed to give one.
      </p>
      <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">What changes it: </span>
        Nothing, for this plan. Reasons given from now on are kept with the plan and shown here; an older plan cannot
        gain one after the fact, and inventing a sentence to fill the gap would be worse than the gap.
      </p>
    </>
  );
}

/**
 * One entry in the schedule: what it is, when it goes, and — if it will not go — why not.
 *
 * The explanation covers every state the domain classifies as `willNotBeSent`, not suppression
 * alone. Ruling 98 named only the absorbed Week 1, but a contact CANCELLED when a plan was
 * withdrawn or a death was recorded is just as much the system having acted on its own, and spec
 * 4.4 does not care which of them it is: a row reading "Caring contact · Cancelled" with nothing
 * beside it is the bare status chip that rule exists to prevent.
 *
 * `plan` is passed for one reason: a cancelled contact on a plan that has ENDED can be explained
 * exactly, while a cancelled contact on a plan still running cannot, and the row must not claim the
 * first when it is looking at the second.
 */
function ScheduleEntry({ entry, plan }: { entry: StoredContact; plan: PlanRecord }) {
  const explanation = notSentExplanation(entry, plan);

  return (
    <li className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3 forced-colors:border-[CanvasText]">
      <p className="min-w-0 text-sm font-semibold text-[color:var(--text-heading)]">
        {entry.planned.cadenceLabel} &middot; {entry.planned.calendarDay} (AWST)
      </p>
      <p className="mt-0.5 text-sm leading-6 text-[color:var(--text-muted)]">
        {MESSAGE_TYPE_LABELS[entry.planned.messageType]} &middot; {CONTACT_STATE_LABELS[entry.contact.state]}
      </p>
      {entry.planned.messageType === "closing" ? (
        <p className="mt-0.5 max-w-[var(--measure)] text-xs leading-5 text-[color:var(--text-muted)]">
          The last message in the plan. It closes the twelve months and is not one more caring contact.
        </p>
      ) : null}
      {explanation === null ? null : (
        <div className="mt-2 min-w-0">
          <AutomatedState
            state={CONTACT_STATE_LABELS[entry.contact.state]}
            because={explanation.because}
            changedBy={explanation.changedBy}
          />
        </div>
      )}
    </li>
  );
}

/**
 * The acting role may list plans but may not read an episode.
 *
 * Unreachable today and written anyway, on the same principle as `PatientsDirectory`'s names
 * notice: `permissions.ts` currently grants `generateClinicalRecordSummary` to exactly the roles
 * that hold `viewReferral`, so an actor who reached this screen with a plan in hand can always
 * read its episode. That is one grant edit away from being false, and a branch that cannot run
 * today is still read and still copied by the next screen. Nothing infers it from a missing
 * episode — the page decides it from the actor — so it cannot fire wrongly while it waits.
 */
function EpisodeNotPermittedNotice() {
  const heading = "This patient's record is not visible in this role";
  return (
    <div
      role="note"
      aria-label={heading}
      className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 forced-colors:border-[CanvasText]"
    >
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)]">
        <EyeOff aria-hidden="true" className="size-icon-md shrink-0" />
        <span className="min-w-0">{heading}</span>
      </p>
      <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">Why: </span>
        Reading a patient&rsquo;s record is not part of the role you are acting in. The plan and its schedule are below;
        who the plan is for is not, and this says nothing about what is held for them.
      </p>
      <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">What changes it: </span>
        Nothing on this screen, and there is no control for it anywhere in this workspace yet. The role this
        demonstration acts in is set outside the interface.
      </p>
    </div>
  );
}

/**
 * A released episode holding no name.
 *
 * `CLEARED_PATIENT_DETAIL` is what both stores write once a retention clearance is recorded, and
 * an emptied field IS the cleared value. This screen can name the cause where the directory could
 * not: an actor who may not read an episode receives no episode at all, so a blank name on an
 * episode that WAS released is the clearance rather than the role.
 */
function NoNameHeldNotice() {
  const heading = "No name is held for this patient";
  return (
    <div
      role="note"
      aria-label={heading}
      className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 forced-colors:border-[CanvasText]"
    >
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)]">
        <EyeOff aria-hidden="true" className="size-icon-md shrink-0" />
        <span className="min-w-0">{heading}</span>
      </p>
      <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">Why: </span>
        This episode holds no patient name, so the heading above is the synthetic identifier, and no mobile number is
        held for it either. A retention clearance removes the name, the mobile number, the identifiers and the cultural
        identity together once an episode has ended, and that is the one thing in this workspace that empties them.
      </p>
      <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">What changes it: </span>
        Nothing, here or anywhere. A clearance is not reversible, and the plan and its schedule below are what the
        record still holds.
      </p>
    </div>
  );
}

/**
 * What is true of this plan's schedule, said in plain words and never as a claim about the future
 * that the plan itself has already falsified.
 *
 * "Every one of them will be sent" was the first version, and a withdrawn plan made it false: the
 * sentence has to be derived from all three buckets, not from the absence of one of them. The
 * single-bucket wordings exist because "10 entries: 10 still to send." is arithmetic rather than a
 * sentence, and this is the line a clinician reads first.
 */
function scheduleSummarySentence(summary: StoredContactSummary): string {
  const entries = plural(summary.total, "entry", "entries");
  if (summary.total === 0) return "This plan holds no schedule entries.";
  if (summary.willNotBeSent === summary.total) return `${entries}, and none of them will be sent.`;
  if (summary.stillToSend === summary.total) return `${entries}, and every one of them is still to be sent.`;
  if (summary.alreadySent === summary.total) return `${entries}, and every one of them has been sent.`;

  const parts: string[] = [];
  if (summary.alreadySent > 0) parts.push(`${summary.alreadySent} already sent`);
  if (summary.stillToSend > 0) parts.push(`${summary.stillToSend} still to send`);
  if (summary.willNotBeSent > 0) parts.push(`${summary.willNotBeSent} that will not be sent`);
  const last = parts.pop() as string;
  return `${entries}: ${[...parts, `and ${last}`].join(", ")}.`;
}

/**
 * Why this message will not be sent, and what would change it — or null when it still will be.
 *
 * Every branch says only what this screen actually holds. A cancelled contact on an ENDED plan is
 * explained by the ending, which the record does carry; a cancelled contact on a plan still running
 * is not, and says so rather than inventing a cause. Neither claims a remedy that does not exist:
 * suppression by absorption is the one reversible case here, and it is the only one offered.
 */
function notSentExplanation(entry: StoredContact, plan: PlanRecord): { because: string; changedBy: string } | null {
  if (contactSendability(entry.contact.state) !== "willNotBeSent") return null;

  const finalAndNeverResent =
    "Nothing here. This message is final and is never sent later; the plan continues with the messages that remain.";

  if (entry.contact.state === "suppressed") {
    return entry.planned.suppressed?.reason === "absorbedByFirstContact"
      ? {
          because:
            "This message falls on the same calendar day as this plan's first contact, and two caring contacts must never land on one day, so the schedule kept one of them.",
          changedBy: "Choosing a different first-contact date for this plan puts this message back into the schedule.",
        }
      : {
          because: "The system marked this message suppressed, and this screen does not hold what caused that.",
          changedBy: finalAndNeverResent,
        };
  }

  if (entry.contact.state === "cancelled") {
    return {
      because: isTerminalOutcome(plan.outcome)
        ? `This plan ended (${PLAN_OUTCOME_LABELS[plan.outcome].toLowerCase()}), and the system cancelled every message that had not already gone out.`
        : // DEFENSIVE, and unreachable through any store write today (established in Task 6's
          // review). Every `{ type: "cancel" }` in the domain travels with a plan transition to
          // `cancelled` or `withdrawn`, and `applyDeathCorrection` deliberately leaves the plan
          // cancelled when it undoes one — so a cancelled contact on a plan still in progress has
          // no path that produces it. The branch stays because the alternative is asserting a
          // combination the types permit, and this wording is what the screen should say if a
          // future write ever creates one. Do not go hunting for the path: there isn't one.
          "The system cancelled this message, and this screen does not hold what caused that.",
      changedBy: finalAndNeverResent,
    };
  }

  return {
    because:
      "The window for sending this message closed without the message going out, so the system recorded it as missed.",
    changedBy: finalAndNeverResent,
  };
}

/** Whether the plan has ended. `"inProgress"` is the one outcome that is not an ending. */
function isTerminalOutcome(outcome: PlanOutcome): boolean {
  return outcome !== "inProgress";
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Whole calendar days from `from` to `to`, both AWST `YYYY-MM-DD`.
 *
 * UTC midnight is used purely as a cursor and never leaves this function, which is the same
 * technique `schedule.ts` uses for the arithmetic that produced these strings in the first place.
 * This does not re-derive the schedule: the days themselves come from the module that owns them,
 * and this only measures the distance between two of them so the screen can say "seven days after
 * discharge" instead of making a clinician subtract.
 */
function calendarDaysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MILLISECONDS_PER_DAY);
}
