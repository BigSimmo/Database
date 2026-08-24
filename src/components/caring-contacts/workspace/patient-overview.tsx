import { CalendarClock, EyeOff } from "lucide-react";
import Link from "next/link";

import { CARING_CONTACTS_ROUTES, patientPlanRoute } from "@/lib/caring-contacts-routes";
import { awstCalendarDay } from "@/lib/caring-contacts/clock";
import type { Episode } from "@/lib/caring-contacts/episode";
import type { ContactState, MessageType, PlanState } from "@/lib/caring-contacts/model";
import type { PatientNameProjection, PlanOutcome, PlanRecord, StoredContact } from "@/lib/caring-contacts/repository";

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
 * WHAT THE EPISODE VIEW SHOWS OF THE PERSON, AND WHAT IT WITHHOLDS
 * ---------------------------------------------------------------
 * `getEpisode` is the one read that releases the name, the mobile number, the identifiers and the
 * cultural identity together, and this is the one screen permitted to make it. Permitted is not
 * the same as obliged: the MOBILE NUMBER is deliberately never painted. Nothing a clinician does
 * on this screen needs it, the approved design does not show it, and a number on a rendered page
 * is a number in a screenshot, a printout and a browser cache. The name, the identifiers and the
 * cultural identity are shown, because they are what makes the record this person's rather than
 * somebody else's, and the cultural identity is what a caring-contact pathway is chosen against.
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
 * The moved first contact's RECORDED reason is a known gap rather than an omission: the domain
 * validates `firstContactReason` in `buildApprovedSchedule` and neither store persists it, so
 * there is nowhere for this screen to read it from. The note says exactly that rather than leaving
 * a moved date unexplained.
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
              <Link href={patientPlanRoute(patientId, record.plan.id)} data-internal-link="true" className={rowLinkClass}>
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
  const suppressedEntries = entries.filter((entry) => entry.contact.state === "suppressed");
  const sendable = entries.length - suppressedEntries.length;
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
          This patient is invented, and the mobile number this plan would use is deliberately not shown on this screen.
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
            <FirstContact record={record} firstContact={firstContact} />
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
              {suppressedEntries.length === 0
                ? `${plural(entries.length, "entry", "entries")}, and every one of them will be sent.`
                : `${plural(entries.length, "entry", "entries")}: ${sendable} that will be sent, and ${suppressedEntries.length} that will not.`}
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
            <ScheduleEntry key={entry.contact.id} entry={entry} />
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
 * The first contact date, and — when it is not the programme's usual day — the fact that it moved.
 *
 * Ruling 96 puts the CONTROL on the review-and-activation screen (Tasks 7-9) and the DISPLAY here.
 * Spec 4.4 makes the display a contract: wherever an earlier decision has moved something, the
 * surface stating it must also state why, in plain words, where the reader is looking.
 *
 * The recorded reason cannot be shown, and that is a real gap rather than an omission. A moved
 * first contact IMPLIES a reason was given: `buildApprovedSchedule` refuses any offset other than
 * discharge + 1 unless `firstContactReason` is non-blank. But neither store persists that string —
 * it is validated and discarded, reaching no field of `StoredPlan` and no column of
 * `caring_contacts.plans` — so there is nowhere for this screen to read it from. The note says
 * that, rather than leaving a moved date standing unexplained or inventing a place to keep it.
 */
function FirstContact({ record, firstContact }: { record: PlanRecord; firstContact: StoredContact }) {
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
        <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
          <span className="font-medium text-[color:var(--text)]">Why: </span>
          This plan&rsquo;s first contact is {day}, {plural(offset, "day", "days")} after discharge rather than the
          usual one. A coordinator has to give a reason before a plan can be created with a moved first contact, and one
          was given for this plan — but the reason is not kept with the plan, so this screen has nothing to show you.
        </p>
        <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
          <span className="font-medium text-[color:var(--text)]">What changes it: </span>
          Nothing on this screen. The reason is checked when the plan is created and then discarded, so there is nowhere
          for this screen to read it from. Keeping it with the plan is outstanding work on this prototype.
        </p>
      </div>
    </>
  );
}

/** One entry in the schedule: what it is, when it goes, and — if it will not go — why not. */
function ScheduleEntry({ entry }: { entry: StoredContact }) {
  const suppressed = entry.contact.state === "suppressed";
  const absorbed = entry.planned.suppressed?.reason === "absorbedByFirstContact";

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
      {suppressed ? (
        <div className="mt-2 min-w-0">
          <AutomatedState
            state="Suppressed"
            because={
              absorbed
                ? "This message falls on the same calendar day as this plan's first contact, and two caring contacts must never land on one day, so the schedule kept one of them."
                : "The system marked this message suppressed, and this screen does not hold what caused that."
            }
            changedBy={
              absorbed
                ? "Choosing a different first-contact date for this plan puts this message back into the schedule."
                : "Nothing here. A suppressed message is final and is never sent later; the plan continues with the messages that remain."
            }
          />
        </div>
      ) : null}
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
        This episode holds no patient name, so the heading above is the synthetic identifier. A retention clearance
        removes the name, the mobile number, the identifiers and the cultural identity together once an episode has
        ended, and that is the one thing in this workspace that empties them.
      </p>
      <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">What changes it: </span>
        Nothing, here or anywhere. A clearance is not reversible, and the plan and its schedule below are what the
        record still holds.
      </p>
    </div>
  );
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
