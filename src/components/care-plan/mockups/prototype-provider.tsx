"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";

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
 *
 * There is deliberately no online/offline listener. Nothing in a memory-only
 * prototype depends on the network, so a real connectivity event must not change
 * state — blocking a clinician's draft because their wifi blipped would be a
 * failure this application invented. `connectivity.online` is a specimen flag,
 * set from the System states route and nowhere else.
 */
export function CarePlanPrototypeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(prototypeReducer, undefined, () => createInitialPrototypeState());
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
