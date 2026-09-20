"use client";

import { CalendarClock, Plus } from "lucide-react";

import { cardSurface } from "@/components/card-recipes";
import { Button } from "@/components/ui/button";
import { cn, EmptyState, eyebrowText, InlineNotice, textMuted } from "@/components/ui-primitives";
import {
  cmeRoutineCadenceLabels,
  formatRoutineDueDate,
  formatRoutineHours,
  routineLogPrefill,
  routinesDueOn,
  type CmeRoutine,
  type CmeRoutineLogPrefill,
} from "@/lib/cme/routines";

export type CmeRoutinesPageProps = {
  /** Every routine the owner has, active or archived. Defaults to none. */
  readonly routines?: readonly CmeRoutine[];
  /** The instant "now" is evaluated against — required, not defaulted, so a server render and the client it hydrates into always agree on what is due. */
  readonly now: Date;
  /**
   * Called when the owner taps "Log" on a routine, with everything the entry
   * form needs to open pre-filled. Required, not defaulted: a caller that
   * forgets to wire this up must fail to compile rather than render a button
   * that looks like it logs an activity and silently does nothing when
   * tapped — in a record someone may have to defend to a regulator, that is
   * the worst available failure.
   */
  readonly onLogRoutine: (prefill: CmeRoutineLogPrefill) => void;
  /** Called when the owner taps "New routine". Required for the same reason as `onLogRoutine`. */
  readonly onNewRoutine: () => void;
};

/**
 * ROUTINES — the recurring activities an owner does every month or term:
 * supervision, a journal club, a peer-review meeting. This screen only ever
 * OFFERS to log one; it never logs one itself.
 *
 * That property holds structurally, not by convention: there is no fetch, no
 * Supabase call, and no dispatch anywhere in this file. The two callback
 * props above are the entire surface this component can act through, and
 * neither one is a write. Tapping "Log" builds a `CmeRoutineLogPrefill`
 * (`routineLogPrefill`, in `@/lib/cme/routines`) and hands it to
 * `onLogRoutine` — the caller's job is to open the entry form with those
 * values already filled in, which the owner still has to look at and confirm
 * with Save before anything is recorded. There is no code path here, or
 * reachable from here, that creates a `CmeEntry` on its own.
 *
 * This is a sub-screen, not the CME mode home — it does not mount
 * `CmeNavHeader`. See `docs/search-chrome-behaviour.md` for when a page owns
 * that header and when, like this one, it does not need to.
 */
export function CmeRoutinesPage({ routines = [], now, onLogRoutine, onNewRoutine }: CmeRoutinesPageProps) {
  const dueRoutines = routinesDueOn(routines, now);
  const activeRoutines = routines
    .filter((routine) => routine.archivedAt === null)
    .slice()
    // Routines with a scheduled date first, soonest first; unscheduled ones trail the list
    // rather than sorting arbitrarily by insertion order.
    .sort((a, b) => (a.nextDue ?? "9999-99-99").localeCompare(b.nextDue ?? "9999-99-99"));

  function handleLog(routine: CmeRoutine) {
    onLogRoutine(routineLogPrefill(routine, now));
  }

  return (
    <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[color:var(--text)]">Routines</h1>
      <p className={cn(textMuted, "mt-1 text-sm")}>
        The things you do every month or term. Log one whenever it happens.
      </p>

      {dueRoutines.length > 0 && (
        <section aria-labelledby="cme-routines-due-heading" data-testid="cme-routines-due" className="mt-6 space-y-3">
          <h2 id="cme-routines-due-heading" className={eyebrowText}>
            Due now
          </h2>
          {dueRoutines.map((routine) => (
            <div key={routine.id} className={cn(cardSurface, "flex items-center justify-between gap-4 p-4")}>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[color:var(--text)]">{routine.title}</p>
                <p className={cn(textMuted, "text-sm")}>
                  {cmeRoutineCadenceLabels[routine.cadence]} · usually {formatRoutineHours(routine.usualHours)} h
                </p>
              </div>
              <Button
                variant="primary"
                aria-label={`Log ${formatRoutineHours(routine.usualHours)} h for ${routine.title}`}
                onClick={() => handleLog(routine)}
              >
                {`Log ${formatRoutineHours(routine.usualHours)} h`}
              </Button>
            </div>
          ))}
        </section>
      )}

      {dueRoutines.length === 0 && activeRoutines.length > 0 && (
        <p data-testid="cme-routines-due-empty" className={cn(textMuted, "mt-6 text-sm")}>
          Nothing is due right now.
        </p>
      )}

      <div data-testid="cme-routines-confirmation-note" className="mt-6">
        <InlineNotice tone="neutral">
          A routine only ever suggests. Tapping Log opens a pre-filled entry for you to check — nothing is recorded
          until you confirm and save it.
        </InlineNotice>
      </div>

      <section aria-labelledby="cme-routines-list-heading" className="mt-6">
        <h2 id="cme-routines-list-heading" className={eyebrowText}>
          Your routines
        </h2>
        {activeRoutines.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              testId="cme-routines-empty"
              icon={CalendarClock}
              title="You have not added any routines yet."
              body="A routine is a reminder to log something you do regularly. Nothing is scheduled or recorded until you add one."
            />
          </div>
        ) : (
          <ul data-testid="cme-routines-list" className="mt-3 space-y-3">
            {activeRoutines.map((routine) => (
              <li key={routine.id} className={cn(cardSurface, "flex items-center justify-between gap-4 p-4")}>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[color:var(--text)]">{routine.title}</p>
                  <p className={cn(textMuted, "text-sm")}>
                    {cmeRoutineCadenceLabels[routine.cadence]} · usually {formatRoutineHours(routine.usualHours)} h
                  </p>
                  <p className={cn(textMuted, "text-sm")}>
                    {routine.nextDue ? `Next due ${formatRoutineDueDate(routine.nextDue)}` : "Not scheduled yet"}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Log usual hours for ${routine.title}`}
                  onClick={() => handleLog(routine)}
                >
                  Log
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6">
        <Button variant="primary" icon={Plus} onClick={onNewRoutine}>
          New routine
        </Button>
      </div>
    </main>
  );
}
