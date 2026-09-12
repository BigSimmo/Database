import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FilePlus,
  Plus,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

import { floatingControl, primaryControl } from "@/components/ui-primitives";
import { CARING_CONTACTS_ROUTES, patientPlanRoute, scheduleDayRoute } from "@/lib/caring-contacts-routes";
import type { ScheduleDay, ScheduleEntry } from "@/lib/caring-contacts/schedule-view";
import type { ServiceState } from "@/lib/caring-contacts/service-state";
import type { TeamWorkloadView } from "@/lib/caring-contacts/team-workload";

import { ListEmptyState } from "./list-empty-state";
import { workspacePanel, workspacePanelPadded } from "./surfaces";

export type TodayDashboardProps = {
  scheduleDay: ScheduleDay;
  teamWorkload: TeamWorkloadView;
  serviceState: ServiceState;
  todayCalendarDay: string;
  mayViewPlans?: boolean;
};

const badgeClass = "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium";

export function TodayDashboard({
  scheduleDay,
  teamWorkload,
  serviceState,
  todayCalendarDay,
  mayViewPlans = true,
}: TodayDashboardProps) {
  const { counts, exceptions, windows } = scheduleDay;
  const { unclaimed, coordinators, thresholdMinutes } = teamWorkload;

  const totalActivePlans = coordinators.reduce((sum, c) => sum + c.activePlans, 0);
  const totalHeldPlans = coordinators.reduce((sum, c) => sum + c.heldPlans.reduce((hSum, h) => hSum + h.plans, 0), 0);

  const dueEntries: ScheduleEntry[] = [];
  for (const window of windows) {
    for (const entry of window.entries) {
      if (entry.isDue) dueEntries.push(entry);
    }
  }

  if (!mayViewPlans) {
    return (
      <div data-testid="caring-contacts-today-not-permitted" className="space-y-6">
        <ListEmptyState
          kind="not-permitted"
          heading="Today's workload is not visible in this role"
          because="Viewing plans is not part of the role you are acting in, and both Contacts Due Today and Active Caseload are built entirely from this team's plans. This says nothing about how many contacts fall today or how many plans are active: a read you may not make and an empty caseload look identical on purpose, so that nobody can find out a record exists by being refused it."
          changedBy="Nothing on this screen changes it, and there is no control for it anywhere in this workspace yet. The role this demonstration acts in is set outside the interface; a coordinator sees today's figures."
        />
      </div>
    );
  }

  const hasNoCaseload = counts.total === 0 && unclaimed.plans === 0 && coordinators.length === 0;

  if (hasNoCaseload) {
    return (
      <div data-testid="caring-contacts-today-empty" className="space-y-6">
        <ListEmptyState
          kind="no-data"
          heading="No caring contacts active today"
          explanation="There are currently no active plans or scheduled contacts for this team. You can initiate a plan from an accepted referral or register an intake referral."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Link href={CARING_CONTACTS_ROUTES.newPlan} data-internal-link="true" className={primaryControl}>
                <Plus aria-hidden="true" className="size-icon-sm shrink-0" />
                <span>New care plan</span>
              </Link>
              <Link href="/caring-contacts/intake" data-internal-link="true" className={floatingControl}>
                <FilePlus aria-hidden="true" className="size-icon-sm shrink-0" />
                <span>Manual referral intake</span>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div data-testid="caring-contacts-today-dashboard" className="space-y-8">
      {/* 1. Urgent Triage Bar */}
      <section aria-labelledby="triage-bar-heading" data-testid="caring-contacts-urgent-triage" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="triage-bar-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[color:var(--text-muted)]"
          >
            Clinical Triage Status
          </h2>
          <span className="text-xs text-[color:var(--text-muted)]">
            AWST Day: <time dateTime={todayCalendarDay}>{todayCalendarDay}</time>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card: Due Today */}
          <div className={`${workspacePanelPadded} flex flex-col justify-between`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-[color:var(--text-muted)]">Due today</span>
                <p className="mt-1 text-2xl font-bold text-[color:var(--text-heading)]">{counts.due}</p>
              </div>
              <span
                className={`${badgeClass} ${
                  counts.due > 0
                    ? "bg-[color:var(--clinical-accent-subtle)] text-[color:var(--clinical-accent)]"
                    : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
                }`}
              >
                <Clock aria-hidden="true" className="size-3.5" />
                {counts.due > 0 ? "Dispatch ready" : "None due"}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-3 text-xs text-[color:var(--text-muted)]">
              <span>Windows: Morning · Midday · Afternoon</span>
              <Link
                href={scheduleDayRoute(todayCalendarDay)}
                className="font-medium text-[color:var(--command)] hover:underline inline-flex items-center gap-1"
              >
                Schedule <ArrowRight aria-hidden="true" className="size-3" />
              </Link>
            </div>
          </div>

          {/* Card: Operational Reviews / Exceptions */}
          <div className={`${workspacePanelPadded} flex flex-col justify-between`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-[color:var(--text-muted)]">Needs review</span>
                <p className="mt-1 text-2xl font-bold text-[color:var(--text-heading)]">{counts.needsReview}</p>
              </div>
              <span
                className={`${badgeClass} ${
                  counts.needsReview > 0
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
                }`}
              >
                <AlertTriangle aria-hidden="true" className="size-3.5" />
                {counts.needsReview > 0 ? "Exceptions" : "Clear"}
              </span>
            </div>
            <div className="mt-4 border-t border-[color:var(--border-subtle)] pt-3 text-xs text-[color:var(--text-muted)]">
              <span>Failed deliveries, missed, or invalid numbers</span>
            </div>
          </div>

          {/* Card: Unclaimed Work */}
          <div className={`${workspacePanelPadded} flex flex-col justify-between`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-[color:var(--text-muted)]">Unclaimed cases</span>
                <p className="mt-1 text-2xl font-bold text-[color:var(--text-heading)]">{unclaimed.plans}</p>
              </div>
              <span
                className={`${badgeClass} ${
                  unclaimed.state === "escalated"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                    : unclaimed.state === "withinThreshold"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
                }`}
              >
                <Users aria-hidden="true" className="size-3.5" />
                {unclaimed.state === "escalated"
                  ? `Escalated (>${thresholdMinutes}m)`
                  : unclaimed.state === "withinThreshold"
                    ? "Pending coordinator"
                    : "Assigned"}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-3 text-xs text-[color:var(--text-muted)]">
              <span>
                {unclaimed.oldestMinutesUnclaimed !== null
                  ? `Oldest: ${unclaimed.oldestMinutesUnclaimed}m`
                  : "No queue backlog"}
              </span>
              <Link
                href={CARING_CONTACTS_ROUTES.team}
                className="font-medium text-[color:var(--command)] hover:underline inline-flex items-center gap-1"
              >
                Team roster <ArrowRight aria-hidden="true" className="size-3" />
              </Link>
            </div>
          </div>

          {/* Card: Service Safety State */}
          <div className={`${workspacePanelPadded} flex flex-col justify-between`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-[color:var(--text-muted)]">Safety state</span>
                <p className="mt-1 text-lg font-semibold text-[color:var(--text-heading)]">
                  {serviceState.stopped ? "STOPPED" : "Operational"}
                </p>
              </div>
              <span
                className={`${badgeClass} ${
                  serviceState.stopped
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                }`}
              >
                {serviceState.stopped ? (
                  <ShieldAlert aria-hidden="true" className="size-3.5" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="size-3.5" />
                )}
                {serviceState.stopped ? "Emergency Stop" : "Active"}
              </span>
            </div>
            <div className="mt-4 border-t border-[color:var(--border-subtle)] pt-3 text-xs text-[color:var(--text-muted)]">
              <span>{counts.held > 0 ? `${counts.held} contacts held by plan` : "Dispatches running"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Action Queue & Operational Review */}
      <section aria-labelledby="action-queue-heading" data-testid="caring-contacts-action-queue" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="action-queue-heading" className="text-base font-semibold text-[color:var(--text-heading)]">
            Clinical Action Queue
          </h2>
          <span className="text-xs text-[color:var(--text-muted)]">
            {exceptions.entries.length} review item(s) · {dueEntries.length} due today
          </span>
        </div>

        {exceptions.entries.length === 0 && dueEntries.length === 0 ? (
          <div className={`${workspacePanelPadded} text-sm text-[color:var(--text-muted)]`}>
            No contacts require intervention or delivery today. Routine schedules are up to date.
          </div>
        ) : (
          <div className={`${workspacePanel} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-xs font-semibold text-[color:var(--text-muted)] uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Patient Ref
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Schedule Cadence
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Message Type
                    </th>
                    <th scope="col" className="px-4 py-3">
                      State / Triage Reason
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)] bg-[color:var(--surface)]">
                  {/* Urgent exceptions first */}
                  {exceptions.entries.map((entry) => (
                    <tr key={entry.contactId} className="hover:bg-[color:var(--surface-subtle)]/50">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-[color:var(--text-heading)]">
                        {entry.patientId}
                      </td>
                      <td className="px-4 py-3 text-sm text-[color:var(--text)]">{entry.cadenceLabel}</td>
                      <td className="px-4 py-3 text-xs uppercase text-[color:var(--text-muted)]">
                        {entry.messageType}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`${badgeClass} bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300`}
                        >
                          <AlertCircle aria-hidden="true" className="size-3" />
                          Review: {entry.state}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={patientPlanRoute(entry.patientId, entry.planId)}
                          data-internal-link="true"
                          className="font-medium text-[color:var(--command)] hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          Review Patient <ExternalLink aria-hidden="true" className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {/* Due routine contacts */}
                  {dueEntries.map((entry) => (
                    <tr key={entry.contactId} className="hover:bg-[color:var(--surface-subtle)]/50">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-[color:var(--text-heading)]">
                        {entry.patientId}
                      </td>
                      <td className="px-4 py-3 text-sm text-[color:var(--text)]">{entry.cadenceLabel}</td>
                      <td className="px-4 py-3 text-xs uppercase text-[color:var(--text-muted)]">
                        {entry.messageType}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`${badgeClass} bg-[color:var(--clinical-accent-subtle)] text-[color:var(--clinical-accent)]`}
                        >
                          <Clock aria-hidden="true" className="size-3" />
                          Due for dispatch
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={patientPlanRoute(entry.patientId, entry.planId)}
                          data-internal-link="true"
                          className="font-medium text-[color:var(--command)] hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          View Plan <ExternalLink aria-hidden="true" className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 3. Team Caseload & Workload Distribution */}
      <section
        aria-labelledby="caseload-workload-heading"
        data-testid="caring-contacts-team-caseload"
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="caseload-workload-heading" className="text-base font-semibold text-[color:var(--text-heading)]">
            Team Caseload & Work Distribution
          </h2>
          <Link
            href={CARING_CONTACTS_ROUTES.team}
            data-internal-link="true"
            className="text-xs font-medium text-[color:var(--command)] hover:underline"
          >
            Full workload roster
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className={`${workspacePanelPadded} flex items-center gap-4`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
              <UserCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-[color:var(--text-muted)]">Active coordinators</p>
              <p className="text-xl font-bold text-[color:var(--text-heading)]">{coordinators.length}</p>
            </div>
          </div>

          <div className={`${workspacePanelPadded} flex items-center gap-4`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
              <Users aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-[color:var(--text-muted)]">Active patient caseload</p>
              <p className="text-xl font-bold text-[color:var(--text-heading)]">{totalActivePlans}</p>
            </div>
          </div>

          <div className={`${workspacePanelPadded} flex items-center gap-4`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-[color:var(--text-muted)]">Held / safety pauses</p>
              <p className="text-xl font-bold text-[color:var(--text-heading)]">{totalHeldPlans}</p>
            </div>
          </div>
        </div>

        {/* Coordinators table if assigned */}
        {coordinators.length > 0 && (
          <div className={`${workspacePanel} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-xs font-semibold text-[color:var(--text-muted)]">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      Coordinator ID
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-center">
                      Active Plans
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-center">
                      Held Plans
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-center">
                      Backlog
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)] bg-[color:var(--surface)] text-xs">
                  {coordinators.map((c) => (
                    <tr key={c.actorId} className="hover:bg-[color:var(--surface-subtle)]/50">
                      <td className="px-4 py-2.5 font-mono text-[color:var(--text-heading)]">{c.actorId}</td>
                      <td className="px-4 py-2.5 text-center font-medium">{c.activePlans}</td>
                      <td className="px-4 py-2.5 text-center text-[color:var(--text-muted)]">
                        {c.heldPlans.reduce((sum, h) => sum + h.plans, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {c.exceptionBacklog.contacts > 0 ? (
                          <span className="text-amber-600 font-semibold">{c.exceptionBacklog.contacts}</span>
                        ) : (
                          <span className="text-[color:var(--text-muted)]">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Quick Entry Links */}
      <section aria-label="Workspace Fast Links" className="flex flex-wrap items-center gap-3 pt-2">
        <Link href={CARING_CONTACTS_ROUTES.patients} data-internal-link="true" className={`${floatingControl} text-xs`}>
          <Users aria-hidden="true" className="size-4 shrink-0" />
          <span>Patients Directory</span>
        </Link>
        <Link href={CARING_CONTACTS_ROUTES.schedule} data-internal-link="true" className={`${floatingControl} text-xs`}>
          <Calendar aria-hidden="true" className="size-4 shrink-0" />
          <span>Weekly Schedule</span>
        </Link>
        <Link href={CARING_CONTACTS_ROUTES.newPlan} data-internal-link="true" className={`${floatingControl} text-xs`}>
          <Plus aria-hidden="true" className="size-4 shrink-0" />
          <span>New Activation Plan</span>
        </Link>
        <Link href="/caring-contacts/intake" data-internal-link="true" className={`${floatingControl} text-xs`}>
          <FilePlus aria-hidden="true" className="size-4 shrink-0" />
          <span>Hospital Referral Intake</span>
        </Link>
      </section>
    </div>
  );
}
