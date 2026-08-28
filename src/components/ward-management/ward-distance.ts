import type { HomeRegion, Referral, Unit } from "@/components/ward-management/ward-model";
import { SYNTHETIC_TRAVEL_BANDS, TRAVEL_BANDS, type TravelBand } from "@/components/ward-management/ward-travel-bands";

export { TRAVEL_BANDS };
export type { TravelBand };

/**
 * The single entry point for "how far is this bed from where this person lives".
 *
 * A band is a fact about a PAIR, so it belongs to neither the hospital nor the ward, and every
 * screen that shows one asks this module rather than working one out. A band computed inline in a
 * component is a band that can disagree with itself between two screens — the exact defect Phase 5
 * shipped and caught by screenshot.
 *
 * Nothing here writes a band onto a record. Not a `Referral`, not a `Movement`, not an event, not
 * a snapshot, not a cache: a stored band would outlive the day the placeholders in
 * `ward-travel-bands.ts` are replaced with checked values, which is precisely what must not
 * happen. The band is only ever looked up.
 */

/**
 * The band from a person's home region to a hospital site, or `undefined` when the synthetic
 * fixture records none for that pair. NEVER falls back to a band — not to the first band, not to
 * the nearest one, not to "unknown means far". An unrecorded pair is a gap, and a gap is shown as
 * a gap.
 */
export function travelBand(homeRegion: HomeRegion, siteCode: string): TravelBand | undefined {
  return SYNTHETIC_TRAVEL_BANDS[homeRegion]?.[siteCode];
}

/**
 * The same fact for a candidate unit, resolving the unit's site for the caller.
 *
 * The band is measured from the referral's `homeRegion` to the CANDIDATE UNIT'S OWN SITE. It is
 * never taken from `referral.originSiteCode`: that is the hospital the referral came from, not
 * where the person lives, and measuring from it would call a city bed close for someone driven
 * into a city emergency department from a long way away. `homeRegion` exists to make that
 * impossible, and this function is where that decision is spent.
 *
 * `unit.siteCode` is read directly rather than resolved through `ward-sites.ts`, deliberately:
 * this module's imports stay at types from `ward-model.ts` plus its own fixture, which is what
 * keeps it safe to import from the referral surface.
 */
export function unitTravelBand(referral: Referral, unit: Unit): TravelBand | undefined {
  return travelBand(referral.homeRegion, unit.siteCode);
}

/**
 * The one spelling of every band. Typed as a total `Record` over `TravelBand`, so the compiler —
 * not a reviewer comparing three copies — is what fails when a band is added to `TRAVEL_BANDS`
 * without a label, or when a label is written for a band that does not exist.
 *
 * No label ranks a band. `air_transport_only` reads as a statement about how you get there, not
 * about how long it takes: a flight can be shorter than a drive, and nothing in this prototype
 * knows how anyone actually travels.
 */
export const TRAVEL_BAND_LABELS: Record<TravelBand, string> = {
  under_an_hour: "Under an hour from home",
  one_to_three_hours: "One to three hours from home",
  three_hours_or_more: "Three hours or more from home",
  air_transport_only: "Reachable only by air",
};

/** The one spelling of the not-recorded group. A gap is named, never guessed at. */
export const NOT_RECORDED_LABEL = "Travel time not recorded";

/**
 * This prototype's invented "out of area" line, written as a LIST OF BAND NAMES rather than as a
 * number. That is not a stylistic choice: a numeric threshold here would be an invented figure
 * that a later reader could mistake for something somebody measured, and it would need a real
 * provenance record. A list of band names can never be read as a measured figure and needs none.
 */
export const OUT_OF_AREA_BANDS: readonly TravelBand[] = ["three_hours_or_more", "air_transport_only"];

export const SYNTHETIC_TRAVEL_TIMES_NOTICE =
  "Travel times on this screen are invented, like every bed number in this prototype. Nobody has " +
  "measured or checked how far any of these hospitals is from anywhere, and no distance shown here " +
  "should be relied on.";

export const INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE =
  "Out of area here means three hours or more from home, or reachable only by air. This prototype " +
  "invented that line. Nobody has checked whether Western Australian mental health services already " +
  'define "out of area", and if they do, their definition replaces this one.';
