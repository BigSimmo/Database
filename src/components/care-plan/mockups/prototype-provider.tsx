"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";

import { createInitialPrototypeState, prototypeReducer } from "./prototype-state";
import type { CarePlanPrototypeAction, CarePlanPrototypeState } from "./types";

type CarePlanPrototypeContextValue = {
  state: CarePlanPrototypeState;
  dispatch: (action: CarePlanPrototypeAction) => void;
};

const CarePlanPrototypeContext = createContext<CarePlanPrototypeContextValue | null>(null);

/**
 * One provider owns the whole synthetic application state, so every route reads
 * the same record rather than keeping a copy of its own. It is mounted once, in
 * the route-family layout, and it performs no persistence and no network access
 * of any kind: nothing is saved, and reloading the page starts over.
 */
export function CarePlanPrototypeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(prototypeReducer, undefined, () => createInitialPrototypeState());

  // The reducer must stay a pure function of the state it is given, so the
  // browser's own connectivity is read here and only here, and reaches the
  // state as an ordinary dispatched action like everything else.
  const scenarioRef = useRef(state.scenario);
  useEffect(() => {
    scenarioRef.current = state.scenario;
  }, [state.scenario]);

  useEffect(() => {
    // Only the offline specimen is entered and left by these events. A spurious
    // event while another specimen is displayed changes nothing, so a flicker in
    // the network connection cannot discard work that is only held in memory.
    const handleOnline = () => {
      if (scenarioRef.current === "offline") dispatch({ type: "apply-scenario", scenario: "normal" });
    };
    const handleOffline = () => {
      if (scenarioRef.current !== "offline") dispatch({ type: "apply-scenario", scenario: "offline" });
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <CarePlanPrototypeContext.Provider value={value}>{children}</CarePlanPrototypeContext.Provider>;
}

export function useCarePlanPrototype(): CarePlanPrototypeContextValue {
  const value = useContext(CarePlanPrototypeContext);
  if (value === null) {
    throw new Error("Care Plan prototype surfaces must be rendered inside CarePlanPrototypeProvider.");
  }
  return value;
}
