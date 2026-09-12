import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileText, Plus, Users } from "lucide-react";

import { workspacePanelPadded } from "@/components/caring-contacts/workspace/surfaces";
import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";
import { auditedRead } from "@/lib/caring-contacts-server/handler";
import { isCaringContactsDemoEnabled, resolveDemoActor } from "@/lib/caring-contacts-server/session";
import { caringContactsStore } from "@/lib/caring-contacts-server/store";
import { awstCalendarDay, systemClock } from "@/lib/caring-contacts/clock";
import type { PlanRecord } from "@/lib/caring-contacts/repository";
import { buildScheduleRange } from "@/lib/caring-contacts/schedule-view";
import type { ServiceState } from "@/lib/caring-contacts/service-state";

/**
 * The workspace's lazy route boundary (Ruling 13), present from its first commit.
 *
 * The PsychSift dashboard must never download this workspace's client code.
 * Two things hold that, and they are not equally load-bearing:
 *
 *  1. The module boundary, which is what actually gives the guarantee. Nothing
 *     outside this route segment imports the workspace — the tools catalogue
 *     names it by href, never by import, which is why `caring-contacts-routes.ts`
 *     is deliberately React-free. Each route downloads only the chunks in its own
 *     client-reference manifest, so a module the dashboard cannot reach is a
 *     chunk it cannot download. Measured: the dashboard route references zero
 *     chunks exclusive to `/caring-contacts`.
 *  2. This `next/dynamic` boundary. Next 16's lazy-loading guide is explicit that
 *     dynamically importing a Server Component lazy-loads the Client Components
 *     beneath it, which is where Tasks 16-18 add theirs. Today the workspace has
 *     one client component, so this buys structure for later rather than bytes
 *     now — stated plainly because the same guide also notes that a Server
 *     Component dynamically importing a Client Component does not auto-split.
 *
 * Not a cause of anything: this boundary was tested against a plain static import
 * while diagnosing a duplicated shell in the production build, and both spellings
 * behaved identically. The duplicate was React streaming the segment into a hidden
 * holder before moving it, not this import.
 */
const CaringContactsShell = dynamic(() =>
  import("@/components/caring-contacts/workspace/shell").then((module) => module.CaringContactsShell),
);

/**
 * Reads the real service-wide safety stop before rendering anything (Ruling 56).
 *
 * The same two lines every other server-side read in this seam uses:
 * `resolveDemoActor()` for who is acting, `caringContactsStore()` for the store
 * — memoised, and the in-memory reference repository when no database is
 * configured, which is what the demo and the offline suite run against.
 * `getServiceState` is deliberately not capability-checked: a stop raised by one
 * team halts sending for every team, so every actor of every team sees it.
 *
 * The read goes through `auditedRead`, the same audit/fail-closed wrapper
 * `readHandler` uses for the equivalent API read — this is the only patient-data-
 * bearing read in the seam that used to bypass it, because a Server Component
 * render has no `NextRequest` for `readHandler` itself to key an audit event on.
 * `auditedRead` needs no request; it takes the resolved actor and object identity
 * directly, so this render now produces the same `recordAccess` administrative
 * access event the API route's GET does, and fails closed the same way if the
 * trail cannot take it.
 *
 * The state is passed straight to the shell. Both are Server Components, so the
 * record never crosses to the browser — Next 16's lazy-loading guide is explicit
 * that dynamically importing a Server Component lazy-loads only the Client
 * Components beneath it, leaving this one on the server. The incident `note`
 * inside the record is kept off the screen by the banner's own parameter type,
 * `ServiceStopBannerFacts`, which omits it by construction; the HTTP narrowing in
 * `caring-contacts-server/service-state-view.ts` governs the API route, which is
 * a different boundary from this one and returns a different shape.
 *
 * A failed read is deliberately not swallowed. There is no honest state to fall
 * back to — rendering "running" because the store was unreachable is the exact
 * claim spec §4.2 forbids — so both a thrown read and an audit trail that could
 * not take the event are rethrown, reaching `error.tsx`, which says nothing was
 * sent and nothing was changed. `getServiceState` never returns `null`, so the
 * only two outcomes `auditedRead` can produce here are "allowed" and "failed".
 *
 * Reading the role cookie makes this route dynamic, which is correct: a cached
 * copy of a page that says nothing is stopped would outlive the stop.
 */
export default async function CaringContactsTodayPage() {
  if (!isCaringContactsDemoEnabled()) notFound();
  const actor = await resolveDemoActor();
  const store = await caringContactsStore();

  // "service" names the one service-wide record, matching the object id the API route's
  // `GET`/`POST` on `/api/caring-contacts/service-state` records the same read and writes
  // against — the access trail needs one stable identifier for it, not a per-caller one.
  const { outcome, recorded, released, error } = await auditedRead<ServiceState>(
    store,
    actor,
    { kind: "administrative", objectType: "serviceState", objectId: "service" },
    () => store.getServiceState({ actor }),
  );
  if (outcome === "failed") throw error instanceof Error ? error : new Error("Failed to read the service state.");
  if (!recorded) throw new Error("Caring Contacts access trail is unavailable; nothing was rendered.");
  // `getServiceState` never returns null (see the module note above): "denied" is not a reachable
  // outcome for this read, so a null `released` here would mean the store broke that contract --
  // fail closed rather than pass a missing record on to the shell.
  if (released === null) throw new Error("caring-contacts service state read returned no record.");
  const serviceState = released;

  const todayCalendarDay = awstCalendarDay(systemClock().now());
  const scheduleRead = await auditedRead<PlanRecord[]>(
    store,
    actor,
    { kind: "search", objectType: "contactSchedule", objectId: `${todayCalendarDay}:${todayCalendarDay}` },
    () => store.listPlans({ actor }),
  );
  if (scheduleRead.outcome === "failed") {
    throw scheduleRead.error instanceof Error ? scheduleRead.error : new Error("Failed to read this team's schedule.");
  }
  if (!scheduleRead.recorded) {
    throw new Error("Caring Contacts access trail is unavailable; nothing was rendered.");
  }
  if (scheduleRead.released == null) {
    throw new Error("caring-contacts schedule read returned no list.");
  }
  const plans = scheduleRead.released;
  const range = buildScheduleRange(plans, todayCalendarDay, todayCalendarDay);
  if (!range.ok) {
    throw new Error(`caring-contacts schedule read refused: ${range.reason}`);
  }
  const todaySchedule = range.view.days[0];
  const contactsDueToday = todaySchedule?.counts.due ?? 0;
  const activePlansCount = plans.filter((p) => p.plan.state === "active").length;

  return (
    <CaringContactsShell
      title="Today"
      description="The day's caring-contact work for this team. Every patient, number and message in this workspace is invented; nothing here is ever sent to a real number."
      serviceState={serviceState}
    >
      <section aria-labelledby="caring-contacts-today-overview" className="min-w-0 space-y-6">
        <h2 id="caring-contacts-today-overview" className="sr-only">
          Today&apos;s Overview
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className={workspacePanelPadded}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[color:var(--text-muted)]">
                Contacts Due Today
              </span>
              <CalendarDays className="h-5 w-5 text-[color:var(--text-muted)]" aria-hidden="true" />
            </div>
            <div className="mt-3">
              <span className="text-3xl font-bold tracking-tight text-[color:var(--text-heading)]">
                {contactsDueToday}
              </span>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                {contactsDueToday === 1
                  ? "1 message scheduled for delivery today"
                  : `${contactsDueToday} messages scheduled for delivery today`}
              </p>
            </div>
            <div className="mt-4 border-t border-[color:var(--border)] pt-3">
              <Link
                href={CARING_CONTACTS_ROUTES.schedule}
                className="text-xs font-medium text-[color:var(--clinical-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              >
                View today&apos;s schedule &rarr;
              </Link>
            </div>
          </div>

          <div className={workspacePanelPadded}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[color:var(--text-muted)]">
                Active Caseload
              </span>
              <Users className="h-5 w-5 text-[color:var(--text-muted)]" aria-hidden="true" />
            </div>
            <div className="mt-3">
              <span className="text-3xl font-bold tracking-tight text-[color:var(--text-heading)]">
                {activePlansCount}
              </span>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                {activePlansCount === 1
                  ? "1 active caring-contact plan"
                  : `${activePlansCount} active caring-contact plans`}
              </p>
            </div>
            <div className="mt-4 border-t border-[color:var(--border)] pt-3">
              <Link
                href={CARING_CONTACTS_ROUTES.patients}
                className="text-xs font-medium text-[color:var(--clinical-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              >
                View patient directory &rarr;
              </Link>
            </div>
          </div>

          <div className={workspacePanelPadded}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[color:var(--text-muted)]">
                Quick Actions
              </span>
              <Plus className="h-5 w-5 text-[color:var(--text-muted)]" aria-hidden="true" />
            </div>
            <div className="mt-3 space-y-2">
              <Link
                href={CARING_CONTACTS_ROUTES.newPlan}
                className="flex items-center gap-2 text-xs font-medium text-[color:var(--clinical-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Activate new plan</span>
              </Link>
              <Link
                href={CARING_CONTACTS_ROUTES.templates}
                className="flex items-center gap-2 text-xs font-medium text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Browse template library</span>
              </Link>
            </div>
            <div className="mt-4 border-t border-[color:var(--border)] pt-3">
              <Link
                href={CARING_CONTACTS_ROUTES.team}
                className="text-xs font-medium text-[color:var(--text-muted)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              >
                View team workload &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    </CaringContactsShell>
  );
}
