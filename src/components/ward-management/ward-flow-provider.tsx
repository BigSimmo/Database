"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import { absoluteWallClockMinutes, demoDayZero, wallClockNow } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Patient } from "@/components/ward-management/ward-patients";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type {
  BedRelease,
  LeaveBed,
  Movement,
  Referral,
  Rejection,
  Unit,
} from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardScenario } from "@/components/ward-management/ward-scenarios";

/**
 * The screens never see the raw reducer state or the clock's internal offsets — they see the
 * three collections plus a single resolved `now`, and the one way to raise an event.
 *
 * Task 12: `focusMovementId` is the one piece of UI-only state this context carries alongside
 * the reducer's own — "which patient is currently in view", set only by the coordinator
 * screen's own movement selection (`coordinator-screen.tsx`'s `selectMovement`). It exists here,
 * shared, rather than as `CoordinatorScreen`'s own local state, because `WardRoleSwitcher`
 * renders on every ward-management route (inside `ClinicalRail`) and needs to answer "where
 * does this patient's Ward/ED role live" regardless of which screen it is currently rendered
 * on — a route change swaps out the page under this shared layout, which would otherwise reset
 * a screen-local selection back to nothing on every hop. It is never read by the reducer and
 * never dispatched as an event: it is display/navigation state only, the same category as
 * `selectedUnitId`/`selectedEdId` already are on the coordinator screen, just lifted one level
 * because it now has more than one reader.
 */
type WardFlowContextValue = {
  movements: Movement[];
  units: Unit[];
  /** Task 5 (Phase 7, "The front door"): the referral board and match view need every front-door
   *  referral, live from reducer state — the same reasoning `bedReleases`/`leaveBeds` below
   *  already document for their own collections. Previously omitted: the intake form's own
   *  success banner (`referral-intake.tsx`) could not echo the referral it had just raised,
   *  because nothing on this context carried it. */
  referrals: Referral[];
  rejections: Rejection[];
  /** Task 11 (spec item 9): beds expected to free up, live from reducer state so a ward's own
   *  `FLAG_BED_RELEASE` shows up on every screen reading `unitCapacity()`'s `potential` figure. */
  bedReleases: BedRelease[];
  /** Task 3: beds occupied by someone on approved leave, live from reducer state so a ward's own
   *  `RECORD_LEAVE_BED`/`END_LEAVE_BED` shows up on every screen reading it. Never merged into
   *  availability (spec D4). */
  leaveBeds: LeaveBed[];
  /** Task 3, spec D12: every `REQUEST_CAPACITY_REFRESH` a coordinator has raised, live from
   *  reducer state. Records that somebody asked — nothing here ever changes a bed figure. */
  refreshRequests: { unitId: string; at: Instant; byRole: string }[];
  /** The people in the beds - seeded occupants plus anyone who has ARRIVED during this session.
   *  Task 17, 2026-08-30: before this, arrival closed the movement and created no person, so a
   *  patient who reached a ward disappeared from every surface that filters to open movements. */
  /** The people. A patient exists before any referral and outlives every admission, so search can
   *  find somebody with nothing attached at all - which is the case the owner's flow turns on. */
  patients: Patient[];
  admissions: Admission[];
  now: Instant;
  /** The calendar day that `Instant` 0 falls on - local midnight of the day this session opened.
   *  An instant plus this is a real moment; an instant alone is only an offset. Screens that must
   *  say a DATE rather than a relative day read it from here so every surface agrees. */
  dayZero: Date;
  /** Which synthetic night is seeded — `ward-scenarios.ts`'s `WardScenario` — so a UI surface
   *  (`ward-demo-controls.tsx`'s scenario switch) can mark the active one without guessing it
   *  from `units` itself. */
  scenario: WardScenario;
  dispatch: Dispatch<WardFlowEvent>;
  focusMovementId: string | undefined;
  setFocusMovementId: Dispatch<SetStateAction<string | undefined>>;
};

const WardFlowContext = createContext<WardFlowContextValue | null>(null);

type WardFlowProviderProps = {
  children: ReactNode;
  /**
   * Pins the clock at this instant and stops it from ticking. Tests and any deterministic
   * render (screenshots, contract walks) pass this; the live app omits it so the clock reads
   * the wall clock once at mount and then advances only via the 30s tick interval, never by
   * re-reading the wall clock on every render.
   */
  initialNow?: Instant;
};

export function WardFlowProvider({ children, initialNow }: WardFlowProviderProps) {
  /**
   * How far the demo's day sits from the day the fixture was authored on. Read ONCE, at mount, so
   * every instant the app shows moves together; re-reading it per render would let the seed and the
   * clock drift apart between two renders of the same screen.
   *
   * Zero on the pinned path. A deterministic render (tests, screenshots, contract walks) keeps the
   * frozen 10:42 night the fixture was measured against, which is what lets 53 test files assert
   * against it without depending on the hour the suite happens to run.
   */
  const [anchorOffsetMinutes] = useState<number>(() => (initialNow !== undefined ? 0 : wallClockNow() - NOW_ANCHOR));

  const [state, dispatch] = useReducer(wardFlowReducer, anchorOffsetMinutes, (offset) =>
    shiftInstants(seedWardFlowState(), offset),
  );

  /**
   * The moment this session opened, and the day 0 that every `Instant` counts from. Captured once:
   * two components deriving it separately would disagree across midnight, which is the
   * two-clocks-on-one-card failure a layer down.
   */
  const [dayZero] = useState<Date>(() => demoDayZero(new Date()));

  /**
   * Minutes since the epoch at mount, carrying the DATE and not only the time of day.
   *
   * This is what removed the midnight workaround rather than improving it. `wallClockNow()` returns
   * 0-1439, so two readings cannot say how many days apart they are: the old code assumed a negative
   * difference meant exactly one rollover, which held only because it re-read every thirty seconds,
   * and needed a running accumulator so a session spanning several midnights did not reset to zero.
   * An absolute count makes elapsed time a plain subtraction that is correct over any span, and the
   * whole class of bug disappears rather than being handled.
   */
  const [mountedAtAbsolute] = useState<number>(() => absoluteWallClockMinutes());

  // Re-renders on a 30s cadence so the clock advances on screen. It carries no time itself - the
  // elapsed figure below is recomputed from the live clock on every render, so a missed or delayed
  // tick reports the true elapsed minutes rather than a fixed 30s-per-tick approximation.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (initialNow !== undefined) return; // pinned: never tick in a test
    const id = setInterval(() => setTick((previous) => previous + 1), 30_000);
    return () => clearInterval(id);
  }, [initialNow]);

  // A pinned `initialNow` (tests, deterministic renders) never touches the wall clock.
  const elapsed = initialNow !== undefined ? 0 : absoluteWallClockMinutes() - mountedAtAbsolute;

  const now = NOW_ANCHOR + anchorOffsetMinutes + elapsed + state.clockOffsetMinutes;

  const [focusMovementId, setFocusMovementId] = useState<string | undefined>(undefined);

  const value = useMemo<WardFlowContextValue>(
    () => ({
      movements: state.movements,
      units: state.units,
      referrals: state.referrals,
      rejections: state.rejections,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      refreshRequests: state.refreshRequests,
      patients: state.patients,
      admissions: state.admissions,
      now,
      dayZero,
      scenario: state.scenario,
      dispatch,
      focusMovementId,
      setFocusMovementId,
    }),
    [
      state.movements,
      state.units,
      state.referrals,
      // Both added 2026-08-30 and both were MISSING when their fields were exposed, which is a real
      // defect rather than a lint nicety: without them the context value is memoised against a stale
      // state, so a patient added during a session would not appear in search and a patient arriving
      // on a ward would not appear as an occupant. Every test passed, because each renders fresh.
      state.patients,
      state.admissions,
      state.rejections,
      state.bedReleases,
      state.leaveBeds,
      state.refreshRequests,
      now,
      dayZero,
      state.scenario,
      dispatch,
      focusMovementId,
    ],
  );

  return <WardFlowContext.Provider value={value}>{children}</WardFlowContext.Provider>;
}

/** Conservative failure: a screen rendered outside the provider must fail loudly, never fall
 * back to a default empty world that would silently read as "no patients tonight". */
export function useWardFlow(): WardFlowContextValue {
  const context = useContext(WardFlowContext);
  if (!context) throw new Error("useWardFlow must be used within WardFlowProvider.");
  return context;
}
