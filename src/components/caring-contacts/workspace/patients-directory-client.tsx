"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";
import type { PlanState } from "@/lib/caring-contacts/model";
import {
  PATIENTS_DIRECTORY_STATE_ORDER,
  type PatientsDirectoryFilter,
} from "@/lib/caring-contacts/patients-directory-filter";

import { AutomatedState } from "./automated-state";
import { ListEmptyState } from "./list-empty-state";
import type { PatientsDirectoryRow } from "./patients-directory-row";
import { UnavailableDestination } from "./unavailable-destination";

/**
 * The team's caseload, as a list of PLANS rather than of people.
 *
 * What this screen may know, and why it is so little
 * -------------------------------------------------
 * A server wrapper derives `PatientsDirectoryRow` from the separately read plans and names. That DTO
 * contains exactly what this client island renders, searches or needs for its suppression wording;
 * mobile number, identifier list, ancestry, team, pathway and the raw contact schedule have nowhere
 * in the client value to be.
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
 * Why only the state filter is a URL
 * ----------------------------------
 * Plan state is non-identifying and remains a set of ordinary `<Link>` navigations. Patient-name
 * search is deliberately local state in this one directory boundary: putting a name in a GET query
 * would copy patient information into browser history and request logs, which the workspace's
 * binding privacy contract forbids. The boundary receives only the already narrowed plan and name
 * projections; incident responder notes never enter it.
 *
 * Ruling 94: that is the whole claim, and it is deliberately not a count. This paragraph previously
 * carried client-component tallies that went stale. The checkable property is narrower: this screen
 * adds one privacy-motivated boundary and does not widen the data projection passed into it.
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
 * screen uses its third kind for a role that may not view plans at all. `listPlans` answers such an
 * actor with `[]`, exactly as it answers a team with no plans, so
 * a screen that only counted rows would tell an auditor their team has no patients -- a false
 * statement about a caseload, which is the defect the component exists to prevent. The capability
 * is therefore decided from the actor by the page and passed in as `mayViewPlans`, and that case
 * gets the `"not-permitted"` wording shape (a reason and a remedy), because it is a visibility rule
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

/** Every href on this screen contains non-identifying plan state only. */
export function patientsDirectoryHref(filter: PatientsDirectoryFilter): string {
  return filter.state === "all"
    ? CARING_CONTACTS_ROUTES.patients
    : `${CARING_CONTACTS_ROUTES.patients}?state=${encodeURIComponent(filter.state)}`;
}

/**
 * The search matches the patient's name as well as the three identifiers, but the query exists only
 * inside this client boundary. It is never serialized into a URL, server request or audit event.
 *
 * `patientName` is null for a row with no name to match, and an empty haystack segment can never make a
 * non-empty query match, so no row is found by a name it does not have.
 */
function matchesFilter(row: PatientsDirectoryRow, filter: PatientsDirectoryFilter, query: string): boolean {
  if (filter.state !== "all" && row.state !== filter.state) return false;
  if (query === "") return true;
  const needle = query.toLowerCase();
  return `${row.patientName ?? ""} ${row.patientId} ${row.planId} ${row.referralId}`.toLowerCase().includes(needle);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
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

export type PatientsDirectoryClientProps = {
  /** The allowlisted row projection for the selected non-identifying state. */
  rows: readonly PatientsDirectoryRow[];
  /** Non-identifying total used only to explain filtering without serializing other rows. */
  totalPlanCount: number;
  filter: PatientsDirectoryFilter;
  /** False when the acting role does not include viewing plans -- see the module note. */
  mayViewPlans: boolean;
};

export function PatientsDirectoryClient({ rows, totalPlanCount, filter, mayViewPlans }: PatientsDirectoryClientProps) {
  const [rawQuery, setRawQuery] = useState("");
  const query = rawQuery.trim();
  const visible = mayViewPlans ? rows.filter((row) => matchesFilter(row, filter, query)) : [];
  const filtering = filter.state !== "all" || query !== "";

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
              href={patientsDirectoryHref({ state: "all" })}
              data-internal-link="true"
              aria-current={filter.state === "all" ? "true" : undefined}
              className={filterChipClass}
            >
              All
            </Link>
            {PATIENTS_DIRECTORY_STATE_ORDER.map((state) => (
              <Link
                key={state}
                href={patientsDirectoryHref({ state })}
                data-internal-link="true"
                aria-current={filter.state === state ? "true" : undefined}
                className={filterChipClass}
              >
                {PLAN_STATE_LABELS[state]}
              </Link>
            ))}
          </nav>

          {/* Patient names must never enter a URL, browser history, request log or audit event. */}
          <div role="search" className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
              <label htmlFor={searchInputId} className="sr-only">
                Search by name, or by synthetic patient, plan or referral identifier
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-icon-md -translate-y-1/2 text-[color:var(--text-muted)]"
              />
              <input
                id={searchInputId}
                type="search"
                value={rawQuery}
                onChange={(event) => setRawQuery(event.currentTarget.value)}
                autoComplete="off"
                placeholder="Name or synthetic ID"
                className={fieldClass}
              />
            </div>
            {query === "" ? null : (
              <button type="button" className={submitClass} onClick={() => setRawQuery("")}>
                Clear search
              </button>
            )}
          </div>

          {visible.length > 0 ? (
            <p className="mt-4 text-sm text-[color:var(--text-muted)]">
              Showing {plural(visible.length, "plan", "plans")} of {plural(totalPlanCount, "plan", "plans")} this team
              holds.
            </p>
          ) : null}
        </>
      ) : null}

      {visible.length > 0 ? (
        <ul className="mt-4 flex min-w-0 flex-col gap-3">
          {visible.map((row) => (
            <PatientRow key={row.planId} row={row} />
          ))}
        </ul>
      ) : (
        <div className="mt-5 min-w-0">
          <DirectoryEmptyState
            totalPlanCount={totalPlanCount}
            filter={filter}
            query={query}
            filtering={filtering}
            mayViewPlans={mayViewPlans}
            clearSearch={() => setRawQuery("")}
          />
        </div>
      )}
    </section>
  );
}

function DirectoryEmptyState({
  totalPlanCount,
  filter,
  query,
  filtering,
  mayViewPlans,
  clearSearch,
}: {
  totalPlanCount: number;
  filter: PatientsDirectoryFilter;
  query: string;
  filtering: boolean;
  mayViewPlans: boolean;
  clearSearch: () => void;
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

  if (totalPlanCount === 0) {
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
        because={hiddenBecause(totalPlanCount, filter, query)}
        changedBy={`Clearing the filter shows all ${plural(totalPlanCount, "plan", "plans")} this team holds.`}
        action={
          filter.state === "all" ? (
            <button type="button" className={submitClass} onClick={clearSearch}>
              Show every plan
            </button>
          ) : (
            <Link href={CARING_CONTACTS_ROUTES.patients} data-internal-link="true" className={submitClass}>
              Show every plan
            </Link>
          )
        }
      />
    );
  }

  // Unreachable in practice -- `visible` can only be shorter than `rows` when something is
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
function hiddenBecause(total: number, filter: PatientsDirectoryFilter, query: string): string {
  const held = `the ${plural(total, "plan", "plans")} this team holds`;
  if (filter.state !== "all" && query !== "") {
    return `The state filter is set to ${PLAN_STATE_LABELS[filter.state]} and the search is "${query}". Nothing among ${held} satisfies both.`;
  }
  if (filter.state !== "all") {
    return `The state filter is set to ${PLAN_STATE_LABELS[filter.state]}, and none of ${held} is in that state.`;
  }
  return `The search for "${query}" matches no name or identifier among ${held}.`;
}

/**
 * One plan's row.
 *
 * `patientName` is null when the names read held nothing for this plan -- a de-identified episode, or a
 * role without `viewPatientRecord`. The heading then falls back to the synthetic identifier and the
 * label above it says which of the two the heading is, so the row never presents an identifier as a
 * name or leaves a reader guessing. It deliberately does not try to say WHICH cause applies: the
 * screen is not told, and guessing between "this episode was de-identified" and "your role may not
 * see names" would be a claim nothing here can support.
 */
function PatientRow({ row }: { row: PatientsDirectoryRow }) {
  const suppressed = row.absorbedContactCount + row.otherSuppressedContactCount;
  const explanation = suppressionExplanation(row.absorbedContactCount, row.otherSuppressedContactCount);

  return (
    <li className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 forced-colors:border-[CanvasText]">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
            {row.patientName === null ? "Synthetic patient identifier" : "Patient"}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-heading)]">
            {row.patientName ?? row.patientId}
          </h3>
          {/*
            Kept beside the name, not replaced by it. Two patients can share a name, the row's
            detail control is named by the identifier, and it is the identifier a clinician quotes
            when asking about a record.
          */}
          {row.patientName === null ? null : (
            <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">
              Synthetic identifier: {row.patientId}
            </p>
          )}
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Plan state: </span>
            {PLAN_STATE_LABELS[row.state]}
          </p>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Discharged: </span>
            {row.dischargeDay} (AWST)
          </p>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Contacts: </span>
            {plural(row.scheduledContactCount, "message in the schedule", "messages in the schedule")}
          </p>
        </div>
        {/*
          `label` is a destination NOUN, not an instruction. `UnavailableDestination` builds its
          screen-reader note as "<label> is not built yet.", so a verb phrase there produced
          "Open patient-plan-1 is not built yet." The visible text carries the identifier so that
          one row's control is still distinguishable from the next.
        */}
        <UnavailableDestination
          id={`patient-row-${row.planId}`}
          label={`The patient record for ${row.patientId}`}
          reason="Every contact in this plan, what has been sent, and the decisions still waiting."
          className={rowActionClass}
        >
          <span className="truncate">Patient record &mdash; {row.patientId}</span>
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
