/**
 * Every production Caring Contacts destination, in one place.
 *
 * The shapes mirror the approved mockup identities in
 * `src/components/caring-contacts/mockups/types.ts` with the `/mockups` prefix
 * removed, and deliberately avoid every shape in
 * `SUPERSEDED_CARING_CONTACT_ROUTE_PATTERNS` — those nested the whole workspace
 * under an episode id and were rejected during design.
 *
 * Only `today` ships a page in Phase 2A. The rest are declared now so the
 * workspace navigation has one source for its hrefs and Plan 2B never has to
 * re-derive a path from a string literal scattered across components.
 *
 * This module is plain string data with no React and no client code, so the
 * tools catalogue can name the workspace's front door without pulling any of
 * the workspace itself into the Clinical KB dashboard's bundle.
 */

export const CARING_CONTACTS_BASE = "/caring-contacts" as const;

export const CARING_CONTACTS_ROUTES = {
  today: CARING_CONTACTS_BASE,
  patients: `${CARING_CONTACTS_BASE}/patients`,
  newPlan: `${CARING_CONTACTS_BASE}/plans/new`,
  schedule: `${CARING_CONTACTS_BASE}/schedule`,
  templates: `${CARING_CONTACTS_BASE}/templates`,
  team: `${CARING_CONTACTS_BASE}/team`,
  guidance: `${CARING_CONTACTS_BASE}/guidance`,
  reports: `${CARING_CONTACTS_BASE}/reports`,
  serviceStop: `${CARING_CONTACTS_BASE}/service-stop`,
  accessTrail: `${CARING_CONTACTS_BASE}/access-trail`,
  workload: `${CARING_CONTACTS_BASE}/workload`,
  reconciliation: `${CARING_CONTACTS_BASE}/reconciliation`,
  notifications: `${CARING_CONTACTS_BASE}/notifications`,
  training: `${CARING_CONTACTS_BASE}/training`,
  coverage: `${CARING_CONTACTS_BASE}/coverage`,
} as const;

export type CaringContactsRouteKey = keyof typeof CARING_CONTACTS_ROUTES;
export type CaringContactsRoute = (typeof CARING_CONTACTS_ROUTES)[CaringContactsRouteKey];

export function patientRoute(patientId: string): string {
  return `${CARING_CONTACTS_ROUTES.patients}/${encodeURIComponent(patientId)}`;
}

/**
 * The query parameter the patient overview accepts to name WHICH of a patient's plans to open.
 *
 * Declared here rather than in the page, because the builder below and the page's own parser must
 * agree on the name and a second copy of the string is how they would stop agreeing. Ruling 97:
 * one patient can honestly hold two episodes, the overview never picks between them, and this is
 * how the clinician's choice travels — in the URL, so the chooser needs no client state at all.
 */
export const CARING_CONTACTS_PLAN_QUERY_PARAM = "plan" as const;

/** One patient's overview, scoped to one named plan. The page still validates that the plan is
 * this patient's and this team's before it reads anything with it. */
export function patientPlanRoute(patientId: string, planId: string): string {
  const params = new URLSearchParams({ [CARING_CONTACTS_PLAN_QUERY_PARAM]: planId });
  return `${patientRoute(patientId)}?${params.toString()}`;
}

export function planRoute(planId: string): string {
  return `${CARING_CONTACTS_BASE}/plans/${encodeURIComponent(planId)}`;
}

export function contactRoute(contactId: string): string {
  return `${CARING_CONTACTS_BASE}/contacts/${encodeURIComponent(contactId)}`;
}

export function pathwayRoute(pathwayId: string): string {
  return `${CARING_CONTACTS_ROUTES.templates}/${encodeURIComponent(pathwayId)}`;
}

export function episodeTimelineRoute(planId: string): string {
  return `${planRoute(planId)}/timeline`;
}
