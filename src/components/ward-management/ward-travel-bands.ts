import type { HomeRegion } from "@/components/ward-management/ward-model";

/**
 * The four bands this prototype speaks in, and the ONLY list any picker, group heading or label
 * map may derive from — the same runtime-array discipline `COHORTS`, `SEXES`, `SEX_DESIGNATIONS`
 * and `REFERRAL_SOURCES` already hold to. A hand-written second copy of these names is how two
 * screens end up disagreeing about what bands exist.
 *
 * A band is a fact about a PAIR — a home region and a hospital site. It belongs to neither, so it
 * is never stored on a `Site`, a `Unit`, a `Referral`, a `Movement`, an event, a snapshot or a
 * cache; it is only ever looked up. That is what keeps replacing this file's values the whole
 * change on the day somebody replaces them with checked ones.
 *
 * `air_transport_only` sits last for grouping order and for nothing else. It is a statement about
 * HOW you get somewhere, not about how long it takes — a flight can be shorter than a drive, and
 * this prototype knows nothing about how anyone actually travels.
 */
export const TRAVEL_BANDS = [
  "under_an_hour",
  "one_to_three_hours",
  "three_hours_or_more",
  "air_transport_only",
] as const;

export type TravelBand = (typeof TRAVEL_BANDS)[number];

/**
 * A sparse table: home region, then site code, then band. Both levels are partial on purpose —
 * an unrecorded pair reads as `undefined`, never as a default.
 */
export type TravelBandTable = Readonly<Partial<Record<HomeRegion, Readonly<Partial<Record<string, TravelBand>>>>>>;

/** SYNTHETIC. Every band below is invented, exactly like every bed number in `ward-sites.ts`.
 *  Nobody has measured or checked the real travel time between any WA region and any hospital in
 *  this table, and no value here was chosen to resemble one — the pairs recorded were chosen to
 *  exercise the four bands, the sparse case and the whole-region gap. Not every pair is recorded,
 *  and an unrecorded pair is `undefined` — never a default, never the nearest band, never
 *  "unknown means far".
 *
 *  HOW THE VALUES WERE PICKED, so a later reader does not mistake them for research. No map,
 *  atlas, search or recollection of Western Australian geography was consulted. Which pairs are
 *  recorded was chosen for coverage: every band live, at least one site unrecorded inside a
 *  recorded region, at least one whole region unrecorded that a seeded referral uses, and at
 *  least two units sharing one band. Which band each recorded pair got was then decided
 *  mechanically by LIST POSITION — the band at index (region's position in `HOME_REGIONS` plus
 *  the site's position in `wardSites`) modulo the number of bands — so that no step of the
 *  authoring could smuggle in a judgement about how far anywhere actually is. Some results read
 *  as obviously wrong for the real places named. That is the point, and it is safer than a table
 *  that reads as though somebody checked it.
 *
 *  Replacing these values with checked ones is a change to this object and nothing else. */
export const SYNTHETIC_TRAVEL_BANDS: TravelBandTable = {
  "Perth Metropolitan": {
    RPH: "under_an_hour",
    SCGH: "one_to_three_hours",
    FSH: "three_hours_or_more",
    ARM: "air_transport_only",
    FRE: "under_an_hour",
  },
  "South West": {
    RPH: "three_hours_or_more",
    SCGH: "air_transport_only",
    BUN: "three_hours_or_more",
  },
  "Great Southern": {
    ALB: "three_hours_or_more",
  },
  "Mid West": {
    FSH: "under_an_hour",
    GER: "under_an_hour",
  },
  Pilbara: {
    SCGH: "one_to_three_hours",
  },
  Kimberley: {
    RPH: "one_to_three_hours",
    BRM: "three_hours_or_more",
    KUN: "under_an_hour",
  },
};
