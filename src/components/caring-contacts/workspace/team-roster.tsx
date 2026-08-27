import { Info, Users } from "lucide-react";
import Link from "next/link";

import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";
import { toAwstParts } from "@/lib/caring-contacts/clock";
import type { PlanSendingHold } from "@/lib/caring-contacts/schedule-view";
import type { CoordinatorWorkload, TeamWorkloadView, UnclaimedWork } from "@/lib/caring-contacts/team-workload";

import { AutomatedState } from "./automated-state";
import { ListEmptyState } from "./list-empty-state";

/**
 * Where this team's caring-contact work is sitting -- the Team screen's body (Phase 2B Task 18).
 *
 * A SERVER COMPONENT. It holds no state, takes every figure it renders as a prop, and adds no
 * client payload. The one control it renders is a `<Link>`, which needs no client boundary.
 *
 * IT SHOWS WHERE WORK IS AND NEVER WHO IS BETTER OR WORSE (spec §4.2). The domain read holds that
 * as a constraint on its own shape; this screen has to hold it as a constraint on the rendering,
 * because a shape with no ranking in it can still be rendered as one:
 *
 *   * rows are drawn in the order the read gave them, which is ascending actor id and nothing else.
 *     The screen says so on itself, so a reader is not left to infer what an order means;
 *   * no total, share, percentile or placing is computed here -- there is nothing on this screen a
 *     row could be divided by, and none is added;
 *   * nothing is coloured as a grade. The one place a tint appears is the escalation, which is a
 *     statement about work nobody has claimed, and it carries its words and its icon with it.
 *
 * WHAT IT DOES NOT RENDER, and in each case because nothing in this system holds it. Task 17
 * measured all three against the tree rather than inferring them, and each is a finding reported to
 * the owner rather than a gap filled in by a screen:
 *
 *   * A STAFF NAME. The stores hold an `ActorId` and nothing else about a person; the approved
 *     design's roster shows a display name, and a staff directory is a system this build is not
 *     connected to. So the identifier is rendered AS an identifier -- monospaced, verbatim, never
 *     resolved into words -- and the screen states that no name is held rather than leaving a
 *     clinician to wonder what they are looking at.
 *   * A ROLE. Nothing returns the roles an `ActorId` holds, so the design's Role column has no
 *     source and there is none here. That also settles the raw-role-identifier rule the easy way:
 *     an actor id shaped `demo-<role>` is still an identifier and is rendered as one, so the
 *     interface-vocabulary scan's known word-boundary hole is not reached, let alone exploited.
 *   * A PER-MEMBER UNCLAIMED COUNT. Unclaimed means there is no owner to file the work under, so a
 *     per-person figure has no referent at all. The design's unclaimed ROW is what those numbers
 *     belong to, and it is produced in full -- once, above both renderings, rather than twice
 *     inside them: its figures are not owner-shaped, so forcing them into owner-shaped columns
 *     would be the same false statement drawn twice.
 *
 * TWO RENDERINGS, ONE SET OF FIGURES. The approved design is a table at desktop widths and a
 * roster of cards below them, and both are in the document with one hidden -- so every figure is
 * read from the same `view` and neither can drift from the other. A test that reaches for a figure
 * scopes itself to one of the two.
 */
export type TeamRosterProps = {
  readonly view: TeamWorkloadView;
  /**
   * Whether the acting role may see this team's plans at all.
   *
   * `listPlans` answers a role without the capability with `[]`, exactly as it answers a team
   * carrying nothing, so an empty roster says two different things and the screen must be told
   * which. Counting rows cannot tell them apart, and guessing wrong tells an auditor a clinical
   * service is idle.
   */
  readonly mayViewPlans: boolean;
  /** Whether the acting role may move a plan to another coordinator. */
  readonly mayReassignPlan: boolean;
};

const sectionClass =
  "overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)]";

const cellClass = "px-4 py-3 align-top text-sm text-[color:var(--text)]";

const identifierClass = "font-mono text-sm break-all text-[color:var(--text-heading)]";

const noteClass = "max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]";

/** The id the "Reassign work" control points its description at. A constant, so no `useId` hook is
 *  needed and this stays a Server Component; the screen renders one such control. */
const REASSIGN_NOTE_ID = "caring-contacts-team-reassign-note";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Plain words for what a plan's own state is doing to it.
 *
 * An exhaustive switch rather than a lookup with a fallback: a fourth hold added to the domain and
 * left unworded here must stop compiling rather than render a silent blank in a cell whose whole
 * job is to say why a plan is not sending.
 *
 * `planEnded` is unreachable through this screen -- `buildTeamWorkload` drops ended plans before
 * any measure, so no `heldPlans` entry can carry it -- but the union admits it, so it is worded
 * rather than assumed away. The Schedule screen words the same three holds for its own question,
 * in its own sentences; these are labels for a count, and one file's wording is not the other's.
 */
function holdLabel(hold: PlanSendingHold): string {
  switch (hold) {
    case "planNotStarted":
      return "Plan not started";
    case "planPaused":
      return "Plan paused";
    case "planEnded":
      return "Plan ended";
    default: {
      const unclassified: never = hold;
      return unclassified;
    }
  }
}

/**
 * What ends the unclaimed state, in plain words.
 *
 * Exhaustive over the domain's own `clearedBy`, which is `null` only when there is nothing to
 * clear. The screen never invents a remedy: a remedy that does not exist is worse than none,
 * because the reader will go looking for it.
 */
function clearedByWording(clearedBy: UnclaimedWork["clearedBy"]): string | null {
  switch (clearedBy) {
    case "aCoordinatorClaimsThePlan":
      return "A coordinator claiming the plan clears it. Time passing does not.";
    case null:
      return null;
    default: {
      const unclassified: never = clearedBy;
      return unclassified;
    }
  }
}

/**
 * What the oldest unclaimed plan's figure actually is.
 *
 * IT IS NOT HOW LONG THE PLAN HAS BEEN UNCLAIMED, and the sentence must not say that it is. The
 * only anchor the domain has for an unclaimed plan is `PlanRecord.dischargeAt`, which is not an
 * observed instant: the wizard writes it as `DISCHARGE_WALL_CLOCK_HOUR` -- midday -- on the
 * calendar day a coordinator typed, a display convention whose own author recorded that nothing in
 * the domain used its time of day. So a plan activated at 08:00 on its discharge day and left
 * unclaimed reports ZERO all morning, and a plan whose discharge was backdated reports days. The
 * figure bounds the true wait in neither direction, and the sentence therefore names the anchor
 * and claims nothing else. See `UNCLAIMED_ANCHOR_NOTE` for what the reader is told about it.
 */
function unclaimedAgeSentence(minutes: number | null): string | null {
  if (minutes === null) return null;
  return `The oldest is ${plural(minutes, "minute", "minutes")} past the discharge recorded on its plan.`;
}

/**
 * What the unclaimed minutes are counted from, said wherever they are shown.
 *
 * THIS REPLACED A FALSE ASSURANCE. The screen used to tell a clinician that "the true wait is never
 * longer than the figure shown", which is the one failure that actually occurs: the escalation
 * cannot raise before the anchor is passed, however long a plan has really been unowned. Stating a
 * bound the code does not hold is worse than stating no bound, so the claim is retracted and the
 * measurement is described instead.
 *
 * It is shown in all three unclaimed states, for the reason the threshold is: a rule a reader can
 * only discover by tripping it is a rule they cannot plan around.
 *
 * It does not name midday, because it cannot say that truthfully of every plan -- the demo seed
 * records a discharge at the seeding instant rather than through the wizard's convention. What is
 * true of every plan is that the anchor is a recorded discharge and not the moment the work became
 * available, and that is what it says.
 */
const UNCLAIMED_ANCHOR_NOTE =
  "These minutes are counted from the discharge recorded on the plan, because nothing records when a plan became free for a coordinator to take. A plan can therefore show fewer minutes than it has been unclaimed, and reach the threshold later than it should.";

/**
 * Where a covered plan's work stays filed, said only while somebody is covering.
 *
 * `buildTeamWorkload` pushes a plan's active count, its holds and its contacts needing review onto
 * the tally of its NAMED OWNER and onto nobody else's -- coverage never moves ownership. That is a
 * defensible choice and it keeps the named coordinator visible, but its consequence is not
 * self-evident on a table: while a coordinator is away, their exception backlog sits in the row of
 * the person who is not answering, and the person covering reads as carrying none of it.
 *
 * The second sentence is the same fact from the other side -- a coordinator who owns nothing and is
 * only covering shows `Plans sending: 0`, which is true and understates what they are holding.
 *
 * It says nothing about WHICH plans or WHOSE backlog, because the read carries neither: a sentence
 * naming a specific backlog would be a claim this screen has no data for.
 */
const COVERAGE_ATTRIBUTION_NOTE =
  "While a plan is covered, the plan and its contacts needing review stay counted against the coordinator who owns it, not against whoever is covering. A coordinator who owns nothing and is only covering therefore shows no plans of their own.";

const WEEKDAY_NAMES = Object.freeze(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);

const MONTH_NAMES = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

/**
 * The instant every figure was measured to, in words a clinician reads.
 *
 * This screen used to print `2026-08-30T11:00:00+08:00` as body text -- the only machine timestamp
 * rendered to a reader anywhere in the workspace. The machine-readable value is still carried, on
 * the `<time>` element's `dateTime` attribute, which is where a machine reads it.
 *
 * Weekday and month names are written out rather than formatted by `Intl`, which is the Schedule
 * screen's convention and its reason: `Intl.DateTimeFormat`'s output depends on the ICU data the
 * runtime was built with, down to whether a comma follows the weekday, so a screen's date wording
 * would differ between a test, CI and the machine of whoever reads it. The two name arrays are a
 * second copy of that screen's, deliberately: importing them from `schedule-screen.tsx` would pull
 * that module's whole component graph into this Server Component's build for two lists of English
 * words that cannot change meaning.
 */
function measuredAtWording(asAtIso: string): string {
  const { year, month, day, hour, minute } = toAwstParts(new Date(asAtIso));
  const weekday = WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const suffix = hour < 12 ? "am" : "pm";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${String(minute).padStart(2, "0")} ${suffix} AWST on ${weekday} ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** Contacts somebody has to look at on plans nobody owns. Never omitted, so an exception cannot go
 *  uncounted for want of an owner to file it under. */
function unclaimedBacklogSentence(backlog: UnclaimedWork["exceptionBacklog"]): string {
  if (backlog.contacts === 0) return "No contact needs review on a plan nobody owns.";
  const oldest =
    backlog.oldestMinutesSinceScheduledSend === null
      ? ""
      : ` The oldest has waited ${plural(backlog.oldestMinutesSinceScheduledSend, "minute", "minutes")} since its scheduled send.`;
  return `${plural(backlog.contacts, "contact needs", "contacts need")} review on plans nobody owns.${oldest}`;
}

/**
 * Work no coordinator has taken responsibility for, and what the system did about it.
 *
 * SPEC §4.4 IS WHY THIS IS SHAPED THE WAY IT IS. The escalation is the one place on this screen
 * where the system acted on its own, so the escalated case is an `AutomatedState`: the state, the
 * reason it was reached, and what would change it, in one named region a screen reader enters
 * together. The other two cases are not automated acts -- nothing has been done -- so they are
 * stated plainly rather than dressed as automation, and they still carry the threshold and the
 * remedy, because a reader looking at unclaimed work needs both whichever side of the line it is on.
 */
function UnclaimedStanding({ unclaimed, thresholdMinutes }: { unclaimed: UnclaimedWork; thresholdMinutes: number }) {
  const remedy = clearedByWording(unclaimed.clearedBy);
  const age = unclaimedAgeSentence(unclaimed.oldestMinutesSinceDischarge);

  if (unclaimed.state === "escalated") {
    return (
      <div className={`${sectionClass} p-4`} data-testid="caring-contacts-team-unclaimed">
        <AutomatedState
          state="Unclaimed work escalated"
          because={[
            `Work with no coordinator escalates at ${thresholdMinutes} minutes.`,
            `${plural(unclaimed.escalated, "plan", "plans")} of the ${plural(unclaimed.plans, "plan", "plans")} nobody has claimed ${unclaimed.escalated === 1 ? "has" : "have"} reached that threshold.`,
            age,
            UNCLAIMED_ANCHOR_NOTE,
          ]
            .filter((part): part is string => part !== null)
            .join(" ")}
          changedBy={remedy ?? "Nothing on this screen."}
        />
        <p className={`mt-3 ${noteClass}`}>{unclaimedBacklogSentence(unclaimed.exceptionBacklog)}</p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="caring-contacts-team-unclaimed-heading"
      className={`${sectionClass} p-4`}
      data-testid="caring-contacts-team-unclaimed"
    >
      <h2
        id="caring-contacts-team-unclaimed-heading"
        className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)]"
      >
        <Users aria-hidden="true" className="size-icon-md shrink-0" />
        Unclaimed work
      </h2>
      {unclaimed.state === "noUnclaimedWork" ? (
        <p className={`mt-2 ${noteClass}`}>
          Every plan that is running has a coordinator. Work with no coordinator escalates once it has waited{" "}
          {thresholdMinutes} minutes.
        </p>
      ) : (
        <p className={`mt-2 ${noteClass}`}>
          {plural(unclaimed.plans, "plan has", "plans have")} no coordinator.{age === null ? "" : ` ${age}`} None of it
          has reached the {thresholdMinutes} minutes at which work with no coordinator escalates.
        </p>
      )}
      <p className={`mt-2 ${noteClass}`}>{UNCLAIMED_ANCHOR_NOTE}</p>
      {remedy === null ? null : <p className={`mt-2 ${noteClass}`}>{remedy}</p>}
      <p className={`mt-2 ${noteClass}`}>{unclaimedBacklogSentence(unclaimed.exceptionBacklog)}</p>
    </section>
  );
}

/** Owned plans held by their own plan state, one line per hold. Holds with none are omitted by the
 *  read itself, so an empty list means no plan of this coordinator's is held. */
function HeldPlans({ held }: { held: CoordinatorWorkload["heldPlans"] }) {
  if (held.length === 0) return <>None</>;
  return (
    <ul className="flex flex-col gap-1">
      {held.map((entry) => (
        <li key={entry.hold} className="min-w-0">
          {holdLabel(entry.hold)} · <span className="tabular-nums">{entry.plans}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Who is answering for this coordinator's plans, and whose plans they are answering for.
 *
 * Both directions, because they are different facts and a roster that showed only one would hide
 * half of a handover. Coverage never moves ownership, so the named coordinator's own counts are
 * untouched by either line.
 */
function Coverage({ workload }: { workload: CoordinatorWorkload }) {
  const lines: string[] = [];
  if (workload.coveredByAnother > 0) {
    lines.push(`${plural(workload.coveredByAnother, "plan is", "plans are")} being covered by someone else`);
  }
  if (workload.coveringForAnother > 0) {
    lines.push(`Covering ${plural(workload.coveringForAnother, "plan", "plans")} for someone else`);
  }
  if (lines.length === 0) return <>None</>;
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((line) => (
        <li key={line} className="min-w-0">
          {line}
        </li>
      ))}
    </ul>
  );
}

/** Contacts this coordinator has to look at, and how long the oldest has been there. `null` is not
 *  an age of zero and is never rendered as one. */
function Backlog({ backlog }: { backlog: CoordinatorWorkload["exceptionBacklog"] }) {
  if (backlog.contacts === 0) return <>None</>;
  return (
    <>
      <span className="tabular-nums">{plural(backlog.contacts, "contact", "contacts")}</span>
      {backlog.oldestMinutesSinceScheduledSend === null ? null : (
        <span className="mt-1 block text-[color:var(--text-muted)]">
          Oldest {plural(backlog.oldestMinutesSinceScheduledSend, "minute", "minutes")} since its scheduled send
        </span>
      )}
    </>
  );
}

const COLUMNS = ["Coordinator", "Plans sending", "Plans held", "Coverage", "Contacts needing review"] as const;

/** The desktop ownership table. Its own horizontal scroll container, so a narrow desktop scrolls
 *  the table rather than the page. */
function OwnershipTable({ coordinators }: { coordinators: readonly CoordinatorWorkload[] }) {
  return (
    <div
      className={`${sectionClass} hidden overflow-x-auto md:block`}
      data-testid="caring-contacts-team-table"
      tabIndex={0}
      role="region"
      aria-label="Team ownership"
    >
      <table className="w-full min-w-[44rem] border-collapse text-left">
        <thead className="bg-[color:var(--surface-subtle)] text-xs text-[color:var(--text-muted)]">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className="px-4 py-3 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--border)]">
          {coordinators.map((workload) => (
            <tr key={workload.actorId} data-testid="caring-contacts-team-row">
              <th scope="row" className={`${cellClass} font-normal`}>
                <span className={identifierClass} data-testid="caring-contacts-team-actor">
                  {workload.actorId}
                </span>
              </th>
              <td className={`${cellClass} tabular-nums`} data-testid="caring-contacts-team-active">
                {workload.activePlans}
              </td>
              <td className={cellClass} data-testid="caring-contacts-team-held">
                <HeldPlans held={workload.heldPlans} />
              </td>
              <td className={cellClass} data-testid="caring-contacts-team-coverage">
                <Coverage workload={workload} />
              </td>
              <td className={cellClass} data-testid="caring-contacts-team-backlog">
                <Backlog backlog={workload.exceptionBacklog} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The compact roster: the same figures, one card per coordinator, at widths with no room for a
 *  five-column table. */
function CompactRoster({ coordinators }: { coordinators: readonly CoordinatorWorkload[] }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden" data-testid="caring-contacts-team-roster">
      {coordinators.map((workload) => (
        <li key={workload.actorId} className={`${sectionClass} p-4`} data-testid="caring-contacts-team-roster-entry">
          <p className={identifierClass} data-testid="caring-contacts-team-actor">
            {workload.actorId}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <dt className="text-xs text-[color:var(--text-muted)]">Plans sending</dt>
              <dd
                className="mt-1 font-semibold tabular-nums text-[color:var(--text-heading)]"
                data-testid="caring-contacts-team-active"
              >
                {workload.activePlans}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-[color:var(--text-muted)]">Plans held</dt>
              <dd className="mt-1 text-[color:var(--text)]" data-testid="caring-contacts-team-held">
                <HeldPlans held={workload.heldPlans} />
              </dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-[color:var(--text-muted)]">Coverage</dt>
              <dd className="mt-1 text-[color:var(--text)]" data-testid="caring-contacts-team-coverage">
                <Coverage workload={workload} />
              </dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-[color:var(--text-muted)]">Contacts needing review</dt>
              <dd className="mt-1 text-[color:var(--text)]" data-testid="caring-contacts-team-backlog">
                <Backlog backlog={workload.exceptionBacklog} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

/**
 * The "Reassign work" control.
 *
 * IT IS A LINK TO THE CASELOAD, AND THAT IS THE HONEST SHAPE RATHER THAN A CONVENIENCE. The
 * reassignment overlay is already built and already wired, on `plan-actions.tsx`, where it belongs:
 * a reassignment names ONE plan, a destination and a reason. This roster deliberately carries no
 * plan id -- a roster that carried them would be a caseload read wearing a roster's name -- so
 * there is no plan for a control here to move, and inventing one is not available. The two honest
 * options were a control that states it cannot act, and a control that takes the reader to the
 * surface where the action does exist. The action EXISTS, so a "coming soon" control would be a
 * false statement about the product, and the link is the true one.
 *
 * The reason is rendered as visible text the control points at with `aria-describedby`, never held
 * in a `title` -- a reason a keyboard user reaches only by hovering is a reason they cannot reach.
 */
function ReassignWork({ mayReassignPlan }: { mayReassignPlan: boolean }) {
  if (!mayReassignPlan) {
    return (
      <p className={noteClass}>
        Moving a plan to another coordinator is not available in this role, so no control for it is offered here.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Link
        href={CARING_CONTACTS_ROUTES.patients}
        data-internal-link="true"
        data-testid="caring-contacts-team-reassign"
        aria-describedby={REASSIGN_NOTE_ID}
        className="inline-flex min-h-tap w-fit min-w-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-semibold text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border"
      >
        <Users aria-hidden="true" className="size-icon-md shrink-0" />
        <span className="truncate">Reassign work</span>
      </Link>
      <p id={REASSIGN_NOTE_ID} className={noteClass}>
        Reassignment is done on one plan at a time, from that patient&apos;s record, because it needs a plan, a
        destination and a reason. This opens the caseload, where you choose the plan to move.
      </p>
    </div>
  );
}

export function TeamRoster({ view, mayViewPlans, mayReassignPlan }: TeamRosterProps) {
  return (
    <div className="min-w-0 space-y-5" data-testid="caring-contacts-team">
      <p className={noteClass}>
        This is where the team&apos;s work is sitting. It is an operational view of work and never a comparison between
        people: coordinators appear in identifier order, which is not a placing, and no figure here is a measure of a
        person.
      </p>

      {/*
        THE CAPABILITY GATES THE FIGURES, NOT ONLY THE ROSTER. `listPlans` answers a role without
        the capability with `[]`, so `buildTeamWorkload` hands this screen a view in which nothing
        is unclaimed and nobody is carrying anything -- which is a true reading of an empty list and
        a FALSE statement about the service. So the unclaimed standing is withheld with the roster
        rather than rendered from figures the reader was never shown the input to.
      */}
      {!mayViewPlans ? (
        <>
          <ListEmptyState
            kind="not-permitted"
            heading="Plans are not visible in this role"
            because="This role may not see this team's plans, so this screen can say nothing about how much work the team is carrying — including whether any of it is unclaimed."
            changedBy="Nothing on this screen. A role that may read plans sees the roster here."
          />
          <ReassignWork mayReassignPlan={mayReassignPlan} />
        </>
      ) : (
        <>
          <UnclaimedStanding unclaimed={view.unclaimed} thresholdMinutes={view.thresholdMinutes} />

          <ReassignWork mayReassignPlan={mayReassignPlan} />

          {view.coordinators.length === 0 ? (
            <ListEmptyState
              kind="no-data"
              heading="Nobody is carrying work"
              explanation="No plan that is still running has a coordinator answering for it. A row appears here as soon as someone claims a plan, or covers one."
            />
          ) : (
            <>
              <OwnershipTable coordinators={view.coordinators} />
              <CompactRoster coordinators={view.coordinators} />
              {view.coordinators.some((row) => row.coveredByAnother > 0 || row.coveringForAnother > 0) ? (
                <p className={noteClass}>{COVERAGE_ATTRIBUTION_NOTE}</p>
              ) : null}
            </>
          )}
        </>
      )}

      <div className="flex items-start gap-3 border-t border-[color:var(--border)] pt-5">
        <Info aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--text-muted)]" />
        <div className="flex flex-col gap-2">
          <p className={noteClass}>
            This system holds no name for a member of staff, and no role for anyone but you, so each coordinator appears
            as the identifier their work is filed under.
          </p>
          <p className={noteClass}>
            Each age above is counted from something this system does record — the discharge on the plan, or the
            contact&apos;s scheduled send — because it records nothing about when the work started waiting. Neither
            figure is the true wait, and neither puts a limit on it.
          </p>
          <p className={noteClass}>
            A row appears for someone who owns or is covering a plan that has not ended, so this is who is carrying work
            rather than who is on the team. Measured at{" "}
            <time dateTime={view.asAtIso}>{measuredAtWording(view.asAtIso)}</time>.
          </p>
        </div>
      </div>
    </div>
  );
}
