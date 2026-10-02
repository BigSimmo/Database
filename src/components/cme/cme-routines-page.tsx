"use client";

import { CalendarClock, ChevronDown, Plus } from "lucide-react";

import { cmePageTitle, cmePageWidth } from "@/components/cme/cme-page-frame";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { modeSecondaryText } from "@/components/mode-kit/type";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
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
  readonly onEditRoutine?: (routine: CmeRoutine) => void;
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
export function CmeRoutinesPage({
  routines = [],
  now,
  onLogRoutine,
  onNewRoutine,
  onEditRoutine,
}: CmeRoutinesPageProps) {
  const dueRoutines = routinesDueOn(routines, now);
  const dueIds = new Set(dueRoutines.map((routine) => routine.id));
  // ONE list. A due routine used to appear twice — under "Due now" and again
  // under "Your routines". Now due routines sort first and carry a Due chip;
  // after them, routines with a scheduled date, soonest first; unscheduled
  // ones trail the list rather than sorting arbitrarily by insertion order.
  const activeRoutines = routines
    .filter((routine) => routine.archivedAt === null)
    .slice()
    .sort(
      (a, b) =>
        Number(dueIds.has(b.id)) - Number(dueIds.has(a.id)) ||
        (a.nextDue ?? "9999-99-99").localeCompare(b.nextDue ?? "9999-99-99"),
    );

  function handleLog(routine: CmeRoutine) {
    onLogRoutine(routineLogPrefill(routine, now));
  }

  return (
    <main className={cn(cmePageWidth, "px-4 py-6 sm:px-6")}>
      <h1 className={cmePageTitle}>Routines</h1>
      <p className={cn(textMuted, "mt-1 text-sm")}>
        The things you do every month or term. Log one whenever it happens.
      </p>

      {/* Folded, wording unchanged: read once, then out of the way. The note
          stays in the DOM, so the promise is still there for anyone who opens it. */}
      <details data-testid="cme-routines-how" className="group mt-3">
        <summary className="inline-flex min-h-tap cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-[color:var(--clinical-accent)] [&::-webkit-details-marker]:hidden">
          How this works
          <ChevronDown
            aria-hidden="true"
            className="size-icon-sm transition-transform motion-reduce:transition-none group-open:rotate-180"
          />
        </summary>
        <div data-testid="cme-routines-confirmation-note" className="mt-1">
          <InlineNotice tone="neutral">
            A routine only ever suggests. Tapping Log opens a pre-filled entry for you to check — nothing is recorded
            until you confirm and save it.
          </InlineNotice>
        </div>
      </details>

      {dueRoutines.length === 0 && activeRoutines.length > 0 && (
        <p data-testid="cme-routines-due-empty" className={cn(textMuted, "mt-4 text-sm")}>
          Nothing is due right now.
        </p>
      )}

      {activeRoutines.length === 0 ? (
        <section aria-labelledby="cme-routines-list-heading" className="mt-6">
          <h2 id="cme-routines-list-heading" className={eyebrowText}>
            Your routines
          </h2>
          <div className="mt-3">
            <EmptyState
              testId="cme-routines-empty"
              icon={CalendarClock}
              title="You have not added any routines yet."
              body="A routine is a reminder to log something you do regularly. Nothing is scheduled or recorded until you add one."
            />
          </div>
        </section>
      ) : (
        <ModeGroupedList eyebrow="Your routines" testId="cme-routines-list" className="mt-6">
          {activeRoutines.map((routine) => {
            const due = dueIds.has(routine.id);
            return (
              <ModeRow
                key={routine.id}
                testId={due ? "cme-routines-due-row" : undefined}
                title={routine.title}
                subtitle={`${cmeRoutineCadenceLabels[routine.cadence]} · usually ${formatRoutineHours(routine.usualHours)} h`}
                meta={
                  <span className={cn(modeSecondaryText, "flex flex-wrap items-center gap-2 leading-5")}>
                    {due ? (
                      <Chip size="compact" appearance={{ kind: "information", tone: "accent" }}>
                        Due
                      </Chip>
                    ) : null}
                    {routine.nextDue ? `Next due ${formatRoutineDueDate(routine.nextDue)}` : "Not scheduled yet"}
                  </span>
                }
                trailing={
                  <>
                    {due ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Log ${formatRoutineHours(routine.usualHours)} h for ${routine.title}`}
                        onClick={() => handleLog(routine)}
                      >
                        {`Log ${formatRoutineHours(routine.usualHours)} h`}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Log now for ${routine.title}`}
                        onClick={() => handleLog(routine)}
                      >
                        Log now
                      </Button>
                    )}
                    {onEditRoutine ? (
                      <Button
                        variant="toolbar"
                        size="sm"
                        aria-label={`Edit ${routine.title}`}
                        onClick={() => onEditRoutine(routine)}
                      >
                        Edit
                      </Button>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </ModeGroupedList>
      )}

      <div className="mt-6">
        <Button variant="secondary" icon={Plus} onClick={onNewRoutine}>
          New routine
        </Button>
      </div>
    </main>
  );
}
