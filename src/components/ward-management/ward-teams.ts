import { HOME_REGIONS, type HomeRegion } from "@/components/ward-management/ward-model";

/**
 * Task 6: the ward board shows where a discharged patient is going back to — a community mental
 * health team, one per `HomeRegion`. This system holds no real map from a WA region to a
 * community team, and inventing one would assert something false about a real service, so every
 * name below is **deliberately and visibly synthetic**, the same discipline `wardSites.ts` and
 * `ward-change-reasons.ts` already hold to for their own fixed vocabularies.
 *
 * Each name is the region's own name (real WA geography, permitted by roadmap decision 12: "real
 * WA place names for geography and distance only" — see `HOME_REGIONS`'s own doc comment) plus a
 * clearly generic descriptor and a `(placeholder)` marker, so the name reads on sight as a stand-in
 * rather than a claim about who actually runs community care in that region. None of these ten
 * strings is the name of any real WA health service, hospital, or existing team.
 *
 * `Record<HomeRegion, string>` rather than a hand-maintained array: the mapping type itself fails
 * to compile the day `HOME_REGIONS` gains an eleventh region without a matching entry here — the
 * same "runtime array with a derived type, never a hand-written duplicate" discipline every other
 * fixed vocabulary in `ward-model.ts` already holds to (see `COHORTS`'s own doc comment for the
 * defect class this closes).
 *
 * Provenance, stated because it matters: these ten names were invented by an agent session for
 * this prototype. No community team has seen them, and none has agreed to be represented by them.
 * The product owner may later supply real team names; because this is a flat lookup table keyed
 * on the same `HomeRegion` union already used everywhere else in the model, replacing every value
 * here is a table swap — under an hour's work — not a redesign.
 */
export const COMMUNITY_TEAMS: Record<HomeRegion, string> = {
  "Perth Metropolitan": "Perth Metropolitan Community Mental Health Team (placeholder)",
  Peel: "Peel Community Mental Health Team (placeholder)",
  "South West": "South West Community Mental Health Team (placeholder)",
  "Great Southern": "Great Southern Community Mental Health Team (placeholder)",
  Wheatbelt: "Wheatbelt Community Mental Health Team (placeholder)",
  "Goldfields-Esperance": "Goldfields-Esperance Community Mental Health Team (placeholder)",
  "Mid West": "Mid West Community Mental Health Team (placeholder)",
  Gascoyne: "Gascoyne Community Mental Health Team (placeholder)",
  Pilbara: "Pilbara Community Mental Health Team (placeholder)",
  Kimberley: "Kimberley Community Mental Health Team (placeholder)",
};

/**
 * Looks up the synthetic community team for a region. `region` is untyped `string` because it is
 * meant for values arriving from outside this module's own type-safe world (e.g. read off a
 * `Referral.homeRegion` that has already been widened, or any other external input) — a value that
 * is not a real member of `HOME_REGIONS` returns `null` rather than a guess or a fallback team,
 * the same discipline `unitById`/`edById`/`siteByCode` in `ward-sites.ts` hold to for an unknown
 * id: never fall back to a different answer.
 */
export function teamForRegion(region: string): string | null {
  return (HOME_REGIONS as readonly string[]).includes(region) ? COMMUNITY_TEAMS[region as HomeRegion] : null;
}
