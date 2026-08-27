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
import { elapsedMinutesSinceMount, wallClockNow } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { BedRelease, LeaveBed, Movement, Rejection, Unit } from "@/components/ward-management/ward-model";
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
  now: Instant;
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
  const [state, dispatch] = useReducer(wardFlowReducer, undefined, seedWardFlowState);

  // `wallClockNow()` — the only wall-clock read this component is allowed to make (see
  // ward-clock.ts) — only ever returns a minute-of-day (0–1439), so two readings on their own
  // can never carry more than one day's worth of information: `elapsedMinutesSinceMount` can
  // correctly unwrap a SINGLE midnight rollover between two readings, but a dashboard left
  // mounted for exactly 24h (or any multiple of it) reads the same minute-of-day again, so a
  // plain two-reading comparison against the ORIGINAL mount instant goes back to `raw === 0`
  // and silently resets elapsed time to zero instead of continuing to grow — moving every
  // deadline, wait and expired hold on every screen backward by up to a day. Fixed by never
  // comparing against the original mount instant again: each 30s tick folds its own delta
  // (never more than 30s + scheduling jitter, so always safely inside one midnight rollover)
  // into `elapsedBefore`, an accumulator that only ever grows — so the total is correct no
  // matter how many midnights the session spans, not just the first one.
  const [clockCheckpoint, setClockCheckpoint] = useState<{ reading: Instant; elapsedBefore: number }>(() => ({
    reading: initialNow ?? wallClockNow(),
    elapsedBefore: 0,
  }));

  useEffect(() => {
    if (initialNow !== undefined) return; // pinned: never tick in a test
    const id = setInterval(() => {
      setClockCheckpoint((previous) => {
        const reading = wallClockNow();
        return { reading, elapsedBefore: previous.elapsedBefore + elapsedMinutesSinceMount(previous.reading, reading) };
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [initialNow]);

  // The base instant the demo day is read from, before any in-app `ADVANCE_CLOCK` offset.
  //
  // Pinned (`initialNow` supplied by a test or any deterministic render): the caller's instant
  // IS the clock. It is used verbatim rather than as a mere "do not tick" flag — a pinned
  // provider that ignored the value and always read `NOW_ANCHOR` would make every
  // time-of-day branch in the screens unreachable from a test, because the only clock a test
  // could ever obtain would be the one instant the fixture is authored around.
  //
  // Unpinned (the live app): `NOW_ANCHOR` plus real elapsed time. Recomputed from the live
  // wall clock on every render (not only on a tick, so a missed/delayed timer tick still
  // reports the true elapsed minutes rather than a fixed 30s-per-tick approximation) — but
  // layered on top of the last checkpoint's accumulated total rather than the original mount
  // instant, which is what keeps this correct beyond one day. The pinned path never touches
  // the wall clock.
  const base =
    initialNow !== undefined
      ? initialNow
      : NOW_ANCHOR + clockCheckpoint.elapsedBefore + elapsedMinutesSinceMount(clockCheckpoint.reading, wallClockNow());
  const now = base + state.clockOffsetMinutes;

  const [focusMovementId, setFocusMovementId] = useState<string | undefined>(undefined);

  const value = useMemo<WardFlowContextValue>(
    () => ({
      movements: state.movements,
      units: state.units,
      rejections: state.rejections,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      refreshRequests: state.refreshRequests,
      now,
      scenario: state.scenario,
      dispatch,
      focusMovementId,
      setFocusMovementId,
    }),
    [
      state.movements,
      state.units,
      state.rejections,
      state.bedReleases,
      state.leaveBeds,
      state.refreshRequests,
      now,
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
