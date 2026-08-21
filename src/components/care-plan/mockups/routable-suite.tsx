"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { CarePlanShellFrame } from "./care-plan-shell-frame";
import styles from "./care-plan.module.css";
import { ClinicalSnapshotSurface, type ClinicalSnapshotVariant } from "./clinical-snapshot-page";
import { useCarePlanPrototype } from "./prototype-provider";
import { CARE_PLAN_BASE, CARE_PLAN_ROUTES, isSyntheticPatientId, type CarePlanDestination } from "./routes";
import type { PrototypeScenario } from "./types";

/**
 * The approved heading and purpose of each route in the family. Task 3 renders
 * only this — a working shell specimen with no unavailable controls — and Tasks 4
 * to 8 replace one route's purpose surface at a time with its real content.
 */
type CarePlanRouteDefinition = {
  key: string;
  heading: string;
  purpose: string;
  destination: CarePlanDestination;
};

const ROUTE_DEFINITIONS = {
  home: {
    key: "home",
    heading: "Home",
    purpose: "Search-first Home and Clinical Snapshot",
    destination: "Home",
  },
  patients: {
    key: "patients",
    heading: "Patients",
    purpose: "Full patient directory and presentation-activity view",
    destination: "Patients",
  },
  patient: {
    key: "patient",
    heading: "Patient overview",
    purpose: "Patient overview and first-minute snapshot",
    destination: "Patients",
  },
  managementPlan: {
    key: "managementPlan",
    heading: "Management Plan",
    purpose: "Full Current Plan, draft summary, review state, and version history entry points",
    destination: "Patients",
  },
  managementPlanEdit: {
    key: "managementPlanEdit",
    heading: "Draft Management Plan Version",
    purpose: "Create or edit a draft version",
    destination: "Patients",
  },
  managementPlanReview: {
    key: "managementPlanReview",
    heading: "Review submitted version",
    purpose: "Compare, return for changes, and approve a submitted version",
    destination: "Patients",
  },
  managementPlanPrint: {
    key: "managementPlanPrint",
    heading: "Print Management Plan",
    purpose: "Print-optimised clinician summary to carry to the bedside or send with a handover",
    destination: "Patients",
  },
  patientPlan: {
    key: "patientPlan",
    heading: "Patient Plan",
    purpose: "The patient-facing edition of the Management Plan, with its own version and approval state",
    destination: "Patients",
  },
  patientPlanEdit: {
    key: "patientPlanEdit",
    heading: "Draft Patient Plan",
    purpose: "Create the patient edition from the Current Plan, fill its flagged gaps, and approve it",
    destination: "Patients",
  },
  patientPlanPrint: {
    key: "patientPlanPrint",
    heading: "Print Patient Plan",
    purpose: "Print-optimised patient copy, including their resources",
    destination: "Patients",
  },
  safetyPlan: {
    key: "safetyPlan",
    heading: "Personal Safety Plan",
    purpose: "Current patient-owned Personal Safety Plan",
    destination: "Patients",
  },
  safetyPlanEdit: {
    key: "safetyPlanEdit",
    heading: "Draft Personal Safety Plan Version",
    purpose: "Co-produce or revise a Personal Safety Plan Version",
    destination: "Patients",
  },
  safetyPlanPrint: {
    key: "safetyPlanPrint",
    heading: "Print Personal Safety Plan",
    purpose: "Print-optimised patient copy",
    destination: "Patients",
  },
  presentations: {
    key: "presentations",
    heading: "ED Presentations",
    purpose: "Longitudinal ED Presentation timeline",
    destination: "Patients",
  },
  newPresentation: {
    key: "newPresentation",
    heading: "Record ED Presentation",
    purpose: "Record a concise ED Presentation",
    destination: "Patients",
  },
  presentation: {
    key: "presentation",
    heading: "ED Presentation",
    purpose: "View an episode, plan-use feedback, outcome, and amendments",
    destination: "Patients",
  },
  history: {
    key: "history",
    heading: "History",
    purpose: "Combined plan, presentation-amendment, print, and contact-action audit chronology",
    destination: "Patients",
  },
  reviews: {
    key: "reviews",
    heading: "Reviews",
    purpose: "Awaiting Approval, Review Suggested, contact verification, and manual identification queues",
    destination: "Reviews",
  },
  team: {
    key: "team",
    heading: "Team",
    purpose: "Synthetic CMHT and plan-owner directory",
    destination: "Team",
  },
  governance: {
    key: "governance",
    heading: "Governance",
    purpose: "Prototype boundary, roles, lifecycle rules, and unresolved identification policy",
    destination: "Governance",
  },
  systemStates: {
    key: "systemStates",
    heading: "System states",
    purpose: "Deterministic degraded-state specimens and scenario controls",
    destination: "System states",
  },
} as const satisfies Record<string, CarePlanRouteDefinition>;

const PATIENT_PLAN_SEGMENTS = {
  "management-plan": {
    base: ROUTE_DEFINITIONS.managementPlan,
    edit: ROUTE_DEFINITIONS.managementPlanEdit,
    review: ROUTE_DEFINITIONS.managementPlanReview,
    print: ROUTE_DEFINITIONS.managementPlanPrint,
  },
  "patient-plan": {
    base: ROUTE_DEFINITIONS.patientPlan,
    edit: ROUTE_DEFINITIONS.patientPlanEdit,
    print: ROUTE_DEFINITIONS.patientPlanPrint,
  },
  "safety-plan": {
    base: ROUTE_DEFINITIONS.safetyPlan,
    edit: ROUTE_DEFINITIONS.safetyPlanEdit,
    print: ROUTE_DEFINITIONS.safetyPlanPrint,
  },
} as const;

/**
 * Resolves a URL to its route definition from the path shape alone, so a route
 * reached by typing its address behaves exactly like one reached by a link.
 */
export function resolveCarePlanRoute(pathname: string): CarePlanRouteDefinition {
  const trimmed = pathname.split("?")[0] ?? pathname;
  if (!trimmed.startsWith(CARE_PLAN_BASE)) return ROUTE_DEFINITIONS.home;
  const segments = trimmed.slice(CARE_PLAN_BASE.length).split("/").filter(Boolean);

  if (segments.length === 0) return ROUTE_DEFINITIONS.home;

  const [first, , third, fourth] = segments;

  if (first === "reviews") return ROUTE_DEFINITIONS.reviews;
  if (first === "team") return ROUTE_DEFINITIONS.team;
  if (first === "governance") return ROUTE_DEFINITIONS.governance;
  if (first === "system-states") return ROUTE_DEFINITIONS.systemStates;
  if (first !== "patients") return ROUTE_DEFINITIONS.home;

  if (segments.length === 1) return ROUTE_DEFINITIONS.patients;
  if (segments.length === 2) return ROUTE_DEFINITIONS.patient;

  if (third === "history") return ROUTE_DEFINITIONS.history;

  if (third === "presentations") {
    if (!fourth) return ROUTE_DEFINITIONS.presentations;
    return fourth === "new" ? ROUTE_DEFINITIONS.newPresentation : ROUTE_DEFINITIONS.presentation;
  }

  const planSegment = PATIENT_PLAN_SEGMENTS[third as keyof typeof PATIENT_PLAN_SEGMENTS];
  if (!planSegment) return ROUTE_DEFINITIONS.patient;
  if (!fourth) return planSegment.base;
  if (fourth === "edit" && "edit" in planSegment) return planSegment.edit;
  if (fourth === "review" && "review" in planSegment) return planSegment.review;
  if (fourth === "print") return planSegment.print;
  return planSegment.base;
}

const SCENARIO_VALUES: readonly PrototypeScenario[] = [
  "normal",
  "empty",
  "no-current-plan",
  "overdue-plan",
  "withdrawn-plan",
  "unverified-contact",
  "identity-uncertain",
  "version-conflict",
  "offline",
  "permission-unavailable",
  "launch-failure",
  "print-failure",
];

/**
 * A URL may name a deterministic specimen state and nothing else — never a name,
 * a contact detail, or any other record content.
 */
export function scenarioFromQuery(query: string): PrototypeScenario {
  const candidate = new URLSearchParams(query).get("scenario");
  return SCENARIO_VALUES.find((scenario) => scenario === candidate) ?? "normal";
}

function RoutePurposeSurface({ purpose }: { purpose: string }) {
  return (
    <section
      data-testid="care-plan-route-purpose"
      aria-labelledby="care-plan-route-purpose-heading"
      className={styles.purposeSurface}
    >
      <h2 id="care-plan-route-purpose-heading" className="sr-only">
        What this route is for
      </h2>
      <p className={styles.purposeText}>{purpose}</p>
      <p className={styles.purposeFollowUp}>
        This route is reachable, addressable and part of the shell. Its reading and authoring content is built in a
        later stage of the prototype.
      </p>
    </section>
  );
}

/**
 * The synthetic patient a patient-scoped address names, or `null` when the
 * address names none or names one the fixtures do not contain. The page files
 * already refuse an unknown parameter with `notFound()`; this is the same check
 * again on the reading side, so a hand-typed address can never make a surface
 * ask the state for a record that does not exist.
 */
export function carePlanPatientIdFromPathname(pathname: string): string | null {
  const trimmed = pathname.split("?")[0] ?? pathname;
  if (!trimmed.startsWith(CARE_PLAN_BASE)) return null;
  const segments = trimmed.slice(CARE_PLAN_BASE.length).split("/").filter(Boolean);
  if (segments[0] !== "patients") return null;
  const candidate = segments[1];
  return candidate !== undefined && isSyntheticPatientId(candidate) ? candidate : null;
}

/**
 * The three routes Task 4 gave real content. Each owns a Clinical Snapshot
 * variant instead of the Task 3 purpose surface, and Home and Patients own their
 * own directory search rather than borrowing the shell composer.
 */
const SNAPSHOT_VARIANT_BY_ROUTE_KEY: Partial<Record<string, ClinicalSnapshotVariant>> = {
  home: "home",
  patients: "patients",
  patient: "patient",
};

export type CarePlanRouteSurfaceProps = {
  pathname: string;
  query?: string;
  navigate: (href: string) => void;
};

/**
 * The whole route family rendered from plain strings and one navigation
 * callback, so every route can be exercised without a router.
 */
export function CarePlanRouteSurface({ pathname, query = "", navigate }: CarePlanRouteSurfaceProps) {
  const { state } = useCarePlanPrototype();
  const route = useMemo(() => resolveCarePlanRoute(pathname), [pathname]);
  const scenario = useMemo(() => scenarioFromQuery(query), [query]);
  const activeUser = state.users.find((user) => user.id === state.activeUserId);
  const snapshotVariant = SNAPSHOT_VARIANT_BY_ROUTE_KEY[route.key];
  const patientId = useMemo(() => carePlanPatientIdFromPathname(pathname), [pathname]);

  return (
    <CarePlanShellFrame
      pathname={pathname}
      activeDestination={route.destination}
      title={route.heading}
      scenario={scenario}
      activeUser={{ displayName: activeUser?.displayName ?? "", title: activeUser?.title ?? "" }}
      onSearchSubmit={() => navigate(CARE_PLAN_ROUTES.patients)}
      // Home and Patients own an in-flow directory search, so the shell stands
      // its own composer down rather than putting two search fields on one page.
      routeOwnsSearch={snapshotVariant === "home" || snapshotVariant === "patients"}
    >
      {snapshotVariant === undefined ? (
        <RoutePurposeSurface purpose={route.purpose} />
      ) : (
        <ClinicalSnapshotSurface variant={snapshotVariant} patientId={patientId ?? undefined} scenario={scenario} />
      )}
    </CarePlanShellFrame>
  );
}

/** The router wrapper: the only place Care Plan reads Next.js navigation. */
export function CarePlanRoutableSuite() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  return (
    <CarePlanRouteSurface pathname={pathname} query={searchParams.toString()} navigate={(href) => router.push(href)} />
  );
}
