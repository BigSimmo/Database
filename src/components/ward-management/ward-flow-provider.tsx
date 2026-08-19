"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import { wallClockNow } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Rejection, Unit } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The screens never see the raw reducer state or the clock's internal offsets — they see the
 * three collections plus a single resolved `now`, and the one way to raise an event.
 */
type WardFlowContextValue = {
  movements: Movement[];
  units: Unit[];
  rejections: Rejection[];
  now: Instant;
  dispatch: Dispatch<WardFlowEvent>;
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

  // `wallClockNow()` is read at most once per mount, and only from here — this is the one
  // place in the app permitted to call it (see ward-clock.ts). A pinned `initialNow` (tests,
  // deterministic renders) never touches the wall clock at all. Lazy `useState` initializers
  // run exactly once, on mount, the same guarantee the brief's ref-based sketch relied on —
  // but this repo's `react-hooks/refs` lint rule (eslint.config.mjs) forbids reading
  // `ref.current` back out during render, which the ref version below (`elapsed`) would do.
  const [mountedAt] = useState<Instant>(() => initialNow ?? wallClockNow());

  // The tick count itself is never read: `setTicks` exists only to force a re-render every
  // 30s so `now` (below) gets recomputed against the live wall clock.
  const [, setTicks] = useState(0);
  useEffect(() => {
    if (initialNow !== undefined) return; // pinned: never tick in a test
    const id = setInterval(() => setTicks((value) => value + 1), 30_000);
    return () => clearInterval(id);
  }, [initialNow]);

  // `ticks` only exists to force a re-render on the interval; the actual elapsed time is
  // recomputed from the wall clock each time so a missed/delayed timer tick still reports the
  // true elapsed minutes rather than a fixed 30s-per-tick approximation.
  const elapsed = initialNow !== undefined ? 0 : Math.max(0, wallClockNow() - mountedAt);
  const now = NOW_ANCHOR + elapsed + state.clockOffsetMinutes;

  const value = useMemo<WardFlowContextValue>(
    () => ({ movements: state.movements, units: state.units, rejections: state.rejections, now, dispatch }),
    [state.movements, state.units, state.rejections, now, dispatch],
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
