import { EyeOff, Search } from "lucide-react";
import Link from "next/link";

import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";
import { awstCalendarDay } from "@/lib/caring-contacts/clock";
import type { PlanState } from "@/lib/caring-contacts/model";
import type { PatientNameProjection, PlanRecord } from "@/lib/caring-contacts/repository";

import { AutomatedState } from "./automated-state";
import { ListEmptyState } from "./list-empty-state";
import { UnavailableDestination } from "./unavailable-destination";

/**
 * The team's caseload, as a list of PLANS rather than of people.
 *
 * What this screen may know, and why it is so little
 * -------------------------------------------------
 * A row is a `PlanRecord`, which carries no patient-identifying detail BY CONSTRUCTION, plus ONE
 * further field: the patient's name, read separately through `listPatientNames` (Ruling 91). That
 * read is its own repository method with its own capability check, and its return type holds a plan
 * id and a name -- so there is no mobile number, identifier list or ancestry for this screen to
 * leak, because there is nowhere in the value for one to be.
 *
 * `getEpisode` remains the read this screen must never make. It is the one that releases all four
 * identifying fields together, and a caseload showing one of them has no business pulling four.
 * Task 5 headed each row with the synthetic identifier for exactly that reason; the owner's answer
 * (Ruling 91) was to narrow the read rather than to widen the screen, and this is that read
 * consumed. The approved design's names and initials are honest again as a result.
 *
 * A row still SHOWS the synthetic identifier alongside the name. It is what distinguishes two
 * patients who share a name, it is what the row's detail control is named by, and it is the only
 * thing left to head a row with when no name comes back -- which happens for a plan a retention
 * clearance has already de-identified, and for a role that may list plans without holding
 * `viewPatientRecord`. The row never claims a name it was not given.
 *
 * THE TWO CAUSES OF A NAMELESS ROW ARE NOT SYMMETRIC, and the screen says the one it knows
 * ----------------------------------------------------------------------------------------
 * Per row, nothing here can tell a de-identified episode from a role restriction: both arrive as an
 * absent entry, and guessing between them would be a claim the data does not support.
 *
 * But "your role may not see names" is not a per-row fact at all. It is a fact about the ACTOR,
 * known with certainty and known globally, from the same one-line capability call the page already
 * makes for `mayViewPlans`. So it is stated ONCE, above the list, and every fallback row on that
 * render is explained without any inference. What is left is then unambiguous rather than merely
 * unexplained: a nameless row on a page that printed no such notice was de-identified.
 *
 * The distinction is clinical, not cosmetic. One is "ask for access"; the other is a fact about the
 * record, and no access will bring the name back.
 *
 * NO ROLE REACHES THE NOTICE TODAY, and it is written anyway. It needs a role holding `viewReferral`
 * WITHOUT `viewPatientRecord`, and `permissions.ts` currently grants those two such that every role
 * that can list plans can also see names -- the grant runs the other way round, which is exactly why
 * `PATIENT_NAME_READ_ACTIONS` is a conjunction. So this is an unreachable branch, pinned by a
 * component test that passes the prop directly, on the same principle as this page's null-release
 * guard: a branch that cannot run today is still read, is still copied by the next screen, and is
 * one grant edit away from running. Nothing infers it from an empty list, so it cannot fire wrongly
 * while it waits.
 *
 * Why the filter is a URL and not a client boundary
 * ------------------------------------------------
 * Ruling 13 holds this workspace's client payload to a rounding error. A `useState` search box
 * would put a client boundary under the first screen every later list screen copies. So the state
 * filter is a set of `<Link>`s that change the URL, the identifier search is an ordinary
 * `method="get"` form, and the page -- a Server Component -- reads `searchParams` and filters
 * before rendering. Nothing on this screen needs JavaScript to work, and it adds NO client
 * component the workspace did not already ship: the only one it renders is `UnavailableDestination`,
 * and the shell mounts `WorkspaceOverlays` (with `OverlayHost` beneath it) into every screen's tree
 * regardless.
 *
 * Ruling 94: that is the whole claim, and it is deliberately not a count. This paragraph twice
 * carried a tally of the workspace's client components — "one", then "five" — and both were wrong,
 * the second within the same round it corrected the first. The property that matters is the one
 * stated above and it is checkable per screen: THIS screen adds none.
 *
 * Why the row's detail control is not a link
 * -----------------------------------------
 * `patientRoute()` and `planRoute()` in `@/lib/caring-contacts-routes` are the hrefs these controls
 * take once Tasks 6-7 build those pages. Until then Ruling 52 applies exactly as it does in the
 * shell's navigation: an unbuilt destination is an unavailable control with a stated reason, never
 * a link into a route that would 404. Swapping the control for a `<Link href={patientRoute(...)}>`
 * is the whole of that later change.
 *
 * Three empty lists, three different facts
 * ---------------------------------------
 * `ListEmptyState` refuses to blur "nothing exists" and "a filter is hiding everything", and this
 * screen has a THIRD case the component's two kinds do not name: a role that may not view plans at
 * all. `listPlans` answers such an actor with `[]`, exactly as it answers a team with no plans, so
 * a screen that only counted rows would tell an auditor their team has no patients -- a false
 * statement about a caseload, which is the defect the component exists to prevent. The capability
 * is therefore decided from the actor by the page and passed in as `mayViewPlans`, and that case
 * gets the "filtered" wording shape (a reason and a remedy), because it is a visibility rule
 * hiding the list rather than a claim that the list is empty.
 */

const PLAN_STATE_LABELS: Readonly<Record<PlanState, string>> = Object.freeze({
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
  completed: "Completed",
});

/** Every plan state, in lifecycle order, as the filter offers them. */
const PLAN_STATE_ORDER: readonly PlanState[] = Object.freeze([
  "draft",
  "active",
  "paused",
  "completed",
  "withdrawn",
  "cancelled",
]);

export type PatientsDirectoryStateFilter = PlanState | "all";

export type PatientsDirectoryFilter = {
  /** The plan state the URL asks for, already validated; "all" when absent or unrecognised. */
  state: PatientsDirectoryStateFilter;
  /** The trimmed identifier search from the URL; "" when there is none. */
  query: string;
};

/** The one place a query value is turned into a filter -- never re-derived in a component. */
export function parsePatientsDirectoryFilter(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): PatientsDirectoryFilter {
  const rawState = searchParams.state;
  // A repeated `?state=a&state=b` arrives as an array and names no single state. Both that and an
  // unrecognised value fall back to "all" rather than throwing: a mistyped URL must widen the
  // list, never fail the render or hide a caseload behind an error page.
  const state: PatientsDirectoryStateFilter =
    typeof rawState === "string" && (PLAN_STATE_ORDER as readonly string[]).includes(rawState)
      ? (rawState as PlanState)
      : "all";

  const rawQuery = searchParams.q;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";

  return { state, query };
}

/** Every href on this screen is built from the route module, never from a path literal. */
export function patientsDirectoryHref(filter: PatientsDirectoryFilter): string {
  const params = new URLSearchParams();
  if (filter.state !== "all") params.set("state", filter.state);
  if (filter.query !== "") params.set("q", filter.query);
  const query = params.toString();
  return query === "" ? CARING_CONTACTS_ROUTES.patients : `${CARING_CONTACTS_ROUTES.patients}?${query}`;
}

/**
 * The search matches the patient's NAME as well as the three identifiers -- the approved design's
 * "name or synthetic ID" -- and it still runs entirely on the server. Nothing here becomes client
 * state: the form is still an ordinary GET, the URL is still the whole of the filter, and this
 * function is still called during the server render. Ruling 13 is untouched.
 *
 * `name` is empty for a row with no name to match, and an empty haystack segment can never make a
 * non-empty query match, so no row is found by a name it does not have.
 */
function matchesFilter(record: PlanRecord, name: string, filter: PatientsDirectoryFilter): boolean {
  if (filter.state !== "all" && record.plan.state !== filter.state) return false;
  if (filter.query === "") return true;
  const needle = filter.query.toLowerCase();
  return `${name} ${record.patientId} ${record.plan.id} ${record.referralId}`.toLowerCase().includes(needle);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * How many of a plan's contacts will not be sent because the system suppressed them.
 *
 * Keyed off the CONTACT's own state rather than off `planned.suppressed`. The two agree today,
 * because the only suppression that exists so far is the schedule absorbing Week 1 into the first
 * contact — but `applyContactTransition`'s `suppress` action can move any live contact to
 * `suppressed` later, and a contact suppressed that way carries no `planned.suppressed` marker.
 * Counting the plan rather than the outcome would have left those with no explanation at all,
 * which is the one thing spec 4.4 does not allow a system-reached state to have.
 */
function suppressedContactCount(record: PlanRecord): number {
  return record.contacts.filter((stored) => stored.contact.state === "suppressed").length;
}

/**
 * How many of a plan's suppressed contacts the SCHEDULE absorbed, rather than a later transition.
 *
 * A count, not a boolean. `hasAbsorbedContact` was the first shape and it produced the defect
 * N-2 names: the row subtracted EVERY suppressed contact from its message count while the
 * explanation branched on whether an absorbed one existed at all, so a plan carrying one absorbed
 * Week 1 message and one later `suppress` transition showed a count short by two beside a reason
 * accounting for one. That is the same blur keying the count off `contact.state` had just fixed,
 * one case further along, and it is reachable through `applyContactTransition`.
 *
 * The two causes are counted separately because they have DIFFERENT REMEDIES, which is the whole
 * of why spec 4.4 wants a reason stated in place: absorption is undone by choosing another
 * first-contact date, and a transition-suppressed contact is terminal and never sent.
 */
function absorbedContactCount(record: PlanRecord): number {
  return record.contacts.filter((stored) => stored.planned.suppressed?.reason === "absorbedByFirstContact").length;
}

/** The reason and the remedy for every contact this plan will not send, covering both causes. */
function suppressionExplanation(absorbed: number, other: number): { because: string; changedBy: string } {
  const absorbedBecause =
    "The Week 1 message falls on the same calendar day as this plan's first contact, and two caring contacts must never land on one day, so the schedule kept one of them.";
  const absorbedChangedBy =
    "Choosing a different first-contact date for this plan puts the Week 1 message back into the schedule.";
  const otherBecause = `The system marked ${plural(other, "message", "messages")} in this plan suppressed, and this row does not hold what caused that.`;
  const otherChangedBy = `Nothing here. A suppressed message is final and is never sent later; the plan continues with the messages that remain.`;

  if (absorbed > 0 && other > 0) {
    return {
      because: `Two separate things happened to this plan. ${absorbedBecause} ${otherBecause}`,
      changedBy: `${absorbedChangedBy} ${otherChangedBy}`,
    };
  }
  if (absorbed > 0) return { because: absorbedBecause, changedBy: absorbedChangedBy };
  return { because: otherBecause, changedBy: otherChangedBy };
}

const sectionId = "caring-contacts-patients-directory";
const searchInputId = "caring-contacts-patients-search";

const filterChipClass =
  "inline-flex min-h-tap min-w-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-medium text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] motion-reduce:transition-none aria-[current]:border-[color:var(--clinical-accent)] aria-[current]:text-[color:var(--text-heading)] forced-colors:border-[CanvasText]";

const fieldClass =
  "min-h-tap w-full min-w-0 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] pl-10 pr-3 text-sm text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const submitClass =
  "inline-flex min-h-tap shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-semibold text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border-[CanvasText]";

const rowActionClass =
  "inline-flex min-h-tap min-w-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-medium text-[color:var(--text-muted)] sm:shrink-0";

export type PatientsDirectoryProps = {
  /** Every plan the read released, unfiltered. The filter is applied here, not by the caller. */
  records: readonly PlanRecord[];
  /**
   * What `listPatientNames` released, in whatever order it came back -- a plan id and a name each,
   * and by its type nothing else. It is a separate prop rather than a field merged onto the records
   * so that the narrow read stays visibly narrow at every layer it passes through: a merged record
   * would be a widened `PlanRecord` in all but name, and the next screen would copy it.
   *
   * Shorter than `records` for a role that may list plans without holding `viewPatientRecord`, and
   * empty when that read released nothing. A missing entry is not an error; the row falls back.
   */
  patientNames: readonly PatientNameProjection[];
  filter: PatientsDirectoryFilter;
  /** False when the acting role does not include viewing plans -- see the module note. */
  mayViewPlans: boolean;
  /**
   * False when the acting role does not hold `viewPatientRecord`, decided by the page from the
   * actor rather than inferred here from an empty `patientNames`. Those two are NOT the same
   * question: a coordinator whose team holds only de-identified episodes also receives no names,
   * and telling that clinician their role is the reason would be false.
   */
  mayViewPatientNames: boolean;
};

export function PatientsDirectory({
  records,
  patientNames,
  filter,
  mayViewPlans,
  mayViewPatientNames,
}: PatientsDirectoryProps) {
  // A cleared plan's name is the empty string both stores write for a removed one, so it is dropped
  // here rather than at each row: an empty name is "no name held", never a name, and every reader
  // below asks the same map the same way.
  const nameByPlan = new Map(
    patientNames.filter((entry) => entry.patientName !== "").map((e) => [e.planId, e.patientName]),
  );
  const visible = mayViewPlans
    ? records.filter((record) => matchesFilter(record, nameByPlan.get(record.plan.id) ?? "", filter))
    : [];
  const filtering = filter.state !== "all" || filter.query !== "";

  return (
    <section aria-labelledby={`${sectionId}-heading`} className="min-w-0">
      <h2 id={`${sectionId}-heading`} className="text-base font-semibold text-[color:var(--text-heading)]">
        This team&rsquo;s plans
      </h2>
      <p className="mt-2 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        One row for each caring-contact plan this team holds. Every patient here is invented. A row carries a name and a
        synthetic identifier and nothing else about the person, because a caseload needs nothing else.
      </p>

      {mayViewPlans ? (
        <>
          {/*
            Deliberately a flat set of links rather than a `<ul>` of `<li>`s. The rows below are a
            real list, and a second list of filter chips made every chip an equal `listitem` to a
            patient's row — indistinguishable to a screen reader counting "8 items" on a caseload
            of two. The `<nav>` already names and groups these.
          */}
          <nav aria-label="Filter by plan state" className="mt-5 flex min-w-0 flex-wrap gap-2">
            <Link
              href={patientsDirectoryHref({ state: "all", query: filter.query })}
              data-internal-link="true"
              aria-current={filter.state === "all" ? "true" : undefined}
              className={filterChipClass}
            >
              All
            </Link>
            {PLAN_STATE_ORDER.map((state) => (
              <Link
                key={state}
                href={patientsDirectoryHref({ state, query: filter.query })}
                data-internal-link="true"
                aria-current={filter.state === state ? "true" : undefined}
                className={filterChipClass}
              >
                {PLAN_STATE_LABELS[state]}
              </Link>
            ))}
          </nav>

          {/*
            An ordinary GET form, not a controlled input: submitting it navigates to a new URL that
            the Server Component reads. That is the whole search mechanism, and it costs no client
            JavaScript at all. The state filter travels as a hidden field so searching cannot
            silently widen a filter the clinician set.
          */}
          <form
            method="get"
            action={CARING_CONTACTS_ROUTES.patients}
            role="search"
            className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
              {/*
                The control must not advertise something it cannot do. With no names released, a
                name search matches nothing on every row, so the label and the placeholder offer
                only what the search can actually find.
              */}
              <label htmlFor={searchInputId} className="sr-only">
                {mayViewPatientNames
                  ? "Search by name, or by synthetic patient, plan or referral identifier"
                  : "Search by synthetic patient, plan or referral identifier"}
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-icon-md -translate-y-1/2 text-[color:var(--text-muted)]"
              />
              <input
                id={searchInputId}
                type="search"
                name="q"
                defaultValue={filter.query}
                autoComplete="off"
                placeholder={mayViewPatientNames ? "Name or synthetic ID" : "Synthetic identifier"}
                className={fieldClass}
              />
            </div>
            {filter.state === "all" ? null : <input type="hidden" name="state" value={filter.state} />}
            <button type="submit" className={submitClass}>
              Search
            </button>
          </form>

          {mayViewPatientNames ? null : (
            <div className="mt-4 min-w-0">
              <NamesNotShownNotice />
            </div>
          )}

          {visible.length > 0 ? (
            <p className="mt-4 text-sm text-[color:var(--text-muted)]">
              Showing {plural(visible.length, "plan", "plans")} of {plural(records.length, "plan", "plans")} this team
              holds.
            </p>
          ) : null}
        </>
      ) : null}

      {visible.length > 0 ? (
        <ul className="mt-4 flex min-w-0 flex-col gap-3">
          {visible.map((record) => (
            <PatientRow key={record.plan.id} record={record} name={nameByPlan.get(record.plan.id) ?? null} />
          ))}
        </ul>
      ) : (
        <div className="mt-5 min-w-0">
          <DirectoryEmptyState records={records} filter={filter} filtering={filtering} mayViewPlans={mayViewPlans} />
        </div>
      )}
    </section>
  );
}

/**
 * Stated once, above the list, when the acting role does not hold `viewPatientRecord`.
 *
 * Local to this screen rather than a shared component, deliberately: it is the first surface in the
 * workspace that needs it, and one use is not a pattern. If a second screen needs the same notice it
 * should move to `workspace/` then, with both call sites visible to whoever generalises it.
 *
 * Not `AutomatedState`: that component is for a state the SYSTEM reached on its own -- suppressed,
 * paused, blocked -- and its `state` prop is documented as a closed transport or plan term. A role
 * restriction is neither. It borrows the same why/what-changes-it shape, because spec 4.4's reason
 * for that shape applies just as much here, and takes its accessible name from the string it
 * renders rather than an id, so this screen still ships no client component (Ruling 13).
 */
function NamesNotShownNotice() {
  const heading = "Names are not shown in this role";
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
        Viewing a patient record is not part of the role you are acting in, so every row below is headed by the
        patient&rsquo;s synthetic identifier rather than their name. This says nothing about whether a name is held for
        any of them.
      </p>
      <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        <span className="font-medium text-[color:var(--text)]">What changes it: </span>
        Nothing on this screen, and there is no control for it anywhere in this workspace yet. The role this
        demonstration acts in is set outside the interface; a coordinator sees the names.
      </p>
    </div>
  );
}

function DirectoryEmptyState({
  records,
  filter,
  filtering,
  mayViewPlans,
}: {
  records: readonly PlanRecord[];
  filter: PatientsDirectoryFilter;
  filtering: boolean;
  mayViewPlans: boolean;
}) {
  if (!mayViewPlans) {
    return (
      <ListEmptyState
        kind="not-permitted"
        heading="Plans are not visible in this role"
        because="Viewing plans is not part of the role you are acting in. This says nothing about how many plans this team holds: a read you may not make and a team holding none look identical on purpose, so that nobody can find out a record exists by being refused it."
        changedBy="Nothing on this screen changes it, and there is no control for it anywhere in this workspace yet. The role this demonstration acts in is set outside the interface; a coordinator sees this team's plans."
      />
    );
  }

  if (records.length === 0) {
    return (
      <ListEmptyState
        kind="no-data"
        heading="No patients yet"
        explanation="This team holds no caring-contact plan. A patient appears here once a coordinator accepts a referral and claims a plan for it."
      />
    );
  }

  if (filtering) {
    return (
      <ListEmptyState
        kind="filtered"
        heading="No patients match"
        because={hiddenBecause(records.length, filter)}
        changedBy={`Clearing the filter shows all ${plural(records.length, "plan", "plans")} this team holds.`}
        action={
          <Link href={CARING_CONTACTS_ROUTES.patients} data-internal-link="true" className={submitClass}>
            Show every plan
          </Link>
        }
      />
    );
  }

  // Unreachable in practice -- `visible` can only be shorter than `records` when something is
  // filtering -- but stated rather than left to fall through to nothing at all.
  return (
    <ListEmptyState
      kind="no-data"
      heading="No patients yet"
      explanation="This team holds no caring-contact plan. A patient appears here once a coordinator accepts a referral and claims a plan for it."
    />
  );
}

/** Plain words for exactly which of the two filters is hiding the list, and how much it is hiding. */
function hiddenBecause(total: number, filter: PatientsDirectoryFilter): string {
  const held = `the ${plural(total, "plan", "plans")} this team holds`;
  if (filter.state !== "all" && filter.query !== "") {
    return `The state filter is set to ${PLAN_STATE_LABELS[filter.state]} and the search is "${filter.query}". Nothing among ${held} satisfies both.`;
  }
  if (filter.state !== "all") {
    return `The state filter is set to ${PLAN_STATE_LABELS[filter.state]}, and none of ${held} is in that state.`;
  }
  return `The search for "${filter.query}" matches no name or identifier among ${held}.`;
}

/**
 * One plan's row.
 *
 * `name` is null when the names read held nothing for this plan -- a de-identified episode, or a
 * role without `viewPatientRecord`. The heading then falls back to the synthetic identifier and the
 * label above it says which of the two the heading is, so the row never presents an identifier as a
 * name or leaves a reader guessing. It deliberately does not try to say WHICH cause applies: the
 * screen is not told, and guessing between "this episode was de-identified" and "your role may not
 * see names" would be a claim nothing here can support.
 */
function PatientRow({ record, name }: { record: PlanRecord; name: string | null }) {
  const suppressed = suppressedContactCount(record);
  const absorbed = absorbedContactCount(record);
  // Every suppressed contact is subtracted from the count, so every suppressed contact must be
  // accounted for in the reason beside it. `absorbed` can never exceed `suppressed`: both stores
  // write an absorbed contact straight into the terminal `suppressed` state.
  const explanation = suppressionExplanation(absorbed, suppressed - absorbed);
  const scheduled = record.contacts.length - suppressed;

  return (
    <li className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 forced-colors:border-[CanvasText]">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
            {name === null ? "Synthetic patient identifier" : "Patient"}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-heading)]">
            {name ?? record.patientId}
          </h3>
          {/*
            Kept beside the name, not replaced by it. Two patients can share a name, the row's
            detail control is named by the identifier, and it is the identifier a clinician quotes
            when asking about a record.
          */}
          {name === null ? null : (
            <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">
              Synthetic identifier: {record.patientId}
            </p>
          )}
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Plan state: </span>
            {PLAN_STATE_LABELS[record.plan.state]}
          </p>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Discharged: </span>
            {awstCalendarDay(record.dischargeAt)} (AWST)
          </p>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Contacts: </span>
            {plural(scheduled, "message in the schedule", "messages in the schedule")}
          </p>
        </div>
        {/*
          `label` is a destination NOUN, not an instruction. `UnavailableDestination` builds its
          screen-reader note as "<label> is not built yet.", so a verb phrase there produced
          "Open patient-plan-1 is not built yet." The visible text carries the identifier so that
          one row's control is still distinguishable from the next.
        */}
        <UnavailableDestination
          id={`patient-row-${record.plan.id}`}
          label={`The patient record for ${record.patientId}`}
          reason="Every contact in this plan, what has been sent, and the decisions still waiting."
          className={rowActionClass}
        >
          <span className="truncate">Patient record &mdash; {record.patientId}</span>
        </UnavailableDestination>
      </div>

      {/*
        Spec 4.4: a state the system reached on its own must state, in place, why and what would
        change it. A suppressed contact is one the system decided not to send, and the row would
        otherwise show a smaller message count with no reachable reason for it.

        Two causes exist, they have different remedies, and a plan can carry BOTH — so the reason
        covers whichever are actually present rather than picking one. The schedule absorbing Week 1
        into the first contact is reversible by the coordinator; any other suppression is terminal
        (`suppressed` is in the contact model's terminal set) and this row does not hold what caused
        it, so it says that rather than inventing a remedy or naming a screen that does not exist.
      */}
      {suppressed > 0 ? (
        <div className="mt-3 min-w-0">
          <AutomatedState state="Suppressed" because={explanation.because} changedBy={explanation.changedBy} />
        </div>
      ) : null}
    </li>
  );
}
