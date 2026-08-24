import { Search } from "lucide-react";
import Link from "next/link";

import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";
import { awstCalendarDay } from "@/lib/caring-contacts/clock";
import type { PlanState } from "@/lib/caring-contacts/model";
import type { PlanRecord } from "@/lib/caring-contacts/repository";

import { AutomatedState } from "./automated-state";
import { ListEmptyState } from "./list-empty-state";
import { UnavailableDestination } from "./unavailable-destination";

/**
 * The team's caseload, as a list of PLANS rather than of people.
 *
 * What this screen may know, and why it is so little
 * -------------------------------------------------
 * Every row here is a `PlanRecord`, which carries no patient-identifying detail BY CONSTRUCTION --
 * no name, no mobile number, no identifiers, no cultural identity. `getEpisode` is the only read
 * in this domain that releases those, and a directory does not need them, so this screen never
 * calls it and has no place to put one if it did. A row is therefore named by the patient's
 * synthetic identifier, which is what the store releases to a list read.
 *
 * That is a deliberate departure from the approved mockup (`PatientsDirectoryPage` in
 * `src/components/caring-contacts/mockups/product-pages.tsx`), which shows fictional patient names
 * and initials. The mockup is design scratch working from invented rows, not from the store's
 * release rules; reconciling the two is the owner's call, and it is raised in the Task 5 report
 * rather than settled here by reaching for a wider read.
 *
 * Why the filter is a URL and not a client boundary
 * ------------------------------------------------
 * Ruling 13 holds this workspace's client payload to a rounding error. A `useState` search box
 * would put a client boundary under the first screen every later list screen copies. So the state
 * filter is a set of `<Link>`s that change the URL, the identifier search is an ordinary
 * `method="get"` form, and the page -- a Server Component -- reads `searchParams` and filters
 * before rendering. Nothing here needs JavaScript to work, and the only client component in the
 * tree is `UnavailableDestination`, which was already the workspace's only one.
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

function matchesFilter(record: PlanRecord, filter: PatientsDirectoryFilter): boolean {
  if (filter.state !== "all" && record.plan.state !== filter.state) return false;
  if (filter.query === "") return true;
  const needle = filter.query.toLowerCase();
  return `${record.patientId} ${record.plan.id} ${record.referralId}`.toLowerCase().includes(needle);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** How many of a plan's contacts the schedule itself decided not to send. */
function absorbedContactCount(record: PlanRecord): number {
  return record.contacts.filter((stored) => stored.planned.suppressed?.reason === "absorbedByFirstContact").length;
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
  filter: PatientsDirectoryFilter;
  /** False when the acting role does not include viewing plans -- see the module note. */
  mayViewPlans: boolean;
};

export function PatientsDirectory({ records, filter, mayViewPlans }: PatientsDirectoryProps) {
  const visible = mayViewPlans ? records.filter((record) => matchesFilter(record, filter)) : [];
  const filtering = filter.state !== "all" || filter.query !== "";

  return (
    <section aria-labelledby={`${sectionId}-heading`} className="min-w-0">
      <h2 id={`${sectionId}-heading`} className="text-base font-semibold text-[color:var(--text-heading)]">
        This team&rsquo;s plans
      </h2>
      <p className="mt-2 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
        One row for each caring-contact plan this team holds. Every patient here is invented, and a row names a
        patient only by their synthetic identifier &mdash; a directory has no reason to hold a name or a number.
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
              <label htmlFor={searchInputId} className="sr-only">
                Search by synthetic patient, plan or referral identifier
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
                placeholder="Synthetic identifier"
                className={fieldClass}
              />
            </div>
            {filter.state === "all" ? null : <input type="hidden" name="state" value={filter.state} />}
            <button type="submit" className={submitClass}>
              Search
            </button>
          </form>

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
            <PatientRow key={record.plan.id} record={record} />
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
        kind="filtered"
        heading="Plans are not visible in this role"
        because="Viewing plans is not part of the role you are acting in, so this list can only ever be empty here. It says nothing about how many plans this team holds."
        changedBy="Acting in a role that includes viewing plans. The role switcher changes which role you are acting in; a coordinator sees this team's plans."
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
          <Link
            href={CARING_CONTACTS_ROUTES.patients}
            data-internal-link="true"
            className={submitClass}
          >
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
  return `The search for "${filter.query}" finds no identifier among ${held}.`;
}

function PatientRow({ record }: { record: PlanRecord }) {
  const absorbed = absorbedContactCount(record);
  const scheduled = record.contacts.length - absorbed;

  return (
    <li className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 forced-colors:border-[CanvasText]">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
            Synthetic patient identifier
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-heading)]">
            {record.patientId}
          </h3>
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
        <UnavailableDestination
          id={`patient-row-${record.plan.id}`}
          label={`Open ${record.patientId}`}
          reason="Every contact in this plan, what has been sent, and the decisions still waiting."
          className={rowActionClass}
        />
      </div>

      {/*
        Spec 4.4: a state the system reached on its own must state, in place, why and what would
        change it. `schedule.ts` keeps one message rather than sending two on one calendar day, so
        a plan whose first contact lands on the Week 1 date carries nine sends, not ten. The row
        would otherwise show a smaller number with no reachable reason for it.
      */}
      {absorbed > 0 ? (
        <div className="mt-3 min-w-0">
          <AutomatedState
            state="Suppressed"
            because="The Week 1 message falls on the same calendar day as this plan's first contact, and two caring contacts must never land on one day, so the schedule kept one of them."
            changedBy="Choosing a different first-contact date for this plan puts the Week 1 message back into the schedule."
          />
        </div>
      ) : null}
    </li>
  );
}
