export { CarePlanErrorBoundary } from "./care-plan-error-boundary";
export { CarePlanShellFrame } from "./care-plan-shell-frame";
export { CarePlanPrototypeProvider, useCarePlanPrototype } from "./prototype-provider";
export { CarePlanRoutableSuite, CarePlanRouteSurface, resolveCarePlanRoute, scenarioFromQuery } from "./routable-suite";
export {
  CARE_PLAN_BASE,
  CARE_PLAN_MORE_DESTINATIONS,
  CARE_PLAN_PRIMARY_DESTINATIONS,
  CARE_PLAN_ROUTES,
  CARE_PLAN_SYSTEM_STATES_DESTINATION,
  SYNTHETIC_PATIENT_PARAMS,
  SYNTHETIC_PRESENTATION_PARAMS,
  carePlanRoute,
  isSyntheticPatientId,
  isSyntheticPresentationForPatient,
  withQuery,
} from "./routes";
export type { CarePlanDestination, CarePlanRouteKey } from "./routes";
export { PROTOTYPE_NOW, SYNTHETIC_DATA_MARKER } from "./fixtures";
export type * from "./types";
